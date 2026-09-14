import { useEffect, useId, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { HOME_ASSETS } from "../../lib/homeAssets";
import { LITTLE_OLLIE_X_URL } from "../../lib/blackwaterLinks";
import { CONTACT_EMAIL, PRIMARY_NAV } from "../../lib/navigation";
import { SOCIAL_LINKS } from "../../lib/socialLinks";

function NavLogoMark({ desktop = false }: { desktop?: boolean }) {
  return (
    <span
      className={`bw-home-nav__logo-wrap${desktop ? " bw-home-nav__logo-wrap--desktop" : ""}`}
      aria-hidden="true"
    >
      <img
        className="bw-home-nav__logo"
        src={HOME_ASSETS.headerLogo}
        alt=""
        width={32}
        height={32}
        decoding="async"
      />
    </span>
  );
}

export default function HomeNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    document.body.classList.toggle("bw-home-menu-open", menuOpen);
    return () => document.body.classList.remove("bw-home-menu-open");
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `bw-home-nav__link${isActive ? " is-active" : ""}`;

  const closeMenu = () => setMenuOpen(false);

  const navSections = (onNavigate?: () => void) => (
    <>
      <ul className="bw-home-nav__list">
        {PRIMARY_NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={"end" in item ? item.end : false}
              className={navLinkClass}
              onClick={onNavigate}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <hr className="bw-home-nav__divider" />

      <p className="bw-home-nav__section-label">Social</p>
      <ul className="bw-home-nav__list bw-home-nav__list--social">
        {SOCIAL_LINKS.map((link) => (
          <li key={link.id}>
            <a
              href={link.url}
              className="bw-home-nav__link bw-home-nav__link--external"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onNavigate}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>

      <hr className="bw-home-nav__divider" />

      <div className="bw-home-nav__contact">
        <p className="bw-home-nav__section-label">Contact</p>
        <a href={`mailto:${CONTACT_EMAIL}`} className="bw-home-nav__contact-link">
          {CONTACT_EMAIL}
        </a>
      </div>
    </>
  );

  return (
    <>
      <header className="bw-home-nav bw-home-nav--mobile">
        <Link to="/" className="bw-home-nav__brand" onClick={closeMenu}>
          <NavLogoMark />
          <span className="bw-home-nav__brand-text">
            <span className="bw-home-nav__brand-main">BLACKWATER</span>
            <span className="bw-home-nav__brand-sub">LABS</span>
          </span>
        </Link>
        <button
          type="button"
          className="bw-home-nav__menu-btn"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="bw-home-nav__menu-icon" aria-hidden="true">
            {menuOpen ? "×" : "☰"}
          </span>
        </button>
      </header>

      <nav
        id={menuId}
        className={`bw-home-nav bw-home-nav--drawer${menuOpen ? " is-open" : ""}`}
        aria-label="Site navigation"
        aria-hidden={!menuOpen}
      >
        <div className="bw-home-nav__drawer-inner">
          <div className="bw-home-nav__drawer-scroll">
            <p className="bw-home-nav__drawer-eyebrow">Blackwater Labs</p>
            {navSections(closeMenu)}
          </div>
          <a
            href={LITTLE_OLLIE_X_URL}
            className="bw-home-nav__credit bw-home-nav__credit--drawer"
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeMenu}
          >
            Powered by Little Ollie Labs
          </a>
        </div>
      </nav>

      <nav className="bw-home-nav bw-home-nav--desktop" aria-label="Site navigation">
        <Link to="/" className="bw-home-nav__brand bw-home-nav__brand--desktop">
          <NavLogoMark desktop />
          <span className="bw-home-nav__brand-main">BLACKWATER</span>
          <span className="bw-home-nav__brand-sub">LABS</span>
        </Link>
        <div className="bw-home-nav__desktop-body">{navSections()}</div>
        <a
          href={LITTLE_OLLIE_X_URL}
          className="bw-home-nav__credit"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by Little Ollie Labs
        </a>
      </nav>
    </>
  );
}
