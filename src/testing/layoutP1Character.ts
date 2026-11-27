// The shared P1-like test character for the layout page (plan dec-13; the lead, 2026-11-15): one character every Player
// screen row is pictured and checked against, so the screen is full as frame P1 of december/14 draws it. Only with
// `?p1=1`, in its own campaign ("The Storm Lantern Road"), so no other page's pictures change. Sam plays it.
//   Brannoch Fenward, a level 3 Lantern Warden of the bog folk on the invented fixture pack (Fen sample): six scores,
//   five saves (the fixture's mire and four more, named by the rules set above, as frame P1 draws five), movement
//   in paces under the name "Speed" (as P1 says it),
//   armour class (a waxed coat over the unarmoured 10) and an attack; Steady flame, a trait with uses;
//   a reed spear in hand; an eel knife pinned to At hand (not in hand, so it shows Wield); a storm lantern lit with
//   4 of 6 turns left and three flasks of lamp oil (so its line reads "Lit, 4 turns left. 3 refills left" and Refill
//   shows); four statuses, the first with no end (dashed).
//   A small rules set above the fixture's carries `rolls` (pf-20): saves at or over, a check against a score at or under,
//   so the Saves and Scores headings carry their lines (sv-3).
// Every name and number is invented (hard rule 2). Made before the screens start; the lantern is lit through the
// stand-in database's own light_light, as the app lights one.
import type { FakeWorld } from './fakeDb.ts';

export const P1_CAMPAIGN = 'The Storm Lantern Road';
export const P1_CHARACTER = 'Brannoch Fenward';

const TURN = 600;

/** The head's messy data (dec-13 C2), from the layout page's `?p1=`: `messy`, a long name and nine statuses;
 * `two`, two statuses (their words beside the rings, frame P2); `noline`, rules with no roll for scores (the Scores
 * heading alone, no rule line); `classless`, no class, so the head's line is the GM's card line; `heavy`, 999 bundles
 * of reeds in the pack, over the most (movement and load, dec-13 C10); `modes`, a bow with its quiver, a long-named
 * axe with its grip and a wand with charges pinned to At hand (the stacked buttons, dec-13 C6); `weapon`, the spear in
 * hand swapped for a long-named hooked spear, melee and missile, with a Grip (two buttons and three roll lines: the
 * weapon in hand's messy data, dec-13 C14); `bare`, nothing at hand (no weapon in hand, nothing pinned, no light
 * carried), 0 hit points, a long level title and a score change waiting for the GM; `packless`, no pack at all and no light, 999 of 999 hit points (the
 * screen's states, dec-13 C11); `skills`, rules with a roll for skills (`rolls.skill`, so the Skills heading carries its
 * line, tfs-2) and three more skills beside Hark: a long-named one rolled the target or higher ("6+ on d6", tfs-3), one
 * "2-in-6" and one "35%" (the pack's other styles; plan test-feedback-2026-11-19 rows C13, C14); `pins`, the four of P1
 * with an ability without uses and the trait with uses pinned, in that order (row P3; page 28: a row and a block in the
 * right column's list), and a second trait with uses, Beacon call, unpinned (a plain row after the pins, page 38's fix 4). The light's states (plan light-tap, page 35): `unlit`, the lantern put out with 4 turns kept in
 * it (35B); `several`, nothing lit and two lights to light, the lantern and reed torches (35E2, 1); `burnt`, the lantern
 * burnt out with its oil and the torches (Refill and Light another, 35E2, 3); `burntnone`, a reed torch burnt out and no
 * light left in the pack (35E2, 4); `longlight`, the lantern named at length with 999 turns and 999 refills (35D).
 * `arms`, several ready weapons (frame P5b; pib-1, pib-2): three in hand (the spear, the knife and a long-named axe with
 * its Grip: three blocks), bog-ox horns worn and pinned (an At hand row with Attack and Stance) and a heron bow pinned
 * with its quiver (a row with Wield and Quiver).
 * `1`, the four of P1. */
