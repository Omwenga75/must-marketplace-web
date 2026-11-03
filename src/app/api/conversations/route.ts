import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Conversation } from "@/types";
import { resolveCanonicalId } from "@/lib/userCanonical";
import {
  getFirebaseConversations,
  saveFirebaseConversation,
  deleteFirebaseConversation,
} from "@/lib/firebase/admin";

const DATA_DIR = path.join(process.cwd(), "data");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

interface StoredThread {
  id: string;
  participants: string[];
  aliases?: string[];
  participantNames: Record<string, string>;
  lastMessage: string;
  lastMessageTime: string;
  unreadCounts: Record<string, number>;
  productId?: string | null;
  productTitle?: string | null;
}

function ensureConversationsFile(): StoredThread[] {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(CONVERSATIONS_FILE)) {
      fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify([], null, 2), "utf8");
      return [];
    }
    const raw = fs.readFileSync(CONVERSATIONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Error reading conversations file:", err);
    return [];
  }
}

function saveConversationsFile(threads: StoredThread[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(threads, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving conversations file:", err);
  }
}

function matchesUser(targetId: string, thread: StoredThread): boolean {
  if (!targetId) return false;
  const canon = resolveCanonicalId(targetId);
  const rawLower = targetId.toLowerCase().trim();

  // A thread only belongs to this user if targetId or its canonical legacy ID is explicitly a participant
  for (const p of thread.participants) {
    if (p === targetId || p === canon) return true;
  }
  if (thread.aliases) {
    for (const a of thread.aliases) {
      if (a === targetId || a === canon || a.toLowerCase() === rawLower) return true;
    }
  }
  return false;
}

function getDisplayName(userId: string, names: Record<string, string>): string {
  if (names[userId] && !names[userId].toLowerCase().includes("comrade")) return names[userId];
  const lower = userId.toLowerCase();
  if (lower === "eqojbqs272vjioq53fwjghyzkq1" || lower.startsWith("eqojbqs")) return "Mary Wanjiku";
  if (lower === "gk3z6c39nqyxpegjb2g0s2wg5yo2") return "James Njuguna";
  if (lower === "demo_seller_456" || lower === "u1") return "James Mutua";
  if (lower === "demo_admin_789" || lower === "system_admin") return "MUST Support Desk";

  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, "utf8");
      const users = JSON.parse(raw);
      if (Array.isArray(users)) {
        const found = users.find(
          (u: any) =>
            u.id === userId ||
            (u.email && u.email.toLowerCase() === lower) ||
            (u.phone && u.phone.replace(/\D/g, "") === userId.replace(/\D/g, ""))
        );
        if (found && found.fullName && !found.fullName.toLowerCase().includes("comrade")) {
          return found.fullName;
        }
      }
    }
  } catch {}

  return "Student Seller";
}

// GET /api/conversations?userId=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId parameter required" }, { status: 400 });
  }

  const canonUser = resolveCanonicalId(userId);

  // 1. Fetch live from Firebase RTDB (source of truth across all devices)
  let fbConvs: Conversation[] = [];
  try {
    fbConvs = await getFirebaseConversations(userId);
    if (canonUser !== userId && fbConvs.length === 0) {
      const canonConvs = await getFirebaseConversations(canonUser);
      fbConvs = [...fbConvs, ...canonConvs];
    }
  } catch (err) {
    console.warn("Failed to fetch Firebase conversations:", err);
  }

  // 2. Fetch from local conversations file
  const threads = ensureConversationsFile();
  const userThreads = threads.filter((t) => matchesUser(userId, t));

  const localConvs: Conversation[] = [];
  const seenOthers = new Set<string>();

  for (const t of userThreads) {
    // Find the other participant (not the current user)
    let otherId = t.participants.find(
      (p) => resolveCanonicalId(p) !== canonUser && p !== userId
    );

    if (!otherId && t.participants.length >= 2) {
      otherId = t.participants.find((p) => p !== userId) || t.participants[1];
    }
    if (!otherId) otherId = t.participants[0] || "unknown";

    const otherName = getDisplayName(otherId, t.participantNames);
    const dedupeKey = resolveCanonicalId(otherId);
    if (seenOthers.has(dedupeKey)) continue;
    seenOthers.add(dedupeKey);

    const unread = t.unreadCounts[userId] ?? t.unreadCounts[canonUser] ?? 0;

    localConvs.push({
      id: t.id,
      otherUserId: otherId,
      otherUserName: otherName,
      lastMessage: t.lastMessage || "",
      lastMessageTime: t.lastMessageTime || String(Date.now()),
      unreadCount: unread,
      productId: t.productId || null,
      productTitle: t.productTitle || null,
    });
  }

  // 3. Merge Firebase + Local (Firebase is primary)
  const combinedMap = new Map<string, Conversation>();
  localConvs.forEach((c) => {
    if (c.otherUserId && c.otherUserId !== userId) {
      combinedMap.set(c.id, c);
    }
  });
  fbConvs.forEach((c) => {
    if (c.otherUserId && c.otherUserId !== userId) {
      combinedMap.set(c.id, c);
    }
  });

  const result = Array.from(combinedMap.values());
  result.sort((a, b) => Number(b.lastMessageTime || 0) - Number(a.lastMessageTime || 0));

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

// POST /api/conversations — Mark as read or update
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { conversationId, userId, action } = body;

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    if (action === "delete" && userId) {
      try {
        await deleteFirebaseConversation(userId, conversationId);
      } catch {}
    }

    const canonUser = resolveCanonicalId(userId || "");
    const threads = ensureConversationsFile();
    const threadIndex = threads.findIndex((t) => {
      if (t.id === conversationId) return true;
      if (conversationId.includes("_")) {
        const parts = conversationId.split("_");
        const c1 = resolveCanonicalId(parts[0]);
        const c2 = resolveCanonicalId(parts.slice(1).join("_"));
        if (t.participants.includes(c1) && t.participants.includes(c2)) return true;
      }
      if (t.participants.includes(conversationId) || t.participants.includes(resolveCanonicalId(conversationId))) {
        return true;
      }
      return false;
    });

    if (threadIndex >= 0) {
      if (action === "delete") {
        threads.splice(threadIndex, 1);
        saveConversationsFile(threads);
        return NextResponse.json({ success: true, deleted: true });
      }

      const thread = threads[threadIndex];
      if (action === "mark_read" && userId) {
        thread.unreadCounts[userId] = 0;
        thread.unreadCounts[canonUser] = 0;
        for (const k of Object.keys(thread.unreadCounts)) {
          if (resolveCanonicalId(k) === canonUser) {
            thread.unreadCounts[k] = 0;
          }
        }
      }
      threads[threadIndex] = thread;
      saveConversationsFile(threads);
      return NextResponse.json({ success: true, thread });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update conversation" }, { status: 500 });
  }
}

// DELETE /api/conversations?conversationId=...&userId=...
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const userId = searchParams.get("userId");
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }
    if (userId) {
      try {
        await deleteFirebaseConversation(userId, conversationId);
      } catch {}
    }
    const threads = ensureConversationsFile();
    const updated = threads.filter((t) => t.id !== conversationId);
    saveConversationsFile(updated);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete conversation" }, { status: 500 });
  }
}
