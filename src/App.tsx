import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import FacilityLockdownOverlay from "./components/FacilityLockdownOverlay";
import ContainmentProtocol from "./pages/ContainmentProtocol";
import InfectionStation from "./pages/InfectionStation";
import HomePage from "./pages/HomePage";
import Transmission from "./pages/Transmission";
import WalletCheckerPage from "./pages/WalletCheckerPage";
import WhitelistCheckerPage from "./pages/WhitelistCheckerPage";
import FcfsPage from "./pages/FcfsPage";
import RoadmapPage from "./pages/RoadmapPage";
import LogsPage from "./pages/LogsPage";
import TeamPage from "./pages/TeamPage";
import FaqsPage from "./pages/FaqsPage";
import AdminRouteGuard from "./features/whitelist/components/AdminRouteGuard";
import AdminLayout from "./features/whitelist/components/AdminLayout";
import { CONTAINMENT_GAME_PUBLIC, FACILITY_LOCKDOWN, USE_NEW_HOMEPAGE } from "./lib/features";

const AdminLoginPage = lazy(() => import("./pages/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminWalletsPage = lazy(() => import("./pages/AdminWalletsPage"));
const AdminImportPage = lazy(() => import("./pages/AdminImportPage"));
const AdminAuditPage = lazy(() => import("./pages/AdminAuditPage"));
const AdminFcfsPage = lazy(() => import("./pages/AdminFcfsPage"));
const AdminFcfsAuditPage = lazy(() => import("./pages/AdminFcfsAuditPage"));
const AdminFcfsWalletAuditPage = lazy(
  () => import("./pages/AdminFcfsWalletAuditPage"),
);
const AdminClearanceOverviewPage = lazy(
  () => import("./pages/AdminClearanceOverviewPage"),
);
const AdminClearanceCrossListPage = lazy(
  () => import("./pages/AdminClearanceCrossListPage"),
);
const AdminClearanceExportPage = lazy(
  () => import("./pages/AdminClearanceExportPage"),
);
const AdminClearanceBurstAuditPage = lazy(
  () => import("./pages/AdminClearanceBurstAuditPage"),
);

function AdminFallback() {
  return (
    <div className="wl-admin wl-admin--center">
      <p className="wl-admin__loading">Loading admin…</p>
    </div>
  );
}

function PublicFacilityLockdown() {
  const { pathname } = useLocation();
  const isAdminRoute = pathname.startsWith("/admin");
  const isFcfsRoute = pathname.startsWith("/fcfs");

  if (!FACILITY_LOCKDOWN || isAdminRoute || isFcfsRoute) {
    return null;
  }

  return <FacilityLockdownOverlay />;
}

export default function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

  return (
    <BrowserRouter basename={basename}>
      <PublicFacilityLockdown />
      <Routes>
        <Route path="/" element={USE_NEW_HOMEPAGE ? <HomePage /> : <Transmission />} />
        <Route path="/legacy-home" element={<Transmission />} />
        <Route path="/infection" element={<InfectionStation />} />
        <Route
          path="/containment"
          element={CONTAINMENT_GAME_PUBLIC ? <ContainmentProtocol /> : <Navigate to="/" replace />}
        />
        <Route path="/wallet-checker" element={<WalletCheckerPage />} />
        <Route path="/whitelist" element={<WhitelistCheckerPage />} />
        <Route path="/fcfs" element={<FcfsPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/logs/:slug" element={<Navigate to="/logs" replace />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/faqs" element={<FaqsPage />} />
        <Route
          path="/admin/login"
          element={
            <Suspense fallback={<AdminFallback />}>
              <AdminLoginPage />
            </Suspense>
          }
        />
        <Route element={<AdminRouteGuard />}>
          <Route
            path="/admin"
            element={
              <AdminLayout />
            }
          >
            <Route
              index
              element={<Navigate to="/admin/clearance" replace />}
            />
            <Route
              path="clearance"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminClearanceOverviewPage />
                </Suspense>
              }
            />
            <Route
              path="clearance/whitelist"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminWalletsPage />
                </Suspense>
              }
            />
            <Route
              path="clearance/fcfs"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminFcfsPage />
                </Suspense>
              }
            />
            <Route
              path="clearance/cross-list"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminClearanceCrossListPage />
                </Suspense>
              }
            />
            <Route
              path="clearance/burst-audit"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminClearanceBurstAuditPage />
                </Suspense>
              }
            />
            <Route
              path="clearance/wallet-audit"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminFcfsWalletAuditPage />
                </Suspense>
              }
            />
            <Route
              path="clearance/export"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminClearanceExportPage />
                </Suspense>
              }
            />
            <Route
              path="dashboard"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminDashboardPage />
                </Suspense>
              }
            />
            <Route
              path="wallets"
              element={<Navigate to="/admin/clearance/whitelist" replace />}
            />
            <Route
              path="import"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminImportPage />
                </Suspense>
              }
            />
            <Route
              path="audit"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminAuditPage />
                </Suspense>
              }
            />
            <Route
              path="export"
              element={<Navigate to="/admin/clearance/export" replace />}
            />
            <Route
              path="fcfs"
              element={<Navigate to="/admin/clearance/fcfs" replace />}
            />
            <Route
              path="fcfs/audit"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminFcfsAuditPage />
                </Suspense>
              }
            />
            <Route
              path="fcfs/wallet-audit"
              element={<Navigate to="/admin/clearance/wallet-audit" replace />}
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
