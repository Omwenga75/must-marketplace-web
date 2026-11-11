import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { Product } from "@/types";
import { INITIAL_SAMPLE_PRODUCTS } from "@/lib/constants";
import {
  getFirebaseProductById,
  saveFirebaseProduct,
  patchFirebaseProduct,
  deleteFirebaseProduct,
  getFirebaseDeletedProductIds,
  saveFirebaseDeletedProduct,
} from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const REPO_DATA_DIR = path.join(process.cwd(), "data");

function getDataDir(): string {
  try {
    if (!fs.existsSync(REPO_DATA_DIR)) fs.mkdirSync(REPO_DATA_DIR, { recursive: true });
    const testFile = path.join(REPO_DATA_DIR, ".write_test");
    fs.writeFileSync(testFile, "1", "utf8");
    fs.unlinkSync(testFile);
    return REPO_DATA_DIR;
  } catch {
    const tmpDataDir = path.join(os.tmpdir(), "must_marketplace_data");
    if (!fs.existsSync(tmpDataDir)) {
      try { fs.mkdirSync(tmpDataDir, { recursive: true }); } catch {}
    }
    const files = [
      "products.json",
      "users.json",
      "conversations.json",
      "messages.json",
      "deleted_products.json",
      "deleted_users.json",
    ];
    files.forEach((f) => {
      const src = path.join(REPO_DATA_DIR, f);
      const dest = path.join(tmpDataDir, f);
      if (!fs.existsSync(dest) && fs.existsSync(src)) {
        try { fs.copyFileSync(src, dest); } catch {}
      }
    });
    return tmpDataDir;
  }
}

function getProductsFilePath(): string {
  return path.join(getDataDir(), "products.json");
}

function getDeletedProductsFilePath(): string {
  return path.join(getDataDir(), "deleted_products.json");
}

function getLocalDeletedIds(): Set<string> {
  try {
    const filePath = getDeletedProductsFilePath();
    if (!fs.existsSync(filePath)) return new Set();
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter(Boolean));
  } catch {}
  return new Set();
}

async function getAllDeletedIds(): Promise<Set<string>> {
  const local = getLocalDeletedIds();
  const remote = await getFirebaseDeletedProductIds();
  return new Set([...local, ...remote]);
}

function saveLocalDeletedId(id: string): void {
  try {
    if (!id) return;
    const dir = getDataDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const set = getLocalDeletedIds();
    set.add(id);
    fs.writeFileSync(getDeletedProductsFilePath(), JSON.stringify([...set], null, 2), "utf8");
  } catch (err) {
    console.error("saveLocalDeletedId error:", err);
  }
}

function readAllProducts(): Product[] {
  try {
    const filePath = getProductsFilePath();
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return [];
}

function saveProducts(products: Product[]): void {
  try {
    const dir = getDataDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getProductsFilePath(), JSON.stringify(products, null, 2), "utf8");
  } catch (err) {
    console.error("saveProducts error:", err);
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await getAllDeletedIds();
  if (deleted.has(id)) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // 1. Check local file cache first (5ms instant response!)
  const products = readAllProducts();
  const localProduct = products.find((p) => p.id === id && !deleted.has(p.id));
  if (localProduct) {
    return NextResponse.json(localProduct, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  // 2. Fallback to live Firebase RTDB
  try {
    const fbProduct = await getFirebaseProductById(id);
    if (fbProduct && !deleted.has(fbProduct.id)) {
      return NextResponse.json(fbProduct, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }
  } catch {}

  return NextResponse.json({ error: "Product not found" }, { status: 404 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // 1. Direct fast atomic PATCH to Firebase RTDB in background/parallel
    patchFirebaseProduct(id, body).catch((e) => {
      console.warn("Fast patch to Firebase RTDB warning:", e);
    });

    // 2. Update in local cache
    const products = readAllProducts();
    const index = products.findIndex((p) => p.id === id);
    let updated: Product;
    if (index !== -1) {
      updated = { ...products[index], ...body, id };
      products[index] = updated;
      saveProducts(products);
    } else {
      updated = { ...body, id } as Product;
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    // 1. Permanently delete from Firebase Realtime Database
    await deleteFirebaseProduct(id);

    // 2. Persist deletion in local file & tombstone
    saveLocalDeletedId(id);
    const deletedSet = await getAllDeletedIds();
    deletedSet.add(id);

    // 3. Remove from products.json cache
    const stored = readAllProducts();
    const sourceProducts = stored;
    const deletedProd = sourceProducts.find((p) => p.id === id);
    const filtered = sourceProducts.filter((p) => !deletedSet.has(p.id) && p.id !== id);
    saveProducts(filtered);

    // 4. Decrement seller's active listings in users.json
    try {
      const USERS_FILE = path.join(getDataDir(), "users.json");
      if (fs.existsSync(USERS_FILE)) {
        const rawUsers = fs.readFileSync(USERS_FILE, "utf8");
        const usersList: any[] = JSON.parse(rawUsers);
        if (Array.isArray(usersList)) {
          let updatedUsers = false;
          const sId = deletedProd?.sellerId;
          const sPhone = deletedProd?.sellerPhone;
          const sName = deletedProd?.sellerName;
          usersList.forEach((u) => {
            if (
              (sId && u.id === sId) ||
              (sPhone && u.phone === sPhone) ||
              (sName && u.fullName === sName)
            ) {
              const current = typeof u.activeListings === "number" ? u.activeListings : 1;
              u.activeListings = Math.max(0, current - 1);
              updatedUsers = true;
            }
          });
          if (updatedUsers) {
            fs.writeFileSync(USERS_FILE, JSON.stringify(usersList, null, 2), "utf8");
          }
        }
      }
    } catch {}

    const deletedList = Array.from(deletedSet);
    return NextResponse.json(
      { success: true, id, deletedIds: deletedList },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Deleted-Products": JSON.stringify(deletedList),
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete" }, { status: 500 });
  }
}
