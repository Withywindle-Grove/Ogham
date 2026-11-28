// At hand's weapon actions in the component gallery (ruling m5b-at-hand-actions-2026-11-08; mockup players/06): Wield on
// a pinned weapon not in hand, Attack once it is, the mode button beside it (Quiver, Grip), the spent state, the Attack
// sheet, the mode sheets and the blocked Attack's sheet. Invented rules and names only (hard rule 2); nothing saves.
import type { ReactElement, ReactNode } from 'react';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import type { OpenCampaign } from '../app/Campaigns.tsx';
import { ItemRow } from '../app/ItemRow.tsx';
import { AtHandFacts, AttackSheet, AttackView, chargeFact, ModeSheet, SpentSheet } from '../app/AtHandSheets.tsx';
import { ItemSheet, useItemSheetState } from '../app/ItemSheet.tsx';
import '../app/PackScreen.css';
import { BookPopUpScope } from '../ui/Dialog.tsx';
import { combineEncumbrance } from '../modules/inventory/encumbrance.ts';
import type { InventoryLine, NamedCarrier } from '../modules/inventory/inventory.ts';
import { attackRange, attackRules, modeState, weaponModesOf, type ModeState } from '../modules/inventory/weaponModes.ts';
import { weaponMagic, weaponRolls } from '../modules/characters/play.ts';
import { weaponPenalty, type Proficiency } from '../modules/characters/weaponSkills.ts';
import type { Filled } from '../modules/library/fills.ts';

const RULES = combineEncumbrance([{ mode: 'coin', coin: { maxLoadCoin: 500, tiers: [{ label: 'Unburdened', max: 300, movement: '40 ft' }] } }]);

let next = 0;
const line = (name: string, more: Partial<InventoryLine> = {}): InventoryLine =>
  ({
    id: `gallery-at-hand-${++next}`,
    actorId: 'gallery-dorn',
    locationId: null,
    name,
    category: 'weapon',
    slots: null,
    stack: 1,
    qty: 1,
    containerLineId: null,
    equipped: false,
    approval: 'approved',
    details: {},
    weightCoin: 10,
    perUnits: 1,
    pinned: true,
    atHandHidden: false,
    chargesLeft: null,
    chargesHidden: false,
    chargesUsed: 0,
    spentShown: false,
    notes: '',
    libraryEntryId: null,
    sourcePackId: 'gallery-fen',
    sourceEntryId: null,
    version: 1,
    ...more,
  }) as InventoryLine;

const DORN: NamedCarrier = { actorId: 'gallery-dorn', locationId: null, name: 'Dorn', ownerUserId: 'gallery-user' } as NamedCarrier;
const USER: CurrentUser = { id: 'gallery-user', roles: { 'gallery-campaign': 'player' } };
const CAMPAIGN = { id: 'gallery-campaign', name: 'Ash barrows' } as unknown as OpenCampaign;
const NO_DB = null as unknown as Db;
const run = async () => false;

