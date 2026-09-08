import React, { useState } from 'react';
import { Search, Book, CreditCard, Settings, Users, FileText, ChevronRight, ArrowLeft } from 'lucide-react';

import PublicNavbar from "@shared/components/common/PublicNavbar";
import { Link } from 'react-router-dom';

export default function HelpCenterPage() {
  const categories = [
    { title: "Getting Started", icon: <Book className="w-6 h-6 text-blue-600" />, count: "12 articles" },
    { title: "Billing & Subscriptions", icon: <CreditCard className="w-6 h-6 text-indigo-600" />, count: "8 articles" },
    { title: "Account Settings", icon: <Settings className="w-6 h-6 text-slate-600" />, count: "15 articles" },
    { title: "Team & Permissions", icon: <Users className="w-6 h-6 text-emerald-600" />, count: "6 articles" },
  ];

  const [expandedArticleId, setExpandedArticleId] = useState(null);

  const popular = [
    {
      id: 1,
      title: "How to set up GST and HSN codes for products?",
      content: "Setting up GST is crucial for compliant invoicing. Navigate to Settings > Accounting to enter your business GSTIN. Then, in your Products list, edit a product to set its HSN code and applicable tax rate (e.g., 5%, 12%, 18%, 28%). This will automatically apply the correct tax split (CGST/SGST or IGST) during invoicing."
    },
    {
      id: 2,
      title: "Managing Inventory and configuring Low Stock Alerts",
      content: "To enable low stock alerts, go to Settings > Item & Inventory and ensure 'Enable Low Stock Alerts' is checked. When creating or editing a product, set the 'Low Stock Threshold'. When your inventory dips below this number, you will receive a notification and see the item flagged in the Inventory Dashboard."
    },
    {
      id: 3,
      title: "Using the POS System for retail checkout",
      content: "The POS interface is optimized for speed. Add products to the cart, apply discounts, select the payment method (Cash/Card/UPI), and print the receipt in one seamless flow."
    },
    {
      id: 4,
      title: "Creating Purchase Orders and managing Suppliers",
      content: "Navigate to Transactions > Purchases to create a new Purchase Order. Select a supplier from your Contacts, add the required items, and send the PO via email. Once the goods are received, you can convert the PO into a Bill and automatically update your inventory stock levels."
    },
    {
      id: 5,
      title: "Exporting Sales and P&L Reports to Excel/PDF",
      content: "Smart Bill offers comprehensive reporting. Go to the Reports module to view your Sales, GST, and P&L statements. Use the date filters to select your desired period, and click the 'Export' button in the top right corner to download the report as a PDF or CSV file."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <PublicNavbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-900 to-indigo-900 pt-32 pb-24 px-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-8 tracking-tight">How can we help you?</h1>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search for articles, guides, and troubleshooting..." 
              className="w-full pl-14 pr-6 py-5 rounded-2xl bg-white shadow-xl text-lg text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/50 transition-all border-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="px-8 py-16 max-w-6xl mx-auto w-full -mt-10 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow cursor-pointer group flex flex-col items-start">
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {cat.icon}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">{cat.title}</h3>
              <p className="text-sm text-slate-500 font-medium">{cat.count}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Popular Articles */}
      <section className="px-8 pb-24 max-w-4xl mx-auto w-full flex-1">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Popular Articles</h2>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {popular.map((article) => (
            <div key={article.id} className="flex flex-col">
              <div 
                onClick={() => setExpandedArticleId(expandedArticleId === article.id ? null : article.id)}
                className={`p-5 flex items-center justify-between cursor-pointer group transition-colors ${expandedArticleId === article.id ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-3">
                  <FileText className={`w-5 h-5 transition-colors ${expandedArticleId === article.id ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-500'}`} />
                  <span className={`font-medium transition-colors ${expandedArticleId === article.id ? 'text-blue-700' : 'text-slate-700 group-hover:text-slate-900'}`}>{article.title}</span>
                </div>
                <ChevronRight className={`w-5 h-5 transition-all ${expandedArticleId === article.id ? 'rotate-90 text-blue-500' : 'text-slate-300 group-hover:text-blue-500'}`} />
              </div>
              {expandedArticleId === article.id && (
                <div className="pb-6 pt-2 pl-14 pr-6 text-slate-600 leading-relaxed bg-blue-50/30 text-sm">
                  {article.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>


    </div>
  );
}



