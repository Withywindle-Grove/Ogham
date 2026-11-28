// What is new on a character's Pack (K20b of docs/plans/dec-6-the-whole-pack-tab.md; page 45, approved 2026-11-26), read
// for the Pack tab and shared with K18c, K18d and K19b, which need the same entries; and the scroll hold's anchor row.
// Moved out of PackScreen.tsx (local review of #158, finding 4), unchanged but for the read's two halves (finding 3).
import { useEffect, useState } from 'react';
import { loadCampaignSettings } from '../core/campaignCommands.ts';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import type { CharacterRef } from '../modules/characters/commands.ts';
import { findsSince, loadFindsRead, markFindsSeen, type FindEntry, type FindsRead } from '../modules/characters/findsSeen.ts';
import { readClock } from '../modules/expedition/clock.ts';
import { loadClockNow } from '../modules/expedition/lightPlay.ts';
import { campaignUnits } from '../modules/expedition/play.ts';
import { loadInventory, type InventoryLine } from '../modules/inventory/inventory.ts';
import { secondsAt, whenWords } from '../modules/inventory/stashHistory.ts';
import { useLogVersion } from './campaignLog.tsx';
import { loadCampaignSetting } from './campaignSetting.ts';

/** "Got it" did not reach the server (p45-17, p45-24): what failed, and no more. */
export const FINDS_NOT_MARKED = 'Couldn’t mark these as seen.';

/** What is new on a character's Pack (K20b; K20a's `findsSince`), for its own player. */
export interface PackFinds {
  character: CharacterRef;
  /** K20a's entries, newest first; empty once "Got it" is written. */
  entries: FindEntry[];
  /** An arrival's time in the stash's words ("today", "day 3"; with no campaign clock, the date). */
  when: (at: string) => string;
}

/** What `packFindsOf` needs from the server: K20a's read, the campaign's clock and its settings. */
export interface PackFindsRead {
  read: FindsRead;
  clock: number | null;
  settings: Awaited<ReturnType<typeof loadCampaignSettings>>;
}

/**
 * The server half (finding 3: a host starts it beside its own reads): K20a's read of the log (`loadFindsRead`), for the
 * character's own player only (the GM, his own character and his view as the player too: ⚑ F5's lean); null for anyone
 * else, before the log is read, or when it can't be read.
 */
export async function readPackFinds(db: Db, user: CurrentUser, campaignId: string, characterId: string): Promise<PackFindsRead | null> {
  const [read, clock, settings] = await Promise.all([
    loadFindsRead(db, campaignId, characterId, (character) => markFindsSeen.allowed(user, character)),
    loadClockNow(db, campaignId),
    loadCampaignSettings(db, campaignId),
  ]);
  return read ? { read, clock, settings } : null;
}

/** The device's half: K20a's entries against the lines the host has just read, and the day each arrival came. */
export function packFindsOf({ read, clock, settings }: PackFindsRead, lines: readonly InventoryLine[], rulesSets: readonly Record<string, unknown>[]): PackFinds {
  const entries = findsSince({
    character: { id: read.character.id, ownerUserId: read.character.ownerUserId, purseId: read.purseId },
    gmUserIds: read.gmUserIds,
    events: read.events,
    lines,
    seenAt: read.seenAt,
  });
  // The day an arrival came, as the stash's history says it (K14): by the campaign's clock where it has one.
  const seqAt = new Map(read.events.map((e) => [e.createdAt, e.seq] as const));
  const units = campaignUnits(settings, rulesSets);
  const when = (at: string) => {
    const today = new Date(at).toDateString() === new Date().toDateString();
    const seq = seqAt.get(at);
    const seconds = clock === null || seq === undefined ? null : secondsAt({ seq }, read.clocks, clock);
    if (clock === null || seconds === null) return whenWords({ day: null, date: at, today });
    const day = readClock(seconds, units).day;
    return whenWords({ day, date: at, today: day === readClock(clock, units).day });
  };
  return { character: read.character, entries, when };
}

/** Both halves at once, for a host that has its lines already (K18c, K18d, K19b). */
export async function loadPackFinds(
  db: Db,
  user: CurrentUser,
  campaignId: string,
  characterId: string,
  lines: readonly InventoryLine[],
  rulesSets: readonly Record<string, unknown>[],
): Promise<PackFinds | null> {
  const read = await readPackFinds(db, user, campaignId, characterId);
  return read && packFindsOf(read, lines, rulesSets);
}

/**
 * The Player screen's one read of what is new for its character (K19b; K18c draws its card from the same read): K20a's
 * entries, read beside the inventory and the rules, and again at each log version, so a find sent while the screen is
 * open and "Got it" on any tab both reach it. `characterId` null reads nothing (the GM's view as the player, #158 ⚑ 4);
 * for anyone but the character's own player `readPackFinds` reads nothing past the character. Null until read, for
 * anyone else, and on a failed read (no count, never a failed screen).
 */
export function usePackFinds(db: Db, user: CurrentUser, campaignId: string, characterId: string | null): PackFinds | null {
  const logVersion = useLogVersion();
  const [finds, setFinds] = useState<PackFinds | null>(null);
  useEffect(() => {
    let current = true;
    const read = async () => {
      if (!characterId) return null;
      const [found, inventory, setting] = await Promise.all([readPackFinds(db, user, campaignId, characterId), loadInventory(db, campaignId), loadCampaignSetting(db, user.id, campaignId)]);
      return found && inventory && setting ? packFindsOf(found, inventory.lines, setting.rulesSets) : null;
    };
    read().then(
      (next) => current && setFinds(next),
      () => current && setFinds(null),
    );
    return () => {
      current = false;
    };
  }, [db, user, campaignId, characterId, logVersion]);
  return characterId ? finds : null;
}

/**
 * The row the reader's eye is on: the list row or group heading nearest the middle of the screen, and where it is now.
 * A new row is never chosen, since the GM's Undo may take it away.
 */
export function anchorIn(list: HTMLElement | null): { el: Element; top: number; atTop: boolean } | null {
  if (!list || typeof window === 'undefined') return null;
  const eye = window.innerHeight / 2;
  let best: { el: Element; top: number; off: number } | null = null;
  for (const el of list.querySelectorAll('.pack__group-head, .pack__rows > li')) {
    if (el.querySelector('.pack__new')) continue;
    const box = el.getBoundingClientRect();
    if (box.bottom <= 0 || box.top >= window.innerHeight) continue;
    const off = box.top <= eye && box.bottom >= eye ? 0 : Math.min(Math.abs(box.top - eye), Math.abs(box.bottom - eye));
    if (!best || off < best.off) best = { el, top: box.top, off };
  }
  return best && { el: best.el, top: best.top, atTop: window.scrollY <= 0 };
}
