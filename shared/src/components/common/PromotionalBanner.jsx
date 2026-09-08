import { useState, useEffect } from "react";
import { Megaphone, Copy, Check, X, ArrowRight, Sparkles } from "lucide-react";
import { getFeaturedBanner } from "../../api/couponAPI";
import { getCrmUrl, getLandingUrl } from "../../utils/urlUtils";

export default function PromotionalBanner({ onCtaClick, isCrm = false }) {
  const [banner, setBanner] = useState(null);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getFeaturedBanner()
      .then((res) => {
        if (isMounted && res?.success && res?.banner) {
          setBanner(res.banner);
        }
      })
      .catch((err) => {
        console.error("Error fetching promotional banner:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!banner || dismissed) return null;

  const handleCopyCode = (e) => {
    e.stopPropagation();
    if (!banner.code) return;
    navigator.clipboard.writeText(banner.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCta = () => {
    if (onCtaClick) {
      onCtaClick(banner);
    } else if (isCrm) {
      window.location.href = getCrmUrl("/app/settings");
    } else {
      window.location.href = getCrmUrl("/register");
    }
  };

  return (
    <div className="relative z-50 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-md border-b border-white/10 animate-in slide-in-from-top duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Left: Sparkle Badge & Headline */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="flex-shrink-0 inline-flex items-center gap-1 bg-white/20 hover:bg-white/25 text-white text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full backdrop-blur-sm shadow-sm transition">
            <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
            Special Offer
          </span>
          <p className="font-semibold text-white truncate">
            {banner.bannerText || `${banner.title}: Use code ${banner.code} for discount!`}
          </p>
        </div>

        {/* Right: Coupon Code Box, CTA, & Dismiss Button */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {banner.code && (
            <button
              onClick={handleCopyCode}
              title="Click to copy coupon code"
              className="flex items-center gap-1.5 bg-black/25 hover:bg-black/35 text-white font-mono font-bold text-xs px-2.5 py-1 rounded-lg border border-white/20 transition cursor-pointer"
            >
              <span>{banner.code}</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-white/70" />
              )}
            </button>
          )}

          <button
            onClick={handleCta}
            className="flex items-center gap-1 bg-white text-indigo-700 hover:bg-slate-100 font-bold text-xs px-3 py-1 rounded-lg shadow-sm transition cursor-pointer"
          >
            <span>{banner.bannerCta || "Claim Offer"}</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          <button
            onClick={() => setDismissed(true)}
            title="Dismiss announcement"
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
