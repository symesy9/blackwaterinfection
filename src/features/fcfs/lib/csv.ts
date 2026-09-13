import type { FcfsApplication } from "./types";

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function fcfsApplicationsToCsv(applications: FcfsApplication[]): string {
  const headers = [
    "wallet_address",
    "wallet_address_normalised",
    "x_handle",
    "x_handle_normalised",
    "status",
    "submitted_at",
    "follow_opened_at",
    "follow_confirmed_at",
    "share_opened_at",
    "share_confirmed_at",
    "internal_notes",
    "reviewed_at",
  ];

  const rows = applications.map((app) =>
    [
      app.wallet_address,
      app.wallet_address_normalised,
      app.x_handle,
      app.x_handle_normalised,
      app.status,
      app.submitted_at,
      app.follow_opened_at ?? "",
      app.follow_confirmed_at ?? "",
      app.share_opened_at ?? "",
      app.share_confirmed_at ?? "",
      app.internal_notes ?? "",
      app.reviewed_at ?? "",
    ]
      .map((value) => escapeCsvField(String(value)))
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

export function approvedWalletsToCsv(applications: FcfsApplication[]): string {
  const approved = applications.filter((app) => app.status === "approved");
  const headers = ["wallet_address_normalised"];
  const rows = approved.map((app) =>
    escapeCsvField(app.wallet_address_normalised),
  );

  return [headers.join(","), ...rows].join("\n");
}

export function fcfsExportFilename(kind: "all" | "approved"): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return kind === "approved"
    ? `blackwater-fcfs-approved-wallets-${stamp}.csv`
    : `blackwater-fcfs-applications-${stamp}.csv`;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
