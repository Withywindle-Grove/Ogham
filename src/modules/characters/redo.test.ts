// creation.redo (M5b step 0c, follow-up C; cf-7), on the fake database. Every name and number is invented.
//   A class change empties the spell book, clears the weapon skills and the hit points (ruled B), deletes the kit's and the shop's lines and the
//   trait gear, refunds the money on the record, and keeps the Given gear and the money roll.
//   Undo (the log's, one change) puts the row and every deleted line back.
//   A scores-only change keeps the gear, the book and the skills, and rewrites the scores and the special-approval flags.
//   The fields given are written over the saved ones: a cleared trait field goes, the rest stay.
//   The record's shape (redoRecord) is pure: what goes and what stays.
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { latestChange, undoChange } from '../../core/undo.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import type { CharacterRef } from './commands.ts';
import { redoCreation, redoRecord, type RedoChoice } from './redo.ts';

const registry = createAppRegistry();
let world: FakeWorld;
let me: string;
let campaign: string;
let user: CurrentUser;

const warden: RedoChoice = { classRef: 'lantern-warden', raceRef: 'bog-folk', method: null, rolled: { GRT: 9, WIT: 12 }, scores: { GRT: 8, WIT: 12 } };
const witch: RedoChoice = { ...warden, classRef: 'reed-witch', specialApprovals: [{ step: 'class', entryId: 'reed-witch', name: 'Reed Witch', requirement: 'LORE 9' }] };

function line(id: string, actor: string, name: string, qty = 1) {
  world.tables.inventory_lines.push({ id, campaign_id: campaign, actor_id: actor, location_id: null, container_line_id: null, name, category: 'gear', qty, stack: 1, approval: 'approved', item_data: {}, source_entry_id: null, version: 1, how_got: 'bought' });
}

/** Tam, a draft Lantern Warden with a kit, a bought lantern, a trait's knife, a Given rope, a book and a weapon skill. */
function draft(): { ref: CharacterRef; id: string } {
  const id = world.addCharacter(campaign, 'Tam', { ownerId: me, approval: 'draft' });
  const row = world.tables.actors.find((a) => a.id === id)!;
  row.classes = [{ classRef: 'lantern-warden', level: 1, xp: 0 }];
  row.hp_max = 5;
  row.hp_current = 5;
  row.race_ref = 'bog-folk';
  row.spell_book = ['glimmer'];
  row.weapon_skills = [{ itemId: 'reed-spear' }];
  row.expertise = { 'work-locks': 2 };
  row.fields = { GRT: '9', WIT: '12', languages: 'Fen common, Deep croak, Old lantern, Reedspeak', background: 'Reed cutter', motto: 'Dry wick' };
  row.creation = {
    method: null,
    rolled: { GRT: 9, WIT: 12 },
    scores: { GRT: 9, WIT: 12 },
    startingMoney: 100,
    moneyRecorded: 100,
    moneyCoin: { key: 'gp', valueInBase: 1 },
    spentBase: 27,
    bought: [
      { label: "Warden's kit", price: 22, kitId: 'warden-kit', lines: [{ id: 'l-basket', qty: 1 }, { id: 'l-spear', qty: 1 }] },
      { label: 'Storm lantern', price: 5, lines: [{ id: 'l-lantern', qty: 1 }] },
    ],
    traitGear: { 'fen-backgrounds-bog-folk': [{ id: 'l-knife', qty: 1 }] },
    givenGear: [{ id: 'l-rope', qty: 1 }],
    toFinish: ['weaponSkills'],
    gearDone: true,
  };
  for (const [lineId, name] of [['l-basket', 'Reed basket'], ['l-spear', 'Reed spear'], ['l-lantern', 'Storm lantern'], ['l-knife', 'Eel knife'], ['l-rope', 'Reed rope']] as const) line(lineId, id, name);
  return { ref: { id, campaignId: campaign, ownerType: 'user', ownerUserId: me, approval: 'draft', archived: false }, id };
}

const tam = (id: string) => world.tables.actors.find((a) => a.id === id)!;
const linesOf = (id: string) => world.tables.inventory_lines.filter((l) => l.actor_id === id).map((l) => l.id).sort();

