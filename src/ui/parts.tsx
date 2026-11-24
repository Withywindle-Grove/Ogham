// Small shared parts from the component inventory (docs/06 "Components"; conventions ruled 2026-10-25). Each is
// built once here and composed by screens; the gallery (gallery.html) shows every one in every state.
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import './parts.css';
import { hasStepIcon, Icon, StepIcon, type IconName } from './icons.tsx';
import type { SetIconName } from './iconSet.ts';
import { installBusyGuard } from './busyGuard.ts';

// Every screen imports these parts, so a busy button ignores a second tap everywhere (never disabled, 06).
installBusyGuard();

/**
 * A name's source in a one-line place (sn-1, plan dec-1-creation 1d as the lead corrected it, words rule 11): " (from
 * <pack>)" after an entry's name, only where another pack has an entry of the same kind and name (`namesakeSource`,
 * src/modules/library/namesakes.ts). Nothing without one. The space before it is where a long name wraps: the bracket
 * moves down whole, never split inside a word. A list row shows its own quiet line instead (`PickRow`'s `from`).
 */
export function NameFrom({ from }: { from: string | null | undefined }) {
  if (!from) return null;
  return (
    <>
      {' '}
      <span className="name-from">(from {from})</span>
    </>
  );
}

/**
 * The warning sign (plan m5b-creation-final-drafts A4; replaces the plain ▲): a triangle with "!" drawn in the
 * text's colour, decorative (the words beside it carry the meaning). 18 px by default, beside 14 px words.
 */
