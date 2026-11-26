// @vitest-environment jsdom
// December step 5b (docs/plans/dec-5-encounters.md; pf-2, ruled by the lead 2026-11-11): a table row may list several
// creatures as one encounter (07 `statBlockIds`, G-68), each a plain id (the row's `count` for it) or
// { statBlockId | statBlockRef, count }; the waiting card lists each with its count. Invented packs only.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { TableRows, type TableTap } from '../../app/EncounterTables.tsx';
import { creatureLines, EncounterDetails } from '../../app/EncounterWaiting.tsx';
import type { EncounterCard } from './encounterPlay.ts';
import { withRowLinks, type LinkSources } from './rowLinks.ts';
import { readTable, rowCountShown, type ReadTable } from './tables.ts';

afterEach(cleanup);

const sources: LinkSources = {
  packs: [{ packId: 'pack-tower', refId: 'mire-tower' }, { packId: 'pack-fen', refId: 'fen-rules' }],
  entries: [
    { kind: 'statBlock', packEntryId: 'drowned-acolyte', packId: 'pack-tower' },
    { kind: 'statBlock', packEntryId: 'bog-lurker', packId: 'pack-fen' },
    { kind: 'statBlock', packEntryId: 'eel-mother', packId: 'pack-fen' },
  ],
};
const blocks: Record<string, { name: string; description: string | null }> = {
  'drowned-acolyte': { name: 'Drowned acolyte', description: 'A hunched figure in a reed cloak.' },
  'bog-lurker': { name: 'Bog lurker', description: null },
  'eel-mother': { name: 'Eel mother', description: 'Too big for the sluice.' },
};
const statBlock = (id: string) => blocks[id] ?? null;

const harbour = readTable('harbour-night', 'Harbour by night', {
  die: 'd6',
  rows: [
    // Every creature with its own count: the row's count says nothing more.
    { min: 1, max: 1, result: 'The acolyte and her lurkers', count: '9', statBlockIds: [{ statBlockId: 'drowned-acolyte', count: 1 }, { statBlockRef: 'fen-rules:bog-lurker', count: '1d4' }] },
    // Plain ids: the row's count is the group's (shown once, as How many), not each creature's.
    { min: 2, max: 2, result: 'Lurkers', count: '2d4', statBlockIds: ['bog-lurker', 'fen-rules:eel-mother'] },
    // Some with a count, some without: those without take the row's (as the lead's ruling reads; ⚑ to the lead).
    { min: 3, max: 3, result: 'A mixed crowd', count: '1d3', statBlockIds: [{ statBlockRef: 'fen-rules:eel-mother', count: 1 }, 'bog-lurker', { statBlockRef: 'fen-rules:salt-hag' }] },
    // The row's own stat block, and creatures each with their own count: the row's count is the stat block's.
    { min: 4, max: 4, result: 'The eel mother and her brood', count: '1', statBlockId: 'eel-mother', statBlockIds: [{ statBlockRef: 'fen-rules:bog-lurker', count: '2d4' }] },
    { min: 5, max: 6, result: 'Fog' },
  ],
}) as ReadTable;

