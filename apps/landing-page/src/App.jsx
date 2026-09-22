import { CustomizationProvider } from "@shared/context/CustomizationContext.jsx";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import ErrorBoundary from "@shared/components/common/ErrorBoundary.jsx";
import LandingPage from "./pages/LandingPage";
import {
  FeaturesPage, PricingPage, AboutPage, BlogPage, 
  CareersPage, HelpCenterPage, StatusPage, ContactPage
} from "./pages/FooterPages";

import { getCrmUrl } from "@shared/utils/urlUtils.js";

function AppRoutes() {
  const navigate = useNavigate();

  const navAuth = (v) => {
    if (v === "landing") navigate("/");
    else if (v === "login") {
       window.location.href = getCrmUrl("/login");
    } else if (v === "register") {
       window.location.href = getCrmUrl("/register");
    } else {
       navigate(`/${v}`);
    }
  };

  return (
    <Routes>
      <Route path="/" element={<LandingPage onNav={navAuth} />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/careers" element={<CareersPage />} />
      <Route path="/help-center" element={<HelpCenterPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="*" element={<LandingPage onNav={navAuth} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CustomizationProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </CustomizationProvider>
    </ErrorBoundary>
  );
}



