// A place from a pack's location (M8b slice 0, pull request 1; docs/plans/m8b-0-places-from-packs.md). Invented
// locations only. What it checks, in plain words:
//   * the composer turns a location into pieces in the pack's order (07 "Pieces for Show players"), with the GM's
//     facts beside each piece and never in a body (hidden means hidden);
//   * the GM notes, secrets, unshowable creatures and hazards, quotes, the encounter check and the page go into the
//     notes in that order, split across the headings when long and never cut (⚑ 11);
//   * the region is the rules set's region whose table the location's encounter check names (⚑ 7);
//   * picking the same location twice gives one place (the link), and two locations may share a name (⚑ 10);
//   * nothing is shown to players; Undo marks the place, its notes and its pieces undone, and a later pick makes a new one;
//   * Start expedition and Where now? by place id land on the place meant, and a typed name reuses a lone pack place.
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { undoChange } from '../../core/undo.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { chunksOf, composePackPlace, notesAcrossHeadings, placeFromPack, regionOfPlace, regionalTablesOf, valueWords, type PackPlaceEntry } from './placeFromPack.ts';
import { editPlace, loadGroupPlaces, loadRegionNow, setPlace } from './placePlay.ts';
import { startExpedition } from './play.ts';

const SECRET = 'A loose flagstone under the lectern hides the abbey seal';
const TRIGGER = 'Disturbed';
const EFFECT = 'The acolyte rises';
const PAGE = 'p. 31';

/** An invented room with one of everything (07 §2's shape). */
const chapterHouse = (): PackPlaceEntry => ({
  packId: 'pack-abbey',
  packEntryId: 'abbey-14',
  name: 'Chapter house of the drowned',
  data: {
    id: 'abbey-14',
    name: 'Chapter house of the drowned',
    key: '14',
    type: 'room',
    parentId: 'abbey-lower',
    terrain: 'flooded-hall',
    playerView: {
      name: 'Flooded hall',
      text: 'A low vaulted hall, knee-deep in black water. Benches float against the far wall.',
      people: [{ description: 'A hunched figure in a reed cloak', npcId: 'npc-oswy' }],
      exits: ['Stairs up (north)', { text: 'Archway (east)', to: 'abbey-15' }],
    },
    gm: { notes: 'A drowned acolyte rises if the benches are disturbed.', secrets: [SECRET] },
    clues: [{ text: 'Wet footprints lead from the water to the lectern and back.', source: PAGE, pointsTo: 'abbey-14' }],
    quotes: [{ text: 'Sink and be saved', kind: 'inscription', source: PAGE }],
    contents: [
      { statBlockId: 'drowned-acolyte', count: '1', appearance: 'A hunched figure, very still' },
      { statBlockId: 'bog-lurker', count: '2', note: 'under the benches' },
    ],
    treasure: [{ text: 'Abbey seal (silver)', itemId: 'abbey-seal', value: { gp: 40, cp: 7 } }],
    hazards: [
      { name: 'Benches', appearance: 'The benches look unsteady', trigger: TRIGGER, effect: EFFECT, source: PAGE },
      { name: 'Lectern', trigger: 'Lifted', effect: 'The seal is found' },
    ],
    encounterCheck: { every: { value: 1, unit: 'day' }, chance: { die: 'd6', on: [1, 2] }, tableRef: 'abbey:abbey-encounters-lower' },
    hiddenUntilSearched: true,
    source: PAGE,
  },
});

