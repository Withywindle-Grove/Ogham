// Test-only page for the Playwright layout checks (layout.html, tests/layout): the real screens against the
// in-memory stand-in database, filled with invented sample data. Never part of the built app.
//   ?as=gm      signed in as the GM (Priya)
//   ?as=player  signed in as a player with an approved, active character (Sam, playing Wren)
//   ?as=new     signed in as a player who joined but has no character yet (Jo)
//   (none)      signed out: the sign-in screen
//   &p1=1       the shared P1-like character (layoutP1Character.ts): "The Storm Lantern Road", Sam playing Brannoch
//               Fenward, with a full right column, a lit storm lantern and oil, a spear in hand, a pinned knife and
//               four statuses; every Player screen row of plan dec-13 is pictured against it
//   &gear=1     "The Fen Muster" on the invented fixture pack, Jo (?as=new) joined with no character: creation's Gear step
//   &gmWaiting=1  "The Fen Reckoning" on the invented fixture pack, Jo's Tam waiting for the GM (?as=gm), no score rolled
//   &creation=full  "The Fen Census" on the whole fixture pack with creation-full.fixture.json over it, Jo (?as=new)
//               joined with no character: guided creation reaches every step (Method, Patron, the hit points row,
//               Roll for a name, First spells, Gear's pick and trinket sheets, Languages, Weapon skills, backgrounds,
//               Details); walked in tests/layout/creationWorld.spec.ts
//   &send=refuse   the send command (Send to the GM) comes back refused while online
//   &send=offline  the send fails as offline: the device reads offline and the request errors, for the page's life (Try again never succeeds)
//   &slow=1     every answer from the stand-in database waits 600 ms, so creation's loading state (300 ms) shows
//   &skills=1   Wren is a level 3 Lantern Warden with two skills (the pop-up scene); off by default, so the
//               gallery's pictures of Wren stay as they are
//   ?mapParts=1 the map card and the map pop-up alone (dec-7 piece 5a), on an invented harbour picture, wired to no
//               screen: `loading` or `failed` for those frames, `longTitle` the card with a long title, `&open=1` opens the pop-up at once
//   ?moveOn=gm  Moving on as parts (dec-7 piece 4a), wired to no screen: `gm` the GM's list, `way` one way chosen,
//               `obstacle` a way with an obstacle, `obstacle-plain` one not the GM's to decide and with no name,
//               `proposal` a proposed way (1 of 3), `proposal-plain` one with no obstacle (2 of 3), `players` Where to?
//               with your proposal, `players-other` with another's, `queue` the proposals' queue worked by hand
//   ?placePage=spots|spot|hand|none  the GM's place page (dec-7 piece 5b): see the block that builds it, below
//   &lights=several    two reed lamps beside Wren's rushlights (the pick "Which light?")
//   ?placeCard=1 the players' place card (P4): the Location's card and the Area's in the page's two columns; `bare` the
//               Area never shown, `messy` long names and 999; `gm` the GM's Knowledge sheet with its eyes
//   ?knowledge=1 a place's Knowledge sheet open (dec-7 piece 6a), wired to no screen: `one` a lone section (open at
//               the start, set out in blocks), `empty` a place with nothing written
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../ui/fonts.css';
import '../ui/tokens.css';
import '../ui/base.css';
import '../ui/buttons.css';
import { Root } from '../app/App.tsx';
import { applyTextSize, getTextSize } from '../ui/textSize.ts';
import { applyThemeChoice, getThemeChoice } from '../ui/theme.ts';
import { createFakeDb } from './fakeDb.ts';
import fenFixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import fullCreationFixture from '../../scripts/fixtures/creation-full.fixture.json?raw';
import { BuildContext, STAND_IN_BUILD } from '../app/AppUpdate.tsx';
import { EVENT_HEADER } from '../core/eventTags.ts';

const world = createFakeDb();
const gm = world.addPerson('priya@lantern.example', 'Priya');
const sam = world.addPerson('sam@lantern.example', 'Sam');
const jo = world.addPerson('jo@lantern.example', 'Jo');
const campaign = world.addCampaign('The Drowned Marches of the Lantern Coast', gm);
const reedmouth = world.addCampaign('The Reedmouth Delve', gm);
// Recent places for Where? (M5 step 10, DG1): two earlier expeditions, one from a very long place name.
for (const [i, name] of ['The Drowned Stair beneath the Abbey of the Seven Sunken Lanterns of Old Reedmouth', 'Bog Gate'].entries()) {
  world.tables.expeditions.push({ id: `expedition-reedmouth-${i}`, campaign_id: reedmouth, session_id: null, mode: 'dungeon', started_at: 0, ended_at: 600, who_went: [], summary: { seconds: 600 }, started_by: gm, undone: false, version: 1 });
  world.tables.expedition_places.push({ id: `place-reedmouth-${i}`, campaign_id: reedmouth, expedition_id: `expedition-reedmouth-${i}`, name, mode: 'dungeon', undone: false, created_by: gm, created_at: `2026-10-2${i}T12:00:00Z` });
}
// A campaign the GM has retired: read only, folded away on the list.
const fen = world.addCampaign('The Old Fen Road', gm);
world.tables.campaigns.find((c) => c.id === fen)!.retired_at = '2026-10-22T09:00:00Z';

const wren = world.addCharacter(campaign, 'Wren of the Lantern Wardens', {
  ownerId: sam,
  companyName: 'The Sluice Gate Company',
});
world.addCharacter(campaign, 'Hollis', { ownerId: sam, approval: 'pending' });
// A character the GM sent back with a note and two sections ticked (B18).
const moss = world.addCharacter(campaign, 'Moss of the Reed Ferry', { ownerId: sam, approval: 'rejected' });
// A draft not sent yet (ruled 2026-10-26): on Your characters, and its review with Send to the GM.
world.addCharacter(campaign, 'Rush of the Low Fen Crossing', { ownerId: sam, approval: 'draft' });
Object.assign(world.tables.actors.find((a) => a.id === moss)!, {
  review_note: 'Please roll hit points again, and say where Moss learned the ferry songs.',
  review_sections: ['hp', 'story'],
  hp_max: null,
});
world.addMember(campaign, sam, 'player', wren);
world.addMember(campaign, jo, 'player');
world.addInvite(campaign, 'RQ7KX2MP');
// A campaign with a very long name, where Sam has no character yet: its top row's back link must end in "…" on a
// phone at the largest text size, not push the page sideways.
const ferry = world.addCampaign('The Long Night Ferry Across the Seven Drowned Lanterns of Old Reedmouth', gm);
world.addMember(ferry, sam, 'player');
Object.assign(world.tables.actors.find((a) => a.id === wren)!, {
  level: 3,
  hp_current: 11,
  hp_max: 14,
  backstory: 'Born on the sluice barges; raised by the lamplighters after the flood year.',
  notes: 'Owes the lamplighters’ guild a favour.',
  fields: { folk: 'Marsh folk', path: 'Lantern Warden', might: 13, wits: 15, oath: 'Keep the beacons lit' },
});
const field = (key: string, label: string, type: string, sort: number, extra: Record<string, unknown> = {}) =>
  world.tables.field_definitions.push({
    id: `field-${key}`,
    campaign_id: campaign,
    applies_to: 'pc',
    key,
    label,
    type,
    choices: [],
    field_group: '',
    sort_order: sort,
    show_on_card: false,
    hidden: false,
    created_at: '2026-10-19T12:00:00Z',
    ...extra,
  });
field('folk', 'Folk', 'text', 1, { show_on_card: true });
field('path', 'Path', 'list', 2, { show_on_card: true, choices: ['Lantern Warden', 'Reedblade'] });
field('might', 'Might', 'number', 3, { field_group: 'Abilities' });
field('wits', 'Wits', 'number', 4, { field_group: 'Abilities' });
field('oath', 'Oath', 'longtext', 5, { field_group: 'Oaths and debts' });

// A few log entries, as the database would write them.
const logged = (seq: number, type: string, actor: string, level: string, before: unknown, after: unknown, minutesAgo: number) =>
  world.tables.events.push({
    id: `event-${seq}`,
    seq,
    campaign_id: campaign,
    type,
    level,
    actor_user_id: actor,
    target_table: 'actors',
    target_id: wren,
    before,
    after,
    fiat: false,
    reason: null,
    reverts_event_id: null,
    audience: 'all',
    owner_user_id: null,
    reveal_at: 'now',
    request_id: `request-${seq}`,
    created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  });
logged(1, 'character.review', gm, 'simple', { approval: 'pending' }, { approval: 'approved' }, 90);
logged(2, 'character.edit', sam, 'simple', { notes: '' }, { notes: 'Owes the lamplighters’ guild a favour.' }, 45);
logged(3, 'character.setHp', sam, 'verbose', { hp_current: 14 }, { hp_current: 11 }, 5);
logged(5, 'character.edit', gm, 'simple', { notes: '' }, { notes: 'Bitten by a bog lurker' }, 3);
Object.assign(world.tables.events.at(-1)!, { fiat: true, reason: 'Failed the marsh crossing' });

// A note about Wren, and one added to the approval line.
const note = (id: string, by: string, text: string, extra: Record<string, unknown>) => {
  const now = new Date(Date.now() - 30 * 60_000).toISOString();
  world.tables.notes.push({ id, campaign_id: campaign, created_by: by, text, about_actor_id: null, annotates_event_id: null, audience: 'all', owner_user_id: null, created_at: now, updated_at: now, ...extra });
};
note('note-1', sam, 'The ferryman wants paying before dawn.', { about_actor_id: wren });
logged(4, 'note.add', sam, 'simple', null, { text: 'The ferryman wants paying before dawn.', about_actor_id: wren }, 30);
world.tables.events.at(-1)!.target_table = 'notes';
world.tables.events.at(-1)!.target_id = 'note-1';
note('note-2', gm, 'Welcome to the Lantern Wardens.', { annotates_event_id: 'event-1' });

// A setting-rules pack in the GM's library (invented).
world.tables.packs.push({ id: 'pack-river', owner_user_id: gm, campaign_id: null, name: 'River Rules', version: '0.2', kind: 'setting', format_version: 2, source: 'Invented for layout checks', notes: '', extra_meta: { author: 'Priya', licence: 'For our table only' }, updated_at: '2026-10-18T12:00:00Z' });
// Some entries carry details, for the setting-rules browser.
const details: Record<string, Record<string, unknown>> = {
  'lantern-warden': { hitDie: 'd8', notes: 'Keeps the lamps of the river towns lit.', abilities: [{ name: 'Lamp lore', fromLevel: 1, notes: 'Knows how long any flame will burn.' }] },
  'bog-lurker': { hp: '3d8', hpAverage: 13, fields: { AC: '6', Move: '60 ft', Attacks: '1 bite (1d6)' }, notes: 'Hides under still water.' },
};
for (const [kind, id, name] of [['class', 'lantern-warden', 'Lantern Warden'], ['race', 'marsh-folk', 'Marsh folk'], ['item', 'rope-50ft', 'Rope, 50 ft'], ['statBlock', 'bog-lurker', 'Bog lurker']]) {
  world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-river', kind, pack_entry_id: id, name, data: { id, name, ...details[id ?? ''] } });
}

world.tables.library_entries.push(
  { id: 'entry-lantern-oil', pack_id: 'pack-river', kind: 'option', pack_entry_id: 'lantern-oil', name: 'Lanterns need oil', data: { id: 'lantern-oil', name: 'Lanterns need oil', default: 'on', changeLater: 'warn', choices: [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }] } },
  { id: 'entry-ac-style', pack_id: 'pack-river', kind: 'option', pack_entry_id: 'ac-style', name: 'Armour class', data: { id: 'ac-style', name: 'Armour class', default: 'desc', changeLater: 'never', notes: 'Whether a better armour class is a higher number or a lower one.', choices: [{ id: 'asc', name: 'Ascending', notes: 'Higher is better.' }, { id: 'desc', name: 'Descending', notes: 'Lower is better.' }] } },
  // An optional rule the app doesn't apply yet (`manual`, ex-7), so the Rules tab's rows show "Run by hand ›".
  { id: 'entry-ferry-tolls', pack_id: 'pack-river', kind: 'option', pack_entry_id: 'ferry-tolls', name: 'Ferry tolls by the hour', data: { id: 'ferry-tolls', name: 'Ferry tolls by the hour', default: 'off', changeLater: 'warn', manual: true, notes: 'The ferryman charges for every hour the crossing takes.', choices: [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }] } },
);
// River Rules is attached to the campaign, with one optional rule changed.
world.tables.campaign_packs.push({ id: 'campaign-pack-river', campaign_id: campaign, pack_id: 'pack-river', option_choices: { 'lantern-oil': 'off', 'ac-style': 'desc' }, priority: 1 });
// A spell with formulas, for the level picker.
world.tables.library_entries.push({ id: 'entry-glimmer', pack_id: 'pack-river', kind: 'spell', pack_entry_id: 'glimmer', name: 'Glimmer', data: { id: 'glimmer', name: 'Glimmer', range: '30 ft', duration: { formula: '2 + level', unit: 'turn' }, damage: { formula: '1d6 + level / 2' } } });
// A second pack above it with its own Lantern Warden, so the browser has another version to show.
world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-10-17T12:00:00Z' });
world.tables.library_entries.push({ id: 'entry-fen-warden', pack_id: 'pack-fen', kind: 'class', pack_entry_id: 'lantern-warden', name: 'Lantern Warden', data: { id: 'lantern-warden', name: 'Lantern Warden', hitDie: 'd6', notes: 'Wardens of the fen lamps.', requirements: { STR: 9 }, primeRequisites: ['STR'] } });
world.tables.campaign_packs.push({ id: 'campaign-pack-fen', campaign_id: campaign, pack_id: 'pack-fen', option_choices: {}, overrides: {}, priority: 2 });
// Two attached packs offering the same rules (rc-fold, 2026-11-20), only with ?clash=1: Rules for this campaign shows
// two rule cards, folded, one with a long topic and a long choice name (messy data at 375 px).
if (new URLSearchParams(window.location.search).get('clash') === '1') {
  const ac = world.tables.library_entries.find((e) => e.id === 'entry-ac-style')!;
  ac.data = { ...(ac.data as Record<string, unknown>), ruleKey: 'ac-style' };
  const ties = (pack: string, choices: { id: string; name: string; notes?: string }[]) =>
    world.tables.library_entries.push({
      id: `entry-${pack}-ties`,
      pack_id: `pack-${pack}`,
      kind: 'option',
      pack_entry_id: `${pack}-ties`,
      name: 'Initiative ties',
      data: { id: `${pack}-ties`, name: 'Initiative ties', ruleKey: 'initiative-ties-between-two-lantern-wardens-on-the-same-count', default: choices[0]!.id, changeLater: 'allow', choices },
    });
  ties('river', [
    { id: 'again', name: 'Roll again with the lowest die kept until one of the lantern-keepers stands above the other', notes: 'Both sides roll once more.' },
    { id: 'same', name: 'Both act at once' },
  ]);
  ties('fen', [
    { id: 'keeper', name: "The lantern-keeper's chosen warden acts first, then the other, then everyone else in order" },
    { id: 'same', name: 'Both act at once' },
  ]);
  world.tables.library_entries.push({
    id: 'entry-fen-ac',
    pack_id: 'pack-fen',
    kind: 'option',
    pack_entry_id: 'fen-ac',
    name: 'Armour class',
    data: { id: 'fen-ac', name: 'Armour class', ruleKey: 'ac-style', default: 'up', changeLater: 'never', choices: [{ id: 'up', name: 'Upwards' }, { id: 'down', name: 'Downwards' }] },
  });
}
// The Rules library by kind (M5b step 0d.2), only with ?library=1: messy data (a homebrew overlay with a long name
// and description that needs River Rules, 0 and 999 counts) and an adventure, so the groups and chips show.
if (new URLSearchParams(window.location.search).get('library') === '1') {
  world.tables.packs.find((p) => p.id === 'pack-river')!.extra_meta = { id: 'river-rules', author: 'Priya', licence: 'For our table only', description: 'The rules for a river-and-ferry campaign.' };
  world.tables.packs.push({
    id: 'pack-long-overlay',
    owner_user_id: gm,
    campaign_id: null,
    name: 'A Very Long Homebrew Overlay Name That Someone Typed Into The File Without Stopping',
    version: '0.0.1',
    kind: 'homebrew',
    format_version: 2,
    source: '',
    notes: '',
    extra_meta: { id: 'long-overlay', requires: [{ packId: 'river-rules' }], description: 'Extra poisons, fogs and ferry tolls for the river towns, gathered from many evenings of play and written down at length.' },
    updated_at: '2026-11-02T09:00:00Z',
  });
  for (let n = 1; n <= 999; n++) world.tables.library_entries.push({ id: `entry-overlay-item-${n}`, pack_id: 'pack-long-overlay', kind: 'item', pack_entry_id: `toll-${n}`, name: `Toll token ${n}`, data: { id: `toll-${n}` } });
  world.tables.packs.push({ id: 'pack-ferry-adventure', owner_user_id: gm, campaign_id: null, name: 'The Ferry at Dusk', version: '0.2', kind: 'adventure', format_version: 2, source: '', notes: '', extra_meta: {}, updated_at: '2026-10-29T09:00:00Z' });
  // Campaign set-up step 3 (M5b step 0d.3): the overlay's armour-class rule shares River Rules' ruleKey (one clash
  // callout), with a long name and notes, and a page on River Rules' rule.
  const ac = world.tables.library_entries.find((e) => e.id === 'entry-ac-style')!;
  ac.data = { ...(ac.data as Record<string, unknown>), ruleKey: 'ac-style', source: 'p. 112' };
  world.tables.library_entries.push({
    id: 'entry-overlay-ac',
    pack_id: 'pack-long-overlay',
    kind: 'option',
    pack_entry_id: 'overlay-ac',
    name: 'Armour class counted the ferry-town way, upwards from ten',
    data: { id: 'overlay-ac', ruleKey: 'ac-style', default: 'up', changeLater: 'never', source: 'issue 5, p. 21', notes: 'The towns along the river count armour upwards; a ferryman in a padded coat is harder to hit than one without.', choices: [{ id: 'up', name: 'Upwards' }, { id: 'down', name: 'Downwards' }] },
  });
}
// Encounter tables, full screen (M5b step g3), only with ?tables=1: messy data (a long name and description, a d100
// table of long rows, a table with three columns, a row that opens another table).
if (new URLSearchParams(window.location.search).get('tables') === '1') {
  const fenTable = (id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind: 'table', pack_entry_id: id, name, data: { id, name, ...data } });
  fenTable('sluice-depths', 'The drowned sluices beneath the lantern-keepers\u2019 chapter house, second and third levels', {
    die: 'd100',
    description: 'Everything that moves in the flooded cells and crypts below the chapter house, and the things that feed on them at night.',
    nextTablePattern: 'sluice-{result}',
    rows: Array.from({ length: 50 }, (_, i) => ({
      min: i * 2 + 1,
      max: i * 2 + 2,
      result: i === 3 ? 'Mortal' : `Reed wraiths of the ${i + 1}th sluice, drifting in a slow line against the current`,
      count: i % 3 === 0 ? '2d6' : null,
      note: i % 2 === 0 ? 'Silent until they touch the lantern light; then they wail and scatter into the reeds.' : null,
    })),
  });
  fenTable('sluice-Mortal', 'Mortal', { die: 'd4', rows: [{ min: 1, max: 4, result: 'Pilgrims lost on the causeway with a lame mule', count: '999' }] });
  fenTable('fen-wild', 'Wilderness of the fen, by day', {
    die: 'd12',
    columns: ['Wild', 'Road', 'River'],
    rows: [{ min: 1, max: 2, results: ['Animal', 'Patrol', 'Otters'] }, { min: 3, max: 12, results: ['No one', 'No one', 'No one'] }],
  });
}
// Skills on the Player screen (M5 gate fix, gate item 8), only with ?skills=1: the class's skills filled at level 3.
if (new URLSearchParams(window.location.search).get('skills') === '1') {
  Object.assign(world.tables.library_entries.find((e) => e.id === 'entry-fen-warden')!.data as Record<string, unknown>, {
    skills: { names: { HR: 'Hide in reeds', LW: 'Listen at water' }, die: 'd6', byLevel: [{ level: 1, HR: 1, LW: 1 }, { level: 3, HR: 2, LW: 2 }] },
  });
  world.tables.library_entries.push({ id: 'entry-fill-level', pack_id: 'pack-fen', kind: 'hook', pack_entry_id: 'fill-level', name: 'fill-level', data: { id: 'fill-level', name: 'fill-level', kind: 'fill', when: 'levelUp', from: 'classProgression', target: ['skills'] } });
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, { classes: [{ classRef: 'lantern-warden', level: 3, xp: 0 }] });
}

