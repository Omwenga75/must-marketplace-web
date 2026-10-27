# MUST Marketplace Web — System Architecture & Data Mapping

MUST Marketplace Web is the modern, responsive web counterpart to the **MUST Marketplace Android application** for students at **Meru University of Science and Technology (MUST)**.

---

## 1. Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (Strict mode)
- **Styling**: Tailwind CSS with custom design tokens mapped directly to MUST Android theme
- **Icons**: Lucide React
- **Backend / Realtime Database**: Firebase Realtime Database & Firebase Storage
- **Authentication**: Firebase Authentication with instant test persona switcher (Student, Campus Seller, Super Admin)
- **Date Handling**: Date-fns

---

## 2. Brand Colors (Exact Android Material 3 Tokens)

| Token | Hex | Role |
|---|---|---|
| `PrimaryGreen` | `#DEF5E5` | Pale Mint background accents, tags |
| `OnPrimary` | `#0F172A` | Navy slate text on mint |
| `PrimaryContainer` | `#BBE5C7` | Avatar backgrounds, badge containers |
| `OnPrimaryContainer` | `#064E3B` | Deep forest green emphasis |
| `SecondaryAmber` | `#F97316` | Sunset Orange buttons, CTAs, highlight badges |
| `OnSecondary` | `#FFFFFF` | White text on secondary orange |
| `SecondaryContainer` | `#FFEDD5` | Light amber chip background |
| `OnSecondaryContainer` | `#C2410C` | Deep amber text |
| `BackgroundLight` | `#F8FAFC` | Main light page background |
| `SurfaceLight` | `#FFFFFF` | Card surface |
| `BackgroundDark` | `#0F172A` | Dark mode background |
| `SurfaceDark` | `#1E293B` | Dark mode card surface |
| `SurfaceVariantDark`| `#334155` | Dark mode borders and secondary inputs |

---

## 3. Web ↔ Android Firebase Schema Mapping

Both the Android application (`com.must.marketplace`) and MUST Marketplace Web read and write from the **identical Firebase database structure**:

### 1. `products/{productId}`
| Web Key | Android Model | Type | Notes |
|---|---|---|---|
| `id` | `Product.id` | String | Unique product ID |
| `title` | `Product.title` | String | Item name |
| `description` | `Product.description` | String | Description |
| `price` | `Product.price` | Double / Number | Price in KSh |
| `condition` | `Product.condition` | String | `"NEW"` or `"SECOND_HAND"` |
| `category` | `Product.category` | Object | `{ id, name, icon, description }` |
| `location` | `Product.location` | String | Campus hostel / zone |
| `imageUrls` | `Product.imageUrls` | List<String> | Image URLs |
| `sellerId` | `Product.sellerId` | String | UID of student seller |
| `sellerName` | `Product.sellerName` | String | Full name |
| `sellerPhone`| `Product.sellerPhone`| String | Contact / WhatsApp |
| `views` | `Product.views` | Int | View counter |
| `likes` | `Product.likes` | Int | Favorite counter |
| `status` | `Product.status` | String | `"ACTIVE"`, `"SOLD"`, `"BOOKED"` |
| `createdAt` | `Product.createdAt` | String | Timestamp |

### 2. `users/{uid}`
- `fullName`: Student name
- `email`: MUST student email
- `phone`: Mobile / WhatsApp
- `location`: Hostel / Campus
- `seller` / `isSeller`: Boolean indicating seller activation
- `admin` / `isAdmin`: Boolean indicating administrator rights
- `activeListings`: Count of active ads
- `soldItems`: Count of completed sales

### 3. `favorites/{uid}/{productId}`
- Mapped as `true`. Toggling increments/decrements `products/{productId}/likes`.

### 4. `product_views/{productId}/{uid}`
- Set to `true` when a student visits a product page, incrementing `products/{productId}/views`.

### 5. `conversations/{uid}/{conversationId}`
- Stores active conversation list: `id`, `otherUserId`, `otherUserName`, `lastMessage`, `lastMessageTime`, `unreadCount`, `productId`, `productTitle`.

### 6. `messages/{conversationId}/{messageId}`
- Stores real-time chat messages: `senderId`, `receiverId`, `content`, `timestamp`, `isRead`, `productId`.

### 7. `conversations_typing/{conversationId}/{uid}`
- Live boolean indicating when a comrade is typing.

### 8. `notifications/{uid}/{notificationId}`
- In-app student notifications with `type` (`welcome`, `message`, `booking`, `system`) and priority.

---

## 4. Directory Structure

```text
src/
├── app/
│   ├── layout.tsx              # Root layout with Auth & Favorites providers, Navbar, Footer
│   ├── page.tsx                # Homepage (Hero, Categories, Featured, How it works, CTA)
│   ├── globals.css             # Tailwind theme directives & tokens
│   ├── marketplace/
│   │   └── page.tsx            # Filterable product grid (Category, Condition, Price, Location)
│   ├── product/
│   │   └── [id]/page.tsx       # Product detail page with gallery & product-aware chat
│   ├── saved/
│   │   └── page.tsx            # Bookmarked items page
│   ├── profile/
│   │   └── page.tsx            # User profile & contact update
│   ├── messages/
│   │   └── page.tsx            # WhatsApp-style real-time messaging with live typing
│   ├── notifications/
│   │   └── page.tsx            # Notifications center with unread counters
│   ├── login/
│   │   └── page.tsx            # Sign in with instant test persona switcher
│   ├── register/
│   │   └── page.tsx            # Account registration
│   ├── forgot-password/
│   │   └── page.tsx            # Firebase password reset
│   ├── seller/
│   │   ├── activate/page.tsx   # Seller activation flow
│   │   ├── dashboard/page.tsx  # Seller stats, active/sold toggles, listing manager
│   │   └── products/new/       # Add product form with image upload
│   └── admin/
│       └── page.tsx            # Super Admin console (Overview, Products, Users, Broadcast)
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx          # Responsive navbar + mobile bottom navigation
│   │   └── Footer.tsx          # University campus footer
│   └── products/
│       ├── ProductCard.tsx     # Reusable responsive product card with badge & favorite
│       └── ProductGrid.tsx     # Responsive CSS grid with skeletons & empty states
├── context/
│   ├── AuthContext.tsx         # Firebase Auth + quick persona switcher
│   └── FavoritesContext.tsx    # Reactive bookmarks state
├── lib/
│   ├── constants.ts            # Categories, university locations, initial sample data
│   ├── utils.ts                # Price formatter (KSh), relative time, cn helper
│   └── firebase/
│       ├── config.ts           # Firebase client initialization
│       └── services.ts         # Firebase RTDB & Storage services
└── types/
    └── index.ts                # TypeScript domain models matching Android 1:1
```

---

## 5. Responsive Breakpoint Strategy

- **Small Phones (320px–374px)**: Compact 2-column grid, fluid text truncation, bottom navigation bar.
- **Normal Phones (375px–430px)**: 2-column grid, sticky chat composer, touch-optimized targets.
- **Tablets (640px–1023px)**: 3-column grid, responsive sheets.
- **Laptops (1024px–1439px)**: 4-column grid, sidebar filters, dual-pane chat.
- **Desktops (1440px+)**: 4–5 column grid, spacious layout.
