/** Official Blackwater X (Twitter) profile. */
export const BLACKWATER_X_URL = "https://x.com/blackwater_z26";

/** Pinned X post for FCFS share/repost step. Override via VITE_BLACKWATER_PINNED_POST_URL. */
export const BLACKWATER_PINNED_POST_URL =
  import.meta.env.VITE_BLACKWATER_PINNED_POST_URL ?? BLACKWATER_X_URL;
