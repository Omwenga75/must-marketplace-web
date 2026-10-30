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

function getLocalDeletedIds(): Set<string> {
  try {
    if (!fs.existsSync(DELETED_PRODUCTS_FILE)) return new Set();
    const raw = fs.readFileSync(DELETED_PRODUCTS_FILE, "utf8");
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

async function persistDeletedId(id: string): Promise<void> {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const set = getLocalDeletedIds();
    set.add(id);
    fs.writeFileSync(DELETED_PRODUCTS_FILE, JSON.stringify([...set], null, 2), "utf8");
  } catch {}
  await saveFirebaseDeletedProduct(id);
}

function readAllProducts(): Product[] {
  try {
    if (!fs.existsSync(PRODUCTS_FILE)) return [];
    const raw = fs.readFileSync(PRODUCTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return [];
}

function saveProducts(products: Product[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf8");
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

    await persistDeletedId(id);

    const allProducts = readAllProducts();
    const filtered = allProducts.filter((p) => p.id !== id);
    saveProducts(filtered);

    return NextResponse.json({ success: true, id }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete" }, { status: 500 });
  }
}
