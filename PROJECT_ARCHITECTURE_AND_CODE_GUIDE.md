# 🚀 SmartBill: Master Project Architecture & Code Defense Guide

This comprehensive guide breaks down the complete architecture, data flows, folder structures, and key code modules of the **SmartBill** project. Use this reference to understand, present, or defend any part of the codebase in technical evaluations, vivas, client presentations, or architectural reviews.

---

## 📑 Table of Contents
1. [Executive Overview & Tech Stack](#1-executive-overview--tech-stack)
2. [Monorepo Architecture Map](#2-monorepo-architecture-map)
3. [Backend Deep Dive (Node.js / Express / MongoDB)](#3-backend-deep-dive)
4. [Frontend Deep Dive (React / Vite Apps)](#4-frontend-deep-dive)
5. [Shared Core Library (`/shared`)](#5-shared-core-library-shared)
6. [Core Technical Workflows & Lifecycles](#6-core-technical-workflows--lifecycles)
7. [Comprehensive Viva & Code Defense Q&A](#7-comprehensive-viva--code-defense-qa)

---

## 1. Executive Overview & Tech Stack

### What is SmartBill?
**SmartBill** is a full-stack, multi-tenant SaaS Business Management, POS Billing, and Inventory platform tailored for retail and wholesale merchants. It includes live camera-based barcode scanning with audio feedback, industry-specific product category isolation, real-time push notifications via Server-Sent Events (SSE), and subscription tier enforcement.

### Technology Stack:
- **Frontend Core**: React 18, Vite, React Router DOM, TailwindCSS & Vanilla CSS design systems, Lucide Icons.
- **Backend Core**: Node.js, Express.js (REST API), Server-Sent Events (SSE).
- **Database & ODM**: MongoDB with Mongoose Schemas & Transactions.
- **Security & Authentication**: JSON Web Tokens (JWT), Bcrypt password hashing, Multi-Tier Role-Based Access Control (RBAC).
- **Hardware & Web APIs**: Web BarcodeDetector API, Web Audio API Synthesizer, MediaDevices Camera Stream.

---

## 2. Monorepo Architecture Map

SmartBill is organized as a unified monorepo:

```
SmartBill/
├── Backend/                 # Central Express REST API & MongoDB Database
│   ├── config/              # Database connection & environment loaders
│   ├── controller/          # Core business logic & request handlers
│   ├── middleware/          # JWT auth, RBAC permissions, plan limit guards
│   ├── models/              # Mongoose data schemas (24 schemas)
│   ├── routes/              # Express API route endpoints
│   ├── services/            # Background notification services (SSE)
│   ├── utils/               # JWT signers, token validators, formatters
│   └── server.js            # Main backend entry point
│
├── apps/                    # Frontend Applications (Vite + React)
│   ├── crm/                 # Merchant Dashboard (POS, Inventory, Billing, Reports)
│   ├── admin-panel/         # Super-Admin Portal (Users, Plans, Platform Metrics)
│   └── landing-page/        # SaaS Marketing, Pricing, & Lead Generation
│
└── shared/                  # Shared Monorepo Codebase
    └── src/
        ├── api/             # Central Axios API client with auth interceptors
        ├── components/      # Reusable UI components (CameraBarcodeScanner, Modals, Forms)
        ├── context/         # Global state (AuthContext, NotificationContext, ThemeContext)
        ├── hooks/           # Custom React hooks (useAuth, useLocalStorage)
        ├── i18n/            # Localization dictionary
        └── utils/           # Business categories, currency & date formatters
```

---

## 3. Backend Deep Dive

### 🔑 Authentication & Role-Based Access Control (RBAC)
- **Files**: `Backend/middleware/auth.js`, `Backend/routes/authRoutes.js`, `Backend/controller/authController.js`
- **Mechanism**:
  - Tokens are signed with HMAC SHA-256 containing `{ id, role, ownerId }`.
  - The `protect` middleware extracts the token from the `Authorization: Bearer <token>` header, decodes it, and populates `req.user`.
  - The `authorize(...roles)` middleware blocks unauthorized requests (e.g. non-superadmins attempting to mutate global subscription plans).

### 🛡️ Plan Limit Enforcement
- **File**: `Backend/middleware/checkPlanLimits.js`
- **Mechanism**:
  - Intercepts mutating requests (e.g. creating a product, customer, or invoice).
  - Queries the user's active `SubscriptionPlan` to evaluate quotas.
  - If `currentProductCount >= plan.maxProducts`, it rejects the request with HTTP `403 Forbidden` and an upgrade directive.

### 📦 Key Data Models (`Backend/models/`)
1. **`User.js`**: Merchant and staff accounts with roles (`superadmin`, `admin`, `employee`), password hashes, and business metadata.
2. **`Product.js`**: SKU, Barcode, HSN, Tax Rate, Stock Quantity, Low-stock alerts, and Industry Category.
3. **`Order.js`**: Immutable transaction record with line items, applied discounts, GST breakdown (CGST/SGST/IGST), and payment status.
4. **`InvoiceSettings.js`**: Tenant-specific layout settings, paper size (`A4`, `Thermal 80mm`), UPI QR codes, and bank credentials.
5. **`Purchase.js` & `PurchaseReturn.js`**: Inward inventory management and supplier ledger reconciliation.
6. **`Notification.js`**: In-app notifications for order updates, low inventory, and system alerts.

---

## 4. Frontend Deep Dive

### Apps Breakdown:
1. **`apps/crm` (Merchant Portal)**:
   - **`POSScreen.jsx`**: Fast cashier billing interface with camera/USB barcode scanning, live search, cart calculations, and instant receipt generation.
   - **`ProductsScreen.jsx`**: Catalog management with dynamic industry category filtering.
   - **`DashboardScreen.jsx`**: Real-time sales metrics, revenue charts, and stock alerts.
   - **`InvoiceScreen.jsx` & `OrdersScreen.jsx`**: Transaction records, PDF download, and print previews.

2. **`apps/admin-panel` (Platform Super-Admin)**:
   - Platform metrics, merchant management, subscription tier configuration, coupon generation, and global notification broadcasting.

3. **`apps/landing-page` (Public Site)**:
   - Public marketing landing page, feature showcase, interactive pricing tables, and user onboarding.

---

## 5. Shared Core Library (`/shared`)

The `/shared` folder prevents code duplication across all three apps:
- **`shared/src/api/axiosClient.js`**: Pre-configured Axios instance with automatic JWT header injection and global 401 error handling.
- **`shared/src/context/AuthContext.jsx`**: Handles login/logout sessions, permissions, and persistent token storage.
- **`shared/src/context/NotificationContext.jsx`**: Manages real-time SSE event subscriptions and notification badge counters.
- **`shared/src/components/common/CameraBarcodeScanner.jsx`**: Hardware-accelerated camera barcode scanner with Web Audio scan beeps.
- **`shared/src/utils/businessCategories.js`**: Central catalog mapping industry verticals (Pharma, Kirana, Apparel) to specific product categories.

---

## 6. Core Technical Workflows & Lifecycles

### 🛒 1. POS Checkout & Stock Mutation Workflow
```
[ POS Screen Cart ] ──( Scans Barcode / Adds Products )
         │
         ▼
[ Computes Taxes & Discounts in Memory ]
         │
         ▼ ( POST /api/orders )
[ orderController.js ]
         ├── 1. Validates line items & active prices
         ├── 2. Atomically decrements product stock ($inc: -quantity)
         ├── 3. Creates immutable Order document
         └── 4. Broadcasts SSE notification to staff & admin
```

### ⚡ 2. Real-Time Notification Workflow (Server-Sent Events)
```
[ Frontend: NotificationContext.jsx ] ──( GET /api/notifications/stream )──► [ Express Server ]
                                                                                   │
[ New Order / Low Stock Event Triggered ] ─────────────────────────────────────────┘
                                       │
                                       ▼ ( JSON pushed down open HTTP stream )
[ NotificationContext receives SSE payload ] ──► [ Toast alert + Badge counter increments ]
```

---

## 7. Comprehensive Viva & Code Defense Q&A

### Q1: Why use a Monorepo architecture for this project?
> **Answer:** *"A Monorepo lets our three frontend apps (`crm`, `admin-panel`, `landing-page`) share a single codebase in `/shared` for authentication contexts, API clients, UI components, and business category models. This eliminates code duplication, maintains design consistency, and streamlines updates while keeping each app independently deployable."*

### Q2: How is multi-tenant security achieved in the backend?
> **Answer:** *"Every database model that holds business data (Products, Orders, Customers, InvoiceSettings) stores a `userId` or `ownerId` reference. Every query executed in our controllers filters strictly by `req.user.id` or `req.user.ownerId` retrieved from the validated JWT, preventing any cross-tenant data leakage."*

### Q3: Why did you choose Server-Sent Events (SSE) instead of WebSockets?
> **Answer:** *"For notifications and status alerts, communication is unidirectional from server to client. SSE runs over standard HTTP/2, handles automatic reconnection natively, requires no extra connection handshake servers, and consumes fewer server resources than full-duplex WebSockets."*

### Q4: How does the camera barcode scanner work without heavy external SDKs?
> **Answer:** *"It leverages the browser's native `BarcodeDetector` API for hardware-accelerated scanning directly on the video stream. We pair it with the `Web Audio API` to synthesize a zero-latency audio beep when a valid barcode is detected, keeping bundle size minimal."*

### Q5: How are invoices kept consistent if settings or prices change later?
> **Answer:** *"When an invoice is finalized, the `Order` model stores an immutable snapshot of line item prices, tax amounts, customer details, and applied discounts at the exact moment of sale. While `InvoiceSettings` dictates default formatting rules, historical sales records remain permanently uncorrupted."*
