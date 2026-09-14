export type LogStatus = "RECOVERED" | "PARTIAL" | "CLASSIFIED" | "LOCKED";

export type LogEntry = {
  slug: string;
  title: string;
  category: string;
  date: string;
  status: LogStatus;
  /** PLACEHOLDER excerpt — replace with real summary when article is supplied. */
  excerpt: string;
  /** PLACEHOLDER — set image path when artwork is supplied. */
  image: string | null;
};

/** PLACEHOLDER facility records — populate with full articles later. */
export const LOG_ENTRIES: LogEntry[] = [
  {
    slug: "lockdown",
    title: "LOCKDOWN",
    category: "FACILITY RECORD",
    date: "TBA",
    status: "RECOVERED",
    excerpt:
      "PLACEHOLDER — Lockdown facility record awaiting declassification. Full article content not yet supplied.",
    image: null,
  },
  {
    slug: "blackpaper",
    title: "BLACKPAPER",
    category: "RESEARCH DOCUMENT",
    date: "TBA",
    status: "PARTIAL",
    excerpt:
      "PLACEHOLDER — Blackpaper archive entry awaiting final content. Summary and full article not yet supplied.",
    image: null,
  },
];