const BOW = {
  name: 'Reed bow',
  slot: 'hand',
  hands: 2,
  weapon: {
    damage: '1d6',
    qualities: ['Missile', 'Two-handed'],
    // The range as its own field (as-2, G-219): feet, yards outdoors, from 5.
    range: { unit: 'feet', wildernessUnit: 'yards', from: 5, bands: [{ name: 'Short', upTo: 160, toHit: 1 }, { name: 'Medium', upTo: 320, toHit: 0 }, { name: 'Long', upTo: 480, toHit: -1 }] },
    modes: {
      button: 'quiver',
      list: [
        { id: 'reed', name: 'Reed arrows', draws: { itemId: 'reed-arrows' } },
        { id: 'bone', name: 'Bone-tipped arrows', draws: { itemId: 'bone-arrows' }, note: 'counts as bone' },
        { id: 'ember', name: 'Ember arrows', draws: { itemId: 'ember-arrows' }, damage: '1d8' },
      ],
    },
  },
};
const SPEAR = {
  slot: 'hand',
  weaponTags: ['Melee', 'Missile'],
  weapon: { damage: '1d6', qualities: ['Melee', 'Missile', 'Brace'], modes: { button: 'grip', list: [{ id: 'melee', name: 'Melee', qualities: ['Melee', 'Brace'] }, { id: 'thrown', name: 'Thrown', qualities: ['Missile'], note: 'the spear leaves your hand' }] } },
};
const ARROWS = [
  line('Reed arrows', { category: 'ammunition', pinned: false, qty: 18, stack: 20, weightCoin: 1, sourceEntryId: 'reed-arrows' }),
  line('Bone-tipped arrows', { category: 'ammunition', pinned: false, qty: 4, stack: 20, weightCoin: 1, sourceEntryId: 'bone-arrows' }),
];
const BOW_LINE = line('Reed bow', { equipped: true, details: BOW });
const SPEAR_LINE = line('Eel spear', { equipped: true, details: SPEAR });
const AXE_LINE = line('Hand axe', { details: { slot: 'hand', weapon: { damage: '1d6', qualities: ['Melee'] } } });
const LONG_LINE = line('The long iron-shod reed spear of the drowned causeway wardens', { details: { slot: 'hand', weapon: { damage: '1d8' } } });
const ALL = [BOW_LINE, SPEAR_LINE, AXE_LINE, LONG_LINE, ...ARROWS];

const stateOf = (item: InventoryLine, chosen: string | null, lines: InventoryLine[] = ALL): ModeState => modeState(weaponModesOf(item.details)!, chosen, lines, DORN.actorId);
// Fresh (nothing stored): the plain arrows it carries. Spent: a stored kind with none left. Empty: no arrows at all.
const BOW_STATE = stateOf(BOW_LINE, null);
const SPENT_STATE = stateOf(BOW_LINE, 'ember');
const EMPTY_STATE = stateOf(BOW_LINE, null, [BOW_LINE]);
// The Player screen's rows (dec-13 C6): the bow and spear at hand, not in hand (Quiver, Grip beside Wield); a wand with
// charges (Use); a draught to use one up (Drink, the generic mark until an icon is ruled).
const BOW_AT_HAND = { ...BOW_LINE, id: 'gallery-at-hand-bow-pinned', equipped: false };
const SPEAR_AT_HAND = { ...SPEAR_LINE, id: 'gallery-at-hand-spear-pinned', equipped: false };
const WAND_LINE = line('Heron wand', { category: 'wand', details: { charges: { initial: '2d4' } }, chargesLeft: 5 });
const DRAUGHT_LINE = line('Moss draught', { category: 'draught', qty: 2, stack: 5 });

/** One At hand row, as the Pack and the Player screen draw it (nothing opens). */
function Row({
  item,
  figure,
  state = null,
  stacked = false,
  inHand = false,
  rolls = [],
}: {
  item: InventoryLine;
  figure: string;
  state?: ModeState | null;
  stacked?: boolean;
  /** The weapon in hand's block (dec-13 C14), with its roll lines from `rolls`. */
  inHand?: boolean;
  rolls?: ReturnType<typeof weaponRolls>;
}) {
  return (
    <ItemRow
      db={NO_DB}
      user={USER}
      campaign={CAMPAIGN}
      line={item}
      carrier={DORN}
      lines={ALL}
      mode="coin"
      rules={RULES}
      others={[]}
      may
      open={false}
      onToggle={() => undefined}
      atHand
      inHand={inHand}
      weaponRolls={rolls}
      stackedButtons={stacked}
      busy={false}
      run={run}
      entry={null}
      chargeRules={{ hidden: false, dice: {}, rechargeable: false }}
      rechargeDefault={false}
      onNote={() => undefined}
      secret={null}
      packShortName={null}
      problem={null}
      castingNote={null}
      blockedEquip={null}
      weapon={figure}
      modeView={state}
    />
  );
}

