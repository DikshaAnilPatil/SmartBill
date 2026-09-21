import { useEffect, useState } from "react";
import { Check, Edit2, Mail, Phone, Users, Package, FileText, TrendingUp, Building2 } from "lucide-react";
import { Badge, Btn, Card, Input, Select } from "@shared/components/common/ui";
import { getUserDisplayName, getUserInitials, setUserToStorage } from "@shared/utils/userUtils";
import { getProfile, updateProfile } from "@shared/api/authAPI";
import { fetchCustomers } from "@shared/api/customerAPI";
import { getProducts } from "@shared/api/productAPI";
import { fetchOrders } from "@shared/api/orderAPI";
import { RETAIL_CATEGORIES, WHOLESALE_CATEGORIES } from "@shared/utils/businessCategories";

export default function ProfileScreen() {
  const [profileUser, setProfileUser] = useState(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    businessName: "",
    businessType: "Retail",
    businessCategory: "General Retail / Other",
    email: "",
    phone: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Account summary live counts
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // ======================================================
  // LOAD CURRENT LOGGED-IN USER
  // ======================================================

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError("");
        setMessage("");

        const response = await getProfile();

        if (!response?.user) {
          throw new Error("User profile could not be loaded.");
        }

        const currentUser = response.user;

        // Backend user is the ONLY source of profile data.
        setProfileUser(currentUser);

        const bType = currentUser.businessType || "Retail";
        const defaultCat = bType === "Wholesale" ? WHOLESALE_CATEGORIES[0] : RETAIL_CATEGORIES[0];

        setFormData({
          firstName: currentUser.firstName || "",
          lastName: currentUser.lastName || "",
          businessName: currentUser.businessName || "",
          businessType: bType,
          businessCategory: currentUser.businessCategory || defaultCat,
          email: currentUser.email || "",
          phone: currentUser.phone || "",
        });

        // Keep localStorage synchronized with backend.
        setUserToStorage(currentUser);
      } catch (err) {
        console.error("LOAD PROFILE ERROR:", err);

        setError(
          err?.message ||
            "Unable to load your profile. Please login again."
        );
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // ======================================================
  // LOAD LIVE ACCOUNT SUMMARY
  // ======================================================

  useEffect(() => {
    const loadSummary = async () => {
      setSummaryLoading(true);
      try {
        const [customersRes, productsRes, ordersRes] = await Promise.allSettled([
          fetchCustomers(),
          getProducts(),
          fetchOrders(),
        ]);

        const customers = customersRes.status === "fulfilled"
          ? (customersRes.value?.customers ?? [])
          : [];
        const products = productsRes.status === "fulfilled"
          ? (productsRes.value?.products ?? [])
          : [];
        const orders = ordersRes.status === "fulfilled"
          ? (ordersRes.value?.orders ?? [])
          : [];

        const totalRevenue = orders.reduce(
          (sum, o) => sum + Number(o.amountPaid || 0),
          0
        );

        setSummary({
          customers: customers.length,
          products: products.filter((p) => p.stock > 0 || p.quantity > 0).length || products.length,
          invoices: orders.length,
          revenue: totalRevenue,
        });
      } catch (err) {
        console.error("SUMMARY LOAD ERROR:", err);
        setSummary({ customers: 0, products: 0, invoices: 0, revenue: 0 });
      } finally {
        setSummaryLoading(false);
      }
    };

    loadSummary();
  }, []);

  // ======================================================
  // HANDLE INPUT CHANGE
  // ======================================================

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    setMessage("");
    setError("");
  };

  // ======================================================
  // UPDATE CURRENT LOGGED-IN USER
  // ======================================================

  const handleUpdateProfile = async () => {
    try {
      setSaving(true);
      setMessage("");
      setError("");

      const response = await updateProfile(formData);

      if (!response?.user) {
        throw new Error("Profile update failed.");
      }

      const updatedUser = response.user;

      // Update the profile displayed on this screen.
      setProfileUser(updatedUser);

      setFormData({
        firstName: updatedUser.firstName || "",
        lastName: updatedUser.lastName || "",
        businessName: updatedUser.businessName || "",
        businessType: updatedUser.businessType || "Retail",
        businessCategory: updatedUser.businessCategory || (updatedUser.businessType === "Wholesale" ? WHOLESALE_CATEGORIES[0] : RETAIL_CATEGORIES[0]),
        email: updatedUser.email || "",
        phone: updatedUser.phone || "",
      });

      // Update stored user.
      setUserToStorage(updatedUser);

      window.dispatchEvent(new Event("userUpdated"));
      window.dispatchEvent(new Event("businessInfoUpdated"));

      // Backend returns a fresh JWT.
      if (response.token) {
        localStorage.setItem("smartbill_token", response.token);
      }

      setMessage(
        response.message || "Profile updated successfully."
      );
    } catch (err) {
      console.error("UPDATE PROFILE ERROR:", err);

      setError(
        err?.message || "Unable to update your profile."
      );
    } finally {
      setSaving(false);
    }
  };

  // ======================================================
  // DISPLAY DATA
  // ======================================================

  const displayName = profileUser
    ? getUserDisplayName(profileUser)
    : "User";

  const initials = profileUser
    ? getUserInitials(displayName)
    : "U";

  const businessName =
    profileUser?.businessName || formData.businessName || "SmartBill";

  const roleTitle =
    profileUser?.role === "superadmin"
      ? "Super Admin"
      : "Business Owner";

  // ======================================================
  // LOADING
  // ======================================================

  if (loading) {
    return (
      <div className="max-w-2xl">
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Loading profile...
          </p>
        </Card>
      </div>
    );
  }

  // ======================================================
  // ERROR
  // ======================================================

  if (error && !profileUser) {
    return (
      <div className="max-w-2xl">
        <Card className="p-6">
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm font-medium text-red-700">
              {error}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // ======================================================
  // UI
  // ======================================================

  return (
    <div className="max-w-2xl space-y-5">

      {/* ================= PROFILE CARD ================= */}

      <Card className="p-6">

        <div className="flex items-start gap-5 mb-6">

          <div className="relative">

            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
              <span className="text-xl font-bold text-white">
                {initials}
              </span>
            </div>

            <button
              type="button"
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm hover:bg-slate-50"
            >
              <Edit2 className="w-3 h-3 text-slate-600" />
            </button>

          </div>

          <div>

            <h3 className="font-bold text-slate-900 text-lg">
              {displayName}
            </h3>

            <p className="text-sm text-slate-500">
              {roleTitle} · {businessName}
            </p>

            <Badge
              label="Pro Plan"
              variant="blue"
            />

          </div>

        </div>

        {/* ================= FORM ================= */}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <Input
            label="First Name"
            value={formData.firstName}
            onChange={(e) =>
              handleChange("firstName", e.target.value)
            }
          />

          <Input
            label="Last Name"
            value={formData.lastName}
            onChange={(e) =>
              handleChange("lastName", e.target.value)
            }
          />

          <Input
            label="Business Name"
            value={formData.businessName}
            onChange={(e) =>
              handleChange("businessName", e.target.value)
            }
          />

          <Select
            label="Business Model / Type"
            value={formData.businessType}
            onChange={(newType) => {
              handleChange("businessType", newType);
              handleChange(
                "businessCategory",
                newType === "Wholesale" ? WHOLESALE_CATEGORIES[0] : RETAIL_CATEGORIES[0]
              );
            }}
            options={["Retail", "Wholesale"]}
          />

          <div className="md:col-span-2">
            <Select
              label="Business Industry / Sector Category"
              value={formData.businessCategory}
              onChange={(newCat) => handleChange("businessCategory", newCat)}
              options={formData.businessType === "Wholesale" ? WHOLESALE_CATEGORIES : RETAIL_CATEGORIES}
            />
          </div>

          <Input
            label="Email"
            value={formData.email}
            onChange={(e) =>
              handleChange("email", e.target.value)
            }
            icon={<Mail className="w-4 h-4" />}
          />

          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) =>
              handleChange("phone", e.target.value)
            }
            icon={<Phone className="w-4 h-4" />}
          />

        </div>

        {/* ================= SUCCESS ================= */}

        {message && (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
            <p className="text-sm text-green-700">
              {message}
            </p>
          </div>
        )}

        {/* ================= ERROR ================= */}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* ================= UPDATE ================= */}

        <Btn
          variant="primary"
          className="mt-5"
          icon={<Check className="w-4 h-4" />}
          onClick={handleUpdateProfile}
          disabled={saving}
        >
          {saving ? "Updating..." : "Update Profile"}
        </Btn>

      </Card>

      {/* ================= ACCOUNT SUMMARY ================= */}

      <Card className="p-6">

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Account Summary</h3>
          {summaryLoading && (
            <span className="text-xs text-slate-400 animate-pulse">Loading live data...</span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          {/* Customers */}
          <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
            <div className="flex justify-center mb-1.5">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-700">
              {summaryLoading ? (
                <span className="inline-block w-10 h-6 bg-blue-200 rounded animate-pulse" />
              ) : (
                (summary?.customers ?? 0).toLocaleString("en-IN")
              )}
            </p>
            <p className="text-xs text-blue-500 mt-0.5 font-medium">Customers</p>
          </div>

          {/* Products Active */}
          <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
            <div className="flex justify-center mb-1.5">
              <Package className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-700">
              {summaryLoading ? (
                <span className="inline-block w-10 h-6 bg-emerald-200 rounded animate-pulse" />
              ) : (
                (summary?.products ?? 0).toLocaleString("en-IN")
              )}
            </p>
            <p className="text-xs text-emerald-500 mt-0.5 font-medium">Products</p>
          </div>

          {/* Invoices */}
          <div className="bg-violet-50 rounded-xl p-4 text-center border border-violet-100">
            <div className="flex justify-center mb-1.5">
              <FileText className="w-5 h-5 text-violet-500" />
            </div>
            <p className="text-2xl font-bold text-violet-700">
              {summaryLoading ? (
                <span className="inline-block w-10 h-6 bg-violet-200 rounded animate-pulse" />
              ) : (
                (summary?.invoices ?? 0).toLocaleString("en-IN")
              )}
            </p>
            <p className="text-xs text-violet-500 mt-0.5 font-medium">Invoices</p>
          </div>

          {/* Total Revenue */}
          <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
            <div className="flex justify-center mb-1.5">
              <TrendingUp className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-700">
              {summaryLoading ? (
                <span className="inline-block w-16 h-6 bg-amber-200 rounded animate-pulse" />
              ) : (
                `₹${(summary?.revenue ?? 0).toLocaleString("en-IN")}`
              )}
            </p>
            <p className="text-xs text-amber-500 mt-0.5 font-medium">Revenue Collected</p>
          </div>

        </div>

      </Card>

    </div>
  );
}