describe('composePackPlace: the pieces', () => {
  it('makes the pieces in the pack order, each kind as 07 says, with the GM facts beside them', () => {
    const made = composePackPlace(chapterHouse());
    if (!made.ok) throw new Error(made.message);
    expect(made.parts.pieces.map((p) => [p.kind, p.body])).toEqual([
      ['description', 'A low vaulted hall, knee-deep in black water. Benches float against the far wall.'],
      ['exit', 'Stairs up (north)'],
      ['exit', 'Archway (east)'],
      ['person', 'A hunched figure in a reed cloak'],
      ['clue', 'Wet footprints lead from the water to the lectern and back.'],
      ['treasure', 'Abbey seal (silver)'],
      ['person', 'A hunched figure, very still'],
      ['hazard', 'The benches look unsteady'],
    ]);
    const by = (body: string) => made.parts.pieces.find((p) => p.body === body)!;
    expect(by('Archway (east)').gm_value).toBe('Leads to abbey-15');
    expect(by('A hunched figure in a reed cloak').gm_stat_line).toBe('NPC: npc-oswy');
    expect(by('Wet footprints lead from the water to the lectern and back.').gm_value).toBe('Source: p. 31, Points to abbey-14');
    expect(by('Abbey seal (silver)').gm_value).toBe('40 gp, 7 cp, Item: abbey-seal');
    expect(by('A hunched figure, very still').gm_stat_line).toBe('drowned-acolyte ×1');
    expect(by('The benches look unsteady')).toMatchObject({ gm_value: 'Benches', gm_trigger: 'Disturbed → The acolyte rises' });
  });

  // Purpose (2c, pf-3): each aspect is a piece of its own, kind Other, after the description and in the pack's order,
  // carrying its lead; no other piece has a lead; an aspect with no words is left out.
  it("makes each aspect a piece with its lead-in, after the description", () => {
    const inn = chapterHouse();
    inn.data.playerView = { text: 'Three storeys of tarred timber.', aspects: [{ lead: 'Sign', text: 'A brass lantern.' }, { text: 'Low beams.' }, { lead: 'Empty', text: '' }] };
    const made = composePackPlace(inn);
    if (!made.ok) throw new Error(made.message);
    expect(made.parts.pieces.slice(0, 3).map((p) => [p.kind, p.lead ?? null, p.body])).toEqual([
      ['description', null, 'Three storeys of tarred timber.'],
      ['other', 'Sign', 'A brass lantern.'],
      ['other', null, 'Low beams.'],
    ]);
    expect(made.parts.pieces.filter((p) => p.lead)).toHaveLength(1);
  });

  // Purpose (2c, pf-5, hidden means hidden): a link's marks never reach a piece or the notes; players read the label
  // and never the id it names.
  it("strips a link's marks to its label in pieces, GM facts and notes", () => {
    const inn = chapterHouse();
    inn.data.playerView = { text: 'Smoke over [[place:the-weirs|the weirs]].', aspects: [{ lead: 'Sign', text: 'The [[item:eel-lamp|eel lamp]].' }] };
    inn.data.gm = { notes: 'Kept by [[npc:marda-vane|Marda]].' };
    const made = composePackPlace(inn);
    if (!made.ok) throw new Error(made.message);
    const all = [...made.parts.pieces.map((p) => `${p.body} ${p.gm_value} ${p.gm_stat_line}`), ...Object.values(made.parts.notes)].join('\n');
    expect(all).not.toContain('[[');
    expect(all).not.toContain('marda-vane');
    expect(made.parts.pieces[0]!.body).toBe('Smoke over the weirs.');
    expect(made.parts.notes.traps).toContain('Kept by Marda.');
  });

  it('never puts a GM-side fact in a body: no secret, value, trigger, effect, stat block or page', () => {
    const made = composePackPlace(chapterHouse());
    if (!made.ok) throw new Error(made.message);
    const bodies = made.parts.pieces.map((p) => p.body).join('\n');
    for (const hidden of [SECRET, TRIGGER, EFFECT, PAGE, '40', 'drowned-acolyte', 'bog-lurker', 'Sink and be saved']) expect(bodies).not.toContain(hidden);
  });

  it('a creature or hazard with no appearance is not a piece (nothing to show), and goes to the notes instead', () => {
    const made = composePackPlace(chapterHouse());
    if (!made.ok) throw new Error(made.message);
    expect(made.parts.pieces.some((p) => p.gm_stat_line.includes('bog-lurker'))).toBe(false);
    expect(made.parts.notes.traps).toContain('Creatures: bog-lurker ×2 (under the benches)');
    expect(made.parts.notes.traps).toContain('Hazards: Lectern — Lifted → The seal is found');
  });

  it('a bare location (most region hexes: no player text) makes no piece, and keeps its name, type, parent, key and terrain', () => {
    const made = composePackPlace({ packId: 'p', packEntryId: 'hex-0510', name: 'The Lair', data: { type: 'area', parentId: 'the-region', key: '0510', terrain: 'hilly-forest', gm: { notes: 'Rugged ground.' } } });
    if (!made.ok) throw new Error(made.message);
    expect(made.parts.pieces).toEqual([]);
    expect(made.parts.details).toEqual({ players_name: '', terrain_id: 'hilly-forest', pack_type: 'area', pack_parent_id: 'the-region', pack_key: '0510', region_id: '', settlement: null });
    expect(made.parts.notes.traps).toBe('Rugged ground.');
  });

  it("the players' name is the pack's playerView.name when it has one (⚑ 3, C), else blank", () => {
    const made = composePackPlace(chapterHouse());
    expect(made.ok && made.parts.details.players_name).toBe('Flooded hall');
    expect(made.ok && made.parts.details.pack_type).toBe('room');
  });

  it('a piece longer than the limit is split at a sentence or line, never cut short', () => {
    const sentence = 'The water laps at the benches. ';
    const long = sentence.repeat(300);
    const made = composePackPlace({ packId: 'p', packEntryId: 'r', name: 'R', data: { playerView: { text: long } } });
    if (!made.ok) throw new Error(made.message);
    expect(made.parts.pieces.length).toBeGreaterThan(1);
    expect(made.parts.pieces.every((p) => p.kind === 'description' && p.body.length <= 4000)).toBe(true);
    expect(made.parts.pieces.map((p) => p.body).join(' ').replace(/\s+/g, ' ')).toBe(long.trim().replace(/\s+/g, ' '));
  });
});

