import { useState } from "react";
import { Lock, LogIn, Mail, AlertCircle, ShieldCheck, Check } from "lucide-react";
import { loginUser } from "@shared/api/authAPI";
import { setUserToStorage } from "@shared/utils/userUtils";
import { getCrmUrl } from "@shared/utils/urlUtils";
import { Input, Btn, Toast } from "@shared/components/common/ui";

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }
    
    setError("");
    setLoading(true);
    try {
      const data = await loginUser({ email: email.trim(), password });
      
      if (data.requireOtp) {
         setError("2FA is currently not supported on the lightweight admin login.");
         setLoading(false);
         return;
      }

      const loggedInUser = data.user;
      const isAdminRole = (r) => {
        if (!r) return false;
        const norm = String(r).toLowerCase().replace(/[-_\s]/g, "");
        return norm.includes("admin") || norm === "superadmin" || norm === "support" || norm === "billing";
      };

      // If a business account (owner, manager, accountant, cashier) logs in here, seamlessly redirect them to CRM!
      if (!isAdminRole(loggedInUser?.role)) {
        setToast({ msg: "Business account detected. Redirecting to Business CRM...", type: "success" });
        setTimeout(() => {
          window.location.href = getCrmUrl(`/app?token=${encodeURIComponent(data.token)}&user=${encodeURIComponent(JSON.stringify(loggedInUser))}`);
        }, 500);
        return;
      }

      localStorage.setItem("smartbill_token", data.token);
      setUserToStorage(loggedInUser);
      setToast({ msg: "Admin login successful", type: "success" });
      setTimeout(() => {
        onLogin(loggedInUser.role, loggedInUser);
      }, 500);
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Left panel */}
      <div 
        className="hidden lg:flex flex-col w-[480px] flex-shrink-0 relative overflow-hidden p-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/billing_software_bg.jpg')" }}
      >
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-[2px]"></div>

        <div className="flex items-center gap-2.5 mb-10 relative z-10">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-lg">Smart Bill Admin</span>
        </div>
        <div className="relative z-10 flex-1 flex items-center">
          <div className="w-full">
            <h2 className="text-3xl font-extrabold text-white leading-snug mb-4">
              Manage the platform
              <br />
              with confidence
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-8">
              Secure administrative access for managing users, subscriptions, and system settings.
            </p>
            <div className="space-y-3">
              {[
                "Global user management",
                "Subscription oversight",
                "System-wide analytics",
                "Advanced configuration",
              ].map((f) => (
                <div key={f} className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-blue-400" />
                  </div>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Portal</h1>
            <p className="text-slate-500 text-sm mt-1">Sign in to manage the Smart Bill platform</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="font-medium text-red-800">Authentication Error</p>
                <p className="text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Admin Email Address"
              type="email"
              placeholder="admin@smartbill.com"
              value={email}
              onChange={(val) => setEmail(typeof val === "string" ? val : val?.target?.value ?? "")}
              icon={<Mail className="w-4 h-4" />}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(val) => setPassword(typeof val === "string" ? val : val?.target?.value ?? "")}
              icon={<Lock className="w-4 h-4" />}
              required
            />

            <Btn
              type="submit"
              variant="primary"
              className="w-full justify-center py-2.5 shadow-md shadow-blue-500/10 mt-2"
              disabled={loading}
              icon={
                loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )
              }
            >
              {loading ? "Authenticating..." : "Access Dashboard"}
            </Btn>
          </form>
          
          <div className="mt-8 text-center space-y-3">
            <p className="text-xs text-slate-400 font-medium">
              Secure admin access. Authorized personnel only.
            </p>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <a
                href={getCrmUrl("/login")}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline inline-flex items-center gap-1.5"
              >
                🏪 Business Owner / Staff? Open Business CRM Login ➔
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
