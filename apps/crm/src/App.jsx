import { useState, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import AuthScreen from "@shared/components/AuthScreen.jsx";
import AppShell from "./AppShell";
import { CustomizationProvider, applyDOMCustomization } from "@shared/context/CustomizationContext.jsx";
import { NotificationProvider } from "@shared/context/NotificationContext.jsx";
import { useCustomization } from "@shared/hooks/useCustomization.js";
import { setUserToStorage } from "@shared/utils/userUtils.js";
import { AccountingProvider } from "@shared/context/AccountingContext.jsx";

const APP_PAGES = [
  "dashboard",
  "businesses",
  "revenue",
  "customers",
  "suppliers",
  "products",
  "pos",
  "sales",
  "billing",
  "sales-billing",
  "purchase",
  "inventory",
  "reports",
  "expenses",
  "users",
  "settings",
  "notifications",
  "profile",
];

function getPageFromPath(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "app") return null;
  const pageKey = segments[1];
  if (pageKey === "sales" || pageKey === "billing" || pageKey === "sales-billing") {
    return "pos";
  }
  return APP_PAGES.includes(pageKey) ? pageKey : "dashboard";
}

function ThemeRouteManager() {
  const location = useLocation();
  const { tempSettings } = useCustomization();
  useEffect(() => {
    const isAppRoute = location.pathname.startsWith("/app");
    applyDOMCustomization(tempSettings, isAppRoute);
  }, [location.pathname, tempSettings]);
  return null;
}

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("smartbill_user");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [role, setRole] = useState(() => user?.role || "owner");
  const [page, setPage] = useState(() => getPageFromPath(location.pathname) ?? "dashboard");

  useEffect(() => {
    const routePage = getPageFromPath(location.pathname);
    if (location.pathname === "/app") { setPage("dashboard"); return; }
    if (routePage) setPage(routePage);
  }, [location.pathname, role]);

  useEffect(() => {
    // Cross-app SSO token parameter support
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      localStorage.setItem("smartbill_token", urlToken);
      const urlUser = params.get("user");
      if (urlUser) {
        try {
          const parsed = JSON.parse(decodeURIComponent(urlUser));
          localStorage.setItem("smartbill_user", JSON.stringify(parsed));
          setUser(parsed);
          if (parsed.role) setRole(parsed.role);
        } catch {}
      }
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  useEffect(() => {
    const syncUser = () => {
      try {
        const raw = localStorage.getItem("smartbill_user");
        if (raw) {
          const parsed = JSON.parse(raw);
          setUser(parsed);
          if (parsed.role) setRole(parsed.role);
        }
      } catch {}
    };
    const token = localStorage.getItem("smartbill_token");
    if (token) {
      import("@shared/api/authAPI.js").then(({ getProfile }) => {
        getProfile().then((res) => {
          if (res?.user) {
            setUser(res.user);
            if (res.user.role) setRole(res.user.role);
            setUserToStorage(res.user);
          }
        }).catch(() => {});
      });
    }
    window.addEventListener("userUpdated", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("userUpdated", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  const handleLogin = (r, u) => {
    if (r === "superadmin") {
       window.location.href = "http://localhost:5175/login";
       return;
    }
    setRole(r);
    if (u) setUser(u);
    else {
      try { const raw = localStorage.getItem("smartbill_user"); if (raw) setUser(JSON.parse(raw)); } catch {}
    }
    setPage("dashboard");
    navigate("/app");
  };

  const handleLogout = () => {
    localStorage.removeItem("smartbill_token");
    localStorage.removeItem("smartbill_user");
    setUser(null);
    setPage("dashboard");
    applyDOMCustomization(null, false);
    navigate("/login");
  };

  const navAuth = useCallback((v) => {
    if (v === "landing") window.location.href = "http://localhost:5173/";
    else navigate(`/${v}`);
  }, [navigate]);

  const navApp = useCallback((p) => {
    const targetPage = (p === "sales" || p === "billing" || p === "sales-billing") ? "pos" : p;
    setPage(targetPage);
    if (targetPage === "dashboard") navigate("/app");
    else navigate(`/app/${targetPage}`);
  }, [navigate]);

  if (role === "superadmin" && location.pathname.startsWith("/app")) {
     window.location.href = "http://localhost:5175/app";
     return null;
  }

  return (
    <NotificationProvider onNav={navApp}>
      <ThemeRouteManager />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AuthScreen view="login" onNav={navAuth} onLogin={handleLogin} />} />
        <Route path="/register" element={<AuthScreen view="register" onNav={navAuth} onLogin={handleLogin} />} />
        <Route path="/forgot" element={<AuthScreen view="forgot" onNav={navAuth} />} />
        <Route path="/app" element={<AppShell role={role} user={user} onLogout={handleLogout} page={page} onNav={navApp} />} />
        <Route path="/app/:pageKey" element={<AppShell role={role} user={user} onLogout={handleLogout} page={page} onNav={navApp} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </NotificationProvider>
  );
}

export default function App() {
  return (
    <CustomizationProvider>
      <AccountingProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AccountingProvider>
    </CustomizationProvider>
  );
}



