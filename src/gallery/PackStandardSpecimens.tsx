// The Pack on creation's standard in the component gallery (plan m5b-players-screens-standard C; mockup players/01):
// the load line first, a group with its count, rows with their chevron (a pinned one with its star, one not allowed),
// an At hand row with its action, Gear and the Party stash as fold rows, the waiting card, the foot, and an item's
// sheet drawn in the page. Invented rules and names only (hard rule 2); no database (nothing here saves).
import type { ReactElement, ReactNode } from 'react';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import type { OpenCampaign } from '../app/Campaigns.tsx';
import { ItemRow } from '../app/ItemRow.tsx';
import { ItemSheet, useItemSheetState } from '../app/ItemSheet.tsx';
import { LoadSummary } from '../app/LoadSummary.tsx';
import { PackFoot, WaitingCard } from '../app/PackParts.tsx';
import { foldSummary, itemCount } from '../app/packHelpers.ts';
import '../app/PackScreen.css';
import { carriedLoad, combineEncumbrance, toLoadLine } from '../modules/inventory/encumbrance.ts';
import type { InventoryLine, NamedCarrier } from '../modules/inventory/inventory.ts';
import { FoldedGroup } from '../ui/creation.tsx';

const RULES = combineEncumbrance([
  {
    mode: 'coin',
    coin: {
      maxLoadCoin: 500,
      tiers: [
        { label: 'Unburdened', max: 300, movement: '40 ft' },
        { label: 'Laden', max: 500, movement: '20 ft' },
      ],
      overMax: 'Stuck in the mud',
    },
  },
]);

let next = 0;
const line = (name: string, more: Partial<InventoryLine> = {}): InventoryLine =>
  ({
    id: `gallery-pack-${++next}`,
    actorId: 'gallery-wren',
    locationId: null,
    name,
    category: 'gear',
    slots: null,
    stack: 1,
    qty: 1,
    containerLineId: null,
    equipped: false,
    approval: 'approved',
    details: {},
    weightCoin: 10,
    perUnits: 1,
    pinned: false,
    atHandHidden: false,
    chargesLeft: null,
    chargesHidden: false,
    chargesUsed: 0,
    spentShown: false,
    notes: '',
    libraryEntryId: null,
    sourcePackId: null,
    sourceEntryId: null,
    version: 1,
    ...more,
  }) as InventoryLine;

const WREN: NamedCarrier = { actorId: 'gallery-wren', locationId: null, name: 'Wren', ownerUserId: 'gallery-user' } as NamedCarrier;
const USER: CurrentUser = { id: 'gallery-user', roles: { 'gallery-campaign': 'player' } };
const CAMPAIGN = { id: 'gallery-campaign', name: 'Ash barrows' } as unknown as OpenCampaign;
// Nothing in the gallery saves: a tap on an action runs nothing.
const NO_DB = null as unknown as Db;
const run = async () => false;

const WORN = [
  line('Chain shirt', { equipped: true, weightCoin: 200, details: { slot: 'armour' } }),
  line('The long iron-shod reed spear of the drowned causeway wardens', { equipped: true, weightCoin: 60, details: { slot: 'hand' } }),
];
// The Pack's At hand group (Francis, 2026-11-07, on #552): pinned items with an action, each only there, each row with
// its button: a light's Light, arrows' Fire, a draught's Drink, a spear's Attack.
const PINNED = [
  line('Lantern', { equipped: true, pinned: true, weightCoin: 30, details: { slot: 'hand', lightTypeId: 'lantern' } }),
  line('Reed arrows', { pinned: true, category: 'ammunition', qty: 18, stack: 20, weightCoin: 1 }),
  line('Moss draught', { pinned: true, category: 'potion', weightCoin: 5 }),
  line('Reed spear', { equipped: true, pinned: true, category: 'weapon', weightCoin: 60, details: { slot: 'hand' } }),
];
const GEAR = [line('Coil of rope'), line('Dry rations', { qty: 3, stack: 7 }), line('Torch', { qty: 6, stack: 6 }), line('Chalk'), line('Eel trap')];
const STASH = [line('Silver ewer', { actorId: null }), line('Reed chest', { actorId: null })];
const WAND = line('Glow wand', { equipped: true, category: 'wand', chargesLeft: 2, details: { slot: 'hand' } });