// The Attack sheet's rolls (as-1) as weaponRolls works them out for an invented Fen warden: the class's figure at its
// level, the scores' modifiers by full name and score, Might adding to melee damage only.
const WARDEN = { progression: [{ level: 1, attackBonus: 1 }, { level: 2, attackBonus: 1 }] };
const DAMAGE_BY_MIGHT = [{ attack: { damageScore: 'MIG' } }];
const NAMES: Record<string, string> = { NIM: 'Nimbleness', MIG: 'Might' };
const rollsFor = (item: Record<string, unknown>, filled: Filled, scores: Record<string, number>, more: Parameters<typeof weaponRolls>[5] = {}) =>
  weaponRolls(item, filled, WARDEN, 2, DAMAGE_BY_MIGHT, { klassName: 'Fen warden', longName: (k) => NAMES[k] ?? k, scoreOf: (k) => scores[k] ?? null, ...more });
const BOW_ROLLS = rollsFor(BOW, { 'abilityModifiers.NIM': { missile: 0 }, 'abilityModifiers.MIG': { melee: 1 } }, { NIM: 10, MIG: 16 });
const SPEAR_ROLLS = rollsFor({ name: 'Eel spear', weapon: { damage: '1d6', qualities: ['Melee'] } }, { 'abilityModifiers.MIG': { melee: 1 } }, { MIG: 16 });
// Messy data: a long name, nothing to add on the to-hit roll (+1 and −1), a minus on the damage.
const KNIFE = { name: 'The long knife of the drowned causeway’s last warden', weapon: { damage: '1d4', qualities: ['Melee'] } };
const KNIFE_ROLLS = rollsFor(KNIFE, { 'abilityModifiers.MIG': { melee: -1 } }, { MIG: 5 });
// A setting that reads the hit from a target figure (descending armour): the line adds, with no "to hit" and no note
// on who reads the hit (tfw-2, 2026-11-19).
const TARGET_ROLLS = weaponRolls(BOW, { 'abilityModifiers.NIM': { missile: 1 } }, { progression: [{ level: 2, thac0: 19 }] }, 2, [], {
  direction: 'descending',
  klassName: 'Fen warden',
  longName: (k) => NAMES[k] ?? k,
  scoreOf: () => 13,
});
// A magic weapon (mw-1, mw-2): its bonus a part of both rolls; a bonus against a kind of foe a note, never added.
const FENBLADE = {
  name: 'Fenblade',
  weapon: { damage: '1d8', qualities: ['Melee'], magicBonus: 1, bonusVs: [{ against: 'bog lurkers', bonus: 3 }, { against: 'marsh wights', damage: 4 }] },
};
const FENBLADE_ROLLS = rollsFor(FENBLADE, { 'abilityModifiers.MIG': { melee: 1 } }, { MIG: 16 }, { magic: weaponMagic({ name: 'Fenblade', data: FENBLADE }, [], false) });
// Magic arrows from a magic bow where the setting adds both (mw-3, `attack.ammunitionBonus: "add"`).
const ADD_AMMO = [{ attack: { ammunitionBonus: 'add' } }];
const EMBER = { name: 'Ember arrows', category: 'ammunition', weapon: { magicBonus: 1 } };
const MAGIC_BOW = { ...BOW, name: 'Heron bow', weapon: { ...BOW.weapon, magicBonus: 2 } };
const MAGIC_BOW_ROLLS = rollsFor(MAGIC_BOW, { 'abilityModifiers.NIM': { missile: 0 } }, { NIM: 10 }, {
  magic: weaponMagic({ name: 'Heron bow', data: MAGIC_BOW }, ADD_AMMO, false, { name: 'Ember arrows', data: EMBER, category: 'ammunition' }),
});
// Magic arrows from a plain bow in a setting with no ammunition rule (mw-5): the arrows' bonus counts, no note.
const PLAIN_BOW = { name: 'Reed bow', weapon: { damage: '1d6', qualities: ['Missile', 'Two-handed'] } };
const PLAIN_BOW_ROLLS = rollsFor(PLAIN_BOW, { 'abilityModifiers.NIM': { missile: 0 } }, { NIM: 10 }, {
  magic: weaponMagic({ name: 'Reed bow', data: PLAIN_BOW }, [], false, { name: 'Ember arrows', data: EMBER, category: 'ammunition' }),
});
// A weapon skill in the rolls (as-4), worked out by weaponPenalty for an invented Fen warden who may use melee weapons:
// specialised in the eel spear, no skill in the reed flail, and the reed bow picked as a GM-approved exception.
const PROFICIENCY: Proficiency = { note: '', start: 3, gainEvery: null, penalty: -2, specialisation: { cost: 2, attack: 1, damage: 2, note: '' }, restricted: { note: '' } };
const MELEE_ONLY = { weaponsAllowed: { mode: 'tags', allowTags: ['Melee'] } };
const PICKS = [{ itemId: 'eel-spear', specialised: true as const }, { itemId: 'reed-bow' }];
const skillOf = (id: string, data: Record<string, unknown>) => weaponPenalty(PICKS, { packEntryId: id, name: '', data }, MELEE_ONLY, PROFICIENCY);
const EEL_SPEAR = { name: 'Eel spear', weaponTags: ['Melee'], weapon: { damage: '1d6', qualities: ['Melee'] } };
const SPECIALISED_ROLLS = rollsFor(EEL_SPEAR, { 'abilityModifiers.MIG': { melee: 1 } }, { MIG: 16 }, { skill: skillOf('eel-spear', EEL_SPEAR) });
const FLAIL = { name: 'Reed flail', weaponTags: ['Melee'], weapon: { damage: '1d6', qualities: ['Melee'] } };
const UNSKILLED_ROLLS = rollsFor(FLAIL, { 'abilityModifiers.MIG': { melee: 1 } }, { MIG: 16 }, { skill: skillOf('reed-flail', FLAIL) });
const APPROVED_ROLLS = rollsFor(PLAIN_BOW, { 'abilityModifiers.NIM': { missile: 0 } }, { NIM: 10 }, { skill: skillOf('reed-bow', PLAIN_BOW) });
// Specialised in the reed bow, outside the class, with the GM's approval (as-7): both rows, netted in the line.
const SPECIALISED_OUTSIDE_ROLLS = rollsFor(PLAIN_BOW, { 'abilityModifiers.NIM': { missile: 0 } }, { NIM: 10 }, {
  skill: weaponPenalty([{ itemId: 'reed-bow', specialised: true }], { packEntryId: 'reed-bow', name: '', data: PLAIN_BOW }, MELEE_ONLY, PROFICIENCY),
});
// Magic arrows with a bonus against a kind of foe, from a magic bow where the setting says nothing, as the player sees
// them (as-6): the bow's bonus counts, the arrows' plain bonus doesn't (mw-4), their bonus against bog lurkers a note.
const EMBER_VS = { ...EMBER, weapon: { magicBonus: 1, bonusVs: [{ against: 'bog lurkers', bonus: 3 }] } };
const MAGIC_BOW_VS_ROLLS = rollsFor(MAGIC_BOW, { 'abilityModifiers.NIM': { missile: 0 } }, { NIM: 10 }, {
  magic: weaponMagic({ name: 'Heron bow', data: MAGIC_BOW }, [], false, { name: 'Ember arrows', data: EMBER_VS, category: 'ammunition' }),
});

