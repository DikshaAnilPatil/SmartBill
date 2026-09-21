import React from "react";
import InvoiceRenderer from "../invoice/InvoiceRenderer";

export default function InvoicePreview({ settings, businessInfo, invoiceData, scale = 0.75 }) {
  return (
    <div className="bg-slate-100 dark:bg-slate-950 rounded-2xl p-4 flex justify-center overflow-x-auto overflow-y-auto max-h-[calc(100vh-200px)] items-start">
      <InvoiceRenderer
        settings={settings}
        businessInfo={businessInfo}
        invoiceData={invoiceData}
        scale={scale}
      />
    </div>
  );
}
