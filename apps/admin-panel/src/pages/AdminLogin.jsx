import { useState } from "react";
import { Lock, LogIn, Mail, AlertCircle, ShieldCheck, Check } from "lucide-react";
import { loginUser } from "@shared/api/authAPI";
import { setUserToStorage } from "@shared/utils/userUtils";
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
      localStorage.setItem("smartbill_token", data.token);
      setUserToStorage(loggedInUser);
      setToast({ msg: "Login successful", type: "success" });
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
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            Admin Portal
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Sign in to manage the platform
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Input
              label="Admin Email"
              value={email}
              onChange={(v) => setEmail(v)}
              icon={<Mail className="w-4 h-4" />}
              placeholder="Enter admin email"
            />
            
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(v) => setPassword(v)}
              icon={<Lock className="w-4 h-4" />}
              placeholder="Enter your password"
            />

            <Btn
              variant="primary"
              size="lg"
              onClick={handleLogin}
              className="w-full justify-center mt-6 !bg-slate-900 hover:!bg-slate-800 focus:ring-slate-900/20"
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
          
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400 font-medium">
              Secure admin access. Authorized personnel only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