beforeEach(() => {
  world = createFakeDb();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  me = world.addPerson('wren@lantern.example', 'Sam');
  campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  for (const [key, type] of [['GRT', 'number'], ['WIT', 'number'], ['languages', 'text'], ['background', 'text'], ['motto', 'text']] as const) {
    world.tables.field_definitions.push({ id: `field-${key}`, campaign_id: campaign, applies_to: 'pc', key, label: key, type, choices: [], field_group: '', sort_order: 0, show_on_card: false, hidden: false, fill: null, required: false, created_at: '2026-10-18T12:00:00Z' });
  }
  world.signInAs(me);
  user = { id: me, roles: { [campaign]: 'player' } };
});

describe('redoRecord', () => {
  it('a race or class change refunds the money, forgets the purchases, the trait gear, the To finish list and the gear mark, and names the lines to delete; the Given gear and the money roll stay', () => {
    const { creation, lines } = redoRecord({ scores: { GRT: 9 }, startingMoney: 100, moneyRecorded: 100, spentBase: 27, bought: [{ label: 'Kit', price: 22, lines: [{ id: 'a', qty: 1 }, { id: 'b', qty: 2 }] }], traitGear: { list: [{ id: 'c', qty: 1 }] }, givenGear: [{ id: 'd', qty: 1 }], toFinish: ['gear'], gearDone: true }, witch, true);
    expect(lines).toEqual(['a', 'b', 'c']);
    expect(creation).toEqual({ method: null, rolled: witch.rolled, scores: witch.scores, specialApprovals: witch.specialApprovals, startingMoney: 100, moneyRecorded: 100, spentBase: 0, bought: [], givenGear: [{ id: 'd', qty: 1 }] });
  });
  it('a scores-only change rewrites the scores and the flags and nothing else', () => {
    const { creation, lines } = redoRecord({ scores: { GRT: 9 }, spentBase: 27, bought: [{ label: 'Kit', price: 22, lines: [{ id: 'a', qty: 1 }] }], specialApprovals: [{ step: 'class', entryId: 'x', name: 'X', requirement: 'GRT 9' }] }, warden, false);
    expect(lines).toEqual([]);
    expect(creation).toEqual({ method: null, rolled: warden.rolled, scores: warden.scores, spentBase: 27, bought: [{ label: 'Kit', price: 22, lines: [{ id: 'a', qty: 1 }] }] });
  });
  it('the alignment’s special approval (cs-3) is Who they are’s: a redo of the race or class keeps it beside the new ones', () => {
    const alignment = { step: 'alignment', entryId: 'Lantern', name: 'Lantern', requirement: 'A reed witch is usually Reed or Mire' };
    const { creation } = redoRecord({ specialApprovals: [{ step: 'class', entryId: 'x', name: 'X', requirement: 'GRT 9' }, alignment] }, witch, true);
    expect(creation.specialApprovals).toEqual([...witch.specialApprovals!, alignment]);
    expect(redoRecord({ specialApprovals: [alignment] }, warden, false).creation.specialApprovals).toEqual([alignment]);
  });
});

