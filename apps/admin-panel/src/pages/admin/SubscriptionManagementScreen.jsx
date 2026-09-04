import { useEffect, useState } from "react";
import { Package, Loader2, Plus } from "lucide-react";
import { Btn, Badge, Card, Toast } from "@shared/components/common/ui";
import {
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
} from "@shared/api/subscriptionPlanApi";

export default function SubscriptionManagementScreen() {
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [planError, setPlanError] = useState("");

  const featureLabels = {
    basicReports: "Basic Reports",
    advancedReports: "Advanced Reports",
    gstReports: "GST Reports",
    barcodeScanner: "Barcode Scanner",
    expenses: "Expenses",
    purchaseManagement: "Purchase Management",
    inventory: "Inventory",
    advancedInventory: "Advanced Inventory",
    dataExport: "Data Export",
    apiAccess: "API Access",
  };

  const defaultFeatures = {
    basicReports: false,
    advancedReports: false,
    gstReports: false,
    barcodeScanner: false,
    expenses: false,
    purchaseManagement: false,
    inventory: false,
    advancedInventory: false,
    dataExport: false,
    apiAccess: false,
  };

  const limitFields = [
    ["maxUsers", "Max Users"],
    ["maxInvoicesPerMonth", "Max Invoices per Month"],
    ["maxCustomers", "Max Customers"],
    ["maxProducts", "Max Products"],
  ];
  const defaultLimits = { maxUsers: "", maxInvoicesPerMonth: "", maxCustomers: "", maxProducts: "" };
  const defaultUnlimited = { maxUsers: false, maxInvoicesPerMonth: false, maxCustomers: false, maxProducts: false };
  const formatLimit = (value) => value == null || value === Infinity ? "Unlimited" : Number(value).toLocaleString("en-IN");

  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanPrice, setNewPlanPrice] = useState("");
  const [newPlanBillingCycle, setNewPlanBillingCycle] = useState("monthly");
  const [newPlanFeatures, setNewPlanFeatures] = useState(defaultFeatures);
  const [newPlanStatus, setNewPlanStatus] = useState("active");
  const [newPlanLimits, setNewPlanLimits] = useState(defaultLimits);
  const [newPlanUnlimited, setNewPlanUnlimited] = useState(defaultUnlimited);

  const [editingPlan, setEditingPlan] = useState(null);
  const [editPlanName, setEditPlanName] = useState("");
  const [editPlanPrice, setEditPlanPrice] = useState("");
  const [editPlanBillingCycle, setEditPlanBillingCycle] = useState("monthly");
  const [editPlanFeatures, setEditPlanFeatures] = useState(defaultFeatures);
  const [editPlanStatus, setEditPlanStatus] = useState("active");
  const [editPlanLimits, setEditPlanLimits] = useState(defaultLimits);
  const [editPlanUnlimited, setEditPlanUnlimited] = useState(defaultUnlimited);

  const [savingPlan, setSavingPlan] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    loadSubscriptionPlans();
  }, []);

  const loadSubscriptionPlans = async () => {
    try {
      setLoadingPlans(true);
      setPlanError("");
      const response = await getSubscriptionPlans();
      setPlans(response.data || []);
    } catch (error) {
      console.error("Failed to load subscription plans:", error);
      setPlanError(error.response?.data?.message || "Failed to load subscription plans.");
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleAddPlan = async () => {
    if (!newPlanName.trim()) {
      showToast("Please enter a plan name.", "error");
      return;
    }
    if (newPlanPrice === "" || Number(newPlanPrice) < 0) {
      showToast("Please enter a valid price.", "error");
      return;
    }
    try {
      setSavingPlan(true);
      const payload = {
        name: newPlanName.trim(),
        price: Number(newPlanPrice),
        billingCycle: newPlanBillingCycle,
        features: { ...newPlanFeatures },
        status: newPlanStatus,
        ...Object.fromEntries(limitFields.map(([key]) => [key, newPlanUnlimited[key] ? null : newPlanLimits[key]])),
      };
      await createSubscriptionPlan(payload);
      setNewPlanName("");
      setNewPlanPrice("");
      setNewPlanBillingCycle("monthly");
      setNewPlanFeatures({ ...defaultFeatures });
      setNewPlanStatus("active");
      setNewPlanLimits({ ...defaultLimits });
      setNewPlanUnlimited({ ...defaultUnlimited });
      await loadSubscriptionPlans();
      showToast("Subscription plan added successfully!", "success");
    } catch (error) {
      console.error("Failed to create subscription plan:", error);
      showToast(error.response?.data?.message || "Failed to create subscription plan.", "error");
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async (id) => {
    const confirmed = window.confirm("Are you sure you want to delete this subscription plan?");
    if (!confirmed) return;
    try {
      setDeletingPlanId(id);
      await deleteSubscriptionPlan(id);
      await loadSubscriptionPlans();
      showToast("Subscription plan deleted successfully!", "success");
    } catch (error) {
      console.error("Failed to delete subscription plan:", error);
      showToast(error.response?.data?.message || "Failed to delete subscription plan.", "error");
    } finally {
      setDeletingPlanId(null);
    }
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setEditPlanName(plan.name || "");
    setEditPlanPrice(String(plan.price ?? ""));
    setEditPlanBillingCycle(plan.billingCycle || "monthly");
    setEditPlanFeatures({ ...defaultFeatures, ...(plan.features || {}) });
    setEditPlanStatus(plan.status || "active");
    setEditPlanLimits(Object.fromEntries(limitFields.map(([key]) => [key, plan[key] == null ? "" : String(plan[key])] )));
    setEditPlanUnlimited(Object.fromEntries(limitFields.map(([key]) => [key, plan[key] == null])));
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan) return;
    if (!editPlanName.trim()) {
      showToast("Please enter a plan name.", "error");
      return;
    }
    if (editPlanPrice === "" || Number(editPlanPrice) < 0) {
      showToast("Please enter a valid price.", "error");
      return;
    }
    try {
      setSavingPlan(true);
      const payload = {
        name: editPlanName.trim(),
        price: Number(editPlanPrice),
        billingCycle: editPlanBillingCycle,
        features: { ...editPlanFeatures },
        status: editPlanStatus,
        ...Object.fromEntries(limitFields.map(([key]) => [key, editPlanUnlimited[key] ? null : editPlanLimits[key]])),
      };
      await updateSubscriptionPlan(editingPlan._id, payload);
      await loadSubscriptionPlans();
      setEditingPlan(null);
      showToast("Subscription plan updated successfully!", "success");
    } catch (error) {
      console.error("Failed to update subscription plan:", error);
      showToast(error.response?.data?.message || "Failed to update subscription plan.", "error");
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-slate-900 text-lg">Manage Subscription Plans</h3>
            <p className="text-xs text-slate-500 mt-1">Create and manage SmartBill subscription plans.</p>
          </div>
          {loadingPlans && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          )}
        </div>
        {planError && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {planError}
          </div>
        )}
        {loadingPlans ? (
          <div className="py-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-sm">Loading subscription plans...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Package className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm font-medium">No subscription plans found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {plans.map((plan) => (
              <div key={plan._id} className="border border-slate-200 rounded-xl p-5 bg-white">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900">{plan.name}</h4>
                  <Badge label={plan.status} variant={plan.status === "active" ? "green" : "gray"} />
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-blue-600">₹{Number(plan.price).toLocaleString("en-IN")}</span>
                  <span className="text-xs text-slate-500 ml-1">/ {plan.billingCycle || "month"}</span>
                </div>
                <div className="mt-5">
                  <p className="text-xs text-slate-700 mb-2">Usage limits</p>
                  <p className="text-xs text-slate-500 mb-3">
                    {formatLimit(plan.maxUsers)} users · {formatLimit(plan.maxInvoicesPerMonth)} invoices/month · {formatLimit(plan.maxCustomers)} customers · {formatLimit(plan.maxProducts)} products
                  </p>
                  <p className="text-xs font-semibold text-slate-700 mb-3">Features</p>
                  <div className="space-y-2">
                    {Object.entries(featureLabels).map(([key, label]) => {
                      const enabled = Boolean(plan.features?.[key]);
                      return (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <span className={enabled ? "text-green-600 font-bold" : "text-slate-300"}>{enabled ? "✓" : "×"}</span>
                          <span className={enabled ? "text-slate-700" : "text-slate-400"}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <Btn variant="outline" size="sm" onClick={() => handleEditPlan(plan)} disabled={savingPlan || deletingPlanId === plan._id}>
                    Edit
                  </Btn>
                  <Btn variant="outline" size="sm" onClick={() => handleDeletePlan(plan._id)} disabled={savingPlan || deletingPlanId === plan._id}>
                    {deletingPlanId === plan._id ? "Deleting..." : "Delete"}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editingPlan && (
        <Card className="p-6 border-2 border-blue-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">Edit Subscription Plan</h3>
              <p className="text-xs text-slate-500 mt-1">Update plan details and features.</p>
            </div>
            <Badge label="Editing" variant="blue" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Plan Name</label>
              <input type="text" value={editPlanName} onChange={(e) => setEditPlanName(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Price</label>
              <input type="number" min="0" value={editPlanPrice} onChange={(e) => setEditPlanPrice(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Billing Cycle</label>
              <select value={editPlanBillingCycle} onChange={(e) => setEditPlanBillingCycle(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <select value={editPlanStatus} onChange={(e) => setEditPlanStatus(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            {limitFields.map(([key, label]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
                <div className="flex gap-2">
                  <input type="number" min="0" step="1" disabled={editPlanUnlimited[key]} value={editPlanLimits[key]} onChange={(e) => setEditPlanLimits((prev) => ({ ...prev, [key]: e.target.value }))} className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                  <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap"><input type="checkbox" checked={editPlanUnlimited[key]} onChange={(e) => setEditPlanUnlimited((prev) => ({ ...prev, [key]: e.target.checked }))} /> Unlimited</label>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <h4 className="font-semibold text-slate-900 mb-4">Plan Features</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(featureLabels).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={Boolean(editPlanFeatures[key])} onChange={(e) => setEditPlanFeatures((prev) => ({ ...prev, [key]: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 mt-7">
            <Btn variant="outline" onClick={() => setEditingPlan(null)} disabled={savingPlan}>Cancel</Btn>
            <Btn variant="primary" onClick={handleUpdatePlan} disabled={savingPlan} icon={savingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : null}>{savingPlan ? "Saving Changes..." : "Save Changes"}</Btn>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="mb-6">
          <h3 className="font-semibold text-slate-900 text-lg">Add New Subscription Plan</h3>
          <p className="text-xs text-slate-500 mt-1">Create a new plan that will be stored in MongoDB.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Plan Name</label>
            <input type="text" value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} placeholder="e.g. Premium" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Price</label>
            <input type="number" min="0" value={newPlanPrice} onChange={(e) => setNewPlanPrice(e.target.value)} placeholder="e.g. 999" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Billing Cycle</label>
            <select value={newPlanBillingCycle} onChange={(e) => setNewPlanBillingCycle(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <select value={newPlanStatus} onChange={(e) => setNewPlanStatus(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {limitFields.map(([key, label]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
              <div className="flex gap-2">
                <input type="number" min="0" step="1" disabled={newPlanUnlimited[key]} value={newPlanLimits[key]} onChange={(e) => setNewPlanLimits((prev) => ({ ...prev, [key]: e.target.value }))} className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap"><input type="checkbox" checked={newPlanUnlimited[key]} onChange={(e) => setNewPlanUnlimited((prev) => ({ ...prev, [key]: e.target.checked }))} /> Unlimited</label>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <h4 className="font-semibold text-slate-900 mb-4">Plan Features</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(featureLabels).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={Boolean(newPlanFeatures[key])} onChange={(e) => setNewPlanFeatures((prev) => ({ ...prev, [key]: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded" />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="mt-6">
          <Btn variant="primary" onClick={handleAddPlan} disabled={savingPlan} icon={savingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}>
            {savingPlan ? "Creating Plan..." : "Create Subscription Plan"}
          </Btn>
        </div>
      </Card>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
