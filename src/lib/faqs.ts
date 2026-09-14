import { BLACKWATER_X_URL } from "./blackwaterLinks";
import { HOME_PROJECT } from "./homeProjectInfo";
import { CONTACT_EMAIL } from "./navigation";
import { SOCIAL_LINKS } from "./socialLinks";

export type FaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

const discordUrl =
  SOCIAL_LINKS.find((link) => link.id === "discord")?.url ??
  "https://discord.gg/rEwC9hVHXW";

/** FAQ records — update here as official project info changes. */
export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is-blackwater",
    category: "GENERAL",
    question: "What is Blackwater Labs / Infection Z-26?",
    answer: `${HOME_PROJECT.name} is the Blackwater Labs NFT project — ${HOME_PROJECT.supply} subjects, one infection, and a story shaped by the community inside it. ${HOME_PROJECT.tagline}. Follow official channels for the latest transmissions and mint updates.`,
  },
  {
    id: "mint-date",
    category: "MINT",
    question: "When is the mint?",
    answer: `The current mint date listed on the site is ${HOME_PROJECT.mintDate}. Always check the homepage and official Blackwater X (${BLACKWATER_X_URL}) for the latest confirmed timing.`,
  },
  {
    id: "mint-details",
    category: "MINT",
    question: "What are the mint price, supply, and chain?",
    answer: `Mint price: ${HOME_PROJECT.mintPrice}. Supply: ${HOME_PROJECT.supply}. Chain: ${HOME_PROJECT.chain}. These details are shown on the homepage and may be updated if official announcements change.`,
  },
  {
    id: "fcfs-apply",
    category: "FCFS",
    question: "How do I apply for FCFS clearance?",
    answer:
      "Visit the FCFS page (/fcfs) and complete the clearance sequence: follow Blackwater on X, share or repost the official post, enter your public X handle, submit your Ethereum wallet address, then apply. Each wallet can only register once.",
  },
  {
    id: "fcfs-guarantee",
    category: "FCFS",
    question: "Does FCFS approval guarantee a mint spot?",
    answer:
      "No. FCFS approval provides mint eligibility only. Supply remains first come, first served at mint. After you apply, your submission is reviewed — approval is not automatic.",
  },
  {
    id: "whitelist",
    category: "WHITELIST",
    question: "How do I check if I am whitelisted?",
    answer:
      "Use the Whitelist Checker on the site (/whitelist). Enter your Ethereum wallet address to see whether it appears on the published whitelist.",
  },
  {
    id: "infect-me",
    category: "TOOLS",
    question: "What is Infect Me?",
    answer:
      "Infect Me (/infection) is the Blackwater Infection Station — upload your NFT PFP to generate an infected version and share the outbreak. It is a separate experience from FCFS or whitelist checking.",
  },
  {
    id: "social",
    category: "COMMUNITY",
    question: "Where can I follow Blackwater for updates?",
    answer: `Official channels: X (${BLACKWATER_X_URL}) and Discord (${discordUrl}). These are linked in the site navigation under Social.`,
  },
  {
    id: "contact",
    category: "COMMUNITY",
    question: "How do I contact the team?",
    answer: `For enquiries, email ${CONTACT_EMAIL}. You can also reach the team through official X and Discord.`,
  },
  {
    id: "roadmap-logs",
    category: "GENERAL",
    question: "Where are the roadmap and facility logs?",
    answer:
      "Roadmap and Recovered Logs sections are coming soon on the site. Official project updates will continue on X and Discord in the meantime.",
  },
];
