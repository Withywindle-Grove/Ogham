// The Pack's load bar (docs/06 "Load bar"): the tier, the bar or cells, and the tiers one tap away. With slot
// bands (ga-1, sr-9) one bar per band, each with its count and speed, the slower named "sets your speed".
// A tap on the burden opens its levels in a pop-up, "Burden" (tfb-4, frame M2h of december/26, approved 2026-11-19):
// every host passes `levelsPopUp`: the Player tab, the Pack, the full sheet, and (d5-19, 2026-11-20) the GM's character
// overview and creation's Gear step. Without it the levels open in place, as the gallery's Pack page still draws them.
import { Fragment, useRef, useState, type ReactNode } from 'react';
import type { TreasureSwitch } from '../modules/inventory/treasureSwitch.ts';
import { raisedTiers, speedOf, type BandId, type BandLoad, type CarriedLoad, type CarryBonus, type EncumbranceRules, type Tier } from '../modules/inventory/encumbrance.ts';
import { tierWords } from './packHelpers.ts';
import { WarningSign } from '../ui/parts.tsx';
import { BreakdownSheet } from '../ui/BreakdownSheet.tsx';
import { BookTable } from '../ui/creation.tsx';
import './PackScreen.css';

/** Carrying treasure under armour mode (eq-3): the GM's switch as stored (null follows the rules), and its button (null for a player). */
export interface TreasureControl {
  gmSwitch: TreasureSwitch;
  onSwitch: (() => void) | null;
}

/** Whole numbers of four digits or more with a thousands comma, as Advancement writes them ("1,200"). */
export const num = (n: number) => n.toLocaleString('en');

/** Why Carrying treasure reads as it does (Design, #479): the GM's call when the switch is set, else what the rules see. */
export function treasureWhy(suggested: boolean, gmSwitch: TreasureSwitch): string {
  if (gmSwitch !== null) return "the GM's call";
  return suggested ? 'treasure in the pack' : 'nothing counts as treasure';
}

/** The rules' suggestion, only when the GM's switch says otherwise: ". The rules suggest Carrying treasure" (no middle dot, plan m5b-players-screens-standard C). */
export function treasureSuggestion(suggested: boolean, gmSwitch: TreasureSwitch): string {
  return gmSwitch !== null && gmSwitch !== suggested ? `. The rules suggest ${suggested ? 'Carrying treasure' : 'Not carrying treasure'}` : '';
}

