import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Conversation } from "@/types";
import { resolveCanonicalId } from "@/lib/userCanonical";

const DATA_DIR = path.join(process.cwd(), "data");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");

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
  const canon = resolveCanonicalId(targetId);
  const rawLower = targetId.toLowerCase().trim();

  for (const p of thread.participants) {
    if (p === targetId || p === canon || resolveCanonicalId(p) === canon) return true;
  }
  if (thread.aliases) {
    for (const a of thread.aliases) {
      if (a === targetId || a === canon || a.toLowerCase() === rawLower) return true;
    }
  }
  return false;
}

function getDisplayName(userId: string, names: Record<string, string>): string {
  if (names[userId]) return names[userId];
  const lower = userId.toLowerCase();
  if (lower === "eqojbqs272vjioq53fwjghyzkq1" || lower.startsWith("eqojbqs")) return "Mary Wanjiku";
  if (lower === "gk3z6c39nqyxpegjb2g0s2wg5yo2") return "James Njuguna";
  if (lower === "demo_seller_456" || lower === "u1") return "James Mutua";
  if (lower === "demo_admin_789" || lower === "system_admin") return "MUST Support Desk";
  return "MUST Comrade";
}

// GET /api/conversations?userId=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId parameter required" }, { status: 400 });
  }

  const canonUser = resolveCanonicalId(userId);
  const threads = ensureConversationsFile();
  const userThreads = threads.filter((t) => matchesUser(userId, t));

  const result: Conversation[] = [];
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

    result.push({
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

    return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update conversation" }, { status: 500 });
  }
}
