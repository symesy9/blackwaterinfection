const TEAM_BASE = `${import.meta.env.BASE_URL}assets/team`;

export type TeamMember = {
  id: string;
  /** Replace with real display name when supplied. */
  displayName: string;
  /** Replace with final role when supplied. */
  role: string;
  /** Replace with final PFP path when supplied. */
  image: string;
  xHandle: string;
  xUrl: string;
  /** Optional — do not invent bios. */
  bio: string | null;
  clearance: string;
};

/** PLACEHOLDER personnel records — update names, roles, images when assets arrive. */
export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: "asymes9",
    displayName: "asymes9",
    role: "Founder",
    image: `${TEAM_BASE}/asymes9.png`,
    xHandle: "@asymes9",
    xUrl: "https://x.com/asymes9",
    bio: null,
    clearance: "CLASSIFIED",
  },
  {
    id: "stainless",
    displayName: "stainless_web",
    role: "Lead Mod",
    image: `${TEAM_BASE}/stainless.png`,
    xHandle: "@stainless_web",
    xUrl: "https://x.com/stainless_web",
    bio: null,
    clearance: "CLASSIFIED",
  },
  {
    id: "lovenftboy",
    displayName: "i_lovenftboy",
    role: "Mod",
    image: `${TEAM_BASE}/lovenftboy.png`,
    xHandle: "@i_lovenftboy",
    xUrl: "https://x.com/i_lovenftboy",
    bio: null,
    clearance: "CLASSIFIED",
  },
  {
    id: "imthnder",
    displayName: "imthnder",
    role: "Community and Discord Manager",
    image: `${TEAM_BASE}/imthnder.png`,
    xHandle: "@imthnder",
    xUrl: "https://x.com/imthnder",
    bio: null,
    clearance: "CLASSIFIED",
  },
  {
    id: "rendcadarn",
    displayName: "rendcadarn",
    role: "Project Strategist",
    image: `${TEAM_BASE}/rendcadarn.png`,
    xHandle: "@rendcadarn",
    xUrl: "https://x.com/rendcadarn",
    bio: null,
    clearance: "CLASSIFIED",
  },
  {
    id: "becky",
    displayName: "Becky",
    role: "Collab Manager",
    image: `${TEAM_BASE}/becky.png`,
    xHandle: "@Nftgirlzz",
    xUrl: "https://x.com/nftgirlzz",
    bio: null,
    clearance: "CLASSIFIED",
  },
  {
    id: "hermanft",
    displayName: "hermanft_eth",
    role: "Back end Dev",
    image: `${TEAM_BASE}/hermanft.png`,
    xHandle: "@hermanft_eth",
    xUrl: "https://x.com/hermanft_eth",
    bio: null,
    clearance: "CLASSIFIED",
  },
];
