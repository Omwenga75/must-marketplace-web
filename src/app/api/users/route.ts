import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { User, Product } from "@/types";
import { isAdministratorEmail } from "@/lib/utils";
import {
  getFirebaseDeletedUserIds,
  saveFirebaseDeletedUser,
} from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import os from "os";

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
    const files = ["products.json", "users.json", "conversations.json", "messages.json", "deleted_products.json", "deleted_users.json"];
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

function getUsersFilePath(): string {
  return path.join(getDataDir(), "users.json");
}

function getDeletedUsersFilePath(): string {
  return path.join(getDataDir(), "deleted_users.json");
}

function getProductsFilePath(): string {
  return path.join(getDataDir(), "products.json");
}

// ── Local deleted-IDs helpers ────────────────────────────────────────────────

function getLocalDeletedUserIds(): Set<string> {
  try {
    if (!fs.existsSync(getDeletedUsersFilePath())) return new Set();
    const raw = fs.readFileSync(getDeletedUsersFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter(Boolean));
  } catch {}
  return new Set();
}

function saveLocalDeletedUserId(id: string): void {
  try {
    if (!id) return;
    if (!fs.existsSync(getDataDir())) fs.mkdirSync(getDataDir(), { recursive: true });
    const set = getLocalDeletedUserIds();
    set.add(id);
    fs.writeFileSync(getDeletedUsersFilePath(), JSON.stringify([...set], null, 2), "utf8");
  } catch (err) {
    console.error("saveLocalDeletedUserId error:", err);
  }
}

async function getAllDeletedUserIds(): Promise<Set<string>> {
  const local = getLocalDeletedUserIds();
  const remote = await getFirebaseDeletedUserIds();
  return new Set([...local, ...remote]);
}

async function persistDeletedUserId(id: string): Promise<void> {
  saveLocalDeletedUserId(id);
  await saveFirebaseDeletedUser(id);
}

function removeLocalDeletedUserId(id: string): void {
  try {
    if (!id) return;
    const set = getLocalDeletedUserIds();
    if (set.has(id)) {
      set.delete(id);
      fs.writeFileSync(getDeletedUsersFilePath(), JSON.stringify([...set], null, 2), "utf8");
    }
  } catch {}
}

// ── Users file helpers ───────────────────────────────────────────────────────