describe('composePackPlace: the notes (⚑ 11)', () => {
  it('writes the GM notes, secrets, unshowable creatures and hazards, quotes, the encounter check, the hidden mark and the page, in that order', () => {
    const made = composePackPlace(chapterHouse());
    if (!made.ok) throw new Error(made.message);
    expect(made.parts.notes.traps.split('\n')).toEqual([
      'A drowned acolyte rises if the benches are disturbed.',
      `Secret: ${SECRET}`,
      'Creatures: bog-lurker ×2 (under the benches)',
      'Hazards: Lectern — Lifted → The seal is found',
      'Quote (inscription): Sink and be saved',
      'Encounter check: every 1 day, d6 on 1, 2, table abbey:abbey-encounters-lower',
      'Hidden until searched.',
      'Source: p. 31',
    ]);
    expect(made.parts.notes.puzzles).toBe('');
  });

  it('long notes fill one heading, then the next, in order: nothing lost, each heading within 4000 characters', () => {
    const lines = Array.from({ length: 60 }, (_, i) => `Line ${i + 1}: ${'the reeds whisper '.repeat(10).trim()}`);
    const made = notesAcrossHeadings(lines);
    if (!made.ok) throw new Error(made.message);
    const all = [made.notes.traps, made.notes.puzzles, made.notes.encounters, made.notes.treasure, made.notes.doors];
    expect(all.every((h) => h.length <= 4000)).toBe(true);
    expect(all.filter(Boolean).length).toBeGreaterThan(1);
    expect(all.filter(Boolean).join('\n').split('\n')).toEqual(lines);
    // Filled in order: no gap before a used heading.
    expect(all.map((h) => (h ? 'x' : '-')).join('')).toMatch(/^x+-*$/);
  });

  it('a single run of text over 4000 characters is broken at a line end or a space and continued, never cut', () => {
    const run = 'word '.repeat(1700).trim();
    const made = notesAcrossHeadings([run]);
    if (!made.ok) throw new Error(made.message);
    expect(made.notes.traps.length).toBeLessThanOrEqual(4000);
    expect(`${made.notes.traps} ${made.notes.puzzles} ${made.notes.encounters}`.trim()).toBe(run);
    expect(chunksOf(run, 4000).join(' ')).toBe(run);
  });

  it('notes beyond what the five headings hold are refused with a plain message rather than cut', () => {
    const made = notesAcrossHeadings(['x'.repeat(3999), 'x'.repeat(3999), 'x'.repeat(3999), 'x'.repeat(3999), 'x'.repeat(3999), 'x'.repeat(10)]);
    expect(made.ok).toBe(false);
    expect(!made.ok && made.message).toContain('too long');
  });
});