// The load at the top: a bar with tier marks (coin), a cell per slot (slot), or the move and treasure (armour).
// Variant "speed said once" (`speedOnce`; dec-13 C10, frames P1 and P2 of december/14, ps-9): for a host that shows the
// speed on its own card (the Player screen), the top line is the tier alone. Bands and armour mode are as plain.
export function LoadSummary({
  load,
  rules,
  from,
  treasure,
  speedOnce = false,
  levelsPopUp = false,
}: {
  load: CarriedLoad;
  rules: EncumbranceRules;
  from: string[];
  treasure?: TreasureControl;
  speedOnce?: boolean;
  /**
   * A tap on the tier opens the burden's levels in a pop-up (tfb-4, 2026-11-19), not in place under the bar: the Player
   * tab, the Pack, the full sheet, the GM's character overview and creation's Gear step pass it (d5-19, 2026-11-20).
   */
  levelsPopUp?: boolean;
}) {
  const [explain, setExplain] = useState(false);
  const tierButton = useRef<HTMLButtonElement>(null);
  if (load.mode === 'none') return null;
  if (load.mode === 'slot' && load.bands)
    return <BandedSummary load={load} bands={load.bands} setsSpeed={load.setsSpeed ?? null} from={from} levelsPopUp={levelsPopUp} />;
  // The tier, then the speed it gives (Design, #479: the section answers "how fast am I" in every mode).
  const tierSpeed = load.mode !== 'armour' && !load.over && !speedOnce ? speedOf(load) : null;
  const words = tierWords(load) && tierSpeed !== null ? `${tierWords(load)}, speed ${tierSpeed}` : tierWords(load);
  // Past the first tier is a warning (the words say which); over the max too.
  const warn = load.over || (load.mode !== 'armour' && load.tier !== null && load.tier.label !== (load.mode === 'coin' ? rules.coin : rules.slot)?.tiers[0]?.label);
  const source = from.length > 0 ? `From your setting: ${from.join(', ')}` : '';
  const fill = load.capacity ? Math.min(1, load.load / load.capacity) : 0;

  return (
    // "Speed said once" is also the Player screen's card as P1 draws it: left-aligned and upright (`pack__load--once`).
    <div className={speedOnce ? 'pack__load pack__load--once' : 'pack__load'}>
      {words && (
        <button
          ref={tierButton}
          type="button"
          className={warn ? 'pack__tier pack__tier--warn' : 'pack__tier'}
          {...(levelsPopUp ? { 'aria-haspopup': 'dialog' as const } : { 'aria-expanded': explain })}
          onClick={() => setExplain(!explain)}
        >
          {/* Over the limit carries the warning sign (plan m5b-players-screens-standard A3), the words still say it. */}
          {load.over && <WarningSign />}
          {words}
        </button>
      )}
      {load.mode === 'slot' && load.capacity !== null ? (
        <div className="pack__cells" aria-hidden="true">
          {Array.from({ length: Math.max(load.capacity, load.load) }, (_, i) => (
            <span key={i} className={i < load.load ? (i >= load.capacity! ? 'pack__cell pack__cell--over' : 'pack__cell pack__cell--full') : 'pack__cell'} />
          ))}
        </div>
      ) : (
        load.capacity !== null && (
          <div className="pack__bar" aria-hidden="true">
            <span className={load.over ? 'pack__fill pack__fill--over' : 'pack__fill'} style={{ width: `${fill * 100}%` }} />
            {load.mode === 'coin' &&
              rules.coin?.tiers.slice(0, -1).map((t) => <span key={t.label} className="pack__mark" style={{ left: `${(t.max / load.capacity!) * 100}%` }} />)}
          </div>
        )
      )}
      {load.mode === 'armour' ? (
        // Two lines, left-aligned (Design, #479): whether treasure counts and why, with the GM's switch; then the treasure.
        <div className="pack__treasure-lines">
          <p className="pack__treasure-switch">
            <span>
              <strong className="pack__treasure">{load.carriesTreasure ? 'Carrying treasure' : 'Not carrying treasure'}</strong>
              {treasure && <span className="auth__meta">{`, ${treasureWhy(load.treasureSuggested ?? load.carriesTreasure, treasure.gmSwitch)}`}</span>}
            </span>
            {treasure?.onSwitch && (
              <button type="button" className="button-secondary button-secondary--small" onClick={treasure.onSwitch}>
                {load.carriesTreasure ? 'Switch off' : 'Switch on'}
              </button>
            )}
          </p>
          <p className="auth__meta">
            {`Treasure ${num(load.load)}${load.capacity !== null ? ` of ${num(load.capacity)}` : ''} coins’ weight`}
            {treasure && treasureSuggestion(load.treasureSuggested ?? load.carriesTreasure, treasure.gmSwitch)}
          </p>
        </div>
      ) : (
        <p className="auth__meta">
          {load.mode === 'coin'
            ? `${num(load.load)}${load.capacity !== null ? ` of ${num(load.capacity)}` : ''} ${speedOnce ? 'coins’ weight' : 'coins'}${rules.coin?.miscGearCoin ? `. Small gear counts as ${num(rules.coin.miscGearCoin)}` : ''}`
            : `${num(load.load)}${load.capacity !== null ? ` of ${num(load.capacity)}` : ''} slots`}
        </p>
      )}
      {explain && levelsPopUp && (
        <BurdenSheet load={load} rules={rules} from={from} treasure={treasure} onClose={() => closeAndReturn(setExplain, tierButton.current)} />
      )}
      {explain && !levelsPopUp && (
        <div className="pack__explain">
          {load.mode === 'armour' ? (
            <ul>
              {rules.armour?.movement.map((row) => (
                <li key={row.armour}>
                  {row.armour === 'none' ? 'No armour' : `${row.armour[0]!.toUpperCase()}${row.armour.slice(1)} armour`}: {row.withoutTreasure} without treasure, {row.withTreasure} with it.
                </li>
              ))}
            </ul>
          ) : (
            <ul>
              {(load.mode === 'coin' ? rules.coin : rules.slot)?.tiers.map((t) => (
                <li key={t.label}>
                  {t.label}: up to {num(t.max)} {load.mode === 'coin' ? 'coins' : 'slots'}
                  {t.effect ? `, ${t.effect}` : ''}
                </li>
              ))}
            </ul>
          )}
          {/* What raises the limit (eq-6): each worn or held item, named. */}
          {load.bonuses && load.bonuses.length > 0 && (
            <ul>
              {load.bonuses.map((b, i) => (
                <li key={`${b.name}-${i}`}>
                  {b.name}: +{num(b.amount)} {load.mode === 'slot' ? (b.amount === 1 ? 'slot' : 'slots') : b.amount === 1 ? 'coin' : 'coins'} to{' '}
                  {load.mode === 'armour' ? 'the limit' : 'each limit'}, while worn or in hand.
                </li>
              ))}
            </ul>
          )}
          {source && <p className="auth__meta">{source}</p>}
        </div>
      )}
    </div>
  );
}