export function AtHandSpecimens({ Specimen }: { Specimen: (props: { name: string; children: ReactNode }) => ReactElement }) {
  return (
    <>
      <Specimen name="At hand rows: Attack with the mode button beside it (Quiver, Grip), Wield on a pinned weapon not in hand, a long name, the spent state (Quiver: nothing chosen), no arrows at all">
        <section className="pack pack--at-hand" aria-label="At hand, in the gallery">
          <ul className="pack__rows">
            <Row item={BOW_LINE} figure="+0, 1d6" state={BOW_STATE} />
            <Row item={SPEAR_LINE} figure="+2, 1d6" state={stateOf(SPEAR_LINE, null)} />
            <Row item={AXE_LINE} figure="+2, 1d6" />
            <Row item={LONG_LINE} figure="+2, 1d8" />
            <Row item={BOW_LINE} figure="+0, 1d6" state={SPENT_STATE} />
            <Row item={BOW_LINE} figure="+0, 1d6" state={EMPTY_STATE} />
          </ul>
        </section>
      </Specimen>
      <Specimen name="The Attack sheet: the two rolls first, each line with its sum and its parts as rows; the range with its unit; two-handed said once; the rules that bear, Fire one">
        <AttackSheet
          preview
          name="Reed bow"
          figure="+1, 1d6"
          rolls={BOW_ROLLS}
          range={attackRange(BOW_LINE.details, null)}
          rules={attackRules(BOW_LINE.details, null, ['counts as bone'])}
          inflicts={[{ name: 'Fen sting', note: 'Slow for a turn' }]}
          spend={{ label: 'Fire one, 3 left after', run: () => undefined }}
          onClose={() => undefined}
        />
      </Specimen>
      <Specimen name="The Attack sheet, melee: a bonus on both rolls, no range, nothing spent">
        <AttackSheet preview name="Eel spear" figure="+2, 1d6+1" rolls={SPEAR_ROLLS} rules={['Melee']} spend={null} onClose={() => undefined} />
      </Specimen>
      <Specimen name="The Attack sheet, messy: a long name, nothing to add to the to-hit roll, a minus on the damage">
        <AttackSheet preview name={KNIFE.name} figure="+0, 1d4−1" rolls={KNIFE_ROLLS} rules={[]} spend={null} onClose={() => undefined} />
      </Specimen>
      <Specimen name="The Attack sheet, a target figure: the line adds the scores, with no note under it">
        <AttackSheet preview name="Reed bow" figure="THAC0 18, 1d6" rolls={TARGET_ROLLS} range={attackRange(BOW, null)} rules={attackRules(BOW, null)} spend={null} onClose={() => undefined} />
      </Specimen>
      <Specimen name="The Attack sheet, magic: the weapon's bonus a part of both rolls, its bonus against a kind of foe a note">
        <AttackSheet preview name="Fenblade" figure="+3, 1d8+2" rolls={FENBLADE_ROLLS} rules={['Melee']} spend={null} onClose={() => undefined} />
      </Specimen>
      <Specimen name="The Attack sheet, magic arrows from a magic bow where the setting adds both">
        <AttackSheet preview name="Heron bow" figure="+4, 1d6+3" rolls={MAGIC_BOW_ROLLS} range={attackRange(MAGIC_BOW, null)} rules={attackRules(MAGIC_BOW, null)} spend={null} onClose={() => undefined} />
      </Specimen>
      <Specimen name="The Attack sheet, magic arrows from a plain bow where the setting says nothing: the arrows' bonus counts, no note">
        <AttackSheet preview name="Reed bow" figure="+2, 1d6+1" rolls={PLAIN_BOW_ROLLS} rules={attackRules(PLAIN_BOW, null)} spend={null} onClose={() => undefined} />
      </Specimen>
      <Specimen name="The Attack sheet, specialised: a Specialised row in both rolls, counted in each line">
        <AttackSheet preview name="Eel spear" figure="+3, 1d6+3" rolls={SPECIALISED_ROLLS} rules={['Melee']} spend={null} onClose={() => undefined} />
      </Specimen>
      <Specimen name="The Attack sheet, not a weapon skill: the penalty a row of the to-hit roll">
        <AttackSheet preview name="Reed flail" figure="+0, 1d6+1" rolls={UNSKILLED_ROLLS} rules={['Melee']} spend={null} onClose={() => undefined} />
      </Specimen>
      <Specimen name="The Attack sheet, a weapon outside the class the GM approved: the penalty still a row of the to-hit roll">
        <AttackSheet preview name="Reed bow" figure="−1, 1d6" rolls={APPROVED_ROLLS} rules={attackRules(PLAIN_BOW, null)} spend={null} onClose={() => undefined} />
      </Specimen>
      <Specimen name="The Attack sheet, specialised in a weapon outside the class: both rows, netted in the line">
        <AttackSheet preview name="Reed bow" figure="+0, 1d6+2" rolls={SPECIALISED_OUTSIDE_ROLLS} rules={attackRules(PLAIN_BOW, null)} spend={null} onClose={() => undefined} />
      </Specimen>
      <Specimen name="The Attack sheet, magic arrows from a magic bow where the setting says nothing, as the player sees it: the arrows' bonus against a kind of foe a note">
        <AttackSheet preview name="Heron bow" figure="+3, 1d6+2" rolls={MAGIC_BOW_VS_ROLLS} range={attackRange(MAGIC_BOW, null)} rules={attackRules(MAGIC_BOW, null)} spend={null} onClose={() => undefined} />
      </Specimen>
      <Specimen name="The Quiver sheet: the arrow stacks carried as pick rows, the one in use Picked; the kind not carried not listed (tfh-6)">
        <ModeSheet preview weaponName="Reed bow" state={BOW_STATE} lines={ALL} actorId={DORN.actorId} weaponDamage="1d6" onPick={() => undefined} onClose={() => undefined} />
      </Specimen>
      <Specimen name="The Grip sheet: a weapon with modes and no stack, melee or thrown">
        <ModeSheet preview weaponName="Eel spear" state={stateOf(SPEAR_LINE, null)} lines={ALL} actorId={DORN.actorId} weaponDamage="1d6" onPick={() => undefined} onClose={() => undefined} />
      </Specimen>
      <Specimen name="A blocked Attack: the mode's stack is spent; why, and Quiver (ic-3)">
        <SpentSheet preview weaponName="Reed bow" state={SPENT_STATE} onOpenModes={() => undefined} onClose={() => undefined} />
      </Specimen>
      <Specimen name="At hand rows on the Player screen (dec-13 C6; frames P1, P2): stacked buttons with their icons, one size at the right; the weapon in hand's block (C14) with Quiver beside Attack on their own line; Quiver and Grip beside Wield, Use on a wand, Drink with the generic mark, a long name">
        <section className="pack pack--in-hand" aria-label="The weapon in hand on the Player screen, in the gallery">
          <ul className="pack__rows">
            <Row item={BOW_LINE} figure="+0, 1d6" state={BOW_STATE} stacked inHand rolls={BOW_ROLLS} />
          </ul>
        </section>
        <section className="pack pack--at-hand" aria-label="At hand on the Player screen, in the gallery">
          <ul className="pack__rows">
            <Row item={BOW_AT_HAND} figure="+0, 1d6" state={stateOf(BOW_AT_HAND, null)} stacked />
            <Row item={SPEAR_AT_HAND} figure="+2, 1d6" state={stateOf(SPEAR_AT_HAND, null)} stacked />
            <Row item={LONG_LINE} figure="+2, 1d8" stacked />
            <Row item={WAND_LINE} figure="" stacked />
            <Row item={DRAUGHT_LINE} figure="" stacked />
          </ul>
        </section>
      </Specimen>
      <Specimen name="The Quiver with no kind carried (tfh-6; page M2, frame M2o): one line, and ✕ alone; on the Player tab, under the book's red heading (tfb-1, row C8)">
        <BookPopUpScope.Provider value>
          <ModeSheet preview weaponName="Reed bow" state={EMPTY_STATE} lines={[BOW_LINE]} actorId={DORN.actorId} weaponDamage="1d6" onPick={() => undefined} onClose={() => undefined} />
        </BookPopUpScope.Provider>
      </Specimen>
      <Specimen name="The At hand pop-up on the Player tab (tfh-1, tfh-2, tfh-4; page M2, frame M2l), under the book's red heading (tfb-1, row C8): a weapon in hand, not pinned; the Attack view, the empty star, then Give to…, Put in…, Hide from At hand and Drop with their icons">
        <BookPopUpScope.Provider value>
          <Popup item={SPEAR_IN_HAND} top={<AttackView figure="+2, 1d6+1" rolls={SPEAR_ROLLS} rules={['Melee']} spend={null} />} />
        </BookPopUpScope.Provider>
      </Specimen>
      <Specimen name="The At hand pop-up, a pinned bow not in hand (frame M2m): the star filled, the range, Fire one, no Hide from At hand">
        <BookPopUpScope.Provider value>
          <Popup item={BOW_AT_HAND} top={<AttackView figure="+0, 1d6" rolls={BOW_ROLLS} range={attackRange(BOW_LINE.details, null)} rules={attackRules(BOW_LINE.details, null)} spend={{ label: 'Fire one, 17 left after', run: () => undefined }} />} />
        </BookPopUpScope.Provider>
      </Specimen>
      <Specimen name="The At hand pop-up, a wand worn (tfh-3; frame M2n): its charges, its own description and source, the star; a long name">
        <BookPopUpScope.Provider value>
          <Popup item={WAND_WORN} top={<AtHandFacts facts={[{ label: 'Charges', value: chargeFact('5 charges left') }]} />} describe />
        </BookPopUpScope.Provider>
      </Specimen>
      <Specimen name="The At hand pop-up, a lit lantern (frame M2n): its light and refills, its own description and source">
        <BookPopUpScope.Provider value>
          <Popup item={LANTERN_LINE} top={<AtHandFacts facts={[{ label: 'Light', value: 'Lit, 4 turns left' }, { label: 'Refills', value: '3 left' }]} />} describe />
        </BookPopUpScope.Provider>
      </Specimen>
    </>
  );
}

