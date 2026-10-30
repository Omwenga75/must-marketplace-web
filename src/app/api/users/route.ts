import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { User, Product } from "@/types";
import { isAdministratorEmail } from "@/lib/utils";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");

function ensureUsersFile(): User[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), "utf8");
      return [];
    }
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter out all fake emails: only allow emails ending in @gmail.com or the admin email
    const valid = parsed.filter((u: User) => {
      if (!u || !u.email) return false;
      const email = u.email.toLowerCase().trim();
      if (u.id?.startsWith("demo_") || u.id?.startsWith("new_user_")) return false;
      return email.endsWith("@gmail.com") || email === "must.market@admin.com";
    });

    if (valid.length !== parsed.length) {
      saveUsersFile(valid);
    }
    return valid;
  } catch (err) {
    console.error("Error reading users file:", err);
    return [];
  }
}

function saveUsersFile(users: User[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving users file:", err);
  }
}

function getStoredProducts(): Product[] {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const raw = fs.readFileSync(PRODUCTS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

// Check if user has active listings in products.json
function userHasListings(user: Partial<User>, products: Product[]): boolean {
  return products.some((p) => {
    if (user.id && (p.sellerId === user.id || p.sellerId === `u_${user.id}`)) return true;
    if (user.email && p.sellerName && user.email.toLowerCase().includes(p.sellerName.toLowerCase().replace(/\s+/g, ""))) return true;
    if (user.fullName && p.sellerName && p.sellerName.toLowerCase() === user.fullName.toLowerCase()) return true;
    if (user.phone && p.sellerPhone && p.sellerPhone === user.phone) return true;
    return false;
  });
}

// GET /api/users?email=...&id=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const emailParam = searchParams.get("email")?.toLowerCase().trim();
  const idParam = searchParams.get("id") || searchParams.get("uid");

  const users = ensureUsersFile();
  const products = getStoredProducts();

  if (emailParam || idParam) {
    const user = users.find((u) => {
      if (idParam) return u.id === idParam;
      if (emailParam) return u.email && u.email.toLowerCase().trim() === emailParam;
      return false;
    });

    if (user) {
      const hasListings = userHasListings(user, products);
      const isSeller = Boolean(user.seller || user.isSeller || hasListings);
      const isAdmin = Boolean(user.admin || user.isAdmin || isAdministratorEmail(user.email));
      return NextResponse.json(
        {
          ...user,
          seller: isSeller,
          isSeller: isSeller,
          admin: isAdmin,
          isAdmin: isAdmin,
        },
        {
          headers: { "Cache-Control": "no-store, max-age=0" },
        }
      );
    }

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Return all users
  const enriched = users.map((u) => {
    const hasListings = userHasListings(u, products);
    const isSeller = Boolean(u.seller || u.isSeller || hasListings);
    const isAdmin = Boolean(u.admin || u.isAdmin || isAdministratorEmail(u.email));
    return {
      ...u,
      seller: isSeller,
      isSeller: isSeller,
      admin: isAdmin,
      isAdmin: isAdmin,
    };
  });

  return NextResponse.json(enriched, {
    headers: { "Cache-Control": "no-store, max-age=0" },
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

    const users = ensureUsersFile();
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
      // Keep seller status if previously set or if user has listings
      const isSeller = Boolean(
        body.seller ?? body.isSeller ?? prev.seller ?? prev.isSeller ?? hasListings
      );

      const isAdmin = Boolean(
        body.admin ?? body.isAdmin ?? prev.admin ?? prev.isAdmin ?? isAdministratorEmail(emailLower)
      );

      updatedUser = {
        ...prev,
        ...body,
        id: id || prev.id,
        email: emailLower || prev.email,
        fullName: body.fullName || prev.fullName,
        phone: body.phone ?? prev.phone,
        location: body.location || prev.location || "Main Gate",
        seller: isSeller,
        isSeller: isSeller,
        admin: isAdmin,
        isAdmin: isAdmin,
      };
      users[existingIndex] = updatedUser;
    } else {
      const isSeller = Boolean(body.seller || body.isSeller || hasListings);
      const isAdmin = Boolean(body.admin || body.isAdmin || isAdministratorEmail(emailLower));
      updatedUser = {
        id: id || `u_${Date.now()}`,
        fullName: body.fullName || "MUST Student",
        email: emailLower,
        phone: body.phone || null,
        location: body.location || "Main Gate",
        profileImageUrl: body.profileImageUrl || null,
        seller: isSeller,
        isSeller: isSeller,
        admin: isAdmin,
        isAdmin: isAdmin,
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
    console.error("Error saving user:", err);
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

    const users = ensureUsersFile();
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

      const updatedUser: User = {
        ...prev,
        ...body,
        id: id || prev.id,
        seller: isSeller,
        isSeller: isSeller,
      };
      users[existingIndex] = updatedUser;
      saveUsersFile(users);
      return NextResponse.json(updatedUser, { status: 200 });
    }

    // If not found in file yet, create it as seller if requested
    const hasListings = userHasListings(body, products);
    const isSeller = isSellerRequested || hasListings;
    const newUser: User = {
      id: id || `u_${Date.now()}`,
      fullName: body.fullName || "MUST Student",
      email: emailLower,
      phone: body.phone || null,
      location: body.location || "Main Gate",
      profileImageUrl: body.profileImageUrl || null,
      seller: isSeller,
      isSeller: isSeller,
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
    console.error("Error patching user:", err);
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

    const users = ensureUsersFile();
    const filtered = users.filter((u) => u.id !== id && u.email !== id);
    saveUsersFile(filtered);

    return NextResponse.json({ success: true, id }, { status: 200 });
  } catch (err: any) {
    console.error("Error deleting user via API:", err);
    return NextResponse.json({ error: err?.message || "Failed to delete user" }, { status: 500 });
  }
}
