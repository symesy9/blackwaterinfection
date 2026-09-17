export function normaliseAdminWalletSearch(input: string): string {
  return input.trim().toLowerCase();
}

export function normaliseAdminHandleSearch(input: string): string {
  return input.trim().replace(/^@+/, "").toLowerCase();
}

export function isExactWalletSearch(input: string): boolean {
  return /^0x[a-f0-9]{40}$/i.test(input.trim());
}
