import React, { useState } from "react";
import {
  Shield,
  Users,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Key,
  Building2,
  BarChart3,
  CreditCard,
  Settings as SettingsIcon,
  Activity,
  Check,
  X,
  UserPlus,
  ShieldAlert,
  Info,
  Clock,
  Sparkles,
  ChevronRight,
  Eye,
  Sliders
} from "lucide-react";
import { toast } from "sonner";

// Initial Standard & Custom Roles Data
const INITIAL_ROLES = [
  {
    id: "super_admin",
    name: "Super Admin",
    color: "blue",
    description: "Full, unrestricted access to all modules, billing, and system configurations.",
    isSystem: true,
    userCount: 1,
    permissions: {
      vendors: { view: true, create: true, edit: true, delete: true, suspend: true },
      revenue: { view: true, export: true },
      subscriptions: { view: true, manage: true },
      admin_roles: { view: true, create: true, edit: true, delete: true },
      settings: { view: true, edit: true }
    }
  },
  {
    id: "support_admin",
    name: "Support Admin",
    color: "blue",
    description: "Can manage vendor accounts and handle support tickets without destructive deletion rights.",
    isSystem: false,
    userCount: 0,
    permissions: {
      vendors: { view: true, create: true, edit: true, delete: false, suspend: true },
      revenue: { view: true, export: false },
      subscriptions: { view: true, manage: false },
      admin_roles: { view: false, create: false, edit: false, delete: false },
      settings: { view: false, edit: false }
    }
  },
  {
    id: "billing_admin",
    name: "Billing Admin",
    color: "emerald",
    description: "Dedicated access to financial metrics, subscription plans, and invoice management.",
    isSystem: false,
    userCount: 0,
    permissions: {
      vendors: { view: true, create: false, edit: false, delete: false, suspend: false },
      revenue: { view: true, export: true },
      subscriptions: { view: true, manage: true },
      admin_roles: { view: false, create: false, edit: false, delete: false },
      settings: { view: true, edit: false }
    }
  }
];

// Initial Internal Admins Data (Only primary Super Admin user)
const INITIAL_ADMINS = [
  {
    id: "adm-1",
    name: "Prathamesh Bhavsar",
    email: "prathamesh@smartbill.io",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    roleId: "super_admin",
    department: "Executive & Tech",
    status: "Active",
    lastActive: "Just now",
    createdAt: "2025-01-10"
  }
];

// Initial Audit Logs Data
const INITIAL_LOGS = [
  {
    id: "log-1",
    user: "Prathamesh Bhavsar",
    role: "Super Admin",
    action: "System Initialized",
    details: "Initialized Admin & Custom Roles module.",
    timestamp: "Just now",
    ip: "192.168.1.45"
  }
];

const COLOR_CLASSES = {
  purple: {
    badge: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    cardBg: "from-blue-500/5 to-cyan-500/5 border-blue-200 dark:border-blue-900/50",
    dot: "bg-blue-500"
  },
  blue: {
    badge: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    cardBg: "from-blue-500/5 to-cyan-500/5 border-blue-200 dark:border-blue-900/50",
    dot: "bg-blue-500"
  },
  emerald: {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    cardBg: "from-emerald-500/5 to-teal-500/5 border-emerald-200 dark:border-emerald-900/50",
    dot: "bg-emerald-500"
  },
  amber: {
    badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    cardBg: "from-amber-500/5 to-orange-500/5 border-amber-200 dark:border-amber-900/50",
    dot: "bg-amber-500"
  },
  rose: {
    badge: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    cardBg: "from-rose-500/5 to-pink-500/5 border-rose-200 dark:border-rose-900/50",
    dot: "bg-rose-500"
  }
};

