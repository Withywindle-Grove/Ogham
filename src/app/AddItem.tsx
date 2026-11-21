// Add an item (docs/05-features.md "Add an item"; rulings 2026-10-23). A sheet: beside the pack on a landscape
// tablet, full screen elsewhere. The search stays at the top; the campaign's items are grouped by category,
// collapsed (a search opens the matches in every category). Players see only items for sale (07, forSale)
// unless the GM lets them see all, and choose Bought or No cost; what the GM adds is given by the GM, with an
// optional note. A bundle adds its units. "Not listed?" makes a one-off: a player's waits for the GM's approval;
// the GM's goes straight into the campaign's homebrew, so it shows in search from then on.
// The creation variant (06 Add item sheet; cr-14, mockup creation/06; m5b-0c slice 5) is the Gear step's shop: the
// step's tally at the top (Gold to spend, the load, Undo last), each row's price and an Add that buys at once (how
// many is asked only for a stackable item), what a row can't afford answered in words, and Done shopping.
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import type { EncumbranceMode } from '../core/campaignSettings.ts';
import { isGm, runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { chargesOf } from '../modules/inventory/charges.ts';
import { addItem, equipItem, type HowGot, type InventoryLine, type ItemCopy, type NamedCarrier } from '../modules/inventory/inventory.ts';
import { baseArmourChoices } from '../modules/characters/play.ts';
import { BaseArmourChoice } from './BaseArmour.tsx';
import { findHomebrewItem, saveHomebrewEntry } from '../modules/library/homebrew.ts';
import type { ResolvedEntry } from '../modules/library/stack.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import type { CampaignSetting } from './campaignSetting.ts';
import { checkEquip, EquipWarningCard, type EquipCheck } from './EquipWarning.tsx';
import { homebrewItem } from './PackScreen.tsx';
import { registry } from './services.ts';
import './PackScreen.css';
import type { CastingStop } from '../modules/inventory/equipWarnings.ts';
import { useErrorToast, useToast } from '../ui/ToastHost.tsx';
import { isWornSlot, roomLeft } from '../modules/inventory/packView.ts';
import { entriesInPlay } from '../modules/library/optionGate.ts';
import { DestinationList, StockRow, type Destination } from '../ui/parts.tsx';
import { Icon } from '../ui/icons.tsx';
import { rememberPlace, startingPlace } from './lastPlace.ts';
import { ItemEntry } from './ItemEntry.tsx';

const whole = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);

/** An entry's price as a pack writes it ({ "gp": 40 } → "40 gp"). */
export function priceText(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return Object.entries(value as Record<string, unknown>)
    .filter(([, amount]) => typeof amount === 'number')
    .map(([coin, amount]) => `${String(amount)} ${coin}`)
    .join(' ');
}

/** Whether a shop sells it (07, forSale): as the pack says, else everything but the magic categories. */
export function forSale(entry: { data: Record<string, unknown> }): boolean {
  if (typeof entry.data.forSale === 'boolean') return entry.data.forSale;
  const category = typeof entry.data.category === 'string' ? entry.data.category : '';
  return !/(^|-)magic(-|$)/.test(category);
}

/** "magic-misc" → "Magic misc" when the setting rules give no name. */
const tidied = (id: string) => (id ? `${id.charAt(0).toUpperCase()}${id.slice(1).replace(/[-_]+/g, ' ')}` : 'Other');

/** A bundle's size (07, bundle), or 1. */
export const bundleOf = (entry: ResolvedEntry) => {
  const size = whole(entry.data.bundle);
  return size && size > 1 ? size : 1;
};

export const copyOf = (entry: ResolvedEntry): ItemCopy => ({
  libraryEntryId: entry.entryId ?? null,
  name: entry.name,
  category: typeof entry.data.category === 'string' ? entry.data.category : '',
  weightCoin: whole(entry.data.weightCoin),
  slots: whole(entry.data.slots),
  stack: whole(entry.data.stack) || 1,
});

/** A one-off by its name (rc-3: a `{ name }` gear line, a trinket): no library item, no weight or price. */
export const oneOffCopy = (name: string): ItemCopy => ({ libraryEntryId: null, name, category: '', weightCoin: null, slots: null, stack: 1 });