async function ensureUsersFile(): Promise<User[]> {
  const deleted = await getAllDeletedUserIds();
  try {
    if (!fs.existsSync(getDataDir())) fs.mkdirSync(getDataDir(), { recursive: true });
    if (!fs.existsSync(getUsersFilePath())) {
      fs.writeFileSync(getUsersFilePath(), JSON.stringify([], null, 2), "utf8");
      return [];
    }
    const raw = fs.readFileSync(getUsersFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter: only @gmail.com or admin, and not deleted
    const valid = parsed.filter((u: User) => {
      if (!u || !u.email) return false;
      const email = u.email.toLowerCase().trim();
      if (deleted.has(u.id) || deleted.has(email)) return false;
      if (u.id?.startsWith("demo_") || u.id?.startsWith("new_user_")) return false;
      return email.endsWith("@gmail.com") || email === "must.market@admin.com";
    });

    if (valid.length !== parsed.length) {
      saveUsersFile(valid);
    }
    return valid;
  } catch (err) {
    console.error("ensureUsersFile error:", err);
    return [];
  }
}

function saveUsersFile(users: User[]): void {
  try {
    if (!fs.existsSync(getDataDir())) fs.mkdirSync(getDataDir(), { recursive: true });
    fs.writeFileSync(getUsersFilePath(), JSON.stringify(users, null, 2), "utf8");
  } catch (err) {
    console.error("saveUsersFile error:", err);
  }
}

function getStoredProducts(): Product[] {
  try {
    if (fs.existsSync(getProductsFilePath())) {
      const raw = fs.readFileSync(getProductsFilePath(), "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function userHasListings(user: Partial<User>, products: Product[]): boolean {
  return products.some((p) => {
    if (user.id && (p.sellerId === user.id || p.sellerId === `u_${user.id}`)) return true;
    if (user.email && p.sellerName && user.email.toLowerCase().includes(p.sellerName.toLowerCase().replace(/\s+/g, ""))) return true;
    if (user.fullName && p.sellerName && p.sellerName.toLowerCase() === user.fullName.toLowerCase()) return true;
    if (user.phone && p.sellerPhone && p.sellerPhone === user.phone) return true;
    return false;
  });
}

// ── Route handlers ───────────────────────────────────────────────────────────

// GET /api/users?email=...&id=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const emailParam = searchParams.get("email")?.toLowerCase().trim();
  const idParam = searchParams.get("id") || searchParams.get("uid");
  const deletedSet = await getAllDeletedUserIds();
  const deletedArr = Array.from(deletedSet);

  if (searchParams.get("deleted") === "1" || searchParams.get("onlyDeleted") === "1") {
    return NextResponse.json(deletedArr, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  const users = await ensureUsersFile();
  const products = getStoredProducts();

  if (emailParam || idParam) {
    const user = users.find((u) => {
      if (idParam) return u.id === idParam;
      if (emailParam) return u.email && u.email.toLowerCase().trim() === emailParam;
      return false;
    });

    if (user && !deletedSet.has(user.id) && !deletedSet.has(user.email)) {
      const hasListings = userHasListings(user, products);
      const isSeller = Boolean(user.seller || user.isSeller || hasListings);
      const isAdmin = Boolean(user.admin || user.isAdmin || isAdministratorEmail(user.email));
      return NextResponse.json(
        { ...user, seller: isSeller, isSeller, admin: isAdmin, isAdmin },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "X-Deleted-Users": JSON.stringify(deletedArr),
          },
        }
      );
    }

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Return all non-deleted users
  const enriched = users
    .filter((u) => !deletedSet.has(u.id) && !deletedSet.has(u.email))
    .map((u) => {
      const hasListings = userHasListings(u, products);
      const isSeller = Boolean(u.seller || u.isSeller || hasListings);
      const isAdmin = Boolean(u.admin || u.isAdmin || isAdministratorEmail(u.email));
      return { ...u, seller: isSeller, isSeller, admin: isAdmin, isAdmin };
    });

  return NextResponse.json(enriched, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Deleted-Users": JSON.stringify(deletedArr),
    },
  });
}

// POST /api/users — Create or merge user
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<User>;
    const emailLower = (body.email || "").toLowerCase().trim();
    const id = body.id;

    if (!emailLower && !id) {
      return NextResponse.json({ error: "Email or id required" }, { status: 400 });
    }

    if (emailLower && !emailLower.endsWith("@gmail.com") && emailLower !== "must.market@admin.com") {
      return NextResponse.json(
        { error: "Only emails ending with @gmail.com are permitted" },
        { status: 400 }
      );
    }

    if (id) removeLocalDeletedUserId(id);
    if (emailLower) removeLocalDeletedUserId(emailLower);

    const users = await ensureUsersFile();
    const products = getStoredProducts();

    const existingIndex = users.findIndex((u) => {
      if (id) return u.id === id;
      if (emailLower && u.email) return u.email.toLowerCase().trim() === emailLower;
      return false;
    });

    const hasListings = userHasListings(body, products);

    let updatedUser: User;
    if (existingIndex >= 0) {
      const prev = users[existingIndex];
      const isSeller = Boolean(body.seller ?? body.isSeller ?? prev.seller ?? prev.isSeller ?? hasListings);
      const isAdmin = Boolean(body.admin ?? body.isAdmin ?? prev.admin ?? prev.isAdmin ?? isAdministratorEmail(emailLower));
      updatedUser = {
        ...prev,
        ...body,
        id: id || prev.id,
        email: emailLower || prev.email,
        fullName: body.fullName || prev.fullName,
        phone: body.phone ?? prev.phone,
        location: body.location || prev.location || "Main Gate",
        seller: isSeller,
        isSeller,
        admin: isAdmin,
        isAdmin,
      };
      users[existingIndex] = updatedUser;
    } else {
      const isSeller = Boolean(body.seller || body.isSeller || hasListings);
      const isAdmin = Boolean(body.admin || body.isAdmin || isAdministratorEmail(emailLower));
      updatedUser = {
        id: id || `u_${Date.now()}`,
        fullName: body.fullName || "MUST User",
        email: emailLower,
        phone: body.phone || null,
        location: body.location || "Main Gate",
        profileImageUrl: body.profileImageUrl || null,
        seller: isSeller,
        isSeller,
        admin: isAdmin,
        isAdmin,
        memberSince: body.memberSince || String(Date.now()),
        activeListings: body.activeListings || (hasListings ? 1 : 0),
        soldItems: body.soldItems || 0,
        likes: body.likes || 0,
      };
      users.push(updatedUser);
    }

    saveUsersFile(users);
    return NextResponse.json(updatedUser, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/users error:", err);
    return NextResponse.json({ error: err?.message || "Failed to save user" }, { status: 500 });
  }
}

// PATCH /api/users — Partial update (e.g. becoming seller)
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Partial<User>;
    const emailLower = (body.email || "").toLowerCase().trim();
    const id = body.id;

    if (!emailLower && !id) {
      return NextResponse.json({ error: "Email or id required" }, { status: 400 });
    }

    if (emailLower && !emailLower.endsWith("@gmail.com") && emailLower !== "must.market@admin.com") {
      return NextResponse.json(
        { error: "Only emails ending with @gmail.com are permitted" },
        { status: 400 }
      );
    }

    if (id) removeLocalDeletedUserId(id);
    if (emailLower) removeLocalDeletedUserId(emailLower);

    const users = await ensureUsersFile();
    const products = getStoredProducts();

    const existingIndex = users.findIndex((u) => {
      if (id) return u.id === id;
      if (emailLower && u.email) return u.email.toLowerCase().trim() === emailLower;
      return false;
    });

    const isSellerRequested = body.seller === true || body.isSeller === true;

    if (existingIndex >= 0) {
      const prev = users[existingIndex];
      const isSeller = isSellerRequested || Boolean(prev.seller || prev.isSeller || userHasListings(prev, products));
      const updatedUser: User = { ...prev, ...body, id: id || prev.id, seller: isSeller, isSeller };
      users[existingIndex] = updatedUser;
      saveUsersFile(users);
      return NextResponse.json(updatedUser, { status: 200 });
    }

    const hasListings = userHasListings(body, products);
    const isSeller = isSellerRequested || hasListings;
    const newUser: User = {
      id: id || `u_${Date.now()}`,
      fullName: body.fullName || "MUST User",
      email: emailLower,
      phone: body.phone || null,
      location: body.location || "Main Gate",
      profileImageUrl: body.profileImageUrl || null,
      seller: isSeller,
      isSeller,
      admin: Boolean(body.admin || body.isAdmin),
      isAdmin: Boolean(body.admin || body.isAdmin),
      memberSince: String(Date.now()),
      activeListings: body.activeListings || (hasListings ? 1 : 0),
      soldItems: 0,
      likes: 0,
    };
    users.push(newUser);
    saveUsersFile(users);
    return NextResponse.json(newUser, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /api/users error:", err);
    return NextResponse.json({ error: err?.message || "Failed to patch user" }, { status: 500 });
  }
}

