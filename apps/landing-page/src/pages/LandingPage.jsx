import React, { useCallback, useEffect, useState } from "react";

import Footer from "@shared/components/common/Footer";
import PublicNavbar from "@shared/components/common/PublicNavbar";

import subscriptionAPI from "@shared/api/subscriptionAPI";

import {
  ArrowRight,
  Check,
  Phone,
  Star,
  Mail,
  MapPin,
  Send,
} from "lucide-react";

import { FEATURES, TESTIMONIALS } from "@shared/constants/landing";
import { Btn, Card } from "@shared/components/common/ui";

/*
|--------------------------------------------------------------------------
| Backend feature key -> Frontend display label
|--------------------------------------------------------------------------
*/

const FEATURE_LABELS = {
  basicReports: "Basic Reports",
  advancedReports: "Advanced Reports",
  gstReports: "GST Reports",
  expenses: "Expenses",
  purchaseManagement: "Purchase Management",
  inventory: "Inventory",
  paymentTracking: "Payment Tracking",
  paymentHistory: "Payment History",
  advancedPaymentHistory: "Advanced Payment History",
  invoiceCustomization: "Invoice Customization",
  advancedInvoiceCustomization: "Advanced Invoice Customization",
  unlimitedInvoiceCustomization: "Unlimited Invoice Customization",
  stockAlerts: "Stock Alerts",
  advancedStockAlerts: "Advanced Stock Alerts",
  enhancedStockMonitoring: "Enhanced Stock Monitoring",
  dataExport: "Data Export",
};

/*
|--------------------------------------------------------------------------
| Landing Page
|--------------------------------------------------------------------------
*/