/** The Add item sheet's creation variant: the shop on the Gear step (the step owns the money and the Undo). */
export interface ShopMode {
  /** The tally at the top: Gold to spend, the load, Undo last. */
  top: ReactNode;
  /** An item's price in words ("7 gp 5 sp"), or null when it has none (then it isn't offered). */
  price: (entry: ResolvedEntry) => string | null;
  /** What buying this many answers instead of happening ("12 gp short."), or null when it fits. */
  short: (entry: ResolvedEntry, qty: number) => string | null;
  /** The cost noted on the line. */
  cost: (entry: ResolvedEntry, qty: number) => string;
  /** Why the character can't use it, or '' ("A Reed Witch can't use it." and the pack's reason; Buy still works, cs-21). */
  note: (entry: ResolvedEntry) => string;
  onBought: (entry: ResolvedEntry, line: InventoryLine, qty: number) => void;
  onDone: () => void;
}

export function AddItem({
  db,
  user,
  campaign,
  carrier,
  setting,
  mode,
  containers,
  lines,
  onBack,
  onAdded,
  shop,
}: {
  /** Everything the carrier has, for the equip checks when it goes straight on. */
  lines: InventoryLine[];
  db: Db;
  user: CurrentUser;
  campaign: Pick<OpenCampaign, 'id' | 'name'>;
  carrier: NamedCarrier;
  setting: CampaignSetting;
  mode: EncumbranceMode;
  containers: InventoryLine[];
  onBack: () => void;
  /** Added; `bought` says whether to show the purse note where the screen lands (until M7). */
  onAdded: (bought: boolean, added?: InventoryLine) => void;
  /** The creation variant: the Gear step's shop. */
  shop?: ShopMode;
}) {
  const searchId = useId();
  const blocked = useBlockedSheet();
  const gm = isGm(user, campaign.id);
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [picked, setPicked] = useState<ResolvedEntry | null>(null);
  // A shop row's item opened to read (R3-10).
  const [reading, setReading] = useState<ResolvedEntry | null>(null);
  const [oneOff, setOneOff] = useState<{ name: string; amount: string } | null>(null);
  const [qty, setQty] = useState(1);
  const [howGot, setHowGot] = useState<HowGot>(gm ? 'given' : 'bought');
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');
  const [place, setPlace] = useState<string>('carried');
  // Magic armour whose base is picked when it's found (ruled 2026-10-29): asked once, here; optional.
  const [baseArmour, setBaseArmour] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setProblem = useErrorToast();
  // Going straight on runs the same equip checks as Wear it / In hand on the Pack (ruled 2026-10-25).
  const [warned, setWarned] = useState<{ check: EquipCheck; item: ItemCopy } | null>(null);
  const toast = useToast();
  const bySlots = mode === 'slot';

  // Players see what's for sale; the GM decides that per item ("For sale in shops", ruled 2026-10-23).
  // The shop (creation) offers what's for sale at a price. Only items that exist under the campaign's options (of-3).
  const inPlay = entriesInPlay(setting.items);
  const offered = shop ? inPlay.filter((e) => forSale(e) && shop.price(e) !== null) : gm ? inPlay : inPlay.filter(forSale);
  const words = query.trim().toLowerCase();
  const matching = offered.filter((e) => !words || e.name.toLowerCase().includes(words));
  // Grouped by category: the setting rules' names and order first, then the rest by tidied name.
  const groups = [...new Set(matching.map((e) => (typeof e.data.category === 'string' ? e.data.category : '')))]
    .map((id) => ({ id, name: setting.itemCategories.get(id)?.name ?? tidied(id), order: setting.itemCategories.get(id)?.order ?? 1000 }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const slot = picked && typeof picked.data.slot === 'string' ? picked.data.slot : '';
  const choosing = picked !== null || oneOff !== null;
  const forWhom = carrier.actorId ? `${carrier.name}’s pack` : 'the Party stash';
  const bundle = picked ? bundleOf(picked) : 1;
  const bases = picked ? baseArmourChoices(picked.data.armour) : null;
  const itemName = (id: string) => setting.items.find((e) => e.packEntryId === id)?.name ?? id;
  // A sub-form opens scrolled to its first field (ruled 2026-10-24).
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (choosing) form.current?.scrollIntoView?.({ block: 'start' });
  }, [choosing]);

  // Where it goes (B19): the place list for an item with this slot; it starts on the last place used for that kind.
  const placesFor = (itemSlot: string): Destination[] => [
    ...(carrier.actorId ? [{ id: 'equipped', name: isWornSlot(itemSlot) ? 'Worn' : 'In hand', group: 'Equipped' as const }] : []),
    { id: 'carried', name: carrier.actorId ? 'Carried' : 'Party stash', group: 'Containers' as const },
    ...containers.map((c) => {
      const room = roomLeft(c, lines, mode);
      return { id: c.id, name: c.name, group: 'Containers' as const, room: room ? `${room.left} of ${room.of} left` : undefined, blocked: room && room.left === 0 ? 'Full' : undefined };
    }),
  ];
  const startPlace = (category: string, itemSlot: string) => {
    // "Equipped" is a choice, never where the list starts: the first with room is a container.
    const places = placesFor(itemSlot);
    const start = startingPlace('put', category, places);
    return start === 'equipped' || start === null ? (places.find((p) => p.group === 'Containers' && !p.blocked)?.id ?? 'carried') : start;
  };

  function pick(entry: ResolvedEntry) {
    setPicked(entry);
    setBaseArmour(null);
    setOneOff(null);
    setCost(priceText(entry.data.value));
    setPlace(startPlace(copyOf(entry).category, typeof entry.data.slot === 'string' ? entry.data.slot : ''));
    setProblem(null);
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    // The shop answers what can't be afforded instead of buying it (never greyed).
    const short = shop && picked ? shop.short(picked, qty) : null;
    if (short) return toast({ text: short });
    let item: ItemCopy;
    if (picked) item = copyOf(picked);
    else if (oneOff) {
      const name = oneOff.name.trim();
      if (!name) return setProblem('Give the item a name.');
      const amount = oneOff.amount.trim();
      if (amount && !/^\d+$/.test(amount)) return setProblem(bySlots ? 'Slots must be a whole number.' : 'Weight must be a whole number of coins.');
      const number = amount ? Number(amount) : null;
      item = { libraryEntryId: null, name, category: 'gear', weightCoin: bySlots ? null : number, slots: bySlots ? number : null, stack: 1, details: {} };
    } else return;

    if (place === 'equipped' && carrier.actorId) {
      setBusy(true);
      const going = { id: 'new', name: item.name, details: picked?.data ?? {}, sourceEntryId: picked?.packEntryId ?? null, equipped: true } as unknown as InventoryLine;
      const check = await checkEquip(db, user.id, campaign.id, carrier.actorId, going, lines);
      setBusy(false);
      if (check.blocked.length > 0 || check.warnings.length > 0) return setWarned({ check, item });
      return finish(item, [], check.stopsCasting);
    }
    return finish(item);
  }

  /** Adds it, after taking off what's in its way (an offer from an equip warning). */
  async function finish(item: ItemCopy, takeOff: InventoryLine[] = [], stop: CastingStop | null = null) {
    setWarned(null);
    setBusy(true);
    for (const other of takeOff) {
      const off = await runCommand(registry, db, user, equipItem, { line: { id: other.id, carrier }, equipped: false });
      if (!off.ok) {
        setBusy(false);
        return setProblem(off.message);
      }
    }
    // The GM's own one-offs go into the campaign's homebrew first, so they show in search from then on.
    if (oneOff && gm) {
      const saved = await runCommand(registry, db, user, saveHomebrewEntry, {
        campaignId: campaign.id,
        campaignName: campaign.name,
        kind: 'item',
        data: homebrewItem({ ...item, details: {} }),
      });
      if (!saved.ok) {
        setBusy(false);
        return setProblem(saved.message);
      }
      const entryId = await findHomebrewItem(db, campaign.id, saved.value);
      if (entryId) item = { ...item, libraryEntryId: entryId };
    }
    const added = await runCommand(registry, db, user, addItem, {
      carrier,
      item,
      // A bundle adds its units ("Torches (6)" → 6 torches).
      qty: qty * bundle,
      howGot: shop ? 'bought' : gm ? 'given' : howGot,
      cost: shop && picked ? shop.cost(picked, qty) : cost,
      note: gm ? note : '',
      containerLineId: place === 'carried' || place === 'equipped' ? null : place,
      equipped: place === 'equipped',
      // The setting rules hide this kind of item's charges: its total will be the GM's.
      chargesHidden: setting.charges.hidden && chargesOf({ category: item.category, details: picked?.data ?? {} }, setting.charges) !== null,
      baseArmourId: bases ? baseArmour : null,
    });
    setBusy(false);
    if (!added.ok) return setProblem(added.message);
    if (place !== 'equipped') rememberPlace('put', item.category, place);
    if (shop && picked) {
      // Bought: back to the shop's list, the step's tally updated.
      shop.onBought(picked, added.value, qty);
      setPicked(null);
      setQty(1);
      return;
    }
    // On straight away and it stops casting (B25): the toast says so; Undo takes it off.
    if (place === 'equipped' && stop) {
      const line = { id: added.value.id, carrier };
      toast({ text: stop.short, onUndo: () => void runCommand(registry, db, user, equipItem, { line, equipped: false }) });
    }
    onAdded(!gm && howGot === 'bought', added.value);
  }

  /** The shop's Add on a single item: bought at once, carried (how many is asked only for a stackable one). */
  async function buyNow(entry: ResolvedEntry) {
    if (!shop || busy) return;
    const short = shop.short(entry, 1);
    if (short) return toast({ text: short });
    setProblem(null);
    setBusy(true);
    const item = copyOf(entry);
    const added = await runCommand(registry, db, user, addItem, {
      carrier,
      item,
      qty: bundleOf(entry),
      howGot: 'bought',
      cost: shop.cost(entry, 1),
      containerLineId: null,
      equipped: false,
      chargesHidden: setting.charges.hidden && chargesOf({ category: item.category, details: entry.data }, setting.charges) !== null,
      baseArmourId: null,
    });
    setBusy(false);
    if (!added.ok) return setProblem(added.message);
    shop.onBought(entry, added.value, 1);
  }

  const row = (entry: ResolvedEntry) => {
    const copy = copyOf(entry);
    const amount = bySlots ? (copy.slots === null ? '' : `${copy.slots} ${copy.slots === 1 ? 'slot' : 'slots'}`) : copy.weightCoin === null ? '' : `${copy.weightCoin} coins`;
    if (shop) {
      // The stock row (cs-21, picture creation/final 21-F5): the name opens its entry (R3-10); what it is and its weight,
      // the price at the right; Buy buys one at once, or opens the count screen for a thing that stacks. The source is
      // in the entry.
      const blurb = typeof entry.data.blurb === 'string' ? entry.data.blurb.trim().replace(/\.$/, '') : '';
      const weight = amount ? (bySlots ? amount : `${amount}' weight`) : '';
      return (
        <StockRow
          key={`${entry.packId}:${entry.packEntryId}`}
          name={entry.name}
          line={[blurb, weight].filter(Boolean).join('. ')}
          price={shop.price(entry) ?? ''}
          warn={shop.note(entry) || undefined}
          onOpen={() => setReading(entry)}
          onBuy={() => (copy.stack > 1 ? pick(entry) : void buyNow(entry))}
        />
      );
    }
    return (
      <li key={`${entry.packId}:${entry.packEntryId}`} className="pack__item">
        <button type="button" className="pack__row-main" onClick={() => pick(entry)}>
          <span className="pack__name">{entry.name}</span>{' '}
          {amount && <span className="auth__meta pack__sub">{amount}</span>}{' '}
          <span className="pack__amount">{priceText(entry.data.value)}</span>
        </button>
      </li>
    );
  };

  const readingSheet =
    shop && reading ? (
      <ItemEntry
        item={reading}
        cost={shop.price(reading) ?? undefined}
        onPick={() => {
          const entry = reading;
          setReading(null);
          if (copyOf(entry).stack > 1) pick(entry);
          else void buyNow(entry);
        }}
        onClose={() => setReading(null)}
      />
    ) : null;

  return (
    <section className="pack add-item" aria-label="Add an item">
      {readingSheet}
      <button type="button" className="button-quiet" onClick={shop ? shop.onDone : onBack}>
        {shop ? '‹ Gear' : '‹ Pack'}
      </button>
      <h1 className="pack__title">{shop ? 'Shop' : 'Add an item'}</h1>
      {shop?.top}
      {!choosing && (
        <>
          {/* The search stays at the top while the list scrolls, so the keyboard never hides it. */}
          <div className="field add-item__search">
            <label className={shop ? 'visually-hidden' : 'label'} htmlFor={searchId}>
              Search items
            </label>
            <input
              id={searchId}
              className="field__input"
              type="search"
              autoComplete="off"
              // The shop shows its placeholder, its label kept for a screen reader (cs-21).
              placeholder={shop ? 'Search items' : undefined}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={(event) => event.currentTarget.scrollIntoView?.({ block: 'start' })}
            />
          </div>
          {offered.length === 0 && <p className="auth__meta">The campaign’s setting rules have no items for sale yet.</p>}
          {words !== '' && matching.length === 0 && offered.length > 0 && <p className="auth__meta">Nothing for sale by that name.</p>}
          {groups.map((group) => {
            // A search opens every category with matches; otherwise they start closed.
            const open = words !== '' || openGroups.includes(group.id);
            const entries = matching.filter((e) => (typeof e.data.category === 'string' ? e.data.category : '') === group.id);
            return (
              <section key={group.id || 'other'} className="pack__group" aria-label={group.name}>
                <button
                  type="button"
                  className={`pack__group-toggle${shop ? ' add-item__group-toggle' : ''}`}
                  aria-expanded={open}
                  onClick={() => setOpenGroups(open ? openGroups.filter((id) => id !== group.id) : [...openGroups, group.id])}
                >
                  {shop ? (
                    // The shop's fold (cs-37, 21-F5): its name and count, the chevron at the right, down folded, up open.
                    <>
                      <span className="add-item__group-name">{`${group.name}: ${entries.length}`}</span>
                      <span className={`creation-fold__mark${open ? ' creation-fold__mark--open' : ''}`} aria-hidden="true">
                        <Icon name="chevron" size={20} />
                      </span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">{open ? '▾' : '▸'}</span> {group.name}
                      <span className="auth__meta">: {entries.length}</span>
                    </>
                  )}
                </button>
                {open && <ul className="pack__rows">{entries.map(row)}</ul>}
              </section>
            );
          })}
          {shop ? (
            <div className="add-item__shop-foot">
              <button type="button" className="button-primary" onClick={shop.onDone}>
                Done shopping
              </button>
            </div>
          ) : (
          <button
            type="button"
            className="button-secondary button-secondary--small"
            onClick={() => {
              setOneOff({ name: query.trim(), amount: '' });
              setPicked(null);
              setCost('');
              setPlace(startPlace('gear', ''));
            }}
          >
            {gm ? 'Not listed? Make a one-off item (saved to the campaign’s homebrew)' : 'Not listed? Make a one-off item (the GM approves it)'}
          </button>
          )}
        </>
      )}

      {/* Once an item is picked, its card takes the screen: nothing to scroll for. */}
      {choosing && (
        <form ref={form} className="pack__sheet add-item__form" onSubmit={add}>
          <button
            type="button"
            className="button-quiet add-item__back"
            onClick={() => {
              setPicked(null);
              setOneOff(null);
              setProblem(null);
            }}
          >
            ‹ Back to the list
          </button>
          {oneOff ? (
            <>
              <div className="field">
                <label className="label" htmlFor={`${searchId}-name`}>
                  Name
                </label>
                <input id={`${searchId}-name`} className="field__input" value={oneOff.name} onChange={(event) => setOneOff({ ...oneOff, name: event.target.value })} />
              </div>
              {mode !== 'none' && (
                <div className="field">
                  <label className="label" htmlFor={`${searchId}-amount`}>
                    {bySlots ? 'Slots (optional)' : 'Weight in coins (optional)'}
                  </label>
                  <input
                    id={`${searchId}-amount`}
                    className="field__input field__input--short"
                    inputMode="numeric"
                    value={oneOff.amount}
                    onChange={(event) => setOneOff({ ...oneOff, amount: event.target.value })}
                  />
                </div>
              )}

            </>
          ) : (
            <p className="pack__name">
              {picked!.name}
              {bundle > 1 && <span className="auth__meta">, {`${bundle} × ${typeof picked!.data.unitName === 'string' ? picked!.data.unitName : 'unit'} each`}</span>}
            </p>
          )}
          <p className="pack__count">
            <button type="button" className="button-quiet" aria-label="One fewer" onClick={() => (qty <= 1 ? blocked.explain("Can't go lower", 'One is the fewest you can add.') : setQty(qty - 1))}>
              −
            </button>
            <span>{qty}</span>
            {blocked.sheet}
            <button type="button" className="button-quiet" aria-label="One more" onClick={() => setQty(qty + 1)}>
              +
            </button>
          </p>
          {bases && (
            <>
              <span className="label">Which base armour? (or choose later from AC)</span>
              <BaseArmourChoice choices={bases} nameOf={itemName} selected={baseArmour} onPick={setBaseArmour} />
            </>
          )}
          {!gm && !shop && (
            <div className="pack__actions pack__actions--row" role="group" aria-label="How do you get it?">
              <span className="label">How {carrier.actorId ? `does ${carrier.name} get it` : 'is it got'}?</span>
              <button type="button" className="button-secondary" aria-pressed={howGot === 'bought'} onClick={() => setHowGot('bought')}>
                Bought
              </button>
              <button type="button" className="button-secondary" aria-pressed={howGot === 'found'} onClick={() => setHowGot('found')}>
                No cost
              </button>
            </div>
          )}
          {/* Where it goes: the shared destination list (B19, ruled 2026-10-25), long names never breaking a row. */}
          {/* "Where it goes" (ruled 2026-10-26); the main button names the place ("Add to" and its name). */}
          <span className="label">Where it goes</span>
          <DestinationList
            label="Where it goes"
            destinations={placesFor(slot)}
            selected={place}
            onSelect={setPlace}
            onBlocked={(why) => toast({ text: why === 'Full' ? 'That container is full.' : why })}
          />
          {warned && (
            <EquipWarningCard
              itemName={warned.item.name}
              check={warned.check}
              busy={busy}
              onKeep={() => setWarned(null)}
              onAnyway={() => void finish(warned.item, [], warned.check.stopsCasting)}
              onOffer={(first) => void finish(warned.item, first, warned.check.stopsCasting)}
            />
          )}
          {shop && <p className="add-item__cost">{shop.cost(picked!, qty)}</p>}
          <button type="submit" className="button-primary add-item__add" aria-busy={busy}>
            {busy
              ? shop
                ? 'Buying…'
                : 'Adding…'
              : shop
                ? `Buy ${qty}`
                : place === 'equipped'
                ? isWornSlot(slot)
                  ? 'Add and wear it'
                  : 'Add and hold it'
                : place === 'carried'
                  ? `Add to ${forWhom}`
                  : `Add to ${containers.find((c) => c.id === place)?.name ?? forWhom}`}
          </button>
          {shop ? null : gm ? (
            <div className="field">
              <label className="label" htmlFor={`${searchId}-note`}>
                Note (optional)
              </label>
              <input id={`${searchId}-note`} className="field__input" maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
          ) : (
            howGot === 'bought' && (
              <div className="field">
                <label className="label" htmlFor={`${searchId}-cost`}>
                  Cost
                </label>
                <input id={`${searchId}-cost`} className="field__input field__input--short" value={cost} maxLength={60} onChange={(event) => setCost(event.target.value)} />
              </div>
            )
          )}
        </form>
      )}
    </section>
  );
}
