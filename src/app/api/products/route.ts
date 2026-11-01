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

// ── Local file helpers (supports local dev and writable Vercel /tmp) ──────────

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

function removeLocalDeletedId(id: string): void {
  try {
    if (!id) return;
    const set = getLocalDeletedIds();
    if (set.has(id)) {
      set.delete(id);
      fs.writeFileSync(getDeletedProductsFilePath(), JSON.stringify([...set], null, 2), "utf8");
    }
  } catch {}
}

// ── Merged deleted set (local + Firebase RTDB REST) ─────────────────────────

async function getAllDeletedIds(): Promise<Set<string>> {
  const local = getLocalDeletedIds();
  const remote = await getFirebaseDeletedProductIds();
  return new Set([...local, ...remote]);
}

async function persistDeletedId(id: string): Promise<void> {
  saveLocalDeletedId(id); // fast, sync
  await saveFirebaseDeletedProduct(id); // persistent across Vercel cold starts
}

// ── Products file helpers ────────────────────────────────────────────────────

function readProductsFile(): Product[] {
  try {
    const filePath = getProductsFilePath();
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (err) {
    console.error("readProductsFile error:", err);
  }
  return [];
}

function saveProductsFile(products: Product[]): void {
  try {
    const dir = getDataDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getProductsFilePath(), JSON.stringify(products, null, 2), "utf8");
  } catch (err) {
    console.error("saveProductsFile error:", err);
  }
}

function getOrInitProducts(deleted: Set<string>): Product[] {
  const stored = readProductsFile();
  if (stored.length > 0) return stored.filter((p) => !deleted.has(p.id));
  // Bootstrap from sample products on first run
  const initial = INITIAL_SAMPLE_PRODUCTS.filter((p) => !deleted.has(p.id));
  saveProductsFile(initial);
  return initial;
}

// ── Route handlers ───────────────────────────────────────────────────────────

// GET /api/products — Returns all active products with deleted-IDs header
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const deletedSet = await getAllDeletedIds();
  const deletedList = Array.from(deletedSet);

  // ?deleted=1  →  return only the deleted IDs array
  if (searchParams.get("deleted") === "1" || searchParams.get("onlyDeleted") === "1") {
    return NextResponse.json(deletedList, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  const products = getOrInitProducts(deletedSet);
  const sorted = [...products].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  return NextResponse.json(sorted, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Deleted-Products": JSON.stringify(deletedList),
    },
  });
}

// POST /api/products — Create or update a listing
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const deletedSet = await getAllDeletedIds();
    const existing = getOrInitProducts(deletedSet);

    const id = body.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    removeLocalDeletedId(id); // un-delete if re-listed

    const newProduct: Product = {
      ...body,
      id,
      views: Number(body.views) || 0,
      likes: Number(body.likes) || 0,
      status: body.status || "ACTIVE",
      createdAt: body.createdAt || new Date().toISOString(),
    };

    const filtered = existing.filter((p) => p.id !== newProduct.id);
    saveProductsFile([newProduct, ...filtered]);

    return NextResponse.json(newProduct, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/products error:", err);
    return NextResponse.json({ error: err?.message || "Failed to create product" }, { status: 500 });
  }
}

// DELETE /api/products — Permanently remove a listing everywhere
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }
    if (!id) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    // 1. Persist deletion in local file and update deleted set
    saveLocalDeletedId(id);
    const deletedSet = await getAllDeletedIds();
    deletedSet.add(id);

    // 2. Remove from products.json and ensure no deleted products remain
    const stored = readProductsFile();
    const sourceProducts = stored.length > 0 ? stored : INITIAL_SAMPLE_PRODUCTS;
    const deletedProd = sourceProducts.find((p) => p.id === id);
    const filtered = sourceProducts.filter((p) => !deletedSet.has(p.id) && p.id !== id);
    saveProductsFile(filtered);

    // 3. Decrement seller's active listings in users.json if present
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

    // 4. Non-blocking background sync to Firebase
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
    console.error("DELETE /api/products error:", err);
    return NextResponse.json({ error: err?.message || "Failed to delete product" }, { status: 500 });
  }
}
