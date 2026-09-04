import React, { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";

import PublicNavbar from "@shared/components/common/PublicNavbar";
import { useNavigate } from "react-router-dom";
import { Btn } from "@shared/components/common/ui";
import subscriptionAPI from "@shared/api/subscriptionAPI";
/*
|--------------------------------------------------------------------------
| Backend feature key -> Frontend display label
|--------------------------------------------------------------------------
*/

const FEATURE_LABELS = {
  basicReports: "Basic Reports",
  advancedReports: "Advanced Reports",
  gstReports: "GST Reports",
  barcodeScanner: "Barcode Scanner",
  expenses: "Expenses",
  purchaseManagement: "Purchase Management",
  inventory: "Inventory",
  advancedInventory: "Advanced Inventory",
  dataExport: "Data Export",
  apiAccess: "API Access",
};

/*
|--------------------------------------------------------------------------
| Pricing Page
|--------------------------------------------------------------------------
*/

export default function PricingPage() {
  const navigate = useNavigate();

  /*
  |--------------------------------------------------------------------------
  | Subscription plans
  |--------------------------------------------------------------------------
  */

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState("");

  /*
  |--------------------------------------------------------------------------
  | Selected plan loading
  |--------------------------------------------------------------------------
  */

  const [loadingPlan, setLoadingPlan] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | Get public subscription plans
  |--------------------------------------------------------------------------
  */

  const fetchPlans = useCallback(async () => {
    let timeoutId;

    try {
      setPlansLoading(true);
      setPlansError("");

      /*
       * Prevent the page from staying stuck forever
       * if the backend does not respond.
       */

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              "Subscription plans request timed out."
            )
          );
        }, 10000);
      });

      const apiPromise =
        subscriptionAPI.getPublicPlans();

      const response = await Promise.race([
        apiPromise,
        timeoutPromise,
      ]);

      /*
       * Expected response:
       *
       * {
       *   success: true,
       *   count: 3,
       *   data: [...]
       * }
       */

      if (
        response?.success &&
        Array.isArray(response.data)
      ) {
        setPlans(response.data);
        setPlansError("");
      } else {
        setPlans([]);
        setPlansError(
          "Unable to load subscription plans."
        );
      }
    } catch (error) {
      console.error(
        "Failed to load subscription plans:",
        error
      );

      setPlans([]);

      if (
        error?.message ===
        "Subscription plans request timed out."
      ) {
        setPlansError(
          "Subscription plans are taking too long to load. Please try again."
        );
      } else {
        setPlansError(
          error?.response?.data?.message ||
            "Unable to load subscription plans."
        );
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      setPlansLoading(false);
    }
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Load plans when Pricing page opens
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  /*
  |--------------------------------------------------------------------------
  | Get feature list
  |--------------------------------------------------------------------------
  */

  const getFeatureList = (plan) => {
    if (!plan?.features) {
      return [];
    }

    return Object.entries(plan.features)
      .filter(([, enabled]) => Boolean(enabled))
      .map(
        ([key]) =>
          FEATURE_LABELS[key] || key
      );
  };

  /*
  |--------------------------------------------------------------------------
  | Billing label
  |--------------------------------------------------------------------------
  */

  const getBillingLabel = (billingCycle) => {
    switch (billingCycle) {
      case "yearly":
        return "/year";

      case "custom":
        return "";

      case "monthly":
      default:
        return "/month";
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Buy subscription plan
  |--------------------------------------------------------------------------
  */

  const handleBuyPlan = async (plan) => {
    try {
      if (!plan) {
        return;
      }

      /*
       * Prefer backend plan key.
       * Fall back to name for compatibility.
       */

      const planIdentifier =
        plan.key || plan.name;

      setLoadingPlan(planIdentifier);

      /*
       * Create Razorpay order.
       */

      const res =
        await subscriptionAPI.createOrder(
          plan.name
        );

      const razorpayKey =
        res.keyId ||
        import.meta.env.VITE_RAZORPAY_KEY_ID ||
        "rzp_test_TPCMQcPRZqe62i";

      /*
       |--------------------------------------------------------------------------
       | Payment verification
       |--------------------------------------------------------------------------
       */

      const executePaymentVerification =
        async (payload) => {
          try {
            const verifyRes =
              await subscriptionAPI.verifyPayment(
                payload
              );

            /*
             * Remember the selected plan for registration.
             */

            localStorage.setItem(
              "pending_subscription_plan",
              plan.name || ""
            );

            localStorage.setItem(
              "pending_subscription_plan_key",
              plan.key || ""
            );

            alert(
              `✓ ${
                verifyRes.message ||
                "Payment successful! Welcome to " +
                  plan.name +
                  " plan."
              }`
            );

            /*
             * Continue to registration.
             */

            navigate("/register");
          } catch (err) {
            console.error(
              "Payment verification failed:",
              err
            );

            alert(
              "Payment verification error: " +
                (err?.response?.data?.message ||
                  err?.message ||
                  "Unknown error")
            );
          } finally {
            setLoadingPlan(null);
          }
        };

      /*
       |--------------------------------------------------------------------------
       | Mock/test payment
       |--------------------------------------------------------------------------
       |
       | Keep the same behavior that was already working.
       |
       */

      if (
        res.isMock ||
        res.orderId?.startsWith(
          "order_test_"
        ) ||
        typeof window.Razorpay ===
          "undefined"
      ) {
        await executePaymentVerification({
          razorpay_order_id:
            res.orderId,

          razorpay_payment_id:
            `pay_test_${Date.now()}`,

          razorpay_signature:
            "mock_signature",

          planName: plan.name,
        });

        return;
      }

      /*
       |--------------------------------------------------------------------------
       | Razorpay options
       |--------------------------------------------------------------------------
       */

      const options = {
        key: razorpayKey,

        amount: res.amount,

        currency:
          res.currency || "INR",

        name: "SmartBill",

        description:
          `${plan.name} Plan Subscription`,

        order_id: res.orderId,

        handler:
          async function (response) {
            await executePaymentVerification({
              razorpay_order_id:
                response.razorpay_order_id,

              razorpay_payment_id:
                response.razorpay_payment_id,

              razorpay_signature:
                response.razorpay_signature,

              planName: plan.name,
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

      /*
       |--------------------------------------------------------------------------
       | Open Razorpay
       |--------------------------------------------------------------------------
       */

      try {
        const rzp =
          new window.Razorpay(
            options
          );

        rzp.open();
      } catch (rzpErr) {
        console.warn(
          "Razorpay SDK modal error, falling back to test mode:",
          rzpErr
        );

        await executePaymentVerification({
          razorpay_order_id:
            res.orderId,

          razorpay_payment_id:
            `pay_test_${Date.now()}`,

          razorpay_signature:
            "mock_signature",

          planName: plan.name,
        });
      }
    } catch (error) {
      console.error(
        "Payment initiation failed:",
        error
      );

      alert(
        "Could not start payment process: " +
          (error?.response?.data?.message ||
            error?.message ||
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">

      <PublicNavbar />

      <section
        id="pricing"
        className="py-20 px-6 bg-slate-50 flex-1"
      >
        <div className="max-w-7xl mx-auto">

          {/* ==============================================================
              Heading
          ============================================================== */}

          <div className="text-center mb-14">

            <p className="text-xs text-blue-600 font-semibold uppercase tracking-widest mb-3">
              Pricing
            </p>

            <h2 className="text-3xl font-extrabold text-slate-900 mb-3">
              Choose the right plan for your business
            </h2>

            <p className="text-slate-500 max-w-xl mx-auto">
              Flexible subscription plans designed
              to grow with your business.
            </p>

          </div>

          {/* ==============================================================
              Loading
          ============================================================== */}

          {plansLoading && (
            <div className="flex justify-center py-16">

              <div className="flex items-center gap-3 text-slate-600">

                <div
                  className="
                    w-5
                    h-5
                    border-2
                    border-slate-300
                    border-t-blue-600
                    rounded-full
                    animate-spin
                  "
                />

                <span>
                  Loading plans...
                </span>

              </div>

            </div>
          )}

          {/* ==============================================================
              Error
          ============================================================== */}

          {!plansLoading &&
            plansError && (
              <div className="text-center py-16">

                <p className="text-red-600 mb-4">
                  {plansError}
                </p>

                <button
                  type="button"
                  onClick={fetchPlans}
                  className="
                    px-5
                    py-2
                    rounded-lg
                    bg-blue-600
                    text-white
                    text-sm
                    font-semibold
                    hover:bg-blue-700
                    transition
                  "
                >
                  Try Again
                </button>

              </div>
            )}

          {/* ==============================================================
              No Plans
          ============================================================== */}

          {!plansLoading &&
            !plansError &&
            plans.length === 0 && (
              <div className="text-center py-16">

                <p className="text-slate-600">
                  No subscription plans are
                  currently available.
                </p>

              </div>
            )}

          {/* ==============================================================
              Plans
          ============================================================== */}

          {!plansLoading &&
            !plansError &&
            plans.length > 0 && (
              <div
                className="
                  grid
                  grid-cols-1
                  md:grid-cols-2
                  lg:grid-cols-3
                  gap-8
                  max-w-6xl
                  mx-auto
                "
              >

                {plans.map(
                  (plan, index) => {
                    const featureList =
                      getFeatureList(
                        plan
                      );

                    /*
                     * Pro is popular when available.
                     * Otherwise second plan is popular.
                     */

                    const hasProPlan =
                      plans.some(
                        (item) =>
                          item.name?.toLowerCase() ===
                          "pro"
                      );

                    const isPopular =
                      plan.name?.toLowerCase() ===
                        "pro" ||
                      (!hasProPlan &&
                        index === 1);

                    const billingLabel =
                      getBillingLabel(
                        plan.billingCycle
                      );

                    const planIdentifier =
                      plan.key ||
                      plan.name ||
                      index;

                    return (
                      <div
                        key={
                          plan._id ||
                          plan.key ||
                          `${plan.name}-${index}`
                        }
                        className={`
                          relative
                          rounded-2xl
                          border
                          ${
                            isPopular
                              ? `
                                border-blue-500
                                shadow-xl
                                shadow-blue-100
                              `
                              : `
                                border-slate-200
                                shadow-sm
                              `
                          }
                          bg-white
                          p-8
                          flex
                          flex-col
                        `}
                      >

                        {/* Popular Badge */}

                        {isPopular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">

                            <span
                              className="
                                rounded-full
                                bg-blue-600
                                px-4
                                py-1
                                text-xs
                                font-semibold
                                text-white
                                whitespace-nowrap
                              "
                            >
                              Most Popular
                            </span>

                          </div>
                        )}

                        {/* Plan Name */}

                        <h3 className="text-xl font-bold text-slate-900">
                          {plan.name}
                        </h3>

                        {/* Price */}

                        <div className="mt-4 flex items-baseline gap-1">

                          <span className="text-4xl font-bold text-slate-900">
                            ₹
                            {Number(
                              plan.price || 0
                            ).toLocaleString(
                              "en-IN"
                            )}
                          </span>

                          {billingLabel && (
                            <span className="text-sm text-slate-500">
                              {billingLabel}
                            </span>
                          )}

                        </div>

                        {/* Custom billing */}

                        {plan.billingCycle ===
                          "custom" && (
                          <p className="text-sm text-slate-500 mt-1">
                            Custom billing
                          </p>
                        )}

                        {/* Features */}

                        <div className="mt-8 space-y-3 flex-1">

                          {featureList.length >
                          0 ? (
                            featureList.map(
                              (feature) => (
                                <div
                                  key={
                                    feature
                                  }
                                  className="flex items-start gap-3"
                                >

                                  <div
                                    className="
                                      mt-0.5
                                      flex
                                      h-5
                                      w-5
                                      shrink-0
                                      items-center
                                      justify-center
                                      rounded-full
                                      bg-emerald-100
                                    "
                                  >

                                    <Check
                                      className="
                                        h-3.5
                                        w-3.5
                                        text-emerald-600
                                      "
                                    />

                                  </div>

                                  <span
                                    className="
                                      text-sm
                                      text-slate-600
                                    "
                                  >
                                    {feature}
                                  </span>

                                </div>
                              )
                            )
                          ) : (
                            <p className="text-sm text-slate-400">
                              No additional
                              features listed.
                            </p>
                          )}

                        </div>

                        {/* Get Started */}

                        <Btn
                          variant={
                            isPopular
                              ? "primary"
                              : "outline"
                          }
                          onClick={() =>
                            handleBuyPlan(
                              plan
                            )
                          }
                          disabled={
                            loadingPlan ===
                            planIdentifier
                          }
                          className="w-full justify-center mt-8"
                        >
                          {loadingPlan ===
                          planIdentifier
                            ? "Processing..."
                            : "Get Started"}
                        </Btn>

                      </div>
                    );
                  }
                )}

              </div>
            )}

        </div>
      </section>

    </div>
  );
}