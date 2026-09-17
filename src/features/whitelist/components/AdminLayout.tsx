import { useEffect, useId, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { HOME_ASSETS } from "../../../lib/homeAssets";
import { useAdminAuth } from "../hooks/useAdminAuth";
import AdminLogoMark from "./AdminLogoMark";

const NAV = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/wallets", label: "WL Applications", end: false },
  { to: "/admin/fcfs", label: "FCFS Applications", end: true },
  { to: "/admin/fcfs/audit", label: "FCFS Audit", end: false },
  { to: "/admin/import", label: "Import", end: false },
  { to: "/admin/audit", label: "Audit Log", end: false },
  { to: "/admin/export", label: "Export", end: false },
];

function AdminNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="wl-admin__nav-list">
      {NAV.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `wl-admin__nav-link${isActive ? " is-active" : ""}`
            }
            onClick={onNavigate}
          >
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export default function AdminLayout() {
  const { user, signOut } = useAdminAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    document.documentElement.classList.add("rz2-page-scroll");
    document.body.classList.add("rz2-page-scroll", "wl-admin-active");
    return () => {
      document.documentElement.classList.remove("rz2-page-scroll");
      document.body.classList.remove("rz2-page-scroll", "wl-admin-active");
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("wl-admin-menu-open", menuOpen);
    return () => document.body.classList.remove("wl-admin-menu-open");
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="wl-admin wl-admin--shell">
      <div className="wl-admin__fx" aria-hidden="true">
        <img
          className="wl-admin__atmosphere"
          src={HOME_ASSETS.atmosphere}
          alt=""
          width={1672}
          height={941}
          decoding="async"
        />
        <img
          className="wl-admin__lab"
          src={HOME_ASSETS.labOverlay}
          alt=""
          width={1536}
          height={1024}
          loading="lazy"
          decoding="async"
        />
        <div className="wl-admin__grain" />
        <div className="wl-admin__vignette" />
      </div>

      <header className="wl-admin__mobile-bar">
        <Link to="/" className="wl-admin__brand" onClick={closeMenu}>
          <AdminLogoMark />
          <span className="wl-admin__brand-text">
            <span className="wl-admin__brand-main">BLACKWATER LABS</span>
            <span className="wl-admin__brand-sub">Admin</span>
          </span>
        </Link>
        <button
          type="button"
          className="wl-admin__menu-btn"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? "Close admin menu" : "Open admin menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="wl-admin__menu-icon" aria-hidden="true">
            {menuOpen ? "✕" : "☰"}
          </span>
        </button>
      </header>

      <aside
        id={menuId}
        className={`wl-admin__drawer${menuOpen ? " is-open" : ""}`}
        aria-hidden={!menuOpen}
      >
        <div className="wl-admin__drawer-inner">
          <Link to="/" className="wl-admin__drawer-brand" onClick={closeMenu}>
            <AdminLogoMark variant="drawer" />
            <span className="wl-admin__brand-text">
              <span className="wl-admin__brand-main">BLACKWATER LABS</span>
              <span className="wl-admin__brand-sub">Admin Clearance</span>
            </span>
          </Link>
          <div className="wl-admin__drawer-scroll">
            <AdminNavLinks onNavigate={closeMenu} />
            <hr className="wl-admin__divider" />
            <p className="wl-admin__section-label">Session</p>
            <p className="wl-admin__user-email wl-admin__user-email--drawer">
              {user?.email}
            </p>
            <button
              type="button"
              className="wl-admin__btn wl-admin__btn--ghost wl-admin__btn--block"
              onClick={() => {
                closeMenu();
                void signOut();
              }}
            >
              Sign Out
            </button>
            <Link
              to="/"
              className="wl-admin__site-link"
              onClick={closeMenu}
            >
              ← Return to site
            </Link>
          </div>
        </div>
      </aside>

      <aside className="wl-admin__sidebar" aria-label="Admin navigation">
        <Link to="/" className="wl-admin__brand wl-admin__brand--sidebar">
          <AdminLogoMark variant="sidebar" />
          <span className="wl-admin__brand-text">
            <span className="wl-admin__brand-main">BLACKWATER LABS</span>
            <span className="wl-admin__brand-sub">Admin Clearance</span>
          </span>
        </Link>

        <div className="wl-admin__sidebar-body">
          <AdminNavLinks />
        </div>

        <div className="wl-admin__sidebar-foot">
          <p className="wl-admin__user-email">{user?.email}</p>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost wl-admin__btn--block"
            onClick={() => void signOut()}
          >
            Sign Out
          </button>
          <Link to="/" className="wl-admin__site-link">
            ← Return to site
          </Link>
        </div>
      </aside>

      <div className="wl-admin__content">
        <main className="wl-admin__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
