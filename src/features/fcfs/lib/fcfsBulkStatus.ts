import type { FcfsApplicationStatus } from "./types";
import type { FcfsBulkOperation } from "../../clearance/lib/types";

/** Maps admin bulk UI verbs to fcfs_application_status enum values. */
export function fcfsBulkOperationToStatus(
  operation: FcfsBulkOperation,
): FcfsApplicationStatus | null {
  switch (operation) {
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    case "pending":
      return "pending";
    default:
      return null;
  }
}