// DELETE /api/users — Permanently delete user account
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
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const users = await ensureUsersFile();
    const target = users.find((u) => u.id === id || u.email === id);
    if (target?.id) await persistDeletedUserId(target.id);
    if (target?.email) await persistDeletedUserId(target.email);
    await persistDeletedUserId(id);

    const filtered = users.filter((u) => u.id !== id && u.email !== id);
    saveUsersFile(filtered);

    // Also remove any listings belonging to this user
    try {
      const storedProds = getStoredProducts();
      const targetId = target?.id || id;
      const targetEmail = target?.email?.toLowerCase().trim();
      const targetPhone = target?.phone;
      const targetName = target?.fullName?.toLowerCase().trim();

      const userProds = storedProds.filter((p) => {
        if (targetId && (p.sellerId === targetId || p.sellerId === `u_${targetId}`)) return true;
        if (targetEmail && p.sellerName && targetEmail.includes(p.sellerName.toLowerCase().replace(/\s+/g, ""))) return true;
        if (targetName && p.sellerName && p.sellerName.toLowerCase() === targetName) return true;
        if (targetPhone && p.sellerPhone && p.sellerPhone === targetPhone) return true;
        return false;
      });

      if (userProds.length > 0) {
        const remainingProds = storedProds.filter((p) => !userProds.some((up) => up.id === p.id));
        if (fs.existsSync(getDataDir())) {
          fs.writeFileSync(getProductsFilePath(), JSON.stringify(remainingProds, null, 2), "utf8");
          // Add to deleted products
          const DELETED_PRODUCTS_FILE = path.join(getDataDir(), "deleted_products.json");
          let delProds: string[] = [];
          if (fs.existsSync(DELETED_PRODUCTS_FILE)) {
            try { delProds = JSON.parse(fs.readFileSync(DELETED_PRODUCTS_FILE, "utf8")); } catch {}
          }
          const delSet = new Set(delProds);
          userProds.forEach((up) => delSet.add(up.id));
          fs.writeFileSync(DELETED_PRODUCTS_FILE, JSON.stringify([...delSet], null, 2), "utf8");
        }
      }
    } catch {}

    const deletedSet = await getAllDeletedUserIds();
    const deletedArr = Array.from(deletedSet);
    return NextResponse.json(
      { success: true, id, deletedIds: deletedArr },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Deleted-Users": JSON.stringify(deletedArr),
        },
      }
    );
  } catch (err: any) {
    console.error("DELETE /api/users error:", err);
    return NextResponse.json({ error: err?.message || "Failed to delete user" }, { status: 500 });
  }
}
