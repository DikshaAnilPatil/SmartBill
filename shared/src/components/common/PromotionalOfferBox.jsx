import { useState, useEffect } from "react";
import { Tag, Copy, Check, ArrowRight, Sparkles, Gift } from "lucide-react";
import { getFeaturedBanner } from "../../api/couponAPI";
import { getCrmUrl } from "../../utils/urlUtils";

/**
 * PromotionalOfferBox
 * A professional, high-converting offer card widget placed below the pricing grid.
 */
export default function PromotionalOfferBox({ onCtaClick, className = "" }) {
  const [offer, setOffer] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getFeaturedBanner()
      .then((res) => {
        if (isMounted && res?.success && res?.banner) {
          setOffer(res.banner);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  if (!offer) return null;

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!offer.code) return;
    navigator.clipboard.writeText(offer.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCta = () => {
    if (onCtaClick) {
      onCtaClick(offer);
    } else {
      window.location.href = getCrmUrl("/register");
    }
  };

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`}>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 shadow-xl text-white p-6 sm:p-7 transition-all duration-300">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left: Icon & Offer Info */}
          <div className="flex items-start gap-4 flex-1">
            <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-blue-400">
              <Gift className="w-6 h-6 text-blue-400" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
                  <Sparkles className="w-3 h-3 text-blue-300" />
                  Special Promotion
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Limited Time Deal
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                {offer.title || "Exclusive Savings Available"}
              </h3>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                {offer.bannerText || `Apply coupon code ${offer.code} during checkout to unlock special subscription discounts.`}
              </p>
            </div>
          </div>

          {/* Right: Coupon Pill & Direct CTA */}
          <div className="flex items-center gap-3 flex-shrink-0 w-full md:w-auto justify-end">
            {offer.code && (
              <button
                type="button"
                onClick={handleCopy}
                title="Click to copy coupon code"
                className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700/90 text-slate-200 border border-slate-600 text-xs font-mono font-bold px-3 py-2 rounded-xl transition cursor-pointer shadow-xs"
              >
                <span>{offer.code}</span>
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleCta}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition cursor-pointer"
            >
              <span>{offer.bannerCta || "Claim Offer"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
