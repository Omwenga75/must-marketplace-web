import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Product } from "@/types";
import { INITIAL_SAMPLE_PRODUCTS } from "@/lib/constants";

const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");

function getProducts(): Product[] {
  try {
    if (!fs.existsSync(PRODUCTS_FILE)) {
      return INITIAL_SAMPLE_PRODUCTS;
    }
    const raw = fs.readFileSync(PRODUCTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SAMPLE_PRODUCTS;
  } catch {
    return INITIAL_SAMPLE_PRODUCTS;
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
  const products = getProducts();
  const product = products.find((p) => p.id === id);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json(product);
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
