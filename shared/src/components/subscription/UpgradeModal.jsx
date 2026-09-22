import { useState, useEffect } from "react";
import {
  X,
  Zap,
  ArrowDownCircle,
  CheckCircle2,
  Loader2,
  Tag,
  Calendar,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Info,
  Sparkles,
  Check,
  Percent,
} from "lucide-react";
import subscriptionAPI from "@shared/api/subscriptionAPI";
import { validateCouponCode } from "@shared/api/couponAPI";
import { setUserToStorage } from "@shared/utils/userUtils";

const PLAN_COLORS = {
  starter: { bg: "from-slate-600 to-slate-700", badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" },
  pro: { bg: "from-blue-600 to-indigo-600", badge: "bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300" },
  enterprise: { bg: "from-amber-500 to-orange-600", badge: "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300" },
};

function formatINR(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * UpgradeModal — shows prorated discount and coupon breakdown, allows entering coupon codes, and triggers Razorpay payment.
 *
 * Props:
 *   preview           — data from getUpgradePreview API
 *   onClose           — called when modal dismissed
 *   onSuccess         — called with server response after payment verified
 *   userEmail         — used as fallback for Razorpay prefill
 *   initialCouponCode — optional coupon code to pre-apply
 */
export default function UpgradeModal({
  preview,
  onClose,
  onSuccess,
  userEmail,
  initialCouponCode = "",
}) {
  const [step, setStep] = useState("preview"); // "preview" | "processing" | "success" | "error"
  const [errorMsg, setErrorMsg] = useState("");

  // Coupon state
  const [couponInput, setCouponInput] = useState(() => {
    return (
      initialCouponCode ||
      preview?.appliedCoupon?.code ||
      (() => {
        try {
          return sessionStorage.getItem("smartbill_claimed_coupon") || "";
        } catch {
          return "";
        }
      })()
    );
  });
  const [appliedCoupon, setAppliedCoupon] = useState(preview?.appliedCoupon || null);
  const [couponDiscount, setCouponDiscount] = useState(preview?.couponDiscount || 0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponSuccessMsg, setCouponSuccessMsg] = useState(
    preview?.appliedCoupon ? `✓ Coupon "${preview.appliedCoupon.code}" applied!` : ""
  );

  if (!preview) return null;

  const {
    currentPlan,
    newPlan,
    isUpgrade,
    isActivePaid,
    daysRemaining,
    proratedCredit = 0,
    originalPrice = 0,
    discountedPrice = 0,
    effectiveDate,
  } = preview;

  const isDowngrade = !isUpgrade;

  // Calculate pricing
  const afterProrated = Math.max(0, originalPrice - proratedCredit);
  const activeCouponDiscount = appliedCoupon ? couponDiscount : 0;
  const finalPayableToday = Math.max(0, afterProrated - activeCouponDiscount);
  const totalSavings = proratedCredit + activeCouponDiscount;
  const totalSavingsPercent =
    originalPrice > 0 ? Math.round((totalSavings / originalPrice) * 100) : 0;

  const newPlanColors = PLAN_COLORS[newPlan?.key] || PLAN_COLORS.pro;
  const currentColors = PLAN_COLORS[currentPlan?.key] || PLAN_COLORS.starter;

  // Auto-apply initial coupon if provided and not yet applied
  useEffect(() => {
    const rawCode =
      initialCouponCode ||
      (() => {
        try {
          return sessionStorage.getItem("smartbill_claimed_coupon") || "";
        } catch {
          return "";
        }
      })();

    if (rawCode && isUpgrade && !appliedCoupon) {
      applyCoupon(rawCode);
    }
  }, [initialCouponCode, isUpgrade]);

  async function applyCoupon(codeToApply) {
    const cleanCode = (codeToApply || couponInput || "").trim().toUpperCase();
    if (!cleanCode) {
      setCouponError("Please enter a coupon code");
      return;
    }

    setCouponLoading(true);
    setCouponError("");
    setCouponSuccessMsg("");

    try {
      // Validate with backend for the new plan and current prorated price
      const res = await validateCouponCode(cleanCode, newPlan.key, afterProrated);
      if (res && res.valid) {
        setAppliedCoupon(res.coupon);
        setCouponDiscount(Number(res.discountAmount) || 0);
        setCouponSuccessMsg(`✓ Coupon "${res.coupon.code}" applied! You save ${formatINR(res.discountAmount)}`);
        try {
          sessionStorage.setItem("smartbill_claimed_coupon", res.coupon.code);
        } catch {}
      } else {
        setAppliedCoupon(null);
        setCouponDiscount(0);
        setCouponError(res?.message || "Invalid coupon code");
      }
    } catch (err) {
      setAppliedCoupon(null);
      setCouponDiscount(0);
      setCouponError(err?.response?.data?.message || err?.message || "Invalid or expired coupon code");
    } finally {
      setCouponLoading(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponInput("");
    setCouponError("");
    setCouponSuccessMsg("");
    try {
      sessionStorage.removeItem("smartbill_claimed_coupon");
    } catch {}
  }

  async function handleProceed() {
    if (isDowngrade) {
      // Downgrade doesn't require payment — schedule it
      setStep("processing");
      try {
        const res = await subscriptionAPI.verifyPayment({
          razorpay_order_id: `order_downgrade_${Date.now()}`,
          razorpay_payment_id: `pay_downgrade_${Date.now()}`,
          planName: newPlan.key,
          isDowngrade: true,
        });
        setStep("success");
        if (onSuccess) onSuccess(res);
      } catch (err) {
        setErrorMsg(err?.response?.data?.message || "Failed to schedule downgrade.");
        setStep("error");
      }
      return;
    }

    // Upgrade — open Razorpay
    setStep("processing");
    const loaded = await loadRazorpay();
    if (!loaded) {
      setErrorMsg("Could not load payment gateway. Please check your internet connection.");
      setStep("error");
      return;
    }

    try {
      const orderData = await subscriptionAPI.createOrder(newPlan.key, {
        isUpgrade: true,
        proratedAmount: finalPayableToday,
        couponCode: appliedCoupon?.code || "",
      });

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "SmartBill",
        description: `${newPlan.name} Plan${
          totalSavings > 0 ? ` (${formatINR(totalSavings)} total discount applied)` : ""
        }`,
        order_id: orderData.orderId,
        prefill: { email: userEmail || "" },
        theme: { color: "#2563EB" },
        handler: async (response) => {
          try {
            const verifyRes = await subscriptionAPI.verifyPayment({
              razorpay_order_id: orderData.orderId,
              razorpay_payment_id:
                response.razorpay_payment_id || `pay_mock_${Date.now()}`,
              razorpay_signature: response.razorpay_signature || "",
              planName: newPlan.key,
              isUpgrade: true,
              email: userEmail || "",
              couponCode: appliedCoupon?.code || "",
            });

            if (verifyRes?.token) {
              localStorage.setItem("smartbill_token", verifyRes.token);
            }
            if (verifyRes?.user) {
              setUserToStorage(verifyRes.user);
            }
            try {
              sessionStorage.removeItem("smartbill_claimed_coupon");
            } catch {}
            window.dispatchEvent(new Event("userUpdated"));

            setStep("success");
            if (onSuccess) onSuccess(verifyRes);
          } catch (err) {
            setErrorMsg(
              err?.response?.data?.message || err?.message || "Payment verification failed."
            );
            setStep("error");
          }
        },
        modal: {
          ondismiss: () => {
            if (step === "processing") setStep("preview");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
      setStep("preview"); // re-show modal in background while Razorpay modal is open
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to initiate payment.");
      setStep("error");
    }
  }

  // ── Success screen ──────────────────────────
  if (step === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in-95">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {isDowngrade ? "Downgrade Scheduled!" : "Plan Upgraded Successfully!"}
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">
            {isDowngrade
              ? `Your ${currentPlan.name} plan continues until ${new Date(effectiveDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. After that, your plan will switch to ${newPlan.name}.`
              : `You are now active on the ${newPlan.name} plan. All features and elevated quotas are unlocked.`}
          </p>
          <button
            onClick={onClose}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl py-3 transition-colors cursor-pointer shadow-md"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Error screen ────────────────────────────────────────────
  if (step === "error") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in-95">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/60 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">{errorMsg}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setStep("preview")}
              className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-slate-900 dark:bg-slate-800 text-white font-semibold rounded-xl py-3 hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Preview / Processing screen ─────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden my-6">
        {/* Header */}
        <div className={`bg-gradient-to-r ${isDowngrade ? "from-slate-600 to-slate-700" : newPlanColors.bg} px-6 py-5 relative text-white`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-1">
            {isDowngrade ? (
              <TrendingDown className="w-6 h-6 text-white" />
            ) : (
              <TrendingUp className="w-6 h-6 text-white" />
            )}
            <span className="text-white font-bold text-lg">
              {isDowngrade ? "Plan Downgrade" : "Plan Checkout & Upgrade"}
            </span>
          </div>
          <p className="text-white/80 text-sm">
            {currentPlan.name} → {newPlan.name}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Plan comparison pill */}
          <div className="flex gap-3">
            <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">Current Plan</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${currentColors.badge}`}>
                {currentPlan.name}
              </span>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1.5">
                {formatINR(currentPlan.price)}<span className="text-xs font-normal text-slate-500">/mo</span>
              </p>
            </div>
            <div className="flex items-center text-slate-400 font-bold text-base">→</div>
            <div className={`flex-1 border-2 ${isDowngrade ? "border-slate-400 dark:border-slate-600" : "border-blue-400 dark:border-blue-500"} rounded-xl p-3 bg-gradient-to-br ${isDowngrade ? "from-slate-50 to-slate-100 dark:from-slate-800/90" : "from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/70"}`}>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">Target Plan</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${newPlanColors.badge}`}>
                {newPlan.name}
              </span>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1.5">
                {formatINR(newPlan.price)}<span className="text-xs font-normal text-slate-500">/mo</span>
              </p>
            </div>
          </div>

          {/* Downgrade info box */}
          {isDowngrade && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 flex gap-3">
              <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Downgrade scheduled at period end</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Your <strong>{currentPlan.name}</strong> plan continues until{" "}
                  <strong>{new Date(effectiveDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong>.
                  No charge today — your plan switches automatically.
                </p>
              </div>
            </div>
          )}

          {/* Coupon Code Section (Upgrade Only) */}
          {isUpgrade && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Have a Coupon or Promo Code?
                </label>
                {appliedCoupon && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    Discount Applied
                  </span>
                )}
              </div>

              {!appliedCoupon ? (
                <div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => {
                          setCouponInput(e.target.value.toUpperCase());
                          setCouponError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyCoupon(couponInput);
                          }
                        }}
                        placeholder="Enter coupon code (e.g. GANPATI)"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs uppercase font-mono tracking-wider text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => applyCoupon(couponInput)}
                      disabled={couponLoading || !couponInput.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      {couponLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </button>
                  </div>
                  {couponError && (
                    <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1.5 font-medium flex items-center gap-1">
                      <X className="w-3 h-3 flex-shrink-0" /> {couponError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-xs text-emerald-800 dark:text-emerald-200">
                          {appliedCoupon.code}
                        </span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-200/60 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded font-medium">
                          −{formatINR(activeCouponDiscount)}
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
                        {appliedCoupon.title || "Special promotion discount applied"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-xs text-slate-400 hover:text-rose-600 font-semibold px-2 py-1 transition cursor-pointer ml-2"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Prorated & Discount breakdown (upgrade only) */}
          {isUpgrade && (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Price Breakdown
              </p>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{newPlan.name} Plan Original Price</span>
                  <span className="font-mono font-medium">{formatINR(originalPrice)}</span>
                </div>

                {isActivePaid && proratedCredit > 0 && (
                  <>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Days remaining on {currentPlan.name} ({daysRemaining}d)
                      </span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                        − {formatINR(proratedCredit)}
                      </span>
                    </div>
                  </>
                )}

                {appliedCoupon && activeCouponDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3 text-emerald-500" />
                      Coupon Discount ({appliedCoupon.code})
                    </span>
                    <span className="font-mono">− {formatINR(activeCouponDiscount)}</span>
                  </div>
                )}

                <div className="border-t border-slate-200 dark:border-slate-700 pt-2.5 flex justify-between items-center text-slate-900 dark:text-white">
                  <div>
                    <p className="font-bold text-sm">Amount to pay today</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Includes all applicable discounts</p>
                  </div>
                  <div className="text-right">
                    {totalSavings > 0 && (
                      <span className="line-through text-xs text-slate-400 font-mono block">
                        {formatINR(originalPrice)}
                      </span>
                    )}
                    <span className="font-mono text-lg font-extrabold text-blue-600 dark:text-blue-400">
                      {formatINR(finalPayableToday)}
                    </span>
                  </div>
                </div>

                {totalSavings > 0 && (
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg px-3 py-1.5 mt-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      Total savings: {formatINR(totalSavings)} ({totalSavingsPercent}% OFF)!
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={step === "processing"}
              className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleProceed}
              disabled={step === "processing"}
              className={`flex-1 font-semibold rounded-xl py-3 text-sm transition-all cursor-pointer disabled:opacity-70 flex items-center justify-center gap-2 text-white ${
                isDowngrade
                  ? "bg-slate-700 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 shadow-md"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/20"
              }`}
            >
              {step === "processing" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing…
                </>
              ) : isDowngrade ? (
                <>
                  <ArrowDownCircle className="w-4 h-4" />
                  Confirm Downgrade
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Pay {formatINR(finalPayableToday)} Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


