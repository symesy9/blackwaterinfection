export type RoadmapStatus = "ACTIVE" | "UNLOCKED" | "LOCKED" | "CLASSIFIED";

export type RoadmapStage = {
  id: string;
  quarter: string;
  title: string;
  status: RoadmapStatus;
  /** PLACEHOLDER — replace with final roadmap image path when supplied. */
  image: string | null;
  summary: string;
};

/** PLACEHOLDER roadmap stages — replace with final artwork and copy. */
export const ROADMAP_STAGES: RoadmapStage[] = [
  {
    id: "q4-2026",
    quarter: "Q4 2026",
    title: "INFECTION Z-26",
    status: "ACTIVE",
    image: null,
    summary: "ROADMAP CONTENT COMING SOON",
  },
  {
    id: "q1-2027",
    quarter: "Q1 2027",
    title: "STAGE II",
    status: "LOCKED",
    image: null,
    summary: "CLASSIFIED // AWAITING DECLASSIFICATION",
  },
  {
    id: "q2-2027",
    quarter: "Q2 2027",
    title: "STAGE III",
    status: "CLASSIFIED",
    image: null,
    summary: "CLASSIFIED // AWAITING DECLASSIFICATION",
  },
  {
    id: "future",
    quarter: "FUTURE",
    title: "CONTAINMENT PROTOCOL",
    status: "LOCKED",
    image: null,
    summary: "ROADMAP CONTENT COMING SOON",
  },
];
