// @vitest-environment jsdom
// The Depart sheet's Where? as one view (sf-2; plan dec-scene-feedback, batch C2; page 44, DP3 and DP3b, approved
// 2026-11-26; ⚑ 10, N4). Invented packs and places. What it checks, in plain words:
//   * the Area last played starts open and the others folded; with no last place, the first Area is open;
//   * every count reads "N places" ("1 place"), and a group folds and unfolds by its chevron;
//   * a pack unfolds where it stands, its Areas inside it, and there is no "Back"; a pack of 205 hexes in one Area
//     unfolds to its Areas, never to its 200-odd rows;
//   * a pack's count is its places to pick, not its Region and Areas;
//   * a search for "1" lists 1, 10 and 11 with their Areas and no Other…; a search past 50 finds counts every match;
//     nothing found says so and offers Other…;
//   * reopened, the list opens the Area of the place already ticked;
//   * a tap on a place picks it at once.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { Place } from '../modules/expedition/placePlay.ts';
import type { PackPlace } from '../modules/expedition/placeTree.ts';
import { LocationsPickerBody, type PickedPlace } from './PlacePicker.tsx';

afterEach(cleanup);

const place = (packId: string, packName: string) => (entryId: string, name: string, type: string, parentId: string | null, extra: Partial<PackPlace> = {}): PackPlace => ({
  packId,
  packName,
  packKind: 'adventure',
  entryId,
  name,
  type,
  parentId,
  key: null,
  hex: null,
  settlement: false,
  terrain: null,
  ...extra,
});
const isle = place('pack-isle', 'Saltwick Isle');
const marsh = place('pack-reed', 'The Reed Marches');

/** An adventure of two Areas: the Harbour's seven Locations out of order in the pack, the Beach's one. */
const ISLE: PackPlace[] = [
  isle('island', 'Saltwick Island', 'region', null),
  isle('harbour', 'The Drowned Harbour', 'site', 'island'),
  isle('gate', 'The Sea Gate', 'area', 'harbour', { key: '10' }),
  isle('jetty', 'The Jetty', 'area', 'harbour', { key: '1' }),
  isle('mooring', 'The Old Mooring', 'area', 'harbour'),
  isle('mole', 'The Outer Mole', 'area', 'harbour', { key: '11' }),
  isle('anchorage', 'The Anchorage', 'area', 'harbour', { key: '0' }),
  isle('wreck', 'The Wreck', 'area', 'harbour', { key: '2' }),
  isle('breakwater', 'The Breakwater', 'area', 'harbour', { key: '3' }),
  isle('beach', 'The Shingle Beach', 'site', 'island'),
  isle('wrack', 'The Wrack Line', 'area', 'beach', { key: '1' }),
];

/** A region pack with no Location: three Areas of buildings and hexes, one of 205 hexes. */
const hexKey = (n: number) => `T${String.fromCharCode(65 + Math.floor(n / 26))}${String.fromCharCode(65 + (n % 26))}`;
const MARCHES: PackPlace[] = [
  marsh('marches', 'The Reed Marches', 'region', null),
  marsh('moss', 'Moss Landing', 'site', 'marches'),
  marsh('post', 'The Reeve’s Post', 'building', 'moss', { key: '2' }),
  marsh('ford', 'The Ford', 'building', 'moss'),
  marsh('djetty', 'The Drowned Jetty', 'building', 'moss', { key: '1' }),
  marsh('road', 'The Bog Road', 'site', 'marches'),
  ...[0, 1, 2, 3].map((n) => marsh(`road-${n}`, `Road hex ${n}`, 'area', 'road', { key: `R${n}`, hex: `R${n}` })),
  marsh('thorn', 'Thornwater', 'site', 'marches'),
  ...Array.from({ length: 205 }, (_, n) => marsh(`thorn-${n}`, `Thorn hex ${n}`, 'area', 'thorn', { key: hexKey(n), hex: hexKey(n) })),
];

/** A campaign place the party stood at, made from a pack's place. */
const visited = (from: PackPlace): Place => ({ id: `place-${from.entryId}`, campaignId: 'c1', name: from.name, description: '', notes: null, version: 1, notesVersion: 1, pack: { packId: from.packId, entryId: from.entryId, type: from.type, parentId: from.parentId ?? '', key: from.key ?? '' }, playersName: '', regionId: '', terrainId: '' });
const at = (entryId: string) => ISLE.find((p) => p.entryId === entryId)!;

