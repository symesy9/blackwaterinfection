import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import FacilityLockdownOverlay from "./components/FacilityLockdownOverlay";
import ContainmentProtocol from "./pages/ContainmentProtocol";
import InfectionStation from "./pages/InfectionStation";
import Transmission from "./pages/Transmission";
import WhitelistCheckerPage from "./pages/WhitelistCheckerPage";
import AdminRouteGuard from "./features/whitelist/components/AdminRouteGuard";
import AdminLayout from "./features/whitelist/components/AdminLayout";
import { CONTAINMENT_GAME_PUBLIC, FACILITY_LOCKDOWN } from "./lib/features";

const AdminLoginPage = lazy(() => import("./pages/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminWalletsPage = lazy(() => import("./pages/AdminWalletsPage"));
const AdminImportPage = lazy(() => import("./pages/AdminImportPage"));
const AdminAuditPage = lazy(() => import("./pages/AdminAuditPage"));
const AdminExportPage = lazy(() => import("./pages/AdminExportPage"));

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

  if (!FACILITY_LOCKDOWN || isAdminRoute) {
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
        <Route path="/" element={<Transmission />} />
        <Route path="/infection" element={<InfectionStation />} />
        <Route
          path="/containment"
          element={CONTAINMENT_GAME_PUBLIC ? <ContainmentProtocol /> : <Navigate to="/" replace />}
        />
        <Route path="/whitelist" element={<WhitelistCheckerPage />} />
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
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminDashboardPage />
                </Suspense>
              }
            />
            <Route
              path="wallets"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminWalletsPage />
                </Suspense>
              }
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
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminExportPage />
                </Suspense>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
