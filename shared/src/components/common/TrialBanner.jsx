import { useState, useEffect } from "react";
import {
  Sparkles,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Zap,
} from "lucide-react";

import subscriptionAPI from "@shared/api/subscriptionAPI";
import { setUserToStorage } from "@shared/utils/userUtils";

/*
|--------------------------------------------------------------------------
| Safely convert backend features into an array
|--------------------------------------------------------------------------
*/

const normalizeFeatures = (features) => {
  if (Array.isArray(features)) {
    return features;
  }

  if (typeof features === "string") {
    try {
      const parsed = JSON.parse(features);

      if (Array.isArray(parsed)) {
        return parsed;
      }

      if (parsed && typeof parsed === "object") {
        return Object.entries(parsed).map(([key, value]) => {
          if (typeof value === "boolean") {
            return value ? key : null;
          }

          return `${key}: ${value}`;
        }).filter(Boolean);
      }

      return [features];
    } catch {
      return features
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  if (features && typeof features === "object") {
    return Object.entries(features)
      .map(([key, value]) => {
        if (typeof value === "boolean") {
          return value ? key : null;
        }

        if (value === null || value === undefined) {
          return null;
        }

        return `${key}: ${value}`;
      })
      .filter(Boolean);
  }

  return [];
};

/*
|--------------------------------------------------------------------------
| Normalize backend plans
|--------------------------------------------------------------------------
*/

const normalizePlans = (response) => {
  let fetchedPlans = [];

  if (Array.isArray(response)) {
    fetchedPlans = response;
  } else if (Array.isArray(response?.plans)) {
    fetchedPlans = response.plans;
  } else if (Array.isArray(response?.data)) {
    fetchedPlans = response.data;
  } else if (Array.isArray(response?.data?.plans)) {
    fetchedPlans = response.data.plans;
  }

  return fetchedPlans
    .filter(Boolean)
    .map((plan) => ({
      ...plan,
      name: plan.name || plan.plan || "Plan",
      price: Number(plan.price || 0),
      period: plan.period || "/month",
      features: normalizeFeatures(plan.features),
      badge: plan.badge || null,
    }));
};

export default function TrialBanner({ user, onNav }) {
  const [subData, setSubData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [plansLoading, setPlansLoading] = useState(false);

  const normRole = String(user?.role || "").toLowerCase().replace(/[-_\s]/g, "");
  const isPlatformAdmin =
    normRole === "superadmin" ||
    normRole.includes("admin") ||
    normRole === "support" ||
    normRole === "billing";

  /*
  |--------------------------------------------------------------------------
  | Get subscription status
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!user || isPlatformAdmin) return;

    subscriptionAPI
      .getSubscriptionStatus()
      .then((res) => {
        if (res?.success) {
          setSubData(res);
        }
      })
      .catch((err) => {
        console.warn(
          "Could not fetch subscription status:",
          err?.message
        );
      });
  }, [user, isPlatformAdmin]);

  /*
  |--------------------------------------------------------------------------
  | Get public subscription plans
  |--------------------------------------------------------------------------
  */

  const fetchPlans = async () => {
    try {
      setPlansLoading(true);

      const res = await subscriptionAPI.getPublicPlans();

      const normalizedPlans = normalizePlans(res);

      console.log(
        "[TrialBanner] Subscription plans:",
        normalizedPlans
      );

      setPlans(normalizedPlans);
    } catch (err) {
      console.warn(
        "Could not fetch subscription plans:",
        err?.message
      );

      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => {
    if (!user || isPlatformAdmin) return;

    fetchPlans();
  }, [user, isPlatformAdmin]);

  if (!user || isPlatformAdmin) return null;

  const trialState = subData?.trialState;
  const subscription =
    subData?.subscription || user?.subscription;

  const planName = subscription?.plan
    ? String(subscription.plan).toUpperCase()
    : "STARTER";

  const isExpired =
    trialState?.isExpired ||
    subscription?.status === "expired";

  const daysLeft = trialState?.daysLeft ?? 14;

  const isActive = subscription?.status === "active";

  /*
  |--------------------------------------------------------------------------
  | Buy / Upgrade Plan
  |--------------------------------------------------------------------------
  */

  const handleBuyPlan = async (plan) => {
    try {
      setLoadingPlan(plan.name);

      const res = await subscriptionAPI.createOrder(
        plan.name
      );

      const razorpayKey =
        res.keyId ||
        import.meta.env.VITE_RAZORPAY_KEY_ID ||
        "rzp_test_TPCMQcPRZqe62i";

      const executePaymentVerification = async (
        payload
      ) => {
        try {
          const verifyRes =
            await subscriptionAPI.verifyPayment(payload);

          if (verifyRes?.token) {
            localStorage.setItem("smartbill_token", verifyRes.token);
          }

          /*
          |--------------------------------------------------------------------------
          | Refresh user profile after successful payment
          |--------------------------------------------------------------------------
          */

          try {
            const { getProfile } = await import(
              "@shared/api/authAPI"
            );

            const profileRes = await getProfile();

            if (profileRes?.user) {
              setUserToStorage(profileRes.user);

              window.dispatchEvent(
                new Event("userUpdated")
              );
            } else if (verifyRes?.user) {
              setUserToStorage(verifyRes.user);

              window.dispatchEvent(
                new Event("userUpdated")
              );
            } else if (verifyRes?.subscription) {
              const cached =
                localStorage.getItem("smartbill_user");

              if (cached) {
                const parsed = JSON.parse(cached);

                parsed.subscription =
                  verifyRes.subscription;

                setUserToStorage(parsed);

                window.dispatchEvent(
                  new Event("userUpdated")
                );
              }
            }
          } catch (profileErr) {
            console.warn(
              "Profile refresh notice:",
              profileErr?.message
            );
          }

          alert(
            `✓ ${verifyRes.message ||
            "Payment successful! Welcome to " +
            plan.name +
            " plan."
            }`
          );

          setShowUpgradeModal(false);

          window.location.reload();
        } catch (err) {
          alert(
            "Payment verification error: " +
            (err?.message ||
              err?.response?.data?.message ||
              "Unknown error")
          );
        } finally {
          setLoadingPlan(null);
        }
      };

      /*
      |--------------------------------------------------------------------------
      | Razorpay options
      |--------------------------------------------------------------------------
      */

      const options = {
        key: razorpayKey,

        amount: res.amount,

        currency: res.currency || "INR",

        name: "SmartBill",

        description: `${plan.name} Plan Subscription`,

        order_id: res.orderId,

        handler: async function (response) {
          await executePaymentVerification({
            razorpay_order_id:
              response.razorpay_order_id,

            razorpay_payment_id:
              response.razorpay_payment_id,

            razorpay_signature:
              response.razorpay_signature,

            planName: plan.name,
            email: user?.email || "",
          });
        },

        modal: {
          ondismiss: function () {
            setLoadingPlan(null);
          },
        },

        theme: {
          color: "#2563eb",
        },
      };

      try {
        if (typeof window.Razorpay === "undefined") {
          throw new Error(
            "Razorpay SDK not loaded"
          );
        }

        const rzp = new window.Razorpay(options);

        rzp.open();
      } catch (rzpErr) {
        console.error(
          "Razorpay SDK modal error:",
          rzpErr
        );

        alert(
          "Failed to load payment gateway. Please make sure you are connected to the internet and try again."
        );

        setLoadingPlan(null);
      }
    } catch (error) {
      console.error("Payment error:", error);

      alert(
        "Could not start payment process: " +
        (error?.message ||
          error?.response?.data?.message ||
          "Unknown error")
      );

      setLoadingPlan(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <>
      {/* ------------------------------------------------------------------
          Trial / Subscription Banner
          ------------------------------------------------------------------ */}

      {isExpired ? (
        <div className="bg-rose-950/80 text-rose-200 border-b border-rose-800/60 px-4 py-1.5 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>
              Your 14-day trial has expired. Upgrade your plan to unlock full invoicing and inventory features.
            </span>
          </div>

          <button
            onClick={() => setShowUpgradeModal(true)}
            className="bg-rose-600 hover:bg-rose-500 text-white font-medium px-2.5 py-1 rounded-md text-xs transition cursor-pointer flex items-center gap-1"
          >
            <Zap className="w-3.5 h-3.5 fill-current text-white" />
            <span>Upgrade Now</span>
          </button>
        </div>
      ) : isActive ? null : (
        <div className="bg-slate-900/95 text-slate-300 border-b border-slate-800 px-4 py-1 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md font-medium text-[11px]">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Free Trial
            </span>
            <span className="text-slate-300 text-xs">
              <strong className="text-slate-100 font-semibold">{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong> remaining
            </span>
          </div>

          <button
            onClick={() => setShowUpgradeModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-0.5 rounded-md font-medium text-[11px] transition cursor-pointer flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-blue-200" />
            <span>Upgrade Plan</span>
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------
          Subscription Upgrade Modal
          ------------------------------------------------------------------ */}

      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            {/* Close */}

            <button
              onClick={() =>
                setShowUpgradeModal(false)
              }
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl font-bold w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100"
            >
              ✕
            </button>

            {/* Header */}

            <div className="text-center mb-8">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                SmartBill Pricing & Plans
              </span>

              <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
                Choose the best plan for your business
              </h2>

              <p className="text-slate-500 text-sm mt-1">
                Unlock unlimited invoices, multi-business
                management, GST filing, and advanced reports.
              </p>
            </div>

            {/* Plans */}

            {plansLoading ? (
              <div className="py-16 text-center text-slate-500">
                Loading subscription plans...
              </div>
            ) : plans.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-slate-600 font-medium">
                  Unable to load subscription plans.
                </p>

                <button
                  onClick={fetchPlans}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                  const features = normalizeFeatures(
                    plan.features
                  );

                  return (
                    <div
                      key={plan.name}
                      className={`border-2 rounded-xl p-5 flex flex-col justify-between relative bg-white ${plan.badge
                          ? "border-blue-500 shadow-md shadow-blue-50"
                          : "border-slate-200"
                        }`}
                    >
                      {/* Popular badge */}

                      {plan.badge && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
                          {plan.badge}
                        </div>
                      )}

                      <div>
                        {/* Plan name */}

                        <h3 className="font-bold text-slate-900 text-lg">
                          {plan.name}
                        </h3>

                        {/* Price */}

                        <div className="flex items-baseline gap-1 my-3">
                          <span className="text-2xl font-extrabold text-slate-900">
                            ₹
                            {Number(
                              plan.price || 0
                            ).toLocaleString("en-IN")}
                          </span>

                          <span className="text-slate-500 text-xs">
                            {plan.period || "/month"}
                          </span>
                        </div>

                        {/* Features */}

                        <ul className="space-y-2 mb-6">
                          {features.map(
                            (feature, index) => (
                              <li
                                key={`${plan.name}-${index}`}
                                className="flex items-center gap-2 text-xs text-slate-600"
                              >
                                <span className="text-emerald-500 font-bold">
                                  ✓
                                </span>

                                <span>
                                  {String(feature)}
                                </span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>

                      {/* Upgrade button */}

                      <button
                        onClick={() =>
                          handleBuyPlan(plan)
                        }
                        disabled={
                          loadingPlan === plan.name
                        }
                        className={`w-full py-2 px-4 rounded-lg font-bold text-xs shadow transition-all cursor-pointer ${plan.badge
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-slate-900 hover:bg-slate-800 text-white"
                          } ${loadingPlan === plan.name
                            ? "opacity-70 cursor-not-allowed"
                            : ""
                          }`}
                      >
                        {loadingPlan === plan.name
                          ? "Processing..."
                          : `Upgrade to ${plan.name}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}