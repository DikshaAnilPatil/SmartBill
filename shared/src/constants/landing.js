import {
  Receipt,
  Package2,
  BarChart3,
  Users,
  Globe,
  Shield,
  Check,
  Star,
} from "lucide-react";

export const FEATURES = [
  {
    icon: Receipt,
    title: "Smart Invoicing",
    desc: "Generate GST-compliant invoices in seconds with customizable templates and auto-calculations.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Package2,
    title: "Inventory Management",
    desc: "Track stock in real-time with low-stock alerts, barcode scanning, and batch management.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: BarChart3,
    title: "Advanced Reports",
    desc: "P&L statements, GST reports, and 20+ business analytics with Excel/PDF export.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: Users,
    title: "Multi-User Access",
    desc: "Role-based access control for Owner, Manager, Cashier, and Accountant profiles.",
    color: "bg-amber-50 text-amber-600",
  },
];

export const PLANS = [
  {
    name: "Starter",
    price: 999,
    period: "/month",
    color: "border-slate-200",
    badge: null,
    features: [
      "1 Business",
      "2 Users",
      "500 Invoices/month",
      "500 Customers",
      "500 Products",
      "Basic Reports and inventory",
    ],
  },
  {
    name: "Pro",
    price: 2499,
    period: "/month",
    color: "border-blue-500",
    badge: "Most Popular",
    features: [
      "3 Businesses",
      "10 Users",
      "Unlimited Invoices",
      "5,000 Customers and 5,000 Products",
      "Advanced and GST Reports",
      "Advanced payment tracking, customization and stock alerts",
      "Purchase management",
    ],
  },
  {
    name: "Enterprise",
    price: 6999,
    period: "/month",
    color: "border-slate-200",
    badge: null,
    features: [
      "Unlimited Businesses",
      "Unlimited Users",
      "Unlimited invoices, products and customers",
      "All reports and inventory tools",
      "Full payment tracking, customization and stock monitoring",
    ],
  },
];

export const TESTIMONIALS = [
  {
    name: "Vikram Sharma",
    role: "Owner, Sharma Electronics, Mumbai",
    text: "BillTrack Pro transformed how we manage inventory. We reduced stockouts by 80% and invoice errors are practically zero.",
    avatar: "VS",
    rating: 5,
  },
  {
    name: "Nirmala Patel",
    role: "MD, Mumbai Textiles",
    text: "The GST reports alone saved us 30 hours a month. Our accountant loves the automatic reconciliation feature.",
    avatar: "NP",
    rating: 5,
  },
  {
    name: "Amar Singh",
    role: "Proprietor, Delhi Grocers",
    text: "Switched from Tally and never looked back. The mobile-friendly POS is a game changer for our retail operations.",
    avatar: "AS",
    rating: 5,
  },
];



