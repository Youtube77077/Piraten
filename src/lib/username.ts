export const USERNAME_MIN = 2;
export const USERNAME_MAX = 20;

// Letters (any language), numbers, underscores, plus the spaces, dots and dashes
// Fortnite display names may contain.
const ALLOWED = /^[\p{L}\p{N}_ .-]+$/u;

export type UsernameCheck = { ok: true; value: string } | { ok: false; reason: string | null };

export function normalizeUsername(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function checkUsername(raw: string): UsernameCheck {
  const value = normalizeUsername(raw);
  if (!value) return { ok: false, reason: null };
  if (!ALLOWED.test(value)) return { ok: false, reason: 'Use letters, numbers, underscores, dots or dashes.' };
  if (value.length < USERNAME_MIN) return { ok: false, reason: `At least ${USERNAME_MIN} characters.` };
  if (value.length > USERNAME_MAX) return { ok: false, reason: `Keep it under ${USERNAME_MAX + 1} characters.` };
  return { ok: true, value };
}
