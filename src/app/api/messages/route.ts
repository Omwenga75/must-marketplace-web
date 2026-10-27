import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Message } from "@/types";
import { resolveCanonicalId, getCanonicalConversationId } from "@/lib/userCanonical";

const DATA_DIR = path.join(process.cwd(), "data");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
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

function ensureMessagesFile(): Record<string, Message[]> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(MESSAGES_FILE)) {
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify({}, null, 2), "utf8");
      return {};
    }
    const raw = fs.readFileSync(MESSAGES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.error("Error reading messages file:", err);
    return {};
  }
}

function saveMessagesFile(messages: Record<string, Message[]>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving messages file:", err);
  }
}

function ensureConversationsFile(): StoredThread[] {
  try {
    if (fs.existsSync(CONVERSATIONS_FILE)) {
      const raw = fs.readFileSync(CONVERSATIONS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveConversationsFile(threads: StoredThread[]): void {
  try {
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(threads, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving conversations file:", err);
  }
}

// wrapper kept for consistency
function getCanonicalConvId(u1: string, u2: string): string {
  return getCanonicalConversationId(u1, u2);
}
void getCanonicalConvId; // suppress unused warning

// GET /api/messages?conversationId=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawConvId = searchParams.get("conversationId");

  if (!rawConvId) {
    return NextResponse.json({ error: "conversationId parameter required" }, { status: 400 });
  }

  const allMessages = ensureMessagesFile();

  // Try exact match first
  let list: Message[] = allMessages[rawConvId] || [];

  // If not found, try canonical ID
  if (list.length === 0 && rawConvId.includes("_")) {
    const parts = rawConvId.split("_");
    if (parts.length >= 2) {
      const u1 = parts[0];
      const u2 = parts.slice(1).join("_");
      const canonId = getCanonicalConversationId(u1, u2);
      if (canonId !== rawConvId && allMessages[canonId]) {
        list = allMessages[canonId];
      }
    }
  }

  // Also check if any key in allMessages matches the participants
  if (list.length === 0 && rawConvId.includes("_")) {
    const parts = rawConvId.split("_");
    const u1 = resolveCanonicalId(parts[0]);
    const u2 = resolveCanonicalId(parts.slice(1).join("_"));

    for (const key of Object.keys(allMessages)) {
      if (key.includes(u1) && key.includes(u2)) {
        list = allMessages[key];
        break;
      }
    }
  }

  // Sort chronologically
  const sorted = [...list].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

  return NextResponse.json(sorted, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

// POST /api/messages — Send message across browsers
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      senderId,
      senderName,
      receiverId,
      receiverName,
      content,
      productId,
      productTitle,
      imageUrl,
      audioUrl,
    } = body;

    if (!senderId || !receiverId) {
      return NextResponse.json({ error: "senderId and receiverId required" }, { status: 400 });
    }

    const canonSender = resolveCanonicalId(senderId, senderName);
    const canonReceiver = resolveCanonicalId(receiverId, receiverName);
    const canonConvId = getCanonicalConversationId(canonSender, canonReceiver);
    const rawConvId = senderId < receiverId ? `${senderId}_${receiverId}` : `${receiverId}_${senderId}`;

    const timestamp = body.timestamp ? String(body.timestamp) : String(Date.now());
    const msgId = body.id ? String(body.id) : `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newMessage: Message = {
      id: msgId,
      senderId: canonSender,
      receiverId: canonReceiver,
      productId: productId || null,
      content: content || "",
      imageUrl: imageUrl || null,
      audioUrl: audioUrl || null,
      timestamp,
      isRead: false,
    };

    // 1. Save message to data/messages.json under both canonical and raw IDs
    const allMessages = ensureMessagesFile();
    const currentList = allMessages[canonConvId] || allMessages[rawConvId] || [];

    // Avoid duplicate message: check if id already exists or if same sender + content within 5 seconds
    const alreadyExists = currentList.some((m) => {
      if (m.id === msgId) return true;
      const timeDiff = Math.abs(Number(m.timestamp) - Number(timestamp));
      if (
        m.senderId === canonSender &&
        (m.content || "").trim() === (content || "").trim() &&
        timeDiff < 5000
      ) {
        return true;
      }
      return false;
    });

    if (alreadyExists) {
      return NextResponse.json({
        success: true,
        message: currentList.find((m) => m.id === msgId) || newMessage,
        conversationId: canonConvId,
      });
    }

    const updatedList = [...currentList, newMessage];

    allMessages[canonConvId] = updatedList;
    if (rawConvId !== canonConvId) {
      allMessages[rawConvId] = updatedList;
    }
    saveMessagesFile(allMessages);

    // 2. Update data/conversations.json
    const threads = ensureConversationsFile();
    const existingIndex = threads.findIndex(
      (t) =>
        t.id === canonConvId ||
        t.id === rawConvId ||
        (t.participants.includes(canonSender) && t.participants.includes(canonReceiver))
    );

    const preview = content || (imageUrl ? "Photo" : audioUrl ? "Voice message" : "New message");

    if (existingIndex >= 0) {
      const existing = threads[existingIndex];
      const prevUnread = existing.unreadCounts[canonReceiver] || existing.unreadCounts[receiverId] || 0;

      threads[existingIndex] = {
        ...existing,
        id: canonConvId,
        lastMessage: preview,
        lastMessageTime: timestamp,
        productId: productId || existing.productId,
        productTitle: productTitle || existing.productTitle,
        unreadCounts: {
          ...existing.unreadCounts,
          [canonSender]: 0,
          [senderId]: 0,
          [canonReceiver]: prevUnread + 1,
          [receiverId]: prevUnread + 1,
        },
      };
    } else {
      threads.unshift({
        id: canonConvId,
        participants: [canonSender, canonReceiver],
        aliases: [senderId, receiverId].filter((id) => id !== canonSender && id !== canonReceiver),
        participantNames: {
          [canonSender]: senderName || "MUST Student",
          [canonReceiver]: receiverName || "MUST Seller",
          [senderId]: senderName || "MUST Student",
          [receiverId]: receiverName || "MUST Seller",
        },
        lastMessage: preview,
        lastMessageTime: timestamp,
        unreadCounts: {
          [canonSender]: 0,
          [senderId]: 0,
          [canonReceiver]: 1,
          [receiverId]: 1,
        },
        productId: productId || null,
        productTitle: productTitle || null,
      });
    }

    saveConversationsFile(threads);

    return NextResponse.json(
      {
        success: true,
        message: newMessage,
        conversationId: canonConvId,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Error creating message:", err);
    return NextResponse.json({ error: err?.message || "Failed to send message" }, { status: 500 });
  }
}
