"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Send,
  ArrowLeft,
  MessageSquare,
  Search,
  CheckCheck,
  ShoppingBag,
  ExternalLink,
  Paperclip,
  MoreVertical,
  Pencil,
  Trash2,
  Smile,
  X,
  Download,
  AlertCircle,
  Ban,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Conversation, Message } from "@/types";
import {
  getConversationId,
  subscribeToConversations,
  subscribeToMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleMessageReaction,
  deleteConversation,
  clearConversationMessages,
  markConversationAsRead,
  subscribeToTyping,
  setTypingStatus,
  deduplicateConversations,
  resolveRealUserName,
  uploadProductImage,
} from "@/lib/firebase/services";
import { formatRelativeTime, formatMessageTime, isAdministratorEmail } from "@/lib/utils";
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

function MessagesPageSkeleton() {
  return (
    <div className="w-full h-[calc(100dvh-3.5rem-4rem)] sm:h-[calc(100vh-4rem)] overflow-hidden bg-slate-100/70 dark:bg-slate-950 flex animate-pulse">
      {/* ── LEFT SIDEBAR SKELETON ── */}
      <aside className="w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 bg-white dark:bg-slate-900">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-9 w-full bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {Array.from({ length: 6 }).map((_, i) => (
            <ConversationItemSkeleton key={i} />
          ))}
        </div>
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div className="space-y-1 flex-1 min-w-0">
            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-2.5 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        </div>
      </aside>

      {/* ── RIGHT CHAT WINDOW SKELETON (Desktop) ── */}
      <main className="hidden md:flex flex-1 flex-col h-full bg-white dark:bg-slate-950 min-w-0">
        <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-2.5 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4 flex flex-col justify-end">
          <ChatBubbleSkeleton isMine={false} />
          <ChatBubbleSkeleton isMine={true} />
          <ChatBubbleSkeleton isMine={false} />
          <ChatBubbleSkeleton isMine={true} />
        </div>
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-full" />
        </div>
      </main>
    </div>
  );
}

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

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

  // WhatsApp-like interactive states
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [reactionMsgId, setReactionMsgId] = useState<string | null>(null);
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const [showConvMenu, setShowConvMenu] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [convActionConfirm, setConvActionConfirm] = useState<{
    type: "clear" | "delete";
    conversationId: string;
    userName: string;
  } | null>(null);

  // Media / image attachment states
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image lightbox modal
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Ref to chat message scroll container (avoids scrollIntoView to prevent page jump)
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);

  const EMOJI_OPTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

  // Keep window scrolled to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Dismiss popups when clicking anywhere outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-popup='true']")) {
        setMenuMsgId(null);
        setReactionMsgId(null);
        setShowConvMenu(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !user) {
      const params = new URLSearchParams();
      if (sellerIdQuery) params.set("sellerId", sellerIdQuery);
      if (sellerNameQuery) params.set("sellerName", sellerNameQuery);
      if (productIdQuery) params.set("productId", productIdQuery);
      if (productTitleQuery) params.set("productTitle", productTitleQuery);
      const msgRedirect = params.toString() ? "/messages?" + params.toString() : "/messages";
      router.replace("/login?redirect=" + encodeURIComponent(msgRedirect));
    }
  }, [authLoading, user, sellerIdQuery, sellerNameQuery, productIdQuery, productTitleQuery]);

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
    setEditingMessage(null);
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
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

    // Safety fallback: mark loaded after 4s even if callbacks haven't fired
    const loadedFallback = setTimeout(() => setConversationsLoaded(true), 4000);

    const unsub = subscribeToConversations(user.id, (convs) => {
      clearTimeout(loadedFallback);
      const userPhoneClean = (user.phone || "").replace(/\D/g, "");
      const userEmailLower = (user.email || "").toLowerCase().trim();

      // Filter out self-conversations, empty IDs, and demo conversations
      const realConvs = convs.filter((c) => {
        if (!c.otherUserId) return false;
        if (c.otherUserId === user.id) return false;
        if (userEmailLower && c.otherUserId.toLowerCase().trim() === userEmailLower) return false;
        if (userPhoneClean.length >= 9) {
          const otherPhoneClean = c.otherUserId.replace(/\D/g, "");
          if (otherPhoneClean.length >= 9 && otherPhoneClean === userPhoneClean) return false;
        }
        if (
          c.otherUserId === "demo_seller_456" ||
          c.otherUserId === "demo_admin_789" ||
          c.otherUserId === "system_admin"
        ) {
          return false;
        }
        if (
          c.otherUserName?.toLowerCase().includes("support desk") ||
          c.otherUserName?.toLowerCase().includes("james mutua")
        ) {
          return false;
        }
        return true;
      });
      const dedupled = deduplicateConversations(realConvs);
      setConversations(dedupled);
      setConversationsLoaded(true);

      // Handle query param target conversation from product page
      if (sellerIdQuery) {
        const isSelf =
          sellerIdQuery === user.id ||
          (user.email && sellerIdQuery.toLowerCase() === user.email.toLowerCase()) ||
          (user.phone && sellerIdQuery.replace(/\D/g, "") === user.phone.replace(/\D/g, ""));
        if (isSelf) {
          router.replace("/messages");
          return;
        }

        const targetConvId = getConversationId(user.id, sellerIdQuery);
        const validQueryName =
          sellerNameQuery &&
          !sellerNameQuery.toLowerCase().includes("comrade") &&
          sellerNameQuery.trim() !== "Seller" &&
          sellerNameQuery.trim() !== "MUST Seller"
            ? sellerNameQuery.trim()
            : null;
        const targetName = validQueryName || "Student Seller";

        const existing = dedupled.find(
          (c) =>
            c.id === targetConvId ||
            c.otherUserId === sellerIdQuery ||
            (validQueryName && c.otherUserName?.trim().toLowerCase() === validQueryName.toLowerCase())
        );

        if (existing) {
          if (validQueryName && (!existing.otherUserName || existing.otherUserName.toLowerCase().includes("comrade"))) {
            existing.otherUserName = validQueryName;
          }
          openConversation(existing);
        } else {
          const newTarget: Conversation = {
            id: targetConvId,
            otherUserId: sellerIdQuery,
            otherUserName: targetName,
            lastMessage: "",
            lastMessageTime: String(Date.now()),
            unreadCount: 0,
            productId: productIdQuery || undefined,
            productTitle: productTitleQuery || undefined,
          };
          setActiveConversation(newTarget);

          if (!validQueryName) {
            resolveRealUserName(sellerIdQuery).then((realName) => {
              if (realName && !realName.toLowerCase().includes("comrade")) {
                setActiveConversation((prev) =>
                  prev && prev.id === targetConvId ? { ...prev, otherUserName: realName } : prev
                );
              }
            });
          }
        }
      }
    });

    return () => {
      clearTimeout(loadedFallback);
      unsub();
    };
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
      const el = chatScrollContainerRef.current;
      if (!el) {
        setTimeout(() => scrollChatToBottom(false), 30);
      } else {
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        if (nearBottom) setTimeout(() => scrollChatToBottom(false), 30);
      }
    });

    const fallbackTimer = setTimeout(() => {
      setMessagesLoaded(true);
    }, 800);

    const unsubTyping = subscribeToTyping(
      activeConversation.id,
      activeConversation.otherUserId,
      (typing) => setIsOtherTyping(typing)
    );

    return () => {
      clearTimeout(fallbackTimer);
      unsubMessages();
      unsubTyping();
    };
  }, [activeConversation?.id, user?.id]);

  // Ensure active conversation always shows real user name, never generic fallback
  useEffect(() => {
    if (!activeConversation) return;
    const name = activeConversation.otherUserName;
    if (
      !name ||
      name.toLowerCase().includes("comrade") ||
      name === "MUST Seller" ||
      name === "Seller" ||
      name === "Student Seller"
    ) {
      resolveRealUserName(activeConversation.otherUserId).then((realName) => {
        if (realName && !realName.toLowerCase().includes("comrade") && realName !== "Student Seller") {
          setActiveConversation((prev) =>
            prev && prev.id === activeConversation.id ? { ...prev, otherUserName: realName } : prev
          );
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConversation.id ? { ...c, otherUserName: realName } : c
            )
          );
        }
      });
    }
  }, [activeConversation?.id, activeConversation?.otherUserId]);

  // Scroll to bottom when conversation changes
  useEffect(() => {
    setTimeout(() => scrollChatToBottom(false), 40);
  }, [activeConversation?.id]);

  // ─── WhatsApp Actions ────────────────────────────────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be smaller than 10MB");
      return;
    }
    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveSelectedImage = () => {
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
  };

  const handleReaction = async (msg: Message, emoji: string) => {
    if (!user || !activeConversation) return;
    try {
      await toggleMessageReaction(activeConversation.id, msg.id, user.id, emoji);
      setReactionMsgId(null);
      setMenuMsgId(null);
    } catch (err) {
      console.error("Failed to toggle reaction:", err);
    }
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMessage(msg);
    setNewMessageText(msg.content);
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    setMenuMsgId(null);
    setReactionMsgId(null);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setNewMessageText("");
  };

  const handleDeleteMessageConfirm = async () => {
    if (!activeConversation || !messageToDelete) return;
    try {
      await deleteMessage(activeConversation.id, messageToDelete.id);
      setMessageToDelete(null);
      setMenuMsgId(null);
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const handleClearChatConfirm = async () => {
    if (!activeConversation) return;
    try {
      await clearConversationMessages(activeConversation.id);
      setMessages([]);
      setConvActionConfirm(null);
      setShowConvMenu(false);
    } catch (err) {
      console.error("Failed to clear chat:", err);
    }
  };

  const handleDeleteConversationConfirm = async () => {
    if (!user || !convActionConfirm) return;
    try {
      const targetId = convActionConfirm.conversationId;
      await deleteConversation(user.id, targetId);
      setConversations((prev) => prev.filter((c) => c.id !== targetId));
      if (activeConversation?.id === targetId) {
        setActiveConversation(null);
      }
      setConvActionConfirm(null);
      setShowConvMenu(false);
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  // Right click on empty conversation area closes conversation
  const handleChatAreaContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractive = target.closest(
      "button, a, input, textarea, img, .message-bubble, .reaction-bar, [data-interactive='true']"
    );
    if (!isInteractive) {
      e.preventDefault();
      setActiveConversation(null);
      setMenuMsgId(null);
      setReactionMsgId(null);
      setEditingMessage(null);
    }
  };

  // Send new message or save edited message
  const handleSendDirectMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !activeConversation) return;

    // 1. If currently editing an existing message
    if (editingMessage) {
      const newText = newMessageText.trim();
      if (!newText) return;
      try {
        await editMessage(activeConversation.id, editingMessage.id, newText);
        setEditingMessage(null);
        setNewMessageText("");
      } catch (err) {
        console.error("Failed to edit message:", err);
      }
      return;
    }

    // 2. If sending a new message (text and/or image)
    if (!newMessageText.trim() && !selectedImageFile) return;
    if (sendingDirect || uploadingImage) return;

    if (activeConversation.otherUserId === user.id) {
      console.warn("Cannot send message to oneself");
      return;
    }

    const content = newMessageText.trim();
    const fileToUpload = selectedImageFile;

    setNewMessageText("");
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    setSendingDirect(true);

    let imageUrl: string | null = null;
    if (fileToUpload) {
      setUploadingImage(true);
      try {
        imageUrl = await uploadProductImage(fileToUpload);
      } catch (err) {
        console.warn("Failed to upload chat image:", err);
      } finally {
        setUploadingImage(false);
      }
    }

    try {
      await sendMessage({
        senderId: user.id,
        receiverId: activeConversation.otherUserId,
        receiverName: activeConversation.otherUserName,
        senderName: user.fullName || "MUST Student",
        content,
        imageUrl,
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

  // Filter conversations safely
  const filteredConversations = deduplicateConversations(
    conversations.filter((c) => {
      const name = (c?.otherUserName || "").toLowerCase();
      const last = (c?.lastMessage || "").toLowerCase();
      const q = (searchFilter || "").toLowerCase();
      return name.includes(q) || last.includes(q);
    })
  );

  if (authLoading) {
    return <MessagesPageSkeleton />;
  }

  return (
    <div className="w-full h-[calc(100dvh-3.5rem-4rem)] sm:h-[calc(100vh-4rem)] overflow-hidden bg-slate-100/70 dark:bg-slate-950 flex select-none">
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
        <div className="flex-1 overflow-y-auto flex flex-col">
          {!conversationsLoaded ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {Array.from({ length: 6 }).map((_, i) => (
                <ConversationItemSkeleton key={i} />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center md:justify-start p-6 md:p-8 md:pt-12 text-center text-slate-400 space-y-3 md:space-y-2">
              <div className="w-16 h-16 md:w-12 md:h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-1">
                <MessageSquare className="w-8 h-8 md:w-6 md:h-6 opacity-40 text-slate-400" />
              </div>
              <p className="text-sm md:text-xs font-bold md:font-semibold text-slate-700 dark:text-slate-300">
                {searchFilter ? "No conversations found" : "No conversations yet"}
              </p>
              <p className="text-xs md:text-[11px] text-slate-400 max-w-xs leading-relaxed">
                {searchFilter
                  ? `No chats match "${searchFilter}". Try another name or keyword.`
                  : "Start chatting with sellers directly from any product page."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredConversations.map((conv) => {
                const isSelected = activeConversation?.id === conv.id;
                const initial = (conv.otherUserName || "U").charAt(0).toUpperCase();

                return (
                  <div
                    key={conv.id}
                    className={`group relative w-full p-3.5 flex items-center gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-l-4 border-emerald-600"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                    onClick={() => openConversation(conv)}
                  >
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-sm shrink-0 shadow-xs">
                      {initial}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {conv.otherUserName || "Student Seller"}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatRelativeTime(conv.lastMessageTime)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate pr-2">
                          {conv.lastMessage || "Click to open chat"}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {conv.unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                              {conv.unreadCount}
                            </span>
                          )}
                          {/* WhatsApp-style delete conversation button on hover */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConvActionConfirm({
                                type: "delete",
                                conversationId: conv.id,
                                userName: conv.otherUserName,
                              });
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            title="Delete chat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
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
      <main className={`flex-1 flex-col h-full bg-white dark:bg-slate-950 min-w-0 overflow-hidden ${activeConversation ? "flex" : "hidden md:flex"}`}>
        {activeConversation ? (
          <>
            {/* Direct Chat Top Bar (NO CALL BUTTONS as requested) */}
            <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setActiveConversation(null)}
                  className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-sm shrink-0">
                  {(activeConversation.otherUserName || "U").charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {activeConversation.otherUserName || "Student Seller"}
                  </h3>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Active now</span>
                  </p>
                </div>
              </div>

              {/* Chat Options Dropdown Menu (3-dots) */}
              <div className="relative" data-popup="true">
                <button
                  type="button"
                  onClick={() => setShowConvMenu(!showConvMenu)}
                  className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Chat options"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {showConvMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-1.5 z-40 text-xs animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setConvActionConfirm({
                          type: "clear",
                          conversationId: activeConversation.id,
                          userName: activeConversation.otherUserName,
                        });
                        setShowConvMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      <Trash2 className="w-4 h-4 text-amber-500" />
                      <span>Clear messages</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConvActionConfirm({
                          type: "delete",
                          conversationId: activeConversation.id,
                          userName: activeConversation.otherUserName,
                        });
                        setShowConvMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400"
                    >
                      <Ban className="w-4 h-4" />
                      <span>Delete conversation</span>
                    </button>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                    <button
                      type="button"
                      onClick={() => {
                        setActiveConversation(null);
                        setShowConvMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500"
                    >
                      <X className="w-4 h-4" />
                      <span>Close chat</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Product Context Banner */}
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

            {/* Messages Container (Right-click on empty area closes conversation) */}
            <div
              ref={chatScrollContainerRef}
              onContextMenu={handleChatAreaContextMenu}
              title="Tip: Right-click empty area to close chat"
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col select-text"
            >
              {!messagesLoaded ? (
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
                    Send a message to start chatting with {activeConversation.otherUserName || "this student"}.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const myCanon = resolveCanonicalId(user?.id || "");
                  const senderCanon = resolveCanonicalId(msg.senderId || "");
                  const isMe = Boolean(myCanon && (myCanon === senderCanon || msg.senderId === user?.id));
                  const isDeleted = Boolean(msg.isDeleted);
                  const reactionsMap = msg.reactions || (msg.reaction ? { default: msg.reaction } : {});
                  const reactionEntries = Object.entries(reactionsMap);
                  const isMenuOpen = menuMsgId === msg.id;
                  const isReactionPickerOpen = reactionMsgId === msg.id;

                  return (
                    <div
                      key={msg.id}
                      className={`group relative flex flex-col ${isMe ? "items-end" : "items-start"} my-1`}
                    >
                      {/* WhatsApp-style Hover Action Bar (Reaction button, Heart, 3-dots) */}
                      {!isDeleted && (
                        <div
                          data-popup="true"
                          className={`absolute top-0 -translate-y-1/2 ${
                            isMe ? "right-2" : "left-2"
                          } z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md rounded-full px-1.5 py-0.5 flex items-center gap-0.5`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setReactionMsgId(reactionMsgId === msg.id ? null : msg.id);
                              setMenuMsgId(null);
                            }}
                            className="p-1 text-slate-400 hover:text-amber-500 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="React"
                          >
                            <Smile className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReaction(msg, "❤️")}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Like with ❤️"
                          >
                            <span className="text-xs leading-none">❤️</span>
                          </button>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setMenuMsgId(menuMsgId === msg.id ? null : msg.id);
                                setReactionMsgId(null);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              title="More options"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {isMenuOpen && (
                              <div
                                className={`absolute top-full mt-1 ${
                                  isMe ? "right-0" : "left-0"
                                } w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 z-30 text-xs`}
                              >
                                {isMe && !msg.imageUrl && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(msg)}
                                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-blue-500" />
                                    <span>Edit text</span>
                                  </button>
                                )}
                                {isMe && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMessageToDelete(msg);
                                      setMenuMsgId(null);
                                    }}
                                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (navigator.clipboard) {
                                      navigator.clipboard.writeText(msg.content || "");
                                    }
                                    setMenuMsgId(null);
                                  }}
                                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                >
                                  <span>Copy text</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Quick Reaction Popup Picker */}
                      {isReactionPickerOpen && (
                        <div
                          data-popup="true"
                          className={`absolute top-0 -translate-y-full ${
                            isMe ? "right-0" : "left-0"
                          } mb-1 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-xl px-2 py-1.5 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150`}
                        >
                          {EMOJI_OPTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleReaction(msg, emoji)}
                              className="text-base sm:text-lg hover:scale-125 transition-transform p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Bubble Content */}
                      <div
                        className={`message-bubble relative max-w-[85%] sm:max-w-md rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                          isMe
                            ? "bg-emerald-600 text-white rounded-br-xs"
                            : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs"
                        } ${isDeleted ? "opacity-75 italic" : ""}`}
                      >
                        {/* Image attachment in bubble */}
                        {msg.imageUrl && !isDeleted && (
                          <div className="p-1">
                            <img
                              src={msg.imageUrl}
                              alt="Attached photo"
                              onClick={() => setLightboxImageUrl(msg.imageUrl || null)}
                              className="rounded-xl max-h-72 w-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            />
                          </div>
                        )}

                        {/* Text message content */}
                        {msg.content && (
                          <div className="px-4 py-2.5">
                            {isDeleted ? (
                              <span className="flex items-center gap-1.5 text-slate-300 dark:text-slate-400">
                                <Ban className="w-3.5 h-3.5" />
                                <span>This message was deleted</span>
                              </span>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            )}
                          </div>
                        )}

                        {/* WhatsApp-style floating reaction badge docked on bottom edge */}
                        {reactionEntries.length > 0 && !isDeleted && (
                          <div
                            onClick={() => handleReaction(msg, reactionEntries[0][1])}
                            className={`absolute -bottom-2.5 ${
                              isMe ? "left-2" : "right-2"
                            } bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-1.5 py-0.5 text-xs shadow-sm flex items-center gap-0.5 cursor-pointer hover:scale-105 transition-transform`}
                            title="Reaction (click to toggle)"
                          >
                            <span>{reactionEntries[0][1]}</span>
                            {reactionEntries.length > 1 && (
                              <span className="text-[10px] text-slate-500 font-bold">
                                {reactionEntries.length}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bubble Timestamp and Status Footer */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 px-1">
                        <span>{formatMessageTime(msg.timestamp)}</span>
                        {msg.isEdited && !isDeleted && (
                          <span className="text-[9px] italic text-slate-400 font-medium">(edited)</span>
                        )}
                        {isMe && !isDeleted && (
                          <CheckCheck className={`w-3.5 h-3.5 ${msg.isRead ? "text-emerald-400" : "text-slate-400"}`} />
                        )}
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

            {/* ── Chat Composer ──────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
              {/* Image Preview Banner if an image is selected */}
              {selectedImagePreview && (
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs">
                      <img
                        src={selectedImagePreview}
                        alt="Selected attachment"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-slate-800 dark:text-slate-200">Image attached</p>
                      <p className="text-[10px] text-slate-400">Add a caption or send directly</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveSelectedImage}
                    className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Editing Banner if editing an existing message */}
              {editingMessage && (
                <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2 min-w-0">
                    <Pencil className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span className="truncate">
                      Editing message: <strong className="italic">"{editingMessage.content}"</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="p-1 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 transition-colors"
                    title="Cancel edit"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <form
                onSubmit={handleSendDirectMessage}
                className="p-3 flex items-center gap-2"
              >
                {/* Media Attachment Paperclip Button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sendingDirect || uploadingImage || Boolean(editingMessage)}
                  className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                  title="Send photo"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <input
                  type="text"
                  placeholder={editingMessage ? "Edit message..." : "Type a message..."}
                  value={newMessageText}
                  onChange={(e) => {
                    setNewMessageText(e.target.value);
                    if (activeConversation && user && !editingMessage) {
                      setTypingStatus(activeConversation.id, user.id, e.target.value.length > 0);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />

                <button
                  type="submit"
                  disabled={
                    sendingDirect ||
                    uploadingImage ||
                    (!newMessageText.trim() && !selectedImageFile)
                  }
                  className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white flex items-center justify-center transition-all shrink-0 shadow-xs"
                  title={editingMessage ? "Save edit" : "Send message"}
                >
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
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
              Choose a buyer or seller from the left to view messages, send photos, and make campus deals.
            </p>
          </div>
        )}
      </main>

      {/* ── MODAL: Delete Message Confirmation ──────────────────────────────── */}
      {messageToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Message?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This message will be deleted for everyone in this chat.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMessageToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMessageConfirm}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-colors"
              >
                Delete for everyone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Clear / Delete Conversation Confirmation ─────────────────── */}
      {convActionConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                convActionConfirm.type === "clear"
                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
                  : "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
              }`}
            >
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {convActionConfirm.type === "clear" ? "Clear Chat History?" : "Delete Conversation?"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {convActionConfirm.type === "clear"
                  ? `Are you sure you want to delete all messages with ${convActionConfirm.userName}?`
                  : `Are you sure you want to remove the conversation with ${convActionConfirm.userName}?`}
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConvActionConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={
                  convActionConfirm.type === "clear"
                    ? handleClearChatConfirm
                    : handleDeleteConversationConfirm
                }
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm transition-colors ${
                  convActionConfirm.type === "clear"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {convActionConfirm.type === "clear" ? "Clear Messages" : "Delete Chat"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Full Screen Image Lightbox ────────────────────────────────── */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
            <a
              href={lightboxImageUrl}
              download="chat-photo.jpg"
              onClick={(e) => e.stopPropagation()}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Download photo"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              type="button"
              onClick={() => setLightboxImageUrl(null)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <img
            src={lightboxImageUrl}
            alt="Enlarged chat attachment"
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<MessagesPageSkeleton />}>
      <MessagesContent />
    </Suspense>
  );
}