function show(places: PackPlace[], recent: Place[] = [], ticked: PackPlace | null = null) {
  const picked: PickedPlace[] = [];
  render(<LocationsPickerBody places={places} recent={recent} picked={ticked} onPick={(p) => picked.push(p)} />);
  return picked;
}
const group = (name: string) => within(screen.getByRole('region', { name }));
const rows = (name: string) => group(name).queryAllByRole('button', { pressed: false }).map((b) => b.textContent);

describe("the Depart list's groups (sf-2, ⚑ 10)", () => {
  // Purpose (⚑ 10): the Area last played starts open, the others folded.
  it('opens the Area last played and folds the others', () => {
    show(ISLE, [visited(at('wrack')), visited(at('jetty'))]);
    expect(group('The Shingle Beach').getByRole('button', { name: 'Fold The Shingle Beach' }).getAttribute('aria-expanded')).toBe('true');
    expect(group('The Drowned Harbour').getByRole('button', { name: 'Show The Drowned Harbour' }).getAttribute('aria-expanded')).toBe('false');
    expect(group('The Drowned Harbour').queryByRole('button', { name: '1. The Jetty' })).toBeNull();
  });

  // Purpose (⚑ 10): with no last place, the first Area is open; its places in number order with their numbers.
  it('opens the first Area where no place was played', () => {
    show(ISLE);
    expect(rows('The Drowned Harbour')).toEqual(['The Old Mooring', '0. The Anchorage', '1. The Jetty', '2. The Wreck', '3. The Breakwater', '10. The Sea Gate', '11. The Outer Mole']);
    expect(group('The Shingle Beach').queryByRole('button', { name: '1. The Wrack Line' })).toBeNull();
  });

  // Purpose (finding 11): every count reads "N places", "1 place" for one; the chevron unfolds and folds a group.
  it('counts in places and folds by the chevron', async () => {
    show(ISLE);
    expect(group('The Drowned Harbour').getByText('7 places')).toBeTruthy();
    expect(group('The Shingle Beach').getByText('1 place')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Locations/);
    await userEvent.click(screen.getByRole('button', { name: 'Show The Shingle Beach' }));
    expect(rows('The Shingle Beach')).toEqual(['1. The Wrack Line']);
    await userEvent.click(screen.getByRole('button', { name: 'Fold The Drowned Harbour' }));
    expect(group('The Drowned Harbour').queryByRole('button', { name: '1. The Jetty' })).toBeNull();
  });

  // Purpose (DP3 A): the search and Recently visited stand over the groups; a visited place names its Area.
  it('has the search and Recently visited over the groups', () => {
    show(ISLE, [visited(at('wreck'))]);
    expect(screen.getByRole('textbox', { name: 'Search places by name or map number' })).toBeTruthy();
    const recent = group('Recently visited');
    expect(recent.getByRole('button').textContent).toBe('2. The WreckThe Drowned Harbour');
    const sections = screen.getAllByRole('region').map((s) => s.getAttribute('aria-label'));
    expect(sections.slice(0, 3)).toEqual(['Recently visited', 'The Drowned Harbour', 'The Shingle Beach']);
  });
});

