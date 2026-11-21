// The campaign's load method as the setting rules make it (docs/04 Campaign settings `encumbrance.mode`; ruled
// 2026-10-24: the optional-rules row "Encumbrance" decides it). The same reading at set-up (the Encumbrance row's
// default) and when the GM changes an optional rule later (A3, bq3-13: the load method follows, every load read again).
//   modesOfferedBy: the modes the packs give data for ("Not tracked" always).
//   loadMethodOf: the mode the packs' rules sets set for these choices, when offered; else "Not tracked".
import type { EncumbranceMode } from '../core/campaignSettings.ts';
import { combineEncumbrance, modesOffered } from '../modules/inventory/encumbrance.ts';
import { campaignPresets, resolveRules, type Choices } from '../modules/library/options.ts';
import type { PackEntry } from '../modules/library/packFile.ts';

/** One pack's entries and its choices, lowest in the stack first (the later sits on top). */
export interface PackChoices {
  entries: readonly PackEntry[];
  choices: Choices;
}

/** The load methods the packs give data for, under these choices ("none" always). */
export function modesOfferedBy(packs: readonly PackChoices[]): EncumbranceMode[] {
  return modesOffered(combineEncumbrance(packs.flatMap((p) => p.entries.filter((e) => e.kind === 'rulesSet').map((e) => resolveRules(e.data, p.choices).encumbrance))));
}

/** The load method the packs set under these choices, when they give its data; else "none". */
export function loadMethodOf(packs: readonly PackChoices[]): EncumbranceMode {
  const mode = campaignPresets(packs.map((p) => ({ entries: [...p.entries], choices: p.choices }))).encumbranceMode;
  return mode && modesOfferedBy(packs).includes(mode) ? mode : 'none';
}

/** One pack's entries, its choices and the optional rules it shows (an option another pack extends with its choices, of-1). */
export interface PackRules extends PackChoices {
  rules: readonly { id: string; choices: readonly { id: string }[] }[];
}

/**
 * The options whose choice moves the load method (ruled 2026-10-24: Encumbrance is one optional-rules row; gate check
 * 4): an option with a choice that gives another method than the current choices do. While any does, that option is
 * the campaign's one switch for how load is carried (as in Rules for this campaign, A3), and set-up shows no
 * Encumbrance row of the app's own beside it. Read from what the rules sets say, never by option id; an overlay's
 * choice joined to a base option (`extends`) is tried on the base's pack, where its choice is kept.
 */
export function loadSwitchesOf(packs: readonly PackRules[]): string[] {
  const now = loadMethodOf(packs);
  const switches: string[] = [];
  packs.forEach((pack, at) => {
    for (const rule of pack.rules) {
      const moves = rule.choices.some((choice) => {
        if (pack.choices[rule.id] === choice.id) return false;
        const tried = packs.map((p, i) => (i === at ? { entries: p.entries, choices: { ...p.choices, [rule.id]: choice.id } } : p));
        return loadMethodOf(tried) !== now;
      });
      if (moves && !switches.includes(rule.id)) switches.push(rule.id);
    }
  });
  return switches;
}