const MODULE_DEFINITIONS = [
  { key: "vendors", label: "Vendors & Businesses", icon: Building2, description: "Manage business profiles, status, and verification." },
  { key: "revenue", label: "Revenue & Analytics", icon: BarChart3, description: "View platform revenue dashboards and financial reports." },
  { key: "subscriptions", label: "Subscriptions & Plans", icon: CreditCard, description: "Manage pricing tiers, subscriptions, and trials." },
  { key: "admin_roles", label: "Admin & Roles Management", icon: Shield, description: "Manage internal admin staff, roles, and security permissions." },
  { key: "settings", label: "System Settings", icon: SettingsIcon, description: "Configure system defaults, email services, and APIs." }
];

export default function AdminRolesScreen() {
  const [activeTab, setActiveTab] = useState("admins"); // "admins" | "roles" | "logs"

  // Persistent State via localStorage
  const [roles, setRoles] = useState(() => {
    try {
      const saved = localStorage.getItem("smartbill_admin_roles");
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasSupport = parsed.some((r) => r.id === "support_admin");
        const hasBilling = parsed.some((r) => r.id === "billing_admin");
        if (!hasSupport || !hasBilling) {
          return INITIAL_ROLES;
        }
        return parsed;
      }
      return INITIAL_ROLES;
    } catch {
      return INITIAL_ROLES;
    }
  });

  const [admins, setAdmins] = useState(() => {
    try {
      const saved = localStorage.getItem("smartbill_admin_users");
      return saved ? JSON.parse(saved) : INITIAL_ADMINS;
    } catch {
      return INITIAL_ADMINS;
    }
  });

  const [logs, setLogs] = useState(() => {
    try {
      const saved = localStorage.getItem("smartbill_audit_logs");
      return saved ? JSON.parse(saved) : INITIAL_LOGS;
    } catch {
      return INITIAL_LOGS;
    }
  });

  // Fetch real admin staff from backend API on mount
  React.useEffect(() => {
    async function fetchStaff() {
      try {
        const { default: axiosClient } = await import("@shared/api/axiosClient");
        const res = await axiosClient.get("/admin/staff");
        if (res.data?.data && Array.isArray(res.data.data)) {
          setAdmins(res.data.data);
        }
      } catch (err) {
        console.warn("Could not fetch staff from backend:", err.message);
      }
    }
    fetchStaff();
  }, []);

  // Sync state changes to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem("smartbill_admin_roles", JSON.stringify(roles));
    } catch (e) {
      console.error(e);
    }
  }, [roles]);

  React.useEffect(() => {
    try {
      localStorage.setItem("smartbill_admin_users", JSON.stringify(admins));
    } catch (e) {
      console.error(e);
    }
  }, [admins]);

  React.useEffect(() => {
    try {
      localStorage.setItem("smartbill_audit_logs", JSON.stringify(logs));
    } catch (e) {
      console.error(e);
    }
  }, [logs]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);

  const [activeMenuId, setActiveMenuId] = useState(null);

  // Form states for Role Modal
  const [roleForm, setRoleForm] = useState({
    name: "",
    color: "blue",
    description: "",
    permissions: {
      vendors: { view: true, create: false, edit: false, delete: false, suspend: false },
      revenue: { view: false, export: false },
      subscriptions: { view: false, manage: false },
      admin_roles: { view: false, create: false, edit: false, delete: false },
      settings: { view: false, edit: false }
    }
  });

  // Form states for Admin Modal
  const [adminForm, setAdminForm] = useState({
    name: "",
    email: "",
    department: "",
    roleId: "support_admin",
    status: "Active"
  });

  // Helper to open Role Modal
  const handleOpenRoleModal = (roleToEdit = null) => {
    if (roleToEdit) {
      setEditingRole(roleToEdit);
      setRoleForm({
        name: roleToEdit.name,
        color: roleToEdit.color,
        description: roleToEdit.description,
        permissions: JSON.parse(JSON.stringify(roleToEdit.permissions))
      });
    } else {
      setEditingRole(null);
      setRoleForm({
        name: "",
        color: "blue",
        description: "",
        permissions: {
          vendors: { view: true, create: true, edit: true, delete: false, suspend: false },
          revenue: { view: true, export: false },
          subscriptions: { view: true, manage: false },
          admin_roles: { view: false, create: false, edit: false, delete: false },
          settings: { view: false, edit: false }
        }
      });
    }
    setShowRoleModal(true);
  };

  // Save Role
  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      toast.error("Please provide a role name.");
      return;
    }

    if (editingRole) {
      // Update existing role definition
      setRoles((prev) =>
        prev.map((r) =>
          r.id === editingRole.id
            ? { ...r, name: roleForm.name, color: roleForm.color, description: roleForm.description, permissions: roleForm.permissions }
            : r
        )
      );

      // Sync updated role permissions to all staff users assigned to this roleId in MongoDB
      try {
        const { default: axiosClient } = await import("@shared/api/axiosClient");
        const res = await axiosClient.put(`/admin/roles/${editingRole.id}`, {
          permissions: roleForm.permissions
        });
        if (res.data?.success) {
          toast.success(`Synced permissions to ${res.data.modifiedCount || 0} account(s) in MongoDB.`);
        }
      } catch (err) {
        console.warn("Syncing role permissions to backend staff failed:", err.message);
      }

      setAdmins((prev) =>
        prev.map((a) => (a.roleId === editingRole.id ? { ...a, permissions: roleForm.permissions } : a))
      );

      toast.success(`Role '${roleForm.name}' updated successfully.`);
      addAuditLog("Updated Role", `Modified permissions and details for role '${roleForm.name}'`);
    } else {
      // Create new custom role
      const newRoleObj = {
        id: `custom_role_${Date.now()}`,
        name: roleForm.name,
        color: roleForm.color,
        description: roleForm.description || "Custom assigned role.",
        isSystem: false,
        userCount: 0,
        permissions: roleForm.permissions
      };
      setRoles((prev) => [...prev, newRoleObj]);
      toast.success(`Custom Role '${roleForm.name}' created!`);
      addAuditLog("Created Role", `Created new custom role '${roleForm.name}'`);
    }

    setShowRoleModal(false);
  };

  // Delete Role
  const handleDeleteRole = (roleId, roleName) => {
    const roleObj = roles.find((r) => r.id === roleId);
    if (roleObj?.isSystem) {
      toast.error("System roles cannot be deleted.");
      return;
    }
    const assignedCount = admins.filter((a) => a.roleId === roleId).length;
    if (assignedCount > 0) {
      toast.error(`Cannot delete role '${roleName}'. ${assignedCount} admin(s) are currently assigned to it.`);
      return;
    }

    setRoles((prev) => prev.filter((r) => r.id !== roleId));
    toast.success(`Role '${roleName}' deleted.`);
    addAuditLog("Deleted Role", `Removed custom role '${roleName}'`);
  };

  // Helper to open Admin Modal
  const handleOpenAdminModal = (adminToEdit = null) => {
    if (adminToEdit) {
      setEditingAdmin(adminToEdit);
      setAdminForm({
        name: adminToEdit.name,
        email: adminToEdit.email,
        password: "",
        department: adminToEdit.department || "",
        roleId: adminToEdit.roleId,
        status: adminToEdit.status
      });
    } else {
      setEditingAdmin(null);
      setAdminForm({
        name: "",
        email: "",
        password: "Admin@1234",
        department: "Operations",
        roleId: roles[0]?.id || "support_admin",
        status: "Active"
      });
    }
    setShowAdminModal(true);
  };

  // Save Admin
  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    if (!adminForm.name.trim() || !adminForm.email.trim()) {
      toast.error("Name and Email are required.");
      return;
    }
    if (!editingAdmin && !adminForm.password) {
      toast.error("Password is required for creating a new admin.");
      return;
    }

    const selectedRoleObj = roles.find((r) => r.id === adminForm.roleId);
    const permissionsToAssign = selectedRoleObj?.permissions || {};

    if (editingAdmin) {
      // Edit existing staff user in backend
      try {
        const { default: axiosClient } = await import("@shared/api/axiosClient");
        await axiosClient.put(`/admin/staff/${editingAdmin.id || editingAdmin._id}`, {
          name: adminForm.name,
          department: adminForm.department,
          roleId: adminForm.roleId,
          status: adminForm.status,
          password: adminForm.password || undefined,
          permissions: permissionsToAssign
        });
      } catch (err) {
        console.warn("Backend API update failed, updating local state:", err.message);
      }

      setAdmins((prev) =>
        prev.map((a) => (a.id === editingAdmin.id || a._id === editingAdmin.id ? { ...a, ...adminForm, permissions: permissionsToAssign } : a))
      );
      toast.success(`Admin user '${adminForm.name}' updated.`);
      addAuditLog("Updated Admin", `Updated details for staff member '${adminForm.name}'`);
    } else {
      // Create new staff user in backend
      let newAdminObj = null;
      try {
        const { default: axiosClient } = await import("@shared/api/axiosClient");
        const res = await axiosClient.post("/admin/staff", {
          name: adminForm.name,
          email: adminForm.email,
          password: adminForm.password,
          roleId: adminForm.roleId,
          department: adminForm.department,
          status: adminForm.status,
          permissions: permissionsToAssign
        });
        if (res.data?.user) {
          newAdminObj = res.data.user;
        }
      } catch (err) {
        console.warn("Backend API not reachable, saving to local store:", err.message);
      }

      if (!newAdminObj) {
        newAdminObj = {
          id: `adm-${Date.now()}`,
          name: adminForm.name,
          email: adminForm.email,
          avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`,
          roleId: adminForm.roleId,
          department: adminForm.department || "Operations",
          status: adminForm.status,
          permissions: permissionsToAssign,
          lastActive: "Never",
          createdAt: new Date().toISOString().split("T")[0]
        };
      }

      setAdmins((prev) => [newAdminObj, ...prev]);

      // Update role user count
      setRoles((prev) =>
        prev.map((r) => (r.id === adminForm.roleId ? { ...r, userCount: r.userCount + 1 } : r))
      );

      toast.success(`Admin created for '${adminForm.email}'! Password: ${adminForm.password}`);
      addAuditLog("Invited Admin", `Created internal admin account for '${adminForm.name}' (${adminForm.email})`);
    }

    setShowAdminModal(false);
  };

  // Toggle Admin Status
  const handleToggleAdminStatus = async (admin) => {
    const newStatus = admin.status === "Active" ? "Suspended" : "Active";
    try {
      const { default: axiosClient } = await import("@shared/api/axiosClient");
      await axiosClient.put(`/admin/staff/${admin.id || admin._id}`, {
        status: newStatus
      });
    } catch (err) {
      console.warn("Backend status update failed:", err.message);
    }
    setAdmins((prev) =>
      prev.map((a) => (a.id === admin.id || a._id === admin._id ? { ...a, status: newStatus } : a))
    );
    toast.success(`Status for '${admin.name}' changed to ${newStatus}.`);
    addAuditLog("Admin Status Change", `Changed status of '${admin.name}' to ${newStatus}`);
  };

  // Delete Admin
  const handleDeleteAdmin = async (adminId, adminName) => {
    try {
      const { default: axiosClient } = await import("@shared/api/axiosClient");
      await axiosClient.delete(`/admin/staff/${adminId}`);
    } catch (err) {
      console.warn("Backend delete failed:", err.message);
    }
    setAdmins((prev) => prev.filter((a) => a.id !== adminId && a._id !== adminId));
    toast.success(`Admin user '${adminName}' removed.`);
    addAuditLog("Deleted Admin", `Removed staff user account for '${adminName}'`);
  };

  // Password Reset Simulation
  const handleResetPassword = (adminName, email) => {
    toast.success(`Password reset link sent to ${email}`);
    addAuditLog("Password Reset", `Issued password reset link for '${adminName}'`);
  };

  // Audit Log Helper
  const addAuditLog = (action, details) => {
    const newLog = {
      id: `log-${Date.now()}`,
      user: "Prathamesh Bhavsar",
      role: "Super Admin",
      action,
      details,
      timestamp: "Just now",
      ip: "192.168.1.45"
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  // Filtered Admins List
  const filteredAdmins = admins.filter((admin) => {
    const matchesSearch =
      admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      admin.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || admin.roleId === roleFilter;
    const matchesStatus = statusFilter === "all" || admin.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Stat Overview */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin & Role Management</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure internal staff access levels, define custom roles, and track admin audit trails.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Header Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenAdminModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-600/20 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Internal Admin</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("admins")}
            className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "admins"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Internal Admins</span>
            <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full font-bold">
              {admins.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("roles")}
            className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "roles"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Roles & Permissions Matrix</span>
            <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full font-bold">
              {roles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "logs"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Audit & Activity Log</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ADMINS DIRECTORY TABLE */}
      {activeTab === "admins" && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search admin name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-500 dark:text-slate-400">Role:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">All Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Admin Staff Member</th>
                    <th className="px-6 py-3.5">Assigned Role</th>
                    <th className="px-6 py-3.5">Department</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Last Active</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        No internal admins found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAdmins.map((admin) => {
                      const roleObj = roles.find((r) => r.id === admin.roleId) || roles[0];
                      const colorStyle = COLOR_CLASSES[roleObj?.color || "blue"];

                      return (
                        <tr
                          key={admin.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={admin.avatar}
                                alt={admin.name}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                              />
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  {admin.name}
                                  {roleObj?.id === "super_admin" && (
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-500">{admin.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${colorStyle.badge}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${colorStyle.dot}`}></span>
                              {roleObj?.name}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">
                            {admin.department}
                          </td>
                          <td className="px-6 py-4">
                            {admin.status === "Active" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-500 dark:text-rose-400 font-semibold text-[11px]">
                                <XCircle className="w-3.5 h-3.5" />
                                Suspended
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-[11px]">
                            {admin.lastActive}
                          </td>
                          <td className="px-6 py-4 text-right relative">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenAdminModal(admin)}
                                title="Edit Role / Info"
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleResetPassword(admin.name, admin.email)}
                                title="Reset Password"
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleToggleAdminStatus(admin)}
                                title={admin.status === "Active" ? "Suspend Admin" : "Activate Admin"}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  admin.status === "Active"
                                    ? "text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                    : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                }`}
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                              </button>

                              {roleObj?.id !== "super_admin" && (
                                <button
                                  onClick={() => handleDeleteAdmin(admin.id, admin.name)}
                                  title="Delete Account"
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS MATRIX */}
      {activeTab === "roles" && (
        <div className="space-y-8">
          {/* Roles Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {roles.map((role) => {
              const colorStyle = COLOR_CLASSES[role.color || "blue"];
              const memberCount = admins.filter((a) => a.roleId === role.id).length;

              return (
                <div
                  key={role.id}
                  className={`p-5 rounded-2xl border bg-gradient-to-br ${colorStyle.cardBg} bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between relative group hover:shadow-md transition-all`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${colorStyle.badge}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${colorStyle.dot}`}></span>
                        {role.name}
                      </span>

                      {role.isSystem ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                          <Lock className="w-3 h-3" /> System Role
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenRoleModal(role)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded cursor-pointer"
                            title="Edit Role"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRole(role.id, role.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Delete Role"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                      {role.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {memberCount} assigned admin{memberCount !== 1 ? "s" : ""}
                    </span>

                    <button
                      onClick={() => handleOpenRoleModal(role)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
                    >
                      Config Matrix <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Granular Permissions Matrix Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  Full Feature Permission Matrix
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Compare module access capabilities across active system and custom roles.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Module & Access Scope</th>
                    {roles.map((r) => (
                      <th key={r.id} className="px-6 py-4 text-center">
                        {r.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {MODULE_DEFINITIONS.map((mod) => {
                    const ModIcon = mod.icon;

                    return (
                      <tr key={mod.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 mt-0.5">
                              <ModIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white text-xs">{mod.label}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">{mod.description}</p>
                            </div>
                          </div>
                        </td>

                        {roles.map((role) => {
                          const p = role.permissions?.[mod.key] || {};
                          const hasAny = Object.values(p).some((val) => val === true);
                          const hasAll = Object.values(p).every((val) => val === true);

                          return (
                            <td key={role.id} className="px-6 py-4 text-center align-middle">
                              {hasAll ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full text-[11px] border border-emerald-200 dark:border-emerald-800">
                                  <Check className="w-3.5 h-3.5" /> Full Access
                                </span>
                              ) : hasAny ? (
                                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full text-[11px] border border-amber-200 dark:border-amber-800">
                                  <Info className="w-3.5 h-3.5" /> Partial Access
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-[11px]">
                                  <X className="w-3.5 h-3.5" /> No Access
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT & ACTIVITY LOG */}
      {activeTab === "logs" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                Internal Admin Security & Action Feed
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time log of security events, permission modifications, and administrative updates.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map((log) => (
              <div key={log.id} className="py-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-blue-100 dark:border-blue-900">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900 dark:text-white text-xs">{log.user}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                        {log.role}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{log.action}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{log.details}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-[11px] text-slate-400 flex items-center justify-end gap-1 font-mono">
                    <Clock className="w-3 h-3" /> {log.timestamp}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">IP: {log.ip}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE / EDIT ROLE MODAL */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                {editingRole ? `Edit Role: ${editingRole.name}` : "Create Custom Admin Role"}
              </h3>
              <button
                onClick={() => setShowRoleModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Basic Meta Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Role Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Regional Support Lead"
                    value={roleForm.name}
                    onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Badge Color Theme
                  </label>
                  <select
                    value={roleForm.color}
                    onChange={(e) => setRoleForm({ ...roleForm, color: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="blue">Blue</option>
                    <option value="emerald">Emerald Green</option>
                    <option value="amber">Amber Orange</option>
                    <option value="rose">Rose Red</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="Briefly state what staff members assigned to this role can access..."
                    value={roleForm.description}
                    onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Granular Permission Checkboxes */}
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-white mb-3">
                  Assign Granular Module Permissions
                </label>
                <div className="space-y-3">
                  {MODULE_DEFINITIONS.map((mod) => {
                    const modKey = mod.key;
                    const modPerms = roleForm.permissions[modKey] || {};

                    return (
                      <div
                        key={modKey}
                        className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                            {mod.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-4 pt-1">
                          {Object.keys(modPerms).map((actionKey) => (
                            <label
                              key={actionKey}
                              className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 capitalize cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={!!modPerms[actionKey]}
                                onChange={(e) => {
                                  const updated = {
                                    ...roleForm.permissions,
                                    [modKey]: {
                                      ...roleForm.permissions[modKey],
                                      [actionKey]: e.target.checked
                                    }
                                  };
                                  setRoleForm({ ...roleForm, permissions: updated });
                                }}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              <span>{actionKey}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md cursor-pointer"
                >
                  {editingRole ? "Save Role Changes" : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT ADMIN MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                {editingAdmin ? `Edit Admin: ${editingAdmin.name}` : "Invite Internal Admin Staff"}
              </h3>
              <button
                onClick={() => setShowAdminModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdmin} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane Cooper"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Official Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. jane@smartbill.io"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Login Password {!editingAdmin && "*"}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const pass = `Admin@${Math.floor(1000 + Math.random() * 9000)}`;
                      setAdminForm({ ...adminForm, password: pass });
                      toast.info(`Generated password: ${pass}`);
                    }}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Auto Generate
                  </button>
                </div>
                <input
                  type="text"
                  required={!editingAdmin}
                  placeholder="Set initial login password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Department / Team
                </label>
                <input
                  type="text"
                  placeholder="e.g. Customer Support, Finance"
                  value={adminForm.department}
                  onChange={(e) => setAdminForm({ ...adminForm, department: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Assign Role
                  </label>
                  <select
                    value={adminForm.roleId}
                    onChange={(e) => setAdminForm({ ...adminForm, roleId: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Account Status
                  </label>
                  <select
                    value={adminForm.status}
                    onChange={(e) => setAdminForm({ ...adminForm, status: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md cursor-pointer"
                >
                  {editingAdmin ? "Update Admin" : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
