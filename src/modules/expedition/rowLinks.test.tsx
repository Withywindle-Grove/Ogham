// @vitest-environment jsdom
// December step 5a (docs/plans/dec-5-encounters.md): a table row's statBlockRef and tableRef ("<meta.id>:<id>", 07
// References) resolve across the campaign's attached packs; a row that names another table opens it next; a link the
// packs don't have is shown with the row's own words, "Not in your packs", and never fails. Invented packs only.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EncounterDetails } from '../../app/EncounterWaiting.tsx';
import type { EncounterCard } from './encounterPlay.ts';
import { TableRows } from '../../app/EncounterTables.tsx';
import { packRefId } from '../library/packMeta.ts';
import { linkIndex, missingWords, resolveLink, withRowLinks, type LinkSources } from './rowLinks.ts';
import { readTable, rowLeadsTo, tableLookup, type ReadTable } from './tables.ts';

afterEach(cleanup);

// Two attached packs: the adventure (meta.id "mire-tower") and the setting (meta.id "fen-rules").
const sources: LinkSources = {
  packs: [{ packId: 'pack-tower', refId: 'mire-tower' }, { packId: 'pack-fen', refId: 'fen-rules' }],
  entries: [
    { kind: 'table', packEntryId: 'harbour-night', packId: 'pack-tower' },
    { kind: 'table', packEntryId: 'eel-folk', packId: 'pack-fen' },
    { kind: 'statBlock', packEntryId: 'drowned-acolyte', packId: 'pack-tower' },
    { kind: 'statBlock', packEntryId: 'bog-lurker', packId: 'pack-fen', alsoIn: ['pack-tower'] },
  ],
};

const harbour = readTable('harbour-night', 'Harbour by night', {
  die: 'd6',
  rows: [
    { min: 1, max: 1, result: 'Bog lurkers', count: '1d4', statBlockRef: 'fen-rules:bog-lurker' },
    { min: 2, max: 2, result: 'Eel-folk', tableRef: 'fen-rules:eel-folk' },
    { min: 3, max: 3, result: 'A drowned acolyte', statBlockId: 'drowned-acolyte' },
    { min: 4, max: 4, result: 'Salt hag', statBlockRef: 'fen-rules:salt-hag', tableRef: 'brine-rules:hag-moods' },
    { min: 5, max: 6, result: 'Fog' },
  ],
}) as ReadTable;
const eelFolk = readTable('eel-folk', 'Eel-folk', { die: 'd4', rows: [{ min: 1, max: 4, result: 'Eel-folk traders' }] }) as ReadTable;

describe('resolving a row’s links across attached packs', () => {
  // Purpose: "<meta.id>:<id>" finds the entry in that pack (or a pack that also has it); a plain id finds it in any
  // attached pack; a wrong pack, an unknown pack or an unknown id resolves to nothing, without failing.
  it('finds an entry by "<meta.id>:<id>" in that pack, a plain id in any pack, and nothing else', () => {
    const index = linkIndex(sources);
    expect(resolveLink('fen-rules:bog-lurker', 'statBlock', index)).toBe('bog-lurker');
    expect(resolveLink('mire-tower:bog-lurker', 'statBlock', index)).toBe('bog-lurker');
    expect(resolveLink('drowned-acolyte', 'statBlock', index)).toBe('drowned-acolyte');
    expect(resolveLink('fen-rules:drowned-acolyte', 'statBlock', index)).toBeNull();
    expect(resolveLink('brine-rules:salt-hag', 'statBlock', index)).toBeNull();
    expect(resolveLink('fen-rules:salt-hag', 'statBlock', index)).toBeNull();
    expect(resolveLink('fen-rules:bog-lurker', 'table', index)).toBeNull();
    expect(resolveLink('fen-rules:', 'table', index)).toBeNull();
  });

  // Purpose: after resolving, a row's stat block and next table are plain ids; what the packs don't have is listed
  // on the row; a row with no links is left with none.
  it('gives each row its stat block and next table as plain ids, and lists what is missing', () => {
    const rows = withRowLinks(new Map([['harbour-night', harbour]]), sources).get('harbour-night')!.rows;
    expect(rows.map((r) => [r.statBlockId, r.tableLink, r.missing])).toEqual([
      ['bog-lurker', null, []],
      [null, 'eel-folk', []],
      ['drowned-acolyte', null, []],
      [null, null, ['fen-rules:salt-hag', 'brine-rules:hag-moods']],
      [null, null, []],
    ]);
  });

  // Purpose: a row naming another pack's table opens that table next; a row whose table isn't in the packs leads
  // nowhere (the GM reads its own words), never to an error.
  it('opens the table a row names next, across packs; a missing one leads nowhere', () => {
    const tables = withRowLinks(new Map([['harbour-night', harbour], ['eel-folk', eelFolk]]), sources);
    const known = tableLookup(tables.keys());
    const rows = tables.get('harbour-night')!.rows;
    expect(rowLeadsTo(tables.get('harbour-night')!, rows[1]!, null, known)).toBe('eel-folk');
    expect(rowLeadsTo(tables.get('harbour-night')!, rows[3]!, null, known)).toBeNull();
    expect(rowLeadsTo(tables.get('harbour-night')!, rows[4]!, null, known)).toBeNull();
  });

  // Purpose: a same-pack tableId is followed even before resolving (a reader that doesn't resolve links still works).
  it('follows a same-pack tableId without resolving', () => {
    const plain = readTable('t', 'T', { die: 'd2', rows: [{ min: 1, max: 2, result: 'More eels', tableId: 'eel-folk' }] }) as ReadTable;
    expect(rowLeadsTo(plain, plain.rows[0]!, null, tableLookup(['t', 'eel-folk']))).toBe('eel-folk');
  });
});

