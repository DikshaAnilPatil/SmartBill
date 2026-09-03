import { useEffect, useState } from "react";
import {
  Settings,
  Package,
  Mail,
  MessageSquare,
  Plus,
  Lock,
  Loader2,
  Palette,
  Check,
  RotateCcw,
  Sliders,
  X,
} from "lucide-react";

import { Btn, Badge, Card, Toast } from "@shared/components/common/ui";
import adminAPI from "@shared/api/adminAPI";
import { useCustomization } from "@shared/hooks/useCustomization";

import {
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
} from "@shared/api/subscriptionPlanApi";

export default function SuperAdminSettingsScreen() {
  const [activeTab, setActiveTab] = useState("system");

  // Consume Centralized Customization Context
  const {
    tempSettings,
    updateTempSettings,
    saveSettings: saveCustomizationSettings,
    cancelChanges: cancelCustomizationChanges,
    resetToDefault: resetCustomizationToDefault,
    saving: savingCustomization,
    error: customError,
    successMessage: customSuccess,
    t,
  } = useCustomization();

  // System Settings states
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [autoBackup, setAutoBackup] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [backupFrequency, setBackupFrequency] = useState("daily");
  const [maxLoginAttempts, setMaxLoginAttempts] = useState("5");

  // Dynamic SMTP Server credentials (stored in MongoDB)
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");

  const [systemLoading, setSystemLoading] = useState(true);
  const [systemSaving, setSystemSaving] = useState(false);

  // Subscription Plans states
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [planError, setPlanError] = useState("");

  const featureLabels = {
  basicReports: "Basic Reports",
  emailSupport: "Email Support",
  advancedReports: "Advanced Reports",
  gstFiling: "GST Filing",
  prioritySupport: "Priority Support",
  barcodeScanner: "Barcode Scanner",
  apiAccess: "API Access",
  customIntegrations: "Custom Integrations",
  dedicatedManager: "Dedicated Manager",
};

const defaultFeatures = {
  basicReports: false,
  emailSupport: false,
  advancedReports: false,
  gstFiling: false,
  prioritySupport: false,
  barcodeScanner: false,
  apiAccess: false,
  customIntegrations: false,
  dedicatedManager: false,
};

const [newPlanName, setNewPlanName] =
  useState("");

const [newPlanPrice, setNewPlanPrice] =
  useState("");

const [newPlanBillingCycle, setNewPlanBillingCycle] =
  useState("monthly");

const [newPlanFeatures, setNewPlanFeatures] =
  useState(defaultFeatures);

const [newPlanStatus, setNewPlanStatus] =
  useState("active");

const [editingPlan, setEditingPlan] =
  useState(null);

const [editPlanName, setEditPlanName] =
  useState("");

const [editPlanPrice, setEditPlanPrice] =
  useState("");

const [editPlanBillingCycle, setEditPlanBillingCycle] =
  useState("monthly");

const [editPlanFeatures, setEditPlanFeatures] =
  useState(defaultFeatures);

const [editPlanStatus, setEditPlanStatus] =
  useState("active");

const [savingPlan, setSavingPlan] =
  useState(false);

const [deletingPlanId, setDeletingPlanId] =
  useState(null);

  // Support Settings states
  const [supportEmail, setSupportEmail] = useState("support@smartbill.com");
  const [supportPhone, setSupportPhone] = useState("+91-1800-123-4567");
  const [ticketSystem, setTicketSystem] = useState(true);
  const [liveChat, setLiveChat] = useState(true);
  const [knowledgeBase, setKnowledgeBase] = useState(true);

  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load System Settings
  useEffect(() => {
    const loadSystemSettings = async () => {
      try {
        setSystemLoading(true);

        const res = await adminAPI.getSystemSettings();

        if (res?.systemSettings) {
          setMaintenanceMode(Boolean(res.systemSettings.maintenanceMode));
          setAutoBackup(Boolean(res.systemSettings.autoBackup));
          setDebugMode(Boolean(res.systemSettings.debugMode));
          setBackupFrequency(res.systemSettings.backupFrequency || "daily");
          setMaxLoginAttempts(String(res.systemSettings.maxLoginAttempts ?? 5));
          setSmtpHost(res.systemSettings.smtpHost || "smtp.gmail.com");
          setSmtpPort(String(res.systemSettings.smtpPort ?? 587));
          setSmtpUser(res.systemSettings.smtpUser || "");
          setSmtpPass(res.systemSettings.smtpPass || "");
          setSmtpFrom(res.systemSettings.smtpFrom || "");
          if (Array.isArray(res.systemSettings.emailTemplates) && res.systemSettings.emailTemplates.length > 0) {
            setEmailTemplates(res.systemSettings.emailTemplates);
          }
        }
      } catch (err) {
        console.error("Failed to load system settings from MongoDB:", err);
      } finally {
        setSystemLoading(false);
      }
    };

    loadSystemSettings();
  }, []);

  // Load subscription plans when Plans tab opens
  useEffect(() => {
    if (activeTab === "plans") {
      loadSubscriptionPlans();
    }
  }, [activeTab]);

  // Save System Settings
  const handleSaveSystemSettings = async (overrides = {}) => {
    try {
      setSystemSaving(true);

      const payload = {
        maintenanceMode:
          overrides.maintenanceMode !== undefined
            ? overrides.maintenanceMode
            : maintenanceMode,

        autoBackup:
          overrides.autoBackup !== undefined
            ? overrides.autoBackup
            : autoBackup,

        debugMode:
          overrides.debugMode !== undefined
            ? overrides.debugMode
            : debugMode,

        backupFrequency:
          overrides.backupFrequency !== undefined
            ? overrides.backupFrequency
            : backupFrequency,

        maxLoginAttempts:
          overrides.maxLoginAttempts !== undefined
            ? overrides.maxLoginAttempts
            : parseInt(maxLoginAttempts, 10) || 5,

        smtpHost: overrides.smtpHost !== undefined ? overrides.smtpHost : smtpHost,
        smtpPort: overrides.smtpPort !== undefined ? parseInt(overrides.smtpPort, 10) || 587 : parseInt(smtpPort, 10) || 587,
        smtpUser: overrides.smtpUser !== undefined ? overrides.smtpUser : smtpUser,
        smtpPass: overrides.smtpPass !== undefined ? overrides.smtpPass : smtpPass,
        smtpFrom: overrides.smtpFrom !== undefined ? overrides.smtpFrom : smtpFrom,
      };

      const res = await adminAPI.updateSystemSettings(payload);

      if (res?.systemSettings) {
        setMaintenanceMode(
          Boolean(res.systemSettings.maintenanceMode)
        );
        setAutoBackup(Boolean(res.systemSettings.autoBackup));
        setDebugMode(Boolean(res.systemSettings.debugMode));
        setBackupFrequency(
          res.systemSettings.backupFrequency || "daily"
        );
        setMaxLoginAttempts(
          String(res.systemSettings.maxLoginAttempts ?? 5)
        );
      }

      showToast(
        "✓ System settings saved to MongoDB successfully!",
        "success"
      );
    } catch (err) {
      console.error("Failed to save system settings:", err);

      showToast(
        err.message ||
          "Failed to save system settings to MongoDB.",
        "error"
      );
    } finally {
      setSystemSaving(false);
    }
  };

  // Subscription Plans Functions
  const loadSubscriptionPlans = async () => {
    try {
      setLoadingPlans(true);
      setPlanError("");

      const response = await getSubscriptionPlans();

      setPlans(response.data || []);
    } catch (error) {
      console.error(
        "Failed to load subscription plans:",
        error
      );

      setPlanError(
        error.response?.data?.message ||
          "Failed to load subscription plans."
      );
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleAddPlan = async () => {
  if (!newPlanName.trim()) {
    showToast(
      "Please enter a plan name.",
      "error"
    );
    return;
  }

  if (
    newPlanPrice === "" ||
    Number(newPlanPrice) < 0
  ) {
    showToast(
      "Please enter a valid price.",
      "error"
    );
    return;
  }

  try {
    setSavingPlan(true);

    const payload = {
      name: newPlanName.trim(),

      price: Number(newPlanPrice),

      billingCycle: newPlanBillingCycle,

      features: {
        ...newPlanFeatures,
      },

      status: newPlanStatus,
    };

    await createSubscriptionPlan(payload);

    setNewPlanName("");
    setNewPlanPrice("");
    setNewPlanBillingCycle("monthly");
    setNewPlanFeatures({
      ...defaultFeatures,
    });
    setNewPlanStatus("active");

    await loadSubscriptionPlans();

    showToast(
      "Subscription plan added successfully!",
      "success"
    );
  } catch (error) {
    console.error(
      "Failed to create subscription plan:",
      error
    );

    showToast(
      error.response?.data?.message ||
        "Failed to create subscription plan.",
      "error"
    );
  } finally {
    setSavingPlan(false);
  }
};

  const handleDeletePlan = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this subscription plan?"
    );

    if (!confirmed) return;

    try {
      setDeletingPlanId(id);

      await deleteSubscriptionPlan(id);

      await loadSubscriptionPlans();

      alert("✓ Subscription plan deleted successfully!");
    } catch (error) {
      console.error(
        "Failed to delete subscription plan:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to delete subscription plan."
      );
    } finally {
      setDeletingPlanId(null);
    }
  };

  const handleEditPlan = (plan) => {
  setEditingPlan(plan);

  setEditPlanName(plan.name || "");

  setEditPlanPrice(
    String(plan.price ?? "")
  );

  setEditPlanBillingCycle(
    plan.billingCycle || "monthly"
  );

  setEditPlanFeatures({
    ...defaultFeatures,
    ...(plan.features || {}),
  });

  setEditPlanStatus(
    plan.status || "active"
  );
};


const handleUpdatePlan = async () => {
  if (!editingPlan) return;

  if (!editPlanName.trim()) {
    showToast(
      "Please enter a plan name.",
      "error"
    );
    return;
  }

  if (
    editPlanPrice === "" ||
    Number(editPlanPrice) < 0
  ) {
    showToast(
      "Please enter a valid price.",
      "error"
    );
    return;
  }

  try {
    setSavingPlan(true);

    const payload = {
      name: editPlanName.trim(),

      price: Number(editPlanPrice),

      billingCycle: editPlanBillingCycle,

      features: {
        ...editPlanFeatures,
      },

      status: editPlanStatus,
    };

    await updateSubscriptionPlan(
      editingPlan._id,
      payload
    );

    await loadSubscriptionPlans();

    setEditingPlan(null);

    showToast(
      "Subscription plan updated successfully!",
      "success"
    );
  } catch (error) {
    console.error(
      "Failed to update subscription plan:",
      error
    );

    showToast(
      error.response?.data?.message ||
        "Failed to update subscription plan.",
      "error"
    );
  } finally {
    setSavingPlan(false);
  }
};

const handleCancelEdit = () => {
  setEditingPlan(null);

  setPlanForm({
    name: "",
    price: "",
    billingCycle: "monthly",
    status: "active",
    features: defaultFeatures,
  });
};

const handleFeatureChange = (feature) => {
  setPlanForm((prev) => ({
    ...prev,
    features: {
      ...prev.features,
      [feature]: !prev.features[feature],
    },
  }));
};

  // Save Support Settings
  const handleSaveSupportSettings = () => {
    localStorage.setItem(
      "superAdminSupportSettings",
      JSON.stringify({
        supportEmail,
        supportPhone,
        ticketSystem,
        liveChat,
        knowledgeBase,
      })
    );

    alert("✓ Support settings saved successfully!");
  };

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: "system", label: "System Settings", icon: Settings },
          { key: "customization", label: "Customization", icon: Palette },
          { key: "plans", label: "Subscription Plans", icon: Package },
          { key: "support", label: "Support Settings", icon: MessageSquare },
        ].map(({ key, label, icon: TabIcon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all cursor-pointer ${
              activeTab === key
                ? "bg-blue-600 text-white shadow-md"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {TabIcon && <TabIcon className="w-4 h-4" />}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* SYSTEM SETTINGS */}
      {activeTab === "system" && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-slate-900">
              System Settings
            </h3>

            {systemSaving && (
              <div className="flex items-center gap-2 text-xs font-medium text-blue-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing to MongoDB...</span>
              </div>
            )}
          </div>

          {systemLoading ? (
            <div className="py-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />

              <p className="text-sm font-medium">
                Loading System Settings from MongoDB...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Backup Frequency */}
              <div className="py-3 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-900 mb-2">
                  Backup Frequency
                </p>

                <select
                  value={backupFrequency}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBackupFrequency(val);

                    handleSaveSystemSettings({
                      backupFrequency: val,
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="manual">
                    Manual / On-Demand Only
                  </option>
                  <option value="disabled">
                    Disabled / Never
                  </option>
                </select>
              </div>

              {/* Max Login Attempts */}
              <div className="py-3 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-900 mb-2">
                  Max Login Attempts
                </p>

                <input
                  type="number"
                  value={maxLoginAttempts}
                  onChange={(e) =>
                    setMaxLoginAttempts(e.target.value)
                  }
                  onBlur={() => {
                    const parsed =
                      parseInt(maxLoginAttempts, 10) || 5;

                    handleSaveSystemSettings({
                      maxLoginAttempts: parsed,
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="5"
                />
              </div>

              {/* Maintenance Mode */}
              <div className="flex items-start justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Maintenance Mode
                  </p>

                  <p className="text-xs text-slate-500">
                    Temporarily disable user access for maintenance
                  </p>
                </div>

                <button
                  onClick={() => {
                    const nextVal = !maintenanceMode;

                    setMaintenanceMode(nextVal);

                    handleSaveSystemSettings({
                      maintenanceMode: nextVal,
                    });
                  }}
                  className={`w-10 h-6 rounded-full relative flex-shrink-0 ml-4 transition-colors ${
                    maintenanceMode
                      ? "bg-blue-600"
                      : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                      maintenanceMode ? "right-1" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Auto Backup */}
              <div className="flex items-start justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Auto Backup
                  </p>

                  <p className="text-xs text-slate-500">
                    Automatically backup database
                  </p>
                </div>

                <button
                  onClick={() => {
                    const nextVal = !autoBackup;

                    setAutoBackup(nextVal);

                    handleSaveSystemSettings({
                      autoBackup: nextVal,
                    });
                  }}
                  className={`w-10 h-6 rounded-full relative flex-shrink-0 ml-4 transition-colors ${
                    autoBackup
                      ? "bg-blue-600"
                      : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                      autoBackup ? "right-1" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Debug Mode */}
              <div className="flex items-start justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Debug Mode
                  </p>

                  <p className="text-xs text-slate-500">
                    Enable detailed error logging
                  </p>
                </div>

                <button
                  onClick={() => {
                    const nextVal = !debugMode;

                    setDebugMode(nextVal);

                    handleSaveSystemSettings({
                      debugMode: nextVal,
                    });
                  }}
                  className={`w-10 h-6 rounded-full relative flex-shrink-0 ml-4 transition-colors ${
                    debugMode
                      ? "bg-blue-600"
                      : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                      debugMode ? "right-1" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* SMTP Email Server Gateway Configuration */}
              <div className="pt-5 mt-5 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      SaaS Email & SMTP Server Gateway
                    </h4>
                    <p className="text-xs text-slate-500">
                      Configure your email server credentials in MongoDB so system emails (Welcome, Password Reset, Access Granted) are sent directly to recipients.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      SMTP Port
                    </label>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="587"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      SMTP Email / Username
                    </label>
                    <input
                      type="email"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="admin@smartbill.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      SMTP / Google App Password
                    </label>
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Sender Name & Format (SMTP_FROM)
                    </label>
                    <input
                      type="text"
                      value={smtpFrom}
                      onChange={(e) => setSmtpFrom(e.target.value)}
                      placeholder='"SmartBill System" <admin@smartbill.com>'
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 bg-white"
                    />
                  </div>
                </div>
              </div>

              <Btn
                variant="primary"
                onClick={() => handleSaveSystemSettings()}
                disabled={systemSaving}
                icon={
                  systemSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )
                }
              >
                {systemSaving
                  ? "Saving..."
                  : "Save System & SMTP Settings"}
              </Btn>
            </div>
          )}
        </Card>
      )}

      {/* TAB: CUSTOMIZATION SETTINGS */}
      {activeTab === "customization" && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                {t ? t("settings.customization_title") : "Customization Settings"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Personalize the admin interface appearance, theme modes, accents, and localization preferences.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetCustomizationToDefault}
                disabled={savingCustomization}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t ? t("settings.reset_defaults") : "Reset to Defaults"}</span>
              </button>
            </div>
          </div>

          {/* Notification messages */}
          {customSuccess && (
            <div className="p-3.5 text-sm rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-400 flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{customSuccess}</span>
            </div>
          )}
          {customError && (
            <div className="p-3.5 text-sm rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400">
              {customError}
            </div>
          )}

          {/* Visual & Appearance Settings */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-600" />
              <span>{t ? t("settings.visual_appearance") : "Visual & Appearance"}</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  {t ? t("settings.theme_mode") : "Theme Mode"}
                </label>
                <select
                  value={tempSettings?.theme || "light"}
                  onChange={(e) => updateTempSettings({ theme: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="light">{t ? t("settings.light_mode") : "Light Mode"}</option>
                  <option value="dark">{t ? t("settings.dark_mode") : "Dark Mode"}</option>
                  <option value="system">{t ? t("settings.system_default") : "System Default"}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  {t ? t("settings.accent_color") : "Primary Brand Color"}
                </label>
                <div className="flex gap-2.5 items-center">
                  <input
                    type="color"
                    value={tempSettings?.accentColor || "#3b82f6"}
                    onChange={(e) =>
                      updateTempSettings({ accentColor: e.target.value })
                    }
                    className="w-10 h-10 rounded border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    value={tempSettings?.accentColor || "#3b82f6"}
                    onChange={(e) =>
                      updateTempSettings({ accentColor: e.target.value })
                    }
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm font-mono outline-none"
                    placeholder="#3b82f6"
                  />
                  <div
                    className="w-6 h-6 rounded-full border border-slate-300 shadow-inner flex-shrink-0"
                    style={{ backgroundColor: tempSettings?.accentColor || "#3b82f6" }}
                    title="Accent Color Preview"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  {t ? t("settings.sidebar_style") : "Sidebar Style"}
                </label>
                <select
                  value={tempSettings?.sidebarStyle || "expanded"}
                  onChange={(e) => updateTempSettings({ sidebarStyle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="expanded">{t ? t("settings.expanded") : "Expanded Default"}</option>
                  <option value="compact">{t ? t("settings.compact") : "Compact Mini"}</option>
                  <option value="auto">{t ? t("settings.auto_responsive") : "Auto Responsive"}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  {t ? t("settings.font_size") : "Font Scaling"}
                </label>
                <select
                  value={tempSettings?.fontSize || "medium"}
                  onChange={(e) => updateTempSettings({ fontSize: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="small">{t ? t("settings.small") : "Small (Compact)"}</option>
                  <option value="medium">{t ? t("settings.medium") : "Medium (Standard)"}</option>
                  <option value="large">{t ? t("settings.large") : "Large (High Legibility)"}</option>
                  <option value="xlarge">{t ? t("settings.xlarge") : "Extra Large"}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Localization & Regional Formats */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>{t ? t("settings.localization_regional") : "Localization & Regional Formats"}</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  {t ? t("settings.language_selection") : "Language Selection"}
                </label>
                <select
                  value={tempSettings?.language || "English"}
                  onChange={(e) => updateTempSettings({ language: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="Marathi">Marathi (मराठी)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  {t ? t("settings.date_format") : "Date Format"}
                </label>
                <select
                  value={tempSettings?.dateFormat || "DD-MM-YYYY"}
                  onChange={(e) => updateTempSettings({ dateFormat: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM-DD-YYYY">MM-DD-YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  {t ? t("settings.time_format") : "Time Format"}
                </label>
                <select
                  value={tempSettings?.timeFormat || "24-hour"}
                  onChange={(e) => updateTempSettings({ timeFormat: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="12-hour">12-Hour (02:30 PM)</option>
                  <option value="24-hour">24-Hour (14:30)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  {t ? t("settings.number_style") : "Number Display Style"}
                </label>
                <select
                  value={tempSettings?.numberFormat || "Indian"}
                  onChange={(e) => updateTempSettings({ numberFormat: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Indian">{t ? t("settings.indian_style") : "Indian (₹1,00,000)"}</option>
                  <option value="International">{t ? t("settings.international_style") : "International (100,000)"}</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  {t ? t("settings.currency_symbol") : "Currency Symbol"}
                </label>
                <select
                  value={tempSettings?.currency || "INR"}
                  onChange={(e) => updateTempSettings({ currency: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="INR">INR (₹ - Indian Rupee)</option>
                  <option value="USD">USD ($ - US Dollar)</option>
                  <option value="EUR">EUR (€ - Euro)</option>
                  <option value="GBP">GBP (£ - British Pound)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={saveCustomizationSettings}
              disabled={savingCustomization}
              style={{ backgroundColor: "var(--primary, #2563eb)", color: "#ffffff" }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium shadow transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {savingCustomization ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Check className="w-4 h-4 text-white" />
              )}
              <span>
                {savingCustomization
                  ? t ? t("common.saving") : "Saving..."
                  : t ? t("settings.save_customization") : "Save Customization Settings"}
              </span>
            </button>

            <button
              type="button"
              onClick={cancelCustomizationChanges}
              disabled={savingCustomization}
              className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {t ? t("common.cancel") : "Cancel Changes"}
            </button>
          </div>
        </Card>
      )}

    {/* SUBSCRIPTION PLANS */}
{activeTab === "plans" && (
  <div className="space-y-4">

    <Card className="p-6">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 text-lg">
            Manage Subscription Plans
          </h3>

          <p className="text-xs text-slate-500 mt-1">
            Create and manage SmartBill subscription plans.
          </p>
        </div>

        {loadingPlans && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        )}
      </div>

      {/* Error */}
      {planError && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {planError}
        </div>
      )}

      {/* Loading */}
      {loadingPlans ? (
        <div className="py-12 text-center text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />

          <p className="text-sm">
            Loading subscription plans...
          </p>
        </div>
      ) : plans.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <Package className="w-8 h-8 mx-auto mb-2 text-slate-400" />

          <p className="text-sm font-medium">
            No subscription plans found.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

          {plans.map((plan) => (
            <div
              key={plan._id}
              className="border border-slate-200 rounded-xl p-5 bg-white"
            >

              {/* Header */}
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-900">
                  {plan.name}
                </h4>

                <Badge
                  label={plan.status}
                  variant={
                    plan.status === "active"
                      ? "green"
                      : "gray"
                  }
                />
              </div>

              {/* Price */}
              <div className="mt-4">
                <span className="text-3xl font-bold text-blue-600">
                  ₹{Number(plan.price).toLocaleString("en-IN")}
                </span>

                <span className="text-xs text-slate-500 ml-1">
                  / {plan.billingCycle || "month"}
                </span>
              </div>

              {/* Features */}
              <div className="mt-5">

                <p className="text-xs font-semibold text-slate-700 mb-3">
                  Features
                </p>

                <div className="space-y-2">

                  {Object.entries(
                    featureLabels
                  ).map(([key, label]) => {

                    const enabled =
                      Boolean(
                        plan.features?.[key]
                      );

                    return (
                      <div
                        key={key}
                        className="flex items-center gap-2 text-xs"
                      >

                        <span
                          className={
                            enabled
                              ? "text-green-600 font-bold"
                              : "text-slate-300"
                          }
                        >
                          {enabled ? "✓" : "×"}
                        </span>

                        <span
                          className={
                            enabled
                              ? "text-slate-700"
                              : "text-slate-400"
                          }
                        >
                          {label}
                        </span>

                      </div>
                    );
                  })}

                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-6">

                <Btn
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleEditPlan(plan)
                  }
                  disabled={
                    savingPlan ||
                    deletingPlanId === plan._id
                  }
                >
                  Edit
                </Btn>

                <Btn
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleDeletePlan(plan._id)
                  }
                  disabled={
                    savingPlan ||
                    deletingPlanId === plan._id
                  }
                >
                  {deletingPlanId === plan._id
                    ? "Deleting..."
                    : "Delete"}
                </Btn>

              </div>

            </div>
          ))}

        </div>
      )}

    </Card>


    {/* EDIT PLAN FORM */}

    {editingPlan && (
      <Card className="p-6 border-2 border-blue-100">

        <div className="flex items-center justify-between mb-6">

          <div>
            <h3 className="font-semibold text-slate-900 text-lg">
              Edit Subscription Plan
            </h3>

            <p className="text-xs text-slate-500 mt-1">
              Update plan details and features.
            </p>
          </div>

          <Badge
            label="Editing"
            variant="blue"
          />

        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Plan Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Plan Name
            </label>

            <input
              type="text"
              value={editPlanName}
              onChange={(e) =>
                setEditPlanName(e.target.value)
              }
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>


          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Price
            </label>

            <input
              type="number"
              min="0"
              value={editPlanPrice}
              onChange={(e) =>
                setEditPlanPrice(e.target.value)
              }
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>


          {/* Billing Cycle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Billing Cycle
            </label>

            <select
              value={editPlanBillingCycle}
              onChange={(e) =>
                setEditPlanBillingCycle(
                  e.target.value
                )
              }
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="monthly">
                Monthly
              </option>

              <option value="yearly">
                Yearly
              </option>

              <option value="custom">
                Custom
              </option>
            </select>
          </div>


          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Status
            </label>

            <select
              value={editPlanStatus}
              onChange={(e) =>
                setEditPlanStatus(
                  e.target.value
                )
              }
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>
          </div>

        </div>


        {/* Features */}
        <div className="mt-6">

          <h4 className="font-semibold text-slate-900 mb-4">
            Plan Features
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

            {Object.entries(
              featureLabels
            ).map(([key, label]) => (

              <label
                key={key}
                className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50"
              >

                <input
                  type="checkbox"
                  checked={Boolean(
                    editPlanFeatures[key]
                  )}
                  onChange={(e) =>
                    setEditPlanFeatures(
                      (prev) => ({
                        ...prev,
                        [key]:
                          e.target.checked,
                      })
                    )
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                />

                <span className="text-sm text-slate-700">
                  {label}
                </span>

              </label>

            ))}

          </div>

        </div>


        {/* Buttons */}
        <div className="flex gap-3 mt-7">

          <Btn
            variant="outline"
            onClick={() =>
              setEditingPlan(null)
            }
            disabled={savingPlan}
          >
            Cancel
          </Btn>

          <Btn
            variant="primary"
            onClick={handleUpdatePlan}
            disabled={savingPlan}
            icon={
              savingPlan ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null
            }
          >
            {savingPlan
              ? "Saving Changes..."
              : "Save Changes"}
          </Btn>

        </div>

      </Card>
    )}


    {/* ADD NEW PLAN */}

    <Card className="p-6">

      <div className="mb-6">

        <h3 className="font-semibold text-slate-900 text-lg">
          Add New Subscription Plan
        </h3>

        <p className="text-xs text-slate-500 mt-1">
          Create a new plan that will be stored in MongoDB.
        </p>

      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Plan Name
          </label>

          <input
            type="text"
            value={newPlanName}
            onChange={(e) =>
              setNewPlanName(e.target.value)
            }
            placeholder="e.g. Premium"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>


        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Price
          </label>

          <input
            type="number"
            min="0"
            value={newPlanPrice}
            onChange={(e) =>
              setNewPlanPrice(e.target.value)
            }
            placeholder="e.g. 999"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>


        {/* Billing */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Billing Cycle
          </label>

          <select
            value={newPlanBillingCycle}
            onChange={(e) =>
              setNewPlanBillingCycle(
                e.target.value
              )
            }
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="monthly">
              Monthly
            </option>

            <option value="yearly">
              Yearly
            </option>

            <option value="custom">
              Custom
            </option>
          </select>
        </div>


        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Status
          </label>

          <select
            value={newPlanStatus}
            onChange={(e) =>
              setNewPlanStatus(e.target.value)
            }
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>
          </select>
        </div>

      </div>


      {/* Features */}
      <div className="mt-6">

        <h4 className="font-semibold text-slate-900 mb-4">
          Plan Features
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

          {Object.entries(
            featureLabels
          ).map(([key, label]) => (

            <label
              key={key}
              className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50"
            >

              <input
                type="checkbox"
                checked={Boolean(
                  newPlanFeatures[key]
                )}
                onChange={(e) =>
                  setNewPlanFeatures(
                    (prev) => ({
                      ...prev,
                      [key]:
                        e.target.checked,
                    })
                  )
                }
                className="w-4 h-4 text-blue-600 rounded"
              />

              <span className="text-sm text-slate-700">
                {label}
              </span>

            </label>

          ))}

        </div>

      </div>


      {/* Add Button */}
      <div className="mt-6">

        <Btn
          variant="primary"
          onClick={handleAddPlan}
          disabled={savingPlan}
          icon={
            savingPlan ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )
          }
        >
          {savingPlan
            ? "Creating Plan..."
            : "Create Subscription Plan"}
        </Btn>

      </div>

    </Card>

  </div>
)}

      {/* TAB 6: ADMIN USERS */}
      {activeTab === "users" && (
        <Card className="p-6">
          <h3 className="font-semibold text-slate-900 mb-5">Admin Users</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {[
                    "Name",
                    "Email",
                    "Role",
                    "Status",
                    "Last Login",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {adminUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {user.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <Badge
                        label={
                          user.role === "super-admin" ? "Super Admin" : "Admin"
                        }
                        variant="blue"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={user.status} variant="green" />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {user.lastLogin}
                    </td>
                    <td className="px-4 py-3">
                      <Btn
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveAdmin(user.id)}
                      >
                        Remove
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 7: AUDIT LOGS */}
      {activeTab === "logs" && (
        <Card className="p-6">
          <h3 className="font-semibold text-slate-900 mb-5">Audit Logs</h3>
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {log.action}
                  </p>
                  <p className="text-xs text-slate-500">
                    by {log.user} • {log.timestamp}
                  </p>
                </div>
                <Badge
                  label={log.status}
                  variant={log.status === "success" ? "green" : "yellow"}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 8: SUPPORT SETTINGS */}
      {activeTab === "support" && (
        <Card className="p-6">
          <h3 className="font-semibold text-slate-900 mb-5">
            Support Settings
          </h3>

          <div className="space-y-4">
            <div className="py-3 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-900 mb-2">
                Support Email
              </p>

              <input
                type="email"
                value={supportEmail}
                onChange={(e) =>
                  setSupportEmail(e.target.value)
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="py-3 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-900 mb-2">
                Support Phone
              </p>

              <input
                type="tel"
                value={supportPhone}
                onChange={(e) =>
                  setSupportPhone(e.target.value)
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-start justify-between py-3 border-b border-slate-100">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Support Ticket System
                </p>

                <p className="text-xs text-slate-500">
                  Enable ticket system for users
                </p>
              </div>

              <button
                onClick={() =>
                  setTicketSystem(!ticketSystem)
                }
                className={`w-10 h-6 rounded-full relative flex-shrink-0 ml-4 ${
                  ticketSystem
                    ? "bg-blue-600"
                    : "bg-slate-200"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow ${
                    ticketSystem ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-start justify-between py-3 border-b border-slate-100">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Live Chat
                </p>

                <p className="text-xs text-slate-500">
                  Enable live chat support
                </p>
              </div>

              <button
                onClick={() => setLiveChat(!liveChat)}
                className={`w-10 h-6 rounded-full relative flex-shrink-0 ml-4 ${
                  liveChat
                    ? "bg-blue-600"
                    : "bg-slate-200"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow ${
                    liveChat ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-start justify-between py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Knowledge Base
                </p>

                <p className="text-xs text-slate-500">
                  Enable public knowledge base
                </p>
              </div>

              <button
                onClick={() =>
                  setKnowledgeBase(!knowledgeBase)
                }
                className={`w-10 h-6 rounded-full relative flex-shrink-0 ml-4 ${
                  knowledgeBase
                    ? "bg-blue-600"
                    : "bg-slate-200"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow ${
                    knowledgeBase ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </div>

            <Btn
              variant="primary"
              onClick={handleSaveSupportSettings}
              icon={<MessageSquare className="w-4 h-4" />}
            >
              Save Support Settings
            </Btn>
          </div>
        </Card>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}


