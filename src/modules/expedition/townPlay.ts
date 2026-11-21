// The town switches as the campaign keeps them (M5b step 6.0; ruled 2026-11-03, sw-1 … sw-4; townSwitches.ts is the
// pure part). campaigns.out_day and campaigns.active_night (supabase/migrations/20261104110000_m5b_6_0_town_switches.sql):
// every member reads them, only the GM changes them (row-level security, "campaigns: GM edits"). One or the other
// (sm-1, 2026-11-14): turning one on turns the other off in the same line. Each flip is one
// Simple log line with Undo; the morning's reset is its own Simple line (town.reset); Start downtime's reset (today:
// End expedition, which puts the campaign into Downtime) is done by the database in the same change, so its line and
// its Undo carry it.
import { defineCommand, failed, fromWrite, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import { SWITCHES_OFF, type TownSwitches } from './townSwitches.ts';

type Flip = { campaignId: string; on: boolean };
const gmOnly = (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId);

/** The campaign's switches; null when they can't be read. */
export async function loadTownSwitches(db: Db, campaignId: string): Promise<TownSwitches | null> {
  const found = await db.from('campaigns').select('out_day, active_night').eq('id', campaignId).maybeSingle();
  if (found.error) return null;
  if (!found.data) return { ...SWITCHES_OFF };
  return { outDay: found.data.out_day === true, activeNight: found.data.active_night === true };
}

/**
 * The columns a flip writes (sm-1, the sun and moon tile: one or the other, never both). On writes both, its own on
 * and the other off, in one update: one log line, and its Undo gives both back. Off writes only its own. A campaign
 * left with both on from before the rule reads as both until the GM next turns either on.
 */
export function flipWrite(which: 'outDay' | 'activeNight', on: boolean): { out_day?: boolean; active_night?: boolean } {
  if (!on) return which === 'outDay' ? { out_day: false } : { active_night: false };
  return which === 'outDay' ? { out_day: true, active_night: false } : { out_day: false, active_night: true };
}

/** Out and about today (sw-1, sm-1): the GM's, on (Active tonight off) or off. */
export const setOutDay = defineCommand({
  name: 'town.outDay',
  target: (input: Flip) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input) => fromWrite(await db.from('campaigns').update(flipWrite('outDay', input.on)).eq('id', input.campaignId).select('id')),
});

/** Active tonight (sw-1, sm-1): the GM's, on (Out and about today off) or off. */
export const setActiveNight = defineCommand({
  name: 'town.activeNight',
  target: (input: Flip) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input) => fromWrite(await db.from('campaigns').update(flipWrite('activeNight', input.on)).eq('id', input.campaignId).select('id')),
});

/**
 * The morning's reset (sw-3): both switches off when a move of the clock reaches the next morning. Its own Simple line
 * ("Out and about ended · morning"), with Undo. Gives back whether anything was on (false: nothing to reset, no line).
 */
export const resetTownSwitches = defineCommand({
  name: 'town.reset',
  target: (input: { campaignId: string }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<boolean>> => {
    const was = await loadTownSwitches(db, input.campaignId);
    if (!was) return failed("Couldn't read the town switches. Try again.");
    // Always ask the database, so a refusal shows as one; a change that changes nothing isn't logged.
    const done = fromWrite(await db.from('campaigns').update({ out_day: false, active_night: false }).eq('id', input.campaignId).select('id'));
    return done.ok ? ok(was.outDay || was.activeNight) : done;
  },
});

export const TOWN_COMMANDS = [setOutDay, setActiveNight, resetTownSwitches] as const;