describe('the id a pack is linked by (07: meta.id, else the slug of its short name)', () => {
  // Purpose: a pack is named by its meta.id; without one, by the slug of its shortName, else of its name; so links into
  // homebrew and older packs resolve.
  it('reads meta.id, else the short name’s slug, else the name’s', () => {
    expect(packRefId({ id: 'fen-rules', shortName: 'Fen' }, 'Fen Rules')).toBe('fen-rules');
    expect(packRefId({ shortName: 'Mire Tower' }, 'The Mire Tower adventure')).toBe('mire-tower');
    expect(packRefId({}, 'Reedmouth Homebrew')).toBe('reedmouth-homebrew');
    expect(packRefId(null, '')).toBeNull();
  });

  // Purpose: several attached packs may share an id (a fallback slug can clash): a link resolves if any of them has
  // the entry, not only the first.
  it('checks every pack that shares the id', () => {
    const shared: LinkSources = {
      packs: [{ packId: 'pack-a', refId: 'fen' }, { packId: 'pack-b', refId: 'fen' }],
      entries: [{ kind: 'statBlock', packEntryId: 'eel-mother', packId: 'pack-b' }],
    };
    expect(resolveLink('fen:eel-mother', 'statBlock', linkIndex(shared))).toBe('eel-mother');
  });
});

describe('the missing-link words (Francis, 2026-11-12, "b")', () => {
  // Purpose: each missing entry reads as its readable name with its pack's id in brackets, a creature and a table alike; a plain id has no brackets.
  it('names each entry readably with its pack, listed with commas', () => {
    expect(missingWords(['mire-zine:bellringer'])).toBe('Not in your packs: Bellringer (mire-zine)');
    expect(missingWords(['fen-rules:salt-hag', 'brine-rules:hag-moods'])).toBe('Not in your packs: Salt hag (fen-rules), Hag moods (brine-rules)');
    expect(missingWords(['old_reed-lurker'])).toBe('Not in your packs: Old reed lurker');
  });
});

describe('a row whose link the packs don’t have, in the table and on the waiting card', () => {
  // Purpose: the table's rows show a missing link under the row's own words.
  it('shows "Not in your packs" under the row in the table', () => {
    const table = withRowLinks(new Map([['harbour-night', harbour]]), sources).get('harbour-night')!;
    render(<TableRows table={table} trail={['Harbour by night']} column={null} lit={null} describe={() => null} leadsTo={() => null} />);
    expect(screen.getByText('Salt hag')).toBeTruthy();
    expect(screen.getByText(missingWords(['fen-rules:salt-hag', 'brine-rules:hag-moods']))).toBeTruthy();
  });

  // Purpose: View on a waiting card whose row names a creature and a table the packs don't have shows the row's own
  // words and "Not in your packs: …", and nothing fails.
  it('shows the row’s own words and "Not in your packs"', () => {
    const tables = withRowLinks(new Map([['harbour-night', harbour]]), sources);
    const card: EncounterCard = {
      encounter: { id: 'w1', campaignId: 'c', expeditionId: 'e', checkResultId: 'h1', watch: null, state: 'waiting', createdAt: '2026-11-11T20:00:00Z', version: 1 },
      hit: { id: 'h1', campaignId: 'c', expeditionId: 'e', checkKey: 'mode:wander', name: 'Harbour at night', source: 'mode', outcome: 'hit', atSeconds: 0, modifiers: [], note: null, tableId: 'harbour-night', roll: '4', rowText: 'Harbour by night: Salt hag', revealed: false, secret: true, version: 1 },
    };
    render(<EncounterDetails card={card} started={false} tables={tables} statBlock={() => null} when={() => null} onClose={() => undefined} />);
    expect(screen.getByText('Harbour by night: Salt hag')).toBeTruthy();
    expect(screen.getByText('Not in your packs: Salt hag (fen-rules), Hag moods (brine-rules)')).toBeTruthy();
  });
});
