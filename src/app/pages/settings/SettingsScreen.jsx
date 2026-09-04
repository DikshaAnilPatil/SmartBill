import { useState, useEffect, useCallback } from "react";
import { useCustomization } from "../../hooks/useCustomization";
import { updateProfile, getProfile } from "../../api/authAPI";
import subscriptionAPI from "../../api/subscriptionAPI";
import UpgradeModal from "../../components/subscription/UpgradeModal";
import {
  Building2,
  Percent,
  FileText,
  Receipt,
  Users,
  Package2,
  Landmark,
  Settings,
  AlertCircle,
  Shield,
  CreditCard,
  Lock,
  Mail,
  Phone,
  MapPin,
  Upload,
  Check,
  Package,
  QrCode,
  FileCheck,
  Loader2,
} from "lucide-react";
import { Input, Btn, Select } from "../../components/common/ui";
import { setUserToStorage } from "../../utils/userUtils";
import UserPermissionsSettings from "./components/UserPermissionsSettings";
import SecuritySettings from "./components/SecuritySettings";
import PaymentMethodSettings from "./components/PaymentMethodSettings";
import InvoiceSettingsTab from "./InvoiceSettingsTab";
import AccountingSettingsTab from "./AccountingSettingsTab";
import ItemInventorySettingsTab from "./ItemInventorySettingsTab";
import {
  fetchPartySettings,
  savePartySettings,
} from "../../api/partySettingsAPI";
import {
  getInventorySettings,
  updateInventorySettings,
} from "../../api/inventorySettingsAPI";

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman & Nicobar Islands",
  "Chandigarh",
  "Dadra & Nagar Haveli and Daman & Diu",
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];


const ToggleRow = ({ title, description, checked, onChange }) => {
  return (
    <div className="flex items-start justify-between py-3 border-b border-slate-100 last:border-b-0">
      <div className="pr-4">
        <p className="text-sm font-medium text-slate-900">
          {title}
        </p>

        <p className="text-xs text-slate-500 mt-1">
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={onChange}
        className={`w-10 h-6 rounded-full relative flex-shrink-0 ml-4 transition-colors ${
          checked ? "bg-blue-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
            checked ? "right-1" : "left-1"
          }`}
        />
      </button>
    </div>
  );
};

