import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Product } from "@/types";
import { INITIAL_SAMPLE_PRODUCTS } from "@/lib/constants";
import {
  getFirebaseDeletedProductIds,
  saveFirebaseDeletedProduct,
} from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const DELETED_PRODUCTS_FILE = path.join(DATA_DIR, "deleted_products.json");

// ── Local file helpers (fast, works in dev; ephemeral on Vercel) ────────────

function getLocalDeletedIds(): Set<string> {
  try {
    if (!fs.existsSync(DELETED_PRODUCTS_FILE)) return new Set();
    const raw = fs.readFileSync(DELETED_PRODUCTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter(Boolean));
  } catch {}
  return new Set();
}

function saveLocalDeletedId(id: string): void {
  try {
    if (!id) return;
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const set = getLocalDeletedIds();
    set.add(id);
    fs.writeFileSync(DELETED_PRODUCTS_FILE, JSON.stringify([...set], null, 2), "utf8");
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
      fs.writeFileSync(DELETED_PRODUCTS_FILE, JSON.stringify([...set], null, 2), "utf8");
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
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(PRODUCTS_FILE)) return [];
    const raw = fs.readFileSync(PRODUCTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (err) {
    console.error("readProductsFile error:", err);
  }
  return [];
}

function saveProductsFile(products: Product[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf8");
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

    // 1. Persist deletion in both local file and Firebase RTDB
    await persistDeletedId(id);

    // 2. Remove from products.json
    const deletedSet = await getAllDeletedIds();
    const existing = getOrInitProducts(new Set()); // read all
    const filtered = existing.filter((p) => p.id !== id);
    saveProductsFile(filtered);

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
