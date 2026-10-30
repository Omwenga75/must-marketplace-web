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

function getProducts(): Product[] {
  const deleted = getDeletedProductIds();
  try {
    if (!fs.existsSync(PRODUCTS_FILE)) {
      return INITIAL_SAMPLE_PRODUCTS.filter((p) => !deleted.has(p.id));
    }
    const raw = fs.readFileSync(PRODUCTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((p) => !deleted.has(p.id))
      : INITIAL_SAMPLE_PRODUCTS.filter((p) => !deleted.has(p.id));
  } catch {
    return INITIAL_SAMPLE_PRODUCTS.filter((p) => !deleted.has(p.id));
  }
}

function saveProducts(products: Product[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving products:", err);
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = getDeletedProductIds();
  if (deleted.has(id)) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const products = getProducts();
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
    const products = getProducts();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updated = {
      ...products[index],
      ...body,
      id, // Preserve id
    };

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

    saveDeletedProductId(id);
    const products = getProducts();
    const filtered = products.filter((p) => p.id !== id);
    saveProducts(filtered);

    return NextResponse.json({ success: true, id }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete" }, { status: 500 });
  }
}