describe('the region (⚑ 7)', () => {
  const rules = [{ kind: 'rulesSet', data: { wildEncounters: { regionalTables: { 'high-wold': 'enc-high-wold', 'low-fen': { tableId: 'enc-low-fen' } } } } }];

  it("is the region whose table the location's encounter check names, with or without the pack's prefix", () => {
    const tables = regionalTablesOf(rules);
    expect(regionOfPlace({ encounterCheck: { tableRef: 'fen:enc-high-wold' } }, tables)).toBe('high-wold');
    expect(regionOfPlace({ encounterCheck: { tableRef: 'enc-low-fen' } }, tables)).toBe('low-fen');
    expect(regionOfPlace({ encounterCheck: { tableRef: 'fen:enc-elsewhere' } }, tables)).toBe('');
    expect(regionOfPlace({}, tables)).toBe('');
  });

  it('values are words for whole coins only', () => {
    expect(valueWords({ gp: 127, cp: 7 })).toBe('127 gp, 7 cp');
    expect(valueWords({ gp: 'lots' })).toBe('');
    expect(valueWords(null)).toBe('');
  });
});

describe('place.fromPack through the stand-in database', () => {
  let world: FakeWorld;
  let gm: CurrentUser;
  let sam: CurrentUser;
  let campaign: string;
  const registry = createAppRegistry();

  const oathIsle = (entryId: string, type: string): PackPlaceEntry => ({ packId: 'pack-region', packEntryId: entryId, name: 'Oath Isle', data: { type, playerView: { text: `The isle, as a ${type}.` } } });

  beforeEach(() => {
    world = createFakeDb();
    const gmId = world.addPerson('priya@lantern.example', 'Priya');
    const samId = world.addPerson('sam@lantern.example', 'Sam');
    campaign = world.addCampaign('The Ash Barrows', gmId);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: samId });
    world.addMember(campaign, samId, 'player', wren);
    world.tables.campaign_packs.push({ id: 'cp-region', campaign_id: campaign, pack_id: 'pack-region', option_choices: {}, priority: 1 });
    world.tables.library_entries.push(
      { id: 'entry-hex', pack_id: 'pack-region', kind: 'location', pack_entry_id: 'oath-hex', name: 'Oath Isle', data: oathIsle('oath-hex', 'area').data },
      { id: 'entry-site', pack_id: 'pack-region', kind: 'location', pack_entry_id: 'oath-site', name: 'Oath Isle', data: oathIsle('oath-site', 'site').data },
      { id: 'entry-abbey', pack_id: 'pack-abbey', kind: 'location', pack_entry_id: 'abbey-14', name: 'Chapter house of the drowned', data: chapterHouse().data },
    );
    world.signInAs(gmId);
    gm = { id: gmId, roles: { [campaign]: 'gm' } };
    sam = { id: samId, roles: { [campaign]: 'player' } };
  });

  const pick = (entry: PackPlaceEntry, user = gm) => runCommand(registry, world.db, user, placeFromPack, { campaignId: campaign, entry });

  it('picking the same location twice gives one place; two locations may share a name', async () => {
    const first = await pick(oathIsle('oath-hex', 'area'));
    const again = await pick(oathIsle('oath-hex', 'area'));
    const other = await pick(oathIsle('oath-site', 'site'));
    if (!first.ok || !again.ok || !other.ok) throw new Error('not ok');
    expect(again.value.id).toBe(first.value.id);
    expect(other.value.id).not.toBe(first.value.id);
    expect(world.tables.places.filter((p) => p.name === 'Oath Isle' && !p.undone)).toHaveLength(2);
    expect(first.value.pack).toEqual({ packId: 'pack-region', entryId: 'oath-hex', type: 'area', parentId: '', key: '' });
    // One line for the making, none for the repeat.
    expect(world.tables.events.filter((e) => e.type === 'place.fromPack' && e.target_table === 'places')).toHaveLength(2);
  });

  // Purpose (#532 review): picking a place again after the GM edited its notes gives the stored notes and their
  // version, so the next save is accepted and the edit isn't lost.
  it('a repick after the GM edited the notes returns the edited notes and their version', async () => {
    world.tables.campaign_packs.push({ id: 'cp-abbey', campaign_id: campaign, pack_id: 'pack-abbey', option_choices: {}, priority: 2 });
    const made = await pick(chapterHouse());
    if (!made.ok) throw new Error(made.message);
    const edited = await runCommand(registry, world.db, gm, editPlace, { campaignId: campaign, place: made.value, notes: { doors: 'The north door sticks.' } });
    if (!edited.ok) throw new Error(edited.message);
    const again = await pick(chapterHouse());
    if (!again.ok) throw new Error(again.message);
    expect(again.value.notes?.doors).toBe('The north door sticks.');
    expect(again.value.notesVersion).toBe(edited.value.notesVersion);
    const next = await runCommand(registry, world.db, gm, editPlace, { campaignId: campaign, place: again.value, notes: { doors: 'The north door is open.' } });
    expect(next.ok).toBe(true);
  });

  it('the place comes with its notes and its pieces, none shown; Undo marks them all undone and a later pick makes a new place', async () => {
    world.tables.campaign_packs.push({ id: 'cp-abbey', campaign_id: campaign, pack_id: 'pack-abbey', option_choices: {}, priority: 2 });
    const made = await pick(chapterHouse());
    if (!made.ok) throw new Error(made.message);
    const pieces = world.tables.place_pieces.filter((p) => p.place_id === made.value.id);
    expect(pieces).toHaveLength(8);
    expect(pieces.map((p) => p.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(world.tables.piece_shows).toHaveLength(0);
    expect(world.tables.place_notes.find((n) => n.id === made.value.id)?.traps).toContain(`Secret: ${SECRET}`);
    expect(made.value.playersName).toBe('Flooded hall');
    const line = world.tables.events.filter((e) => e.type === 'place.fromPack').sort((a, b) => Number(b.seq) - Number(a.seq))[0]!;
    const undone = await runCommand(registry, world.db, gm, undoChange, { campaignId: campaign, eventId: String(line.id), authorUserId: gm.id });
    expect(undone.ok).toBe(true);
    expect(world.tables.places.find((p) => p.id === made.value.id)?.undone).toBe(true);
    expect(world.tables.place_notes.find((n) => n.id === made.value.id)?.undone).toBe(true);
    expect(world.tables.place_pieces.filter((p) => p.place_id === made.value.id).every((p) => p.undone)).toBe(true);
    const anew = await pick(chapterHouse());
    expect(anew.ok && anew.value.id).not.toBe(made.value.id);
  });

  it("a player can't pick; a pack not attached to the campaign, or an entry it doesn't hold, is refused", async () => {
    expect((await pick(oathIsle('oath-hex', 'area'), sam)).ok).toBe(false);
    const notAttached = await pick(chapterHouse());
    expect(!notAttached.ok && notAttached.message).toBe("That place isn't in an attached pack.");
    const unknown = await pick({ ...oathIsle('oath-nowhere', 'site') });
    expect(!unknown.ok && unknown.message).toBe("That place isn't in an attached pack.");
  });

  it('Start expedition and Where now? by place id land on the place meant, even with another of the same name', async () => {
    const hex = await pick(oathIsle('oath-hex', 'area'));
    const site = await pick(oathIsle('oath-site', 'site'));
    if (!hex.ok || !site.ok) throw new Error('not ok');
    const started = await runCommand(registry, world.db, gm, startExpedition, { campaignId: campaign, mode: 'trek', placeId: site.value.id });
    if (!started.ok) throw new Error(started.message);
    let where = await loadGroupPlaces(world.db, campaign, started.value.id);
    expect(where?.get(1)?.placeId).toBe(site.value.id);
    expect(world.tables.expedition_places[0]?.name).toBe('Oath Isle');
    const moved = await runCommand(registry, world.db, gm, setPlace, { campaignId: campaign, group: 1, name: '', placeId: hex.value.id });
    expect(moved.ok).toBe(true);
    where = await loadGroupPlaces(world.db, campaign, started.value.id);
    expect(where?.get(1)?.placeId).toBe(hex.value.id);
    // A typed name with two pack places of that name makes a typed place of its own (⚑ 10).
    const typed = await runCommand(registry, world.db, gm, setPlace, { campaignId: campaign, group: 1, name: 'Oath Isle' });
    expect(typed.ok).toBe(true);
    const typedPlace = world.tables.places.find((p) => p.name === 'Oath Isle' && !p.pack_entry_id);
    expect(typedPlace).toBeDefined();
    where = await loadGroupPlaces(world.db, campaign, started.value.id);
    expect(where?.get(1)?.placeId).toBe(typedPlace!.id);
  });

  it("the party's region is the picked place's (⚑ 7), read for the scene's situation; none at a typed place", async () => {
    const entry: PackPlaceEntry = { ...oathIsle('oath-hex', 'area'), data: { ...oathIsle('oath-hex', 'area').data, encounterCheck: { tableRef: 'fen:enc-high-wold' } } };
    const started = await runCommand(registry, world.db, gm, startExpedition, { campaignId: campaign, mode: 'trek', packEntry: entry, regionalTables: { 'high-wold': 'enc-high-wold' } });
    if (!started.ok) throw new Error(started.message);
    expect(await loadRegionNow(world.db, campaign, started.value.id)).toBe('high-wold');
    // One request: the place and the start share the start's line (one Undo).
    expect(world.tables.events.filter((e) => e.type === 'expedition.start').map((e) => e.target_table).sort()).toEqual(['campaigns', 'expedition_places', 'expeditions', 'group_places', 'place_notes', 'place_pieces', 'places']);
    const typed = await runCommand(registry, world.db, gm, setPlace, { campaignId: campaign, group: 1, name: 'The Reed Camp' });
    expect(typed.ok).toBe(true);
    expect(await loadRegionNow(world.db, campaign, started.value.id)).toBeNull();
  });

  it('a typed name that matches one pack place alone finds that place', async () => {
    world.tables.campaign_packs.push({ id: 'cp-abbey', campaign_id: campaign, pack_id: 'pack-abbey', option_choices: {}, priority: 2 });
    const made = await pick(chapterHouse());
    if (!made.ok) throw new Error(made.message);
    const started = await runCommand(registry, world.db, gm, startExpedition, { campaignId: campaign, mode: 'dungeon', place: 'chapter house of the drowned' });
    if (!started.ok) throw new Error(started.message);
    const where = await loadGroupPlaces(world.db, campaign, started.value.id);
    expect(where?.get(1)?.placeId).toBe(made.value.id);
    expect(world.tables.places.filter((p) => !p.undone)).toHaveLength(1);
  });
});
