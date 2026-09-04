import { useState, useEffect } from "react";
import {
  Edit2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCircle,
} from "lucide-react";
import {
  Btn,
  Card,
  ConfirmDialog,
  Input,
  Modal,
  Select,
  Toast,
  statusBadge,
  EmptyState,
} from "@shared/components/common/ui";

import {
  MODULE_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
} from "@shared/utils/permissions";
import { PERMISSION_CATEGORIES } from "../settings/components/UserPermissionsSettings";
import {
  fetchEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "@shared/api/employeeAPI";
import subscriptionAPI from "@shared/api/subscriptionAPI";

export default function UsersScreen({ user }) {
  const [employeeList, setEmployeeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetchEmployees();
      if (res.employees) {
        setEmployeeList(res.employees);
      }
    } catch (err) {
      console.error("Error loading employees:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    subscriptionAPI.getSubscriptionStatus().then(setSubscriptionStatus).catch(() => {});
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Cashier");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [permissions, setPermissions] = useState({
    ...ROLE_DEFAULT_PERMISSIONS.Cashier,
  });
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setEmail("");
    setRole("Cashier");
    setDepartment("");
    setPhone("");
    setPassword("");
    setShowPassword(false);
    setPermissions({ ...ROLE_DEFAULT_PERMISSIONS.Cashier });
    setEmailError("");
    setPhoneError("");
    setPasswordError("");
  };

  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);
    const defaults =
      ROLE_DEFAULT_PERMISSIONS[selectedRole] ||
      ROLE_DEFAULT_PERMISSIONS.Cashier;
    setPermissions({ ...defaults });
  };

  const togglePermission = (modKey) => {
    setPermissions((prev) => ({
      ...prev,
      [modKey]: !prev[modKey],
    }));
  };

  const handleSaveEmployee = async () => {
    let valid = true;
    setEmailError("");
    setPhoneError("");
    setPasswordError("");

    // Validate Email
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("Email address is required.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    }

    // Validate Password for new employee
    if (!editingId && (!password || password.trim().length < 4)) {
      setPasswordError("Password must be at least 4 characters.");
      valid = false;
    }

    // Validate Phone (optional but if provided must be 10 digits)
    const digits = phone.replace(/\D/g, "");
    if (phone && digits.length !== 10) {
      setPhoneError("Phone number must be 10 digits.");
      valid = false;
    }

    if (!valid) return;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        email: trimmedEmail,
        phone: digits,
        role,
        department,
        password: password || undefined,
        permissions,
        status: "Active",
      };

      if (editingId) {
        const res = await updateEmployee(editingId, payload);
        showToast(res.message || "Employee updated successfully.", "success");
      } else {
        const res = await createEmployee(payload);
        showToast(res.message || "Employee created successfully.", "success");
      }

      await loadEmployees();
      resetForm();
      setShowModal(false);
    } catch (err) {
      console.error("Save employee error:", err);
      if (err.field === "email" || err.message?.includes("email")) {
        setEmailError(err.message || "Email error");
      } else {
        showToast(err.message || "Failed to save employee.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (employee) => {
    resetForm();
    setName(employee.name || `${employee.firstName || ""} ${employee.lastName || ""}`.trim());
    setEmail(employee.email || "");
    setRole(employee.role || "Cashier");
    setDepartment(employee.department || "");
    setPhone(employee.phone || "");
    setPassword("");

    if (employee.permissions && typeof employee.permissions === "object") {
      setPermissions({
        ...ROLE_DEFAULT_PERMISSIONS.Cashier,
        ...employee.permissions,
      });
    } else {
      const defaults =
        ROLE_DEFAULT_PERMISSIONS[employee.role] ||
        ROLE_DEFAULT_PERMISSIONS.Cashier;
      setPermissions({ ...defaults });
    }

    setEditingId(employee.id || employee._id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this employee?")) {
      try {
        const res = await deleteEmployee(id);
        showToast(res.message || "Employee deleted.", "success");
        await loadEmployees();
      } catch (err) {
        console.error("Delete employee error:", err);
        showToast(err.message || "Failed to delete employee.", "error");
      }
    }
  };

  const currentUser = user || (() => {
    try {
      return JSON.parse(localStorage.getItem("smartbill_user"));
    } catch {
      return null;
    }
  })();

  const userCount = 1 + (employeeList ? employeeList.length : 0);
  const maxUsers = subscriptionStatus?.plan
    ? (subscriptionStatus.plan.maxUsers == null ? Infinity : subscriptionStatus.plan.maxUsers)
    : Infinity;
  const isUserLimitReached = maxUsers !== Infinity && userCount >= maxUsers;

  return (
    <div className="space-y-5">
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {showModal && (
        <Modal
          title={editingId ? "Update Employee" : "Add Employee Profile"}
          className="max-w-3xl"
          onClose={() => {
            resetForm();
            setShowModal(false);
          }}
        >
          <div className="space-y-8">
            
            {/* Section: Basic Information */}
            <div className="bg-white">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <UserCircle className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 tracking-wide">Personal Details</h4>
                  <p className="text-[11px] text-slate-500">Employee's core contact information</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  value={name}
                  onChange={setName}
                />
                <Input
                  label="Email Address"
                  value={email}
                  onChange={(val) => {
                    setEmail(val);
                    if (emailError) setEmailError("");
                  }}
                  icon={<Mail className="w-4 h-4" />}
                  error={emailError}
                />
                <Input
                  label="Mobile Number"
                  value={phone}
                  onChange={(value) => {
                    const digits = value.replace(/\D/g, "");
                    if (digits.length <= 10) {
                      setPhone(digits);
                      if (phoneError) setPhoneError("");
                    }
                  }}
                  icon={<Phone className="w-4 h-4" />}
                  error={phoneError}
                />
                <Input
                  label="Department"
                  value={department}
                  onChange={setDepartment}
                />
              </div>
            </div>

            {/* Section: Security */}
            <div>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 tracking-wide">Security & Role</h4>
                  <p className="text-[11px] text-slate-500">Authentication and base role assignment</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Primary Role"
                  value={role}
                  onChange={handleRoleChange}
                  options={["Owner", "Manager", "Cashier", "Accountant"]}
                />
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {editingId ? "New Password (Optional)" : "Password"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (passwordError) setPasswordError("");
                      }}
                      className={`w-full border border-slate-200 rounded-lg bg-white text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all py-2.5 pl-3 pr-10 ${
                        passwordError ? "border-red-500 focus:ring-red-500 focus:border-red-500" : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                      title={showPassword ? "Hide Password" : "Show Password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-xs text-red-600 mt-0.5">{passwordError}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Section: Access Control */}
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 tracking-wide">
                      Module Access ({Object.values(permissions || {}).filter(Boolean).length} / {MODULE_PERMISSIONS.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">Fine-tune exactly what this employee can see and do</p>
                  </div>
                </div>
                
                {/* Presets */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                  <span className="text-[10px] font-semibold text-slate-500 pl-1 pr-2 uppercase">Presets:</span>
                  {["Cashier", "Manager", "Accountant"].map((pRole) => (
                    <button
                      key={pRole}
                      type="button"
                      onClick={() => handleRoleChange(pRole)}
                      className={`text-[10px] px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        role === pRole
                          ? "bg-white shadow-sm text-blue-700"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                      }`}
                    >
                      {pRole}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                {PERMISSION_CATEGORIES.map((cat) => (
                  <div
                    key={cat.category}
                    className="border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden bg-slate-50/50 dark:bg-slate-800/40"
                  >
                    <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                        {cat.category}
                      </span>
                    </div>
                    <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white dark:bg-slate-900">
                      {cat.modules.map((mod) => (
                        <label
                          key={mod.key}
                          className="flex items-start gap-2 p-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(permissions[mod.key])}
                            onChange={() => togglePermission(mod.key)}
                            className="accent-blue-600 rounded w-4 h-4 mt-0.5 cursor-pointer flex-shrink-0"
                          />
                          <div>
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-none mb-0.5">
                              {mod.label}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                              {mod.desc}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 pt-6 mt-4 border-t border-slate-100">
              <Btn
                variant="outline"
                onClick={() => {
                  resetForm();
                  setShowModal(false);
                }}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn variant="primary" size="lg" onClick={handleSaveEmployee} disabled={saving} className="flex-[2] justify-center text-base">
                {saving ? "Saving Profile..." : editingId ? "Update Employee Profile" : "Create Employee Profile"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {showLimitModal && (
        <Modal
          title="User Limit Reached"
          onClose={() => setShowLimitModal(false)}
          className="max-w-md"
        >
          <div className="text-center p-4">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Shield className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Upgrade Your Plan
            </h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              You have reached the maximum number of users allowed on your current plan ({maxUsers} users max). Please upgrade your plan to add more employees.
            </p>
            <div className="flex gap-3">
              <Btn
                variant="outline"
                className="flex-1 justify-center"
                onClick={() => setShowLimitModal(false)}
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                className="flex-1 justify-center bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setShowLimitModal(false);
                  window.location.hash = "#/settings";
                }}
              >
                Upgrade Plan
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      <div className="flex justify-end">
        <Btn
          variant={isUserLimitReached ? "outline" : "primary"}
          size="md"
          onClick={() => {
            if (isUserLimitReached) {
              setShowLimitModal(true);
              return;
            }
            resetForm();
            setShowModal(true);
          }}
          icon={<Plus className="w-4 h-4" />}
        >
          Add Employee {isUserLimitReached && `(Limit Reached)`}
        </Btn>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  "Employee",
                  "Email",
                  "Role",
                  "Department",
                  "Last Active",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {employeeList.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-slate-50 transition-colors group"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-blue-600">
                          {e.name
                            ? e.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                            : "?"}
                        </span>
                      </div>
                      <span className="font-medium text-slate-900">{e.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-xs">{e.email}</td>
                  <td className="px-5 py-4 text-slate-700 font-medium">
                    {e.role}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{e.department}</td>
                  <td className="px-5 py-4 text-slate-500 text-xs">
                    {e.lastActive}
                  </td>
                  <td className="px-5 py-4">{statusBadge(e.status)}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Btn
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(e)}
                        icon={<Edit2 className="w-3.5 h-3.5" />}
                      />
                      <Btn
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(e.id)}
                        icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}



