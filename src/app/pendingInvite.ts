// Keeps an invite link's code for this browser tab while the person signs in.
// Browser storage can be missing or blocked; then the code box on the picker still works.
import { inviteCodeFromPath } from '../core/invites.ts';

const KEY = 'grimoire.pendingInvite';

/** If the page was opened from /join/CODE, remember the code and tidy the address back to "/". */
export function rememberInviteFromAddress(): void {
  const code = inviteCodeFromPath(window.location.pathname);
  if (!code) return;
  try {
    sessionStorage.setItem(KEY, code);
  } catch {
    // Not saved; the person can still type the code.
  }
  window.history.replaceState(null, '', '/');
}

export function pendingInvite(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
