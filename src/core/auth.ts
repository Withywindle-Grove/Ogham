// Sign-in by email code (docs/05-features.md, Sign-in). No passwords, no links.
// Screens call these; they never call Supabase directly.
import type { Db } from './supabase.ts';
import { BRAND } from '../brand.ts';

export const CODE_LENGTH = 6;
/** Supabase allows one new code per minute per email. */
export const RESEND_SECONDS = 60;

export type AuthResult = { ok: true } | { ok: false; message: string };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

/** Keeps the digits only, so a pasted "123 456" or "123-456" still works. */
export function normalizeCode(code: string): string {
  return code.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

export function isCompleteCode(code: string): boolean {
  return normalizeCode(code).length === CODE_LENGTH;
}

/**
 * A sign-in code carried in the page's address (P1, 2026-11-06): `?code=123456`, with `&email=…` when the link knows
 * it. Null without a whole code. The email is null when the link doesn't say (opened in a fresh browser, the person
 * types it once).
 */
export function codeFromAddress(search: string): { code: string; email: string | null } | null {
  const params = new URLSearchParams(search);
  const code = normalizeCode(params.get('code') ?? '');
  if (!isCompleteCode(code)) return null;
  const email = emailFromAddress(search);
  return { code, email: email || null };
}

/**
 * The `email=` part read as written: URLSearchParams turns "+" into a space, which breaks an address like
 * "wren+table@…" when the email template puts it in the link unencoded. Percent-encoding ("%2B", "%40") still decodes;
 * a malformed one gives no email (the person types it).
 */
function emailFromAddress(search: string): string {
  const part = search
    .replace(/^\?/, '')
    .split('&')
    .find((p) => p.startsWith('email='));
  if (!part) return '';
  try {
    return decodeURIComponent(part.slice('email='.length)).trim();
  } catch {
    return '';
  }
}

/** Turns Supabase's sign-in errors into plain sentences. */
export function friendlyAuthError(error: { code?: string; status?: number; message?: string; name?: string }): string {
  switch (error.code) {
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many codes asked for. Wait a minute, then try again.';
    case 'otp_expired':
      return "That code didn't work. It may be mistyped or more than 15 minutes old. Check it, or send a new one.";
    case 'email_address_invalid':
    case 'validation_failed':
      return "That email address doesn't look right.";
    case 'signup_disabled':
      return "New accounts can't be created right now.";
  }
  if (error.status === 429) return 'Too many tries. Wait a minute, then try again.';
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return `Can't reach ${BRAND.appName}. Check your connection and try again.`;
  }
  return 'Something went wrong. Please try again.';
}

/** Emails a 6-digit code. Creates the account on first use (sign-ups are open in R1). */
export async function sendCode(db: Db, email: string): Promise<AuthResult> {
  if (!isValidEmail(email)) return { ok: false, message: "That email address doesn't look right." };
  const { error } = await db.auth.signInWithOtp({ email: normalizeEmail(email), options: { shouldCreateUser: true } });
  return error ? { ok: false, message: friendlyAuthError(error) } : { ok: true };
}

export async function verifyCode(db: Db, email: string, code: string): Promise<AuthResult> {
  if (!isCompleteCode(code)) return { ok: false, message: `Enter all ${CODE_LENGTH} digits.` };
  const { error } = await db.auth.verifyOtp({ email: normalizeEmail(email), token: normalizeCode(code), type: 'email' });
  return error ? { ok: false, message: friendlyAuthError(error) } : { ok: true };
}

/** Devices where Sign out was tapped and the sign-out event hasn't arrived yet. */
const signOutAsked = new WeakSet<Db>();

/**
 * Ends this device's session only (scope "local"). Supabase's default, "global",
 * would sign the account out on every device (docs/plans/m5-fix-signouts.md).
 */
export async function signOut(db: Db): Promise<void> {
  signOutAsked.add(db);
  const { error } = await db.auth.signOut({ scope: 'local' });
  if (error) signOutAsked.delete(db);
}

/**
 * Calls onChange with the signed-in user's id (or null) now and whenever it changes.
 * The session is kept on the device, so people stay signed in until they sign out.
 * A sign-out this device didn't ask for gets one more look at the stored session first,
 * so a passing hiccup doesn't send someone to the sign-in screen.
 * Returns a function that stops watching.
 */
export function watchSession(db: Db, onChange: (userId: string | null) => void): () => void {
  let stopped = false;
  let latest = 0;
  const { data } = db.auth.onAuthStateChange((event, session) => {
    const turn = ++latest;
    if (event !== 'SIGNED_OUT' || session || signOutAsked.has(db)) {
      if (event === 'SIGNED_OUT') signOutAsked.delete(db);
      onChange(session?.user.id ?? null);
      return;
    }
    // Supabase warns against calling it from inside this callback, so look again just after.
    setTimeout(() => {
      void db.auth
        .getSession()
        .then(({ data: again }) => again.session?.user.id ?? null)
        .catch(() => null)
        .then((userId) => {
          if (!stopped && turn === latest) onChange(userId);
        });
    }, 0);
  });
  return () => {
    stopped = true;
    data.subscription.unsubscribe();
  };
}