describe('several creatures on one row (pf-2)', () => {
  const details = (roll: string, rowText: string) => {
    const tables = withRowLinks(new Map([['harbour-night', harbour]]), sources);
    const card: EncounterCard = {
      encounter: { id: 'w1', campaignId: 'c', expeditionId: 'e', checkResultId: 'h1', watch: null, state: 'waiting', createdAt: '2026-11-11T20:00:00Z', version: 1 },
      hit: { id: 'h1', campaignId: 'c', expeditionId: 'e', checkKey: 'mode:wander', name: 'Harbour at night', source: 'mode', outcome: 'hit', atSeconds: 0, modifiers: [], note: null, tableId: 'harbour-night', roll, rowText, revealed: false, secret: true, version: 1 },
    };
    render(<EncounterDetails card={card} started={false} tables={tables} statBlock={statBlock} when={() => null} onClose={() => undefined} />);
    return within(screen.getByRole('list', { name: 'Stat blocks' })).getAllByRole('listitem').map((li) => li.querySelector('.book-detail__name')?.textContent);
  };

  // Purpose (review of #640): a row of plain ids lists each creature with no count of its own, and the group's count
  // once, as How many; it never reads as that many of each.
  it('lists plain ids without a count each, and the group’s count once', () => {
    expect(details('2', 'Harbour by night: Lurkers, 2d4')).toEqual(['Bog lurker', 'Eel mother']);
    expect(screen.getByText('How many: 2d4')).toBeTruthy();
  });

  // Purpose (review of #640): tapping a row whose creatures each have their own count records the row without the
  // row's count, so the card never shows it beside theirs.
  it('records a row whose creatures each have a count without the row’s count', async () => {
    const taps: TableTap[] = [];
    render(<TableRows table={harbour} trail={['Harbour by night']} column={null} lit={null} describe={() => null} leadsTo={() => null} onTap={(tap) => taps.push(tap)} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /The acolyte and her lurkers/ }));
    expect(taps[0]!.rowText).toBe('Harbour by night: The acolyte and her lurkers');
  });

  // Purpose: each entry reads with its own count, else the row's; a row without statBlockIds lists none.
  it('reads each creature with its own count; plain ids have none unless the row mixes', () => {
    const rows = harbour.rows;
    expect(rows[0]!.creatures!.map((c) => [c.ref, c.count, c.ownCount])).toEqual([['drowned-acolyte', '1', true], ['fen-rules:bog-lurker', '1d4', true]]);
    expect(rows[1]!.creatures!.map((c) => [c.ref, c.count, c.ownCount])).toEqual([['bog-lurker', null, false], ['fen-rules:eel-mother', null, false]]);
    expect(rows[2]!.creatures!.map((c) => [c.ref, c.count])).toEqual([['fen-rules:eel-mother', '1'], ['bog-lurker', '1d3'], ['fen-rules:salt-hag', '1d3']]);
    expect(rows[4]!.creatures).toEqual([]);
  });

  // Purpose: the row's count is shown only when it still counts for someone (not when every creature has its own).
  it('shows the row’s count only while it is the group’s or the row’s own stat block’s', () => {
    expect(harbour.rows.map(rowCountShown)).toEqual([false, true, true, true, false]);
  });

  // Purpose: each creature resolves across the packs like a row's own stat block; one the packs don't have is listed
  // as missing and keeps its place in the list as its link (December 5c, frame 3), never failing.
  it('resolves each creature across packs and lists what is missing', () => {
    const rows = withRowLinks(new Map([['harbour-night', harbour]]), sources).get('harbour-night')!.rows;
    expect(rows[2]!.creatures!.map((c) => c.statBlockId)).toEqual(['eel-mother', 'bog-lurker', null]);
    expect(rows[2]!.missing).toEqual(['fen-rules:salt-hag']);
    expect(creatureLines(rows[2]!, statBlock).map((b) => [b.missing ?? b.name, b.count])).toEqual([['Eel mother', '1'], ['Bog lurker', '1d3'], ['fen-rules:salt-hag', '1d3']]);
  });

  // Purpose: the waiting card's details list every creature of the row as a detail row with its count ("×1", sf-6a; a dice count after a comma, ruled 2026-11-26),
  // and no "How many" line when every creature has its own count.
  it('lists each creature with its count on the waiting card', () => {
    const tables = withRowLinks(new Map([['harbour-night', harbour]]), sources);
    const card: EncounterCard = {
      encounter: { id: 'w1', campaignId: 'c', expeditionId: 'e', checkResultId: 'h1', watch: null, state: 'waiting', createdAt: '2026-11-11T20:00:00Z', version: 1 },
      hit: { id: 'h1', campaignId: 'c', expeditionId: 'e', checkKey: 'mode:wander', name: 'Harbour at night', source: 'mode', outcome: 'hit', atSeconds: 0, modifiers: [], note: null, tableId: 'harbour-night', roll: '1', rowText: 'Harbour by night: The acolyte and her lurkers', revealed: false, secret: true, version: 1 },
    };
    render(<EncounterDetails card={card} started={false} tables={tables} statBlock={statBlock} when={() => null} onClose={() => undefined} />);
    const list = within(screen.getByRole('list', { name: 'Stat blocks' }));
    expect(list.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Drowned acolyte ×1', 'Bog lurker, 1d4']);
    expect(screen.queryByText(/How many/)).toBeNull();
  });
});