export const P1_LONG_NAME = 'Brannoch Fenward of the Seven Drowned Cairns, called the Unbowed';
/** The long-named light (`longlight`, 35D's messy data). */
export const P1_LONG_LIGHT = 'Hooded lantern of the drowned bell';
export type P1Head =
  | 'four'
  | 'messy'
  | 'two'
  | 'noline'
  | 'classless'
  | 'heavy'
  | 'modes'
  | 'weapon'
  | 'arms'
  | 'bare'
  | 'packless'
  | 'skills'
  | 'finish'
  | 'pins'
  | 'unlit'
  | 'several'
  | 'burnt'
  | 'burntnone'
  | 'longlight'
  | 'armour';

export async function addP1Character(
  world: FakeWorld,
  { gm, sam, fenPack, head = 'four' }: { gm: string; sam: string; fenPack: Record<string, Record<string, unknown>[]>; head?: P1Head },
): Promise<string> {
  const campaign = world.addCampaign(P1_CAMPAIGN, gm);
  // The load tracked in coins (dec-13 C10), by the fixture's own tiers, so Movement shows its load card as P1 draws it.
  // `armour`: the load by armour worn and treasure carried (pss-12), by invented armour rules below.
  Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { encumbrance: { mode: head === 'armour' ? 'armour' : 'coin' } } });
  // The fixture pack, as the ?full=1 page loads it.
  world.tables.packs.push({ id: 'pack-p1-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-11-15T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (packId: string, kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${packId}-${kind}-${String(data.id)}`, pack_id: packId, kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  const lists: [string, string][] = [['rulesSets', 'rulesSet'], ['races', 'race'], ['classes', 'class'], ['hooks', 'hook'], ['fieldTemplates', 'fieldTemplate'], ['traitLists', 'traitList'], ['items', 'item']];
  // Five saves, as frame P1 draws five (dec-13 C3; the lead, 2026-11-15): the fixture's own (mire) and four more in the
  // Warden's progression here, named by the rules set above. Invented names and numbers.
  const MORE_SAVES = { drown: 1, fever: 2, wisp: 3, barrow: 4 };
  const withFiveSaves = (data: Record<string, unknown>) =>
    data.id !== 'lantern-warden' || !Array.isArray(data.progression)
      ? data
      : {
          ...data,
          progression: (data.progression as Record<string, unknown>[]).map((row) => {
            const saves = (row.saves ?? {}) as Record<string, number>;
            const mire = saves.mire ?? 12;
            // The attack as a bonus going up (P1 reads "d20 +0", "Attack +2"): the fixture's `attack` (19 at level 1, 18
            // at 3) is a target number, which a rules set with no AC style reads as a bonus ("d20 +20"). Francis's fix
            // 0 of 19 Nov 2026: the sample, not the rule. Invented: +0 at level 1, +1 from level 3.
            const attack = typeof row.level === 'number' && row.level >= 3 ? 1 : 0;
            return { ...row, attack, saves: { ...saves, ...Object.fromEntries(Object.entries(MORE_SAVES).map(([k, d]) => [k, mire + d])) } };
          }),
          // For `pins`, a second trait with uses, left unpinned, so a plain row follows the pinned boxes under "Abilities
          // and traits" (plan dec-14, fix 4's "not drawn together" case). Invented.
          ...(head === 'pins' && Array.isArray(data.abilities)
            ? { abilities: [...(data.abilities as unknown[]), { name: 'Beacon call', note: 'Calls the lost toward the light.', blurb: 'Calls the lost toward the light.', uses: { count: 2, per: 'day' } }] }
            : {}),
          // A long level title for the screen's messy data (dec-13 C11), at level 3.
          ...(head === 'bare' && Array.isArray(data.levelTitles) ? { levelTitles: [...(data.levelTitles as string[]).slice(0, 2), 'Warden of the Long Causeway and the Seven Drowned Cairns'] } : {}),
        };
  // The speed as frame P1 says it (the review's nit of 19 Nov 2026): "120 paces", "40 paces in a fight", in place of the
  // fixture's feet. Invented figures and words; the rule that reads them is unchanged.
  const PACES: Record<string, string> = { '125 ft': '120 paces', '80 ft': '80 paces', '50 ft': '40 paces' };
  const inPaces = (data: Record<string, unknown>) => {
    if (data.id !== 'fen-rules') return data;
    const rec = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
    const tiers = (list: unknown) => (Array.isArray(list) ? list.map((t) => ({ ...rec(t), movement: PACES[String(rec(t).movement)] ?? rec(t).movement })) : list);
    const encumbrance = rec(data.encumbrance);
    const movement = rec(data.movement);
    return {
      ...data,
      encumbrance: {
        ...encumbrance,
        coin: { ...rec(encumbrance.coin), tiers: tiers(rec(encumbrance.coin).tiers) },
        slot: { ...rec(encumbrance.slot), tiers: tiers(rec(encumbrance.slot).tiers) },
        // For `armour` (pss-12): movement by the armour worn, slower with treasure; the waxed coat is light. Invented.
        ...(head === 'armour'
          ? {
              armour: {
                maxLoadCoin: 1600,
                movement: [
                  { armour: 'none', withoutTreasure: '120 paces', withTreasure: '90 paces' },
                  { armour: 'light', withoutTreasure: '90 paces', withTreasure: '60 paces' },
                  { armour: 'heavy', withoutTreasure: '60 paces', withTreasure: '30 paces' },
                ],
                armourTypes: { light: 'light', heavy: 'heavy' },
              },
            }
          : {}),
      },
      movement: { ...movement, combat: { ...rec(movement.combat), unit: 'paces' } },
    };
  };
  // Three more of everyone's skills beside Hark, for `skills` (tfs-3): a long name rolled the target or higher, and the
  // pack's other two styles. Invented names and numbers.
  const MORE_SKILLS = [
    { id: 'fen-way', name: 'Finding the way through fen and reed-bed', die: 'd6', default: 6, rollMode: 'equal-or-over' },
    { id: 'forage', name: 'Forage', die: 'd6', default: 2 },
    { id: 'climb', name: 'Climb', die: '%', default: 35 },
  ];
  const withMoreSkills = (data: Record<string, unknown>) =>
    head !== 'skills' || data.id !== 'fen-rules' ? data : { ...data, skills: [...(Array.isArray(data.skills) ? data.skills : []), ...MORE_SKILLS] };
  for (const [list, kind] of lists) for (const data of fenPack[list] ?? []) entry('pack-p1-fen', kind, kind === 'class' ? withFiveSaves(data) : kind === 'rulesSet' ? withMoreSkills(inPaces(data)) : data);
  entry('pack-p1-fen', 'xpTable', { id: 'warden-xp', name: 'Warden XP', levels: [{ level: 1, xp: 0 }, { level: 2, xp: 1500 }, { level: 3, xp: 3000 }, { level: 4, xp: 6000 }] });
  world.tables.campaign_packs.push({ id: 'campaign-pack-p1-fen', campaign_id: campaign, pack_id: 'pack-p1-fen', option_choices: {}, overrides: {}, priority: 1 });

  // Above it, the lantern, its oil, the statuses and the rolls (invented).
  world.tables.packs.push({ id: 'pack-p1-lantern', owner_user_id: gm, campaign_id: null, name: 'Lantern road extras', version: '0.1', kind: 'setting', format_version: 2, source: 'Invented for layout checks', notes: '', updated_at: '2026-11-15T12:00:00Z' });
  entry('pack-p1-lantern', 'rulesSet', { id: 'lantern-road-rules', name: 'Lantern road rules', rolls: head === 'noline' ? { save: { die: 'd20', pass: 'atOrOver' } } : { save: { die: 'd20', pass: 'atOrOver' }, abilityCheck: { die: 'd20', pass: 'atOrUnder' }, ...(head === 'skills' ? { skill: { die: 'd6', pass: 'atOrOver' } } : {}) }, saveCategories: [{ key: 'mire', name: 'Mire' }, { key: 'drown', name: 'Drowning' }, { key: 'fever', name: 'Fever' }, { key: 'wisp', name: 'Wisps' }, { key: 'barrow', name: 'Barrow' }] });
  entry('pack-p1-lantern', 'lightType', { id: 'storm-lantern', name: 'Storm lantern', duration: 6, unit: 'turn', radius: '30 ft', warnAt: 1, fuel: 'lamp-oil' });
  entry('pack-p1-lantern', 'item', { id: 'lamp-oil', name: 'Lamp oil', category: 'gear', weightCoin: 10 });
  // A second kind of light for the light's heads (page 35): reed torches, used up, 6 turns each.
  const torches = head === 'several' || head === 'burnt';
  if (torches || head === 'burntnone') entry('pack-p1-lantern', 'lightType', { id: 'reed-torch', name: 'Reed torch', duration: 6, unit: 'turn', warnAt: 1, consumed: true });
  const conditions = [
    { id: 'lantern-blessed', name: 'Lantern-blessed', icon: 'star', tone: 'boon', notes: 'The beacon keepers’ blessing, until it is lifted.' },
    { id: 'chilled', name: 'Chilled', icon: 'snowflake', tone: 'harm', notes: 'Numb fingers until warmed by a fire.' },
    { id: 'heron-sight', name: 'Heron sight', icon: 'eye-half', tone: 'boon', notes: 'Sees through fen mist.' },
    { id: 'weary', name: 'Weary', icon: 'bed', tone: 'neutral', notes: 'Slow and sore until a proper rest.' },
    // Five more for the messy head (dec-13 C2): nine in all.
    { id: 'reed-cut', name: 'Reed-cut', icon: 'drop', tone: 'harm', notes: 'A shallow cut that stings in the wet.' },
    { id: 'mist-dazed', name: 'Mist-dazed', icon: 'spiral', tone: 'harm', notes: 'The fen mist muddles the mind.' },
    { id: 'heartened', name: 'Heartened by the long beacon song', icon: 'star', tone: 'boon', notes: 'A song keeps the dark at bay.' },
    { id: 'soaked', name: 'Soaked', icon: 'snowflake', tone: 'harm', notes: 'Wet through.' },
    { id: 'watchful', name: 'Watchful', icon: 'eye-half', tone: 'neutral', notes: 'Hard to surprise.' },
  ];
  for (const c of conditions) entry('pack-p1-lantern', 'condition', c);
  world.tables.campaign_packs.push({ id: 'campaign-pack-p1-lantern', campaign_id: campaign, pack_id: 'pack-p1-lantern', option_choices: {}, overrides: {}, priority: 2 });

  // The sheet's fields, from the fixture's template (as ?full=1).
  type Field = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; from?: string };
  ((fenPack.fieldTemplates?.[0]?.fields ?? []) as Field[])
    .filter((f) => f.key !== 'hp' && !f.from)
    .forEach((f, order) => {
      const type = f.type === 'list' && !f.choices?.length ? 'text' : f.type;
      // The speed's field is named "Speed", as frame P1 names it ("Speed, 40 paces in a fight").
      world.tables.field_definitions.push({ id: `field-p1-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.fill === 'movement' ? 'Speed' : f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: head === 'classless' && (f.key === 'alignment' || f.key === 'languages'), hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: null, created_at: '2026-11-15T12:00:00Z' });
    });

  const brannoch = world.addCharacter(campaign, P1_CHARACTER, { ownerId: sam, approval: 'approved', companyName: 'The Beacon Keepers' });
  Object.assign(world.tables.actors.find((a) => a.id === brannoch)!, {
    level: 3,
    hp_current: head === 'bare' ? 0 : head === 'packless' ? 999 : 11,
    hp_max: head === 'packless' ? 999 : 16,
    race_ref: 'bog-folk',
    fields: { MUS: 15, NIM: 12, GRT: 13, WIT: 10, LORE: 9, CHARM: 11, alignment: 'Lantern', languages: 'Reedish, Common', motto: 'The beacon before the bed.' },
    classes: head === 'classless' ? [] : [{ classRef: 'lantern-warden', level: 3, xp: 3400 }],
  });
  world.addMember(campaign, sam, 'player', brannoch);
  // A score sent to the GM and waiting (the sheet's waiting-change line, drawn on the Player screen since C1; dec-13 C11).
  // Two notices for the notices box (row C1): the languages put off for later ("To finish") and the change below.
  if (head === 'finish') Object.assign(world.tables.actors.find((a) => a.id === brannoch)!, { creation: { toFinish: ['languages'] } });
  if (head === 'bare' || head === 'finish') {
    world.tables.sheet_changes.push({
      id: 'change-p1-muscle', campaign_id: campaign, actor_id: brannoch, requester_id: sam, field: 'MUS', label: 'Muscle', from_value: 15, to_value: 16,
      status: 'waiting', reason: null, answered_at: null, created_at: '2026-11-15T09:30:00Z', version: 1, undone: false,
    } as never);
  }
  world.tables.character_play.push({
    actor_id: brannoch,
    campaign_id: campaign,
    prepared: [],
    uses_spent: {},
    ac_override: null,
    form_id: null,
    version: 1,
    ...(head === 'pins' ? { pins: [{ kind: 'trait', key: 'Oath of light' }, { kind: 'trait', key: 'Steady flame' }] } : {}),
  });

  // The pack: the coat worn, the spear in hand, the knife pinned, the lantern and its oil.
  const item = (id: string) => (fenPack.items ?? []).find((i) => i.id === id) ?? {};
  let n = 0;
  // No pack at all (dec-13 C11): every line is left out.
  const line = (id: string, name: string, extra: Record<string, unknown>) =>
    head !== 'packless' &&
    world.tables.inventory_lines.push({
      id, campaign_id: campaign, actor_id: brannoch, location_id: null, library_entry_id: null, name, category: 'gear', weight_coin: null, slots: null, stack: 1, qty: 1,
      container_line_id: null, equipped: false, how_got: 'found', cost: '', notes: '', item_data: {}, source_pack_id: null, source_entry_id: null, charges_left: null,
      charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null, pinned: false, at_hand_hidden: false, approval: 'approved', per_units: 1,
      created_at: `2026-11-15T09:00:${String(n++).padStart(2, '0')}Z`, ...extra,
    });
  line('line-p1-coat', 'Waxed coat', { category: 'armour', weight_coin: 150, equipped: true, item_data: item('waxed-coat'), source_pack_id: 'pack-p1-fen', source_entry_id: 'waxed-coat' });
  if (head === 'weapon') {
    // The weapon in hand's messy data (dec-13 C14): a long name, two kinds (two to-hit lines), a grip (two buttons).
    const hooked = { weapon: { damage: '2d4', qualities: ['Melee', 'Missile'], modes: { button: 'grip', list: [{ id: 'one-hand', name: 'One hand' }, { id: 'two-hands', name: 'Two hands', damage: '1d10' }] } } };
    line('line-p1-spear', 'Hooked eel-spear of the Seven Drowned Cairns', { category: 'weapon', weight_coin: 40, equipped: true, item_data: hooked });
  } else line('line-p1-spear', 'Reed spear', { category: 'weapon', weight_coin: 30, equipped: head !== 'bare', item_data: item('reed-spear'), source_pack_id: 'pack-p1-fen', source_entry_id: 'reed-spear' });
  line('line-p1-knife', 'Eel knife', { category: 'weapon', weight_coin: 10, pinned: head !== 'bare', equipped: head === 'arms', item_data: item('eel-knife'), source_pack_id: 'pack-p1-fen', source_entry_id: 'eel-knife' });
  const lanternName = head === 'longlight' ? P1_LONG_LIGHT : 'Storm lantern';
  // `bare` carries no light: a light not burning now sits in At hand too (lt-4), and bare has nothing at hand.
  if (head !== 'burntnone' && head !== 'bare') line('line-p1-lantern', lanternName, { category: 'light', weight_coin: 40, item_data: { lightTypeId: 'storm-lantern' } });
  line('line-p1-oil', 'Lamp oil', { weight_coin: 10, qty: head === 'longlight' ? 999 : 3, stack: head === 'longlight' ? 999 : 10, source_pack_id: 'pack-p1-lantern', source_entry_id: 'lamp-oil' });
  if (torches) line('line-p1-torches', 'Reed torch', { category: 'light', weight_coin: 10, qty: 4, stack: 10, item_data: { lightTypeId: 'reed-torch' } });
  // Treasure carried in armour mode (pss-12): a pouch of pearls, so the load card says "Carrying treasure". Invented.
  if (head === 'armour') line('line-p1-pearls', 'Pouch of river pearls', { category: 'gear', weight_coin: 120, item_data: { treasure: true } });
  // Over the most (dec-13 C10's messy data): 999 bundles of reeds, a coin's weight each.
  if (head === 'heavy') line('line-p1-reeds', 'Bundle of reeds', { weight_coin: 1, qty: 999, stack: 999 });
  // At hand's stacked buttons (dec-13 C6; frames P1, P2): a bow with its quiver (Quiver beside Wield, its line naming
  // the arrows), an axe with a long name and its grip (Grip beside Wield), a wand with charges (Use). Invented.
  if (head === 'modes') {
    const modes = (button: string, list: Record<string, unknown>[]) => ({ button, list });
    line('line-p1-bow', 'Heron bow', { category: 'weapon', weight_coin: 30, pinned: true, item_data: { slot: 'hand', hands: 2, weapon: { damage: '1d6', modes: modes('quiver', [{ id: 'reed', name: 'Reed arrows', draws: { itemId: 'reed-arrows' } }, { id: 'bone', name: 'Bone arrows', draws: { itemId: 'bone-arrows' } }]) } } });
    line('line-p1-arrows', 'Reed arrows', { category: 'ammunition', weight_coin: 1, qty: 18, stack: 20, source_entry_id: 'reed-arrows' });
    line('line-p1-axe', 'Hand axe of the Seven Cairns, twice reforged', { category: 'weapon', weight_coin: 30, pinned: true, item_data: { slot: 'hand', weapon: { damage: '1d6', modes: modes('grip', [{ id: 'one', name: 'One hand' }, { id: 'two', name: 'Two hands', damage: '1d8' }]) } } });
    line('line-p1-wand', 'Heron wand', { category: 'wand', weight_coin: 1, pinned: true, item_data: { charges: { initial: '2d4' } }, charges_left: 5 });
  }
  // Several ready weapons (frame P5b; pib-1, pib-2): a third in hand with a long name and its Grip, horns worn ready and
  // pinned (Attack and Stance, a row), a bow pinned with its quiver (Wield and Quiver, a row). Invented.
  if (head === 'arms') {
    const modes = (button: string, list: Record<string, unknown>[]) => ({ button, list });
    line('line-p1-axe', 'Hand axe of the Seven Cairns, twice reforged', { category: 'weapon', weight_coin: 30, equipped: true, item_data: { slot: 'hand', weapon: { damage: '1d6', modes: modes('grip', [{ id: 'one', name: 'One hand' }, { id: 'two', name: 'Two hands', damage: '1d8' }]) } } });
    line('line-p1-horns', 'Bog-ox horns', { category: 'weapon', weight_coin: 0, equipped: true, pinned: true, item_data: { slot: 'worn', weapon: { damage: '1d6', modes: modes('stance', [{ id: 'gore', name: 'Gore' }, { id: 'butt', name: 'Butt', damage: '1d4' }]) } } });
    line('line-p1-bow', 'Heron bow', { category: 'weapon', weight_coin: 30, pinned: true, item_data: { slot: 'hand', hands: 2, weapon: { damage: '1d6', modes: modes('quiver', [{ id: 'reed', name: 'Reed arrows', draws: { itemId: 'reed-arrows' } }, { id: 'bone', name: 'Bone arrows', draws: { itemId: 'bone-arrows' } }]) } } });
    line('line-p1-arrows', 'Reed arrows', { category: 'ammunition', weight_coin: 1, qty: 18, stack: 20, source_entry_id: 'reed-arrows' });
  }

  // Lit through the stand-in database, then two turns burn: 4 of 6 left.
  world.signInAs(sam);
  // The long-named light burns 1001 turns, so 999 are left (35D).
  const burn = (head === 'longlight' ? 1001 : 6) * TURN;
  if (head !== 'bare' && head !== 'packless' && head !== 'several' && head !== 'burntnone')
    await world.db.rpc('light_light' as never, { actor: brannoch, line: 'line-p1-lantern', light_type: 'storm-lantern', light_name: lanternName, burn_seconds: burn, warn_seconds: TURN, consumed: false, fuel_item: 'lamp-oil' } as never);
  world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds = 2 * TURN;
  // The light's states (page 35): put out, with 4 turns kept; or burnt out as the clock would leave it.
  const lightRow = () => world.tables.character_lights.find((l) => l.actor_id === brannoch)!;
  if (head === 'unlit') await world.db.rpc('douse_light' as never, { actor: brannoch } as never);
  if (head === 'burnt') Object.assign(lightRow(), { lit_at: null, left_seconds: null, out_at: 2 * TURN });
  // The last reed torch burnt out (its line went with it), as the database leaves a used-up light.
  if (head === 'burntnone') {
    world.tables.character_lights.push({
      id: 'light-p1', actor_id: brannoch, campaign_id: campaign, line_id: 'line-p1-torch-gone', type_id: 'reed-torch', name: 'Reed torch', lit_at: null, burn_seconds: 6 * TURN,
      full_seconds: 6 * TURN, warn_seconds: TURN, left_seconds: null, consumed: true, fuel_item: null, keep_lit: false, out_at: 2 * TURN, version: 2,
    });
  }

  // Four statuses: the blessing with no end (dashed), the others with time left.
  const status = (id: string, conditionId: string, name: string, extra: Record<string, unknown>) =>
    world.tables.character_statuses.push({
      id, campaign_id: campaign, actor_id: brannoch, name, condition_id: conditionId, icon: null, stacks: 1, stacking: false, levels: null, level: null, source: 'condition', note: null,
      started_at: 0, ends_at: null, total_seconds: null, unit: null, secret: false, ended_at: null, end_reason: null, undone: false, version: 1,
      created_at: `2026-11-15T09:10:0${world.tables.character_statuses.length % 10}Z`, ...extra,
    });
  status('status-p1-blessed', 'lantern-blessed', 'Lantern-blessed', {});
  status('status-p1-chilled', 'chilled', 'Chilled', { ends_at: 5 * TURN, total_seconds: 6 * TURN, unit: 'turn' });
  if (head !== 'two') {
    status('status-p1-heron', 'heron-sight', 'Heron sight', { ends_at: 8 * TURN, total_seconds: 9 * TURN, unit: 'turn' });
    status('status-p1-weary', 'weary', 'Weary', { ends_at: 12 * TURN, total_seconds: 12 * TURN, unit: 'turn' });
  }
  if (head === 'messy') {
    status('status-p1-cut', 'reed-cut', 'Reed-cut', { ends_at: 3 * TURN, total_seconds: 4 * TURN, unit: 'turn' });
    status('status-p1-mist', 'mist-dazed', 'Mist-dazed', { ends_at: 4 * TURN, total_seconds: 5 * TURN, unit: 'turn' });
    status('status-p1-song', 'heartened', 'Heartened by the long beacon song', { ends_at: 999 * TURN, total_seconds: 999 * TURN, unit: 'turn' });
    status('status-p1-soaked', 'soaked', 'Soaked', {});
    status('status-p1-watch', 'watchful', 'Watchful', { ends_at: 2 * TURN + 1, total_seconds: 6 * TURN, unit: 'turn' });
    world.tables.actors.find((a) => a.id === brannoch)!.name = P1_LONG_NAME;
  }
  return brannoch;
}