describe('creation.redo', () => {
  it('a class change empties the book and the skills, takes the kit, the shop buy and the trait gear out of the pack with the money refunded, keeps the Given gear, and writes the fields given', async () => {
    const { ref, id } = draft();
    const done = await runCommand(registry, world.db, user, redoCreation, { character: ref, choice: witch, fields: { background: '', languages: 'Fen common, Deep croak, Reedspeak' } });
    expect(done).toMatchObject({ ok: true, value: { changed: true } });
    expect(linesOf(id)).toEqual(['l-rope']);
    const row = tam(id);
    expect(row.classes).toEqual([{ classRef: 'reed-witch', level: 1, xp: 0 }]);
    expect(row.spell_book).toEqual([]);
    expect(row.weapon_skills).toEqual([]);
    expect(row).toMatchObject({ hp_max: null, hp_current: null });
    expect(row.fields).toEqual({ GRT: '9', WIT: '12', languages: 'Fen common, Deep croak, Reedspeak', motto: 'Dry wick' });
    expect(row.creation).toMatchObject({ scores: { GRT: 8, WIT: 12 }, spentBase: 0, bought: [], startingMoney: 100, moneyRecorded: 100, givenGear: [{ id: 'l-rope', qty: 1 }], specialApprovals: witch.specialApprovals });
    expect(row.creation).not.toHaveProperty('traitGear');
    expect(row.creation).not.toHaveProperty('toFinish');
    expect(row.creation).not.toHaveProperty('gearDone');
  });

  it('Undo puts the row and every deleted line back at once', async () => {
    const { ref, id } = draft();
    const before = JSON.parse(JSON.stringify(tam(id)));
    expect(await runCommand(registry, world.db, user, redoCreation, { character: ref, choice: witch, fields: { background: '' } })).toMatchObject({ ok: true });
    expect(linesOf(id)).toEqual(['l-rope']);
    const eventId = await latestChange(world.db, campaign, 'creation.redo', me);
    expect(eventId).not.toBeNull();
    expect(await runCommand(registry, world.db, user, undoChange, { campaignId: campaign, eventId: eventId!, authorUserId: me })).toMatchObject({ ok: true });
    expect(linesOf(id)).toEqual(['l-basket', 'l-knife', 'l-lantern', 'l-rope', 'l-spear']);
    const after = tam(id);
    for (const key of ['classes', 'race_ref', 'spell_book', 'weapon_skills', 'hp_max', 'hp_current', 'fields', 'creation'] as const) expect(after[key]).toEqual(before[key]);
  });

  it('a class change clears the expertise points; a race change alone keeps them (G-208)', async () => {
    // Purpose: points spent on the old class's skills never stay on a new class's character, and a changed kindred
    // with the same class keeps them (they are the class's).
    const first = draft();
    expect(await runCommand(registry, world.db, user, redoCreation, { character: first.ref, choice: witch, fields: { background: '' } })).toMatchObject({ ok: true });
    expect(tam(first.id).expertise).toEqual({});
    const second = draft();
    expect(await runCommand(registry, world.db, user, redoCreation, { character: second.ref, choice: { ...warden, raceRef: 'stone-kin' }, fields: { background: '' } })).toMatchObject({ ok: true });
    expect(tam(second.id).expertise).toEqual({ 'work-locks': 2 });
  });

  it('a race change alone clears the later picks but keeps the hit points (ruled B, amended: the hit die is the class’s)', async () => {
    const { ref, id } = draft();
    const done = await runCommand(registry, world.db, user, redoCreation, { character: ref, choice: { ...warden, raceRef: 'stone-kin' }, fields: { background: '' } });
    expect(done).toMatchObject({ ok: true, value: { changed: true, classChanged: false } });
    expect(linesOf(id)).toEqual(['l-rope']);
    const row = tam(id);
    expect(row.race_ref).toBe('stone-kin');
    expect(row.spell_book).toEqual([]);
    expect(row).toMatchObject({ hp_max: 5, hp_current: 5 });
  });

  it('a scores-only change keeps the gear, the book and the skills, and rewrites the scores', async () => {
    const { ref, id } = draft();
    const done = await runCommand(registry, world.db, user, redoCreation, { character: ref, choice: warden, fields: { GRT: '8' } });
    expect(done).toMatchObject({ ok: true, value: { changed: false } });
    expect(linesOf(id)).toEqual(['l-basket', 'l-knife', 'l-lantern', 'l-rope', 'l-spear']);
    const row = tam(id);
    expect(row.spell_book).toEqual(['glimmer']);
    expect(row.weapon_skills).toEqual([{ itemId: 'reed-spear' }]);
    expect(row).toMatchObject({ hp_max: 5, hp_current: 5 });
    expect(row.fields).toMatchObject({ GRT: 8, background: 'Reed cutter' });
    expect(row.creation).toMatchObject({ scores: { GRT: 8, WIT: 12 }, spentBase: 27, toFinish: ['weaponSkills'] });
    expect((row.creation as { bought: unknown[] }).bought).toHaveLength(2);
    expect(row.creation).not.toHaveProperty('specialApprovals');
  });

  it("a field that isn't the campaign's is refused before anything is written", async () => {
    const { ref, id } = draft();
    expect(await runCommand(registry, world.db, user, redoCreation, { character: ref, choice: witch, fields: { hidden: 'x' } })).toMatchObject({ ok: false });
    expect(linesOf(id)).toHaveLength(5);
    expect(tam(id).spell_book).toEqual(['glimmer']);
  });
});
