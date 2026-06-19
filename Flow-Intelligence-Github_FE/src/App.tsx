import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DesktopSidebar, MobileNav } from "./components/AppLayout.js";
import { DashboardPage }       from "./pages/DashboardPage.js";
import { ReviewCIMetricsPage } from "./pages/ReviewCIMetricsPage.js";
import { RulebookPage }        from "./pages/RulebookPage.js";
import { RiskPage }            from "./pages/RiskPage.js";
import { ComingSoon }          from "./pages/ComingSoon.js";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex bg-slate-950">
        <DesktopSidebar />
        <MobileNav />
        <main className="flex-1 lg:ml-60 min-h-screen pt-14 lg:pt-0">
          <Routes>
            <Route path="/"          element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/review-ci" element={<ReviewCIMetricsPage />} />
            <Route path="/rulebook"  element={<RulebookPage />} />
            <Route path="/risk"      element={<RiskPage />} />
            <Route path="/brief"     element={<ComingSoon title="AI Weekly Brief"  owner="Anh Quân" />} />
            <Route path="/privacy"   element={<ComingSoon title="Privacy Settings" owner="Anh Quân" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
