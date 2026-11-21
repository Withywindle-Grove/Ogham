// The GM's "Which table?" list (M5b step g3; docs/05 "Encounter tables, full screen", M5 gate B2, ruled 2026-11-01;
// "Which table a hit rolls", D12). One flat list, no headings: the tables pinned for this session, then the hit's
// candidates in D12's order with the likely one first, then the rest of the scene's encounter tables. Each table
// shows once; one the setting rules don't have is left out of the list and named apart, never guessed. Pure.
import { checkPrompt, type TableCandidate } from './checks.ts';
import type { ExplorationRules } from './modes.ts';
import type { PlaceCheck } from './placeRules.ts';

export interface TableListRow {
  tableId: string;
  pinned: boolean;
  /** The suggestion: the first of the hit's candidates. */
  likely: boolean;
  /** Why it's here ("this place", "this terrain", a season's name…); null for a pin or one of the rest. */
  why: string | null;
}

/** Why a candidate is offered, in words (05: "likely · this place", "this terrain"). */
export function whyWords(candidate: TableCandidate, seasonName: (id: string) => string = (id) => id): string {
  switch (candidate.why) {
    case 'place':
      return 'this place';
    case 'terrain':
      return 'this terrain';
    case 'region':
      return 'this region';
    case 'season':
      return candidate.season ? seasonName(candidate.season) : 'this season';
    case 'check':
      return 'this check';
  }
}

/**
 * The list: pins (oldest first), then the candidates (the first is likely), then the rest, each table once. A pin
 * that is also a candidate keeps its pin's place and says both. `known` says whether the setting rules have a table;
 * `missing` lists the candidates and pins they don't. The place's own tables lead the candidates wherever they were
 * gathered (D12 puts the place first; the tables-row fault, 2026-11-18), so the likely one is the place's, not a
 * mode's, at a place that has its own.
 */
export function whichTables({
  pins,
  candidates,
  rest = [],
  known,
  seasonName,
}: {
  pins: readonly string[];
  candidates: readonly TableCandidate[];
  rest?: readonly string[];
  known: (id: string) => boolean;
  seasonName?: (id: string) => string;
}): { rows: TableListRow[]; missing: string[] } {
  const rows: TableListRow[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  const ordered = [...candidates.filter((c) => c.why === 'place'), ...candidates.filter((c) => c.why !== 'place')];
  const likelyId = ordered.find((c) => known(c.tableId))?.tableId ?? null;
  const candidateOf = (id: string) => ordered.find((c) => c.tableId === id) ?? null;
  const add = (id: string, pinned: boolean) => {
    if (seen.has(id)) return;
    seen.add(id);
    if (!known(id)) {
      if (pinned || candidateOf(id)) missing.push(id);
      return;
    }
    const candidate = candidateOf(id);
    rows.push({ tableId: id, pinned, likely: id === likelyId, why: candidate ? whyWords(candidate, seasonName) : null });
  };
  for (const id of pins) add(id, true);
  for (const c of ordered) add(c.tableId, false);
  for (const id of rest) add(id, false);
  return { rows, missing };
}

/**
 * The scene's candidates, for Explore's row and the rest of a hit's list (B2): the mode's encounter checks' candidates
 * as gathered (`mode`), then the tables of the GM's own encounter checks (`own`), each table once. Then, where a
 * place's own check stands in for the mode's (pf-12b: `place.inForce`; the nearest place in the chain that has one,
 * so a parent Area's or Region's counts) and names tables, those tables as this place's: one the list already holds
 * becomes the place's, one row. `whichTables` leads with the place's, so the row names it and not the mode's (the
 * tables-row fault, 2026-11-18). A check not in force, or none, leaves the list as it was. Pure.
 */
export function sceneCandidatesOf({
  mode,
  own,
  place,
  rules,
}: {
  mode: readonly TableCandidate[];
  own: readonly string[];
  place: Pick<PlaceCheck, 'check' | 'inForce'> | null;
  rules: ExplorationRules | null;
}): TableCandidate[] {
  const found: TableCandidate[] = [];
  for (const c of mode) if (!found.some((f) => f.tableId === c.tableId)) found.push(c);
  for (const tableId of own) if (!found.some((f) => f.tableId === tableId)) found.push({ tableId, why: 'check', season: null });
  if (place?.inForce) {
    for (const c of checkPrompt(place.check, 'encounter', rules, {}).hit.candidates) {
      const at = found.findIndex((f) => f.tableId === c.tableId);
      if (at >= 0) found[at] = { ...found[at]!, why: 'place' };
      else found.push({ ...c, why: 'place' });
    }
  }
  return found;
}

/** A row's tag after the name: "pinned · likely · this place · d6" (the parts it has). */
export function tableTag(row: TableListRow, die: string | null): string {
  return [row.pinned ? 'pinned' : null, row.likely ? 'likely' : null, row.why, die].filter(Boolean).join(', ');
}

/** Explore's row: "Abbey likely · 1 pinned"; "" when there's neither. */
export function tablesRowWords(likelyName: string | null, pins: number): string {
  return [likelyName ? `${likelyName} likely` : null, pins > 0 ? `${pins} pinned` : null].filter(Boolean).join(', ');
}
