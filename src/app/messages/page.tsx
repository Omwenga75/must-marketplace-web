"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Send,
  ArrowLeft,
  MessageSquare,
  Search,
  CheckCheck,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Conversation, Message } from "@/types";
import {
  getConversationId,
  subscribeToConversations,
  subscribeToMessages,
  sendMessage,
  markConversationAsRead,
  subscribeToTyping,
  setTypingStatus,
  deduplicateConversations,
} from "@/lib/firebase/services";
import { formatRelativeTime, formatMessageTime } from "@/lib/utils";
import { resolveCanonicalId } from "@/lib/userCanonical";

// ── Skeletons (matching mobile app ShimmerEffect.kt) ─────────────────────────
function ConversationItemSkeleton() {
  return (
    <div className="p-3.5 flex items-center gap-3 animate-pulse">
      <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-28" />
          <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-10" />
        </div>
        <div className="h-3 bg-slate-200/70 dark:bg-slate-800/70 rounded w-44" />
      </div>
    </div>
  );
}

function ChatBubbleSkeleton({ isMine }: { isMine: boolean }) {
  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} animate-pulse`}>
      <div
        className={`h-10 rounded-2xl ${
          isMine
            ? "w-44 sm:w-56 bg-emerald-200/50 dark:bg-emerald-950/50 rounded-br-xs"
            : "w-52 sm:w-64 bg-slate-200 dark:bg-slate-800 rounded-bl-xs"
        }`}
      />
      <div className="h-2 w-12 bg-slate-200/60 dark:bg-slate-800/60 rounded mt-1.5" />
    </div>
  );
}

function MessagesContent() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading, loginAsDemoUser } = useAuth();

  // Query parameters when arriving from a product page
  const sellerIdQuery = searchParams.get("sellerId");
  const sellerNameQuery = searchParams.get("sellerName");
  const productIdQuery = searchParams.get("productId");
  const productTitleQuery = searchParams.get("productTitle");

  // Direct conversations & chat state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [sendingDirect, setSendingDirect] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  // Ref to chat message scroll container (avoids scrollIntoView to prevent page jump)
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);

  // Keep window scrolled to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Auto-connect as student comrade if unauthenticated (no blocking fallback screen)
  useEffect(() => {
    if (!authLoading && !user) {
      loginAsDemoUser("buyer");
    }
  }, [authLoading, user, loginAsDemoUser]);

  // Internal scroll function strictly scoped to the chat div
  const scrollChatToBottom = (smooth = false) => {
    if (!chatScrollContainerRef.current) return;
    const el = chatScrollContainerRef.current;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  };

  // Clean up duplicate conversations and demo messages from local storage on mount
  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;
    try {
      // Purge any stale alias keys or demo chat messages
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.includes("u_mary_wanjiku") ||
            k.includes("test_mary_uid") ||
            k.includes("demo_seller_456") ||
            k.includes("demo_admin_789") ||
            k.includes("system_admin"))
        ) {
          localStorage.removeItem(k);
        }
      }

      const key = `must_conversations_${user.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const withoutDemos = parsed.filter(
            (c) =>
              c.otherUserId !== "demo_seller_456" &&
              c.otherUserId !== "demo_admin_789" &&
              c.otherUserId !== "system_admin" &&
              !c.otherUserName?.toLowerCase().includes("support desk") &&
              !c.otherUserName?.toLowerCase().includes("james mutua")
          );
          const cleaned = deduplicateConversations(withoutDemos);
          localStorage.setItem(key, JSON.stringify(cleaned));
          setConversations(cleaned);
        }
      }
    } catch {}
  }, [user?.id]);

  // Helper to open a conversation and immediately mark as read everywhere
  const openConversation = (conv: Conversation) => {
    const zeroed = { ...conv, unreadCount: 0 };
    setActiveConversation(zeroed);
    if (user?.id) {
      markConversationAsRead(user.id, conv.id);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conv.id || c.otherUserId === conv.otherUserId
            ? { ...c, unreadCount: 0 }
            : c
        )
      );
    }
  };

  // 1. Subscribe to Direct Conversations
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToConversations(user.id, (convs) => {
      // Filter out demo conversations so only real user-to-user chats appear
      const realConvs = convs.filter(
        (c) =>
          c.otherUserId !== "demo_seller_456" &&
          c.otherUserId !== "demo_admin_789" &&
          c.otherUserId !== "system_admin" &&
          !c.otherUserName?.toLowerCase().includes("support desk") &&
          !c.otherUserName?.toLowerCase().includes("james mutua")
      );
      const dedupled = deduplicateConversations(realConvs);
      setConversations(dedupled);
      setConversationsLoaded(true);

      // Handle query param target conversation from product page
      if (sellerIdQuery && sellerNameQuery) {
        const targetConvId = getConversationId(user.id, sellerIdQuery);
        const existing = dedupled.find(
          (c) =>
            c.id === targetConvId ||
            c.otherUserId === sellerIdQuery ||
            c.otherUserName?.trim().toLowerCase() === sellerNameQuery.trim().toLowerCase()
        );
        if (existing) {
          openConversation(existing);
        } else {
          const newTarget: Conversation = {
            id: targetConvId,
            otherUserId: sellerIdQuery,
            otherUserName: sellerNameQuery,
            lastMessage: "",
            lastMessageTime: String(Date.now()),
            unreadCount: 0,
            productId: productIdQuery || undefined,
            productTitle: productTitleQuery || undefined,
          };
          setActiveConversation(newTarget);
        }
      }
    });

    return () => unsub();
  }, [user?.id, sellerIdQuery, sellerNameQuery, productIdQuery, productTitleQuery]);

  // 2. Subscribe to Active Direct Conversation Messages
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      setMessagesLoaded(true);
      return;
    }

    setMessagesLoaded(false);

    if (user) {
      markConversationAsRead(user.id, activeConversation.id);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id || c.otherUserId === activeConversation.otherUserId
            ? { ...c, unreadCount: 0 }
            : c
        )
      );
    }

    const unsubMessages = subscribeToMessages(activeConversation.id, (msgs) => {
      setMessages(msgs);
      setMessagesLoaded(true);
      // Only scroll to bottom if already near the bottom (don't jump on background updates)
      const el = chatScrollContainerRef.current;
      if (!el) {
        setTimeout(() => scrollChatToBottom(false), 30);
      } else {
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        if (nearBottom) setTimeout(() => scrollChatToBottom(false), 30);
      }
    });

    const unsubTyping = subscribeToTyping(
      activeConversation.id,
      activeConversation.otherUserId,
      (typing) => setIsOtherTyping(typing)
    );

    return () => {
      unsubMessages();
      unsubTyping();
    };
  }, [activeConversation?.id, user?.id]);

  // Scroll to bottom when conversation changes
  useEffect(() => {
    setTimeout(() => scrollChatToBottom(false), 40);
  }, [activeConversation?.id]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleSendDirectMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessageText.trim() || !user || !activeConversation || sendingDirect) return;

    const content = newMessageText.trim();
    setNewMessageText("");
    setSendingDirect(true);

    try {
      await sendMessage({
        senderId: user.id,
        receiverId: activeConversation.otherUserId,
        receiverName: activeConversation.otherUserName,
        senderName: user.fullName || "MUST Student",
        content,
        productId: activeConversation.productId || undefined,
        productTitle: activeConversation.productTitle || undefined,
      });

      await setTypingStatus(activeConversation.id, user.id, false);
      setTimeout(() => scrollChatToBottom(true), 40);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSendingDirect(false);
    }
  };

  // Filter conversations
  const filteredConversations = deduplicateConversations(
    conversations.filter((c) =>
      c.otherUserName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchFilter.toLowerCase())
    )
  );

  return (
    <div className="w-full h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-hidden bg-slate-100/70 dark:bg-slate-950 flex">
      {/* ── LEFT SIDEBAR: Direct Conversations ───────────────────────────────── */}
      <aside
        className={`w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 bg-white dark:bg-slate-900 ${
          activeConversation ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Messages
          </h1>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {!conversationsLoaded ? (
            /* Shimmer Skeletons (matching mobile app ConversationItemSkeleton) */
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {Array.from({ length: 6 }).map((_, i) => (
                <ConversationItemSkeleton key={i} />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <MessageSquare className="w-10 h-10 mx-auto opacity-30 text-slate-400" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                No conversations yet
              </p>
              <p className="text-[11px] text-slate-400">
                Start chatting with sellers directly from any product page.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredConversations.map((conv) => {
                const isSelected = activeConversation?.id === conv.id;
                const initial = (conv.otherUserName || "U").charAt(0).toUpperCase();

                return (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={`w-full p-3.5 flex items-center gap-3 text-left transition-colors ${
                      isSelected
                        ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-l-4 border-emerald-600"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-sm shrink-0 shadow-xs">
                      {initial}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {conv.otherUserName}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatRelativeTime(conv.lastMessageTime)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate pr-2">
                          {conv.lastMessage || "Click to open chat"}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Footer: Current User Badge */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
            {((user?.fullName) || "M").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {user?.fullName || "Student Comrade"}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {user?.isSeller ? "Verified Seller" : "Student"} · MUST
            </p>
          </div>
        </div>
      </aside>

      {/* ── RIGHT MAIN AREA: Direct Chat Window ─────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full bg-white dark:bg-slate-950 min-w-0 overflow-hidden">
        {activeConversation ? (
          <>
            {/* Direct Chat Top Bar */}
            <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setActiveConversation(null)}
                  className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-sm shrink-0">
                  {activeConversation.otherUserName.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {activeConversation.otherUserName}
                  </h3>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Active now · MUST Comrade</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Product Context Banner (like mobile app's ProductInquiryHeader) */}
            {activeConversation.productTitle && (
              <div className="px-4 py-2 bg-emerald-50/80 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/60 flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <ShoppingBag className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300 truncate">
                    Item: <strong className="text-slate-900 dark:text-white">{activeConversation.productTitle}</strong>
                  </span>
                </div>
                {activeConversation.productId && (
                  <Link
                    href={`/product/${activeConversation.productId}`}
                    className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 text-[11px] shrink-0 ml-3"
                  >
                    <span>View Item</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            )}

            {/* Messages Container (Pure Direct Chats Only) */}
            <div
              ref={chatScrollContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col"
            >
              {!messagesLoaded ? (
                /* Shimmer Skeletons for Chat Bubbles (matching ChatBubbleSkeletonRow) */
                <div className="flex-1 flex flex-col justify-end space-y-4 py-4">
                  <ChatBubbleSkeleton isMine={false} />
                  <ChatBubbleSkeleton isMine={true} />
                  <ChatBubbleSkeleton isMine={false} />
                  <ChatBubbleSkeleton isMine={true} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No messages yet
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    Send a message to start chatting with {activeConversation.otherUserName}.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const myCanon = resolveCanonicalId(user?.id || "");
                  const senderCanon = resolveCanonicalId(msg.senderId || "");
                  const isMe = Boolean(myCanon && (myCanon === senderCanon || msg.senderId === user?.id));

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                          isMe
                            ? "bg-emerald-600 text-white rounded-br-xs"
                            : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 px-1">
                        <span>{formatMessageTime(msg.timestamp)}</span>
                        {isMe && <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Live Typing Indicator */}
              {isOtherTyping && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-white dark:bg-slate-800 px-3 py-2 rounded-2xl w-fit shadow-xs border border-slate-200/60 dark:border-slate-700/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-150" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-300" />
                  <span className="text-[11px] ml-1">Comrade is typing...</span>
                </div>
              )}
            </div>

            {/* Chat Composer */}
            <form
              onSubmit={handleSendDirectMessage}
              className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessageText}
                onChange={(e) => {
                  setNewMessageText(e.target.value);
                  if (activeConversation && user) {
                    setTypingStatus(activeConversation.id, user.id, e.target.value.length > 0);
                  }
                }}
                className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />

              <button
                type="submit"
                disabled={sendingDirect || !newMessageText.trim()}
                className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white flex items-center justify-center transition-all shrink-0 shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          /* ── EMPTY STATE: No Conversation Selected (Desktop) ─────────────── */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/30 dark:bg-slate-950/30">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Select a conversation to start chatting
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              Choose a buyer or seller from the left to view messages and make deals.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-slate-400">Loading messages...</div>}>
      <MessagesContent />
    </Suspense>
  );
}
