import { useState } from "react";
import {
  BarChart3,
  Download,
  Package,
  Percent,
  Printer,
  ShoppingCart,
  TrendingUp,
  Lock,
} from "lucide-react";
import PurchaseReport from "./PurchaseReport";
import ProfitLossReport from "./ProfitLossReport";
import GSTReport from "./GSTReport";
import InventoryReport from "./InventoryReport";
import SalesReport from "./SalesReport";
import { Btn } from "@shared/components/common/ui";
import { hasPlanFeature } from "@shared/utils/planPermissions";
import PlanFeatureLock from "@shared/components/common/PlanFeatureLock";
import { exportReportToExcel, printReportPDF } from "@shared/utils/reportExporter";
import { useReportData } from "./useReportData";

export default function ReportsScreen({ user }) {
  const [activeReport, setActiveReport] = useState("sales");
  const reportData = useReportData(); // live report data for export & print

  // Read user from localStorage if not passed via props
  const currentUser = user || (() => {
    try {
      return JSON.parse(localStorage.getItem("smartbill_user"));
    } catch {
      return null;
    }
  })();

  const canAccessPL = hasPlanFeature(currentUser, "advancedReports");
  const canAccessGST = hasPlanFeature(currentUser, "gstReports");

  const reportTypes = [
    { key: "sales", label: "Sales Report", icon: TrendingUp, locked: false },
    { key: "purchase", label: "Purchase Report", icon: ShoppingCart, locked: false },
    { key: "pl", label: "Profit & Loss", icon: BarChart3, locked: !canAccessPL, requiredFeature: "advancedReports" },
    { key: "gst", label: "GST Report", icon: Percent, locked: !canAccessGST, requiredFeature: "gstReports" },
    { key: "inventory", label: "Inventory Report", icon: Package, locked: false },
  ];

  const handleExportExcel = () => {
    exportReportToExcel(activeReport, reportData);
  };

  const handlePrintPDF = () => {
    printReportPDF(activeReport, reportData);
  };

  const renderActiveReport = () => {
    switch (activeReport) {
      case "sales":
        return <SalesReport />;
      case "purchase":
        return <PurchaseReport />;
      case "pl":
        return canAccessPL ? (
          <ProfitLossReport />
        ) : (
          <PlanFeatureLock
            user={currentUser}
            featureKey="advancedReports"
            title="Profit & Loss Statements Locked"
            description="Detailed Profit & Loss analytics and custom date range financial reporting are available on Pro and Enterprise plans."
          />
        );
      case "gst":
        return canAccessGST ? (
          <GSTReport />
        ) : (
          <PlanFeatureLock
            user={currentUser}
            featureKey="gstReports"
            title="GST Filing Reports Locked"
            description="Automated GSTR-1, GSTR-3B tax calculations and GST filing reports are available on Pro and Enterprise plans."
          />
        );
      case "inventory":
        return <InventoryReport />;
      default:
        return <SalesReport />;
    }
  };

  return (
    <div className="space-y-5 print:p-0">
      <div className="flex gap-2 flex-wrap items-center justify-between print:hidden">
        <div className="flex gap-2 flex-wrap">
          {reportTypes.map((r) => (
            <button
              key={r.key}
              onClick={() => setActiveReport(r.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeReport === r.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300"
              }`}
            >
              <r.icon className="w-4 h-4" />
              <span>{r.label}</span>
              {r.locked && (
                <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" />
                  PRO
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Btn
            variant="outline"
            size="md"
            icon={<Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            onClick={handleExportExcel}
            className="cursor-pointer font-medium"
          >
            Export Excel
          </Btn>
          <Btn
            variant="outline"
            size="md"
            icon={<Printer className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
            onClick={handlePrintPDF}
            className="cursor-pointer font-medium"
          >
            Print PDF
          </Btn>
        </div>
      </div>

      {renderActiveReport()}
    </div>
  );
}





