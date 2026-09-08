import React, { useState } from "react";
import { BarChart2, X, Menu } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getCrmUrl } from "../../utils/urlUtils";
import { Btn } from "./ui";
import PromotionalBanner from "./PromotionalBanner";

export default function PublicNavbar({ onNav }) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const navigate = useNavigate();

  const handleAuthNav = (path) => {
    if (onNav) {
      onNav(path);
    } else {
      window.location.href = getCrmUrl(`/${path}`);
    }
  };

  return (
    <>
      <PromotionalBanner onCtaClick={() => handleAuthNav("register")} />
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">Smart Bill</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 flex-1">
            {["Features", "Pricing", "Contact"].map((l) => (
              <a
                key={l}
                href={`/#${l.toLowerCase()}`}
                className="text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium"
              >
                {l}
              </a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            <Btn variant="ghost" onClick={() => handleAuthNav("login")}>
              Sign In
            </Btn>
            <Btn variant="primary" onClick={() => handleAuthNav("register")}>
              Start Free Trial
            </Btn>
          </div>
          <button
            onClick={() => setMobileMenu((v) => !v)}
            className="md:hidden ml-auto text-slate-600 cursor-pointer"
          >
            {mobileMenu ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
        {mobileMenu && (
          <div className="md:hidden border-t border-slate-100 px-6 py-4 space-y-3 bg-white">
            {["Features", "Pricing", "Contact"].map((l) => (
              <a
                key={l}
                href={`/#${l.toLowerCase()}`}
                className="block text-sm text-slate-700 py-1.5"
                onClick={() => setMobileMenu(false)}
              >
                {l}
              </a>
            ))}
            <div className="flex gap-3 pt-2">
              <Btn
                variant="outline"
                onClick={() => handleAuthNav("login")}
                className="flex-1"
              >
                Sign In
              </Btn>
              <Btn
                variant="primary"
                onClick={() => handleAuthNav("register")}
                className="flex-1"
              >
                Try Free
              </Btn>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
