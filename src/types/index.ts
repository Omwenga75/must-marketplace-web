// Cross-platform type definitions matching com.must.marketplace.domain.model exactly

export type ProductCondition = "NEW" | "SECOND_HAND";

export type ProductStatus = "ACTIVE" | "BOOKED" | "SOLD" | "DRAFT" | "PAUSED";

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface Product {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerPhone?: string;
  sellerImageUrl?: string | null;
  sellerLikes?: number;
  title: string;
  description: string;
  price: number;
  condition: ProductCondition;
  category: Category;
  location: string;
  imageUrls: string[];
  status: ProductStatus;
  views: number;
  likes: number;
  createdAt: string; // ISO or formatted string
  bookedBy?: string | null;
  bookedAt?: number | null;
  isBookedByMe?: boolean;
  isFavorited?: boolean;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  profileImageUrl?: string | null;
  location?: string | null;
  seller?: boolean; // In Android, firebase has "seller": boolean
  isSeller?: boolean;
  admin?: boolean;
  isAdmin?: boolean;
  memberSince: string;
  activeListings: number;
  soldItems: number;
  likes: number;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  productId?: string | null;
  content: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  timestamp: string;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  productId?: string | null;
  productTitle?: string | null;
  otherUserPhoto?: string | null;
}

export type ChatroomTopic = "general" | "hostels" | "requests" | "study";

export interface ChatroomMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: "student" | "seller" | "admin";
  senderAvatar?: string;
  content: string;
  topic: ChatroomTopic;
  timestamp: string;
  likes?: number;
  likedBy?: string[];
  productTag?: {
    id: string;
    title: string;
    price: number;
  };
}

export type NotificationType = "general" | "welcome" | "booking" | "message" | "system" | "listing" | "price" | "security" | "tip";
export type NotificationPriority = "URGENT" | "NORMAL" | "INFO";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  isRead: boolean;
  type: NotificationType;
  priority: NotificationPriority;
}

export interface Booking {
  id: string;
  productId: string;
  buyerId: string;
  buyerName?: string;
  sellerId: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  createdAt: number;
  product?: Partial<Product>;
}

export interface AdminBroadcast {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  priority: NotificationPriority;
  sentBy: string;
}