/** One row, as the Pack draws it (nothing opens: the sheet is drawn below). */
function Row({
  item,
  atHand = false,
  problem = null,
  lines = WORN,
  light = null,
}: {
  item: InventoryLine;
  atHand?: boolean;
  problem?: string | null;
  lines?: InventoryLine[];
  light?: 'Light' | 'Put out' | null;
}) {
  return (
    <ItemRow
      db={NO_DB}
      user={USER}
      campaign={CAMPAIGN}
      line={item}
      carrier={WREN}
      lines={lines}
      mode="coin"
      rules={RULES}
      others={[]}
      may
      open={false}
      onToggle={() => undefined}
      atHand={atHand}
      lightAction={light ? { label: light, run: () => undefined } : null}
      busy={false}
      run={run}
      entry={null}
      chargeRules={{ hidden: false, dice: { wand: '2d6' }, rechargeable: false }}
      rechargeDefault={false}
      onNote={() => undefined}
      secret={null}
      packShortName={null}
      problem={problem}
      castingNote={null}
      blockedEquip={null}
    />
  );
}

/** An item's sheet drawn in the page (the gallery's preview): the description, the actions as rows, Drop apart. */
function SheetPicture({ item }: { item: InventoryLine }) {
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
      carrier={WREN}
      lines={[...WORN, ...GEAR, line('Backpack', { details: { container: { capacityCoin: 400 } } })]}
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
      packShortName={null}
      problem={null}
      blockedEquip={null}
      onNote={() => undefined}
    />
  );
}

export function PackStandardSpecimens({ Specimen }: { Specimen: (props: { name: string; children: ReactNode }) => ReactElement }) {
  const all = [...PINNED, ...WORN, ...GEAR];
  const load = carriedLoad(all.map(toLoadLine), RULES, 'coin');
  return (
    <>
      <Specimen name="The Pack: the load line first, At hand (pinned items with an action: Light, Fire, Drink, Attack), Worn and in hand with its count (a row not allowed, a long name), Gear and the Party stash as fold rows, the waiting card, the foot with Add item">
        <section className="pack" aria-label="Wren’s pack, in the gallery">
          <div className="pack__summary">
            <LoadSummary load={load} rules={RULES} from={['Fen rules']} />
          </div>
          <div className="pack__list">
            <section className="pack__group pack__group--at-hand" aria-label="At hand">
              <div className="pack__group-head">
                <h2 className="pack__group-title">At hand</h2>
                <span className="auth__meta">{itemCount(PINNED.length)}</span>
              </div>
              <ul className="pack__rows">
                <Row item={PINNED[0]!} atHand light="Light" lines={all} />
                <Row item={PINNED[1]!} atHand lines={all} />
                <Row item={PINNED[2]!} atHand lines={all} />
                <Row item={PINNED[3]!} atHand lines={all} />
              </ul>
            </section>
            <section className="pack__group" aria-label="Worn and in hand">
              <div className="pack__group-head">
                <h2 className="pack__group-title">Worn and in hand</h2>
                <span className="auth__meta">{itemCount(WORN.length)}</span>
              </div>
              <ul className="pack__rows">
                <Row item={WORN[0]!} problem="Bog mages can’t wear chain." />
                <Row item={WORN[1]!} />
              </ul>
            </section>
            <section className="pack__group" aria-label="Gear">
              <FoldedGroup label="Gear" note={foldSummary(GEAR)} detail="Not counted for speed">
                {null}
              </FoldedGroup>
            </section>
            <WaitingCard names={['Silver knife', 'Strange key']} onOpen={() => undefined} />
            <section className="pack__stash" aria-label="Party stash, in the gallery">
              <FoldedGroup label="Party stash" note={foldSummary(STASH)}>
                {null}
              </FoldedGroup>
            </section>
            <PackFoot count={20} onAdd={() => undefined} />
          </div>
        </section>
      </Specimen>
      <Specimen name="At hand on the Player screen: a row carries its action where a command exists (Use a charge, Put out); its body opens the item's sheet">
        <section className="pack pack--at-hand" aria-label="At hand, in the gallery">
          <ul className="pack__rows">
            <Row item={WAND} atHand lines={[WAND]} />
            <Row item={PINNED[0]!} atHand light="Put out" lines={PINNED} />
          </ul>
        </section>
      </Specimen>
      <Specimen name="An item's sheet: the description, the actions as rows (a chevron where one asks more), Drop last and set apart; the star beside ✕ pins it">
        <SheetPicture item={line('Lantern', { weightCoin: 30, notes: 'Bullseye lantern, a 30 ft beam. Three flasks of oil left.', details: { slot: 'hand' } })} />
      </Specimen>
      <Specimen name="An item's sheet, pinned: the star filled and washed, Unpin for a screen reader">
        <SheetPicture item={line('Coil of rope', { pinned: true, qty: 2, stack: 5 })} />
      </Specimen>
    </>
  );
}
