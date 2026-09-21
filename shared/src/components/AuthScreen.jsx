import { useState, useEffect } from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart2,
  Building2,
  Check,
  CheckCircle,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Phone,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  Btn,
  Card,
  FixedPhoneInput,
  Input,
  Select,
  Toast,
} from "@shared/components/common/ui";
import { registerUser, loginUser, sendOtp, verifyOtp, verifyLoginOtp, forgotPassword, verifyResetOtp, resetPassword } from "@shared/api/authAPI";
import { setUserToStorage } from "@shared/utils/userUtils";
import { getAdminUrl } from "@shared/utils/urlUtils";

import {
  RETAIL_CATEGORIES,
  WHOLESALE_CATEGORIES,
  BUSINESS_TYPES,
} from "@shared/utils/businessCategories";

const PHONE_PREFIX = "+91 ";

export default function AuthScreen({ view, onNav, onLogin, fixedRole }) {
  const [role, setRole] = useState(fixedRole || "owner");

  // ---- Login state ----
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ---- Register state ----
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [biz, setBiz] = useState("");
  const [phone, setPhone] = useState(PHONE_PREFIX);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [bizType, setBizType] = useState("Retail");
  const [bizCategory, setBizCategory] = useState(RETAIL_CATEGORIES[0]);

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // ---- OTP state ----
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpError, setOtpError] = useState("");

  // ---- Forgot / Reset Password State ----
  const [forgotMethod, setForgotMethod] = useState("email"); // "email" | "phone"
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotPhone, setForgotPhone] = useState(PHONE_PREFIX);
  const [forgotStep, setForgotStep] = useState(1); // 1 = Request OTP, 2 = Verify OTP & Set New Password
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotEmailError, setForgotEmailError] = useState("");
  const [forgotPhoneError, setForgotPhoneError] = useState("");
  const [forgotPasswordError, setForgotPasswordError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Parse URL search params (e.g., /forgot?email=someone@example.com from reset email)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      const phoneParam = params.get("phone");
      const otpParam = params.get("otp");

      if (view === "forgot") {
        if (emailParam) {
          const cleanEmail = decodeURIComponent(emailParam).trim();
          setForgotMethod("email");
          setForgotEmail(cleanEmail);
          setForgotStep(2); // Automatically advance to Step 2 so user enters the OTP they received!
        } else if (phoneParam) {
          const cleanPhone = decodeURIComponent(phoneParam).trim();
          setForgotMethod("phone");
          setForgotPhone(cleanPhone);
          setForgotStep(2);
        }

        if (otpParam) {
          setForgotOtp(decodeURIComponent(otpParam).trim().replace(/\D/g, "").slice(0, 6));
        }
      }
    } catch (e) {
      console.warn("Failed to parse URL search params:", e);
    }
  }, [view]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ---- Error state ----
  const [loginEmailError, setLoginEmailError] = useState("");
  const [loginPasswordError, setLoginPasswordError] = useState("");
  const [registerEmailError, setRegisterEmailError] = useState("");
  const [registerPasswordError, setRegisterPasswordError] = useState("");
  const [registerConfirmPasswordError, setRegisterConfirmPasswordError] = useState("");
  const [registerPhoneError, setRegisterPhoneError] = useState("");
  const [registerNameError, setRegisterNameError] = useState("");
  const [formError, setFormError] = useState("");
  const [suspensionNotice, setSuspensionNotice] = useState(null); // { reason: string, message: string }

  // Check for any redirect suspension notice from active session
  useEffect(() => {
    if (view === "login") {
      try {
        const storedNotice = sessionStorage.getItem("smartbill_suspension_notice");
        if (storedNotice) {
          const parsed = JSON.parse(storedNotice);
          if (parsed && (parsed.reason || parsed.message)) {
            setSuspensionNotice(parsed);
          }
          sessionStorage.removeItem("smartbill_suspension_notice");
        }
      } catch {}
    }
  }, [view]);

  const [toast, setToast] = useState(null);
  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isValidEmail = (raw) => {
    const trimmed = String(raw ?? "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  };

  const isValidIndianMobile = (raw) => {
    const digits = String(raw ?? "").replace(/\D/g, "");
    return /^[6-9]\d{9}$/.test(digits);
  };

  const getLoginEmailError = (raw) => {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) return "Email field is required.";
    if (!isValidEmail(trimmed)) return "Please enter a valid email address.";
    return "";
  };

  const validatePhone = (raw, required = true) => {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed || trimmed === PHONE_PREFIX || trimmed === "+91") {
      return required ? "Phone field is required." : "";
    }

    if (!trimmed.startsWith("+91")) {
      return "Phone must start with +91.";
    }

    const digitsPart = trimmed.slice(PHONE_PREFIX.length);
    if (!digitsPart) return required ? "Phone field is required." : "";

    const cleanDigits = digitsPart.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanDigits)) {
      return "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.";
    }

    return "";
  };

  // Strict validation used during registration.
  const validateRegisterPassword = (raw) => {
    const p = String(raw ?? "");
    if (!p.trim()) return "Password field is required.";

    if (p.length < 8) return "Password must be at least 8 characters.";
    if (p.length > 32) return "Password must be at most 32 characters.";

    if (!/[A-Z]/.test(p))
      return "Password must contain at least one uppercase letter.";
    if (!/[a-z]/.test(p))
      return "Password must contain at least one lowercase letter.";
    if (!/[0-9]/.test(p)) return "Password must contain at least one number.";
    if (!/[^A-Za-z0-9]/.test(p))
      return "Password must contain at least one special character.";

    return "";
  };

  // Simple check used at login so existing users are never blocked.
  const validateLoginPassword = (raw) => {
    if (!String(raw ?? "").trim()) return "Password field is required.";
    return "";
  };

  const handleLogin = async () => {
    const errEmail = getLoginEmailError(email);
    const errPassword = validateLoginPassword(password);

    setLoginEmailError(errEmail);
    setLoginPasswordError(errPassword);
    setFormError("");
    setSuspensionNotice(null);

    if (errEmail || errPassword) return;

    setLoading(true);
    try {
      const payload = { email: email.trim(), password };
      const data = await loginUser(payload);

      const loggedInUser = data.user;

      const isAdmin = (r) => {
        if (!r) return false;
        const norm = String(r).toLowerCase().replace(/[-_\s]/g, "");
        return norm.includes("admin") || norm === "superadmin" || norm === "support" || norm === "billing";
      };

      if (isAdmin(loggedInUser?.role) && fixedRole !== "superadmin") {
        showToast("Admin account detected. Redirecting to Admin Panel...", "success");
        setTimeout(() => {
          window.location.href = getAdminUrl(`/app?token=${encodeURIComponent(data.token)}&user=${encodeURIComponent(JSON.stringify(loggedInUser))}`);
        }, 500);
        return;
      }

      localStorage.setItem("smartbill_token", data.token);
      setUserToStorage(loggedInUser);
      showToast("Login successful", "success");
      if (typeof onLogin === "function") {
        onLogin(loggedInUser.role || "owner", loggedInUser);
      } else {
        window.location.href = "/app";
      }
    } catch (err) {
      if (
        err.isSuspended ||
        err.status === 403 && (err.suspensionReason || /suspended/i.test(err.message))
      ) {
        let reason = err.suspensionReason || "";
        if (!reason && err.message && /reason:\s*/i.test(err.message)) {
          const match = err.message.match(/reason:\s*(.*)$/i);
          if (match && match[1]) reason = match[1].trim();
        }
        setSuspensionNotice({
          reason: reason || err.suspensionReason || "",
          message: err.message || "Your business account has been suspended by administration.",
        });
      } else {
        setFormError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const errEmail = getLoginEmailError(email);
    const errPassword = validateRegisterPassword(password);
    const errConfirmPassword =
      !confirmPassword.trim()
        ? "Confirm Password field is required."
        : password !== confirmPassword
          ? "Passwords do not match."
          : "";
    const errPhone = validatePhone(phone);
    const errName =
      !firstName.trim() || !lastName.trim()
        ? "First and last name are required."
        : "";

    setRegisterEmailError(errEmail);
    setRegisterPasswordError(errPassword);
    setRegisterConfirmPasswordError(errConfirmPassword);
    setRegisterPhoneError(errPhone);
    setRegisterNameError(errName);
    setFormError("");

    if (errEmail || errPassword || errConfirmPassword || errPhone || errName) return;

    if (!phoneVerified) {
      if (otpSent && !otpSending) {
        setOtpError("Please verify the OTP sent to your phone number before proceeding.");
        return;
      }

      setOtpError("");
      setOtpSending(true);
      setLoading(true);
      try {
        const cleanEmail = email && typeof email === "string" ? email.trim() : undefined;
        const data = await sendOtp({
          phone: getCleanPhone(),
          email: cleanEmail && isValidEmail(cleanEmail) ? cleanEmail : undefined,
        });

        setOtpSent(true);
        setPhoneVerified(false);
        setResendCooldown(60);
        if (data?.otp) {
          setOtp(String(data.otp));
        }
        showToast(
          data?.otp
            ? `Verification OTP: ${data.otp}`
            : "OTP sent successfully! Please verify your phone number to continue.",
          "success",
        );
        return;
      } catch (err) {
        if (err.field === "phone") {
          setRegisterPhoneError(err.message);
        }
        setOtpError(err.message || "Failed to send OTP. Please try again.");
        setOtpSent(false);
        return;
      } finally {
        setOtpSending(false);
        setLoading(false);
      }
    }

    setLoading(true);
    try {
      const pendingPlan = localStorage.getItem("pending_subscription_plan");
      const normalizedBizType = String(bizType ?? "Retail").trim();
      const data = await registerUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        businessName: biz.trim(),
        businessType: normalizedBizType,
        businessCategory: bizCategory,
        email: email.trim(),
        phone: phone.replace(PHONE_PREFIX, "").replace(/\D/g, ""),
        password,
        ...(pendingPlan ? { planName: pendingPlan } : {}),
      });

      if (pendingPlan) {
        localStorage.removeItem("pending_subscription_plan");
      }

      localStorage.setItem("smartbill_token", data.token);
      setUserToStorage(data.user);

      showToast(
        "Account created successfully. You're now signed in.",
        "success",
      );
      if (typeof onLogin === "function") {
        onLogin(data.user.role || "owner", data.user);
      } else {
        window.location.href = "/app";
      }
    } catch (err) {
      if (err.field === "email") {
        setRegisterEmailError(err.message);
      } else {
        setFormError(err.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ---- OTP handlers ----
  const getCleanPhone = () =>
    phone.replace(PHONE_PREFIX, "").replace(/\D/g, "");

  const handleSendOtp = async () => {
    const errPhone = validatePhone(phone);
    setRegisterPhoneError(errPhone);
    setOtpError("");
    if (errPhone) return;

    setOtpSending(true);
    try {
      const cleanEmail = email && typeof email === "string" ? email.trim() : undefined;
      const data = await sendOtp({
        phone: getCleanPhone(),
        email: cleanEmail && isValidEmail(cleanEmail) ? cleanEmail : undefined,
      });
      setOtpSent(true);
      setPhoneVerified(false);
      if (data?.otp) {
        setOtp(String(data.otp));
      }
      setResendCooldown(60);
      showToast(
        data?.otp
          ? `Verification OTP: ${data.otp}`
          : "OTP sent successfully! Please check your phone/email.",
        "success"
      );
    } catch (err) {
      if (err.field === "phone") {
        setRegisterPhoneError(err.message);
      }
      setOtpError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const errPhone = validatePhone(phone);
    setRegisterPhoneError(errPhone);
    if (errPhone) return;

    const cleanOtp = String(otp ?? "").trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setOtpError("Please enter the 6-digit OTP.");
      return;
    }

    setOtpVerifying(true);
    try {
      await verifyOtp({ phone: getCleanPhone(), otp: cleanOtp });
      setPhoneVerified(true);
      setOtpError("");
      showToast("Phone number verified successfully! You can now create your account.", "success");
    } catch (err) {
      setOtpError(err.message || "OTP verification failed. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmit = () => {
    if (loading) return; // prevent duplicate submissions
    if (view === "login") {
      handleLogin();
    } else if (view === "register") {
      handleRegister();
    }
  };

  const handleRequestResetOtp = async () => {
    const isEmail = forgotMethod === "email";
    const errEmail = isEmail ? getLoginEmailError(forgotEmail) : "";
    const errPhone = !isEmail ? validatePhone(forgotPhone) : "";

    setForgotEmailError(errEmail);
    setForgotPhoneError(errPhone);
    setFormError("");
    setForgotPasswordError("");

    if (errEmail || errPhone) return;

    setResetLoading(true);
    try {
      const payload = isEmail
        ? { email: forgotEmail.trim() }
        : { phone: forgotPhone.replace(PHONE_PREFIX, "").replace(/\D/g, "") };

      const data = await forgotPassword(payload);
      setForgotOtp("");
      setForgotStep(2);
      setResendCooldown(60);
      showToast(data.message || "Reset OTP sent successfully. Please check your inbox.", "success");
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Failed to process request. Please check and try again.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyResetOtp = async () => {
    const isEmail = forgotMethod === "email";
    const cleanOtp = String(forgotOtp ?? "").trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setForgotPasswordError("Please enter a valid 6-digit OTP code.");
      return;
    }

    setForgotPasswordError("");
    setResetLoading(true);
    try {
      const targetIdentifier = isEmail
        ? forgotEmail.trim()
        : forgotPhone.replace(PHONE_PREFIX, "").replace(/\D/g, "");

      await verifyResetOtp({
        identifier: targetIdentifier,
        otp: cleanOtp,
      });

      showToast("OTP verified successfully! Please set your new password.", "success");
      setForgotStep(3);
    } catch (err) {
      setForgotPasswordError(err.response?.data?.message || err.message || "Invalid or expired OTP code.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPasswordSubmit = async () => {
    const isEmail = forgotMethod === "email";
    const cleanOtp = String(forgotOtp ?? "").trim();

    const errPass = validateRegisterPassword(forgotNewPassword);
    if (errPass) {
      setForgotPasswordError(errPass);
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotPasswordError("Passwords do not match.");
      return;
    }

    setForgotPasswordError("");
    setResetLoading(true);
    try {
      const targetIdentifier = isEmail
        ? forgotEmail.trim()
        : forgotPhone.replace(PHONE_PREFIX, "").replace(/\D/g, "");

      const data = await resetPassword({
        identifier: targetIdentifier,
        otp: cleanOtp,
        newPassword: forgotNewPassword,
      });

      showToast(data.message || "Password reset successfully! Please sign in.", "success");
      
      // Reset state and redirect to login
      setTimeout(() => {
        setForgotStep(1);
        setForgotOtp("");
        setForgotNewPassword("");
        setForgotConfirmPassword("");
        onNav("login");
      }, 1200);
    } catch (err) {
      setForgotPasswordError(err.response?.data?.message || err.message || "Failed to reset password. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-50 flex"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-[480px] flex-shrink-0 bg-slate-900 relative overflow-hidden p-10">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="flex items-center gap-2.5 mb-10 relative z-10">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white">Smart Bill</span>
        </div>
        <div className="relative z-10 flex-1 flex items-center">
          <div className="w-full">
            <h2 className="text-3xl font-extrabold text-white leading-snug mb-4">
              Manage your business
              <br />
              with confidence
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Complete billing, inventory, and accounting in one platform.
              GST-ready, cloud-based, and built for India.
            </p>
            <div className="space-y-3">
              {[
                "100% GST Compliant invoicing",
                "Real-time inventory tracking",
                "Profit & Loss statements",
                "Multi-user role access",
              ].map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-3 text-sm text-slate-300"
                >
                  <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <button
            onClick={() => onNav("landing")}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 mb-8 transition-colors"
          >
            <ArrowRight className="w-3 h-3 rotate-180" /> Back to home
          </button>

          {view === "login" && (
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">
                Welcome back
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Sign in to your SmartBill account
              </p>

              {/* Simple 2-Line Suspension Reason Alert */}
              {suspensionNotice && (
                <div className="mb-4 flex items-start gap-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 text-xs rounded-xl p-3 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-red-900 dark:text-red-200">
                      Account Suspended
                    </div>
                    <div className="text-[11px] text-red-800 dark:text-red-300 mt-0.5 break-words">
                      <span className="font-medium text-red-950 dark:text-red-100">Reason:</span>{" "}
                      {suspensionNotice.reason ? `"${suspensionNotice.reason}"` : "Suspended by administration. Please contact support."}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuspensionNotice(null)}
                    className="text-red-400 hover:text-red-600 p-0.5 rounded transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {formError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {formError}
                  </div>
                )}

                <Input
                  label="Email Address"
                  value={email}
                  onChange={(v) => {
                    const trimmed = String(v ?? "").trimStart();
                    setEmail(trimmed);
                    setSuspensionNotice(null);
                    if (trimmed && isValidEmail(trimmed))
                      setLoginEmailError("");
                    else setLoginEmailError(getLoginEmailError(trimmed));
                  }}
                  icon={<Mail className="w-4 h-4" />}
                  error={loginEmailError}
                />
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(v) => {
                    setPassword(v);
                    setSuspensionNotice(null);
                    const err = validateLoginPassword(v);
                    if (!err) setLoginPasswordError("");
                    else setLoginPasswordError(err);
                  }}
                  icon={<Lock className="w-4 h-4" />}
                  error={loginPasswordError}
                />
                <div className="flex justify-between items-center text-xs">
                  <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="accent-blue-600"
                    />
                    Remember me
                  </label>
                  <button
                    onClick={() => onNav("forgot")}
                    className="text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Btn
                  variant="primary"
                  size="lg"
                  onClick={handleLogin}
                  className="w-full justify-center"
                  disabled={loading}
                  icon={
                    loading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )
                  }
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Btn>
              </div>
              <p className="text-xs text-center text-slate-500 mt-5">
                Don't have an account?{" "}
                <button
                  onClick={() => onNav("register")}
                  className="text-blue-600 font-medium hover:underline"
                >
                  Register Business
                </button>
              </p>
            </>
          )}


          {view === "register" && (
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">
                Create your account
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Start your 14-day free trial. No credit card needed.
              </p>
              <div className="space-y-4">
                {formError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {formError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="First Name"
                    value={firstName}
                    onChange={(v) => {
                      setFirstName(v);
                      if (v.trim() && lastName.trim()) setRegisterNameError("");
                    }}
                  />
                  <Input
                    label="Last Name"
                    value={lastName}
                    onChange={(v) => {
                      setLastName(v);
                      if (v.trim() && firstName.trim())
                        setRegisterNameError("");
                    }}
                  />
                </div>
                {registerNameError && (
                  <p className="text-xs text-red-600 -mt-2">
                    {registerNameError}
                  </p>
                )}
                <Input
                  label="Business Name"
                  value={biz}
                  onChange={setBiz}
                  icon={<Building2 className="w-4 h-4" />}
                />
                <Input
                  label="Email"
                  value={email}
                  onChange={(v) => {
                    setEmail(v);
                    const err = getLoginEmailError(v);
                    if (!err) setRegisterEmailError("");
                    else setRegisterEmailError(err);
                  }}
                  icon={<Mail className="w-4 h-4" />}
                  error={registerEmailError}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Phone
                  </label>
                  <FixedPhoneInput
                    placeholder="+91"
                    icon={<Phone className="w-4 h-4" />}
                    value={phone}
                    onChange={(value) => {
                      setPhone(value);
                      setRegisterPhoneError(validatePhone(value, false));
                      if (phoneVerified) setPhoneVerified(false);
                    }}
                    error={registerPhoneError}
                  />
                  {phoneVerified && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2 mt-1">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="font-medium">Phone number verified successfully.</span>
                    </div>
                  )}
                  {otpError && !otpSent && !phoneVerified && (
                    <p className="text-xs text-red-600 mt-0.5">{otpError}</p>
                  )}
                </div>

                {otpSent && !phoneVerified && (
                  <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3.5 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-blue-950 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                        Verification Code
                      </span>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={otpSending || resendCooldown > 0}
                        className={`text-[11px] ${
                          resendCooldown > 0
                            ? "text-slate-400 cursor-not-allowed"
                            : "text-blue-600 font-medium hover:underline cursor-pointer"
                        }`}
                      >
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                      </button>
                    </div>

                    {otp && (
                      <div className="flex items-center justify-between bg-white border border-blue-200 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-[11px] text-slate-500 block">Your 6-Digit OTP:</span>
                          <span className="font-mono text-base font-bold text-blue-700 tracking-widest">{otp}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleVerifyOtp();
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer shadow-xs"
                        >
                          Verify Now →
                        </button>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <Input
                          label="Enter 6-Digit Code"
                          value={otp}
                          onChange={(v) => {
                            setOtp(v.replace(/\D/g, "").slice(0, 6));
                            setOtpError("");
                          }}
                          placeholder="6-digit OTP"
                          inputClassName="tracking-widest font-mono text-center font-bold text-base"
                          error={otpError}
                        />
                      </div>
                      <Btn
                        variant="primary"
                        size="md"
                        onClick={handleVerifyOtp}
                        disabled={otpVerifying || String(otp || "").length !== 6}
                        className="h-[42px] mt-[18px] shrink-0"
                        icon={
                          otpVerifying ? (
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )
                        }
                      >
                        {otpVerifying ? "Verifying..." : "Verify"}
                      </Btn>
                    </div>
                  </div>
                )}
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(v) => {
                    setPassword(v);
                    const err = validateRegisterPassword(v);
                    if (!err) setRegisterPasswordError("");
                    else setRegisterPasswordError(err);

                    if (confirmPassword && v !== confirmPassword) {
                      setRegisterConfirmPasswordError("Passwords do not match.");
                    } else if (confirmPassword) {
                      setRegisterConfirmPasswordError("");
                    }
                  }}
                  placeholder="Min. 8 characters"
                  icon={<Lock className="w-4 h-4" />}
                  error={registerPasswordError}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(v) => {
                    setConfirmPassword(v);
                    if (!v.trim()) {
                      setRegisterConfirmPasswordError("Confirm Password field is required.");
                    } else if (v !== password) {
                      setRegisterConfirmPasswordError("Passwords do not match.");
                    } else {
                      setRegisterConfirmPasswordError("");
                    }
                  }}
                  placeholder="Re-enter your password"
                  icon={<Lock className="w-4 h-4" />}
                  error={registerConfirmPasswordError}
                />
                <div className="space-y-3.5">
                  <Select
                    label="Business Type"
                    value={bizType}
                    onChange={(newType) => {
                      setBizType(newType);
                      if (newType === "Wholesale") {
                        setBizCategory(WHOLESALE_CATEGORIES[0]);
                      } else {
                        setBizCategory(RETAIL_CATEGORIES[0]);
                      }
                    }}
                    options={["Retail", "Wholesale"]}
                  />
                  <Select
                    label="Business Category"
                    value={bizCategory}
                    onChange={setBizCategory}
                    options={bizType === "Wholesale" ? WHOLESALE_CATEGORIES : RETAIL_CATEGORIES}
                  />
                </div>
                <Btn
                  variant="primary"
                  size="lg"
                  onClick={handleSubmit}
                  className="w-full justify-center"
                  disabled={loading || otpSending}
                  icon={
                    loading || otpSending ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : undefined
                  }
                >
                  {otpSending ? "Sending OTP..." : loading ? "Creating account..." : "Create Account"}
                </Btn>
                <p className="text-[10px] text-slate-400 text-center">
                  By registering, you agree to our Terms of Service and Privacy
                  Policy
                </p>
              </div>
              <p className="text-xs text-center text-slate-500 mt-4">
                Already registered?{" "}
                <button
                  onClick={() => onNav("login")}
                  className="text-blue-600 font-medium hover:underline"
                >
                  Sign In
                </button>
              </p>
            </>
          )}

          {view === "forgot" && (
            <div>
              <div className="mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">
                  {forgotStep === 1
                    ? "Forgot Password"
                    : forgotStep === 2
                    ? "Verify Security Code"
                    : "Set New Password"}
                </h2>
                <p className="text-sm text-slate-500">
                  {forgotStep === 1
                    ? "Choose your recovery method to receive a real 6-digit verification OTP."
                    : forgotStep === 2
                    ? `Enter the 6-digit code sent to ${forgotMethod === "email" ? forgotEmail : forgotPhone}.`
                    : "Identity verified! Please enter and confirm your new password."}
                </p>
              </div>

              {formError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2 mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              {forgotPasswordError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2 mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {forgotPasswordError}
                </div>
              )}

              {/* STEP 1: REQUEST OTP */}
              {forgotStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                      Recover via
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                      {["email", "phone"].map((m) => {
                        const active = forgotMethod === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setForgotMethod(m);
                              setForgotEmailError("");
                              setForgotPhoneError("");
                              setFormError("");
                            }}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                              active
                                ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                                : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            {m === "email" ? (
                              <Mail
                                className={`w-4 h-4 ${
                                  active ? "text-blue-600" : "text-slate-400"
                                }`}
                              />
                            ) : (
                              <Phone
                                className={`w-4 h-4 ${
                                  active ? "text-blue-600" : "text-slate-400"
                                }`}
                              />
                            )}
                            {m === "email" ? "Email" : "Mobile"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {forgotMethod === "email" ? (
                    <Input
                      label="Registered Email Address"
                      value={forgotEmail}
                      onChange={(v) => {
                        const trimmed = String(v ?? "").trimStart();
                        setForgotEmail(trimmed);
                        if (trimmed && isValidEmail(trimmed))
                          setForgotEmailError("");
                        else setForgotEmailError(getLoginEmailError(trimmed));
                      }}
                      placeholder="name@business.com"
                      icon={<Mail className="w-4 h-4" />}
                      error={forgotEmailError}
                    />
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Registered Mobile Number
                      </label>
                      <FixedPhoneInput
                        icon={<Phone className="w-4 h-4" />}
                        value={forgotPhone}
                        onChange={(value) => {
                          setForgotPhone(value);
                          setForgotPhoneError(validatePhone(value, false));
                        }}
                        error={forgotPhoneError}
                      />
                    </div>
                  )}

                  <Btn
                    variant="primary"
                    size="lg"
                    onClick={handleRequestResetOtp}
                    className="w-full justify-center mt-2"
                    disabled={resetLoading}
                    icon={
                      resetLoading ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )
                    }
                  >
                    {resetLoading ? "Sending Code..." : "Send Verification OTP"}
                  </Btn>
                </div>
              )}

              {/* STEP 2: ENTER & VERIFY OTP FIRST */}
              {forgotStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-blue-50/60 border border-blue-100 rounded-lg p-2.5 text-xs text-blue-900">
                    <div>
                      <span className="text-slate-500">Code sent to: </span>
                      <span className="font-semibold">
                        {forgotMethod === "email"
                          ? forgotEmail
                          : forgotPhone}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotStep(1);
                        setForgotPasswordError("");
                      }}
                      className="text-blue-600 hover:underline font-medium ml-2 cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                      6-Digit Verification Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      placeholder="Enter 6-digit OTP"
                      value={forgotOtp}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setForgotOtp(val);
                        if (forgotPasswordError) setForgotPasswordError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && forgotOtp.length === 6 && !resetLoading) {
                          handleVerifyResetOtp();
                        }
                      }}
                      className="w-full text-center tracking-[0.35em] font-mono text-xl font-bold bg-slate-50 border border-slate-300 rounded-xl py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <p className="text-[11px] text-slate-400 text-center mt-1.5">
                      Please check your inbox (and spam folder) for the verification code.
                    </p>
                  </div>

                  <Btn
                    variant="primary"
                    size="lg"
                    onClick={handleVerifyResetOtp}
                    className="w-full justify-center mt-2"
                    disabled={resetLoading || forgotOtp.length !== 6}
                    icon={
                      resetLoading ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )
                    }
                  >
                    {resetLoading ? "Verifying OTP..." : "Verify OTP Code"}
                  </Btn>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={handleRequestResetOtp}
                      disabled={resetLoading || resendCooldown > 0}
                      className={`text-xs ${
                        resendCooldown > 0
                          ? "text-slate-400 cursor-not-allowed"
                          : "text-blue-600 hover:underline cursor-pointer"
                      }`}
                    >
                      {resendCooldown > 0
                        ? `Resend code in ${resendCooldown}s`
                        : "Didn't receive code? Resend Code"}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: SET NEW PASSWORD */}
              {forgotStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg p-2.5">
                    <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                    <span>Identity verified! Enter your new password below.</span>
                  </div>

                  <Input
                    label="New Password"
                    type="password"
                    autoFocus
                    value={forgotNewPassword}
                    onChange={(v) => {
                      setForgotNewPassword(v);
                      if (forgotPasswordError) setForgotPasswordError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !resetLoading) handleResetPasswordSubmit();
                    }}
                    placeholder="Min. 8 characters (Uppercase, number, symbol)"
                    icon={<Lock className="w-4 h-4" />}
                  />

                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={forgotConfirmPassword}
                    onChange={(v) => {
                      setForgotConfirmPassword(v);
                      if (forgotPasswordError) setForgotPasswordError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !resetLoading) handleResetPasswordSubmit();
                    }}
                    placeholder="Re-enter new password"
                    icon={<Lock className="w-4 h-4" />}
                  />

                  <Btn
                    variant="primary"
                    size="lg"
                    onClick={handleResetPasswordSubmit}
                    className="w-full justify-center mt-2"
                    disabled={resetLoading}
                    icon={
                      resetLoading ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )
                    }
                  >
                    {resetLoading ? "Updating Password..." : "Set New Password & Sign In"}
                  </Btn>
                </div>
              )}

              <p className="text-xs text-center text-slate-500 mt-5">
                <button
                  onClick={() => {
                    setForgotStep(1);
                    setFormError("");
                    setForgotPasswordError("");
                    onNav("login");
                  }}
                  className="text-blue-600 font-medium hover:underline cursor-pointer"
                >
                  ← Back to Sign In
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



