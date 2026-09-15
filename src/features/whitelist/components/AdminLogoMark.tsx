import { HOME_ASSETS } from "../../../lib/homeAssets";

type AdminLogoMarkProps = {
  variant?: "inline" | "sidebar" | "login" | "drawer";
};

export default function AdminLogoMark({ variant = "inline" }: AdminLogoMarkProps) {
  const wrapClass = [
    "wl-admin__logo-wrap",
    variant === "sidebar" ? "wl-admin__logo-wrap--sidebar" : "",
    variant === "login" ? "wl-admin__logo-wrap--login" : "",
    variant === "drawer" ? "wl-admin__logo-wrap--drawer" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const size = variant === "login" ? 40 : variant === "sidebar" ? 38 : 32;

  return (
    <span className={wrapClass} aria-hidden="true">
      <img
        className="wl-admin__logo"
        src={HOME_ASSETS.headerLogo}
        alt=""
        width={size}
        height={size}
        decoding="async"
      />
    </span>
  );
}