// The full sheet's Magic section (sr-4), only with ?magic=1 or ?magic=empty: Wren is a level 3 Lantern Warden who
// keeps a spell book (slots 3 at level 1, 2 at level 2). With 1, a book of five (one given, one with a very long name),
// two glamours from another list (a second kind of magic, its own tab) and spells prepared (one twice); with empty,
// nothing picked yet.
const magicFlag = new URLSearchParams(window.location.search).get('magic');
if (magicFlag === '1' || magicFlag === 'empty') {
  Object.assign(world.tables.library_entries.find((e) => e.id === 'entry-fen-warden')!.data as Record<string, unknown>, {
    spellcasting: { listId: 'lamp-lore', type: 'book', fromLevel: 1, firstSpells: { given: ['glimmer'] } },
    progression: [
      { level: 1, spellSlots: [2] },
      { level: 3, spellSlots: [3, 2] },
    ],
  });
  if (!world.tables.library_entries.some((e) => e.id === 'entry-fill-level')) {
    world.tables.library_entries.push({ id: 'entry-fill-level', pack_id: 'pack-fen', kind: 'hook', pack_entry_id: 'fill-level', name: 'fill-level', data: { id: 'fill-level', name: 'fill-level', kind: 'fill', when: 'levelUp', from: 'classProgression', target: ['spellSlots'] } });
  }
  const spell = (id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind: 'spell', pack_entry_id: id, name, data: { id, name, ...data } });
  spell('reed-whisper', 'Reed whisper', { range: 'touch', duration: 'instant', notes: 'The reeds repeat the last thing said near them.' });
  // Invented descriptions for the Magic tab's opened spell (dec-8 B; mm-12): Reed whisper's is short, Mire grip's has a
  // lead-in and a list, the long lantern's is long enough to scroll on a phone.
  spell('mire-grip', 'Mire grip', {
    range: '70 ft',
    duration: { value: 2, unit: 'round' },
    notes: {
      blocks: [
        { p: 'Mud rises around one creature the caster can see and holds its feet.' },
        { lead: 'Breaking free', text: 'The held creature may try once a round; the mud lets go on a success.' },
        { list: ['It cannot walk or run while held.', 'It can still swing, throw and speak.', 'Fire dries the mud and ends the spell at once.'] },
      ],
    },
    source: 'Fen rules p. 12',
  });
  spell('damp-wick', 'Damp wick', { range: '20 ft', duration: { value: 2, unit: 'hour' } });
  spell('long-lantern', 'The long lantern of the drowned abbey that burns beneath the black water until dawn', {
    range: '50 ft',
    duration: { value: 1, unit: 'night' },
    notes: {
      blocks: [
        { p: 'A pale lantern kindles under the nearest water and burns there until the sun comes up. Its light rises through mud, weed and ice alike, and shows the bottom as clearly as a lit floor.' },
        { p: 'Anything that swims into the light is seen by everyone on the bank, however deep it goes. Creatures that shun the light will not cross it, and turn back at its edge rather than pass through.' },
        { lead: 'Moving it', text: 'The caster may carry the lantern along the water at a walking pace by keeping a hand in the water; letting go leaves it where it is.' },
        { lead: 'Putting it out', text: 'Draining the water, or covering it with earth, snuffs the lantern. Nothing else does, not wind, rain or the caster’s sleep.' },
        { p: 'Old reed-cutters say the lantern was first lit to find a bell lost when the abbey sank, and that on a still night it still swings toward the place the bell lies.' },
      ],
    },
    source: 'Fen rules p. 13',
  });
  spell('heron-hush', 'Heron hush', { range: 'self', duration: '4 turns' });
  spell('frog-song', 'Frog song', { range: '90 ft', duration: 'instant' });
  const list = (id: string, name: string, levels: { level: number; spells: string[] }[]) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind: 'spellList', pack_entry_id: id, name, data: { id, name, levels } });
  list('lamp-lore', 'Lamp lore', [
    { level: 1, spells: ['glimmer', 'reed-whisper', 'mire-grip', 'damp-wick'] },
    { level: 2, spells: ['long-lantern'] },
  ]);
  // With &levelNames=1 the list names its levels (lv-1, pf-22: the Magic tab's headings and the sheet's spells a day
  // read them); with &levelNames=long, level 2's name is as long as the longest a real pack gives (13 letters); with
  // &levelNames=long2, both levels' names are (the spells a day at 375 px). Invented words.
  const levelNamesFlag = new URLSearchParams(window.location.search).get('levelNames');
  if (levelNamesFlag === 'long2') {
    (world.tables.library_entries.find((e) => e.id === 'entry-lamp-lore')!.data as Record<string, unknown>).levelNames = { '1': { one: 'marsh vesper', many: 'marsh vespers' }, '2': { one: 'reed warding', many: 'reed wardings' } };
  }
  if (levelNamesFlag === '1' || levelNamesFlag === 'long') {
    const lore = world.tables.library_entries.find((e) => e.id === 'entry-lamp-lore')!.data as Record<string, unknown>;
    lore.levelNames = { '1': { one: 'lamp rite', many: 'lamp rites' }, '2': levelNamesFlag === 'long' ? { one: 'reed warding', many: 'reed wardings' } : { one: 'deep rite', many: 'deep rites' } };
  }
  list('marsh-glamours', 'Glamours', [{ level: 1, spells: ['heron-hush', 'frog-song'] }]);
  const wrenRow = world.tables.actors.find((a) => a.id === wren)!;
  Object.assign(wrenRow, { classes: [{ classRef: 'lantern-warden', level: 3 }] });
  if (magicFlag === '1') {
    Object.assign(wrenRow, { spell_book: ['glimmer', 'reed-whisper', 'mire-grip', 'damp-wick', 'long-lantern', 'heron-hush', 'frog-song'] });
    world.tables.character_play.push({ actor_id: wren, campaign_id: campaign, prepared: [{ spell: 'glimmer', level: 1 }, { spell: 'glimmer', level: 1 }, { spell: 'long-lantern', level: 2 }], uses_spent: {}, ac_override: null, form_id: null, version: 1 });
  }
}

// The Pack tab (M4): coin mode from River Rules' rules set, Wren's items, and the Party stash (invented).
Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { encumbrance: { mode: 'coin' } } });
world.tables.library_entries.push(
  {
    id: 'entry-river-rules',
    pack_id: 'pack-river',
    kind: 'rulesSet',
    pack_entry_id: 'river-rules',
    name: 'River rules',
    data: {
      id: 'river-rules',
      name: 'River rules',
      // Two scores, so guided creation has something to enter and trade (the M4b re-test and m5b-0c scenes); the
      // tiles start at the dice average, and the trade as data gives the Adjust scores step.
      abilities: [
        { key: 'STR', short: 'STR', name: 'Strength' },
        { key: 'DEX', short: 'DEX', name: 'Dexterity' },
      ],
      scores: { dice: '3d6', min: 3, max: 18 },
      abilityAdjustment: { lowerBy: 2, raiseBy: 1, lowerable: 'nonPrime', raise: 'prime', floor: 3, note: 'Lower a score by 2 to raise your prime by 1.', source: 'River rules p. 4' },
      encumbrance: {
        mode: 'coin',
        coin: {
          maxLoadCoin: 1000,
          miscGearCoin: 40,
          miscGearCategories: ['gear'],
          tiers: [
            { label: 'Unhurried', max: 300, effect: 'Full pace' },
            { label: 'Loaded', max: 700, effect: 'Slower' },
            { label: 'Bowed', max: 1000, effect: 'Crawling' },
          ],
          overMax: 'Stuck',
        },
        treasureWeights: { gem: 1 },
      },
    },
  },
  { id: 'entry-eel-trap', pack_id: 'pack-river', kind: 'item', pack_entry_id: 'eel-trap', name: 'Eel trap', data: { id: 'eel-trap', name: 'Eel trap', category: 'gear', weightCoin: 40, value: { sp: 5 }, notes: 'Wicker, smells of river.', availability: { rarity: 'Uncommon', where: ['Village', 'Town'], note: 'Waterside settlements only.', chance: '3-in-6' } } },
);
// Alignment on Who they are (cr-12), only with ?alignments=1: the campaign keeps an Alignment field and River rules
// names the alignments, each with a one-line blurb for its row and a longer note for its entry (invented).
if (new URLSearchParams(window.location.search).get('alignments') === '1') {
  field('alignment', 'Alignment', 'list', 6);
  Object.assign(world.tables.library_entries.find((e) => e.id === 'entry-river-rules')!.data as Record<string, unknown>, {
    alignments: ['Reed', 'Mire', 'Open water'],
    alignmentBlurbs: { Reed: 'Bends with the current, keeps the old ways.', Mire: 'Holds fast and trusts no stranger.', 'Open water': 'Goes where the wind goes.' },
    alignmentNotes: {
      Reed: 'Reed folk keep the lamps lit and the ferries running, and they mend what the floods break before they ask who broke it.',
      Mire: 'Mire folk keep to their own stilts and their own debts; a promise made in the mire is kept, and a slight is remembered.',
      'Open water': 'Open water folk follow no lamp and no oath for long; they trade, wander and leave before the water rises.',
    },
  });
}
const ash = world.addCharacter(campaign, 'Ash', { ownerId: gm });
const line = (id: string, actorId: string | null, name: string, extra: Record<string, unknown> = {}) =>
  world.tables.inventory_lines.push({
    id,
    campaign_id: campaign,
    actor_id: actorId,
    location_id: actorId ? null : `location-stash-${campaign}`,
    library_entry_id: null,
    name,
    category: 'gear',
    weight_coin: null,
    slots: null,
    stack: 1,
    qty: 1,
    container_line_id: null,
    equipped: false,
    how_got: 'found',
    cost: '',
    notes: '',
    item_data: {},
    source_pack_id: null,
    source_entry_id: null,
    charges_left: null,
    charges_hidden: false,
    charges_used: 0,
    spent_shown: false,
    last_roll: null,
    pinned: false,
    at_hand_hidden: false,
    approval: 'approved',
    per_units: 1,
    created_at: `2026-10-23T09:00:${String(world.tables.inventory_lines.length).padStart(2, '0')}Z`,
    ...extra,
  });
line('line-coat', wren, 'Quilted coat', { weight_coin: 100, equipped: true, item_data: { slot: 'armour', notes: 'Patched at the elbows.' } });
line('line-sack', wren, 'Sack', { weight_coin: 5, item_data: { container: { capacityCoin: 200 } } });
line('line-pearls', wren, 'River pearls', { category: 'gem', qty: 6, stack: 50, container_line_id: 'line-sack' });
line('line-arrows', wren, 'Reed arrows', { weight_coin: 1, qty: 18, stack: 20 });
line('line-chalk', wren, 'Chalk');
line('line-wand', wren, 'Glow wand', { category: 'magic-wand', weight_coin: 10 });
line('line-ewer', null, 'Silver ewer', { weight_coin: 30 });
// Take from the stash (K12, PK4b), only with ?stash=1: a stack of 999 with a long name (the "Take" sheet), and a heavy
// chest that puts Wren over the limit (the toast's warning).
if (new URLSearchParams(window.location.search).get('stash') === '1') {
  line('line-beads', null, 'Glass trade beads from the drowned market at the edge of the long fen', { weight_coin: 0, qty: 999, stack: 999 });
  line('line-chest', null, 'Iron-bound reed chest', { weight_coin: 5000 });
}
// The full sheet's Combat tiles (sheet plan order 4), only with ?combat=1: a long shield beside the coat, so AC's
// caption has two parts ("Quilted coat · Barge-plank tower shield") that can't share a line in a phone's tile, and
// Wren at level 3 with XP for Level's caption.
if (new URLSearchParams(window.location.search).get('combat') === '1') {
  line('line-shield', wren, 'Barge-plank tower shield', { weight_coin: 100, equipped: true, item_data: { slot: 'shield' } });
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, { classes: [{ classRef: 'lantern-warden', level: 3, xp: 2100 }] });
}
// The Pack tab's Tiny things section (SC-5-2), only with ?tiny=1: three weightless tiny things (`unencumbering`), one
// with a long name, one of 999, one in the Sack, so the section reads "3 items: …" with "They don't count" under it.
if (new URLSearchParams(window.location.search).get('tiny') === '1') {
  const tiny = { unencumbering: true };
  line('line-pebble', wren, 'Lucky pebble from the drowned causeway at the edge of the long fen', { weight_coin: 0, item_data: tiny });
  line('line-hooks', wren, 'Eel hooks', { weight_coin: 0, qty: 999, stack: 999, item_data: tiny });
  line('line-needle', wren, 'Fishbone needle', { weight_coin: 0, container_line_id: 'line-sack', item_data: tiny });
}
// The coin line and its sheets (K9, K10), only with ?coin=1: River rules names three invented coins and Wren's purse
// holds two of them (a coin at none is left out of the line and shown as 0 in the sheet); ?coin=messy gives five coins
// with long names and 999 of one, as mockup pack/07 PC2 draws.
const coinFlag = new URLSearchParams(window.location.search).get('coin');
if (coinFlag) {
  const rules = world.tables.library_entries.find((e) => e.id === 'entry-river-rules')!.data as Record<string, unknown>;
  rules.currency =
    coinFlag === 'messy'
      ? [
          { key: 'moon', label: 'moon-silver crowns of the Old Causeway', valueInBase: 1000 },
          { key: 'heron', label: 'heron marks', valueInBase: 100 },
          { key: 'reed', label: 'reed-bits', valueInBase: 10 },
          { key: 'penny', label: 'drowned pennies', valueInBase: 5 },
          { key: 'token', label: 'lantern tokens', valueInBase: 1 },
          { key: 'chit', label: 'ferry chits', valueInBase: 1 },
        ]
      : [
          { key: 'crown', label: 'crowns', valueInBase: 100 },
          { key: 'heron', label: 'herons', valueInBase: 10 },
          { key: 'bit', label: 'bits', valueInBase: 1 },
        ];
  const coins = coinFlag === 'messy' ? { moon: 2, heron: 999, reed: 120, penny: 7, token: 3 } : { crown: 12, heron: 30 };
  world.tables.purses.push({ id: 'purse-wren', campaign_id: campaign, actor_id: wren, location_id: null, coins, version: 1 });
  // The stash's coin (K13, PC6), with ?stash=1 as well: 40 herons and 12 bits (messy: 999 of one long-named coin).
  if (new URLSearchParams(window.location.search).get('stash') === '1') {
    const stashCoins = coinFlag === 'messy' ? { moon: 1, heron: 999, token: 12 } : { heron: 40, bit: 12 };
    world.tables.purses.push({ id: 'purse-stash', campaign_id: campaign, actor_id: null, location_id: `location-stash-${campaign}`, coins: stashCoins, version: 1 });
  }
}
void ash;
// A light (M5 step 7, invented): River Rules' rushlight, used up when it burns out, and four of them in Wren's pack,
// so Light lights one in one tap (key journey 5).
world.tables.library_entries.push({
  id: 'entry-rushlight',
  pack_id: 'pack-river',
  kind: 'lightType',
  pack_entry_id: 'rushlight',
  name: 'Rushlight',
  data: { id: 'rushlight', name: 'Rushlight', duration: 6, unit: 'turn', radius: '30 ft', warnAt: 1, consumed: true },
});
line('line-rushlights', wren, 'Rushlights', { category: 'light', qty: 4, stack: 10, item_data: { lightTypeId: 'rushlight' } });
// &lights=several (PL8's Light button, the local review): two reed lamps too, so the Light pop-up's Light opens
// "Which light?".
if (new URLSearchParams(window.location.search).get('lights') === 'several') {
  world.tables.library_entries.push({
    id: 'entry-reed-lamp',
    pack_id: 'pack-river',
    kind: 'lightType',
    pack_entry_id: 'reed-lamp',
    name: 'Reed lamp',
    data: { id: 'reed-lamp', name: 'Reed lamp', duration: 4, unit: 'turn', radius: '20 ft', warnAt: 1, consumed: true },
  });
  line('line-reed-lamps', wren, 'Reed lamps', { category: 'light', qty: 2, stack: 10, item_data: { lightTypeId: 'reed-lamp' } });
}