export function WarningSign({ size = 18 }: { size?: number }) {
  return (
    <svg className="warning-sign" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5" />
      <circle cx="12" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * The sign with its words (A4): bold, in the warning colour, the sign first. Marks a closed row, a pick that needs
 * the GM's approval, something over its limit, being offline. Never colour alone: the shape and the words carry it.
 */
export function WarningLine({ children }: { children: ReactNode }) {
  return (
    <span className="warning-line">
      <WarningSign />
      <span>{children}</span>
    </span>
  );
}

/** A semantic note: the warning sign, ✕ danger, ⓘ info. Never colour alone: the shape and the words carry it. */
export function Note({ tone, children }: { tone: 'warning' | 'danger' | 'info'; children: ReactNode }) {
  const said = tone === 'warning' ? 'Warning' : tone === 'danger' ? 'Problem' : 'Note';
  return (
    <p className={`note note--${tone}`}>
      <span className="note__shape" aria-hidden="true">
        {tone === 'warning' ? <WarningSign /> : tone === 'danger' ? '✕' : 'ⓘ'}
      </span>
      <span className="visually-hidden">{said}: </span>
      <span>{children}</span>
    </p>
  );
}

/** ⓘ: opens its explanation (the only place explanations live on play screens). */
export function InfoButton({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button type="button" className="info-button" aria-label={`About ${label}`} onClick={onOpen}>
      <span aria-hidden="true">ⓘ</span>
    </button>
  );
}

/**
 * Tap line, the value variant (ct3-9, ct3-11, 2026-11-03): a value on the full sheet that opens how it's worked out
 * or its entry. A control border marks it tappable (06: tappable things have one); 44 px tall; the screen reader
 * hears "<label> <value>: how it's worked out" or "<value>: open its entry". `pill`: one of several values in a row
 * (a character's languages), each its own chip.
 */
export function TapValue({ children, label, onTap, pill = false }: { children: ReactNode; label: string; onTap: () => void; pill?: boolean }) {
  return (
    <button type="button" className={pill ? 'chip tap-value tap-value--pill' : 'tap-value'} aria-label={label} onClick={onTap}>
      {children}
    </button>
  );
}

/**
 * Close (tf-8, 2026-11-03): one bare ✕ at the top right of every sheet, pop-up and full-screen view, a 44 px tap area,
 * named "Close" for screen readers. Escape and a swipe down still close where they did.
 */
export function CloseButton({ onClose, className }: { onClose: () => void; className?: string }) {
  return (
    <button type="button" className={className ? `close-button ${className}` : 'close-button'} aria-label="Close" data-close="" onClick={onClose}>
      <span aria-hidden="true">✕</span>
    </button>
  );
}

/** A choice whose options all fit one row at Standard text size (otherwise use a vertical list). */
export function ButtonRow<T extends string>({
  label,
  options,
  value,
  onChange,
  small = false,
  sides = false,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  /** The small secondary size (still 44 px tall): the Magic section's tabs when full size would take more than two rows (sr-4). */
  small?: boolean;
  /** The two-sided switch (ds-1d): the sides joined, the chosen one marked by the selected wash, the accent edge and a bold name, no tick. */
  sides?: boolean;
}) {
  return (
    <div className={`button-row${sides ? ' button-row--switch' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={small ? 'button-secondary button-secondary--small' : 'button-secondary'} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * − N +, whole numbers between min and max; the number is tabular so it doesn't jitter. A step past a limit stays
 * tappable (never greyed): it stops at the limit, and `onLimit` (bq3-4) lets the screen say why.
 * Variant **figure stepper** (G-208, ex-3; mockup december/29 X1–X5): `figure` shows what the count makes in the
 * middle (a skill's figure in its pack's style, "2-in-6", "5+") in place of the count itself; the count still steps.
 */
export function Stepper({ label, value, min, max, onChange, onLimit, figure }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** A step tapped at the limit ('min' or 'max'): the screen explains it. */
  onLimit?: (side: 'min' | 'max') => void;
  /** The figure variant: the words shown between − and + in place of the count. */
  figure?: string;
}) {
  const step = (by: number) => {
    if (by < 0 && value <= min && onLimit) return onLimit('min');
    if (by > 0 && value >= max && onLimit) return onLimit('max');
    onChange(Math.min(max, Math.max(min, value + by)));
  };
  return (
    <div className={figure === undefined ? 'stepper' : 'stepper stepper--figure'} role="group" aria-label={label}>
      <button type="button" className="stepper__step" aria-label={`Less ${label}`} onClick={() => step(-1)}>
        −
      </button>
      <output className="stepper__value" aria-live="polite">
        {figure ?? value}
      </output>
      <button type="button" className="stepper__step" aria-label={`More ${label}`} onClick={() => step(1)}>
        +
      </button>
    </div>
  );
}

/**
 * The typed stepper (cw-11, mockup creation/12): − [number] + where the number is a field that can be typed into as
 * well as stepped (a score, starting coin, an age). The words stay the caller's: `value` is the text in the box,
 * `onChange` gets what was typed, `onStep` a tap on − or + (the caller decides the limits and says why at one, never
 * greyed). `label` names the field and the buttons for a screen reader ("Lower Muscle", "Raise Muscle").
 */
export function TypedStepper({
  id,
  label,
  value,
  onChange,
  onStep,
  placeholder,
  wide = false,
  describedBy,
  average = false,
}: {
  id?: string;
  label: string;
  /** The id of the hint or caption that goes with the box, read out with it (follow-up E). */
  describedBy?: string;
  value: string;
  onChange: (text: string) => void;
  onStep: (by: 1 | -1) => void;
  placeholder?: string;
  /** A wider box for a number of four digits or more (starting coin). */
  wide?: boolean;
  /** The average stepper's untouched look (final drafts A5): the number in the lighter weight, muted. */
  average?: boolean;
}) {
  return (
    // No group name of its own: the box already carries `label`, and a second element named the same would make
    // "the field labelled Muscle" ambiguous (the caller's tile or row names the group).
    <span className="typed-stepper">
      <button type="button" className="button-secondary typed-stepper__step" aria-label={`Lower ${label}`} onClick={() => onStep(-1)}>
        −
      </button>
      <input
        id={id}
        className={`typed-stepper__input${wide ? ' typed-stepper__input--wide' : ''}${average ? ' typed-stepper__input--average' : ''}`}
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        aria-describedby={describedBy}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className="button-secondary typed-stepper__step" aria-label={`Raise ${label}`} onClick={() => onStep(1)}>
        +
      </button>
    </span>
  );
}

/**
 * A toggle button that stays pressed while on (M5 gate B10: Keep lit): a secondary button whose pressed look is the
 * state (filled with ink, never colour alone); `glow` adds the lit-light glow while pressed.
 */
export function ToggleButton({ label, on, onChange, glow = false }: { label: string; on: boolean; onChange: (on: boolean) => void; glow?: boolean }) {
  return (
    <button type="button" className={glow ? 'button-secondary toggle-button toggle-button--glow' : 'button-secondary toggle-button'} aria-pressed={on} onClick={() => onChange(!on)}>
      {label}
    </button>
  );
}

/**
 * An on/off toggle (ds-1, ds-1a, ds-1b; frame B of december/05-03, picked by ds-1c): the name at the left and the track at the right, the
 * whole row one 44 px target. No "On"/"Off" words: the knob's place and its mark (a cross off, a tick on) carry the
 * state with the Selected wash and a soft glow when on; a screen reader hears the name, "switch" and its state.
 * Variant **bare switch** (tg-1, frame P1 of december/14): the track alone, a 44 px target, its name read aloud only,
 * where the row beside it already says what it turns (a light's lit or out; Keep lit with its ⓘ between).
 */
export function Switch(
  props: { on: boolean; onChange: (on: boolean) => void } & ({ label: ReactNode; bare?: false } | { label: string; bare: true }),
) {
  const { on, onChange } = props;
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={props.bare ? props.label : undefined} className={props.bare ? 'switch switch--bare' : 'switch'} onClick={() => onChange(!on)}>
      {!props.bare && <span className="switch__name">{props.label}</span>}
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" data-mark={on ? 'tick' : 'cross'}>
          <Icon name={on ? 'tick' : 'cross'} size={14} />
        </span>
      </span>
    </button>
  );
}

/**
 * The eye (ds-2): a bare 44 px button, no box and no word. An open eye when a thing is shown to the players, a closed eye
 * with lashes when it is hidden; read aloud as a switch with the caller's label ("Shown to the players") and its state.
 * The crossed eye ('eye-off') is kept for one meaning only, the GM's alone, and is never this toggle.
 */
export function EyeToggle({ label, shown, onChange }: { label: string; shown: boolean; onChange: (shown: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={shown} aria-label={label} className="eye-toggle" data-eye={shown ? 'open' : 'shut'} onClick={() => onChange(!shown)}>
      <Icon name={shown ? 'eye' : 'eye-shut'} size={28} />
    </button>
  );
}

/** A small tappable chip. An action chip ("−1", "All 6") is outlined; only a toggle chip (a filter) passes `pressed`. */
export function Chip({ children, onClick, pressed, label, className }: { children: ReactNode; onClick: () => void; pressed?: boolean; label?: string; className?: string }) {
  return (
    <button type="button" className={className ? `chip ${className}` : 'chip'} aria-pressed={pressed} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

/** One trait as a chip shows it (tc-2): its name, its uses as dots, a drawback, a later level; `label` for screen readers. */
export interface TraitChipItem {
  key: string;
  name: string;
  /** One dot per use at this level; 0 for none. */
  uses: number;
  /** How many are spent, a ring each (as the use dots show them); 0 or left out for none. */
  spent?: number;
  drawback: boolean;
  /** The level it starts at, when not reached yet. */
  laterLevel: number | null;
  /** "Steady flame, 1 use a day": the chip's name for a screen reader (": open its entry" is added). */
  label: string;
}

/**
 * The traits as chips (tc-1 … tc-4, 2026-11-04): a small heading per source, then its chips wrapping several to a row
 * (8 px apart, 44 px tall, left-aligned; a chip wider than the panel takes its own row). Inside a chip, after the name:
 * a dot per use, ", drawback", and ", lv N" in the quiet colour for a level not reached yet (words, never colour
 * alone). Each opens its entry. A group past `fold` chips shows "+ N more", which shows them all. One component for the
 * full sheet and the sheet beside the Player screen (tc-4).
 */
export function TraitChips({
  groups,
  onOpen,
  fold = 12,
}: {
  groups: { id: string; title: string; chips: TraitChipItem[] }[];
  onOpen: (key: string) => void;
  fold?: number;
}) {
  const [all, setAll] = useState<string[]>([]);
  return (
    <div className="trait-chips">
      {groups.map((group) => {
        const folded = !all.includes(group.id) && group.chips.length > fold;
        const shown = folded ? group.chips.slice(0, fold) : group.chips;
        return (
          <div key={group.id} className="trait-chips__group" role="group" aria-label={group.title}>
            <h3 className="trait-chips__title">{group.title}</h3>
            <div className="trait-chips__row">
              {shown.map((chip) => (
                <Chip key={chip.key} className="chip--trait" label={`${chip.label}: open its entry`} onClick={() => onOpen(chip.key)}>
                  {chip.name}
                  {chip.uses > 0 && <UsePips uses={chip.uses} spent={chip.spent ?? 0} />}
                  {chip.drawback && <span className="chip__note">, drawback</span>}
                  {chip.laterLevel !== null && <span className="chip__note chip__note--quiet">{`, lv ${chip.laterLevel}`}</span>}
                </Chip>
              ))}
              {folded && (
                <Chip className="chip--trait" label={`Show ${group.chips.length - fold} more ${group.title} traits`} onClick={() => setAll((a) => [...a, group.id])}>
                  {`+ ${group.chips.length - fold} more`}
                </Chip>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * A chip with ✕ (fl-3): something set, shown by its name; the tap takes it off ("Reed ✕" on a watch). `label` is the
 * screen reader's words for the tap ("Take Reed off the 1st watch"). The ✕ is the shape, so it never relies on colour.
 */
export function RemoveChip({ children, label, onRemove }: { children: ReactNode; label: string; onRemove: () => void }) {
  return (
    <button type="button" className="chip chip--remove" aria-label={label} onClick={onRemove}>
      {children} <span aria-hidden="true">✕</span>
    </button>
  );
}

/**
 * The tick-confirm (06 Components, S17-7): "Mark Weary on: ✓ Ash ✓ Wren" — each name a toggle chip, ticked or not,
 * then one confirm. With nobody ticked the confirm still answers, saying so (never a disabled button).
 */
export function TickConfirm({
  label,
  options,
  ticked,
  onChange,
  confirm,
  onConfirm,
}: {
  label: string;
  options: { id: string; label: string }[];
  ticked: readonly string[];
  onChange: (ticked: string[]) => void;
  confirm: string;
  onConfirm: () => void;
}) {
  const labelId = useId();
  return (
    <div className="tick-confirm">
      <p className="tick-confirm__label" id={labelId}>
        {label}
      </p>
      <div className="tick-confirm__chips" role="group" aria-labelledby={labelId}>
        {options.map((o) => {
          const on = ticked.includes(o.id);
          return (
            <Chip key={o.id} pressed={on} onClick={() => onChange(on ? ticked.filter((t) => t !== o.id) : [...ticked, o.id])}>
              {`${on ? '✓ ' : ''}${o.label}`}
            </Chip>
          );
        })}
      </div>
      <button type="button" className="button-primary" onClick={onConfirm}>
        {confirm}
      </button>
    </div>
  );
}

/**
 * **Pinned mark, before the name** (frame P1 of december/14: "★ Shortbow", "★ Horn charge"): on the Player screen's At
 * hand the star leads the pinned thing's name. A screen reader hears the name first, then "pinned", so the row is still
 * found by its name.
 */
export function PinnedName({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="pinned-mark" aria-hidden="true">
        <Icon name="star-filled" size={14} />
      </span>
      {children}
      <span className="visually-hidden">, pinned</span>
    </>
  );
}

/**
 * **Pinned mark** (plan C; dec-13 C8): the small filled star alone at the start of a pinned thing's line, an item's,
 * a trait's or a spell's; a screen reader hears "pinned". On the Player screen's At hand it leads the name instead
 * (`PinnedName`).
 */
export function PinnedMark() {
  return (
    <span className="pinned-mark">
      <Icon name="star-filled" size={14} />
      <span className="visually-hidden">pinned, </span>
    </span>
  );
}

/**
 * **Pinned block** and **Pinned row** (row P3 of plans/test-feedback-2026-11-19; page 28, frames M4a to M4f, approved
 * 2026-11-20; euf-5, pg28-6): a pinned ability or trait in the Player tab's right column's list, as a box around its
 * one List row. `block`: one with something to do (its uses), the weapon in hand's ink edge, its row with Use and the
 * pips; else a row, the same box with a thin edge, its row the name and a chevron. Blocks and rows share one left edge,
 * width, corner and gap, so the list reads as one stack.
 */
export function PinnedBox({ block = false, children }: { block?: boolean; children: ReactNode }) {
  return <div className={block ? 'pinned-box pinned-box--block' : 'pinned-box'}>{children}</div>;
}

/**
 * **Pin star** (plan C; dec-13 C8): the pin in the head of a thing's sheet beside ✕, a toggle: empty "Pin to top",
 * filled and washed "Unpin" (`aria-pressed`). An item's, a trait's (and a spell's once its frame is approved) sheet.
 */
export function PinStar({ pinned, onToggle }: { pinned: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="close-button pin-star" aria-pressed={pinned} aria-label={pinned ? 'Unpin' : 'Pin to top'} onClick={onToggle}>
      <Icon name={pinned ? 'star-filled' : 'star'} size={22} />
    </button>
  );
}

/**
 * A list row (plan m5b-players-screens-standard A2, the mockup's rows): its words at the left (a name, and a quiet line
 * under it), a value at the right where it has one, then either the row's own action (a button: Cast, Use, Fire), or a
 * chevron when the row opens something. With an action, a tap on the words still opens the row's sheet; a row that
 * only opens is one button, the chevron inside it. Rows sit in a `RowList`, a rule between each. Never "›".
 */
export function ListRow({
  title,
  sub,
  value,
  lead,
  valueLead,
  valueMarkAt,
  action,
  actionLabel,
  actionIcon,
  onAction,
  onOpen,
  openLabel,
  chevron = true,
  apart = false,
  figure = false,
  control,
  label = false,
  icon,
}: {
  /**
   * The **Stepper row** variant (Prepare, dec-8 C; mockup magic/06): a control at the right edge in place of the
   * action or chevron (the spell's − N + `Stepper`); a tap on the words still opens the row's sheet. Long words wrap
   * beside it.
   */
  control?: ReactNode;
  /** Set apart below its list as its own card: an item's sheet's Drop, destructive and last (plan C). */
  apart?: boolean;
  /**
   * The **Sheet row** variant (the full sheet's Skills, Abilities, Traits; plan m5b-sheet-revised A2): the Skill row
   * with its chevron where the row opens something (ch-1), the name 16 px at the left, the figure large in Garamond at the right (a word figure smaller).
   */
  figure?: boolean;
  /**
   * The **label** variant: the title is a field's label ("Source", "Set by", "Log" on a status's sheet), the value in the
   * line under it. Inside the book's type it keeps 16 px where a plain row's title takes 20 (the lead's ruling, pq-1).
   */
  label?: boolean;
  title: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  /** A mark before the words (a pinned item's star). */
  lead?: ReactNode;
  /**
   * A mark before the value (ch-1; frame P1 of december/14): a skill's die glyph beside its odds. Decorative: the value's
   * words name the roll. The value stays the words alone, so its size (a word figure) and what is heard don't change.
   */
  valueLead?: ReactNode;
  /**
   * Where the value's mark sits inside the value's words, as a place in them (tfs-3, page M1 of 2026-11-19): a skill
   * rolled the target or higher reads "5+ on", the die's glyph, "d6", so its value "5+ on d6" puts the mark at 6. Absent
   * or 0: before the value (ch-1). Only for a value in words; what is heard and the figure's size stay the words'.
   */
  valueMarkAt?: number;
  /**
   * The **icon column** variant (the Reminders sheet, page 16 T6, `.rrow`): an icon alone in its own column at the left,
   * no ring, centred on the text block; the name bold and its muted line under it, both to the icon's right. Decorative:
   * hidden from a screen reader (the words say it).
   */
  icon?: ReactNode;
  /** The row's own action's word; with `onAction`. */
  action?: string;
  /** What a screen reader hears for the action ("Use Bird friend"). */
  actionLabel?: string;
  /**
   * The **icon action** variant (ic-2; the Magic tab's Cast): the action is the shared `StackedButton`, this icon above
   * its word, in place of the small word button. Rows without it (Use, Fire) are unchanged.
   */
  actionIcon?: SetIconName;
  onAction?: () => void;
  /** Opens the row's sheet (its breakdown, its rules, the item). */
  onOpen?: () => void;
  /** What a screen reader hears for the row's open tap, when the words alone don't say it. */
  openLabel?: string;
  /** False for a row that acts at once (a sheet's "Light it"): no chevron. */
  chevron?: boolean;
}) {
  const words = (
    <span className="list-row__text">
      <span className="list-row__title">
        {lead}
        {title}
      </span>
      {sub && <span className="list-row__sub">{sub}</span>}
    </span>
  );
  // The mark inside the words (tfs-3) when a place is given in a value in words; else before them (ch-1). The words keep
  // their spaces, so what is read and copied is the value whole; the row's gap draws the space beside the mark.
  const markAt = valueLead && typeof value === 'string' && valueMarkAt && valueMarkAt > 0 && valueMarkAt < value.length ? valueMarkAt : 0;
  const end =
    value !== undefined && value !== null && value !== '' ? (
      <span className={`${figure ? (isWordFigure(value) ? 'list-row__value list-row__value--figure list-row__value--word' : 'list-row__value list-row__value--figure') : 'list-row__value'}${valueLead ? ' list-row__value--lead' : ''}`}>
        {markAt > 0 && typeof value === 'string' ? (
          <>
            {value.slice(0, markAt)}
            {valueLead}
            {value.slice(markAt)}
          </>
        ) : (
          <>
            {valueLead}
            {value}
          </>
        )}
      </span>
    ) : null;
  // What a screen reader hears for the row: its words in order, a comma between, unless the caller names it.
  const said = openLabel ?? ([title, sub, value].every((p) => p === undefined || typeof p === 'string' || typeof p === 'number') ? [title, sub, value].filter((p) => p !== undefined && p !== '').join(', ') : undefined);
  if (control) {
    return (
      <div className="list-row list-row--action list-row--control">
        {onOpen ? (
          <button type="button" className="list-row__body" aria-label={said} onClick={onOpen}>
            {words}
            {end}
          </button>
        ) : (
          <span className="list-row__body list-row__body--still">
            {words}
            {end}
          </span>
        )}
        <span className="list-row__action">{control}</span>
      </div>
    );
  }
  if (action && onAction) {
    return (
      <div className="list-row list-row--action">
        {onOpen ? (
          <button type="button" className="list-row__body" aria-label={said} onClick={onOpen}>
            {words}
            {end}
          </button>
        ) : (
          <span className="list-row__body list-row__body--still">
            {words}
            {end}
          </span>
        )}
        {actionIcon ? (
          <StackedButton icon={actionIcon} label={action} aria-label={actionLabel} className="list-row__action" onClick={onAction} />
        ) : (
          <button type="button" className="button-secondary button-secondary--small list-row__action" aria-label={actionLabel} onClick={onAction}>
            {action}
          </button>
        )}
      </div>
    );
  }
  if (onOpen) {
    return (
      <div className={`${apart ? 'list-row list-row--apart' : figure ? 'list-row list-row--figure' : 'list-row'}${label ? ' list-row--label' : ''}${icon ? ' list-row--icon' : ''}`}>
        <button type="button" className="list-row__body" aria-label={said} onClick={onOpen}>
          {icon && (
            <span className="list-row__icon" aria-hidden="true">
              {icon}
            </span>
          )}
          {words}
          {end}
          {chevron && (
            <span className="list-row__chevron" aria-hidden="true">
              <Icon name="chevron" size={20} />
            </span>
          )}
        </button>
      </div>
    );
  }
  return (
    <div className={`${figure ? 'list-row list-row--figure' : 'list-row'}${label ? ' list-row--label' : ''}`}>
      <span className="list-row__body list-row__body--still">
        {words}
        {end}
      </span>
    </div>
  );
}

/**
 * Rows one under another, a hairline rule between each and above the first (the mockup's `.list`). `dotted`: the full
 * sheet's rows (the Sheet row variant), a dotted rule under each and none above the first.
 */
export function RowList({ label, dotted = false, children }: { label?: string; dotted?: boolean; children: ReactNode }) {
  return (
    <div className={dotted ? 'row-list row-list--dotted' : 'row-list'} role={label ? 'group' : undefined} aria-label={label}>
      {children}
    </div>
  );
}

/** A static value tile (stats, saves): tinted, no border, because it isn't tappable. */
export function StatTile({
  label,
  value,
  caption,
  onTap,
  tapLabel,
  small = false,
}: {
  label: string;
  value: ReactNode;
  caption?: string;
  /**
   * The **Save tile** and **Score tile** variants (plan m5b-players-screens-standard B, D): a narrow tile, five or six
   * to a row, the label wrapping between words onto as many lines as it needs (never "…", never inside a word), the
   * value 20 px.
   */
  small?: boolean;
  /** The tappable variant (ruled 2026-10-26): a tap explains how the figure is worked out. */
  onTap?: () => void;
  /** What a screen reader hears for the tappable variant ("Hit points 9 of 14: how it's worked out"). */
  tapLabel?: string;
}) {
  const inside = (
    <>
      <span className="stat-tile__label">{label}</span>
      {/* A word figure ("Medium", "Literate") in a Score tile draws at 16 px (R3-6, mockup creation/final/12). */}
      <span className={small && isWordFigure(value) ? 'stat-tile__value stat-tile__value--word' : 'stat-tile__value'}>{value}</span>
      {caption && (caption.includes(SEPARATOR) ? <TileCaption text={caption} /> : <span className="stat-tile__caption">{caption}</span>)}
    </>
  );
  if (onTap)
    return (
      <button type="button" className={small ? 'stat-tile stat-tile--tap stat-tile--small' : 'stat-tile stat-tile--tap'} aria-label={tapLabel} onClick={onTap}>
        {inside}
      </button>
    );
  return <div className={small ? 'stat-tile stat-tile--small' : 'stat-tile'}>{inside}</div>;
}

/** Whether a tile's figure is words, not a number ("Medium", not "13", "+1", "−2", "1,500" or "—"). */
export const isWordFigure = (value: ReactNode): boolean => typeof value === 'string' && /\p{L}/u.test(value) && !/^[\s\d+\-−,.%/—]*[a-z]?$/i.test(value);

/** The separator between a caption's parts ("1d8 · CON +0"). */
const SEPARATOR = ', ';

/**
 * A caption with parts ("leather · shield · DEX +0"; Design, 2026-11-05, sheet order 4): on one line when it fits
 * the tile; when it doesn't, each part takes its own line and the separator goes, so no line starts or ends with
 * "·". Measured before paint, and again when the tile's width changes; the caption never widens its tile.
 */
export function TileCaption({ text }: { text: string }) {
  const parts = text
    .split(SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean);
  const ref = useRef<HTMLSpanElement>(null);
  const [stacked, setStacked] = useState(false);
  const [width, setWidth] = useState(0);
  // A new text, or a new width, tries one line again.
  const [tried, setTried] = useState({ text, width });
  if (tried.text !== text || tried.width !== width) {
    setTried({ text, width });
    setStacked(false);
  }
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || stacked || parts.length < 2) return;
    if (el.scrollWidth > el.clientWidth + 1) setStacked(true);
  }, [stacked, parts.length, tried]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(() => setWidth(Math.round(el.clientWidth)));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return (
    <span ref={ref} className={stacked ? 'stat-tile__caption stat-tile__caption--parts stat-tile__caption--stacked' : 'stat-tile__caption stat-tile__caption--parts'}>
      {stacked
        ? parts.map((part, n) => (
            <span key={n} className="stat-tile__part">
              {part}
            </span>
          ))
        : parts.join(SEPARATOR)}
    </span>
  );
}

/**
 * Stat tiles side by side: equal height, labels lined up at the top. The **wrap** variant (the full sheet's Combat
 * tiles, Design 2026-11-05): four across when its block has room, else two by two; a tile never runs past its block.
 */
export function StatRow({ children, wrap = false }: { children: ReactNode; wrap?: boolean }) {
  return wrap ? (
    <div className="stat-row-frame">
      <div className="stat-row stat-row--wrap">{children}</div>
    </div>
  ) : (
    <div className="stat-row">{children}</div>
  );
}

/**
 * A status symbol: its letter or icon, a ring that fills (left of `of`), a stack badge. Hidden timers show the
 * symbol without the fill. The screen reader hears "Exhausted, 2 stacks" or "Blessed, 3 turns left".
 */
export function StatusSymbol({
  name,
  symbol,
  left,
  of,
  unit = 'turns',
  stacks,
  warn,
  label,
}: {
  name: string;
  symbol?: string;
  left?: number | null;
  of?: number;
  unit?: string;
  stacks?: number;
  /** Low: the warning shape and colour (a light near its end). */
  warn?: boolean;
  /** What the screen reader hears, when the variant says it in its own words (the light symbol). */
  label?: string;
}) {
  const fraction = left != null && of ? Math.max(0, Math.min(1, left / of)) : null;
  const heard = label ?? [name, stacks && stacks > 1 ? `${stacks} stacks` : '', left != null ? `${left} ${unit} left` : '', warn ? 'running low' : ''].filter(Boolean).join(', ');
  return (
    <span className={`status-symbol${warn ? ' status-symbol--warn' : ''}`} role="img" aria-label={heard}>
      {/* The track always shows; a hidden timer (or none) is the track without its fill. */}
      <svg className="status-symbol__ring" viewBox="0 0 36 36" aria-hidden="true">
        <circle className="status-symbol__track" cx="18" cy="18" r="16" />
        {fraction !== null && <circle className="status-symbol__fill" cx="18" cy="18" r="16" pathLength={100} strokeDasharray={`${fraction * 100} 100`} />}
      </svg>
      <span className="status-symbol__mark" aria-hidden="true">
        {symbol ?? name.slice(0, 1)}
      </span>
      {warn && (
        // The warning sign (final drafts A4), in place of the plain ▲ (plan m5b-players-screens-standard A3).
        <span className="status-symbol__low" aria-hidden="true">
          <WarningSign size={12} />
        </span>
      )}
      {stacks && stacks > 1 && (
        <span className="status-symbol__stacks" aria-hidden="true">
          {stacks}
        </span>
      )}
    </span>
  );
}

/**
 * The light symbol (06 Components, M5-6, M5-8): the status symbol for a lit light, its ring in the lit-light glow
 * draining as it burns; at its warning (07 `warnAt`) the ring turns the warning colour and the ▲ shape shows. A light
 * that never runs out has the full ring.
 */
export function LightSymbol({ name, left, of, words, warn = false }: { name: string; left: number | null; of: number | null; words: string; warn?: boolean }) {
  const full = left === null || !of;
  return (
    <span className="light-symbol">
      <StatusSymbol name={name} symbol="✦" left={full ? 1 : left} of={full ? 1 : of} warn={warn} label={`${name}, lit, ${words}${warn ? ', running low' : ''}`} />
    </span>
  );
}

/**
 * A procedure step's or an event's symbol (the app's closed list, docs/07; placeholders until the icon family has
 * them): its first letter in a circle, named for screen readers. `current` gets the heavier ring, `done` fades and
 * carries a ✓, so neither leans on colour alone.
 */
export function StepSymbol({ symbol, label, state, small = false }: { symbol: string; label: string; state?: 'current' | 'done'; small?: boolean }) {
  // Icons over letters (M5 gate B11): the symbol's icon, or its letter where there's no clear icon.
  const mark = state === 'done' ? '✓' : hasStepIcon(symbol) ? <StepIcon name={symbol} size={small ? 14 : 18} /> : symbol === 'dot' ? '•' : symbol.slice(0, 1).toUpperCase();
  return (
    <span className={`step-symbol${state ? ` step-symbol--${state}` : ''}${small ? ' step-symbol--small' : ''}`} role="img" aria-label={state === 'done' ? `${label}, done` : label}>
      <span aria-hidden="true">{mark}</span>
    </span>
  );
}

/** Loading: skeleton rows (they hold still under reduced motion). */
export function SkeletonRows({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton__row" style={{ inlineSize: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

/** The offline pill and its variants (docs/06 "Offline and sync states"). */
export function OfflinePill({
  kind,
  waiting = 0,
  onOpen,
}: {
  kind: 'offline' | 'catching-up' | 'gm-offline' | 'read-only';
  waiting?: number;
  onOpen: () => void;
}) {
  const words =
    kind === 'offline'
      ? `Offline, ${waiting} waiting`
      : kind === 'catching-up'
        ? 'Catching up…'
        : kind === 'gm-offline'
          ? 'GM offline, time paused'
          : 'Read-only, other device running';
  // Waiting changes are a warning (▲); the rest is information (ⓘ). The full sentence opens on tap.
  const warn = kind === 'offline';
  return (
    <button type="button" className={`offline-pill${warn ? ' offline-pill--warning' : ''}`} onClick={onOpen}>
      <span aria-hidden="true">{warn ? <WarningSign /> : 'ⓘ'}</span>
      <span>{words}</span>
    </button>
  );
}

/** "waiting" on your own unsynced value; an age on someone else's older than 2 minutes. */
export function SyncTag({ waiting, ageMinutes }: { waiting?: boolean; ageMinutes?: number }) {
  if (waiting) return <span className="sync-tag sync-tag--waiting">waiting</span>;
  if (ageMinutes !== undefined && ageMinutes > 2) return <span className="sync-tag sync-tag--age">seen {ageMinutes} min ago</span>;
  return null;
}

/** How long a toast lasts, app-wide (ruled mm-6, 2026-11-10; was 8). Keep `--toast-time` in tokens.css the same. */
export const TOAST_SECONDS = 6;

/**
 * The toast (one at a time, above the tab bar): past tense, what moved, and Undo for 6 seconds with a draining bar.
 * Under reduced motion the bar holds still.
 */
export function Toast({
  text,
  onUndo,
  action,
  onDone,
  seconds = TOAST_SECONDS,
  error = false,
  warning,
  undoIcon = false,
}: {
  text: string;
  /**
   * The **icon Undo** variant (K12, the lead's ruling on ⚑ 6 of #66, 24 Nov): Undo as a small stacked button, the set's
   * turned-back arrow (ic-2) above the word, never underlined (fl-1). The stash's Take uses it.
   */
  undoIcon?: boolean;
  /** The **warning** variant (K12, PK4b): a line of its own under the words, the warning sign first ("Over the limit: …"). */
  warning?: string;
  onUndo?: () => void;
  /**
   * The action variant (M5 step 7): one tap that does the obvious next thing instead of Undo, named for it ("Light
   * another", "Refill (2 left)"). A toast has Undo or an action, never both.
   */
  action?: { label: string; run: () => void };
  onDone: () => void;
  seconds?: number;
  /** Something went wrong or can't be done: announced at once. */
  error?: boolean;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [onDone, seconds]);
  return (
    <div className="toast" role={error ? 'alert' : 'status'}>
      <span className="toast__text">
        {text}
        {warning && (
          <span className="toast__warning">
            <WarningLine>{warning}</WarningLine>
          </span>
        )}
      </span>
      {onUndo && undoIcon ? (
        <StackedButton icon="anticlockwise-rotation" label="Undo" className="toast__undo-icon" onClick={onUndo} />
      ) : onUndo ? (
        <button type="button" className="toast__undo" onClick={onUndo}>
          Undo
        </button>
      ) : (
        action && (
          <button type="button" className="toast__undo" onClick={action.run}>
            {action.label}
          </button>
        )
      )}
      <span className="toast__bar" style={{ animationDuration: `${seconds}s` }} aria-hidden="true" />
    </div>
  );
}

/** The phone's sticky bottom bar for the one primary action (top right on tablet). `phone` keeps the phone look at any width. */
export function ActionBar({ children, phone = false }: { children: ReactNode; phone?: boolean }) {
  return <div className={`action-bar${phone ? ' action-bar--phone' : ''}`}>{children}</div>;
}

/** A large card that moves on with one tap ("Which way?"): no selected state, nothing to confirm. */
export function ChoiceCard({ title, summary, onChoose }: { title: string; summary: string; onChoose: () => void }) {
  return (
    <button type="button" className="choice-card" onClick={onChoose}>
      <span className="choice-card__title">{title}</span>
      <span className="choice-card__summary">{summary}</span>
    </button>
  );
}

/**
 * A card that opens its panel or sheet (What we know, S4-4; the location view on a phone, S7): its title on one line
 * and a quiet summary under it, the whole card one tap target. On a phone the › sits at the card's right edge, centred
 * (long names wrap in the text column); from 600 px it follows the summary. `label` is what a screen reader hears.
 */
export function OpenCard({ title, summary, label, onOpen, icon }: { title: string; summary: string; label: string; onOpen: () => void; icon?: IconName }) {
  // The **icon** variant (the players' place card's rows, P4; frames PR4 and PL1b): the icon at the left, the title in the
  // heading type, the chevron at the right edge at every width.
  return (
    <button type="button" className={icon ? 'open-card open-card--icon' : 'open-card'} onClick={onOpen} aria-label={label}>
      {icon && (
        <span className="open-card__icon" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="open-card__text">
        <span className="open-card__title">{title}</span>
        {summary && <span className="open-card__summary">{summary}</span>}
      </span>
      <span className="open-card__chevron" aria-hidden="true">
        {icon ? <Icon name="chevron" size={20} /> : '›'}
      </span>
    </button>
  );
}

/**
 * A list row: name, one line of meaning, marks, then a ▲ line when it isn't allowed (never greyed: still tappable).
 * Chosen: ✓ in a fixed slot at the end edge, announced as checked (`checks`: one ✓ per time, the Roll sequence's row
 * landed on more than once, ✓✓). Viewed (list and detail): the heavier border without ✓, announced as current.
 */
export function OptionRow({
  name,
  summary,
  marks,
  notAllowed,
  selected,
  current,
  onPick,
  compact = false,
  notAllowedLabel = 'Not allowed:',
  range,
  rangeWidth,
  checks = 1,
  label,
  multiple = false,
}: {
  name: string;
  summary: string;
  marks?: string;
  /** How many ✓ when chosen (the Roll sequence's row rolled twice shows ✓✓; phone test, 2026-11-09). */
  checks?: number;
  /** The accessible name when the words on screen aren't enough (a row rolled twice: "… picked twice", read aloud only). */
  label?: string;
  notAllowed?: string;
  /**
   * The **compact** variant (a kit's roll step, Design 2026-11-06): the row's words in body type, as a table sheet's
   * row ("1–2 · Eel knife"); the whole row is the target.
   */
  compact?: boolean;
  /**
   * The compact variant's roll in its own narrow column before the words (a name table's row, final drafts C: "1"
   * beside "Adderbald", no colon).
   */
  range?: string;
  /**
   * The range column's width in characters, the widest range of its table, so every row's words start at one place
   * (dec-10 F-a, the lead on #786); left out, the column's least width.
   */
  rangeWidth?: number;
  /** The ▲ line's bold word; '' for the reason alone. */
  notAllowedLabel?: string;
  /** One of several picks (a list where more than one is taken, dec-10 E): a checkbox to a screen reader, not a radio. */
  multiple?: boolean;
  /** Chosen. */
  selected?: boolean;
  /** The one being viewed beside its detail. */
  current?: boolean;
  onPick: () => void;
}) {
  return (
    <button type="button" role={multiple ? 'checkbox' : 'radio'} aria-label={label} aria-checked={!!selected} aria-current={current ? 'true' : undefined} className={`option-row${compact ? ' option-row--compact' : ''}`} onClick={onPick}>
      {range !== undefined && (
        <span className="option-row__range" style={rangeWidth ? { minInlineSize: `${rangeWidth}ch` } : undefined}>
          {range}
        </span>
      )}
      {/* A space for a screen reader ("1 Adderbald"); a flex row drops it from the layout. */}
      {range !== undefined && ' '}
      <span className="option-row__body">
        <span className="option-row__name">
          {name}
          {marks && <span className="option-row__marks"> {marks}</span>}
        </span>
        {summary && <span className="option-row__summary">{summary}</span>}
        {notAllowed && (
          <span className="option-row__not-allowed">
            <strong>
              <WarningSign />
              {notAllowedLabel}
            </strong>
            {' '}
            {notAllowed}
          </span>
        )}
      </span>
      <span className="row-check" aria-hidden="true">
        {selected ? '✓'.repeat(Math.max(1, checks)) : ''}
      </span>
    </button>
  );
}

export interface Destination {
  id: string;
  name: string;
  group: 'Equipped' | 'Containers' | 'Party' | 'People';
  room?: string;
  /** Why it can't take this ("Full", "Lantern Wardens can't use plate"). */
  blocked?: string;
}

/** The destination list shared by Add, Give and Move: grouped, one selected, room left, blocked rows explain. */
export function DestinationList({
  label,
  destinations,
  selected,
  onSelect,
  onBlocked,
}: {
  label: string;
  destinations: Destination[];
  selected: string | null;
  onSelect: (id: string) => void;
  onBlocked: (reason: string) => void;
}) {
  const groups = [...new Set(destinations.map((d) => d.group))];
  return (
    <div className="destinations" role="radiogroup" aria-label={label}>
      {groups.map((group) => (
        <section key={group} className="destinations__group" aria-label={group}>
          <h3 className="destinations__title">{group}</h3>
          {destinations
            .filter((d) => d.group === group)
            .map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                className={`destinations__row${d.blocked ? ' destinations__row--blocked' : ''}`}
                aria-checked={selected === d.id}
                onClick={() => (d.blocked ? onBlocked(d.blocked) : onSelect(d.id))}
              >
                <span className="destinations__name">{d.name}</span>
                <span className={`destinations__room${d.blocked ? ' destinations__room--blocked' : ''}`}>
                  {/* The warning sign, never a plain ▲ (06 rule 12; Design, ⚑ 6 on #561). */}
                  {d.blocked && <WarningSign size={16} />}
                  {d.blocked === 'Full' ? 'Full' : d.blocked ? 'Not allowed' : d.room}
                </span>
                <span className="row-check" aria-hidden="true">
                  {selected === d.id ? '✓' : ''}
                </span>
              </button>
            ))}
        </section>
      ))}
    </div>
  );
}

/** How many, for Give, Drop and Move: a stepper starting at the whole stack, plus "All N". */
export function HowMany({ of, value, onChange }: { of: number; value: number; onChange: (value: number) => void }) {
  return (
    <div className="how-many">
      <Stepper label="how many" value={value} min={1} max={of} onChange={onChange} />
      <Chip onClick={() => onChange(of)}>All {of}</Chip>
    </div>
  );
}

/** The most segments the bar draws (plan m5b-sheet-revised 13); past it, one continuous bar. */
const HP_BAR_MOST = 20;

/**
 * The hit-point bar (M6-3, ruled 2026-10-26): one segment per HP up to 12, one per 5 HP above, a part-lost segment
 * filled partly. `fills` is each segment's fill, 0 to 1. Past 20 segments the pips become one continuous bar, filled
 * to the share left (the **continuous** variant). Shape only; the number beside it says the same in words.
 */
export function HpBar({
  fills,
  small = false,
  whole = false,
}: {
  fills: number[];
  /** The party circle's (S12): narrow pips under a name. */
  small?: boolean;
  /** The fills are already one continuous bar (`hpSegments` past 20 segments gives a single fill): draw it whole. */
  whole?: boolean;
}) {
  if (fills.length === 0) return null;
  const shown = fills.length > HP_BAR_MOST ? [fills.reduce((sum, f) => sum + f, 0) / fills.length] : fills;
  return (
    <span className={`${(shown.length === 1 && fills.length !== 1) || whole ? 'hp-bar hp-bar--whole' : 'hp-bar'}${small ? ' hp-bar--small' : ''}`} aria-hidden="true">
      {shown.map((fill, i) => (
        <span key={i} className={fill === 0 ? 'hp-bar__segment hp-bar__segment--lost' : 'hp-bar__segment'}>
          <span className="hp-bar__fill" style={{ inlineSize: `${Math.round(fill * 100)}%` }} />
        </span>
      ))}
    </span>
  );
}

/**
 * A skill name longer than this many characters takes the whole row of the grid: at 375 px a column holds about 10
 * to 12 characters a line, so past 24 the name would wrap past two lines (#410's pictures). Short names keep two columns.
 */
const LONG_SKILL_NAME = 24;

/** Skills on the Player screen (ruled 2026-10-26): two columns, each a name with its value in the pack's style; a tap opens its rules. */
export function SkillGrid({ skills, onOpen }: { skills: { key: string; name: string; value: string; tag?: string }[]; onOpen: (key: string) => void }) {
  return (
    <div className="skill-grid">
      {skills.map((skill) => (
        <button key={skill.key} type="button" className={`skill-grid__skill${skill.name.length > LONG_SKILL_NAME ? ' skill-grid__skill--wide' : ''}`} aria-label={`${skill.name}${skill.tag ? `, ${skill.tag}` : ''} ${skill.value}`} onClick={() => onOpen(skill.key)}>
          <span className="skill-grid__name">
            {skill.name}
            {/* The tagged variant (sr-2): who changed it ("kindred"), in words under the name. */}
            {skill.tag && <span className="skill-grid__tag">{skill.tag}</span>}
          </span>
          <span className="skill-grid__value">{skill.value}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * A figure's breakdown in its pop-up (sr-8): one row per part, its name and its number ("Melee · STR +0 · 19"); with
 * descending AC the to-hit row (the d20 roll needed by the target's AC, the printed sheet's matrix); then where it
 * comes from. The rows are a list later work adds to (patches, of-14). `lines`: a figure worked out in words
 * (explainFigure, ct3-9), one plain line each, the same wherever the figure is tapped (bq-2: the full sheet, the
 * Player screen, creation's Derived fields).
 */
export function Breakdown({
  rows = [],
  lines = [],
  toHit,
  ending,
  empty,
}: {
  rows?: { label: string; value: string }[];
  lines?: readonly string[];
  toHit?: { ac: number; roll: number }[] | null;
  ending?: string;
  empty?: string;
}) {
  const n = (value: number) => (value < 0 ? `−${-value}` : String(value));
  return (
    <>
      {rows.length > 0 ? (
        <dl className="breakdown">
          {rows.map((row) => (
            <div key={row.label} className="breakdown__row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        lines.length === 0 && empty && <p className="reading">{empty}</p>
      )}
      {lines.map((line, i) => (
        <p key={`${i}:${line}`} className="reading">
          {line}
        </p>
      ))}
      {toHit && toHit.length > 0 && (
        <div className="breakdown__to-hit">
          <p className="reading">To hit, roll at least this on the d20, by the target’s AC:</p>
          {/* Five ACs to a table (AC 9–5, then 4–0), each with its own Roll line: on a phone they sit one above the other,
              every column in sight; from 600 px they join into one row as before (sr-8; #410's pictures). */}
          <div className="breakdown__to-hit-rows">
            {chunks(toHit, 5).map(([first, ...rest]) => (
              <table key={first.ac} className="breakdown__table" aria-label={`To hit by AC ${n(first.ac)} to ${n((rest.at(-1) ?? first).ac)}`}>
                <tbody>
                  <tr>
                    <th scope="row">AC</th>
                    {[first, ...rest].map((t) => (
                      <td key={t.ac}>{n(t.ac)}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Roll</th>
                    {[first, ...rest].map((t) => (
                      <td key={t.ac}>{n(t.roll)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            ))}
          </div>
        </div>
      )}
      {ending && <p className="reading auth__meta">{ending}</p>}
    </>
  );
}

/** A list cut into runs of `size` (the last may be shorter). */
function chunks<T>(list: T[], size: number): [T, ...T[]][] {
  const out: [T, ...T[]][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size) as [T, ...T[]]);
  return out;
}

/**
 * The column counts a row of tiles tries, widest first: `max`, then each narrower count that keeps the rows even (five
 * saves: 5, then 3 + 2, then 2, then 1; six scores from 3: 3, 2, 1). Pure.
 */
export function tileColumnSteps(count: number, max: number): number[] {
  const steps = [Math.max(1, Math.min(max, count))];
  for (let rows = Math.max(1, Math.ceil(count / max)); rows <= count; rows++) {
    const columns = Math.ceil(count / rows);
    if (columns < steps[steps.length - 1]!) steps.push(columns);
  }
  return steps;
}

/**
 * A row of Score or Save tiles that never breaks a word (gate finding F8, Design 2026-11-10): it starts at `max`
 * columns and, while any label's longest word is wider than its tile, steps down to the next even count
 * (`tileColumnSteps`). Measured before paint, and again when the row's width, its labels, the fonts or the text size
 * (`--text-scale` on the root, `applyTextSize`) change. The count reaches the CSS as `--tile-columns`.
 */
const textScale = () => (typeof document === 'undefined' ? '' : document.documentElement.style.getPropertyValue('--text-scale'));

function useTileColumns(labels: string[], max: number) {
  const ref = useRef<HTMLDivElement>(null);
  const steps = tileColumnSteps(labels.length, max);
  const said = labels.join('\n');
  const [step, setStep] = useState(0);
  const [width, setWidth] = useState(0);
  const [fonts, setFonts] = useState(0);
  const [scale, setScale] = useState(textScale);
  // New labels, a new width, the fonts arriving or a new text size: try the widest count again. The first width the
  // row reports (from 0, on mount) only records it: the row was already measured at that width before paint.
  const [tried, setTried] = useState({ said, max, width, fonts, scale });
  const changed = tried.said !== said || tried.max !== max || tried.fonts !== fonts || tried.scale !== scale;
  if (changed || tried.width !== width) {
    setTried({ said, max, width, fonts, scale });
    if (changed || tried.width !== 0) setStep(0);
  }
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || step >= steps.length - 1) return;
    const squeezed = [...el.querySelectorAll('.stat-tile__label')].some((label) => label.scrollWidth > label.clientWidth + 1);
    if (squeezed) setStep(step + 1);
  }, [step, steps.length, tried]);
  useEffect(() => {
    const el = ref.current;
    // A font that finishes loading after the first measure changes every word's width. WebKit (Safari's engine) fires
    // `loading` but never `loadingdone` (gate finding F8, fix-F8), so wait on `ready` instead: now (fonts still
    // loading as the row mounted), and after each `loading`. flushSync re-measures before anything else reads the
    // row, the layout check's own `await document.fonts.ready` included.
    let live = true;
    const fontSet = 'fonts' in document ? document.fonts : null;
    const fontsLoaded = () => {
      void fontSet?.ready.then(() => {
        if (live) flushSync(() => setFonts((n) => n + 1));
      });
    };
    fontsLoaded();
    fontSet?.addEventListener('loading', fontsLoaded);
    // The row's width; never the labels themselves (measuring them as they re-flow would loop).
    const watch = el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => setWidth(Math.round(el.clientWidth))) : null;
    if (el) watch?.observe(el);
    // The text size: applyTextSize sets --text-scale in the root's style, which leaves the row's width as it was.
    const sized = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => setScale(textScale())) : null;
    sized?.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => {
      live = false;
      fontSet?.removeEventListener('loading', fontsLoaded);
      watch?.disconnect();
      sized?.disconnect();
    };
  }, []);
  return { ref, style: { '--tile-columns': steps[Math.min(step, steps.length - 1)] } as CSSProperties };
}

/**
 * Scores on the full sheet (plan m5b-players-screens-standard D): the **Score tile** variant of the vitals tile, one per
 * ability in the pack's order, the ability's full name (the 2026-11-09 ruling, gate finding F8), the score and its
 * modifier under it; three to a row, so six sit in two rows at 375 px, two to a row when a name's longest word wouldn't
 * fit three across (never a word broken). A tap opens its breakdown sheet.
 */
export function ScoreRow({ scores, onOpen }: { scores: { key: string; name: string; value: string; modifier?: string; modifierSaid?: string }[]; onOpen: (key: string) => void }) {
  const { ref, style } = useTileColumns(
    scores.map((s) => s.name),
    3,
  );
  return (
    <div ref={ref} className="score-row" style={style}>
      {scores.map((score) => (
        <StatTile
          key={score.key}
          small
          label={score.name}
          value={score.value}
          caption={score.modifier || undefined}
          onTap={() => onOpen(score.key)}
          tapLabel={`${score.name} ${score.value}${score.modifierSaid || score.modifier ? `, ${score.modifierSaid || score.modifier}` : ''}: where it comes from`}
        />
      ))}
    </div>
  );
}

/**
 * Saves on the Player screen and the full sheet (ruled 2026-10-26; plan m5b-players-screens-standard B, D): the **Save
 * tile** variant of the vitals tile, one per save in the pack's order, the pack's short name over the number (the
 * 2026-11-09 ruling, gate finding F8: `short`, else the name's first word, never the key; `savesOf`); five sit across a
 * phone, fewer and even (three and two) when a label's longest word wouldn't fit (never a word broken). A tap opens its
 * breakdown sheet.
 */
export function SaveRow({ saves, onOpen }: { saves: { key: string; short: string; name: string; value: string }[]; onOpen: (key: string) => void }) {
  const { ref, style } = useTileColumns(
    saves.map((s) => s.short),
    5,
  );
  return (
    <div ref={ref} className="save-tiles" style={style}>
      {saves.map((save) => (
        <StatTile key={save.key} small label={save.short} value={save.value} onTap={() => onOpen(save.key)} tapLabel={`${save.name} ${save.value}: where it comes from`} />
      ))}
    </div>
  );
}

/** The use dots' two marks (ruled 2026-10-26): filled for a use left, a ring for a spent one (shape, never colour alone). */
const PIP_LEFT = '●';
const PIP_SPENT = '○';
/** The most pips a Pinned block draws (pg28-8): past it, the words alone ("999 of 999 left"). */
const BLOCK_PIPS = 10;

/**
 * The use dots as marks only, inside a trait chip (tc-2): a filled dot per use left, then a ring per spent one, as
 * `UseDots` draws them; past five, "●×4 ○×3". Hidden from screen readers: the chip's label says "1 of 3 left".
 * `ink`: the **ink pips** (frame P1 of december/14): both marks in ink, as the Player screen's Traits rows draw them.
 */
export function UsePips({ uses, spent, ink = false, block = false }: { uses: number; spent: number; ink?: boolean; block?: boolean }) {
  const used = Math.max(0, Math.min(uses, spent));
  const left = uses - used;
  // The **block** variant (a Pinned block; pg28-8, frame M4d): each pip up to ten; past ten no pips, the words alone count.
  if (block && uses > BLOCK_PIPS) return null;
  const many = !block && uses > 5;
  return (
    <span className={ink ? 'use-pips use-pips--ink' : 'use-pips'} aria-hidden="true">
      {' '}
      {many ? (left > 0 ? `${PIP_LEFT}×${left}` : '') : PIP_LEFT.repeat(left)}
      {used > 0 && <span className="use-pips__spent">{many ? `${left > 0 ? ' ' : ''}${PIP_SPENT}×${used}` : PIP_SPENT.repeat(used)}</span>}
    </span>
  );
}

/**
 * Use dots for a limited-use power (ruled 2026-10-26): one dot per use, filled while it's left. Tap a filled dot
 * to mark a use; tap a spent one to give it back. Each dot is a 44 px target; the words say what's left.
 */
export function UseDots({ name, uses, spent, onChange }: { name: string; uses: number; spent: number; onChange: (spent: number) => void }) {
  const left = Math.max(0, uses - spent);
  return (
    <div className="use-dots" role="group" aria-label={`${name}: ${left} of ${uses} left`}>
      {Array.from({ length: uses }, (_, i) => {
        const isLeft = i < left;
        return (
          <button
            key={i}
            type="button"
            className={isLeft ? 'use-dots__dot' : 'use-dots__dot use-dots__dot--spent'}
            aria-label={isLeft ? `Use ${name}` : `Give back a use of ${name}`}
            onClick={() => onChange(isLeft ? spent + 1 : spent - 1)}
          >
            <span aria-hidden="true">{isLeft ? PIP_LEFT : PIP_SPENT}</span>
          </button>
        );
      })}
      <span className="use-dots__left">{left === 0 ? 'None left' : `${left} left`}</span>
    </div>
  );
}

/** One ready spell on the Magic tab (mm-1): one row a spell at its level, whatever the times it is ready. */
export interface ReadySpellRow {
  key: string;
  name: string;
  /** Its duration and range, worked out for the caster ("6 turns, 30 ft"). */
  line?: string;
  /** How many castings it was prepared with; a spell prepared once has no dots (mm-1). */
  times: number;
  /** How many castings are left: none left, it is crossed out and says "Cast". */
  left: number;
}

/**
 * One spell level on the Magic tab (mm-1, mp-20; mockup magic/04, approved 2026-11-10): the level line ("Level 1, 2 a
 * day"), then a row a ready spell: its name, with a dot for each casting when it was prepared more than once (the use
 * pips, the castings left filled, the cast ones hollow), its duration and range under it, and **Cast** while a casting
 * is left. With none left the name is crossed out and the line says "Cast" in words, never colour alone, and the row
 * sinks below the others (06). Anywhere on the row but Cast opens the spell's rules.
 */
export function SpellLevel({
  level,
  title = `Level ${level}`,
  slots,
  spells,
  onOpen,
  onCast,
}: {
  level: number;
  /** The level's words: the list's own where it names the level (lv-1, pf-22; `levelWord`'s 'title'), else "Level N". */
  title?: string;
  /** The caster's spells a day at this level; 0 says only the level (a spell ready where the slots give none, level 0 too). */
  slots: number;
  spells: readonly ReadySpellRow[];
  onOpen: (key: string) => void;
  onCast: (key: string) => void;
}) {
  const ordered = [...spells.filter((s) => s.left > 0), ...spells.filter((s) => s.left <= 0)];
  // Level 0 is "Level 0" like any other unless the list names it: the app writes no game's word (hard rule 2; lv-1).
  const heading = slots > 0 ? `${title}, ${slots} a day` : title;
  return (
    <section className="spell-level" aria-label={heading}>
      <h3 className="spell-level__title">{heading}</h3>
      <RowList>
        {ordered.map((spell) => {
          const spent = spell.left <= 0;
          const dots = !spent && spell.times > 1;
          const said = [spell.name, dots ? `${spell.left} of ${spell.times} left` : '', spent ? 'cast' : spell.line].filter(Boolean).join(', ');
          if (spent)
            return <ListRow key={spell.key} title={<s className="spell-level__cast">{spell.name}</s>} sub="Cast" openLabel={said} onOpen={() => onOpen(spell.key)} chevron={false} />;
          const title = (
            <>
              {spell.name}
              {dots && <UsePips uses={spell.times} spent={spell.times - spell.left} />}
            </>
          );
          return (
            <ListRow
              key={spell.key}
              title={title}
              {...(spell.line ? { sub: spell.line } : {})}
              openLabel={said}
              onOpen={() => onOpen(spell.key)}
              action="Cast"
              actionLabel={`Cast ${spell.name}`}
              actionIcon="magic-palm"
              onAction={() => onCast(spell.key)}
            />
          );
        })}
      </RowList>
    </section>
  );
}

/**
 * The damage pad (M6-3, ruled 2026-10-26; replaces the HP quick chips): who it's for, Damage or Heal, a stepper
 * −5 −1 [N] +1 +5 starting at the last amount (tap the number to type a big one), then "Take N damage" / "Heal N".
 * Settled, see 09 2026-10-26 (M6-3): the stepper only; no quick-amount buttons and no damage cap. Don't re-propose.
 */
export function DamagePad({
  target,
  start,
  onConfirm,
  extra,
  healing = false,
}: {
  /** Who takes it ("Wren"). */
  target: string;
  /** Opens on Heal (a full rest's Heal prompt); Damage otherwise. */
  healing?: boolean;
  /** The last amount used, where the stepper starts. */
  start: number;
  onConfirm: (amount: number, heal: boolean) => void;
  /** A quiet way out under the main button (the Player screen's "Type the hit points instead"). */
  extra?: ReactNode;
}) {
  const id = useId();
  const [heal, setHeal] = useState(healing);
  const [amount, setAmount] = useState(Math.max(1, Math.trunc(start) || 1));
  const [typing, setTyping] = useState<string | null>(null);
  const by = (n: number) => {
    const next = Math.max(1, Math.min(9999, amount + n));
    setAmount(next);
    if (typing !== null) setTyping(String(next));
  };
  const typed = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    setTyping(digits);
    if (Number(digits) >= 1) setAmount(Number(digits));
  };
  return (
    <div className="damage-pad">
      <p className="damage-pad__target">{target}</p>
      <ButtonRow
        label="Damage or heal"
        options={[
          { value: 'damage', label: 'Damage' },
          { value: 'heal', label: 'Heal' },
        ]}
        value={heal ? 'heal' : 'damage'}
        onChange={(v) => setHeal(v === 'heal')}
      />
      <div className="damage-pad__stepper" role="group" aria-label="Amount">
        <button type="button" className="damage-pad__step" onClick={() => by(-5)}>
          −5
        </button>
        <button type="button" className="damage-pad__step" onClick={() => by(-1)}>
          −1
        </button>
        {typing !== null ? (
          <input
            id={id}
            className="damage-pad__field"
            aria-label="Amount"
            inputMode="numeric"
            pattern="[0-9]*"
            value={typing}
            // The one field that takes focus as it appears (A4 allows it): the person tapped the number to type it.
            autoFocus
            onChange={(e) => typed(e.target.value)}
            onBlur={() => setTyping((t) => (t === '' ? null : t))}
          />
        ) : (
          <button type="button" className="damage-pad__amount" aria-label={`Amount ${amount}. Type a number`} onClick={() => setTyping(String(amount))}>
            {amount}
          </button>
        )}
        <button type="button" className="damage-pad__step" onClick={() => by(1)}>
          +1
        </button>
        <button type="button" className="damage-pad__step" onClick={() => by(5)}>
          +5
        </button>
      </div>
      <ActionBar>
        <button type="button" className="button-primary" onClick={() => onConfirm(amount, heal)}>
          {heal ? `Heal ${amount}` : `Take ${amount} damage`}
        </button>
      </ActionBar>
      {extra}
    </div>
  );
}

/** One line of guidance at the top of a guided step (the named exception to "no explanations on screen"). */
export function GuidedInstruction({ children }: { children: ReactNode }) {
  return <p className="guided-instruction">{children}</p>;
}

/** "Step 3 of 8" above a guided step's title: only this character's steps count (05, M5b step 0). */
export function StepCounter({ children }: { children: ReactNode }) {
  return <p className="step-counter">{children}</p>;
}

/**
 * Help me choose (05, M5b step 0): a full-width button with ⓘ under the why-line (final drafts A6). Open, it becomes a
 * full-width box that grows to its text, closed by a ✕ at its top right (no worded close button). It shows the pack's
 * longer guidance for the step; without any, the choices' blurbs side by side (ruled 2026-11-01, ⚑ 1). With neither
 * there's nothing to show, so the button isn't there.
 */
export function HelpMeChoose({ help, choices = [], defaultOpen = false, extra }: { help: string | null; choices?: { name: string; blurb: string }[]; defaultOpen?: boolean; /** After the help's words (R3-7: the prime experience table). */ extra?: ReactNode }) {
  // `defaultOpen` draws it open (the gallery's specimen, #526); in the app it starts folded.
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  // Focus follows the swap: to the ✕ when it opens, back to the button when it closes (never on the first draw).
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    (open ? closer : opener).current?.focus({ preventScroll: true });
  }, [open]);
  const toggle = (next: boolean) => {
    moved.current = true;
    setOpen(next);
  };
  const withBlurbs = choices.filter((c) => c.blurb.trim() !== '');
  if (!help && withBlurbs.length === 0 && !extra) return null;
  return (
    <div className="help-choose">
      {!open && (
        <button ref={opener} type="button" className="button-secondary button-secondary--small help-choose__link" aria-expanded={false} aria-controls={id} onClick={() => toggle(true)}>
          <Icon name="info" size={20} />
          Help me choose
        </button>
      )}
      {open && (
        <div id={id} className="help-choose__panel" role="region" aria-label="Help me choose">
          <button ref={closer} type="button" className="help-choose__close" aria-label="Close help" onClick={() => toggle(false)}>
            <span aria-hidden="true">✕</span>
          </button>
          {help ? (
            help.split(/\n\s*\n/).map((paragraph, n) => (
              <p key={n} className="help-choose__text">
                {paragraph}
              </p>
            ))
          ) : withBlurbs.length === 0 ? null : (
            <ul className="help-choose__side">
              {withBlurbs.map((c) => (
                <li key={c.name} className="help-choose__choice">
                  <span className="help-choose__name">{c.name}</span>
                  <span className="help-choose__blurb">{c.blurb}</span>
                </li>
              ))}
            </ul>
          )}
          {extra}
        </div>
      )}
    </div>
  );
}

/** "From your setting: River Rules · p. 12": the last line of a rules pop-up. */
export function SourceLine({ children }: { children: ReactNode }) {
  return <p className="source-line">{children}</p>;
}

/**
 * A row of things for sale (cs-21, picture creation/final 21-F5; built once for the creation shop, the town's market to
 * reuse it, po-2): the name as the tap to the thing's entry, in the link style (no ⓘ); under it what it is and its
 * weight, the price at the right of that line; the two-coins **Buy** at the row's end, buying at once; where the
 * character can't use it, the warning sign and why ("A Reed Witch can't use it." and the pack's reason), still bought.
 * Nothing only a town would need (stock, a seller): the town names its own variant.
 */
export function StockRow({ name, line, price, warn, onOpen, onBuy }: { name: string; line: string; price: string; warn?: string; onOpen: () => void; onBuy: () => void }) {
  return (
    <li className="stock-row">
      <span className="stock-row__text">
        <button type="button" className="stock-row__name" onClick={onOpen}>
          {name}
        </button>
        <span className="stock-row__line">
          {price && <span className="stock-row__price">{price}</span>}
          {line}
        </span>
        {warn && <WarningLine>{warn}</WarningLine>}
      </span>
      <StackedButton icon="two-coins" label="Buy" aria-label={`Buy ${name}${price ? `, ${price}` : ''}`} className="stock-row__buy" onClick={onBuy} />
    </li>
  );
}

/** The set's generic mark (the scales; pf-12e, sb-2): a button whose word has no ruled icon yet carries it over its word. */
export const GENERIC_MARK = 'scales' as const;

/**
 * The stacked button (stk-1, st-6, stk-2; the shape of the shop's Buy, cs-21): an icon from the set above its word,
 * never the icon alone, at least a 44 px tap high and 88 px wide; the word in 14 px, centred, always on one line, a long
 * one widening the button (no widest). Where several sit together, `StackedGroup` gives them one width. Secondary by default;
 * `primary` is the screen's one accent button. `aria-label` gives a fuller name where the word alone is too short
 * (Buy names the thing and its price); `className` adds a row's own class.
 */
export function StackedButton({
  icon,
  label,
  variant = 'secondary',
  onClick,
  className,
  'aria-label': ariaLabel,
  'aria-haspopup': hasPopup,
  submit = false,
}: {
  /**
   * An icon from the set, or one of the app's line icons where an approved frame draws one (Hide all's closed eye, B3);
   * null where none is ruled yet, which draws the generic mark (sb-2, pf-12e) over the word.
   */
  icon: IconName | SetIconName | null;
  label: string;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
  className?: string;
  'aria-label'?: string;
  /** "dialog" where the tap opens a sheet (a weapon's mode sheet, the Attack sheet). */
  'aria-haspopup'?: 'dialog';
  /** The form's own button (a sheet's Enter): it submits the form it sits in. */
  submit?: boolean;
}) {
  const classes = [variant === 'primary' ? 'button-primary' : 'button-secondary', 'stacked-button', className].filter(Boolean).join(' ');
  return (
    <button type={submit ? 'submit' : 'button'} className={classes} aria-label={ariaLabel} aria-haspopup={hasPopup} onClick={onClick}>
      <Icon name={icon ?? GENERIC_MARK} size={24} />
      <span>{label}</span>
    </button>
  );
}

/**
 * The stacked button's **Group** variant (stk-2): stacked buttons that sit together (a row's answers, a foot's buttons)
 * side by side in code order, every one the widest one's width. In a sheet's foot (`.dialog__actions`) it stacks into
 * one column at the right when it doesn't fit (`stackFeet`), still at one width. Its children are `StackedButton`s.
 */
export function StackedGroup({ children }: { children: ReactNode }) {
  return <div className="stacked-group">{children}</div>;
}
