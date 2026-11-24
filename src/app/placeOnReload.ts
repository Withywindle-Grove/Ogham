// Back to the same screen after an update (M5b gate walk, overnight item 8). The app has no addresses for its screens:
// which campaign is open and which tab shows live in memory, so the reload into a new version (appUpdates.ts) used to
// land on Your campaigns. Now the screens note where the person is as they go; just before that reload the place is
// kept in this browser tab's session storage, and the next start opens it once: the campaign (or the Rules library)
// and its tab. Only for the person who was signed in, only a campaign they still have the same role in, and only
// within the hour. Sub-screens (a sheet, a pack opened from Players, a pop-up) aren't kept: the tab is.
// Storage can be blocked (private browsing): then the reload lands on Your campaigns, as before.
import type { BaseRole } from '../core/commands.ts';
import type { OpenCampaign } from './Campaigns.tsx';

const STORAGE_KEY = 'grimoire.placeOnReload';
/** A place older than this isn't reopened: the person has long since moved on. */
const KEPT_FOR_MS = 60 * 60 * 1000;

/** The screens a reload can come back to. Creation and New campaign never reload (a form or creation holds it). */
export type KeptView = { kind: 'campaign'; campaign: OpenCampaign } | { kind: 'library' };

interface Kept {
  userId: string;
  view: KeptView;
  tab: string | null;
  at: number;
}

// Where the person is now, as the screens report it.
let here: { userId: string; view: KeptView } | null = null;
let tabHere: { campaignId: string; tab: string } | null = null;
// The tab to reopen, once its campaign's screen opens (moved here from storage at the start).
let tabToReopen: { campaignId: string; tab: string } | null = null;

/** The signed-in screens: which screen shows now (null for one a reload doesn't come back to, or signed out). */
export function notePlace(userId: string, view: KeptView | null): void {
  here = view ? { userId, view } : null;
}

/** A campaign's screen: which of its tabs shows now. */
export function noteTab(campaignId: string, tab: string): void {
  tabHere = { campaignId, tab };
}

/** Just before the reload into a new version: keep where the person is, for the next start in this browser tab. */
export function keepPlaceForReload(now = Date.now()): void {
  try {
    if (!here) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const campaignId = here.view.kind === 'campaign' ? here.view.campaign.id : null;
    const tab = campaignId !== null && tabHere?.campaignId === campaignId ? tabHere.tab : null;
    const kept: Kept = { userId: here.userId, view: here.view, tab, at: now };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  } catch {
    // Not kept: the reload lands on Your campaigns.
  }
}

function readKept(userId: string, roles: Readonly<Record<string, BaseRole>>, now: number): Kept | null {
  let saved: unknown;
  try {
    saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    return null;
  }
  if (!saved || typeof saved !== 'object') return null;
  const kept = saved as Partial<Kept>;
  if (kept.userId !== userId || typeof kept.at !== 'number' || now - kept.at > KEPT_FOR_MS || now < kept.at) return null;
  const view = kept.view as Partial<KeptView> | undefined;
  const tab = typeof kept.tab === 'string' ? kept.tab : null;
  if (view?.kind === 'library') return { userId, view: { kind: 'library' }, tab: null, at: kept.at };
  if (view?.kind !== 'campaign') return null;
  const campaign = (view as { campaign?: Partial<OpenCampaign> }).campaign;
  if (!campaign || typeof campaign.id !== 'string' || typeof campaign.name !== 'string') return null;
  // Only a campaign the person is still in with the same role (they may have left, or been made GM, meanwhile).
  const role = roles[campaign.id];
  if (role === undefined || role !== campaign.role) return null;
  const open: OpenCampaign = {
    id: campaign.id,
    name: campaign.name,
    role,
    line: typeof campaign.line === 'string' ? campaign.line : null,
    retiredAt: typeof campaign.retiredAt === 'string' ? campaign.retiredAt : null,
  };
  return { userId, view: { kind: 'campaign', campaign: open }, tab, at: kept.at };
}

/**
 * At the start, as the first screen is chosen: the screen to reopen for this person, or null. Its tab then waits for
 * the campaign's screen (tabToRestore). Changes nothing kept, so it can run twice (React's strict mode).
 */
export function keptPlace(userId: string, roles: Readonly<Record<string, BaseRole>>, now = Date.now()): KeptView | null {
  const kept = readKept(userId, roles, now);
  if (kept?.view.kind === 'campaign' && kept.tab) tabToReopen = { campaignId: kept.view.campaign.id, tab: kept.tab };
  return kept?.view ?? null;
}

/** Once the first screen after the start is up: the kept place is used up, so a later start opens Your campaigns. */
export function placeRestored(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was kept.
  }
}

/** A campaign's screen as it opens: the tab to reopen, if the reload kept one of these for this campaign. */
export function tabToRestore<T extends string>(campaignId: string, tabs: readonly T[]): T | null {
  if (!tabToReopen || tabToReopen.campaignId !== campaignId) return null;
  return (tabs as readonly string[]).includes(tabToReopen.tab) ? (tabToReopen.tab as T) : null;
}

/** The campaign's screen has opened on the restored tab: it isn't reopened again. */
export function tabRestored(campaignId: string): void {
  if (tabToReopen?.campaignId === campaignId) tabToReopen = null;
}
