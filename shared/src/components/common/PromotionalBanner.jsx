import { useState, useEffect } from "react";
import { Tag, Copy, Check, X, ArrowRight } from "lucide-react";
import { getFeaturedBanner } from "../../api/couponAPI";
import { getCrmUrl } from "../../utils/urlUtils";

export default function PromotionalBanner({ onCtaClick, isCrm = false, className = "" }) {
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
    setTimeout(() => setCopied(false), 2000);
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
    <div className={`relative z-40 bg-slate-900 border border-slate-800 text-slate-300 text-xs shadow-sm transition-all duration-200 rounded-xl overflow-hidden ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        {/* Left: Tag Badge & Headline */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md flex-shrink-0">
            <Tag className="w-3 h-3 text-blue-400" />
            Announcement
          </span>
          <p className="font-normal text-slate-200 truncate text-xs">
            {banner.bannerText || `${banner.title || "Special Promotion"}: Use code ${banner.code} for a limited-time discount.`}
          </p>
        </div>

        {/* Right: Coupon Code Box, CTA, & Dismiss Button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {banner.code && (
            <button
              onClick={handleCopyCode}
              title="Click to copy coupon code"
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md transition cursor-pointer"
            >
              <span>{banner.code}</span>
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-slate-400" />
              )}
            </button>
          )}

          <button
            onClick={handleCta}
            className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] px-2.5 py-1 rounded-md transition shadow-xs cursor-pointer"
          >
            <span>{banner.bannerCta || "View Offer"}</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          <button
            onClick={() => setDismissed(true)}
            title="Dismiss"
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition cursor-pointer ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