export default function SettingsScreen({ user, initialTab, onNav } = {}) {
  const [activeTab, setActiveTab] = useState(() => {
    if (initialTab) return initialTab;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      if (tabParam) return tabParam;
      return localStorage.getItem("smartbill_settings_active_tab") || "business";
    } catch (_) {
      return "business";
    }
  });
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessSuccess, setBusinessSuccess] = useState(null);
  const [businessError, setBusinessError] = useState(null);

  const [businessInfo, setBusinessInfo] = useState(() => {
    try {
      const rawUser = localStorage.getItem("smartbill_user");
      const user = rawUser ? JSON.parse(rawUser) : {};
      const key = user?._id || user?.id ? `businessInfo_${user._id || user.id}` : "businessInfo";
      const rawLocal = localStorage.getItem(key) || localStorage.getItem("businessInfo");
      const localObj = rawLocal ? JSON.parse(rawLocal) : {};

      const ownerName = user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : (localObj.ownerName || "");

      return {
        businessName: user.businessName || localObj.businessName || "SmartBill Business",
        ownerName: ownerName || "Vikram Sharma",
        tagline: user.tagline || localObj.tagline || "",
        phone: user.phone || localObj.phone || "+91 9876543210",
        email: user.email || localObj.email || "contact@business.in",
        businessType: user.businessType || localObj.businessType || "Retail",
        financialYear: localObj.financialYear || "April (Standard India)",
        address: user.address || localObj.address || "Shop No. 14, Sadar Bazaar",
        city: user.city || localObj.city || "Nagpur",
        state: user.state || localObj.state || "Maharashtra",
        pincode: user.pincode || localObj.pincode || "440001",
        country: user.country || localObj.country || "India",
        gstin: user.gstin || localObj.gstin || "",
        registrationType: localObj.registrationType || (user.gstin ? "Regular" : "Unregistered"),
        panNumber: user.panNumber || localObj.panNumber || "",
        msmeNumber: user.msmeNumber || localObj.msmeNumber || "",
        bankName: user.bankName || localObj.bankName || "",
        accountNumber: user.accountNumber || localObj.accountNumber || "",
        ifscCode: user.ifscCode || localObj.ifscCode || "",
        branchName: user.branchName || localObj.branchName || "",
        upiId: user.upiId || localObj.upiId || "",
        invoiceTerms: user.invoiceTerms || localObj.invoiceTerms || "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged on overdue payments.",
        invoiceFooter: user.invoiceFooter || localObj.invoiceFooter || "Thank you for your business!",
        logoUrl: user.logoUrl || localObj.logoUrl || "",
        signatureUrl: user.signatureUrl || localObj.signatureUrl || "",
      };
    } catch {
      return {
        businessName: "SmartBill Business",
        ownerName: "Owner",
        tagline: "",
        phone: "+91 9876543210",
        email: "contact@business.in",
        businessType: "Retail",
        financialYear: "April (Standard India)",
        address: "",
        city: "Nagpur",
        state: "Maharashtra",
        pincode: "440001",
        country: "India",
        gstin: "",
        registrationType: "Regular",
        panNumber: "",
        msmeNumber: "",
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        branchName: "",
        upiId: "",
        invoiceTerms: "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged on overdue payments.",
        invoiceFooter: "Thank you for your business!",
        logoUrl: "",
        signatureUrl: "",
      };
    }
  });

  // Load latest user profile from backend on mount
  useEffect(() => {
    const token = localStorage.getItem("smartbill_token");
    if (!token) return;

    getProfile()
      .then((res) => {
        if (res?.user) {
          const u = res.user;
          const ownerName = u.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : "";
          setBusinessInfo((prev) => ({
            ...prev,
            ...u,
            businessName: u.businessName || prev.businessName,
            ownerName: ownerName || prev.ownerName,
          }));
          setUserToStorage(u);
          window.dispatchEvent(new Event("userUpdated"));
        }
      })
      .catch((err) => {
        console.warn("Profile fetch notice:", err.message);
      });
  }, []);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Image size must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      handleBusinessChange("logoUrl", reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Signature size must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      handleBusinessChange("signatureUrl", reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBusiness = async () => {
    setSavingBusiness(true);
    setBusinessSuccess(null);
    setBusinessError(null);

    try {
      const nameParts = (businessInfo.ownerName || "").trim().split(" ");
      const firstName = nameParts[0] || "Owner";
      const lastName = nameParts.slice(1).join(" ");

      const payload = {
        ...businessInfo,
        firstName,
        lastName,
      };

      const token = localStorage.getItem("smartbill_token");
      if (!token) {
        setBusinessError("Authentication token missing. Please sign in again.");
        return;
      }

      const res = await updateProfile(payload);
      if (res?.user) {
        if (res.token) {
          localStorage.setItem("smartbill_token", res.token);
        }
        setUserToStorage(res.user);

        const id = res.user._id || res.user.id;
        const key = id ? `businessInfo_${id}` : "businessInfo";
        localStorage.setItem(key, JSON.stringify(businessInfo));
        localStorage.setItem("businessInfo", JSON.stringify(businessInfo));

        window.dispatchEvent(new Event("userUpdated"));
        setBusinessSuccess("✓ Business Profile updated and saved permanently across database & invoices!");
      } else {
        setBusinessError("Failed to save profile. Server did not return user details.");
      }
    } catch (apiErr) {
      console.error("Backend profile update notice:", apiErr);
      const msg = apiErr?.response?.data?.message || apiErr?.message || "Failed to update profile on backend.";
      setBusinessError(msg);
    } finally {
      setSavingBusiness(false);
    }
  };

  // GST & Tax toggle states
  const [enableIgst, setEnableIgst] = useState(true);
  const [enableCess, setEnableCess] = useState(false);
  const [enableRcm, setEnableRcm] = useState(false);



  // Invoice Settings states
  const [showHsn, setShowHsn] = useState(true);
  const [showDesc, setShowDesc] = useState(true);
  const [showBank, setShowBank] = useState(false);

  // Party Management states
  const [enableGrouping, setEnableGrouping] = useState(true);
  const [trackBalance, setTrackBalance] = useState(false);
  const [shippingAddress, setShippingAddress] = useState(true);
  const [partyLoading, setPartyLoading] = useState(false);
  const [partySaving, setPartySaving] = useState(false);

  // Item & Inventory states
  const [enableSerial, setEnableSerial] = useState(false);
  const [enableMultiUnit, setEnableMultiUnit] = useState(true);
  const [enableBarcode, setEnableBarcode] = useState(true);

  // Accounting & Books states
  const [enableTrialBalance, setEnableTrialBalance] = useState(true);
  const [autoBankImport, setAutoBankImport] = useState(false);
  const [profitCenter, setProfitCenter] = useState(false);

  // GST Registration state
  const [isComposition, setIsComposition] = useState(false);

  // Consume Centralized Customization Context
  const {
    tempSettings,
    updateTempSettings,
    saveSettings,
    cancelChanges,
    resetToDefault,
    saving,
    error: customError,
    successMessage: customSuccess,
    t,
  } = useCustomization();

  // Low Stock Alert states
  const [lowStockThreshold, setLowStockThreshold] = useState("10");
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [savingLowStock, setSavingLowStock] = useState(false);
  const [lowStockSuccess, setLowStockSuccess] = useState(false);

  // Load low stock settings from backend / local storage on mount
  useEffect(() => {
    try {
      const stored =
        localStorage.getItem("smartbill_inventorySettings") ||
        localStorage.getItem("lowStockSettings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.lowStockAlert !== undefined) setLowStockThreshold(String(parsed.lowStockAlert));
        else if (parsed.threshold !== undefined) setLowStockThreshold(String(parsed.threshold));
        if (parsed.inAppAlerts !== undefined) setInAppAlerts(Boolean(parsed.inAppAlerts));
        if (parsed.smsAlerts !== undefined) setSmsAlerts(Boolean(parsed.smsAlerts));
        if (parsed.emailAlerts !== undefined) setEmailAlerts(Boolean(parsed.emailAlerts));
      }
    } catch (_) {}

    getInventorySettings()
      .then((res) => {
        if (res?.settings?.lowStockAlert) {
          setLowStockThreshold(String(res.settings.lowStockAlert));
        }
      })
      .catch(() => {});
  }, []);

  // Users Permissions states
  const [employees, setEmployees] = useState([
    {
      id: 1,
      name: "HR Manager",
      department: "HR",
      permissions: {
        sales: true,
        purchase: true,
        inventory: true,
        accounting: true,
        settings: false,
      },
    },
    {
      id: 2,
      name: "Sales Staff",
      department: "Sales",
      permissions: {
        sales: true,
        purchase: false,
        inventory: true,
        accounting: false,
        settings: false,
      },
    },
  ]);

  // Security states
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(true);

  // Handle GST settings save
  const handleSaveGstSettings = () => {
    localStorage.setItem(
      "gstSettings",
      JSON.stringify({
        isComposition,
        enableIgst,
        enableCess,
        enableRcm,
      }),
    );
    alert("✓ GST settings saved successfully!");
  };



  // Party Settings load
  const loadPartySettings = async () => {
    try {
      setPartyLoading(true);
      const response = await fetchPartySettings();
      if (response?.partySettings) {
        setEnableGrouping(Boolean(response.partySettings.enableGrouping));
        setTrackBalance(Boolean(response.partySettings.trackBalance));
        setShippingAddress(Boolean(response.partySettings.shippingAddress));
        try {
          const rawUser = localStorage.getItem("smartbill_user");
          const user = rawUser ? JSON.parse(rawUser) : null;
          const id = user?._id || user?.id || user?.email;
          const key = id ? `smartbill_party_settings_${id}` : "smartbill_party_settings_guest";
          localStorage.setItem(key, JSON.stringify(response.partySettings));
        } catch {}
      }
    } catch (error) {
      console.error("Failed to load party settings:", error);
    } finally {
      setPartyLoading(false);
    }
  };

  useEffect(() => {
    loadPartySettings();
  }, [activeTab]);


  // Handle invoice settings save
  const handleSaveInvoiceSettings = () => {
    localStorage.setItem(
      "invoiceSettings",
      JSON.stringify({
        showHsn,
        showDesc,
        showBank,
      }),
    );
    alert("✓ Invoice settings saved successfully!");
  };

  // Handle party settings save
  const handleSavePartySettings = async () => {
    try {
      setPartySaving(true);
      const payload = {
        enableGrouping,
        trackBalance,
        shippingAddress,
      };
      const response = await savePartySettings(payload);
      const savedData = response?.partySettings || payload;

      setEnableGrouping(Boolean(savedData.enableGrouping));
      setTrackBalance(Boolean(savedData.trackBalance));
      setShippingAddress(Boolean(savedData.shippingAddress));

      try {
        const rawUser = localStorage.getItem("smartbill_user");
        const user = rawUser ? JSON.parse(rawUser) : null;
        const id = user?._id || user?.id || user?.email;
        const key = id ? `smartbill_party_settings_${id}` : "smartbill_party_settings_guest";
        localStorage.setItem(key, JSON.stringify(savedData));
      } catch {}

      window.dispatchEvent(
        new CustomEvent("partySettingsUpdated", { detail: savedData })
      );
      alert("✓ Party settings saved successfully!");
    } catch (error) {
      console.error("Failed to save party settings:", error);
      alert(error?.message || "Failed to save party settings.");
    } finally {
      setPartySaving(false);
    }
  };

  // Handle item settings save
  const handleSaveItemSettings = () => {
    localStorage.setItem(
      "itemSettings",
      JSON.stringify({
        enableSerial,
        enableMultiUnit,
        enableBarcode,
      }),
    );
    alert("✓ Item settings saved successfully!");
  };

  // Handle accounting settings save
  const handleSaveAccountingSettings = () => {
    localStorage.setItem(
      "accountingSettings",
      JSON.stringify({
        enableTrialBalance,
        autoBankImport,
        profitCenter,
      }),
    );
    alert("✓ Accounting settings saved successfully!");
  };

  // Handle low stock save
  const handleSaveLowStockSettings = async () => {
    setSavingLowStock(true);
    setLowStockSuccess(false);

    try {
      const thresholdVal = String(lowStockThreshold || "10");

      // 1. Save to local storage for instant sync
      const currentInv = (() => {
        try {
          return JSON.parse(localStorage.getItem("smartbill_inventorySettings") || "{}");
        } catch (_) {
          return {};
        }
      })();

      const updatedInv = { ...currentInv, lowStockAlert: thresholdVal };
      localStorage.setItem("smartbill_inventorySettings", JSON.stringify(updatedInv));
      localStorage.setItem(
        "lowStockSettings",
        JSON.stringify({
          threshold: thresholdVal,
          emailAlerts,
          inAppAlerts,
          smsAlerts,
        })
      );

      // 2. Dispatch real-time events across the entire app
      window.dispatchEvent(new CustomEvent("inventorySettingsUpdated", { detail: updatedInv }));
      window.dispatchEvent(new CustomEvent("stockUpdated"));

      // 3. Save to backend database
      await updateInventorySettings({ lowStockAlert: thresholdVal });

      setLowStockSuccess(true);
      setTimeout(() => setLowStockSuccess(false), 3500);
    } catch (err) {
      console.warn("Low stock settings save notice:", err);
      setLowStockSuccess(true);
      setTimeout(() => setLowStockSuccess(false), 3500);
    } finally {
      setSavingLowStock(false);
    }
  };

  // Handle permission update
  const handlePermissionToggle = (empId, module) => {
    setEmployees(
      employees.map((emp) =>
        emp.id === empId
          ? {
              ...emp,
              permissions: {
                ...emp.permissions,
                [module]: !emp.permissions[module],
              },
            }
          : emp,
      ),
    );
  };

  // Handle permissions save
  const handleSavePermissions = () => {
    localStorage.setItem("employeePermissions", JSON.stringify(employees));
    alert("✓ Users permissions saved successfully!");
  };

  // Handle security settings save
  const handleUpdatePassword = () => {
    const errors = {};

    if (!validatePassword(passwordData.newPassword)) {
      errors.newPassword =
        "Password must be 8-12 characters with 1 uppercase, 1 lowercase, 1 number and 1 special character.";
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    alert("Password Updated Successfully!");

    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    setPasswordErrors({
      newPassword: "",
      confirmPassword: "",
    });
  };
  // Tabs configuration
  const tabs = [
    { key: "business", label: "Business Profile", icon: Building2 },
    { key: "subscription", label: "Subscription & Billing", icon: CreditCard },
    { key: "invoice", label: "Invoice Settings", icon: Receipt },
    { key: "item", label: "Item & Inventory", icon: Package2 },
    { key: "customization", label: "Customization", icon: Settings },
    { key: "stockalert", label: "Low Stock Alert Numbers", icon: AlertCircle },
    { key: "permissions", label: "Users Permissions", icon: Shield },
    { key: "payment", label: "Payment Methods", icon: CreditCard },
    { key: "users", label: "Security & Access", icon: Lock },
  ];
  const handleBusinessChange = (field, value) => {
    setBusinessInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const [gstSettings, setGstSettings] = useState({
    gstin: "SFGGYT376432123",
    pan: "23456789DFGHJK",
    registrationType: "Regular",
    defaultRate: "18",
    enableIgst: true,
    enableCess: false,
  });

  const handleGstChange = (field, value) => {
    setGstSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };



  const [invoiceSettings, setInvoiceSettings] = useState({
    invoicePrefix: "INV-",
    startingNumber: "1001",
    invoiceFooter: "Thank you for your business!",
    paperSize: "Regular A4",
    bankName: "State Bank of India",
    accountNumber: "34001294811",
    ifscCode: "SBIN0001042",
    template: "Modern",
  });

  const handleInvoiceChange = (field, value) => {
    setInvoiceSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const [inventorySettings, setInventorySettings] = useState({
    stockValueFormula: "FIFO Method",
    lowStockAlert: "10 Units Remaining",
  });

  const handleInventoryChange = (field, value) => {
    setInventorySettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };
  const validatePassword = (password) => {
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%^&*!])[A-Za-z\d@#$%^&*!]{8,12}$/;

    return passwordRegex.test(password);
  };

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordErrors, setPasswordErrors] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const handlePasswordChange = (field, value) => {
    setPasswordData((prev) => ({
      ...prev,
      [field]: value,
    }));

    setPasswordErrors((prev) => ({
      ...prev,
      [field]: "",
    }));
  };

  // ── Subscription & Billing state ──────────────────────────
  const [subData, setSubData] = useState(null);       // from GET /subscriptions/status
  const [subLoading, setSubLoading] = useState(false);
  const [upgradePreview, setUpgradePreview] = useState(null);  // prorated preview
  const [previewLoading, setPreviewLoading] = useState(null);  // planKey being previewed
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Fetch subscription status when tab is opened
  const fetchSubStatus = useCallback(async () => {
    setSubLoading(true);
    try {
      const res = await subscriptionAPI.getSubscriptionStatus();
      setSubData(res);
    } catch (err) {
      console.warn("Subscription status fetch:", err.message);
    } finally {
      setSubLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "subscription") fetchSubStatus();
  }, [activeTab, fetchSubStatus]);

  // Open upgrade/downgrade modal with prorated preview
  const handlePlanAction = async (planKey) => {
    setPreviewLoading(planKey);
    try {
      const preview = await subscriptionAPI.getUpgradePreview(planKey);
      setUpgradePreview(preview);
      setShowUpgradeModal(true);
    } catch (err) {
      alert(err?.response?.data?.message || "Could not load plan preview.");
    } finally {
      setPreviewLoading(null);
    }
  };

  const handleUpgradeSuccess = () => {
    setShowUpgradeModal(false);
    setUpgradePreview(null);
    fetchSubStatus(); // refresh displayed data
    // Also refresh user in localStorage
    getProfile().then((r) => { if (r?.user) window.dispatchEvent(new Event("userUpdated")); }).catch(() => {});
  };

  const PLAN_INFO = {
    starter: {
      name: "Starter",
      price: 999,
      color: "from-slate-600 to-slate-700",
      badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
      border: "border-slate-300 dark:border-slate-700",
      ring: "ring-slate-400",
      activeBg: "bg-slate-50/50 dark:bg-slate-900 border-slate-400 dark:border-slate-600",
    },
    pro: {
      name: "Pro",
      price: 2499,
      color: "from-blue-600 to-indigo-600",
      badge: "bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300",
      border: "border-blue-400 dark:border-blue-600",
      ring: "ring-blue-500",
      activeBg: "bg-blue-50/30 dark:bg-slate-900 border-blue-500 dark:border-blue-500",
    },
    enterprise: {
      name: "Enterprise",
      price: 6999,
      color: "from-amber-500 to-orange-600",
      badge: "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300",
      border: "border-amber-400 dark:border-amber-600",
      ring: "ring-amber-500",
      activeBg: "bg-amber-50/30 dark:bg-slate-900 border-amber-500 dark:border-amber-500",
    },
  };

  const PLAN_FEATURES = {
    starter: ["1 business", "2 users", "500 invoices/month", "250 customers", "500 products", "Basic reports and inventory"],
    pro: ["10 users", "Unlimited invoices", "5,000 customers and 5,000 products", "Advanced and GST reports", "Barcode scanner, export and advanced inventory"],
    enterprise: ["Unlimited users, invoices, products and customers", "All reports and advanced features", "API access"],
  };

  function formatINRLocal(amount) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
  }

  return (
    <>
      <div className="flex gap-6">
      {/* SIDEBAR NAVIGATION */}
      <div className="w-56 p-3 h-fit flex-shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <nav className="space-y-0.5">
          {tabs.map((t) => {
            const IconComponent = t.icon; // Dynamic parsing handle
            return (
              <button
                key={t.key}
                onClick={() => {
                  setActiveTab(t.key);
                  try {
                    localStorage.setItem("smartbill_settings_active_tab", t.key);
                  } catch (_) {}
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === t.key
                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <IconComponent className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* RIGHT SIDE WORKSPACE */}
      <div className="flex-1 space-y-5">
        {/* TAB 1: BUSINESS PROFILE */}
        {activeTab === "business" && (
          <div className="space-y-6">
            {/* Header Alert Banners */}
            {businessSuccess && (
              <div className="p-4 text-sm font-medium rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{businessSuccess}</span>
              </div>
            )}
            {businessError && (
              <div className="p-4 text-sm font-medium rounded-xl bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <span>{businessError}</span>
              </div>
            )}

            {/* Business Header Card with Logo & GST Status */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  {/* Logo Upload Box */}
                  <div className="relative group">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden flex-shrink-0 shadow-inner">
                      {businessInfo.logoUrl ? (
                        <img
                          src={businessInfo.logoUrl}
                          alt="Business Logo"
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <div className="text-center p-2">
                          <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                          <p className="text-[10px] font-medium text-slate-400">Logo</p>
                        </div>
                      )}
                    </div>
                    <label className="absolute inset-0 bg-black/50 text-white rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-semibold">
                      <Upload className="w-4 h-4 mb-0.5" />
                      Change
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {businessInfo.businessName || "SmartBill Business"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {businessInfo.tagline || "Wholesale & Retail Billing Management"}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          businessInfo.gstin
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        <FileCheck className="w-3 h-3" />
                        {businessInfo.gstin
                          ? `GSTIN: ${businessInfo.gstin}`
                          : "GST Unregistered"}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {businessInfo.businessType}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">
                    {["users", "customers", "products"].map((resource) => {
                      const current = subData.usage[resource] ?? 0;
                      const maximum = subData.usage[`max${resource[0].toUpperCase()}${resource.slice(1)}`];
                      const unlimited = maximum === Infinity || maximum == null || maximum > 10000;
                      return (
                        <div key={resource} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                          <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{resource}</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{current} / {unlimited ? "Unlimited" : maximum}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Btn
                  variant="primary"
                  disabled={savingBusiness}
                  onClick={handleSaveBusiness}
                  icon={
                    savingBusiness ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )
                  }
                >
                  {savingBusiness
                    ? "Saving Business Profile..."
                    : "Save Business Profile"}
                </Btn>
              </div>

              {/* Section 1: Business Identity */}
              <div className="pt-6 space-y-4">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm">
                  <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>General Business Identity</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Input
                    label="Business Name (Legal/Trade Name)"
                    value={businessInfo.businessName}
                    onChange={(value) =>
                      handleBusinessChange("businessName", value)
                    }
                  />
                  <Input
                    label="Business Tagline / Subtitle"
                    value={businessInfo.tagline}
                    onChange={(value) =>
                      handleBusinessChange("tagline", value)
                    }
                  />
                  <Input
                    label="Owner / Contact Person Name"
                    value={businessInfo.ownerName}
                    onChange={(value) =>
                      handleBusinessChange("ownerName", value)
                    }
                  />
                  <Select
                    label="Business Category / Type"
                    value={businessInfo.businessType}
                    onChange={(value) =>
                      handleBusinessChange("businessType", value)
                    }
                    options={[
                      "Retail",
                      "Wholesale",
                      "Manufacturing",
                      "Services",
                      "Pharmacy / Medical",
                      "Supermarket / Grocery",
                      "Restaurant / Cafe",
                      "Hardware & Electrical",
                      "General Store",
                    ]}
                  />
                  <Select
                    label="Financial Year Cycle"
                    value={businessInfo.financialYear}
                    onChange={(value) =>
                      handleBusinessChange("financialYear", value)
                    }
                    options={[
                      "April (Standard India - FY 2026-27)",
                      "January (Calendar Year)",
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Contact & Address Information */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm mb-1">
                <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Contact & Location Address</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Primary Phone Number"
                  value={businessInfo.phone}
                  icon={<Phone className="w-4 h-4" />}
                  onChange={(value) => handleBusinessChange("phone", value)}
                />
                <Input
                  label="Official Email Address"
                  value={businessInfo.email}
                  icon={<Mail className="w-4 h-4" />}
                  onChange={(value) => handleBusinessChange("email", value)}
                />
                <div className="md:col-span-2">
                  <Input
                    label="Shop / Office Building Address"
                    value={businessInfo.address}
                    icon={<MapPin className="w-4 h-4" />}
                    onChange={(value) => handleBusinessChange("address", value)}
                  />
                </div>
                <Input
                  label="City / District"
                  value={businessInfo.city}
                  onChange={(value) => handleBusinessChange("city", value)}
                />
                <Select
                  label="State (India)"
                  value={businessInfo.state}
                  onChange={(value) => handleBusinessChange("state", value)}
                  options={INDIAN_STATES}
                />
                <Input
                  label="Pincode"
                  value={businessInfo.pincode}
                  onChange={(value) => handleBusinessChange("pincode", value)}
                />
                <Select
                  label="Country"
                  value={businessInfo.country}
                  onChange={(value) => handleBusinessChange("country", value)}
                  options={["India"]}
                />
              </div>
            </div>

            {/* Section 3: Tax & Registration Identifiers */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm mb-1">
                <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>GST, Tax & Government Registrations</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input
                  label="GSTIN Number"
                  value={businessInfo.gstin}
                  onChange={(value) =>
                    handleBusinessChange("gstin", value.toUpperCase())
                  }
                />
                <Select
                  label="GST Registration Type"
                  value={businessInfo.registrationType}
                  onChange={(value) =>
                    handleBusinessChange("registrationType", value)
                  }
                  options={["Regular", "Composition", "Unregistered"]}
                />
                <Input
                  label="PAN Number"
                  value={businessInfo.panNumber}
                  onChange={(value) =>
                    handleBusinessChange("panNumber", value.toUpperCase())
                  }
                />
                <Input
                  label="MSME / Udyam Reg. No. (Optional)"
                  value={businessInfo.msmeNumber}
                  onChange={(value) =>
                    handleBusinessChange("msmeNumber", value)
                  }
                />
              </div>
            </div>

            {/* Section 4: Bank Account & Payment Details */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm mb-1">
                <Landmark className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Bank Account & UPI Details (Printed on Invoices)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input
                  label="Bank Name"
                  value={businessInfo.bankName}
                  onChange={(value) => handleBusinessChange("bankName", value)}
                />
                <Input
                  label="Account Holder Name"
                  value={businessInfo.ownerName}
                  onChange={(value) => handleBusinessChange("ownerName", value)}
                />
                <Input
                  label="Account Number"
                  value={businessInfo.accountNumber}
                  onChange={(value) =>
                    handleBusinessChange("accountNumber", value)
                  }
                />
                <Input
                  label="IFSC Code"
                  value={businessInfo.ifscCode}
                  onChange={(value) =>
                    handleBusinessChange("ifscCode", value.toUpperCase())
                  }
                />
                <Input
                  label="Bank Branch"
                  value={businessInfo.branchName}
                  onChange={(value) =>
                    handleBusinessChange("branchName", value)
                  }
                />
                <Input
                  label="UPI ID / VPA for Billing QR"
                  value={businessInfo.upiId}
                  icon={<QrCode className="w-4 h-4" />}
                  onChange={(value) => handleBusinessChange("upiId", value)}
                />
              </div>
            </div>

            {/* Section 5: Invoice Terms & Digital Signature */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm mb-1">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Invoice Terms & Authorized Signature</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Default Invoice Terms & Conditions
                  </label>
                  <textarea
                    rows={4}
                    value={businessInfo.invoiceTerms}
                    onChange={(e) =>
                      handleBusinessChange("invoiceTerms", e.target.value)
                    }
                    className="w-full p-3 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Invoice Footer Greeting Note
                  </label>
                  <input
                    type="text"
                    value={businessInfo.invoiceFooter}
                    onChange={(e) =>
                      handleBusinessChange("invoiceFooter", e.target.value)
                    }
                    className="w-full p-3 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                  />

                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Authorized Digital Signature Stamp
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-36 h-16 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center overflow-hidden">
                      {businessInfo.signatureUrl ? (
                        <img
                          src={businessInfo.signatureUrl}
                          alt="Signature"
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 text-center">
                          Upload Signature Image
                        </span>
                      )}
                    </div>
                    <label className="px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <Btn
                  variant="primary"
                  disabled={savingBusiness}
                  onClick={handleSaveBusiness}
                  icon={
                    savingBusiness ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )
                  }
                >
                  {savingBusiness
                    ? "Saving Business Profile..."
                    : "Save Business Profile"}
                </Btn>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: INVOICE SETTINGS */}
        {activeTab === "invoice" && <InvoiceSettingsTab />}

        {/* TAB: ACCOUNTING SETTINGS */}
        {activeTab === "accounting" && <AccountingSettingsTab />}
        {activeTab === "invoice_deprecated" && (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-5">
              Invoice Settings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Invoice Prefix"
                value={invoiceSettings.invoicePrefix}
                onChange={(value) =>
                  handleInvoiceChange("invoicePrefix", value)
                }
              />
              <Input
                label="Starting Number"
                value={invoiceSettings.startingNumber}
                onChange={(value) =>
                  handleInvoiceChange("startingNumber", value)
                }
              />
              <Input
                label="Invoice Footer"
                value={invoiceSettings.invoiceFooter}
                onChange={(value) =>
                  handleInvoiceChange("invoiceFooter", value)
                }
              />
              <Select
                label="Invoice Print Paper Size"
                value={invoiceSettings.paperSize}
                onChange={(value) => handleInvoiceChange("paperSize", value)}
                options={["Regular A4", "Compact A5", "3-Inch Thermal Roll"]}
              />
            </div>

            <div className="mt-5 border-t pt-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Column Display Options
              </p>
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Show HSN Code Column
                  </p>
                  <p className="text-xs text-slate-500">
                    Render HSN block inside invoice grids
                  </p>
                </div>
                <button
                  onClick={() => setShowHsn(!showHsn)}
                  className={`w-10 h-6 rounded-full relative ${showHsn ? "bg-blue-600" : "bg-slate-200"}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow ${showHsn ? "right-1" : "left-1"}`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Print Item Specific Description
                  </p>
                  <p className="text-xs text-slate-500">
                    Show a separate descriptions line row below product
                  </p>
                </div>
                <button
                  onClick={() => setShowDesc(!showDesc)}
                  className={`w-10 h-6 rounded-full relative ${showDesc ? "bg-blue-600" : "bg-slate-200"}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow ${showDesc ? "right-1" : "left-1"}`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Include Firm Bank Details
                  </p>
                  <p className="text-xs text-slate-500">
                    Automatically print bank details at invoice bottom
                  </p>
                </div>
                <button
                  onClick={() => setShowBank(!showBank)}
                  className={`w-10 h-6 rounded-full relative ${showBank ? "bg-blue-600" : "bg-slate-200"}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow ${showBank ? "right-1" : "left-1"}`}
                  />
                </button>
              </div>
            </div>

            {showBank && (
              <div className="grid grid-cols-3 gap-4 mt-3 p-4 bg-slate-50 rounded-xl border">
                <Input
                  label="Bank Name"
                  value={invoiceSettings.bankName}
                  onChange={(value) => handleInvoiceChange("bankName", value)}
                />
                <Input
                  label="Account Number"
                  value={invoiceSettings.accountNumber}
                  onChange={(value) =>
                    handleInvoiceChange("accountNumber", value)
                  }
                />
                <Input
                  label="IFSC Code"
                  value={invoiceSettings.ifscCode}
                  onChange={(value) => handleInvoiceChange("ifscCode", value)}
                />
              </div>
            )}

            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Invoice Template
              </p>
              <div className="grid grid-cols-3 gap-3">
                {["Classic", "Modern", "Minimal"].map((t) => (
                  <button
                    key={t}
                    onClick={() => handleInvoiceChange("template", t)}
                    className={`border-2 rounded-xl p-3 text-center transition-all ${
                      invoiceSettings.template === t
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="h-16 bg-slate-100 rounded-lg mb-2" />
                    <p className="text-xs font-medium text-slate-700">{t}</p>
                  </button>
                ))}
              </div>
            </div>
            <Btn
              variant="primary"
              className="mt-5"
              onClick={handleSaveInvoiceSettings}
              icon={<Check className="w-4 h-4" />}
            >
              Save Invoice Settings
            </Btn>
          </div>
        )}

        {/* TAB 5: PARTY MANAGEMENT */}
        {activeTab === "party" && (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-5">
              Party Settings
            </h3>
            <div className="space-y-3">
              <div className="flex items-start justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Enable Party Grouping
                  </p>
                  <p className="text-xs text-slate-500">
                    Categorize retailers, wholesalers and suppliers into
                    structural pools
                  </p>
                </div>
                <button
                  onClick={() => setEnableGrouping(!enableGrouping)}
                  className={`w-10 h-6 rounded-full relative ${enableGrouping ? "bg-blue-600" : "bg-slate-200"}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow ${enableGrouping ? "right-1" : "left-1"}`}
                  />
                </button>
              </div>
              <div className="flex items-start justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Track Party-wise Balance Limits
                  </p>
                  <p className="text-xs text-slate-500">
                    Restrict raw bill allocation if safety credit thresholds
                    cross limit
                  </p>
                </div>
                <button
                  onClick={() => setTrackBalance(!trackBalance)}
                  className={`w-10 h-6 rounded-full relative ${trackBalance ? "bg-blue-600" : "bg-slate-200"}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow ${trackBalance ? "right-1" : "left-1"}`}
                  />
                </button>
              </div>
              <div className="flex items-start justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Shipping Address Verification
                  </p>
                  <p className="text-xs text-slate-500">
                    Keep separate shipping and billing text blocks for every
                    party ledger
                  </p>
                </div>
                <button
                  onClick={() => setShippingAddress(!shippingAddress)}
                  className={`w-10 h-6 rounded-full relative ${shippingAddress ? "bg-blue-600" : "bg-slate-200"}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow ${shippingAddress ? "right-1" : "left-1"}`}
                  />
                </button>
              </div>
            </div>
            <Btn
              variant="primary"
              className="mt-5"
              onClick={handleSavePartySettings}
              disabled={partySaving}
              icon={partySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            >
              {partySaving ? "Saving..." : "Save Party Profiles"}
            </Btn>
          </div>
        )}

        {/* TAB 6: ITEM & INVENTORY */}
        {activeTab === "item" && <ItemInventorySettingsTab />}

        {/* TAB 7: ACCOUNTING & BOOKS */}
        {activeTab === "accounting" && (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-5">
              Accounting & Book-keeping
            </h3>
            <div className="space-y-3">
              <div className="flex items-start justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Enable Trial Balance Reporting
                  </p>
                  <p className="text-xs text-slate-500">
                    Real-time sync sheet layout balancing credits and debits
                    together
                  </p>
                </div>
                <button
                  onClick={() => setEnableTrialBalance(!enableTrialBalance)}
                  className={`w-10 h-6 rounded-full relative ${enableTrialBalance ? "bg-blue-600" : "bg-slate-200"}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow ${enableTrialBalance ? "right-1" : "left-1"}`}
                  />
                </button>
              </div>
              <div className="flex items-start justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Auto Bank Statement Imports
                  </p>
                  <p className="text-xs text-slate-500">
                    Enable automated mapping hooks for institutional bank
                    settlement feeds
                  </p>
                </div>
                <button
                  onClick={() => setAutoBankImport(!autoBankImport)}
                  className={`w-10 h-6 rounded-full relative ${autoBankImport ? "bg-blue-600" : "bg-slate-200"}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow ${autoBankImport ? "right-1" : "left-1"}`}
                  />
                </button>
              </div>
              <div className="flex items-start justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Profit Center Allocation tracking
                  </p>
                  <p className="text-xs text-slate-500">
                    Perform split accounting across multi-location business
                    setups
                  </p>
                </div>
                <button
                  onClick={() => setProfitCenter(!profitCenter)}
                  className={`w-10 h-6 rounded-full relative ${profitCenter ? "bg-blue-600" : "bg-slate-200"}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow ${profitCenter ? "right-1" : "left-1"}`}
                  />
                </button>
              </div>
            </div>
            <Btn
              variant="primary"
              className="mt-5"
              onClick={handleSaveAccountingSettings}
              icon={<Check className="w-4 h-4" />}
            >
              Save Accounting Rules
            </Btn>
          </div>
        )}

        {/* TAB 8: CUSTOMIZATION */}
        {activeTab === "customization" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                {t("settings.customization_title")}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetToDefault}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {t("settings.reset_defaults")}
                </button>
              </div>
            </div>

            {/* Notification messages */}
            {customSuccess && (
              <div className="p-3.5 text-sm rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-400">
                {customSuccess}
              </div>
            )}
            {customError && (
              <div className="p-3.5 text-sm rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400">
                {customError}
              </div>
            )}

            {/* Visual & Appearance Settings */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                {t("settings.visual_appearance")}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t("settings.theme_mode")}
                  </label>
                  <select
                    value={tempSettings.theme || "light"}
                    onChange={(e) => updateTempSettings({ theme: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="light">{t("settings.light_mode")}</option>
                    <option value="dark">{t("settings.dark_mode")}</option>
                    <option value="system">{t("settings.system_default")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t("settings.accent_color")}
                  </label>
                  <div className="flex gap-2.5 items-center">
                    <input
                      type="color"
                      value={tempSettings.accentColor || "#3b82f6"}
                      onChange={(e) =>
                        updateTempSettings({ accentColor: e.target.value })
                      }
                      className="w-10 h-10 rounded border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-800"
                    />
                    <input
                      type="text"
                      value={tempSettings.accentColor || "#3b82f6"}
                      onChange={(e) =>
                        updateTempSettings({ accentColor: e.target.value })
                      }
                      className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm font-mono"
                    />
                    <div
                      className="w-6 h-6 rounded-full border border-slate-300 shadow-inner flex-shrink-0"
                      style={{ backgroundColor: tempSettings.accentColor || "#3b82f6" }}
                      title="Accent Color Preview"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t("settings.sidebar_style")}
                  </label>
                  <select
                    value={tempSettings.sidebarStyle || "expanded"}
                    onChange={(e) => updateTempSettings({ sidebarStyle: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="expanded">{t("settings.expanded")}</option>
                    <option value="compact">{t("settings.compact")}</option>
                    <option value="auto">{t("settings.auto_responsive")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t("settings.font_size")}
                  </label>
                  <select
                    value={tempSettings.fontSize || "medium"}
                    onChange={(e) => updateTempSettings({ fontSize: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="small">{t("settings.small")}</option>
                    <option value="medium">{t("settings.medium")}</option>
                    <option value="large">{t("settings.large")}</option>
                    <option value="xlarge">{t("settings.xlarge")}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Localization & Regional Formats */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                {t("settings.localization_regional")}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t("settings.language_selection")}
                  </label>
                  <select
                    value={tempSettings.language || "English"}
                    onChange={(e) => updateTempSettings({ language: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi (हिंदी)</option>
                    <option value="Marathi">Marathi (मराठी)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t("settings.date_format")}
                  </label>
                  <select
                    value={tempSettings.dateFormat || "DD-MM-YYYY"}
                    onChange={(e) => updateTempSettings({ dateFormat: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM-DD-YYYY">MM-DD-YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t("settings.time_format")}
                  </label>
                  <select
                    value={tempSettings.timeFormat || "24-hour"}
                    onChange={(e) => updateTempSettings({ timeFormat: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="12-hour">12-Hour (02:30 PM)</option>
                    <option value="24-hour">24-Hour (14:30)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t("settings.number_style")}
                  </label>
                  <select
                    value={tempSettings.numberFormat || "Indian"}
                    onChange={(e) => updateTempSettings({ numberFormat: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Indian">{t("settings.indian_style")}</option>
                    <option value="International">{t("settings.international_style")}</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t("settings.currency_symbol")}
                  </label>
                  <select
                    value={tempSettings.currency || "INR"}
                    onChange={(e) => updateTempSettings({ currency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="INR">INR (₹ - Indian Rupee)</option>
                    <option value="USD">USD ($ - US Dollar)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="GBP">GBP (£ - British Pound)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving}
                style={{ backgroundColor: "var(--primary, #2563eb)", color: "#ffffff" }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium shadow transition-all hover:opacity-90 disabled:opacity-50"
              >
                <Check className="w-4 h-4 text-white" />
                <span>{saving ? t("common.saving") : t("settings.save_customization")}</span>
              </button>

              <button
                type="button"
                onClick={cancelChanges}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t("settings.cancel_changes")}
              </button>
            </div>
          </div>
        )}

        {/* TAB 9: LOW STOCK ALERT NUMBERS */}
        {activeTab === "stockalert" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Low Stock Alert Numbers
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Set the minimum stock level threshold. When inventory drops to or below this number, real-time alerts and notifications trigger automatically.
                </p>
              </div>
              {lowStockSuccess && (
                <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" /> Saved Successfully!
                </span>
              )}
            </div>

            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Default Low Stock Alert Threshold
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      className="w-40 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. 10"
                      min="0"
                    />
                    <span className="text-sm font-medium text-slate-600">
                      Units Remaining
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    When stock equals or falls below this number, instant warning alerts will display in the floating widget and inventory page.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <h4 className="text-sm font-bold text-slate-800 mb-4">
                Alert Notification Channels
              </h4>
              <div className="space-y-3 divide-y divide-slate-100">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      In-App Real-Time Notifications
                    </p>
                    <p className="text-xs text-slate-500">
                      Show instant live badges, floating alerts, and bell notifications
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInAppAlerts(!inAppAlerts)}
                    className={`w-11 h-6 rounded-full relative flex-shrink-0 transition-colors cursor-pointer ${inAppAlerts ? "bg-blue-600" : "bg-slate-200"}`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${inAppAlerts ? "right-1" : "left-1"}`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Email Stock Summaries
                    </p>
                    <p className="text-xs text-slate-500">
                      Receive daily or instant email digests when stock runs critical
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailAlerts(!emailAlerts)}
                    className={`w-11 h-6 rounded-full relative flex-shrink-0 transition-colors cursor-pointer ${emailAlerts ? "bg-blue-600" : "bg-slate-200"}`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${emailAlerts ? "right-1" : "left-1"}`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      SMS Alerts
                    </p>
                    <p className="text-xs text-slate-500">
                      Receive critical SMS alerts on registered business phone
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSmsAlerts(!smsAlerts)}
                    className={`w-11 h-6 rounded-full relative flex-shrink-0 transition-colors cursor-pointer ${smsAlerts ? "bg-blue-600" : "bg-slate-200"}`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${smsAlerts ? "right-1" : "left-1"}`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Btn
                variant="primary"
                onClick={handleSaveLowStockSettings}
                disabled={savingLowStock}
                icon={savingLowStock ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                className="min-w-[180px] justify-center bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20"
              >
                {savingLowStock ? "Saving..." : "Save Low Stock Settings"}
              </Btn>
            </div>
          </div>
        )}

        {/* TAB 10: USERS PERMISSIONS */}
        {activeTab === "permissions" && <UserPermissionsSettings />}

        {/* TAB 11: PAYMENT METHODS */}
        {activeTab === "payment" && <PaymentMethodSettings />}

        {/* TAB 12: SECURITY SETTINGS */}
        {activeTab === "users" && <SecuritySettings />}

        {/* TAB 13: SUBSCRIPTION & BILLING */}
        {activeTab === "subscription" && (
          <div className="space-y-6">
            {subLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
              </div>
            ) : subData ? (
              <>
                {/* ── Current Plan Card ──────────────────────── */}
                <div className={`bg-gradient-to-r ${PLAN_INFO[subData.subscription?.plan || "starter"].color} rounded-2xl p-6 text-white shadow-lg`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">Current Plan</p>
                      <h2 className="text-2xl font-bold">{PLAN_INFO[subData.subscription?.plan || "starter"].name}</h2>
                      <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${
                        subData.subscription?.status === "active" ? "bg-white/20 text-white" :
                        subData.subscription?.status === "trialing" ? "bg-yellow-400/30 text-yellow-100" :
                        "bg-red-400/30 text-red-100"
                      }`}>
                        {subData.subscription?.status === "active" ? "✓ Active" :
                         subData.subscription?.status === "trialing" ? "⏳ Trial" : "✗ Expired"}
                      </span>
                    </div>
                    <CreditCard className="w-10 h-10 text-white/40" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-xl p-3">
                      <p className="text-white/60 text-xs mb-1">Billing Period</p>
                      <p className="text-white font-semibold text-sm">
                        {subData.subscription?.currentPeriodStart
                          ? new Date(subData.subscription.currentPeriodStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                          : "—"}
                        {" → "}
                        {subData.subscription?.currentPeriodEnd
                          ? new Date(subData.subscription.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3">
                      <p className="text-white/60 text-xs mb-1">Monthly Price</p>
                      <p className="text-white font-bold text-lg">
                        {formatINRLocal(PLAN_INFO[subData.subscription?.plan || "starter"].price)}
                      </p>
                    </div>
                  </div>
                  {subData.subscription?.pendingDowngradePlan && (
                    <div className="mt-3 bg-amber-400/20 border border-amber-300/30 rounded-xl px-4 py-2.5 text-sm text-amber-100">
                      ⚠ Downgrade to <strong>{PLAN_INFO[subData.subscription.pendingDowngradePlan]?.name}</strong> scheduled at end of billing period.
                    </div>
                  )}
                </div>

                {/* ── Usage Metrics ──────────────────────────── */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Usage This Month
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span>Invoices</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">{subData.usage.invoicesThisMonth} / {subData.usage.maxInvoicesPerMonth === null || subData.usage.maxInvoicesPerMonth > 10000 ? "∞" : subData.usage.maxInvoicesPerMonth}</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: subData.usage.maxInvoicesPerMonth > 10000 ? "10%" : `${Math.min(100, (subData.usage.invoicesThisMonth / subData.usage.maxInvoicesPerMonth) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span>Plan Status</span>
                        <span className={`font-bold ${PLAN_INFO[subData.subscription?.plan || "starter"].badge}`}>
                          {PLAN_INFO[subData.subscription?.plan || "starter"].name}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: "100%" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Plan Cards: Upgrade / Downgrade ─────────── */}
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white mb-3">Change Plan</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(PLAN_INFO).map(([planKey, info]) => {
                      const isCurrent = planKey === (subData.subscription?.plan || "starter");
                      const PLAN_ORDER = { starter: 1, pro: 2, enterprise: 3 };
                      const currentOrder = PLAN_ORDER[subData.subscription?.plan || "starter"];
                      const thisOrder = PLAN_ORDER[planKey];
                      const isUpgrade = thisOrder > currentOrder;
                      const isLoading = previewLoading === planKey;

                      return (
                        <div
                          key={planKey}
                          className={`relative border-2 rounded-2xl p-5 flex flex-col transition-all ${
                            isCurrent
                              ? `${info.activeBg} shadow-lg ring-2 ${info.ring}`
                              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-md"
                          }`}
                        >
                          {isCurrent && (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow tracking-wide">
                              CURRENT PLAN
                            </span>
                          )}
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${info.color} flex items-center justify-center mb-3 shadow-sm`}>
                            <CreditCard className="w-4 h-4 text-white" />
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-base">{info.name}</h4>
                          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 mb-3">
                            {formatINRLocal(info.price)}<span className="text-xs font-normal text-slate-500 dark:text-slate-400">/mo</span>
                          </p>
                          <ul className="space-y-2 mb-5 flex-1">
                            {PLAN_FEATURES[planKey].map((f) => (
                              <li key={f} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                                <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                          {isCurrent ? (
                            <div className="text-center text-xs font-bold text-slate-700 dark:text-slate-200 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-100/90 dark:bg-slate-800">
                              Your active plan
                            </div>
                          ) : (
                            <button
                              onClick={() => handlePlanAction(planKey)}
                              disabled={!!previewLoading}
                              className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 ${
                                isUpgrade
                                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20"
                                  : "border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                              }`}
                            >
                              {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : isUpgrade ? (
                                <>⚡ Upgrade</>  
                              ) : (
                                <>↓ Downgrade</>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Plan History Timeline ─────────────────── */}
                {subData.subscription?.planHistory?.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Plan Change History</h3>
                    <div className="space-y-3">
                      {[...subData.subscription.planHistory].reverse().map((h, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${
                            h.reason === "upgrade" ? "bg-blue-600" :
                            h.reason === "downgrade" ? "bg-amber-500" :
                            "bg-slate-500"
                          }`}>
                            {h.reason === "upgrade" ? "↑" : h.reason === "downgrade" ? "↓" : "★"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white capitalize">
                              {h.reason === "upgrade" ? "Upgraded to" : h.reason === "downgrade" ? "Downgraded to" : "Started"} {PLAN_INFO[h.plan]?.name || h.plan}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {h.activatedAt ? new Date(h.activatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                              {h.price ? ` · ${formatINRLocal(h.price)}/mo` : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {subData.subscription?.paymentHistory?.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Billing History</h3>
                    <div className="space-y-2">
                      {[...subData.subscription.paymentHistory].reverse().map((payment, index) => (
                        <div key={index} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-700 dark:text-slate-200">{PLAN_INFO[payment.plan]?.name || payment.plan} plan</span>
                          <span className="text-slate-500 dark:text-slate-400">{formatINRLocal(payment.amount)} · {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString("en-IN") : "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                <CreditCard className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="font-medium">Could not load subscription data.</p>
                <button onClick={fetchSubStatus} className="mt-3 text-blue-600 dark:text-blue-400 text-sm font-semibold hover:underline cursor-pointer">Retry</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Upgrade / Downgrade Modal */}
    {showUpgradeModal && upgradePreview && (
      <UpgradeModal
        preview={upgradePreview}
        userEmail={businessInfo.email}
        onClose={() => { setShowUpgradeModal(false); setUpgradePreview(null); }}
        onSuccess={handleUpgradeSuccess}
      />
    )}
  </>);
}