describe("the Depart list's packs (sf-2, N4)", () => {
  // Purpose (F2, finding 5): a pack unfolds where it stands, its Areas inside it with their counts, folded; an Area
  // unfolds to its places in number order with their numbers; there is no second view and no "Back".
  it('unfolds a pack in place, its Areas inside it, with no Back', async () => {
    show([...ISLE, ...MARCHES]);
    const packs = group('From your packs');
    // The adventure's Locations stand as the Areas above; only the pack with other places is listed here.
    expect(packs.getByText('The Reed Marches')).toBeTruthy();
    expect(packs.queryByText('Saltwick Isle')).toBeNull();
    await userEvent.click(packs.getByRole('button', { name: 'Show The Reed Marches' }));
    // Still the one view: the search, the Areas above and Other… stay.
    expect(screen.getByRole('textbox', { name: 'Search places by name or map number' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'The Drowned Harbour' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Back/ })).toBeNull();
    expect(group('Moss Landing').getByText('3 places')).toBeTruthy();
    expect(group('Thornwater').getByText('205 places')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Show Moss Landing' }));
    expect(rows('Moss Landing')).toEqual(['The Ford', '1. The Drowned Jetty', '2. The Reeve’s Post']);
  });

  // Purpose (DP3 A, D; the review of #124): a pack's count is the places in it to pick (3 + 4 + 205), not its Region
  // and Areas, and it unfolds to its Areas, never to its 200-odd rows.
  it('counts a pack of 212 places and unfolds it to its three Areas', async () => {
    show(MARCHES.concat(ISLE));
    expect(group('From your packs').getByText('212 places')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Show The Reed Marches' }));
    expect(screen.queryAllByRole('button', { name: /hex/ })).toHaveLength(0);
    expect(['Moss Landing', 'The Bog Road', 'Thornwater'].map((name) => screen.getByRole('button', { name: `Show ${name}` }))).toHaveLength(3);
  });
});

describe("the Depart list's search (sf-2; DP3 B, E)", () => {
  // Purpose (DP3 B): a search for "1" lists 1, 10 and 11, each with its Area at the right.
  it('lists 1, 10 and 11 with their Areas', async () => {
    show(ISLE);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search places by name or map number' }), '1');
    const found = group('Places found');
    expect(found.getByText('4 places.')).toBeTruthy();
    expect(found.getAllByRole('button', { pressed: false }).map((b) => b.textContent)).toEqual([
      '1. The JettyThe Drowned Harbour',
      '1. The Wrack LineThe Shingle Beach',
      '10. The Sea GateThe Drowned Harbour',
      '11. The Outer MoleThe Drowned Harbour',
    ]);
    // The groups give way to the finds; Other… is only for nothing found (DP3 B, E; the review of #124).
    expect(screen.queryByRole('region', { name: 'The Drowned Harbour' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Other…/ })).toBeNull();
  });

  // Purpose (the review of #124): a search that finds more than the 50 rows it lists counts every place it found.
  it('counts every place found past the 50 it lists', async () => {
    show(MARCHES);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search places by name or map number' }), 'thorn hex');
    const found = group('Places found');
    expect(found.getByText('205 places.')).toBeTruthy();
    expect(found.getAllByRole('button', { pressed: false })).toHaveLength(50);
  });

  // Purpose (DP3 E): nothing found says so in one line and offers Other… with the words typed, which takes them.
  it('says nothing was found and offers Other…', async () => {
    const picked = show(ISLE);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search places by name or map number' }), 'quay');
    expect(screen.getByText('No place matches “quay”.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Other… use “quay” as a new place' }));
    await userEvent.click(screen.getByRole('button', { name: 'Set place' }));
    expect(picked).toEqual([{ kind: 'other', name: 'quay' }]);
  });
});

describe('the list reopened (sf-2; the review of #124)', () => {
  // Purpose: reopened with a place already ticked, the list opens that place's Area, not the Area last played.
  it("opens the ticked place's Area", () => {
    show(ISLE, [visited(at('jetty'))], at('wrack'));
    expect(group('The Shingle Beach').getByRole('button', { name: '1. The Wrack Line', pressed: true })).toBeTruthy();
    expect(group('The Drowned Harbour').getByRole('button', { name: 'Show The Drowned Harbour' })).toBeTruthy();
  });

  // Purpose: a place ticked from a pack's tree opens the pack and its Area, so the tick shows.
  it("opens the pack and the Area of a pack's ticked place", () => {
    const ford = MARCHES.find((p) => p.entryId === 'ford')!;
    show([...ISLE, ...MARCHES], [visited(at('jetty'))], ford);
    expect(group('Moss Landing').getByRole('button', { name: 'The Ford', pressed: true })).toBeTruthy();
    expect(group('The Drowned Harbour').getByRole('button', { name: 'Fold The Drowned Harbour' })).toBeTruthy();
  });
});

describe('a tap on a place (sf-2)', () => {
  // Purpose: a tap on a place picks it at once, from an Area, a pack's tree, a search or Recently visited.
  it('picks it at once', async () => {
    const picked = show([...ISLE, ...MARCHES], [visited(at('wreck'))]);
    await userEvent.click(group('The Drowned Harbour').getByRole('button', { name: '1. The Jetty' }));
    await userEvent.click(group('Recently visited').getByRole('button', { name: /^2\. The Wreck/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Show The Reed Marches' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show Moss Landing' }));
    await userEvent.click(screen.getByRole('button', { name: 'The Ford' }));
    expect(picked.map((p) => (p.kind === 'pack' ? p.place.entryId : p.kind))).toEqual(['jetty', 'wreck', 'ford']);
  });
});
