// Encounter waiting, the pure parts (M5b step 2; docs/05 "Encounter waiting", D11). Invented checks and tables.
//   An encounter check's hit queues a card; a lost check's never does; one of the GM's own checks only when it's
//   marked Encounter check.
//   The card reads "Encounter waiting · <check> · <row>", or "no row yet" before the table pick.
//   Start finds the hit's row again on its table by its range (for its note, count and stat block); none when the
//   table or the row is gone.
import { describe, expect, it } from 'vitest';
import { cardWords, hitQueuesEncounter, rowOfHit, type EncounterCard } from './encounterPlay.ts';
import type { CheckResult } from './reminderPlay.ts';
import { readTable, type ReadTable } from './tables.ts';

const hit = (extra: Partial<CheckResult> = {}): CheckResult => ({
  id: 'hit-1',
  campaignId: 'c',
  expeditionId: 'x',
  checkKey: 'check:mode:wander',
  name: 'Wandering things',
  source: 'mode',
  outcome: 'hit',
  atSeconds: 600,
  modifiers: [],
  note: null,
  tableId: 'shallows',
  roll: '1–3',
  rowText: 'Shallow things: Bog lurkers, 1d4',
  revealed: false,
  secret: true,
  version: 1,
  ...extra,
});
const card = (h: CheckResult): EncounterCard => ({ encounter: { id: 'w', campaignId: 'c', expeditionId: 'x', checkResultId: h.id, watch: null, state: 'waiting', createdAt: '', version: 1 }, hit: h });
const shallows = readTable('shallows', 'Shallow things', {
  die: 'd6',
  rows: [
    { min: 1, max: 3, result: 'Bog lurkers', count: '1d4', statBlockId: 'bog-lurker' },
    { min: 4, max: 6, result: 'Reed wraith' },
  ],
})!;
const tables = new Map<string, ReadTable>([['shallows', shallows]]);

describe('which hits queue a card', () => {
  it("an encounter check's hit queues one; a lost check's never does", () => {
    expect(hitQueuesEncounter({ source: 'mode', checkId: 'wander', encounter: true }, [])).toBe(true);
    expect(hitQueuesEncounter({ source: 'mode', checkId: 'lost', encounter: true, lost: true }, [])).toBe(false);
    expect(hitQueuesEncounter({ source: 'mode', checkId: 'gutter', encounter: false }, [])).toBe(false);
  });

  it("one of the GM's own checks queues a card only when it's marked Encounter check", () => {
    const reminders = [
      { id: 'listen', encounterCheck: true },
      { id: 'weather-eye', encounterCheck: false },
    ];
    expect(hitQueuesEncounter({ source: 'gm', checkId: 'listen', encounter: true }, reminders)).toBe(true);
    expect(hitQueuesEncounter({ source: 'gm', checkId: 'weather-eye', encounter: true }, reminders)).toBe(false);
  });
});

describe('the card and Start', () => {
  it('the card names the check and the row, or says no row yet', () => {
    expect(cardWords(card(hit()))).toBe('Encounter waiting, Wandering things, Shallow things: Bog lurkers, 1d4');
    expect(cardWords(card(hit({ tableId: null, roll: null, rowText: null })))).toBe('Encounter waiting, Wandering things, no row yet');
  });

  it("Start finds the hit's row by its range, with its stat block; none when the table or row is gone", () => {
    expect(rowOfHit(hit(), tables)?.row).toMatchObject({ result: 'Bog lurkers', statBlockId: 'bog-lurker', count: '1d4' });
    expect(rowOfHit(hit({ tableId: 'deeps' }), tables)).toBeNull();
    expect(rowOfHit(hit({ roll: '9–12' }), tables)).toBeNull();
    expect(rowOfHit(hit({ roll: null }), tables)).toBeNull();
  });
});
