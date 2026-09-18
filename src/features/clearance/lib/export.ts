import type { CombinedExportRow } from "./types";

export function dedupeCombinedExportRows(
  rows: CombinedExportRow[],
): CombinedExportRow[] {
  const byWallet = new Map<string, CombinedExportRow>();

  for (const row of rows) {
    const key = row.wallet_address_normalised.toLowerCase();
    const existing = byWallet.get(key);
    if (!existing) {
      byWallet.set(key, { ...row });
      continue;
    }

    byWallet.set(key, {
      ...existing,
      on_whitelist: existing.on_whitelist || row.on_whitelist,
      on_fcfs: existing.on_fcfs || row.on_fcfs,
      wl_mint_allowance: Math.max(existing.wl_mint_allowance, row.wl_mint_allowance),
      fcfs_mint_allowance: Math.max(
        existing.fcfs_mint_allowance,
        row.fcfs_mint_allowance,
      ),
      x_handle: existing.x_handle ?? row.x_handle,
      fcfs_status: existing.fcfs_status ?? row.fcfs_status,
      wl_status: existing.wl_status ?? row.wl_status,
    });
  }

  return [...byWallet.values()].sort((a, b) =>
    a.wallet_address_normalised.localeCompare(b.wallet_address_normalised),
  );
}

export function combinedExportPreview(rows: CombinedExportRow[]) {
  const deduped = dedupeCombinedExportRows(rows);
  const wlOnly = deduped.filter((r) => r.on_whitelist && !r.on_fcfs).length;
  const fcfsOnly = deduped.filter((r) => r.on_fcfs && !r.on_whitelist).length;
  const crossover = deduped.filter((r) => r.on_whitelist && r.on_fcfs).length;

  return {
    uniqueWallets: deduped.length,
    wlOnly,
    fcfsOnly,
    crossover,
    rows: deduped,
  };
}

export function combinedExportToCsv(rows: CombinedExportRow[]): string {
  const headers = [
    "wallet_address",
    "wallet_address_normalised",
    "on_whitelist",
    "on_fcfs",
    "wl_mint_allowance",
    "fcfs_mint_allowance",
    "mint_price_eth",
    "x_handle",
    "fcfs_status",
    "wl_status",
  ];

  const escape = (value: unknown) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escape(row[header as keyof CombinedExportRow])).join(","),
    ),
  ];

  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