// The Player tab's At hand pop-up (tfh-1 to tfh-5): the spear in hand and not pinned; a wand worn with charges, its
// own words and source; a lantern pinned and lit (invented words and pages).
const SPEAR_IN_HAND = { ...SPEAR_LINE, id: 'gallery-at-hand-spear-in-hand', pinned: false };
const WAND_WORN = line('The heron-bone wand of the fen-reed wardens, re-strung twice', {
  category: 'wand',
  equipped: true,
  pinned: false,
  chargesLeft: 5,
  details: { slot: 'hand', charges: { initial: '2d4' }, description: 'Its tip gives a cold light for one turn, bright enough to read by at ten paces.', source: 'p. 96' },
});
const LANTERN_LINE = line('Storm lantern', { category: 'light', details: { description: 'A shuttered lantern that keeps its flame in wind and rain.', source: 'p. 93' } });

/** The At hand pop-up as the Player tab opens it: the item's sheet in its `atHand` variant, drawn in the page. */
function Popup({ item, top, describe = false }: { item: InventoryLine; top: ReactNode; describe?: boolean }) {
  const state = useItemSheetState(item);
  return (
    <ItemSheet
      preview
      onClose={() => undefined}
      state={state}
      db={NO_DB}
      user={USER}
      campaign={CAMPAIGN}
      line={item}
      carrier={DORN}
      lines={[...ALL, item, line('Backpack', { category: 'container', pinned: false, details: { container: { capacityCoin: 400 } } })]}
      mode="coin"
      rules={RULES}
      others={[]}
      may
      busy={false}
      run={run}
      entry={null}
      chargeRules={{ hidden: false, dice: {}, rechargeable: false }}
      rechargeDefault={false}
      secret={null}
      packShortName="River rules"
      problem={null}
      blockedEquip={null}
      onNote={() => undefined}
      atHand={{ top, describe }}
    />
  );
}
