import { useState } from "react";
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
} from "lucide-react";
import subscriptionAPI from "@shared/api/subscriptionAPI";
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
 * UpgradeModal — shows prorated discount breakdown and triggers Razorpay payment.
 *
 * Props:
 *   preview       — data from getUpgradePreview API
 *   onClose       — called when modal dismissed
 *   onSuccess     — called with server response after payment verified
 *   userEmail     — used as fallback for Razorpay prefill
 */
export default function UpgradeModal({ preview, onClose, onSuccess, userEmail }) {
  const [step, setStep] = useState("preview"); // "preview" | "processing" | "success" | "error"
  const [errorMsg, setErrorMsg] = useState("");

  if (!preview) return null;

  const {
    currentPlan,
    newPlan,
    isUpgrade,
    isActivePaid,
    daysRemaining,
    proratedCredit,
    originalPrice,
    discountedPrice,
    effectiveDate,
  } = preview;

  const isDowngrade = !isUpgrade;
  const savingsPercent =
    originalPrice > 0 ? Math.round((proratedCredit / originalPrice) * 100) : 0;

  const newPlanColors = PLAN_COLORS[newPlan?.key] || PLAN_COLORS.pro;
  const currentColors = PLAN_COLORS[currentPlan?.key] || PLAN_COLORS.starter;

  async function handleProceed() {
    if (isDowngrade) {
      // Downgrade doesn't require payment — just schedule it
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
        proratedAmount: discountedPrice,
      });

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "SmartBill",
        description: `${newPlan.name} Plan${proratedCredit > 0 ? ` (₹${proratedCredit} prorated discount applied)` : ""}`,
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
            });

            if (verifyRes?.token) {
              localStorage.setItem("smartbill_token", verifyRes.token);
            }
            if (verifyRes?.user) {
              setUserToStorage(verifyRes.user);
            }
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {isDowngrade ? "Downgrade Scheduled!" : "Plan Upgraded!"}
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">
            {isDowngrade
              ? `Your ${currentPlan.name} plan continues until ${new Date(effectiveDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. After that, your plan will switch to ${newPlan.name}.`
              : `You're now on the ${newPlan.name} plan. Your new billing period starts today.`}
          </p>
          <button
            onClick={onClose}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl py-3 transition-colors cursor-pointer"
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-r ${isDowngrade ? "from-slate-600 to-slate-700" : newPlanColors.bg} px-6 py-5 relative`}>
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
              {isDowngrade ? "Plan Downgrade" : "Plan Upgrade"}
            </span>
          </div>
          <p className="text-white/80 text-sm">
            {currentPlan.name} → {newPlan.name}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Plan comparison */}
          <div className="flex gap-3">
            <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Current Plan</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${currentColors.badge}`}>
                {currentPlan.name}
              </span>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                {formatINR(currentPlan.price)}<span className="text-xs font-normal text-slate-500 dark:text-slate-400">/mo</span>
              </p>
            </div>
            <div className="flex items-center text-slate-400 font-bold text-lg">→</div>
            <div className={`flex-1 border-2 ${isDowngrade ? "border-slate-400 dark:border-slate-600" : "border-blue-400 dark:border-blue-500"} rounded-xl p-4 bg-gradient-to-br ${isDowngrade ? "from-slate-50 to-slate-100 dark:from-slate-800/90 dark:to-slate-800/50" : "from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/70"}`}>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">New Plan</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${newPlanColors.badge}`}>
                {newPlan.name}
              </span>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                {formatINR(newPlan.price)}<span className="text-xs font-normal text-slate-500 dark:text-slate-400">/mo</span>
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
                  No refund is issued — you keep all current features until then.
                </p>
              </div>
            </div>
          )}

          {/* Prorated breakdown (upgrade only) */}
          {isUpgrade && (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Prorated Pricing Breakdown
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{newPlan.name} plan price</span>
                  <span className="font-mono">{formatINR(originalPrice)}</span>
                </div>

                {isActivePaid && proratedCredit > 0 && (
                  <>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Days remaining on {currentPlan.name}
                      </span>
                      <span className="font-mono">{daysRemaining} days</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>Prorated credit (unused days)</span>
                      <span className="font-mono">− {formatINR(proratedCredit)}</span>
                    </div>
                  </>
                )}

                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-slate-900 dark:text-white text-base">
                  <span>Amount to pay today</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    {formatINR(discountedPrice)}
                  </span>
                </div>

                {proratedCredit > 0 && (
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg px-3 py-2 mt-1">
                    <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      You save {formatINR(proratedCredit)} ({savingsPercent}% off) for switching mid-cycle!
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={step === "processing"}
              className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleProceed}
              disabled={step === "processing"}
              className={`flex-1 font-semibold rounded-xl py-3 transition-all cursor-pointer disabled:opacity-70 flex items-center justify-center gap-2 text-white ${
                isDowngrade
                  ? "bg-slate-700 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
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
                  Pay {formatINR(discountedPrice)} Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


