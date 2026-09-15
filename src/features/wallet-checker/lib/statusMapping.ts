import type { WalletStatus } from "../../whitelist/lib/types";
import {
  FCFS_ALLOCATION,
  MINT_PRICE,
  WL_ALLOCATION,
} from "./mintRules";
import type {
  CategoryClearanceDisplay,
  ClearanceCategoryRaw,
  ClearanceDisplay,
  ClearanceLookupRaw,
  FcfsDbStatus,
  PublicClearanceStatus,
} from "./types";

const WL_NOT_FOUND =
  "THIS WALLET IS NOT CURRENTLY RECORDED ON THE WHITELIST.";
const WL_PENDING =
  "YOUR WHITELIST STATUS HAS NOT YET BEEN APPROVED.";
const WL_APPROVED = "WALLET CLEARED FOR WHITELIST MINT";
const FCFS_PENDING = "APPLICATION RECEIVED — AWAITING APPROVAL.";
const FCFS_APPROVED =
  "FCFS REMAINS SUBJECT TO AVAILABLE SUPPLY.";

export function mapWhitelistStatus(
  raw: ClearanceCategoryRaw | undefined,
): CategoryClearanceDisplay {
  if (!raw?.found || !raw.status) {
    return {
      category: "WHITELIST",
      publicStatus: "NOT FOUND",
      approved: false,
      allocation: null,
      price: null,
      supportingLine: WL_NOT_FOUND,
      showFcfsApplyLink: false,
      canSelfConfirmWhitelist: false,
    };
  }

  const status = raw.status as WalletStatus;

  if (status === "confirmed") {
    return {
      category: "WHITELIST",
      publicStatus: "APPROVED",
      approved: true,
      allocation: WL_ALLOCATION,
      price: MINT_PRICE,
      supportingLine: WL_APPROVED,
      showFcfsApplyLink: false,
      canSelfConfirmWhitelist: false,
    };
  }

  if (status === "unconfirmed" || status === "needs_review") {
    return {
      category: "WHITELIST",
      publicStatus: "PENDING",
      approved: false,
      allocation: null,
      price: null,
      supportingLine: WL_PENDING,
      showFcfsApplyLink: false,
      canSelfConfirmWhitelist: status === "unconfirmed",
    };
  }

  return {
    category: "WHITELIST",
    publicStatus: "NOT APPROVED",
    approved: false,
    allocation: null,
    price: null,
    supportingLine: WL_NOT_FOUND,
    showFcfsApplyLink: false,
    canSelfConfirmWhitelist: false,
  };
}

export function mapFcfsStatus(
  raw: ClearanceCategoryRaw | undefined,
): CategoryClearanceDisplay {
  if (!raw?.found || !raw.status) {
    return {
      category: "FCFS",
      publicStatus: "NOT FOUND",
      approved: false,
      allocation: null,
      price: null,
      supportingLine: "",
      showFcfsApplyLink: true,
      canSelfConfirmWhitelist: false,
    };
  }

  const status = raw.status as FcfsDbStatus;

  if (status === "approved") {
    return {
      category: "FCFS",
      publicStatus: "APPROVED",
      approved: true,
      allocation: FCFS_ALLOCATION,
      price: `${MINT_PRICE} EACH`,
      supportingLine: FCFS_APPROVED,
      showFcfsApplyLink: false,
      canSelfConfirmWhitelist: false,
    };
  }

  if (status === "pending") {
    return {
      category: "FCFS",
      publicStatus: "PENDING",
      approved: false,
      allocation: null,
      price: null,
      supportingLine: FCFS_PENDING,
      showFcfsApplyLink: false,
      canSelfConfirmWhitelist: false,
    };
  }

  return {
    category: "FCFS",
    publicStatus: "NOT APPROVED",
    approved: false,
    allocation: null,
    price: null,
    supportingLine: "",
    showFcfsApplyLink: false,
    canSelfConfirmWhitelist: false,
  };
}

export function getClearanceHeadline(
  whitelist: CategoryClearanceDisplay,
  fcfs: CategoryClearanceDisplay,
): string | null {
  if (whitelist.approved && fcfs.approved) {
    return "CLEARANCE FOUND";
  }

  if (!whitelist.approved && !fcfs.approved) {
    const wlMissing =
      whitelist.publicStatus === "NOT FOUND" ||
      whitelist.publicStatus === "NOT APPROVED";
    const fcfsMissing =
      fcfs.publicStatus === "NOT FOUND" ||
      fcfs.publicStatus === "NOT APPROVED";

    if (
      wlMissing &&
      fcfsMissing &&
      whitelist.publicStatus === "NOT FOUND" &&
      fcfs.publicStatus === "NOT FOUND"
    ) {
      return "NO CLEARANCE FOUND";
    }
  }

  if (whitelist.approved || fcfs.approved) {
    return "CLEARANCE FOUND";
  }

  return null;
}

export function buildClearanceDisplay(
  raw: ClearanceLookupRaw,
  walletDisplay?: string,
): ClearanceDisplay {
  const whitelist = mapWhitelistStatus(raw.whitelist);
  const fcfs = mapFcfsStatus(raw.fcfs);

  return {
    walletAddress: walletDisplay ?? raw.wallet_address ?? null,
    headline: getClearanceHeadline(whitelist, fcfs),
    mintPrice: MINT_PRICE,
    whitelist,
    fcfs,
  };
}

/** Ensures public API payloads never expose admin/internal fields. */
export function assertPublicSafeClearancePayload(raw: ClearanceLookupRaw): void {
  const json = JSON.stringify(raw);
  const forbidden = [
    "internal_notes",
    "reviewed_by",
    "reviewed_at",
    "import_batch",
    "admin_user",
    "audit",
    "x_handle",
    "follow_opened",
    "share_opened",
  ];

  for (const key of forbidden) {
    if (json.includes(key)) {
      throw new Error(`Public clearance payload leaked forbidden field: ${key}`);
    }
  }
}

export function publicStatusClass(
  status: PublicClearanceStatus,
): "approved" | "pending" | "not-approved" | "not-found" {
  switch (status) {
    case "APPROVED":
      return "approved";
    case "PENDING":
      return "pending";
    case "NOT APPROVED":
      return "not-approved";
    default:
      return "not-found";
  }
}
