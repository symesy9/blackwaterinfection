import { BLACKWATER_X_URL } from "./blackwaterLinks";

export type SocialLink = {
  id: string;
  label: string;
  url: string;
};

/** Verified official social links. */
export const SOCIAL_LINKS: SocialLink[] = [
  { id: "x", label: "X", url: BLACKWATER_X_URL },
  { id: "discord", label: "Discord", url: "https://discord.gg/rEwC9hVHXW" },
];
