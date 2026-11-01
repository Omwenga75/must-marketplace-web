import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Product } from "@/types";
import { INITIAL_SAMPLE_PRODUCTS } from "@/lib/constants";
import {
  getFirebaseDeletedProductIds,
  saveFirebaseDeletedProduct,
} from "@/lib/firebase/admin";

import os from "os";

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

async function persistDeletedId(id: string): Promise<void> {
  saveLocalDeletedId(id);
  await saveFirebaseDeletedProduct(id);
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

async function getActiveProducts(): Promise<Product[]> {
  const deleted = await getAllDeletedIds();
  const stored = readAllProducts();
  if (stored.length > 0) return stored.filter((p) => !deleted.has(p.id));
  return INITIAL_SAMPLE_PRODUCTS.filter((p) => !deleted.has(p.id));
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

  const products = await getActiveProducts();
  const product = products.find((p) => p.id === id);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json(product, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const products = await getActiveProducts();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updated = { ...products[index], ...body, id };
    products[index] = updated;
    saveProducts(products);

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

    // 1. Persist deletion in local file
    saveLocalDeletedId(id);

    const deletedSet = await getAllDeletedIds();
    deletedSet.add(id);

    // 2. Remove from products.json and filter out any deleted products
    const stored = readAllProducts();
    const sourceProducts = stored.length > 0 ? stored : INITIAL_SAMPLE_PRODUCTS;
    const deletedProd = sourceProducts.find((p) => p.id === id);
    const filtered = sourceProducts.filter((p) => !deletedSet.has(p.id) && p.id !== id);
    saveProducts(filtered);

    // 3. Decrement seller's active listings in users.json
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

    // Non-blocking Firebase sync
    saveFirebaseDeletedProduct(id).catch(() => {});

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
