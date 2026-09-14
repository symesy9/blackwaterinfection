/** Primary site navigation — desktop sidebar + mobile drawer. */
export const PRIMARY_NAV = [
  { to: "/", label: "Featured", end: true },
  { to: "/roadmap", label: "Roadmap" },
  { to: "/logs", label: "Logs" },
  { to: "/team", label: "Team" },
  { to: "/faqs", label: "FAQs" },
  { to: "/infection", label: "Infect Me" },
  { to: "/whitelist", label: "Whitelist" },
] as const;

export const CONTACT_EMAIL = "info@blackwater-labs.com";