/** A band's speed in words: "speed 30", or nothing when its tier gives no number. */
const speedWords = (speed: number | null) => (speed === null ? '' : `speed ${speed}`);
const tierLine = (t: Tier) => `${t.label ? `${t.label}: ` : ''}up to ${num(t.max)} slots${t.movement ? `, speed ${t.movement}` : ''}${t.effect ? `, ${t.effect}` : ''}`;

/**
 * The bands' bars (docs/06 "Load bar", variant "bands"; sr-9): per band its name, count of its most, its speed, and
 * "sets your speed" on the slower one, then a cell per slot. Words carry every state (over, sets the speed), never
 * colour alone. Shared by the Pack tab and the full sheet's Pack load (sheet plan order 5).
 */
export function LoadBands({ bands, setsSpeed, overMax }: { bands: BandLoad[]; setsSpeed: BandId | null; overMax: string }) {
  return (
    <ul className="pack__bands">
      {bands.map((b) => {
        const most = b.capacity ?? b.load;
        const state = b.over ? overMax || 'over the most' : [speedWords(b.speed), setsSpeed === b.id ? 'sets your speed' : ''].filter(Boolean).join(', ');
        return (
          <li key={b.id} className="pack__band">
            <p className="pack__band-line">
              <strong>{b.name}</strong> {num(b.load)}
              {b.capacity !== null ? ` of ${num(b.capacity)}` : ''} slots
              {state && <span className={b.over || setsSpeed === b.id ? 'pack__band-state pack__band-state--marked' : 'pack__band-state'}>{`, ${state}`}</span>}
            </p>
            <div className="pack__cells" aria-hidden="true">
              {Array.from({ length: Math.max(most, b.load) }, (_, i) => (
                <span key={i} className={i < b.load ? (i >= most ? 'pack__cell pack__cell--over' : 'pack__cell pack__cell--full') : 'pack__cell'} />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The summary with bands: the speed (or the over words) on top, tap for both lists; then the two bars. */
function BandedSummary({
  load,
  bands,
  setsSpeed,
  from,
  levelsPopUp,
}: {
  load: Extract<CarriedLoad, { mode: 'coin' | 'slot' }>;
  bands: BandLoad[];
  setsSpeed: BandId | null;
  from: string[];
  levelsPopUp: boolean;
}) {
  const [explain, setExplain] = useState(false);
  const tierButton = useRef<HTMLButtonElement>(null);
  const speed = speedOf(load);
  // Past a band's first tier is a warning (the words say which band); over the most too.
  const words = load.over ? load.overMax || 'Over the limit' : speed !== null ? `Speed ${speed}` : 'Speed: your GM says';
  const warn = load.over || bands.some((b) => b.step !== null && b.step > 0);
  const source = from.length > 0 ? `From your setting: ${from.join(', ')}` : '';
  return (
    <div className="pack__load">
      <button
        ref={tierButton}
        type="button"
        className={warn ? 'pack__tier pack__tier--warn' : 'pack__tier'}
        {...(levelsPopUp ? { 'aria-haspopup': 'dialog' as const } : { 'aria-expanded': explain })}
        onClick={() => setExplain(!explain)}
      >
        {load.over && <WarningSign />}
        {words}
      </button>
      <LoadBands bands={bands} setsSpeed={setsSpeed} overMax={load.overMax} />
      {explain && levelsPopUp && <BurdenSheet load={load} rules={null} from={from} onClose={() => closeAndReturn(setExplain, tierButton.current)} />}
      {explain && !levelsPopUp && (
        <div className="pack__explain">
          {bands.map((b) => (
            <div key={b.id}>
              <p className="auth__meta">{b.name}</p>
              <ul>
                {b.tiers.map((t, i) => (
                  <li key={i}>{tierLine(t)}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="auth__meta">The slower of the two sets your speed.</p>
          {source && <p className="auth__meta">{source}</p>}
        </div>
      )}
    </div>
  );
}

/** The pop-up closed, focus goes back to the tier that opened it (as the Log's panel does). */
function closeAndReturn(setOpen: (open: boolean) => void, opener: HTMLButtonElement | null) {
  setOpen(false);
  opener?.focus({ preventScroll: true });
}

/** A labelled line in the book's style (cs-41): the label in the book label's colour, then its words. */
function BookLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="book-line">
      <span className="book-label">{label}</span> {children}
    </p>
  );
}

/** One kind of load's table: its title, head and rows, and the character's own row (bold, and said). */
interface BurdenTable {
  title: string;
  head: string[];
  rows: string[][];
  marked: number;
  /** Each level's effect in the pack's words, a labelled line under the table (a column would not fit 375 px). */
  effects?: { label: string; words: string }[];
}

/**
 * " Name: +200 coins to each limit, while worn or in hand." for each worn or held thing that raises the limit (eq-6),
 * in the words the levels used in place ("to the limit" under armour, which has one).
 */
const bonusWords = (bonuses: CarryBonus[] | undefined, unit: 'coin' | 'slot', to: 'each limit' | 'the limit' = 'each limit') =>
  (bonuses ?? []).map((b) => ` ${b.name}: +${num(b.amount)} ${unit}${b.amount === 1 ? '' : 's'} to ${to}, while worn or in hand.`).join('');

/** A sentence's end: a full stop unless it has one. */
const stop = (words: string) => (/[.!?]$/.test(words) ? words : `${words}.`);

/**
 * A list of levels as a table, as frame M2h draws it: the level's name when the pack gives names, its limit ("400
 * coins", or "11 to 13" for slots filled), and its speed when any level has one. Over the most, a last row says so,
 * with the pack's words for it as its speed. The character's own row is the one in bold. Each level's effect follows
 * the table as a labelled line ("Laden Slowed."): a fourth column cut its words at 375 px.
 */
function levelsTable(
  title: string,
  tiers: Tier[],
  limit: { head: string; of: (t: Tier, i: number) => string },
  mine: number | null,
  over: { is: boolean; words: string },
): BurdenTable {
  const named = tiers.some((t) => t.label);
  const speeds = tiers.some((t) => t.movement);
  const head = [...(named ? ['Level'] : []), limit.head, ...(speeds ? ['Speed'] : [])];
  const rows = tiers.map((t, i) => [...(named ? [t.label] : []), limit.of(t, i), ...(speeds ? [t.movement ?? ''] : [])]);
  const effects = tiers.flatMap((t, i) => (t.effect ? [{ label: t.label || limit.of(t, i), words: stop(t.effect) }] : []));
  if (over.is) rows.push([...(named ? ['Over the limit'] : []), 'More', ...(speeds ? [over.words] : [])]);
  // Over the most with no speed column: the pack's words for it go with the effects.
  if (over.is && !speeds && over.words) effects.push({ label: 'Over the limit', words: stop(over.words) });
  return { title, head, rows, marked: over.is ? rows.length - 1 : (mine ?? -1), ...(effects.length > 0 ? { effects } : {}) };
}

/** The level a load sits in, found in the raised list (`raisedTiers`, the same calculation as the load's own tier). */
const levelIndex = (tiers: Tier[], tier: Tier | null) => (tier ? tiers.findIndex((t) => t.max === tier.max && t.label === tier.label && t.effect === tier.effect && t.movement === tier.movement) : -1);

/** Slots filled, as the book's tables say them: "Up to 10", then "11 to 13". */
const slotsFilled = (tiers: Tier[]) => (t: Tier, i: number) => {
  const from = i === 0 ? null : tiers[i - 1]!.max + 1;
  return from === null ? `Up to ${num(t.max)}` : from >= t.max ? num(t.max) : `${num(from)} to ${num(t.max)}`;
};

/** An armour row's name as its table says it: "None", "Light". */
const armourName = (row: string) => (row === 'none' ? 'None' : `${row.charAt(0).toUpperCase()}${row.slice(1)}`);

/** "383 of 1,200", or "383" when there is no most. */
const outOf = (n: number, most: number | null) => `${num(n)}${most !== null ? ` of ${num(most)}` : ''}`;

/** What the pop-up says: the lead lines, the tables, the labelled lines. Pure, from the load and the pack's rules. */
export function burdenParts(load: Exclude<CarriedLoad, { mode: 'none' }>, rules: EncumbranceRules | null, treasure?: TreasureControl) {
  const lead: string[] = [];
  const tables: BurdenTable[] = [];
  const lines: { label: string; words: string }[] = [];
  if (load.mode === 'armour') {
    const movement = rules?.armour?.movement ?? [];
    // The row worn is the one whose speed is the load's, when only one row has it; else no row is bold.
    const column = (r: (typeof movement)[number]) => (load.carriesTreasure ? r.withTreasure : r.withoutTreasure);
    const matches = load.movement === null ? [] : movement.filter((r) => column(r) === load.movement);
    const worn = matches.length === 1 ? matches[0]! : null;
    if (load.over) lead.push(`${tierWords(load)}: ${outOf(load.load, load.capacity)} coins’ weight.`);
    const carrying = load.carriesTreasure ? 'carrying treasure' : 'not carrying treasure';
    const where = worn ? `${armourName(worn.armour)}, ${carrying}` : `${carrying.charAt(0).toUpperCase()}${carrying.slice(1)}`;
    lead.push(load.movement ? `${where}: ${load.movement}.` : `${where}.`);
    if (movement.length > 0)
      tables.push({
        title: 'Movement by armour',
        head: ['Armour', 'Speed', 'With treasure'],
        rows: movement.map((r) => [armourName(r.armour), r.withoutTreasure, r.withTreasure]),
        marked: worn ? movement.indexOf(worn) : -1,
      });
    // The GM's switch as stored; a host that doesn't pass it still tells the GM's call: the load differs from the pack's.
    const suggested = load.treasureSuggested ?? load.carriesTreasure;
    const gmSwitch = treasure ? treasure.gmSwitch : load.carriesTreasure !== suggested ? load.carriesTreasure : null;
    lines.push({ label: 'Treasure', words: `${load.carriesTreasure ? 'Carrying treasure' : 'Not carrying treasure'}: ${treasureWhy(suggested, gmSwitch)}.` });
    if (load.capacity !== null) lines.push({ label: 'Limit', words: `${num(load.capacity)} coins’ weight of treasure.${bonusWords(load.bonuses, 'coin', 'the limit')}` });
  } else if (load.bands) {
    if (load.over) lead.push(`${tierWords(load)}.`);
    lead.push(load.bands.map((b) => `${b.name}: ${outOf(b.load, b.capacity)} slots.`).join(' '));
    for (const b of load.bands) {
      // The band's levels as they stand for this carrier, raised by what adds room (the same as its own tier).
      const tiers = raisedTiers(b.tiers, b.added);
      tables.push(levelsTable(`Burden by slots ${b.name.toLowerCase()}`, tiers, { head: 'Slots filled', of: slotsFilled(tiers) }, b.step, { is: b.over, words: load.overMax }));
    }
    const setter = load.bands.find((b) => b.id === load.setsSpeed);
    lines.push(setter ? { label: 'Sets your speed', words: `${setter.name}: the slower of the two counts.` } : { label: 'Your speed', words: 'The slower of the two counts.' });
    const stowed = load.bands.find((b) => b.id === 'stowed');
    if (load.bonuses && load.bonuses.length > 0 && stowed?.capacity != null)
      lines.push({ label: 'Limit', words: `${stowed.name}: ${num(stowed.capacity)} slots.${bonusWords(load.bonuses, 'slot')}` });
  } else {
    const coin = load.mode === 'coin';
    // The levels as they stand for this carrier, raised by what adds room: the same calculation as the load's tier,
    // so the bold row, the first line and the table agree.
    const tiers = raisedTiers((coin ? rules?.coin : rules?.slot)?.tiers ?? [], load.added ?? 0);
    const words = tierWords(load);
    lead.push(`${words ? `${words}: ` : ''}${outOf(load.load, load.capacity)} ${coin ? 'coins’ weight' : 'slots'}.`);
    if (tiers.length > 0)
      tables.push(
        levelsTable(coin ? 'Burden by weight' : 'Burden by slots', tiers, { head: 'Up to', of: (t) => `${num(t.max)} ${coin ? 'coins' : 'slots'}` }, levelIndex(tiers, load.tier), {
          is: load.over,
          words: load.overMax,
        }),
      );
    if (load.capacity !== null) lines.push({ label: 'Limit', words: `${num(load.capacity)} ${coin ? 'coins' : 'slots'}.${bonusWords(load.bonuses, coin ? 'coin' : 'slot')}` });
  }
  return { lead, tables, lines };
}

/**
 * The burden's levels, as a pop-up (tfb-4, 2026-11-19; frame M2h of december/26, approved 2026-11-19): titled "Burden",
 * a figure explained (band 2, the shared `BreakdownSheet`). Where the character stands; the levels as a book table
 * with the character's own row in bold (the first line says it too, so bold is never the only sign); what sets the
 * limit; the source. Three kinds of load: by coins' weight, by slots (each band, the slower setting the speed), and
 * armour's movement table with the line on treasure. The GM's "Switch on / Switch off" stays on the bar.
 */
export function BurdenSheet({
  load,
  rules,
  from,
  treasure,
  onClose,
  preview = false,
}: {
  load: CarriedLoad;
  /** The pack's rules: the levels by weight or slots, armour's table. Bands carry their own levels. */
  rules: EncumbranceRules | null;
  from: string[];
  treasure?: TreasureControl;
  onClose: () => void;
  /** The gallery's open card in place. */
  preview?: boolean;
}) {
  if (load.mode === 'none') return null;
  const { lead, tables, lines } = burdenParts(load, rules, treasure);
  return (
    <BreakdownSheet title="Burden" source={from.length > 0 ? from.join(', ') : null} onClose={onClose} preview={preview}>
      <div className="burden-sheet">
        {lead.map((line, i) => (
          <p key={`${i}:${line}`} className="reading">
            {line}
          </p>
        ))}
        {tables.map((t, n) => (
          <Fragment key={`${n}:${t.title}`}>
            <BookTable title={t.title} head={t.head} rows={t.rows} marked={t.marked} markedSpoken=", yours" wordsColumn={0} titleStart />
            {t.effects?.map((e, i) => (
              <BookLine key={`${i}:${e.label}`} label={e.label}>
                {e.words}
              </BookLine>
            ))}
          </Fragment>
        ))}
        {lines.map((l, i) => (
          <BookLine key={`${i}:${l.label}`} label={l.label}>
            {l.words}
          </BookLine>
        ))}
      </div>
    </BreakdownSheet>
  );
}