export default function LandingPage({ onNav }) {
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
  | Fetch public subscription plans
  |--------------------------------------------------------------------------
  */

  const fetchPlans = useCallback(async () => {
    let timeoutId;

    try {
      setPlansLoading(true);
      setPlansError("");

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
       * Expected backend response:
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
          error?.message ||
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

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  /*
  |--------------------------------------------------------------------------
  | Buy subscription plan
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | 1. Create Razorpay order
  | 2. Open Razorpay
  | 3. Verify payment
  | 4. Only then go to registration
  |
  */

  const handleBuyPlan = async (plan) => {
    if (!plan) {
      return;
    }

    const planIdentifier =
      plan.key ||
      plan.name ||
      "";

    try {
      setLoadingPlan(planIdentifier);

      /*
       * Store selected plan.
       *
       * Registration/payment flow can use this later.
       */

      localStorage.setItem(
        "pending_subscription_plan",
        plan.name || ""
      );

      if (plan.key) {
        localStorage.setItem(
          "pending_subscription_plan_key",
          plan.key
        );
      }

      /*
       |--------------------------------------------------------------------------
       | Step 1: Create Razorpay order
       |--------------------------------------------------------------------------
       */

      const res =
        await subscriptionAPI.createOrder(
          plan.name
        );

      console.log(
        "Create order response:",
        res
      );

      if (!res) {
        throw new Error(
          "Invalid response from payment server."
        );
      }

      /*
       |--------------------------------------------------------------------------
       | Razorpay Key
       |--------------------------------------------------------------------------
       */

      const razorpayKey =
        res.keyId ||
        import.meta.env.VITE_RAZORPAY_KEY_ID ||
        "rzp_test_TPCMQcPRZqe62i";

      /*
       |--------------------------------------------------------------------------
       | Payment verification function
       |--------------------------------------------------------------------------
       */

      const executePaymentVerification =
        async (payload) => {
          try {
            const verifyRes =
              await subscriptionAPI.verifyPayment(
                payload
              );

            console.log(
              "Payment verification response:",
              verifyRes
            );

            /*
             * Save selected plan again after successful
             * payment verification.
             */

            localStorage.setItem(
              "pending_subscription_plan",
              plan.name || ""
            );

            if (plan.key) {
              localStorage.setItem(
                "pending_subscription_plan_key",
                plan.key
              );
            }

            alert(
              `✓ ${verifyRes?.message ||
              "Payment successful! Welcome to " +
              plan.name +
              " plan."
              }`
            );

            /*
             * Only navigate after successful
             * payment verification.
             */

            onNav("register");
          } catch (err) {
            console.error(
              "Payment verification failed:",
              err
            );

            alert(
              "Payment verification error: " +
              (
                err?.response?.data?.message ||
                err?.message ||
                "Unknown error"
              )
            );
          } finally {
            setLoadingPlan(null);
          }
        };



      /*
       |--------------------------------------------------------------------------
       | Step 2: Razorpay options
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

        /*
         |--------------------------------------------------------------------------
         | Step 3: Razorpay payment success
         |--------------------------------------------------------------------------
         */

        handler: async function (response) {
          console.log(
            "Razorpay payment response:",
            response
          );

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

        /*
         |--------------------------------------------------------------------------
         | User closes Razorpay
         |--------------------------------------------------------------------------
         */

        modal: {
          ondismiss: function () {
            console.log(
              "Razorpay payment window closed."
            );

            setLoadingPlan(null);
          },
        },

        theme: {
          color: "#2563eb",
        },
      };

      /*
       |--------------------------------------------------------------------------
       | Step 4: Open Razorpay
       |--------------------------------------------------------------------------
       */

      try {
        const rzp =
          new window.Razorpay(options);

        rzp.open();
      } catch (razorpayError) {
        console.error(
          "Razorpay SDK modal error:",
          razorpayError
        );
        alert("Failed to open Razorpay payment window. Please try again.");
        setLoadingPlan(null);
      }
    } catch (error) {
      console.error(
        "Payment initiation failed:",
        error
      );

      alert(
        "Could not start payment process: " +
        (
          error?.response?.data?.message ||
          error?.message ||
          "Unknown error"
        )
      );

      setLoadingPlan(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Convert backend feature object into readable list
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
  | Billing cycle display
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
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div
      className="min-h-screen bg-white"
      style={{
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ================================================================
          Navbar
      ================================================================= */}

      <PublicNavbar onNav={onNav} />

      {/* ================================================================
          Hero
      ================================================================= */}

      <section className="bg-gradient-to-b from-slate-50 to-white pt-20 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h1 className="text-5xl font-extrabold text-slate-900 leading-tight mb-5">
              Run your entire business
              <br />

              <span className="text-blue-600">
                smarter & faster
              </span>
            </h1>

            <p className="text-lg text-slate-500 leading-relaxed mb-8 max-w-2xl mx-auto">
              Invoicing, inventory, GST filing,
              purchase orders, and financial
              reports — everything your business
              needs in one powerful platform.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Btn
                variant="primary"
                size="lg"
                onClick={() =>
                  onNav("register")
                }
                icon={
                  <ArrowRight className="w-4 h-4" />
                }
              >
                Start 14-Day Free Trial
              </Btn>
            </div>

            <p className="text-xs text-slate-400 mt-6 leading-tight">
              No credit card required · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================
          Trust Bar
      ================================================================= */}

      <section className="hidden">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="flex flex-wrap justify-center gap-8 items-center">
            {/* Trusted by logos removed */}
          </div>
        </div>
      </section>

      {/* ================================================================
          Features
      ================================================================= */}

      <section
        id="features"
        className="py-4 px-6 bg-white"
      >
        <div className="max-w-7xl mx-auto">

          <div className="text-center mb-14">
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-widest mb-3">
              Features
            </p>

            <h2 className="text-3xl font-extrabold text-slate-900 mb-3">
              Everything you need to run your business
            </h2>

            <p className="text-slate-500 max-w-xl mx-auto">
              Powerful tools built for Indian
              businesses — from solo traders to
              enterprise chains.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {FEATURES.map((feature) => (
              <Card
                key={feature.title}
                className="p-6 hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${feature.color}`}
                >
                  <feature.icon className="w-5 h-5" />
                </div>

                <h3 className="font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>

                <p className="text-sm text-slate-500 leading-relaxed">
                  {feature.desc}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          Pricing
      ================================================================= */}

      <section
        id="pricing"
        className="py-20 px-6 bg-slate-50"
      >
        <div className="max-w-7xl mx-auto">

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

          {/* ============================================================
              Loading
          ============================================================= */}

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

          {/* ============================================================
              Error
          ============================================================= */}

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

          {/* ============================================================
              No Plans
          ============================================================= */}

          {!plansLoading &&
            !plansError &&
            plans.length === 0 && (
              <div className="text-center py-16">
                <p className="text-slate-600">
                  No subscription plans are currently
                  available.
                </p>
              </div>
            )}

          {/* ============================================================
              Dynamic Plans
          ============================================================= */}

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
                {plans.map((plan, index) => {
                  const featureList =
                    getFeatureList(plan);

                  /*
                   * Pro is popular when available.
                   *
                   * Otherwise second plan becomes popular.
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
                        ${isPopular
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

                      {/* Custom Billing */}

                      {plan.billingCycle ===
                        "custom" && (
                          <p className="text-sm text-slate-500 mt-1">
                            Custom billing
                          </p>
                        )}

                      {/* Features */}

                      <div className="mt-8 space-y-3 flex-1">

                        {featureList.length > 0 ? (
                          featureList.map(
                            (feature) => (
                              <div
                                key={feature}
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
                            No additional features listed.
                          </p>
                        )}

                      </div>

                      {/* Get Started */}

                      <button
                        type="button"
                        disabled={
                          loadingPlan ===
                          planIdentifier
                        }
                        onClick={() =>
                          handleBuyPlan(plan)
                        }
                        className={`
                          mt-8
                          w-full
                          rounded-lg
                          px-4
                          py-3
                          text-sm
                          font-semibold
                          transition
                          disabled:opacity-60
                          disabled:cursor-not-allowed
                          ${isPopular
                            ? `
                                bg-blue-600
                                text-white
                                hover:bg-blue-700
                              `
                            : `
                                border
                                border-slate-300
                                bg-white
                                text-slate-900
                                hover:bg-slate-50
                              `
                          }
                        `}
                      >
                        {loadingPlan ===
                          planIdentifier
                          ? "Processing..."
                          : "Get Started"}
                      </button>

                    </div>
                  );
                })}
              </div>
            )}

        </div>
      </section>

      {/* ================================================================
          Testimonials
      ================================================================= */}

      {/*
      <section
        id="testimonials"
        className="py-20 px-6 bg-white"
      >
        ...
      </section>
      */}

      {/* ================================================================
          Contact
      ================================================================= */}

      <section id="contact" className="py-20 px-6 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-12">

          <div className="flex-1 space-y-8">
            <div>
              <p className="text-xs text-blue-600 font-semibold uppercase tracking-widest mb-3">
                Contact Us
              </p>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-3">
                Get in touch
              </h2>
              <p className="text-slate-500">
                Have questions about pricing, features, or need technical support? Our team is here to help you.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              <div className="bg-blue-600 rounded-3xl p-8 text-white shadow-xl shadow-blue-600/20 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm border border-white/20">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Chat with Sales</h3>
                <p className="text-blue-100 mb-6">Speak to our friendly team about enterprise plans and custom solutions.</p>
                <a href="mailto:prathameshbhavsar@gmail.com" className="font-bold text-lg hover:underline">prathameshbhavsar@gmail.com</a>
              </div>

              <div className="flex flex-col sm:flex-row gap-6">
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex-1">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 border border-slate-100">
                    <Phone className="w-6 h-6 text-slate-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Call Support</h3>
                  <p className="text-slate-500 mb-6">Mon-Fri from 9am to 6pm IST.</p>
                  <a href="tel:+918830164600" className="font-bold text-lg text-slate-900 hover:text-blue-600 transition-colors">+91 88301 64600</a>
                </div>

                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex-1">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 border border-slate-100">
                    <MapPin className="w-6 h-6 text-slate-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Visit Us</h3>
                  <p className="text-slate-500 mb-6 leading-relaxed">Nashik, Maharashtra, 422001</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white p-8 md:p-10 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 h-fit">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">Send us a message</h2>
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">First Name</label>
                  <input type="text" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Last Name</label>
                  <input type="text" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Email Address</label>
                <input type="email" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">How can we help?</label>
                <textarea rows="4" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all resize-none" placeholder="Tell us more about your inquiry..."></textarea>
              </div>

              <button className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2">
                Send Message <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      </section>

      {/* ================================================================
          CTA
      ================================================================= */}

      <section className="py-20 px-6 bg-blue-600">
        <div className="max-w-2xl mx-auto text-center">

          <h2 className="text-3xl font-extrabold text-white mb-4">
            Ready to transform your business?
          </h2>

          <p className="text-blue-100 mb-8">
            Join 50,000+ businesses already using
            Smart bill.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">

            <Btn
              variant="secondary"
              size="lg"
              onClick={() =>
                onNav("register")
              }
            >
              Start Free Trial
            </Btn>

            <button
              type="button"
              className="
                text-blue-200
                hover:text-white
                text-sm
                font-medium
                transition-colors
                flex
                items-center
                gap-2
              "
            >
              <Phone className="w-4 h-4" />
              Talk to Sales
            </button>

          </div>
        </div>
      </section>

      {/* ================================================================
          Footer
      ================================================================= */}

      <Footer />
    </div>
  );
}