// The GM's reminders (M5 step 6, invented): an encounter check every 2 turns, the GM's own, and a public reminder
// with a long name (messy data for the players' reference list).
const reminder = (id: string, extra: Record<string, unknown>) =>
  world.tables.reminders.push({
    id,
    campaign_id: campaign,
    kind: 'reminder',
    encounter_check: false,
    every_value: 1,
    every_unit: 'turn',
    anchor: 0,
    active: true,
    is_public: false,
    chance: null,
    table_id: null,
    note: null,
    created_by: gm,
    undone: false,
    version: 1,
    created_at: `2026-10-29T09:00:0${world.tables.reminders.length}Z`,
    ...extra,
  });
// With ?tables=1 its hit rolls the Mortal table (M5b step 2: the combined GM turn's 4 taps, and an Encounter waiting card).
reminder('reminder-wander', {
  label: 'Wandering check',
  kind: 'check',
  encounter_check: true,
  every_value: 2,
  chance: { die: 'd6', on: [1] },
  ...(new URLSearchParams(window.location.search).get('tables') === '1' ? { table_id: 'sluice-Mortal' } : {}),
});
reminder('reminder-lamps', { label: 'Check the lamps and the lantern oil before the long dark of the lower sluices', every_value: 3, is_public: true });

// Statuses (M5 step 9, invented; messy data): on Ash, a long name that stacks to 12, a level of a condition with
// levels, and a timer only the GM sees (its time in the GM-only table). River Rules gets the two conditions.
world.tables.library_entries.push(
  { id: 'entry-weary', pack_id: 'pack-river', kind: 'condition', pack_entry_id: 'weary', name: 'Weary', data: { id: 'weary', name: 'Weary', stacks: true, notes: 'Slow and sore until a proper rest.' } },
  {
    id: 'entry-dazed',
    pack_id: 'pack-river',
    kind: 'condition',
    pack_entry_id: 'dazed',
    name: 'Dazed',
    data: { id: 'dazed', name: 'Dazed', levels: [{ id: 'dazed', name: 'Dazed' }, { id: 'reeling', name: 'Reeling' }, { id: 'out-cold', name: 'Out cold' }] },
  },
  // B6 (M5b g6): a family of two kinds, one with a long name and a long effect.
  { id: 'entry-fen-bite', pack_id: 'pack-river', kind: 'condition', pack_entry_id: 'fen-bite', name: 'Fen bite', data: { id: 'fen-bite', name: 'Fen bite', family: 'Bog rot', notes: 'Itches until dawn.' } },
  {
    id: 'entry-reed-cut',
    pack_id: 'pack-river',
    kind: 'condition',
    pack_entry_id: 'reed-cut',
    name: 'Reed cut from the long sluice-gate rushes of the lower causeway',
    data: { id: 'reed-cut', name: 'Reed cut from the long sluice-gate rushes of the lower causeway', family: 'Bog rot', notes: 'Bleeds a little at every step until bound with clean linen and left to rest for a full night.' },
  },
);
const status = (id: string, extra: Record<string, unknown>) =>
  world.tables.character_statuses.push({
    id,
    campaign_id: campaign,
    actor_id: ash,
    name: '',
    condition_id: null,
    icon: null,
    stacks: 1,
    stacking: false,
    levels: null,
    level: null,
    source: 'typed',
    note: null,
    started_at: 0,
    ends_at: null,
    total_seconds: null,
    unit: null,
    secret: false,
    ended_at: null,
    end_reason: null,
    undone: false,
    version: 1,
    created_at: `2026-10-31T09:00:0${world.tables.character_statuses.length}Z`,
    ...extra,
  });
status('status-bog', { name: 'Bog-sickness of the Seven Drowned Lanterns of Old Reedmouth', stacks: 12, stacking: true });
status('status-dazed', { name: 'Dazed', condition_id: 'dazed', source: 'condition', levels: [{ id: 'dazed', name: 'Dazed' }, { id: 'reeling', name: 'Reeling' }, { id: 'out-cold', name: 'Out cold' }], level: 1 });
status('status-sight', { name: 'Fen-sight', secret: true });
world.tables.status_secrets.push({ id: 'status-sight', campaign_id: campaign, ends_at: 1800, total_seconds: 2400, unit: 'turn', version: 1 });

