import type { FcfsApplicationStatus } from "./types";

export function fcfsStatusLabel(status: FcfsApplicationStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function verificationStatus(
  openedAt: string | null,
  confirmedAt: string | null,
): string {
  if (openedAt && confirmedAt) return "Confirmed";
  if (openedAt) return "Opened";
  return "—";
}
