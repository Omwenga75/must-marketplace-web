import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Product } from "@/types";
import { INITIAL_SAMPLE_PRODUCTS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const DELETED_PRODUCTS_FILE = path.join(DATA_DIR, "deleted_products.json");

function getDeletedProductIds(): Set<string> {
  try {
    if (!fs.existsSync(DELETED_PRODUCTS_FILE)) {
      return new Set();
    }
    const raw = fs.readFileSync(DELETED_PRODUCTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter(Boolean));
    }
  } catch {}
  return new Set();
}

function saveDeletedProductId(id: string): void {
  try {
    if (!id) return;
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const set = getDeletedProductIds();
    set.add(id);
    fs.writeFileSync(DELETED_PRODUCTS_FILE, JSON.stringify([...set], null, 2), "utf8");
  } catch (err) {
    console.error("Error saving deleted product id:", err);
  }
}

function removeDeletedProductId(id: string): void {
  try {
    if (!id) return;
    const set = getDeletedProductIds();
    if (set.has(id)) {
      set.delete(id);
      fs.writeFileSync(DELETED_PRODUCTS_FILE, JSON.stringify([...set], null, 2), "utf8");
    }
  } catch (err) {
    console.error("Error un-deleting product id:", err);
  }
}

function ensureProductsFile(): Product[] {
  const deleted = getDeletedProductIds();
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(PRODUCTS_FILE)) {
      const initial = INITIAL_SAMPLE_PRODUCTS.filter((p) => !deleted.has(p.id));
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const raw = fs.readFileSync(PRODUCTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((p) => !deleted.has(p.id));
    }
    const initial = INITIAL_SAMPLE_PRODUCTS.filter((p) => !deleted.has(p.id));
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  } catch (err) {
    console.error("Error reading products file:", err);
    return INITIAL_SAMPLE_PRODUCTS.filter((p) => !deleted.has(p.id));
  }
}

function saveProductsFile(products: Product[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving products file:", err);
  }
}

// GET /api/products — Shared across all browsers and devices
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const deletedSet = getDeletedProductIds();
  const deletedList = Array.from(deletedSet);

  // Return deleted IDs list if requested
  if (searchParams.get("deleted") === "1" || searchParams.get("onlyDeleted") === "1") {
    return NextResponse.json(deletedList, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  const products = ensureProductsFile();
  const filtered = products.filter((p) => !deletedSet.has(p.id));

  // Sort deterministically: newest first
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  return NextResponse.json(sorted, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Deleted-Products": JSON.stringify(deletedList),
    },
  });
}

// POST /api/products — Create listing visible to all browsers immediately
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const existing = ensureProductsFile();

    const id = body.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    // Un-delete if previously deleted
    removeDeletedProductId(id);

    const newProduct: Product = {
      ...body,
      id,
      views: Number(body.views) || 0,
      likes: Number(body.likes) || 0,
      status: body.status || "ACTIVE",
      createdAt: body.createdAt || new Date().toISOString(),
    };

    // Filter out duplicate if it already exists
    const filtered = existing.filter((p) => p.id !== newProduct.id);
    const updated = [newProduct, ...filtered];

    saveProductsFile(updated);

    return NextResponse.json(newProduct, { status: 201 });
  } catch (err: any) {
    console.error("Error creating product via API:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create product" },
      { status: 500 }
    );
  }
}

// DELETE /api/products — Permanently remove listing from server storage
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

    // 1. Permanently record in server-side deleted list
    saveDeletedProductId(id);

    // 2. Remove from products file
    const existing = ensureProductsFile();
    const filtered = existing.filter((p) => p.id !== id);
    saveProductsFile(filtered);

    return NextResponse.json(
      { success: true, id, deletedIds: Array.from(getDeletedProductIds()) },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Deleted-Products": JSON.stringify(Array.from(getDeletedProductIds())),
        },
      }
    );
  } catch (err: any) {
    console.error("Error deleting product via API:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete product" },
      { status: 500 }
    );
  }
}