// Rest (M5 step 9, DG5; invented): a campaign whose setting rules want a turn of rest in every three, or Weary,
// with an expedition under way two turns in. Sam plays Bram there; Jo's Tamsin hasn't rested.
const causeway = world.addCampaign('The Weary Causeway', gm);
const bram = world.addCharacter(causeway, 'Bram the Lamplighter of the Lower Sluices', { ownerId: sam });
world.addCharacter(causeway, 'Tamsin', { ownerId: jo });
world.addMember(causeway, sam, 'player', bram);
world.addMember(causeway, jo, 'player');
world.tables.packs.push({ id: 'pack-causeway', owner_user_id: gm, campaign_id: null, name: 'Causeway Rules', version: '1', kind: 'setting', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-10-31T12:00:00Z' });
world.tables.library_entries.push(
  {
    id: 'entry-causeway-rules',
    pack_id: 'pack-causeway',
    kind: 'rulesSet',
    pack_entry_id: 'causeway-rules',
    name: 'Causeway rules',
    data: {
      id: 'causeway-rules',
      name: 'Causeway rules',
      exploration: {
        modes: [
          {
            id: 'creep',
            name: 'Creeping',
            step: { value: 1, unit: 'turn' },
            procedure: [],
            checks: [],
            movement: {},
            rest: { every: { value: 3, unit: 'turn' }, length: { value: 1, unit: 'turn' }, condition: 'weary', note: 'Sit a turn in every three, or grow weary and slow on the long causeway.' },
          },
        ],
      },
    },
  },
  { id: 'entry-causeway-weary', pack_id: 'pack-causeway', kind: 'condition', pack_entry_id: 'weary', name: 'Weary', data: { id: 'weary', name: 'Weary', stacks: true } },
);
world.tables.campaign_packs.push({ id: 'campaign-pack-causeway', campaign_id: causeway, pack_id: 'pack-causeway', option_choices: {}, overrides: {}, priority: 1 });
world.tables.campaign_clocks.find((c) => c.campaign_id === causeway)!.seconds = 1200;
/**
 * A session under way in a campaign whose expedition is running (plan dec-9-the-whole-scene S9: with no session the
 * GM's band offers Start session in Next turn's place, so the harness's adventures are mid-session, as at the table).
 */
function sessionUnderWay(campaignId: string) {
  world.tables.sessions.push({ id: `session-${campaignId}`, campaign_id: campaignId, number: 1, started_at: '2026-10-31T09:00:00Z', ended_at: null, started_by: gm, ended_by: null, undone: false, version: 1 });
}
world.tables.expeditions.push({ id: 'expedition-causeway', campaign_id: causeway, session_id: null, mode: 'creep', started_at: 0, ended_at: null, who_went: [bram], summary: null, started_by: gm, undone: false, version: 1 });
sessionUnderWay(causeway);
Object.assign(world.tables.campaigns.find((c) => c.id === causeway)!, { mode: 'adventure' });

// Today's weather (M5b): two wading expeditions under invented weather rules, Sam playing in both. On the Wet Road
// the weather is due (the card on Scene and the urgent strip's prompt); on the Dry Ford it's in, with a long result
// and four tags, to check the card wraps on a phone at the largest text. ?weather=fair makes the Dry Ford's weather the
// shortest word, "Fair" (tv-1: the facts' tiles with the longest and the shortest weather).
world.tables.packs.push({ id: 'pack-sky', owner_user_id: gm, campaign_id: null, name: 'Sky Rules', version: '1', kind: 'setting', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-10-17T12:00:00Z' });
const skyEntry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
  world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-sky', kind, pack_entry_id: id, name, data: { id, name, ...data } });
skyEntry('rulesSet', 'sky-rules', 'Sky rules', {
  weather: {
    tables: { any: 'fen-sky' },
    tags: {
      wet: { name: 'Wet', note: 'Lighting a campfire is hard, and damp tinder smokes for a long while before it takes' },
      mired: { name: 'Mired', budget: -2 },
      fog: { name: 'Fog', note: 'You see only a few paces ahead' },
      gusty: { name: 'Gusty', note: 'Arrows drift' },
    },
  },
  exploration: { modes: [{ id: 'wade', name: 'Wading the long marsh roads', step: { value: 1, unit: 'day' }, procedure: [], movement: { kind: 'budget', name: 'Travel points', unit: 'points' } }] },
});
skyEntry('table', 'fen-sky', 'Fen sky', { die: 'd6', rows: [{ min: 1, max: 6, result: 'A grey, drowning rain that comes sideways off the lantern coast', tags: ['wet', 'mired', 'fog', 'gusty'] }] });
for (const [name, rolled] of [['The Wet Road', false], ['The Dry Ford', true]] as const) {
  const id = world.addCampaign(name, gm);
  const who = world.addCharacter(id, `Wren of ${name.slice(4)}`, { ownerId: sam });
  world.addMember(id, sam, 'player', who);
  world.tables.campaign_packs.push({ id: `campaign-pack-sky-${id}`, campaign_id: id, pack_id: 'pack-sky', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.expeditions.push({ id: `expedition-${id}`, campaign_id: id, session_id: null, mode: 'wade', started_at: 0, ended_at: null, who_went: [who], summary: null, started_by: gm, undone: false, version: 1 });
  sessionUnderWay(id);
  if (rolled)
    world.tables.weather_rolls.push({
      id: `weather-${id}`,
      campaign_id: id,
      expedition_id: `expedition-${id}`,
      period: 0,
      starts_at: 0,
      table_id: 'fen-sky',
      roll: '3',
      result: new URLSearchParams(window.location.search).get('weather') === 'fair' ? 'Fair' : 'A grey, drowning rain that comes sideways off the lantern coast',
      tags: ['wet', 'mired', 'fog', 'gusty'],
      entered_by: sam,
      entered_at: '2026-10-30T19:00:00Z',
      corrected_by: null,
      undone: false,
      version: 1,
    });
}

// Places (M5 step 11): an expedition under way where the GM has shown Sam's group the Moth Gallery (the GM and the
// player can't share one page's world, so the player's side is seeded already shown; the GM's side is clicked through
// from Start expedition in tests/layout/journeys.spec.ts).
const hall = world.addCampaign('The Lantern Hall', gm);
const ilsa = world.addCharacter(hall, 'Ilsa', { ownerId: sam });
world.addMember(hall, sam, 'player', ilsa);
world.tables.expeditions.push({ id: 'expedition-hall', campaign_id: hall, session_id: null, mode: 'dungeon', started_at: 0, ended_at: null, who_went: [ilsa], summary: null, started_by: gm, undone: false, version: 1 });
sessionUnderWay(hall);
Object.assign(world.tables.campaigns.find((c) => c.id === hall)!, { mode: 'adventure' });
world.tables.places.push({ id: 'place-moth-gallery', campaign_id: hall, name: 'The Moth Gallery', description: 'Dusty frames line the walls and a draught stirs the cobwebs.', version: 1, undone: false, created_by: gm, created_at: '2026-10-31T12:00:00Z', updated_at: '2026-10-31T12:00:00Z' });
world.tables.place_notes.push({ id: 'place-moth-gallery', campaign_id: hall, traps: 'A loose flagstone.', puzzles: '', encounters: '', treasure: '', doors: '', version: 1 });
world.tables.group_places.push({ id: 'group-place-hall', campaign_id: hall, expedition_id: 'expedition-hall', group_number: 1, place_id: 'place-moth-gallery', shown: true, moved_on: false, undone: false, created_at: '2026-10-31T12:00:00Z' });
// Its pieces (M5b g2, B1): the description and one exit shown to Sam's group; a clue the GM keeps hidden.
const piece = (id: string, kind: string, body: string, position: number) => ({ id, campaign_id: hall, place_id: 'place-moth-gallery', kind, body, position, gm_value: '', gm_trigger: '', gm_stat_line: '', undone: false, created_at: '2026-10-31T12:00:00Z' });
world.tables.place_pieces.push(
  piece('piece-hall-description', 'description', 'Dusty frames line the walls and a draught stirs the cobwebs.', 0),
  piece('piece-hall-exit', 'exit', 'A narrow stair down, to the west', 1),
  piece('piece-hall-clue', 'clue', 'Moth wings swept into one corner', 2),
);
const showIn = (id: string, at: string) => ({ id: `show-${id}`, campaign_id: hall, group_place_id: 'group-place-hall', piece_id: id, group_number: 1, shown: true, shown_at: at, undone: false });
world.tables.piece_shows.push(showIn('piece-hall-description', '2026-10-31T12:01:00Z'), showIn('piece-hall-exit', '2026-10-31T12:02:00Z'));

// The wilderness (M5b gate, plan m5b-5 build order 2): two day-by-day treks on the invented fixture pack's Fen trek
// (scripts/fixtures/m5b-creation.fixture.json), Sam playing a long-named character with the GM's Moss beside him.
//   The Long Fen Road: day 1 under way in the sedge, 5 of 12 leagues spent, the weather in; the GM has marked the
//     party lost and a Prowlers hit waits as an Encounter waiting card; one place shown (What we know).
//   The Reed Camp: the first evening, camp made with the reed fire lit, Reed has eaten, the watches set.
const fenPack = JSON.parse(fenFixture) as Record<string, Record<string, unknown>[]>;
world.tables.packs.push({ id: 'pack-fen-trek', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-11-03T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
for (const [list, kind] of [['rulesSets', 'rulesSet'], ['items', 'item'], ['lightTypes', 'lightType'], ['tables', 'table']] as const) {
  for (const data of fenPack[list] ?? []) world.tables.library_entries.push({ id: `entry-fen-${kind}-${String(data.id)}`, pack_id: 'pack-fen-trek', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
}
const HOUR = 3600;
function fenTrek(name: string, hour: number) {
  const id = world.addCampaign(name, gm);
  const reed = world.addCharacter(id, 'Reed of the Long Sedge Causeway and the Nine Drowned Steps', { ownerId: sam }); // words: names
  const moss = world.addCharacter(id, 'Moss', { ownerId: gm });
  world.addMember(id, sam, 'player', reed);
  Object.assign(world.tables.campaigns.find((c) => c.id === id)!, { mode: 'adventure', settings: { encumbrance: { mode: 'coin' } } });
  world.tables.campaign_packs.push({ id: `campaign-pack-fen-${id}`, campaign_id: id, pack_id: 'pack-fen-trek', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.campaign_clocks.find((c) => c.campaign_id === id)!.seconds = hour * HOUR;
  const expedition = `expedition-${id}`;
  world.tables.expeditions.push({ id: expedition, campaign_id: id, session_id: null, mode: 'fen-trek', started_at: 0, ended_at: null, who_went: [reed, moss], summary: null, started_by: gm, undone: false, version: 1 });
  sessionUnderWay(id);
  for (const actor of [reed, moss]) world.tables.carrier_loads.push({ actor_id: actor, campaign_id: id, tier: 'Light', load: 0, version: 1 });
  world.tables.weather_rolls.push({ id: `weather-${id}`, campaign_id: id, expedition_id: expedition, period: 0, starts_at: 0, table_id: 'fen-sky', roll: '5', result: 'Clear', tags: [], entered_by: sam, entered_at: '2026-11-03T09:00:00Z', corrected_by: null, undone: false, version: 1 });
  world.tables.travel_groups.push({
    id: `travel-${id}`, campaign_id: id, expedition_id: expedition, group_number: 1, day: 0, total: 12, gm_per_day: null, pace: 'foot', spent: 5, forced: 0, terrain_id: 'sedge', route_id: null,
    pending_owed: null, pending_place_name: null, pending_place_id: null, pending_terrain_id: null, pending_route_id: null, created_by: gm, undone: false, version: 1, created_at: '2026-11-03T09:00:00Z',
  });
  return { id, reed, moss, expedition };
}
const road = fenTrek('The Long Fen Road', 6);
world.tables.group_lost.push({ id: 'lost-road', campaign_id: road.id, expedition_id: road.expedition, group_number: 1, since_day: 0, found_day: null, attempts: 0, roll: null, roll_by: null, note: '', created_by: gm, undone: false, version: 1, created_at: '2026-11-03T10:00:00Z' });
world.tables.check_results.push({
  id: 'check-road-prowl', campaign_id: road.id, expedition_id: road.expedition, check_key: 'mode:fen-prowl', name: 'Prowlers', source: 'mode', outcome: 'hit', at_seconds: 5 * HOUR, modifiers: [], note: null,
  table_id: 'fen-prowlers', roll: '2', row_text: 'Bog lurkers (1d4)', secret: true, revealed: false, revealed_by_hand: false, created_by: gm, undone: false, version: 1, created_at: '2026-11-03T10:00:00Z',
});
world.tables.waiting_encounters.push({ id: 'waiting-road', campaign_id: road.id, expedition_id: road.expedition, check_result_id: 'check-road-prowl', watch: null, state: 'waiting', started_at: null, dismissed_at: null, created_by: gm, undone: false, version: 1, created_at: '2026-11-03T10:00:00Z' });
world.tables.places.push({ id: 'place-heron-rise', campaign_id: road.id, name: 'Heron Rise', description: '', terrain_id: 'sedge', image_asset_id: null, version: 1, undone: false, created_by: gm, created_at: '2026-11-03T10:00:00Z', updated_at: '2026-11-03T10:00:00Z' });
world.tables.group_places.push({ id: 'group-place-heron', campaign_id: road.id, expedition_id: road.expedition, group_number: 1, place_id: 'place-heron-rise', shown: true, moved_on: false, undone: false, created_at: '2026-11-03T10:00:00Z' });
world.tables.place_pieces.push({ id: 'piece-heron', campaign_id: road.id, place_id: 'place-heron-rise', kind: 'description', body: 'A low hummock where grey herons stand in the shallows and watch the causeway.', position: 0, gm_value: '', gm_trigger: '', gm_stat_line: '', undone: false, created_at: '2026-11-03T10:00:00Z' });
world.tables.piece_shows.push({ id: 'show-heron', campaign_id: road.id, group_place_id: 'group-place-heron', piece_id: 'piece-heron', group_number: 1, shown: true, shown_at: '2026-11-03T10:01:00Z', undone: false });

const reedCamp = fenTrek('The Reed Camp', 20);
world.tables.camps.push({ id: 'camp-reed', campaign_id: reedCamp.id, expedition_id: reedCamp.expedition, group_number: 1, day: 0, quick: false, fire_type_id: 'reed-fire', fire_name: 'Reed fire', fuel_item: 'reed-bundle', applied_at: null, created_by: gm, undone: false, version: 1, created_at: '2026-11-03T19:00:00Z', updated_at: '2026-11-03T19:00:00Z' });
const campEntry = (n: number, kind: string, actor: string, extra: Record<string, unknown>) =>
  world.tables.camp_entries.push({
    id: `camp-entry-${n}`, camp_id: 'camp-reed', campaign_id: reedCamp.id, group_number: 1, kind, actor_id: actor, qty: 0, seconds: 0, at: 20 * HOUR, line_id: null, food_name: null, food_kind: null, from_pot: false, outcome: null, detail: [],
    created_by: sam, undone: false, version: 1, created_at: `2026-11-03T19:0${n}:00Z`, updated_at: `2026-11-03T19:0${n}:00Z`, ...extra,
  });
campEntry(1, 'fuel', reedCamp.reed, { qty: 2, seconds: 4 * HOUR, line_id: 'line-camp-reeds' });
campEntry(2, 'meal', reedCamp.reed, { line_id: 'line-camp-rations', food_name: 'Dry rations', food_kind: 'preserved' });
campEntry(3, 'watches', reedCamp.reed, { detail: [[reedCamp.reed], [reedCamp.moss]] });

// The town's and downtime's top (the whole Scene's S5; page 16, T4 and T5), only with ?town=town|downtime: a campaign
// between expeditions, a session running, its rules a market town by parts of the day and the cellars by the turn; in
// town (adventure time) its afternoon after the clock has moved, or in downtime. Names and rules are invented.
const townFlag = new URLSearchParams(window.location.search).get('town');
if (townFlag === 'town' || townFlag === 'downtime') {
  const quay = world.addCampaign('The Reedmouth Quay', gm);
  const nell = world.addCharacter(quay, 'Nell', { ownerId: sam });
  world.addMember(quay, sam, 'player', nell);
  world.tables.packs.push({ id: 'pack-quay', owner_user_id: gm, campaign_id: null, name: 'Quay Rules', version: '1', kind: 'setting', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-11-15T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-quay-rules',
    pack_id: 'pack-quay',
    kind: 'rulesSet',
    pack_entry_id: 'quay-rules',
    name: 'Quay rules',
    data: {
      id: 'quay-rules',
      name: 'Quay rules',
      exploration: {
        modes: [
          { id: 'quay', name: 'Market town', step: { value: 1, unit: 'partOfDay' }, procedure: [], checks: [] },
          { id: 'cellars', name: 'Under the quay', step: { value: 1, unit: 'turn' }, procedure: [], checks: [] },
        ],
      },
    },
  });
  world.tables.campaign_packs.push({ id: 'link-quay', campaign_id: quay, pack_id: 'pack-quay', option_choices: {}, overrides: {}, priority: 1 });
  Object.assign(world.tables.campaigns.find((c) => c.id === quay)!, { mode: townFlag === 'town' ? 'adventure' : 'downtime' });
  // The afternoon of day 2 (the morning starts at 06:00 and a part is 8 hours): past the first day, so the date line is no longer the tap that sets the hour.
  world.tables.campaign_clocks.find((c) => c.campaign_id === quay)!.seconds = (24 + 14) * HOUR;
  sessionUnderWay(quay);
  // The Depart sheet's Where? with Locations (plan scene-point-to-point B7; page 24, DP1), only with ?places=isle: an
  // adventure pack of two Areas and their Locations, one name long enough to wrap. Names are invented. The Harbour's
  // Locations are out of order in the pack, with a 0 and a 10, so the list's own order shows (Q1, F1 a).
  if (new URLSearchParams(window.location.search).get('places') === 'isle') {
    world.tables.packs.push({ id: 'pack-isle', owner_user_id: gm, campaign_id: null, name: 'Saltwick Isle', version: '1', kind: 'adventure', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-11-18T12:00:00Z' });
    world.tables.campaign_packs.push({ id: 'link-isle', campaign_id: quay, pack_id: 'pack-isle', pack_name: 'Saltwick Isle', option_choices: {}, overrides: {}, priority: 2 });
    const isle = [
      { id: 'i01-isle', name: 'Saltwick Island', type: 'region', parentId: null },
      { id: 'i02-harbour', name: 'The Drowned Harbour', type: 'site', parentId: 'i01-isle' },
      { id: 'i07-shed', name: 'The Customs Shed of the Old Lantern Wardens, Long Since Flooded', type: 'area', parentId: 'i02-harbour', key: '10' },
      { id: 'i05-wreck', name: 'The Wreck', type: 'area', parentId: 'i02-harbour', key: '2' },
      { id: 'i03-anchorage', name: 'The Anchorage', type: 'area', parentId: 'i02-harbour' },
      { id: 'i06-breakwater', name: 'The Breakwater', type: 'area', parentId: 'i02-harbour', key: '0' },
      { id: 'i04-jetty', name: 'The Jetty', type: 'area', parentId: 'i02-harbour', key: '1' },
      { id: 'i08-beach', name: 'The Shingle Beach', type: 'site', parentId: 'i01-isle' },
      { id: 'i09-landing', name: 'The Landing', type: 'area', parentId: 'i08-beach' },
      { id: 'i10-stack', name: 'The Sea Stack', type: 'area', parentId: 'i08-beach', key: '1' },
    ];
    for (const data of isle) world.tables.library_entries.push({ id: `entry-${data.id}`, pack_id: 'pack-isle', kind: 'location', pack_entry_id: data.id, name: data.name, data });
  }
}

// Set the date (the whole Scene's S10; page 16, T6), only with ?date=1: a new campaign whose calendar start isn't set
// and whose clock hasn't moved, so the GM's date line opens the sheet with the day, the month and the hour. Its
// calendar has seven months, one with a long name. Names are invented.
if (new URLSearchParams(window.location.search).get('date') === '1') {
  const mere = world.addCampaign('The Reckoning Mere', gm);
  world.tables.packs.push({ id: 'pack-mere', owner_user_id: gm, campaign_id: null, name: 'Mere Rules', version: '1', kind: 'setting', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-11-15T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-mere-calendar',
    pack_id: 'pack-mere',
    kind: 'calendar',
    pack_entry_id: 'mere-reckoning',
    name: 'Reckoning of the mere',
    data: {
      id: 'mere-reckoning',
      name: 'Reckoning of the mere',
      months: [
        { name: 'Frostwane', days: 30, season: 'winter' },
        { name: 'Thawmonth', days: 30, season: 'spring' },
        { name: 'Reedmonth', days: 30, season: 'spring' },
        { name: 'Highsun', days: 30, season: 'summer' },
        { name: 'Hayfall', days: 30, season: 'summer' },
        { name: 'The month of the long lantern-lit evenings over the drowned causeway', days: 30, season: 'autumn' },
        { name: 'Mistmonth', days: 30, season: 'autumn' },
      ],
    },
  });
  world.tables.campaign_packs.push({ id: 'link-mere', campaign_id: mere, pack_id: 'pack-mere', option_choices: {}, overrides: {}, priority: 1 });
  Object.assign(world.tables.campaigns.find((c) => c.id === mere)!, { mode: 'adventure' });
}

// A full character on the invented fixture pack (sheet plan order 4, Design 2026-11-05), only with ?full=1: Tamsin, a
// level 3 bog folk Lantern Warden with the six scores, saves, movement, Hark, traits (a drawback, a use, one from
// level 4), a spell book and spells prepared (two kinds of magic), and XP with the prime bonus and the title. The
// warden's spells and the level 4 trait are added here for the picture; every name and number is invented.
if (new URLSearchParams(window.location.search).get('full') === '1') {
  const ledger = world.addCampaign('The Fen Ledger', gm);
  world.tables.packs.push({ id: 'pack-fen-full', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-11-05T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const fullEntry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-full-${kind}-${String(data.id)}`, pack_id: 'pack-fen-full', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  const lists: [string, string][] = [['rulesSets', 'rulesSet'], ['races', 'race'], ['hooks', 'hook'], ['fieldTemplates', 'fieldTemplate'], ['spells', 'spell'], ['spellLists', 'spellList'], ['traitLists', 'traitList'], ['items', 'item']];
  for (const [list, kind] of lists) for (const data of fenPack[list] ?? []) fullEntry(kind, data);
  for (const data of fenPack.classes ?? []) {
    if (data.id !== 'lantern-warden') fullEntry('class', data);
    else
      fullEntry('class', {
        ...data,
        abilities: [...((data.abilities as unknown[]) ?? []), { name: 'Beacon call', note: 'Calls every lantern in sight to flare at once.', fromLevel: 4 }],
        spellcasting: { listId: 'witch-list', type: 'book', fromLevel: 1 },
        progression: [
          { level: 1, hitDice: '1d8', attack: 19, saves: { mire: 12 }, spellSlots: [1] },
          { level: 3, hitDice: '3d8', attack: 18, saves: { mire: 11 }, spellSlots: [2, 1] },
        ],
      });
  }
  fullEntry('xpTable', { id: 'warden-xp', name: 'Warden XP', levels: [{ level: 1, xp: 0 }, { level: 2, xp: 1500 }, { level: 3, xp: 3000 }, { level: 4, xp: 6000 }] });
  world.tables.campaign_packs.push({ id: 'campaign-pack-full', campaign_id: ledger, pack_id: 'pack-fen-full', option_choices: {}, overrides: {}, priority: 1 });
  type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; from?: string };
  ((fenPack.fieldTemplates?.[0]?.fields ?? []) as LayoutField[])
    .filter((f) => f.key !== 'hp' && !f.from)
    .forEach((f, order) => {
      const type = f.type === 'list' && !f.choices?.length ? 'text' : f.type;
      world.tables.field_definitions.push({ id: `field-full-${f.key}`, campaign_id: ledger, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: null, created_at: '2026-11-05T12:00:00Z' });
    });
  const tamsin = world.addCharacter(ledger, 'Tamsin Reedwater', { ownerId: sam, approval: 'approved' });
  Object.assign(world.tables.actors.find((a) => a.id === tamsin)!, {
    level: 3,
    hp_current: 14,
    hp_max: 17,
    race_ref: 'bog-folk',
    fields: { MUS: 13, NIM: 12, GRT: 11, WIT: 14, LORE: 9, CHARM: 10, alignment: 'Lantern', languages: 'Reedish, Common', motto: 'Light first, then talk.' },
    classes: [{ classRef: 'lantern-warden', level: 3, xp: 3400 }],
    spell_book: ['glimmer', 'reed-whisper', 'mire-grip', 'damp-wick'],
  });
  world.addMember(ledger, sam, 'player', tamsin);
  world.tables.character_play.push({ actor_id: tamsin, campaign_id: ledger, prepared: [{ spell: 'glimmer', level: 1 }, { spell: 'mire-grip', level: 1 }], uses_spent: { 'Steady flame': 1 }, ac_override: null, form_id: null, version: 1 });
}

// Creation's Gear step on the invented fixture pack (d5-19: the burden's levels as a pop-up there too), only with
// ?gear=1: "The Fen Muster", its load tracked in coins, which Jo (?as=new) has joined with no character yet; guided
// creation reaches Gear after Who they are. As gearStep.test.tsx's world: the layout's fields without the ones other
// steps own.
if (new URLSearchParams(window.location.search).get('gear') === '1') {
  const muster = world.addCampaign('The Fen Muster', gm);
  world.addMember(muster, jo, 'player');
  Object.assign(world.tables.campaigns.find((c) => c.id === muster)!, { settings: { encumbrance: { mode: 'coin' } } });
  world.tables.packs.push({ id: 'pack-fen-gear', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-11-20T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const lists: [string, string][] = [['rulesSets', 'rulesSet'], ['races', 'race'], ['classes', 'class'], ['items', 'item'], ['startingKits', 'startingKit']];
  for (const [list, kind] of lists)
    for (const data of fenPack[list] ?? []) world.tables.library_entries.push({ id: `entry-gear-${kind}-${String(data.id)}`, pack_id: 'pack-fen-gear', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  world.tables.campaign_packs.push({ id: 'campaign-pack-gear', campaign_id: muster, pack_id: 'pack-fen-gear', option_choices: {}, overrides: {}, priority: 1 });
  type GearField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[] };
  ((fenPack.fieldTemplates?.[0]?.fields ?? []) as GearField[])
    .filter((f) => !['background', 'languages', 'hp', 'alignment'].includes(f.key))
    .forEach((f, order) =>
      world.tables.field_definitions.push({ id: `field-gear-${f.key}`, campaign_id: muster, applies_to: 'pc', key: f.key, label: f.label, type: f.type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: false, created_at: '2026-11-20T12:00:00Z' }),
    );
}

// Every step of guided creation on the invented fixture pack (row test-creation-world), only with ?creation=full: "The
// Fen Census", which Jo (?as=new) has joined with no character yet. The whole fixture pack (its spells, tables, trait
// lists, hooks and layout too) with creation-full.fixture.json laid over it (a patron, and a table of odds and ends
// the rules set's given gear picks from: the Gear step's pick sheet), and the options that open the
// rest: Method (each player chooses), Weapon skills (drill on), the stone kin's class limits lifted (so a stone-kin
// Reed Witch has the name table, the trinket and Details beside First spells), and the patron option on. The campaign
// asks for hit points, so Who they are has the hit points row. The fields as the importer makes them (kindredTables.test.tsx);
// the omen left out, its option being off, and the layout's own hit points (the campaign's row stands for them).
if (new URLSearchParams(window.location.search).get('creation') === 'full') {
  const census = world.addCampaign('The Fen Census', gm);
  world.addMember(census, jo, 'player');
  Object.assign(world.tables.campaigns.find((c) => c.id === census)!, { settings: { encumbrance: { mode: 'coin' }, hpRequired: true } });
  world.tables.packs.push({ id: 'pack-fen-full', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-11-24T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const extras = JSON.parse(fullCreationFixture) as Record<string, Record<string, unknown>[]>;
  const lists: [string, string][] = [
    ['rulesSets', 'rulesSet'], ['fieldTemplates', 'fieldTemplate'], ['options', 'option'], ['races', 'race'], ['classes', 'class'], ['spellLists', 'spellList'], ['spells', 'spell'],
    ['tables', 'table'], ['items', 'item'], ['lightTypes', 'lightType'], ['startingKits', 'startingKit'], ['traitLists', 'traitList'], ['hooks', 'hook'], ['patrons', 'patron'],
  ];
  const addRules = (extras.harnessRulesSet ?? {}) as Record<string, unknown>;
  for (const source of [fenPack, extras])
    for (const [list, kind] of lists)
      for (const found of source[list] ?? []) {
        const data = kind === 'rulesSet' ? { ...found, ...addRules } : found;
        world.tables.library_entries.push({ id: `entry-full-${kind}-${String(data.id)}`, pack_id: 'pack-fen-full', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
      }
  world.tables.campaign_packs.push({
    id: 'campaign-pack-full', campaign_id: census, pack_id: 'pack-fen-full', pack_name: 'Fen sample', overrides: {}, priority: 1,
    option_choices: { 'creation-path': 'players-choose', 'fen-weapon-drill': 'on', 'fen-kin-limits': 'lifted', 'fen-patrons': 'on' },
  });
  type FullField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; from?: string };
  ((fenPack.fieldTemplates?.[0]?.fields ?? []) as FullField[])
    .filter((f) => f.key !== 'omen' && f.key !== 'hp')
    .forEach((f, order) => {
      const fromList = f.from && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.from) ? f.from : null;
      const type = f.type === 'list' && !f.choices?.length && !fromList ? 'text' : f.type;
      world.tables.field_definitions.push({ id: `field-full-${f.key}`, campaign_id: census, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: fromList, created_at: '2026-11-24T12:00:00Z' });
    });
}

// The GM's approval card with scores (plan dec-15 row 9, caf-8), only with ?gmWaiting=1: "The Fen Reckoning" on the
// invented fixture pack, where Jo's Tam, a bog folk Lantern Warden, waits for the GM (Priya, ?as=gm). Tam's scores were
// all left at the average (2d8: 9), none rolled; the kindred moved two of them (Nimbleness up one, Grit down one), so
// the record's `rolled` differs from its `scores` there, as guided creation writes it. The layout's fields without hp
// and the omen, as approvalHomebrew.test.tsx's world.
if (new URLSearchParams(window.location.search).get('gmWaiting') === '1') {
  const reckoning = world.addCampaign('The Fen Reckoning', gm);
  world.addMember(reckoning, jo, 'player');
  world.tables.packs.push({ id: 'pack-fen-reckoning', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-11-24T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const lists: [string, string][] = [['rulesSets', 'rulesSet'], ['races', 'race'], ['classes', 'class'], ['items', 'item'], ['startingKits', 'startingKit'], ['fieldTemplates', 'fieldTemplate']];
  for (const [list, kind] of lists)
    for (const data of fenPack[list] ?? []) world.tables.library_entries.push({ id: `entry-reckoning-${kind}-${String(data.id)}`, pack_id: 'pack-fen-reckoning', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  world.tables.campaign_packs.push({ id: 'campaign-pack-reckoning', campaign_id: reckoning, pack_id: 'pack-fen-reckoning', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  type ReckoningField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean };
  ((fenPack.fieldTemplates?.[0]?.fields ?? []) as ReckoningField[])
    .filter((f) => f.key !== 'hp' && f.key !== 'omen')
    .forEach((f, order) => {
      const type = f.type === 'list' && !f.choices?.length ? 'text' : f.type;
      world.tables.field_definitions.push({ id: `field-reckoning-${f.key}`, campaign_id: reckoning, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, created_at: '2026-11-24T12:00:00Z' });
    });
  const tam = world.addCharacter(reckoning, 'Tam', { ownerId: jo, approval: 'pending' });
  Object.assign(world.tables.actors.find((a) => a.id === tam)!, {
    level: 1,
    classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }],
    race_ref: 'bog-folk',
    creation: {
      method: null,
      rolled: { MUS: 9, NIM: 9, GRT: 9, WIT: 9, LORE: 9, CHARM: 9 },
      scores: { MUS: 9, NIM: 10, GRT: 8, WIT: 9, LORE: 9, CHARM: 9 },
      scoresAverage: ['MUS', 'NIM', 'GRT', 'WIT', 'LORE', 'CHARM'],
    },
  });
}

// A place's rules and its own check (December dec-7 piece 3), only with ?placeRules=1: an invented harbour in River
// Rules with an encounter check on each move that stands in, a rule with a button, a plain rule and one the book keeps
// for the GM; an expedition under way with the party at its jetty, the jetty's description shown. Made through the
// app's own commands, as the GM, before the screens start. "Falling into the harbour" has an icon button (pf-12e, dec-7
// piece 2: the set's water-splash, its words its label); "Rowing and swimming" keeps plain words, so the fallback (the
// generic mark with its words) stays in the pictures. ?placeRules=splash leaves out the rowing rule: the icon alone.
const placeRulesFlag = new URLSearchParams(window.location.search).get('placeRules');
if (placeRulesFlag === '1' || placeRulesFlag === 'splash') {
  const harbour = {
    id: 'drowned-harbour',
    name: 'The Drowned Harbour',
    type: 'region',
    playerView: { text: 'A silted harbour of five spots, crossed by boat or by swimming.' },
    encounterCheck: { name: 'Encounters on the water', when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1] } },
    rules: [
      {
        id: 'falling-in',
        name: 'Falling into the harbour',
        button: { icon: 'water-splash', words: 'Someone fell in' },
        text: {
          blocks: [
            { p: 'A character in the harbour’s water is cold at once and in danger within the turn.' },
            { h: 'Each turn in the water' },
            { lead: 'Swimming', p: 'A save, or the character becomes Exhausted.' },
            { table: { title: 'Hauled out', columns: ['By', 'Takes'], rows: [['A rope from the jetty', '1 turn'], ['A boat alongside', 'At once']] } },
            { source: 'From your adventure: The Reed Marches, p. 40.' },
          ],
        },
      },
      // A second rule with a long button (rp-10's layout check: two buttons in a row that wraps, a long one inside a phone).
      ...(placeRulesFlag === 'splash' ? [] : [{ id: 'rowing', name: 'Rowing and swimming', button: 'Someone is swimming for the breakwater at the turn of the tide', text: 'A boat crosses between two spots in a turn; a swimmer takes three.' }]),
      { id: 'tidewife-bargain', name: 'What the Tidewife’s bargain costs', gmOnly: true, text: 'A name, given freely, and never asked back.' },
    ],
  };
  const jetty = { id: 'the-jetty', name: '1 The jetty', type: 'site', parentId: 'drowned-harbour', playerView: { text: 'Black piles, a mooring ring, weed to the waterline.' } };
  for (const data of [harbour, jetty]) world.tables.library_entries.push({ id: `entry-${data.id}`, pack_id: 'pack-river', kind: 'location', pack_entry_id: data.id, name: data.name, data });
  const { runCommand } = await import('../core/commands.ts');
  const { createAppRegistry } = await import('../app/commandRegistry.ts');
  const { loadGroupPlaces, setPlace, showPiece } = await import('../modules/expedition/placePlay.ts');
  const registry = createAppRegistry();
  const asGm = { id: gm, roles: { [campaign]: 'gm' as const } };
  world.signInAs(gm);
  const started = (await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never)) as unknown as { data: { id: string } | null };
  await runCommand(registry, world.db, asGm, setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: 'pack-river', packEntryId: 'the-jetty', name: jetty.name, data: jetty } });
  const row = started.data ? (await loadGroupPlaces(world.db, campaign, started.data.id))?.get(1) : undefined;
  if (row?.pieces[0]) await runCommand(registry, world.db, asGm, showPiece, { campaignId: campaign, row, piece: row.pieces[0] });
  // The GM closing "Falling into the harbour" while a player's page is open (rp-8's picture): the switch as the GM,
  // then back to whoever the page is signed in as. Test page only.
  const { setRuleEye } = await import('../modules/expedition/placeRules.ts');
  (window as unknown as { __closeFallingIn: () => Promise<void> }).__closeFallingIn = async () => {
    const back = new URLSearchParams(window.location.search).get('as');
    world.signInAs(gm);
    await runCommand(registry, world.db, asGm, setRuleEye, { campaignId: campaign, packId: 'pack-river', entryId: 'drowned-harbour', ruleId: 'falling-in', open: false });
    if (back === 'player') world.signInAs(sam);
  };
}

// A town's GM sections set out like the book (pf-18b; page 22, approved 2026-11-18), only with ?townSections=1: an
// invented river town in River Rules whose GM sections are written five ways: in blocks (a sub-heading, a list with one
// very long item, a bold lead-in, a paragraph), a box with no title holding a numbered list, a plain string, blocks the
// app can't read, and an empty one. An expedition under way with the party in the town, set as the GM through the app's own command.
const townSectionsFlag = new URLSearchParams(window.location.search).get('townSections');
if (townSectionsFlag === '1') {
  const reedmouth = {
    id: 'reedmouth',
    name: 'Reedmouth',
    type: 'site',
    identity: 'A river town of reed-cutters and ferrymen, held by the Heron Wardens.',
    settlement: { size: 'town' },
    playerView: { text: 'Tarred roofs on stilts over the river mouth.' },
    gm: {
      sections: [
        {
          heading: 'The Eel and Lantern',
          text: {
            blocks: [
              { h: 'What the house offers' },
              {
                list: [
                  'Hot eel stew all day, two coppers a bowl.',
                  'A dry loft over the stables for anyone short of coin.',
                  'A message board by the door; the keeper reads it aloud at dusk.',
                  'A boat to hire, with or without a ferryman who keeps quiet, by the hour or the tide, with a lantern for the night crossing and a second oar for anyone who insists on rowing themselves.',
                ],
              },
              { lead: 'The keeper', text: 'Old Marrow remembers every face and forgets every name, on purpose.' },
              { p: 'Anyone asking after the [[npc:heron-wardens|Heron Wardens]] is pointed, politely, to the quay.' },
            ],
          },
        },
        {
          heading: 'The ferry families',
          text: {
            blocks: [
              {
                box: [
                  { p: 'The two ferry families have not spoken in three generations. Each says the other sank the first ferry, and each keeps a splinter of it to prove so.' },
                  { lead: 'The rule', text: 'Insults on the landing, never on the water: a fight in a boat would end both families’ trade.' },
                  { lead: 'When it flares', text: 'Roll a d4, or pick one.' },
                  { list: ['Each family rings its bell at the other’s landing at dawn.', 'A boat is found painted in the other family’s colours.', 'Both families send the Wardens a gift on the same day.', 'A wedding is proposed between them, and both sides object, loudly.'], numbered: true },
                ],
              },
            ],
          },
        },
        { heading: 'A brewing trouble', text: 'Halewyn owes the ferrymen a season’s pay and has begun to avoid the quay.\nIf the party lodges at the Eel and Lantern, someone asks them to carry a letter to the Wardens’ Hall.' },
        { heading: 'Older notes', text: { blocks: [{ words: 'a block the app cannot read' }] } },
        // Empty (Francis, 2026-11-18): its heading, and nothing under it when opened.
        { heading: 'Still to write', text: '' },
      ],
    },
  };
  world.tables.library_entries.push({ id: 'entry-reedmouth', pack_id: 'pack-river', kind: 'location', pack_entry_id: reedmouth.id, name: reedmouth.name, data: reedmouth });
  const { runCommand } = await import('../core/commands.ts');
  const { createAppRegistry } = await import('../app/commandRegistry.ts');
  const { setPlace } = await import('../modules/expedition/placePlay.ts');
  world.signInAs(gm);
  await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never);
  await runCommand(createAppRegistry(), world.db, { id: gm, roles: { [campaign]: 'gm' as const } }, setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: 'pack-river', packEntryId: reedmouth.id, name: reedmouth.name, data: reedmouth } });
}

// Calls to adventure for the GM (dec-12 piece B), only with ?calls=…: an expedition under way with the party at
// Saltreach (a typed place), and invented adventures attached with their hooks, as the importer keeps them. Made
// through the app's own commands, as the GM, before the screens start.
//   ?calls=1     one adventure, "The Eel Weirs", four hooks, the first sent to the party (its row says so);
//   ?calls=many  that and two more: "The Lantern Barrow" (its one hook sent: "All sent") and one with a very long name;
//   ?calls=long  one adventure, and a second player's character with a very long name (the character list, SC-1).
// With every flag the character list has Wren (Sam's character in play); ?calls=long adds Jo's.
// Rumours (dec-12 piece E), with every flag: "The Eel Weirs" has a rumours table of eight rows (d8, a very long one,
// True, False and Partly), its first given to the party (its row says "Heard by the party").
const callsFlag = new URLSearchParams(window.location.search).get('calls');
if (callsFlag === '1' || callsFlag === 'many' || callsFlag === 'long') {
  const adventure = (packId: string, name: string, priority: number, hooks: { id: string; name: string; text: string; pays: string; giver?: { name: string; role: string; place: string } }[]) => {
    world.tables.packs.push({ id: packId, owner_user_id: gm, campaign_id: null, name, version: '0.1', kind: 'adventure', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-11-13T12:00:00Z', extra_meta: {} });
    world.tables.campaign_packs.push({ id: `campaign-pack-${packId}`, campaign_id: campaign, pack_id: packId, option_choices: {}, overrides: {}, priority });
    hooks.forEach((h, order) =>
      world.tables.library_entries.push({ id: `entry-${packId}-${h.id}`, pack_id: packId, kind: 'adventureHook', pack_entry_id: h.id, name: h.name, data: { text: h.text, pays: h.pays, giver: h.giver ?? null, order } }),
    );
  };
  adventure('pack-eel-weirs', 'The Eel Weirs', 10, [
    { id: 'quay-notice', name: 'The quay-reeve’s notice', text: 'Nailed to the quay post: the reeve wants the drowned ferry’s ledger back before the spring tide.', pays: '40 crowns for the ledger' },
    {
      id: 'debt',
      name: 'A debt come due',
      text: 'The sluice-keeper has waited two winters. She will wait no longer, she says, unless someone brings back what lies in the weir house.\nShe names no sum. She does not need to.',
      pays: 'Nothing; clears what Wren owes',
      giver: { name: 'Marda Coyle', role: 'sluice-keeper', place: '3 The Weir Market' },
    },
    { id: 'eel-wife', name: 'The eel-wife’s bargain', text: 'A favour, once, for the eel-wife’s lost net.', pays: 'A favour, once', giver: { name: 'the eel-wife', role: '', place: '2 The Wreck' } },
    { id: 'salvage', name: 'Salvage rights', text: 'Whatever is raised from the weir pool, a third is yours.', pays: 'A third of what is raised', giver: { name: 'Reeve Halbrook', role: 'quay-reeve', place: '2 Reeve’s Hall' } },
  ]);
  world.tables.library_entries.push({
    id: 'entry-pack-eel-weirs-rumours',
    pack_id: 'pack-eel-weirs',
    kind: 'table',
    pack_entry_id: 'weirs-rumours',
    name: 'What they say in Saltreach',
    data: {
      uses: ['world.rumours'],
      die: 'd8',
      rows: [
        ['The ferry went down with her reeve still aboard.', 'true'],
        ['The customs men left because of what they saw on the bar.', 'false'],
        ['There is a light in the weir house some nights.', 'true'],
        ['The eel-wife drowns anyone who rows at slack water.', 'partial'],
        ['A very long rumour that someone’s cousin swears to, about the bell under the water and the night the ferryman drowned, and every such night since, whatever the priest says.', 'false'],
        ['Eels in the well.', 'false'],
        ['The reeve sold the sluice keys.', 'partial'],
        ['Nobody has crossed the bar since the storm.', 'true'],
      ].map(([result, truth], n) => ({ min: n + 1, max: n + 1, result, truth })),
    },
  });
  if (callsFlag === 'many') {
    adventure('pack-lantern-barrow', 'The Lantern Barrow', 11, [{ id: 'barrow-bell', name: 'The barrow bell', text: 'A bell rings under the hill at dusk.', pays: '' }]);
    adventure('pack-long-drowning', 'The Long Drowning of the Nine Bells at Saltwick Stair, being the second part', 12, [
      { id: 'stair-1', name: 'The first bell', text: 'It rings at low water.', pays: '' },
      { id: 'stair-2', name: 'The second bell', text: 'It rings at high water.', pays: '' },
    ]);
  }
  if (callsFlag === 'long') {
    const long = world.addCharacter(campaign, 'Bartholomew Underbough-Fenwick, Keeper of the Seventh Sluice-Gate of Saltwick Stair', { ownerId: jo, approval: 'approved' });
    world.tables.members.find((m) => m.campaign_id === campaign && m.user_id === jo)!.active_actor_id = long;
  }
  const { runCommand } = await import('../core/commands.ts');
  const { createAppRegistry } = await import('../app/commandRegistry.ts');
  const { setPlace } = await import('../modules/expedition/placePlay.ts');
  const { sendHook } = await import('../modules/library/callsToAdventure.ts');
  const { giveRumour } = await import('../modules/library/rumours.ts');
  const registry = createAppRegistry();
  const asGm = { id: gm, roles: { [campaign]: 'gm' as const } };
  world.signInAs(gm);
  await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never);
  await runCommand(registry, world.db, asGm, setPlace, { campaignId: campaign, group: 1, name: 'Saltreach', placeId: null, packEntry: null });
  await runCommand(registry, world.db, asGm, sendHook, { campaignId: campaign, packId: 'pack-eel-weirs', hookId: 'quay-notice', actorId: null, body: 'Nailed to the quay post: the reeve wants the drowned ferry’s ledger back before the spring tide.', pays: '40 crowns for the ledger' });
  await runCommand(registry, world.db, asGm, giveRumour, { campaignId: campaign, packId: 'pack-eel-weirs', tableId: 'weirs-rumours', min: 1, max: 1, actorId: null });
  if (callsFlag === 'many') await runCommand(registry, world.db, asGm, sendHook, { campaignId: campaign, packId: 'pack-lantern-barrow', hookId: 'barrow-bell', actorId: null, body: 'A bell rings under the hill at dusk.', pays: '' });
}

// The shared P1-like character (plan dec-13; layoutP1Character.ts), only with ?p1=1: its own campaign, Sam playing.
// ?p1=messy: a long name and title, nine statuses; ?p1=two: two statuses; ?p1=noline: no roll for scores; ?p1=classless:
// no class, the GM's card line in the head (the head's checks, dec-13 C2); ?p1=heavy: 999 bundles of reeds, over the
// most (movement and load, dec-13 C10); ?p1=modes: a bow with its quiver, a long-named axe with its grip and a wand
// with charges pinned to At hand (the stacked buttons, dec-13 C6); ?p1=weapon: a long-named weapon in hand, melee and
// missile, with a Grip (C14); ?p1=bare: nothing at hand, 0 hit points, a long title; ?p1=packless: no pack, 999 of 999
// (the screen's states, C11); ?p1=skills: a roll for skills and three more skills (rows C13, C14 of plan
// test-feedback-2026-11-19); ?p1=finish: the languages left for "To finish" and a change waiting for the GM, two notices
// in the notices box (row C1); ?p1=pins: an ability and a trait pinned, a row and a block in the right column's list
// (row P3 of plan test-feedback-2026-11-19; page 28); ?p1=unlit|several|burnt|burntnone|longlight: the light's states
// (plan light-tap, page 35).
const p1Flag = new URLSearchParams(window.location.search).get('p1');
if (p1Flag === '1' || p1Flag === 'messy' || p1Flag === 'two' || p1Flag === 'noline' || p1Flag === 'classless' || p1Flag === 'heavy' || p1Flag === 'modes' || p1Flag === 'weapon' || p1Flag === 'bare' || p1Flag === 'packless' || p1Flag === 'skills' || p1Flag === 'finish' || p1Flag === 'pins' || p1Flag === 'unlit' || p1Flag === 'several' || p1Flag === 'burnt' || p1Flag === 'burntnone' || p1Flag === 'longlight') {
  const { addP1Character } = await import('./layoutP1Character.ts');
  const p1Id = await addP1Character(world, { gm, sam, fenPack, head: p1Flag === '1' ? 'four' : p1Flag });
  // ?maxhp=none: no most hit points recorded, so the vitals offer "Set max" (N24) and its Max hit points pop-up (fb-7).
  if (new URLSearchParams(window.location.search).get('maxhp') === 'none') Object.assign(world.tables.actors.find((a) => a.id === p1Id)!, { hp_max: null });
  // &light=error: the character's own light can't be read (⚑ 6 of plan light-tap, B; page 37, 37C), as when offline.
  if (new URLSearchParams(window.location.search).get('light') === 'error') {
    const stand = world.db as unknown as { from: (table: string) => unknown };
    const read = stand.from.bind(world.db);
    stand.from = (table: string) => {
      const query = read(table) as { select: (c: string) => { eq: (col: string, v: unknown) => unknown } };
      if (table !== 'character_lights') return query;
      const select = query.select.bind(query);
      query.select = (c: string) => {
        const q = select(c);
        const eq = q.eq.bind(q);
        q.eq = (col: string, v: unknown) => (col === 'actor_id' ? { maybeSingle: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) } : eq(col, v));
        return q;
      };
      return query;
    };
  }
}

// The GM's place page (dec-7 piece 5b, page 11), only with ?placePage=…: an invented adventure, "The Reed Marches",
// with a harbour that holds five spots, its own check (in place of the setting's) and a rule with an icon button, made
// through the app's own commands as the GM before the screens start.
//   ?placePage=spots  the party at the harbour (frames 1a and 2a: no map), two of its pieces shown;
//   ?placePage=spot   the party at the jetty, inside it (frame 1b), the jetty with a table of its own, nothing shown
//                     (frame 5's sentences);
//   ?placePage=hand   the party at a place typed by hand (frame 2b, left);
//   ?placePage=none   an expedition with no place yet (frame 2b, right).
//   &map=wanted|added|shown with spots or spot: the pack's map for the harbour, not added yet, added, or added and shown
//               to the players (S13; the players' map, P5; see below).
//   &picture=1 with spots or spot: the place has a picture (TW13: the picture row, a tap opening it); with &ways=… too,
//               shown to the players (the Location's card's small picture button, ppf-6 c).
//   &ids=1  with spot: the jetty's pieces name the pack's entries by id (Q7: the GM's small line names them).
//   &mapTitle=long  with &map: the map's title long (the card's title on its own line above the tools).
//   &session=running|paused  the band's session states (S9; see below).
//   &check=none  the harbour without its own encounter check (the facts row's one fact, Light; see the harbour).
//   &strip=long  the harbour's own procedure of seven long-named steps (S7; see the harbour).
//   &strip=words  the harbour's own procedure of seven steps, one named in two words and one in a single 14-letter word
//                (scene-test-small-fixes: a label wraps between words only; see the harbour).
//   &name=long|word  the harbour's name at length, or with one over-long word (the place card's head, 5b's round).
//   &kinds=p2p  the places typed as p2p-1 names them (an Area holding Locations), for the trail's panel (B2; see below).
//   ?placePage=wreck  the party at the wreck (B15, page 30, HM1 to HM5; approved 2026-11-20): a hoard with its own words
//                (the Strongbox, as page 30 draws it: 240 herons, moon opals ×2, swords ×4, daggers ×5 and a hooded
//                lantern) and the lantern's truth as a piece of its own (Lantern of the Drowned); the description shown,
//                nothing else, nothing sent (HM1; a tap on the Strongbox opens HM2's sheet).
//   &b15=sent    with wreck: the GM has sent the hoard, the herons, the opals and the lantern to Wren, the swords to Ash,
//                the daggers to the party stash (the card's "✓ All sent: …", HM5's sheet; the lantern's eye still
//                closed, for HM3's tap).
//   &b15=shown   with wreck: sent, and the GM's eye on the lantern's piece has named Wren's lantern (HM3's card; with
//                ?as=player, HM4: Wren's Pack and the item's sheet read "Lantern of the Drowned").
const placePageFlag = new URLSearchParams(window.location.search).get('placePage');
// The jetty's own book text for the GM (gt-1, page 15 BT1; the whole Scene's S14): paragraphs, a list, a boxed aside.
const JETTY_BOOK_TEXT = {
  blocks: [
    { p: 'The ferrymen moor here and nowhere else, and they notice who does not. Anyone who ties up on the windward side is a stranger, and by nightfall every ferryman on the water knows it.' },
    { p: 'Three things on the jetty are worth a look:' },
    {
      list: [
        'The fourth mooring ring is new iron; the other three are green. Someone replaced it this month.',
        'The planks of the seaward half are nailed, not pegged: a hurried job, and it gives a hand’s breadth under a loaded cart.',
        'Under the third plank from the landward end is a tarred box.',
      ],
    },
    { box: [{ p: 'They say the old one “went into the water with a boat on it”, and no more than that for less than a week’s wages.' }], title: 'If the party asks the ferrymen about the ring.' },
    { p: 'At low water the mud under the piles will bear a person for about as long as it takes to say a prayer.' },
  ],
};
if (placePageFlag === 'spots' || placePageFlag === 'spot' || placePageFlag === 'hand' || placePageFlag === 'none' || placePageFlag === 'wreck') {
  world.tables.packs.push({ id: 'pack-reed', owner_user_id: gm, campaign_id: null, name: 'The Reed Marches', version: '0.1', kind: 'adventure', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-11-14T12:00:00Z', extra_meta: {} });
  world.tables.campaign_packs.push({ id: 'campaign-pack-reed', campaign_id: campaign, pack_id: 'pack-reed', pack_name: 'The Reed Marches', option_choices: {}, overrides: {}, priority: 5 });
  // &name=long: the harbour named at length (frame 6's messy data); &name=word: one word longer than the name's column.
  const nameFlag = new URLSearchParams(window.location.search).get('name');
  const harbourName =
    nameFlag === 'long'
      ? 'The Long Stair of the Drowned Customs House below the Old Lantern, seaward side'
      : nameFlag === 'word'
        ? 'Saltmarshwatchtowerstairs of Fenwick'
        : 'The Drowned Harbour';
  // &kinds=p2p (plan scene-point-to-point B2; p2p-1): the places typed as the rulings name them, the island a Region,
  // the harbour an Area (`site`) and its spots Locations (`area`), with a sixth Location named at length (LA2's messy
  // data), so the trail's Locations panel and reading ahead can be drawn. Without it the harbour stays a Region.
  const p2pKinds = new URLSearchParams(window.location.search).get('kinds') === 'p2p';
  const harbour = {
    id: 'drowned-harbour',
    name: harbourName,
    type: p2pKinds ? 'site' : 'region',
    parentId: 'saltwick-island',
    identity: 'A silted harbour of five spots, crossed by boat or by swimming.',
    playerView: {
      text: 'A silted harbour: black water, a dry bar, a mast that shows at every tide.',
      people: [{ description: 'A ferryman watches from the far bank.' }],
    },
    hazards: [{ name: 'The bar’s mud', appearance: 'The bar’s mud takes a boot to the knee.', trigger: 'a save, or stuck' }],
    facts: [{ lead: 'Tides', text: 'Two a day; the bar dries at low water.' }],
    gm: { sections: [{ heading: 'The Tidewife', text: 'She keeps her word to the letter, and expects the same.' }], notes: 'The Tidewife keeps her word to the letter.' },
    // The pack's own sentence for its check (p2p-14; B3), shown on the place page's check card. &check=none: the harbour
    // has no check of its own, so the Scene's facts row draws Light alone (Q4's one fact; the review of #110).
    ...(new URLSearchParams(window.location.search).get('check') === 'none'
      ? {}
      : { encounterCheck: { name: 'Encounter check', when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1] }, note: 'Roll d6 for an encounter each time the party rows to a new Location.' } }),
    rules: [{ id: 'falling-in', name: 'Falling into the harbour', button: { icon: 'water-splash', words: 'Someone fell in' }, text: 'A character in the harbour’s water is cold at once.' }],
    tableIds: ['tide-left', 'on-the-water'],
    // &strip=long (plan dec-9-the-whole-scene S7; page 02, S5): the harbour's own procedure, seven steps with long
    // names, two with text (taps), one with no icon the app knows (its number). Without it the strip shows the
    // procedure the setting gives, else the app's own five.
    // &strip=words (scene-test-small-fixes): seven steps, one named in two words ("Wandering monsters", a tap) and one
    // in a single 14-letter word, so the checks can tell a label wrapped between words from one broken inside a word.
    ...(new URLSearchParams(window.location.search).get('strip') === 'words'
      ? {
          procedure: [
            { id: 'describe', name: 'Describe', icon: 'trumpet-flag' },
            { id: 'wander', name: 'Wandering monsters', icon: 'monster', text: 'Something is abroad in the dark: roll where the tide table says.' },
            { id: 'lantern', name: 'Lanternkeeping', icon: 'hourglass' },
            { id: 'question', name: 'Question', icon: 'crystal-ball' },
            { id: 'act', name: 'Act', icon: 'listen' },
            { id: 'tide', name: 'Reckon the tide', icon: 'water-splash' },
            { id: 'resolve', name: 'Resolve', icon: 'locked-chest' },
          ],
        }
      : {}),
    ...(new URLSearchParams(window.location.search).get('strip') === 'long'
      ? {
          procedure: [
            { id: 'look', name: 'Look across the water', icon: 'crystal-ball' },
            { id: 'moor', name: 'Moor or cast off', icon: 'water-splash', text: { blocks: [{ p: 'Tie off at the posts; a boat left loose drifts to the bar by the next turn.' }] } },
            { id: 'listen', name: 'Listen for the bell buoy', icon: 'listen' },
            { id: 'wade', name: 'Wade the shallows', icon: 'not-an-icon' },
            { id: 'tide', name: 'Reckon the tide', icon: 'hourglass', text: 'The water rises at dusk and falls at dawn.' },
            { id: 'call', name: 'Call to the ferryman', icon: 'trumpet-flag' },
            { id: 'count', name: 'Count heads', icon: 'locked-chest' },
          ],
        }
      : {}),
  };
  const island = { id: 'saltwick-island', name: 'Saltwick Island', type: 'region' };
  const spots = [
    // Two aspects led by their own words, which the description names ("mooring ring", "weed": marked on the GM's card, B3).
    { id: 'the-jetty', key: '1', name: 'The jetty', identity: 'Where the bog road gives out.', source: 'p. 38', playerView: { text: 'Black piles, a mooring ring, weed to the waterline.', aspects: [{ lead: 'Mooring ring', text: 'Green copper; the fourth ring along is new iron, set this month.' }, { lead: 'Weed', text: 'Bladderwrack, cut back hard on the seaward side.' }], exits: [{ text: 'A ladder down to a tarred skiff.' }] }, treasure: [{ text: 'A green copper chest, wedged under the planks.', value: '40 herons' }], tableIds: ['tide-left'], gm: { text: JETTY_BOOK_TEXT } },
    { id: 'the-wreck', key: '2', name: 'The wreck', identity: 'A cog on her side on the bar, decks awash.' },
    {
      id: 'the-breakwater',
      key: '3',
      name: 'The breakwater',
      identity: 'A drowned wall with a gap a boat can thread.',
      // Read ahead with &kinds=p2p (B2, LA3): its own pieces.
      ...(p2pKinds ? { playerView: { text: 'A drowned wall of fitted stone, awash at high water; a boat can thread the gap at its middle.', aspects: [{ lead: 'Gap', text: 'Two oars wide. The tide runs hard through it on the ebb.' }, { lead: 'Iron rings', text: 'Six of them; the fourth is new iron.' }] } } : {}),
    },
    { id: 'customs-shed', key: '4', name: 'The customs shed', identity: 'Stilted, shuttered, a light some nights.' },
    { id: 'sea-cave', key: '5', name: 'The sea cave', identity: 'Only at low water, and only through the gap.' },
    ...(p2pKinds
      ? [
          {
            id: 'landing-stage',
            key: '9',
            name: 'The Harbourmaster’s Landing Stage below the Old Lantern Tower, Seaward Side',
            identity: 'Worn steps down into the water, a bell rope hanging, and a smell of tar that the wind does not shift.',
          },
        ]
      : []),
  ].map((s) => ({ ...s, type: p2pKinds ? 'area' : 'site', parentId: 'drowned-harbour' }));
  // &ids=1 with spot (plan dec-scene-quickfix Q7): the jetty's pieces name the pack's entries by id (an item beside a
  // value, an item alone with a long name, a creature with a count and a note, a character, and an id no pack has), so
  // the GM's small line can be seen naming them. Invented.
  if (new URLSearchParams(window.location.search).get('ids') === '1') {
    Object.assign(spots[0]!, {
      treasure: [
        { text: 'A green copper chest, wedged under the planks.', value: { herons: 40 }, itemId: 'reed-silver-arrows' },
        { text: 'A long oilcloth bundle lashed to a pile.', itemId: 'reed-lantern-pole' },
        { text: 'A pouch of something that clinks.', value: { sp: 3 }, itemId: 'reed-no-such-thing' },
      ],
      contents: [{ statBlockId: 'reed-bog-lurker', count: 6, note: 'asleep under the planks', appearance: 'Six humps in the mud, breathing.' }],
      playerView: { ...spots[0]!.playerView, people: [{ description: 'A ferryman mends a net on the end post.', npcId: 'reed-npc-oswy' }] },
    });
    for (const [kind, id, name] of [
      ['item', 'reed-silver-arrows', 'Silver-tipped arrows'],
      ['item', 'reed-lantern-pole', 'Lantern Warden’s hooked pole of the drowned customs house, with its spare wick'],
      ['statBlock', 'reed-bog-lurker', 'Bog lurker'],
      ['npc', 'reed-npc-oswy', 'Oswy the ferryman'],
    ] as const) world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-reed', kind, pack_entry_id: id, name, data: { id, name } });
  }
  // ?placePage=wreck (B15, page 30): the wreck's hoard in the book's words, its things with their counts (b15f-1), and a
  // magic item's truth (b15f-2 to b15f-4: a name, what it does, what the senses tell; no source). Invented.
  if (placePageFlag === 'wreck') {
    Object.assign(spots[1]!, {
      // Named as page 30 draws it, "2. The Wreck" (impeccable audit 7); the other place pages keep "The wreck".
      name: 'The Wreck',
      playerView: {
        text: 'A cog on her side on the bar, decks awash, her mast showing at every tide. In the stern cabin a strongbox is jammed under the fallen beams.',
        aspects: [{ lead: 'Mast', text: 'Gulls quarrel on it; they lift off whenever something moves below.' }],
      },
      hoards: [{ name: 'Strongbox', text: '240 herons, two moon opals, nine swords and daggers and a hooded lantern, under a rotted sailcloth.' }],
      treasure: [
        { text: '240 herons', coins: { heron: 240 }, hoard: 'Strongbox' },
        { text: 'Moon opals', qty: 2, hoard: 'Strongbox' },
        { text: 'Swords', qty: 4, hoard: 'Strongbox' },
        { text: 'Daggers', qty: 5, hoard: 'Strongbox' },
        {
          text: 'Hooded lantern',
          hoard: 'Strongbox',
          magicItem: {
            name: 'Lantern of the Drowned',
            text: 'Lit, it burns no oil and shows whatever lies under water within ten paces, as plainly as if the water were air. The drowned can see its bearer from as far.',
            noticed: 'Cold to the touch; the glass smells of the sea.',
          },
        },
      ],
    });
    // The setting's herons, so the hoard's coin is a row like any other (pf-6) that can be sent.
    const rules = world.tables.library_entries.find((e) => e.id === 'entry-river-rules')!.data as Record<string, unknown>;
    if (!Array.isArray(rules.currency)) rules.currency = [{ key: 'heron', label: 'herons', valueInBase: 1 }];
  }
  for (const data of [island, harbour, ...spots]) world.tables.library_entries.push({ id: `entry-reed-${data.id}`, pack_id: 'pack-reed', kind: 'location', pack_entry_id: data.id, name: data.name, data });
  for (const t of [
    { id: 'tide-left', name: 'What the tide left', die: 'd6', rows: [{ min: 1, max: 6, result: 'A drowned lantern' }] },
    { id: 'on-the-water', name: 'On the water', die: 'd8', description: 'The harbour’s encounters.', rows: [{ min: 1, max: 8, result: 'Bog lurkers' }] },
  ])
    world.tables.library_entries.push({ id: `entry-reed-${t.id}`, pack_id: 'pack-reed', kind: 'table', pack_entry_id: t.id, name: t.name, data: t });
  const { runCommand } = await import('../core/commands.ts');
  const { createAppRegistry } = await import('../app/commandRegistry.ts');
  const { loadGroupPlaces, setPlace, showPiece } = await import('../modules/expedition/placePlay.ts');
  const registry = createAppRegistry();
  const asGm = { id: gm, roles: { [campaign]: 'gm' as const } };
  world.signInAs(gm);
  // The band's session states (plan dec-9-the-whole-scene S9, page 16 T1 and T3b): &session=running starts a session
  // before the expedition; &session=paused ends it again. Without it, no session has been played ("No session yet").
  // &daylight=1 (the whole Scene's S16; page 16, T8a): the setting gives daylight from 06:00 to 18:00 and the clock
  // stands at 16:00 on day 1, so the band's date line carries what is left of the light ("2 hours of light left.").
  if (new URLSearchParams(window.location.search).get('daylight') === '1') {
    world.tables.library_entries.push({ id: 'entry-fen-daylight', pack_id: 'pack-fen', kind: 'rulesSet', pack_entry_id: 'fen-daylight', name: 'Fen daylight', data: { id: 'fen-daylight', name: 'Fen daylight', daylight: { sunrise: '06:00', sunset: '18:00' } } });
    world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds = 16 * HOUR;
    // The date line's light is the sun's (the setting's daylight and the clock); the Light fact is the party's own,
    // and a turn mode is dark with nobody's light lit. So the party carries a lit torch here: without one the band said
    // "2 hours of light left." beside "No light" (the approval's fix 1, 2026-11-18: the fixture, not the readers).
    world.tables.inventory_lines.push({ id: 'line-daylight-torch', campaign_id: campaign, actor_id: ash, location_id: null, name: 'Torches', category: 'light', qty: 3, stack: 10, approval: 'approved', item_data: { lightTypeId: 'torch' }, source_entry_id: null, version: 1 });
    await world.db.rpc('light_light' as never, { actor: ash, line: 'line-daylight-torch', light_type: 'torch', light_name: 'Torch', burn_seconds: 3600, warn_seconds: 600, consumed: true, fuel_item: null } as never);
  }
  // &activities=1 (P6 of plan dec-9-the-players-scene; mc-45a; 01-08, 01-08j): the setting's common player actions,
  // three with rule text (the last in two paragraphs, with a source) and one without, which is not listed.
  // &activities=long: a fourth with a name longer than a phone's card, to wrap inside its button.
  // &activities=blocks (d5-16; 01-08j): as =1, with Force a door's rule set out in pf-18's blocks as 01-08j draws it.
  const activitiesFlag = new URLSearchParams(window.location.search).get('activities');
  if (activitiesFlag === '1' || activitiesFlag === 'long' || activitiesFlag === 'blocks') {
    const forceInBlocks = {
      blocks: [
        { p: 'A stuck or barred door may be forced by one character at a time.' },
        { p: 'Roll a d6: the door opens on a 1 or a 2.' },
        { table: { title: 'Modifiers', columns: ['When', 'The door opens on'], rows: [['With a crowbar', '1 to 3'], ['A second character helps', '1 to 3'], ['An iron-bound door', '1 only']] } },
        { lead: 'Time and noise', text: 'Each try takes a turn and is loud.' },
      ],
    };
    const playerActions = [
      { id: 'search', name: 'Search', group: 'Searching', text: 'One character searches a part of the room for a turn.' },
      { id: 'listen', name: 'Listen', group: 'Doors', text: 'Hold still at a door and listen for what is behind it.' },
      { id: 'shout', name: 'Shout', group: 'Noise' },
      { id: 'force', name: 'Force a door', group: 'Doors', text: activitiesFlag === 'blocks' ? forceInBlocks : 'A stuck or barred door may be forced by one character at a time.\n\nEach try takes a turn and is loud.', source: 'Fen Rules, p. 88' },
      ...(activitiesFlag === 'long' ? [{ id: 'long', name: 'Listen at the iron-bound door of the Drowned Customs House', group: 'Doors', text: 'As Listen, but the iron muffles it.' }] : []),
    ];
    world.tables.library_entries.push({ id: 'entry-fen-actions', pack_id: 'pack-fen', kind: 'rulesSet', pack_entry_id: 'fen-actions', name: 'Fen actions', data: { id: 'fen-actions', name: 'Fen actions', exploration: { playerActions } } });
  }
  const sessionFlag = new URLSearchParams(window.location.search).get('session');
  if (sessionFlag === 'running' || sessionFlag === 'paused') {
    const session = (await world.db.rpc('start_session' as never, { campaign } as never)) as unknown as { data: { id: string; version: number } | null };
    if (sessionFlag === 'paused' && session.data) await world.db.rpc('end_session' as never, { session: session.data.id, seen_version: session.data.version } as never);
  }
  // &party=five (S12, the marching order as circles): five in the party, in two ranks; Ash's statuses as above, Tam
  // Exhausted ×2, Pell's hit points not set (— of 9), and Wren the caller (the campaign's settings, clr-1).
  if (new URLSearchParams(window.location.search).get('party') === 'five') {
    const more = [
      ['Tam', 11, 11],
      ['Bram the Lamplighter of the Lower Sluices', 4, 14],
      ['Pell', null, 9],
    ] as const;
    const ids = more.map(([name, now, most]) => {
      const id = world.addCharacter(campaign, name, { ownerId: jo, approval: 'approved' });
      Object.assign(world.tables.actors.find((a) => a.id === id)!, { hp_current: now, hp_max: most });
      return id;
    });
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { hp_current: 6, hp_max: 8 });
    Object.assign(world.tables.actors.find((a) => a.id === ash)!, { hp_current: 9, hp_max: 12 });
    // Tam's status carries a symbol of the approved set (T10 draws Exhausted with the stone); Ash's typed ones have none,
    // so they show the Status ring's letter fallback.
    status('status-tam', { actor_id: ids[0], name: 'Exhausted', icon: 'stone', stacks: 2, stacking: true });
    world.tables.marching_orders.push({ id: 'marching-five', campaign_id: campaign, group_number: 1, rows: [[ash, wren], [ids[0]!, ids[1]!, ids[2]!]], presets: [], last_preset: null, locked: false, version: 1 });
    const row = world.tables.campaigns.find((c) => c.id === campaign)!;
    row.settings = { ...((row.settings as Record<string, unknown> | null) ?? {}), caller: wren };
    // Wren carries a lit rushlight: the ring, the halo, the badge and "One light lit" show.
    world.tables.inventory_lines.push({ id: 'line-five-rush', campaign_id: campaign, actor_id: wren, location_id: null, name: 'Rushlights', category: 'light', qty: 2, stack: 10, approval: 'approved', item_data: { lightTypeId: 'rushlight' }, source_entry_id: null, version: 1 });
    await world.db.rpc('light_light' as never, { actor: wren, line: 'line-five-rush', light_type: 'rushlight', light_name: 'Rushlight', burn_seconds: 3600, warn_seconds: 600, consumed: true, fuel_item: null } as never);
  }
  // &party=eight (P8 of plan dec-9-the-players-scene; page 18, PL10's messy data): eight in four ranks of two, a long
  // name, 0 of 12, 40 of 40, and 999 of 999 (the bar PL10's lead found running off the card when drawn by hand).
  if (new URLSearchParams(window.location.search).get('party') === 'eight') {
    const more = [
      ['Tam', 4, 4],
      ['Bram', 11, 11],
      ['Fenna of the Long Causeway', 0, 12],
      ['Moss', 40, 40],
      ['Old Sedge', 3, 21],
      ['Pip', 999, 999],
    ] as const;
    const ids = more.map(([name, now, most]) => {
      const id = world.addCharacter(campaign, name, { ownerId: jo, approval: 'approved' });
      Object.assign(world.tables.actors.find((a) => a.id === id)!, { hp_current: now, hp_max: most });
      return id;
    });
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { hp_current: 9, hp_max: 14 });
    Object.assign(world.tables.actors.find((a) => a.id === ash)!, { hp_current: 6, hp_max: 8 });
    world.tables.marching_orders.push({ id: 'marching-eight', campaign_id: campaign, group_number: 1, rows: [[ash, wren], [ids[0]!, ids[1]!], [ids[2]!, ids[3]!], [ids[4]!, ids[5]!]], presets: [], last_preset: null, locked: false, version: 1 });
  }
  // &split=1 (P8; page 18, PL6): Ash goes off to a group of their own, so Sam's Wren is in the party's group alone and
  // the player's order reads "Your group. Ash is elsewhere."
  if (new URLSearchParams(window.location.search).get('split') === '1') {
    const { chooseGroup } = await import('../modules/expedition/groupPlay.ts');
    await runCommand(registry, world.db, asGm, chooseGroup, { character: { id: ash, campaignId: campaign, ownerUserId: gm }, group: null });
  }
  // &reorder=off (B11, flag 5 ruled 2026-11-18): "Players can reorder marching order" is off, so a player's hold on a
  // rank opens the pop-up that says why. &lock=old: a lock stored before the lock went, which stops nobody.
  if (new URLSearchParams(window.location.search).get('reorder') === 'off') {
    const row = world.tables.campaigns.find((c) => c.id === campaign)!;
    row.settings = { ...((row.settings as Record<string, unknown> | null) ?? {}), playersReorderMarching: false };
  }
  if (new URLSearchParams(window.location.search).get('lock') === 'old') {
    // The GM's old lock function, as the switch used to call it (the GM is signed in here).
    await world.db.rpc('lock_marching_order' as never, { campaign, lock_it: true } as never);
  }
  // &outdoors=1 (⚑ 1 on #958, "yes, b", 2026-11-18): the expedition goes day by day, not a dark mode, so the band's
  // date line keeps the sun's light left (in a dungeon it is hidden and Light is the only light fact).
  const outdoors = new URLSearchParams(window.location.search).get('outdoors') === '1';
  const daylightRules = world.tables.library_entries.find((e) => e.id === 'entry-fen-daylight');
  if (outdoors && daylightRules)
    (daylightRules.data as Record<string, unknown>).exploration = { modes: [{ id: 'fen-walk', name: 'Walking the fen', step: { value: 1, unit: 'day' }, procedure: [], checks: [] }] };
  // &weather=due (B12, p2p-20; the review of #1048): outdoors, the setting has a weather rule and today's weather is not
  // rolled yet, so the Weather fact is due ("To roll") and the folded band shows its one line.
  if (outdoors && daylightRules && new URLSearchParams(window.location.search).get('weather') === 'due')
    (daylightRules.data as Record<string, unknown>).weather = { tables: { any: 'fen-sky' } };
  const modeId = outdoors ? 'fen-walk' : 'dungeon';
  const started = (await world.db.rpc('start_expedition' as never, { campaign, mode_id: modeId } as never)) as unknown as { data: { id: string } | null };
  if (placePageFlag === 'hand') await runCommand(registry, world.db, asGm, setPlace, { campaignId: campaign, group: 1, name: 'Fenwick Hole', placeId: null, packEntry: null });
  if (placePageFlag === 'wreck' && started.data) {
    // B15's pictures (page 30): the party at the wreck; &b15=sent or shown, the hoard sent to Wren, then the lantern named.
    const wreck = spots[1]!;
    await runCommand(registry, world.db, asGm, setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: 'pack-reed', packEntryId: wreck.id, name: wreck.name, data: wreck } });
    const b15 = new URLSearchParams(window.location.search).get('b15');
    const row = (await loadGroupPlaces(world.db, campaign, started.data.id))?.get(1);
    // HM1: the description shown, every other piece hidden.
    const description = row?.pieces.find((p) => p.kind === 'description');
    if (row && description) await runCommand(registry, world.db, asGm, showPiece, { campaignId: campaign, row, piece: description });
    if ((b15 === 'sent' || b15 === 'shown') && row?.place) {
      const { hoardRows } = await import('../modules/expedition/hoard.ts');
      const { giveFind, sendOf } = await import('../modules/expedition/findSend.ts');
      const { denominationsOf } = await import('../modules/inventory/coinWords.ts');
      const coins = denominationsOf([world.tables.library_entries.find((e) => e.id === 'entry-river-rules')!.data as Record<string, unknown>]);
      const hoard = hoardRows(row.pieces.find((p) => p.lead === 'Strongbox')!, wreck, coins, new Set());
      // As HM5 C draws it: the herons, the opals and the lantern to Wren, the swords to Ash, the daggers to the stash.
      const rowsOf = (...texts: string[]) => hoard.rows.filter((r) => texts.includes(r.text));
      for (const [to, rows] of [[wren, rowsOf('240 herons', 'Moon opals', 'Hooded lantern')], [ash, rowsOf('Swords')], [null, rowsOf('Daggers')]] as const) {
        const send = sendOf(rows, new Map());
        await runCommand(registry, world.db, asGm, giveFind, { campaignId: campaign, to, placeId: row.place.id, things: send.things, coins: send.coins, rows: send.rows });
      }
      if (b15 === 'shown') {
        const { showItemTruth } = await import('../modules/expedition/itemTruth.ts');
        const lantern = world.tables.inventory_lines.find((l) => l.actor_id === wren && l.name === 'Hooded lantern')!;
        const truth = row.pieces.find((p) => p.kind === 'other' && p.lead === 'Lantern of the Drowned')!;
        await runCommand(registry, world.db, asGm, showItemTruth, { campaignId: campaign, row, piece: truth, lines: [String(lantern.id)] });
      }
    }
  }
  // &ways=1|none|messy with spot (plan dec-9-the-players-scene P2; PL1, PL9, PL10): the jetty's ways on, and one of its
  // pieces shown, so a player has them (mc-28b). `1`: the wreck (row, swim) and the breakwater (row), both visited and
  // shown before; the customs shed by walking, never shown ("Not yet explored."); the sea cave by a hidden way (sent to
  // nobody). `none`: no ways at all (d5-1: "Where to?" is left out). `messy`: the customs shed named at length and shown,
  // climbing 999 turns and swimming 12.
  const waysFlag = placePageFlag === 'spot' ? new URLSearchParams(window.location.search).get('ways') : null;
  if (waysFlag) {
    const route = (id: string, to: string, travel: unknown, hidden = false) =>
      world.tables.library_entries.push({ id: `entry-reed-${id}`, pack_id: 'pack-reed', kind: 'route', pack_entry_id: id, name: id, data: { id, from: 'the-jetty', to, travel, hidden } });
    if (waysFlag === '1' || waysFlag === 'messy') {
      route('jetty-wreck', 'the-wreck', [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }, { by: 'swim', name: 'Swimming', value: 3, unit: 'turn' }]);
      route('jetty-breakwater', 'the-breakwater', [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }]);
      route('jetty-cave', 'sea-cave', [{ by: 'row', name: 'Rowing', value: 2, unit: 'turn' }], true);
    }
    if (waysFlag === '1') route('jetty-shed', 'customs-shed', [{ by: 'walk', name: 'Walking', value: 2, unit: 'turn' }]);
    if (waysFlag === 'messy') route('jetty-shed', 'customs-shed', [{ by: 'climb', name: 'Climbing', value: 999, unit: 'turn' }, { by: 'swim', name: 'Swimming', value: 12, unit: 'turn' }]);
    if (waysFlag === 'messy') {
      const shed = world.tables.library_entries.find((e) => e.id === 'entry-reed-customs-shed');
      const long = 'The water stair under the customs house, by the tarred door';
      spots[3]!.name = long;
      if (shed) Object.assign(shed, { name: long, data: { ...(shed.data as Record<string, unknown>), name: long } });
    }
    const visited = waysFlag === 'none' ? [] : [spots[1]!, spots[2]!, ...(waysFlag === 'messy' ? [spots[3]!] : [])];
    for (const spot of visited) {
      const data = { ...spot, playerView: { text: spot.identity } };
      await runCommand(registry, world.db, asGm, setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: 'pack-reed', packEntryId: data.id, name: data.name, data } });
      const there = started.data ? (await loadGroupPlaces(world.db, campaign, started.data.id))?.get(1) : undefined;
      if (there?.pieces[0]) await runCommand(registry, world.db, asGm, showPiece, { campaignId: campaign, row: there, piece: there.pieces[0] });
    }
  }
  if (placePageFlag === 'spots' || placePageFlag === 'spot') {
    const data = placePageFlag === 'spots' ? harbour : spots[0]!;
    await runCommand(registry, world.db, asGm, setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: 'pack-reed', packEntryId: data.id, name: data.name, data } });
    const row = started.data ? (await loadGroupPlaces(world.db, campaign, started.data.id))?.get(1) : undefined;
    if (placePageFlag === 'spots' && row) for (const piece of row.pieces.slice(0, 2)) await runCommand(registry, world.db, asGm, showPiece, { campaignId: campaign, row, piece });
    if (waysFlag && row?.pieces[0]) await runCommand(registry, world.db, asGm, showPiece, { campaignId: campaign, row, piece: row.pieces[0] });
    // The map (the whole Scene's S13, page 11's frames 1a, 1b, 2c, 4a, 4b, 4d), only with &map=…: the pack names a map
    // for the harbour; `wanted` leaves it to be added ("+ Map"); `added` stores the campaign's copy, hidden, tied to the
    // place the party is at (the layout spec serves its file, the invented harbour drawing).
    // &picture=1: the place's picture, a stand-in drawing (TW13, the picture piece: its row, then its pop-up; the
    // layout spec serves the file).
    if (new URLSearchParams(window.location.search).get('picture') === '1' && row?.place) {
      const { setPlacePicture } = await import('../modules/expedition/placePicture.ts');
      world.tables.assets.push({ id: 'asset-jetty-picture', campaign_id: campaign, kind: 'place', name: 'The jetty', visibility: 'gm' });
      await world.db.storage.from('campaign-files').upload(`${campaign}/asset-jetty-picture`, new Blob(['a picture'], { type: 'image/svg+xml' }));
      await runCommand(registry, world.db, asGm, setPlacePicture, { campaignId: campaign, place: row.place, assetId: 'asset-jetty-picture' });
      // With &ways=… (a player's Scene) the GM shows the picture too, so the Location's card has its small picture
      // button (ppf-6 c).
      const pictured = waysFlag && started.data ? (await loadGroupPlaces(world.db, campaign, started.data.id))?.get(1) : undefined;
      if (pictured?.picture) await runCommand(registry, world.db, asGm, showPiece, { campaignId: campaign, row: pictured, piece: { id: pictured.picture.id } });
    }
    const mapFlag = new URLSearchParams(window.location.search).get('map');
    if (mapFlag === 'wanted' || mapFlag === 'added' || mapFlag === 'shown') {
      // &mapTitle=long: a long title, so the card's title takes its own line above the tools (#851's round).
      const chartTitle = new URLSearchParams(window.location.search).get('mapTitle') === 'long' ? 'The Drowned Harbour and the Saltwick Breakwater at the turn of the tide' : 'The Drowned Harbour, the harbour chart';
      const chart = { file: 'harbour-chart.png', title: chartTitle, alt: 'A silted harbour, its bar and five spots', locationIds: ['drowned-harbour'] };
      world.tables.library_entries.push({ id: 'entry-reed-harbour-chart', pack_id: 'pack-reed', kind: 'map', pack_entry_id: 'harbour-chart', name: chart.title, data: chart });
      if ((mapFlag === 'added' || mapFlag === 'shown') && row) {
        world.tables.assets.push({ id: 'asset-harbour-chart', campaign_id: campaign, kind: 'map', name: chart.title, visibility: mapFlag === 'shown' ? 'all' : 'gm' });
        await world.db.storage.from('campaign-files').upload(`${campaign}/asset-harbour-chart`, new Blob(['a chart'], { type: 'image/svg+xml' }));
        const tied = world.tables.places.find((p) => p.id === row.place?.id);
        if (tied) tied.map_asset_id = 'asset-harbour-chart';
      }
    }
  }
  // &waiting=4|6: encounters waiting in "Waiting for you" (S8a; page 16, T2 and T6b): four (the first whole, three rows),
  // or six (the first whole, two rows, "3 more"); the second with a long name. Each read the table's one row, so the
  // one card (sf-4) has its picked line and "Change…".
  const waitingFlag = Number(new URLSearchParams(window.location.search).get('waiting') ?? 0);
  const names = ['Bog lurkers', 'The Long-Drowned Customs Officers of the Lantern Coast and their Hounds', 'Reed wraiths', 'Eel-wives', 'A ferryman with no boat', 'Gulls, a great many'];
  if (started.data && waitingFlag > 0) {
    for (const [i, name] of names.slice(0, waitingFlag).entries()) {
      const check = `check-reed-${i}`;
      world.tables.check_results.push({
        id: check, campaign_id: campaign, expedition_id: started.data.id, check_key: `place:drowned-harbour:${i}`, name: 'Encounter check', source: 'place', outcome: 'hit', at_seconds: 0, modifiers: [], note: null,
        table_id: 'on-the-water', roll: '1–8', row_text: name, secret: true, revealed: false, revealed_by_hand: false, created_by: gm, undone: false, version: 1, created_at: `2026-11-14T10:0${i}:00Z`,
      });
      world.tables.waiting_encounters.push({ id: `waiting-reed-${i}`, campaign_id: campaign, expedition_id: started.data.id, check_result_id: check, watch: null, state: 'waiting', started_at: null, dismissed_at: null, created_by: gm, undone: false, version: 1, created_at: `2026-11-14T10:0${i}:00Z` });
    }
  }
}

const people: Record<string, string> = { gm, player: sam, new: jo };
const as = new URLSearchParams(window.location.search).get('as');
if (as && people[as]) world.signInAs(people[as]);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in layout.html');
// Give to a player (page 13 of the December mockups), only with ?give=…: a character the GM made, waiting to be given
// (its row says "Yours"); ?give=long names it at length and adds a player with a long name.
const giveFlag = new URLSearchParams(window.location.search).get('give');
if (giveFlag === '1' || giveFlag === 'long') {
  world.addCharacter(campaign, giveFlag === 'long' ? 'Ashwin Thistlewood of the Long Stair, called the Lantern-Bearer' : 'Ash');
  if (giveFlag === 'long') world.addMember(campaign, world.addPerson('bart@lantern.example', 'Bartholomew Featherstone-Quillfeather the Younger'), 'player');
}
// The GM's view as the player with long names (page 32, M3b, M3d, M3k), only with ?view=long: a player with a long name
// and their approved character with a long name, so the Players row wraps and the View band cuts its name line, on a
// tablet held sideways too, in every browser's text widths (the band's line holds about 1050 px there).
if (new URLSearchParams(window.location.search).get('view') === 'long') {
  const bart = world.addPerson('bart@lantern.example', 'Bartholomew Featherstone-Quillfeather the Younger, Keeper of the Lamps of the Seventh Sluice-Gate');
  const ashwin = world.addCharacter(campaign, 'Ashwin Thistlewood of the Long Stair, called the Lantern-Bearer', { ownerId: bart });
  world.addMember(campaign, bart, 'player', ashwin);
}
// The Pack in the GM's view as the player (page 32, M3g, M3g2), only with ?viewPack=1: on Wren, a ring whose long
// curse only the GM reads (a hidden field), so its sheet carries the GM's line and "Reveal…"; a cursed sword (M3g2's
// line); and a wand whose charge count is hidden, so its row reads as the player's.
if (new URLSearchParams(window.location.search).get('viewPack') === '1') {
  const rules = world.tables.library_entries.find((e) => e.id === 'entry-river-rules')!.data as Record<string, unknown>;
  rules.magicItems = { charges: { 'magic-wand': '2d6', hidden: true, rechargeable: false } };
  const ring = { id: 'mooring-ring', name: 'Mooring ring', category: 'ring', description: 'A plain band of old bronze, green at the seam.' };
  world.tables.library_entries.push({
    id: 'entry-mooring-ring',
    pack_id: 'pack-river',
    kind: 'item',
    pack_entry_id: 'mooring-ring',
    name: 'Mooring ring',
    data: { ...ring, fields: { Curse: 'Whoever wears it cannot step off a boat until the next full moon, and hears the bell of the drowned lock-keeper at every dusk' }, gmOnly: ['fields'] },
  });
  line('line-mooring-ring', wren, 'Mooring ring', { category: 'ring', library_entry_id: 'entry-mooring-ring', source_pack_id: 'pack-river', source_entry_id: 'mooring-ring', item_data: ring });
  // A cursed sword (M3g2): its −1 hidden from the player, its curse a hidden field; Wren a level 1 Lantern Warden with an
  // invented attack figure, so the sword has a to-hit roll ("the true figure is d20 …").
  for (const id of ['entry-lantern-warden', 'entry-fen-warden']) (world.tables.library_entries.find((e) => e.id === id)!.data as Record<string, unknown>).progression = [{ level: 1, attackBonus: 0 }];
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, { classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
  const sword = { id: 'sluice-sword', name: 'Old bronze sword', category: 'weapon', weapon: { damage: '1d8', magicBonus: -1 } };
  world.tables.library_entries.push({ id: 'entry-sluice-sword', pack_id: 'pack-river', kind: 'item', pack_entry_id: 'sluice-sword', name: 'Old bronze sword', data: { ...sword, cursed: true, gmOnly: ['cursed'] } });
  line('line-sluice-sword', wren, 'Old bronze sword', { category: 'weapon', library_entry_id: 'entry-sluice-sword', source_pack_id: 'pack-river', source_entry_id: 'sluice-sword', item_data: sword });
  Object.assign(world.tables.inventory_lines.find((l) => l.id === 'line-wand')!, { charges_hidden: true, charges_used: 1 });
  world.tables.inventory_line_secrets.push({ id: 'line-wand', campaign_id: campaign, charges_total: 999, spent: false });
}
// K22's screens (page 33; batch K2), only with ?k22=1: on Wren, the Bronze ring (the Ring of the Drowned Bell, stored
// unidentified as its face, K22a) and the Hooded lantern with nine hidden facts, a long true name and 999 charges.
if (new URLSearchParams(window.location.search).get('k22') === '1') {
  const rules = world.tables.library_entries.find((e) => e.id === 'entry-river-rules')!.data as Record<string, unknown>;
  rules.itemCategories = [
    { id: 'ring', name: 'Rings', singular: 'Ring', unidentified: true },
    { id: 'lantern', name: 'Lanterns', singular: 'Lantern', unidentified: true },
  ];
  const ring = {
    id: 'drowned-bell', name: 'Ring of the Drowned Bell', category: 'ring', slot: 'ring', looks: 'A plain band of old bronze.', appearsAs: 'Bronze ring', noticed: 'Cold to the touch, even by the fire.',
    bonus: '+1 to saves', cursed: true, description: 'Cast from the bronze of a sunken bell. Its wearer is steadier against harm, and cannot take it off within sight of the sea.', source: 'p. 14', gmOnly: ['bonus'],
  };
  const lantern = {
    id: 'nine-tides', name: 'The Old Lantern of the Drowned and of the Nine Tides', category: 'lantern', looks: 'A hooded lantern of green glass, with a ring for the hand.', appearsAs: 'Hooded lantern',
    noticed: 'Cold to the hand, and no smell of oil. The glass is sea-green and thick as a bottle’s foot; held to the ear it hums, low, like a shell.',
    bonus: '+1 to saves against fear', cursed: true, properties: ['Burns without oil', 'Shows what lies under water within ten paces', 'The drowned can see its bearer from as far'],
    fields: { 'Maker’s mark': 'Three waves under a bell' }, description: 'Lit, it burns no oil and shows whatever lies under water within ten paces.', source: 'p. 22', gmOnly: ['bonus', 'fields.Maker’s mark'],
  };
  for (const item of [ring, lantern]) world.tables.library_entries.push({ id: `entry-${item.id}`, pack_id: 'pack-river', kind: 'item', pack_entry_id: item.id, name: item.name, data: item });
  const face = (item: typeof ring | typeof lantern) => ({
    category: item.category, library_entry_id: `entry-${item.id}`, source_pack_id: 'pack-river', source_entry_id: item.id, identified: false, appears_as: item.appearsAs, noticed: item.noticed, revealed_fields: [], version: 1,
    item_data: { id: item.id, category: item.category, looks: item.looks, ...('slot' in item ? { slot: item.slot } : {}) },
  });
  line('line-bronze-ring', wren, 'Bronze ring', face(ring));
  line('line-hooded-lantern', wren, 'Hooded lantern', { ...face(lantern), charges_hidden: true });
  // With &k22charges=unset its hidden count was never rolled (Home Two's audit of #50, findings 4 and 5).
  const unset = new URLSearchParams(window.location.search).get('k22charges') === 'unset';
  world.tables.inventory_line_secrets.push({ id: 'line-hooded-lantern', campaign_id: campaign, charges_total: unset ? null : 999, spent: false });
}

// The Scene in the GM's view as the player (page 32, M3i; C15f), only with ?viewScene=1: Sam's request waiting on the
// GM ("Search the hold"), so the view's prompt slot shows it with its Cancel. Use with &placePage=spot&ways=1 for M3i's
// place and ways.
if (new URLSearchParams(window.location.search).get('viewScene') === '1') {
  world.tables.requests.push({
    id: 'request-view-scene', campaign_id: campaign, expedition_id: null, group_number: null, requester_id: sam, actor_id: wren, kind: 'askGm', direction: 'playerAsks',
    text: 'Search the hold', cost_text: '', prompt: {}, entry: null, status: 'waiting', answer_kind: 'yesNo', answer: null, answered_at: null, reply: null,
    created_at: '2026-11-22T10:00:00Z', version: 1, undone: false,
  });
}
// What the folded rail keeps (mn-2), only with ?railSigil=1: the retired campaign takes a 60-character name, and it and
// the Drowned Marches a sigil picture (the layout check serves files.example's pictures itself).
if (new URLSearchParams(window.location.search).get('railSigil') === '1') {
  world.tables.campaigns.find((c) => c.id === fen)!.name = 'The Old Fen Road to the Drowned Bell Tower of Saltwick Marsh';
  for (const id of [campaign, fen]) {
    world.tables.assets.push({ id: `asset-sigil-${id}`, campaign_id: id, kind: 'sigil', uploaded_by: gm, visibility: 'all' });
    world.files.set(`${id}/asset-sigil-${id}`, new Blob(['sigil']));
    world.tables.campaigns.find((c) => c.id === id)!.sigil_asset_id = `asset-sigil-${id}`;
  }
}

// The stand-in database as the screens get it (row test-creation-world). The in-memory database answers in the page,
// so a layout check's page.route can't make a send fail; these flags do it here instead:
//   &send=refuse   the send command (character.send) comes back refused, the device still online
//   &send=offline  the send fails as it does when the connection drops: the device reads offline, the send errors.
//                  The device stays offline for the page's life, so Try again never succeeds in this world.
//   &slow=1        every answer from the database waits 600 ms, past the 300 ms before creation's loading state shows
// With none of them, the database itself, untouched.
function harnessDb(db: typeof world.db): typeof world.db {
  const params = new URLSearchParams(window.location.search);
  const send = params.get('send');
  const slow = params.get('slow') === '1';
  if (send !== 'refuse' && send !== 'offline' && !slow) return db;
  const commandOf = (headers: Headers | undefined) => {
    const value = headers?.get(EVENT_HEADER);
    if (!value) return null;
    try {
      return (JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value), (c) => c.charCodeAt(0)))) as { type?: string }).type ?? null;
    } catch {
      return null;
    }
  };
  const later = <T,>(value: T) => (slow ? new Promise<T>((resolve) => window.setTimeout(() => resolve(value), 600)) : Promise.resolve(value));
  type Thenable = { headers?: Headers; then: (onDone?: (value: unknown) => unknown, onFail?: (reason: unknown) => unknown) => PromiseLike<unknown> };
  // Depends on the query builder's shape: `db.from(table)` returns one thenable object (with a `headers` Headers), so
  // replacing its `then` catches the request when it is awaited. A builder that returned a fresh object per step would escape it.
  const from = db.from.bind(db);
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property !== 'from') return Reflect.get(target, property, receiver) as unknown;
      return (table: Parameters<typeof db.from>[0]) => {
        const query = from(table) as unknown as Thenable;
        const answer = query.then.bind(query);
        // The command's name is in the request's header, set after this returns: read it when the query is awaited.
        query.then = (onDone, onFail) => {
          const command = commandOf(query.headers);
          if (command === 'character.send' && send === 'refuse') return later({ data: null, error: { message: "You don't have permission to do that.", code: '42501' } }).then(onDone, onFail);
          if (command === 'character.send' && send === 'offline') {
            Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
            return later(null).then(() => Promise.reject(new TypeError('Failed to fetch'))).then(onDone, onFail);
          }
          return slow ? later(null).then(() => answer(onDone, onFail)) : answer(onDone, onFail);
        };
        return query;
      };
    },
  });
}

// The device's theme and text size, as the app applies them before it starts (src/main.tsx).
applyThemeChoice(getThemeChoice());
applyTextSize(getTextSize());

// The map's parts alone (dec-7 piece 5a): no screen uses them yet, so the page shows them by themselves.
const mapParts = new URLSearchParams(window.location.search).get('mapParts');
const moveOn = new URLSearchParams(window.location.search).get('moveOn');
const knowledge = new URLSearchParams(window.location.search).get('knowledge');
const placeCard = new URLSearchParams(window.location.search).get('placeCard');
const viewPopUps = new URLSearchParams(window.location.search).get('viewPopUps');
if (viewPopUps) {
  // The GM's view's player-only pop-ups opened from inside a sheet (C15d, C15f): a travel day's activity, a town's stay.
  const { GmViewPopUpsLayoutPage } = await import('../gallery/GmViewPopUpSpecimens.tsx');
  await import('../gallery/Gallery.css');
  createRoot(root).render(
    <StrictMode>
      <GmViewPopUpsLayoutPage state={viewPopUps} db={world.db} gm={gm} />
    </StrictMode>,
  );
} else if (placeCard) {
  // The players' place card (P4) alone, as the gallery draws it; on the players' page with ?placePage=spot&ways=1.
  const { PlayersPlaceCardLayoutPage } = await import('../gallery/PlayersPlaceCardSpecimens.tsx');
  await import('../gallery/Gallery.css');
  createRoot(root).render(
    <StrictMode>
      <PlayersPlaceCardLayoutPage state={placeCard} />
    </StrictMode>,
  );
} else if (mapParts) {
  const { MapPartsLayoutPage } = await import('../gallery/MapPartsSpecimens.tsx');
  await import('../gallery/Gallery.css');
  createRoot(root).render(
    <StrictMode>
      <MapPartsLayoutPage state={mapParts} open={new URLSearchParams(window.location.search).get('open') === '1'} />
    </StrictMode>,
  );
} else if (knowledge) {
  // A place's Knowledge alone (dec-7 piece 6a): no screen opens it until the place page (5b).
  const { KnowledgeLayoutPage } = await import('../gallery/KnowledgeSpecimens.tsx');
  await import('../gallery/Gallery.css');
  createRoot(root).render(
    <StrictMode>
      <KnowledgeLayoutPage state={knowledge} />
    </StrictMode>,
  );
} else if (moveOn) {
  // Moving on's parts alone (dec-7 piece 4a), as the map's: no screen uses them until the place page (5b).
  const { MoveOnLayoutPage } = await import('../gallery/MoveOnSpecimens.tsx');
  await import('../gallery/Gallery.css');
  createRoot(root).render(
    <StrictMode>
      <MoveOnLayoutPage state={moveOn} />
    </StrictMode>,
  );
} else

// A fixed stand-in for the version at the ⋯ menu's foot (F55), so nothing here changes with each build.
createRoot(root).render(
  <StrictMode>
    <BuildContext.Provider value={STAND_IN_BUILD}>
      <Root db={harnessDb(world.db)} />
    </BuildContext.Provider>
  </StrictMode>,
);
