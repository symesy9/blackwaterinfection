const X_HANDLE_RE = /^[a-z0-9_]{1,15}$/;

export function trimXHandle(handle: string): string {
  return handle.trim();
}

export function normaliseXHandle(handle: string): string {
  return trimXHandle(handle).replace(/^@+/, "").toLowerCase();
}

export function formatXHandleDisplay(handle: string): string {
  const normalised = normaliseXHandle(handle);
  if (!normalised) return "";
  return `@${normalised}`;
}

/** Public X profile URL for a handle, or null if not linkable. */
export function xProfileUrl(handle: string): string | null {
  const normalised = normaliseXHandle(handle);
  if (!normalised || !X_HANDLE_RE.test(normalised)) return null;
  return `https://x.com/${normalised}`;
}

export function validateXHandleInput(handle: string): {
  valid: boolean;
  normalised: string | null;
  display: string | null;
  error: string | null;
} {
  const trimmed = trimXHandle(handle);

  if (!trimmed) {
    return {
      valid: false,
      normalised: null,
      display: null,
      error: "Enter your X handle.",
    };
  }

  const normalised = normaliseXHandle(trimmed);

  if (!X_HANDLE_RE.test(normalised)) {
    return {
      valid: false,
      normalised: null,
      display: null,
      error: "Enter a valid X handle (letters, numbers, underscore; max 15 characters).",
    };
  }

  return {
    valid: true,
    normalised,
    display: `@${normalised}`,
    error: null,
  };
}
