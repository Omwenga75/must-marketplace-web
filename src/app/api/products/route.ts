import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Product } from "@/types";
import { INITIAL_SAMPLE_PRODUCTS } from "@/lib/constants";

const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");

function ensureProductsFile(): Product[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(PRODUCTS_FILE)) {
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(INITIAL_SAMPLE_PRODUCTS, null, 2), "utf8");
      return INITIAL_SAMPLE_PRODUCTS;
    }
    const raw = fs.readFileSync(PRODUCTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(INITIAL_SAMPLE_PRODUCTS, null, 2), "utf8");
    return INITIAL_SAMPLE_PRODUCTS;
  } catch (err) {
    console.error("Error reading products file:", err);
    return INITIAL_SAMPLE_PRODUCTS;
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
export async function GET() {
  const products = ensureProductsFile();

  // Sort deterministically: newest first
  const sorted = [...products].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  return NextResponse.json(sorted, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

// POST /api/products — Create listing visible to all browsers immediately
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const existing = ensureProductsFile();

    const newProduct: Product = {
      ...body,
      id: body.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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

    const existing = ensureProductsFile();
    const filtered = existing.filter((p) => p.id !== id);
    saveProductsFile(filtered);

    return NextResponse.json({ success: true, id }, { status: 200 });
  } catch (err: any) {
    console.error("Error deleting product via API:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete product" },
      { status: 500 }
    );
  }
}
