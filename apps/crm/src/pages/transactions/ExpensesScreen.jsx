import { useEffect, useState } from "react";
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from "@shared/api/expenseApi";
import { useCustomization } from "@shared/hooks/useCustomization";

import {
  Clock3,
  Plus,
  Receipt,
  WalletCards,
  Building2,
  Zap,
  Users,
  Megaphone,
  Truck,
  Wrench,
  Package,
  Tags,
  CreditCard,
  Banknote,
  QrCode,
  Landmark,
  CircleCheck,
  AlertCircle,
  ArrowUpRight,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  Badge,
  Btn,
  Card,
  Input,
  Modal,
  Select,
  SearchableSelect,
  Toast,
} from "@shared/components/common/ui";

const DEFAULT_CATEGORIES = [
  "Rent",
  "Utilities",
  "Salaries",
  "Marketing",
  "Logistics",
  "Maintenance",
  "Other",
];

export default function ExpensesScreen() {
  const { formatCurrency, formatDate } = useCustomization();
  const [showModal, setShowModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseList, setExpenseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expensePaymentMethods, setExpensePaymentMethods] = useState(() => {
    try {
      const stored = localStorage.getItem("smartbill_payment_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.expenses) && parsed.expenses.length > 0) {
          return parsed.expenses;
        }
      }
    } catch (_) {}
    return ["Cash", "UPI & QR Code", "Bank Transfer", "Credit / Debit Card", "Cheque / DD"];
  });

  const [form, setForm] = useState({
    category: "Rent",
    description: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    paymentMode: "Bank Transfer",
    reference: "",
    status: "Paid",
  });

  const resetForm = () => {
    setEditingExpenseId(null);
    setForm({
      category: "Rent",
      description: "",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      paymentMode: "Bank Transfer",
      reference: "",
      status: "Paid",
    });
  };

  const handleEditExpense = (exp) => {
    setEditingExpenseId(exp.id || exp._id);
    let dateStr = new Date().toISOString().slice(0, 10);
    if (exp.date) {
      try {
        dateStr = new Date(exp.date).toISOString().slice(0, 10);
      } catch (_) {}
    }
    setForm({
      category: exp.category || "Other",
      description: exp.description || "",
      amount: exp.amount ? String(exp.amount) : "",
      date: dateStr,
      paymentMode: exp.paymentMode || "Bank Transfer",
      reference: exp.reference || "",
      status: exp.status || "Paid",
    });
    setShowModal(true);
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      await deleteExpense(id);
      setExpenseList((prev) => prev.filter((item) => (item.id || item._id) !== id));
      showToast("Expense deleted successfully", "success");
    } catch (err) {
      showToast(err.message || "Unable to delete expense", "error");
    }
  };

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const stored = localStorage.getItem("smartbill_payment_settings");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed.expenses) && parsed.expenses.length > 0) {
            setExpensePaymentMethods(parsed.expenses);
          }
        }
      } catch (_) {}
    };
    window.addEventListener("paymentSettingsUpdated", handleUpdate);
    return () => window.removeEventListener("paymentSettingsUpdated", handleUpdate);
  }, []);

  const [toast, setToast] = useState(null);

  const showToast = (msg, type) => {
    setToast({ msg, type });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  useEffect(() => {
    const loadExpenses = async () => {
      try {
        setLoading(true);

        const data = await getExpenses();

        setExpenseList(data.expenses || []);
      } catch (error) {
        console.error("LOAD EXPENSES ERROR:", error);

        showToast(
          error.message || "Unable to load expenses",
          "error"
        );
      } finally {
        setLoading(false);
      }
    };

    loadExpenses();
  }, []);

  // Calculate total expenses
  const totalExpenses = expenseList.reduce(
    (sum, expense) => sum + (Number(expense.amount) || 0),
    0
  );

  // Calculate pending payments
  const pendingExpenses = expenseList.filter(
    (expense) => expense.status === "Pending"
  );

  const pendingAmount = pendingExpenses.reduce(
    (sum, expense) => sum + (Number(expense.amount) || 0),
    0
  );

  // Helper for Category icons & badges
  const getCategoryBadge = (category) => {
    const cat = (category || "").toLowerCase();
    let IconComponent = Tags;
    if (cat.includes("rent")) IconComponent = Building2;
    else if (cat.includes("util")) IconComponent = Zap;
    else if (cat.includes("salar")) IconComponent = Users;
    else if (cat.includes("market")) IconComponent = Megaphone;
    else if (cat.includes("logic")) IconComponent = Truck;
    else if (cat.includes("maint")) IconComponent = Wrench;
    else if (cat.includes("invent")) IconComponent = Package;

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80">
        <IconComponent className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
        <span>{category}</span>
      </span>
    );
  };

  // Helper for Payment Mode icons & badges
  const getPaymentModeBadge = (mode) => {
    const m = (mode || "").toLowerCase();
    let IconComponent = CreditCard;
    if (m.includes("cash")) IconComponent = Banknote;
    else if (m.includes("upi")) IconComponent = QrCode;
    else if (m.includes("card")) IconComponent = CreditCard;
    else if (m.includes("bank") || m.includes("transfer") || m.includes("cheque")) IconComponent = Landmark;

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        <IconComponent className="w-3.5 h-3.5 opacity-70" />
        <span>{mode}</span>
      </span>
    );
  };

  // Helper for Status badges
  const renderStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "paid") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
          <CircleCheck className="w-3.5 h-3.5" />
          <span>Paid</span>
        </span>
      );
    }
    if (s === "pending") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
          <Clock3 className="w-3.5 h-3.5" />
          <span>Pending</span>
        </span>
      );
    }
    if (s === "overdue") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Overdue</span>
        </span>
      );
    }
    return <Badge label={status} variant="gray" />;
  };

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Add / Edit Expense Modal */}
      {showModal && (
        <Modal
          title={editingExpenseId ? "Edit Expense" : "Add Expense"}
          onClose={() => {
            setShowModal(false);
            resetForm();
          }}
        >
          <div className="space-y-4">

            {/* Category */}
            <SearchableSelect
              label="Category"
              value={form.category}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  category: v,
                }))
              }
              options={DEFAULT_CATEGORIES}
              placeholder="Select or type category..."
            />

            {/* Description */}
            <Input
              label="Description"
              value={form.description}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  description: v,
                }))
              }
            />

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">

              <Input
                label="Amount"
                value={form.amount}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    amount: v,
                  }))
                }
              />

              <Input
                label="Date"
                type="date"
                value={form.date}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    date: v,
                  }))
                }
              />

            </div>

            {/* Payment Mode */}
            <Select
              label="Payment Mode"
              value={form.paymentMode}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  paymentMode: v,
                }))
              }
              options={
                expensePaymentMethods.length > 0
                  ? expensePaymentMethods
                  : ["Cash", "UPI & QR Code", "Bank Transfer", "Credit / Debit Card"]
              }
            />

            <Select
              label="Status"
              value={form.status}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  status: v,
                }))
              }
              options={[
                "Paid",
                "Pending",
              ]}
            />

            {/* Reference */}
            <Input
              label="Reference / Receipt No."
              value={form.reference}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  reference: v,
                }))
              }
            />

            {/* Buttons */}
            <div className="flex gap-3 pt-2">

              <Btn
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>

              <Btn
                variant="primary"
                onClick={async () => {
                  const amountNum = Number(form.amount || 0);

                  // Validation
                  if (!form.category || !form.category.trim()) {
                    showToast("Category is required", "error");
                    return;
                  }

                  if (!form.description.trim()) {
                    showToast("Description is required", "error");
                    return;
                  }

                  if (!Number.isFinite(amountNum) || amountNum <= 0) {
                    showToast("Amount must be greater than 0", "error");
                    return;
                  }

                  try {
                    const payload = {
                      category: form.category.trim(),
                      description: form.description.trim(),
                      amount: amountNum,
                      date: form.date,
                      paymentMode: form.paymentMode,
                      reference: form.reference.trim(),
                      status: form.status,
                    };

                    if (editingExpenseId) {
                      const data = await updateExpense(editingExpenseId, payload);
                      setExpenseList((prev) =>
                        prev.map((item) =>
                          (item.id || item._id) === editingExpenseId ? data.expense : item
                        )
                      );
                      showToast("Expense updated successfully", "success");
                    } else {
                      const data = await createExpense(payload);
                      setExpenseList((prev) => [data.expense, ...prev]);
                      showToast("Expense saved successfully", "success");
                    }

                    setShowModal(false);
                    resetForm();
                  } catch (error) {
                    console.error("SAVE EXPENSE ERROR:", error);

                    showToast(
                      error.message || "Unable to save expense",
                      "error"
                    );
                  }
                }}
                className="flex-1 justify-center"
              >
                {editingExpenseId ? "Update Expense" : "Save Expense"}
              </Btn>

            </div>
          </div>
        </Modal>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Total Expenses */}
        <div className="bg-card text-card-foreground rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Expenses
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-1 font-mono">
              {formatCurrency(totalExpenses)}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50 mt-3">
              <span>This month</span>
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {expenseList.length === 0
                  ? "No expenses added"
                  : `${expenseList.length} recorded`}
              </span>
            </div>
          </div>
        </div>

        {/* Pending Payments */}
        <div className="bg-card text-card-foreground rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Payments
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/50">
              <Clock3 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-1 font-mono">
              {formatCurrency(pendingAmount)}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50 mt-3">
              <span>
                {pendingExpenses.length} payment{pendingExpenses.length !== 1 ? "s" : ""} pending
              </span>
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  pendingExpenses.length > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {pendingExpenses.length === 0 ? (
                  <>
                    <CircleCheck className="w-3.5 h-3.5" />
                    All payments cleared
                  </>
                ) : (
                  <>
                    <Clock3 className="w-3.5 h-3.5" />
                    Action required
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Expense History Section */}
      <Card className="overflow-hidden">

        {/* Header */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              Expense History
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track and manage your business expenses
            </p>
          </div>

          <Btn
            variant="primary"
            size="md"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Expense
          </Btn>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">

            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Description</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Mode</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/60">

              {expenseList.length === 0 ? (

                <tr key="empty-state">
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3.5 border border-slate-200/80 dark:border-slate-700/80">
                        <Receipt className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground mb-1">
                        No expenses yet
                      </h4>
                      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                        Start tracking your business expenses by adding your first expense.
                      </p>
                      <Btn
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          resetForm();
                          setShowModal(true);
                        }}
                        icon={<Plus className="w-4 h-4" />}
                      >
                        Add Expense
                      </Btn>
                    </div>
                  </td>
                </tr>

              ) : (

                expenseList.map((e) => (

                  <tr
                    key={e.id || e._id || Math.random()}
                    className="hover:bg-muted/40 transition-colors"
                  >

                    <td className="px-5 py-4 whitespace-nowrap">
                      {getCategoryBadge(e.category)}
                    </td>

                    <td className="px-5 py-4 font-medium text-foreground">
                      {e.description}
                    </td>

                    <td className="px-5 py-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {formatDate(e.date)}
                    </td>

                    <td className="px-5 py-4 font-bold text-foreground font-mono text-sm whitespace-nowrap">
                      {formatCurrency(e.amount)}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      {getPaymentModeBadge(e.paymentMode)}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      {renderStatusBadge(e.status)}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditExpense(e)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Expense"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(e.id || e._id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>
        </div>

      </Card>

    </div>
  );
}


