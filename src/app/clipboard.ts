// Copying and sharing text. Both can be unavailable (older browsers, plain http), so callers get a yes/no.

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The device's share sheet (Messages, Mail…), where there is one. */
export function canShare(): boolean {
  return typeof navigator.share === 'function';
}

export async function shareLink(title: string, url: string): Promise<void> {
  try {
    await navigator.share({ title, url });
  } catch {
    // Closing the share sheet without sharing is fine.
  }
}
