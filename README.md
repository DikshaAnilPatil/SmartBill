
# 🚀 SmartBill — Enterprise Multi-Tenant POS, Invoicing & Business Management SaaS

[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org)
[![React Version](https://img.shields.io/badge/React-v18.3-blue.svg)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-v6.3-purple.svg)](https://vitejs.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen.svg)](https://mongoosejs.com)
[![License](https://img.shields.io/badge/License-MIT-orange.svg)](#license)

**SmartBill** is an enterprise-grade, multi-tenant SaaS Business Management, POS Billing, and Inventory platform built for modern retail, wholesale, and distribution businesses. Featuring camera-based hardware-accelerated barcode scanning, real-time push notifications via Server-Sent Events (SSE), industry-specific product category isolation, and robust subscription tier limits enforcement.

---

## 🏗️ Monorepo Architecture

The workspace is organized into independently deployable micro-frontends with a unified shared core library:

```
SmartBill/
├── Backend/                 # Express.js REST API & MongoDB Data Layer
│   ├── config/              # MongoDB & server configurations
│   ├── controller/          # Business logic handlers
│   ├── middleware/          # JWT auth, RBAC permissions, plan limit guards
│   ├── models/              # Mongoose data models (24 schemas)
│   ├── routes/              # Express API route declarations
│   ├── services/            # Real-time SSE notification & email services
│   └── server.js            # Express application entrypoint
│
├── apps/                    # Frontend Client Applications
│   ├── crm/                 # Merchant Dashboard (POS, Inventory, Billing, Reports)
│   ├── admin-panel/         # Super-Admin Portal (Merchants, Plans, Analytics)
│   └── landing-page/        # Public Marketing, Pricing & Lead Conversion
│
├── shared/                  # Central Shared Monorepo Package
│   └── src/
│       ├── api/             # Central Axios client with auth interceptors
│       ├── components/      # UI components (CameraBarcodeScanner, Modals, Tables)
│       ├── context/         # React Contexts (AuthContext, NotificationContext)
│       └── utils/           # Business category mappings, formatters, helpers
│
└── PROJECT_ARCHITECTURE_AND_CODE_GUIDE.md  # Complete Viva & Code Defense Blueprint
```

---

## ⚡ Core Features

- 🛒 **High-Speed POS Billing**: Instant item search, barcode scan with instant Web Audio synthesizer beep, cash/UPI/card split payments.
- 📷 **Live Camera Barcode Scanner**: Hardware-accelerated scanning using the native Web `BarcodeDetector` API with flashlight and camera flip support.
- 🏷️ **Industry Category Isolation**: Dynamic category presets tailored to specific business verticals (Pharmacy, Kirana, Apparel, Electronics, Wholesale).
- 🔔 **Real-Time Push Notifications**: Server-Sent Events (`SSE`) for instant order updates and low-stock alerts without polling.
- 🛡️ **Subscription Tier Limits**: Automated middleware guards enforcing plan limits on products, monthly orders, and employee accounts.
- 🖨️ **Thermal & A4 Invoice Studio**: Customizable templates with merchant colors, dynamic UPI QR code generator, bank details, and GST breakdowns.
- 🔐 **Multi-Tier Role Access (RBAC)**: Super-Admin, Business Owner, Manager, Cashier, and Accountant permission boundaries.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) `>= 18.0.0`
- [MongoDB](https://www.mongodb.com/) `>= 6.0` (Local or MongoDB Atlas)

### 1. Installation
```bash
# Clone repository
git clone https://github.com/Prathameshbhavsar26/SmartBill.git
cd SmartBill

# Install root & workspace dependencies
npm install
```

### 2. Environment Setup
Create `Backend/.env` (see `Backend/.env.example`):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smartbill
JWT_SECRET=your_super_secret_jwt_key_here
SUPERADMIN_EMAIL=admin@smartbill.com
SUPERADMIN_PASSWORD=YourPassword123!
```

### 3. Running in Development
```bash
# Start all 3 frontend apps + backend concurrently
npm run dev
```
- **Landing Page**: `http://localhost:5173`
- **CRM Merchant Dashboard**: `http://localhost:5174`
- **Super-Admin Panel**: `http://localhost:5175`
- **Backend API**: `http://localhost:5000`

---

## 🧪 Testing & Validation

```bash
# Run backend test suite (33 automated security & billing tests)
npm test

# Verify all frontend workspace production builds
npm run build
```

---

## 🚢 Production Deployment

### Option A: Docker Deployment
Each app can be built into a container:
- **Backend API**: Run `node server.js` with production environment variables.
- **Frontend Apps**: `npm run build` generates optimized static files in `dist/` ready to serve via NGINX, Vercel, Netlify, or AWS S3/CloudFront.

### Option B: PM2 (Virtual Machine / VPS)
```bash
# Backend Production Process
cd Backend
pm2 start server.js --name "smartbill-api" -i max

# Serve Frontends using NGINX pointing to apps/*/dist
```

---

## 📖 Complete Code & Architecture Guide
For in-depth explanations of every route, controller, schema, and viva defense answers, see [`PROJECT_ARCHITECTURE_AND_CODE_GUIDE.md`](./PROJECT_ARCHITECTURE_AND_CODE_GUIDE.md).

---

## 📄 License
MIT License. Built with ❤️ for modern businesses.

