// The optional rules' parts (docs/06 Components: Optional rules list; ruling lr-6, lr-7, 2026-11-02; mockup
// library/03-campaign-rules). Built once for the new campaign's step 3 and reused, editable in place, by Rules for
// this campaign (plan m5b-0d build order 4).
//   RuleRow: name · what it does (the pack's words) · source and page · when it can change, in words · "changed (the
//     book: …)" at once when it isn't the default (tf-2); up to 3 short choices as a segmented control, the
//     description behind ⓘ (tf-3); otherwise the current choice as a button with "1 of N" and ▾ opening a sheet;
//     "Decided above" when a clash callout decides it; a blocked rule stays tappable and says why (never disabled);
//     an option the app doesn't apply yet (`manual`, ex-7) says "Run by hand ›" (a link) · "the app doesn't apply this yet", and
//     that line opens its rules (one tap); its choice is saved as any other.
//   RuleChoiceSheet: a rule's choices in a sheet, the book's default marked in words, each choice's notes; on a rule
//     another pack extends (of-1), the choices under each pack's name, as the RuleKeyCard.
//   RuleSourceGroup: one source folded, "Fen Rules, Advanced · 23 rules · 2 changed"; opened, every rule, the changed
//     ones first, in an order that holds while it stays open (tf-2, tf-5: no Show all); "none" and nothing to open
//     for a pack without optional rules.
//   GroupToggle: a group's fold line, "▸ Time and calendar, 4 settings, none changed" (Rules for this campaign's
//     topic groups, lr-7); the two cards below fold with it too (rc-fold, Francis 2026-11-20).
//   RuleKeyCard: two packs with the same `ruleKey` (tf-1): every pack's choices in one list, under each pack's name;
//     one tap is the campaign's answer (that choice, and that pack for the group), ✓ on the one that counts. Folded
//     to a plain row, "▸ Initiative ties, Roll again (Fen Rules)", while a choice counts; open (its box under the
//     row) while none does, and from the start on the new campaign's step (rc-fold).
//   RuleClashCallout: the "New choice for <topic>" offer after attaching a pack (07): each pack's choice as a button
//     and the one that counts. Open from the start (the GM's confirm waits); its fold line closes it (rc-fold).
//   RulePresets: a pack's presets (`optionPresets`, A8, bq3-13) at the top of its open source group: "Presets ·" and
//     one quiet button per preset, opening its preview.
//   RulePresetPreview: what a preset would change ("Creation method: Basic → Advanced"), the load method it moves,
//     the rules it leaves and why; "Use <preset>" applies it at once (the caller shows Undo), "Not now" closes.
import { useId, useState, type ReactNode } from 'react';
import { Dialog } from './Dialog.tsx';
import { ButtonRow, InfoButton } from './parts.tsx';
import './ruleRows.css';

export interface RuleChoice {
  id: string;
  name: string;
  notes?: string;
  /** The pack's short label (`choices[].short`, about 14 letters; tf-3). */
  short?: string;
  /** The pack it comes from, on a rule another pack extends (of-1): the choices are labelled with it. */
  pack?: string;
}

/** A rule's choices from more than one pack (of-1, `extends`): shown under each pack's name, never as segments. */
export const fromSeveralPacks = (choices: readonly RuleChoice[]): boolean => new Set(choices.map((c) => c.pack ?? '')).size > 1;

/** The choices by pack, in order: one part per pack (one part with no label for a rule no pack extends). */
export function choicesByPack(choices: readonly RuleChoice[]): { pack: string; choices: RuleChoice[] }[] {
  const parts: { pack: string; choices: RuleChoice[] }[] = [];
  for (const choice of choices) {
    const pack = fromSeveralPacks(choices) ? (choice.pack ?? '') : '';
    const part = parts.find((p) => p.pack === pack);
    if (part) part.choices.push(choice);
    else parts.push({ pack, choices: [choice] });
  }
  return parts;
}

/** The longest label a segment takes (tf-3: "about 14 letters"). */
export const SHORT_LABEL = 14;

/**
 * The segment labels of a rule (tf-3): with 2 or 3 choices, each choice's `short`, else its name when that is short
 * already ("On", "Off"); null when any is missing or long, or there are more than 3 (the row shows its button).
 */
export function segmentLabels(choices: readonly RuleChoice[]): string[] | null {
  if (choices.length < 2 || choices.length > 3 || fromSeveralPacks(choices)) return null;
  const labels = choices.map((c) => c.short ?? (c.name.length <= SHORT_LABEL ? c.name : ''));
  return labels.every((l) => l !== '' && l.length <= SHORT_LABEL) ? labels : null;
}

/** A rule's choices in a sheet (lr-6, the › of a multi-choice rule): tap one to choose it; the sheet closes. */
export function RuleChoiceSheet({
  name,
  meta,
  about,
  choices,
  current,
  defaultChoice,
  onChoose,
  onClose,
  chooseCurrent = false,
}: {
  name: string;
  /** The source line, under the title. */
  meta?: string;
  about?: string;
  choices: readonly RuleChoice[];
  current: string;
  defaultChoice: string;
  onChoose: (choiceId: string) => void;
  onClose: () => void;
  /** Tapping the current choice chooses it too (from a clash callout: it also picks that pack for the group). */
  chooseCurrent?: boolean;
}) {
  return (
    <Dialog label={name} meta={meta} onClose={onClose}>
      {about && <p className="rule-sheet__about">{about}</p>}
      <div className="rule-sheet__choices" role="group" aria-label={`Choose ${name}`}>
        {choicesByPack(choices).map((part) => (
          <div key={part.pack} className={part.pack ? 'rule-key__pack' : 'rule-sheet__part'} role={part.pack ? 'group' : undefined} aria-label={part.pack || undefined}>
            {part.pack && (
              <p className="rule-key__pack-name" aria-hidden="true">
                {part.pack}
              </p>
            )}
            {part.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className="button-secondary rule-sheet__choice"
                aria-pressed={choice.id === current}
                aria-label={part.pack ? `${part.pack}, ${choice.name}` : undefined}
                onClick={() => {
                  if (choice.id !== current || chooseCurrent) onChoose(choice.id);
                  onClose();
                }}
              >
                <span className="rule-sheet__choice-name">
                  {choice.id === current && <span aria-hidden="true">✓ </span>}
                  {choice.name}
                  {choice.id === defaultChoice && <span className="rule-sheet__default">, the book's default</span>}
                </span>
                {choice.notes && ' '}{choice.notes && <span className="rule-sheet__choice-notes">{choice.notes}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Dialog>
  );
}

/** The words on an option the app doesn't apply yet (ex-7, ruled 2026-11-03), as its rules' pop-up says them. */
export const MANUAL_WORDS = "Run by hand, the app doesn't apply this yet";
/** On the row (fl-1, 2026-11-05): "Run by hand ›" the link to its rules, then the words beside it as plain quiet text. */
export const MANUAL_LINK = 'Run by hand ›';
export const MANUAL_NOTE = "the app doesn't apply this yet";

/** One optional rule (lr-6; tf-2, tf-3). */
export function RuleRow({
  name,
  about,
  source,
  choices,
  current,
  defaultChoice,
  onChoose,
  decided,
  blocked,
  onBlocked,
  manual = false,
}: {
  name: string;
  /** What it does, in the pack's words (its `notes`). */
  about?: string;
  /** "Fen Rules · p. 12 · can't change once the campaign starts". */
  source: string;
  choices: readonly RuleChoice[];
  current: string;
  defaultChoice: string;
  onChoose: (choiceId: string) => void;
  /** "Decided above · Fen Rules · weight": a clash callout decides it, so the row has no control of its own. */
  decided?: string;
  /** Why it can't change now (a locked rule in play); a tap on its control says so through `onBlocked`. */
  blocked?: string;
  onBlocked?: (why: string) => void;
  /** The app doesn't apply this option yet (`manual: true`, ex-7): the row says so, and the line opens its rules. */
  manual?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(false);
  const choose = (choiceId: string) => {
    if (blocked) return onBlocked?.(blocked);
    if (choiceId !== current) onChoose(choiceId);
  };
  const currentChoice = choices.find((c) => c.id === current);
  // A choice another pack brought (of-1) says which: "Item counts · Zine".
  const fromOther = currentChoice?.pack && fromSeveralPacks(choices) && currentChoice.pack !== choices[0]?.pack ? currentChoice.pack : '';
  const currentName = currentChoice ? (fromOther ? `${currentChoice.name}, ${fromOther}` : currentChoice.name) : current;
  const bookName = choices.find((c) => c.id === defaultChoice)?.name ?? defaultChoice;
  const changed = !decided && current !== defaultChoice;
  const labels = decided ? null : segmentLabels(choices);
  let control: ReactNode = null;
  if (decided) control = <span className="rule-row__decided">{decided}</span>;
  else if (labels) {
    control = <ButtonRow label={`Choose ${name}`} options={choices.map((c, i) => ({ value: c.id, label: labels[i]! }))} value={current} onChange={choose} />;
  } else if (choices.length > 1) {
    const at = `1 of ${choices.length}`;
    control = (
      <button
        type="button"
        className="button-secondary rule-row__value"
        aria-label={`${name}: ${currentName}, ${at}. Change`}
        onClick={() => (blocked ? onBlocked?.(blocked) : setOpen(true))}
      >
        <span className="rule-row__value-name">{currentName}</span>
        <span className="rule-row__value-count">{at}</span>
        <span className="rule-row__value-open" aria-hidden="true">
          ▾
        </span>
      </button>
    );
  }
  // On a segmented row the description waits behind ⓘ (tf-3), with each choice's notes.
  const aboutBehindInfo = Boolean(labels) && Boolean(about || choices.some((c) => c.notes));
  return (
    <div className="rule-row" role="group" aria-label={name}>
      <div className="rule-row__text">
        <span className="rule-row__name">
          {name}
          {aboutBehindInfo && <InfoButton label={name} onOpen={() => setInfo(true)} />}
        </span>
        {about && !labels && <span className="rule-row__about">{about}</span>}
        <span className="rule-row__source">
          {source}
          {changed && (
            <>
              {', '}
              <b className="rule-row__changed">changed</b> (the book: {bookName})
            </>
          )}
        </span>
        {manual && (
          // Only "Run by hand ›" is a link (fl-1: underlined text goes somewhere); the rest is plain quiet text.
          <span className="rule-row__manual-line">
            <button type="button" className="button-quiet rule-row__manual" aria-haspopup="dialog" onClick={() => setInfo(true)}>
              Run by hand ›
            </button>
            <span className="rule-row__manual-note">{`, ${MANUAL_NOTE}`}</span>
          </span>
        )}
      </div>
      {control && <div className="rule-row__control">{control}</div>}
      {open && (
        <RuleChoiceSheet name={name} meta={source} about={about} choices={choices} current={current} defaultChoice={defaultChoice} onChoose={onChoose} onClose={() => setOpen(false)} />
      )}
      {info && (
        <Dialog label={name} onClose={() => setInfo(false)}>
          {manual && (
            <p className="rule-sheet__about">
              <b>{MANUAL_WORDS}.</b> Play it as its rules say; your choice is saved.
            </p>
          )}
          {about && <p className="rule-sheet__about">{about}</p>}
          <ul className="rule-sheet__notes">
            {choices.map((c) => (
              <li key={c.id}>
                <b>{c.name}</b>
                {c.id === defaultChoice && <span className="rule-sheet__default">, the book's default</span>}
                {c.notes && <> — {c.notes}</>}
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </div>
  );
}

/** A rule's row in a source group: its id, whether it's changed now, and the row itself. */
export interface RuleSourceRow {
  id: string;
  changed: boolean;
  row: ReactNode;
}

/**
 * The order a source's rows show in while it stays open (tf-2): the changed ones first as they were when it opened,
 * each part in the pack's order; a rule changed since keeps its place; a row new since goes at the end.
 */
export function heldOrder(rows: readonly RuleSourceRow[], held: readonly string[] | null): string[] {
  const fresh = [...rows.filter((r) => r.changed), ...rows.filter((r) => !r.changed)].map((r) => r.id);
  if (!held) return fresh;
  const ids = new Set(rows.map((r) => r.id));
  return [...held.filter((id) => ids.has(id)), ...fresh.filter((id) => !held.includes(id))];
}

/**
 * One source's rules, folded (lr-6): the header says how many and how many changed; open, every rule shows (tf-5),
 * the changed ones first. Toggling a rule doesn't move its row: the order re-sorts only when the group is folded and
 * opened again, or on reload (tf-2). With no rules the header says "none" and opens nothing.
 */
export function RuleSourceGroup({
  title,
  count,
  open,
  onToggle,
  rows,
  top,
}: {
  title: string;
  /** "23 rules · 2 changed", or "none". */
  count: string;
  open: boolean;
  onToggle: () => void;
  rows: readonly RuleSourceRow[];
  /** Shown first while it's open, before the rows: the pack's presets (`RulePresets`, A8). */
  top?: ReactNode;
}) {
  const id = useId();
  // The order as the group opened (null while folded): set during render when it opens, cleared when it folds.
  const [held, setHeld] = useState<string[] | null>(null);
  if (open && held === null) setHeld(heldOrder(rows, null));
  if (!open && held !== null) setHeld(null);
  if (rows.length === 0) {
    return (
      <section className="rule-group" aria-labelledby={id}>
        <h2 id={id} className="rule-group__head rule-group__head--empty">
          {/* One inline label, so "· none" follows the title and wraps with it (not a flex item of its own). */}
          <span className="rule-group__label">
            <span className="rule-group__title">{title}</span><span className="rule-group__count">, {count}</span>
          </span>
        </h2>
      </section>
    );
  }
  const byId = new Map(rows.map((r) => [r.id, r.row]));
  return (
    <section className="rule-group" aria-labelledby={id}>
      <h2 className="rule-group__heading">
        <button id={id} type="button" className="rule-group__head" aria-expanded={open} onClick={onToggle}>
          <span className="rule-group__chev" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          <span className="rule-group__label">
            <span className="rule-group__title">{title}</span><span className="rule-group__count">, {count}</span>
          </span>
        </button>
      </h2>
      {open && (
        <div className="rule-group__rows">
          {top}
          {heldOrder(rows, held).map((rowId) => byId.get(rowId))}
        </div>
      )}
    </section>
  );
}

/**
 * A group's fold line (lr-7): the chevron, the name, then the quiet words after a comma ("Time and calendar, 4
 * settings, none changed"). The topic groups of Rules for this campaign and the rule cards (rc-fold) share it.
 */
export function GroupToggle({ name, count, open, onToggle }: { name: string; count: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="campaign-rules__toggle" aria-expanded={open} onClick={onToggle}>
      <span className="campaign-rules__chevron" aria-hidden="true">
        {open ? '▾' : '▸'}
      </span>
      {/* The count wraps under the name, never under the chevron. */}
      <span className="campaign-rules__label">
        <span className="campaign-rules__name">{name}</span>
        <span className="campaign-rules__count">, {count}</span>
      </span>
    </button>
  );
}

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/** One pack's part of a `ruleKey` card: its name, its rule's choices, the one ticked (null when another pack counts). */
export interface RuleKeyPack {
  label: string;
  choices: readonly RuleChoice[];
  ticked: string | null;
  onPick: (choiceId: string) => void;
}

/** A topic as the start of a line: "Initiative ties". */
const capital = (topic: string) => topic.charAt(0).toUpperCase() + topic.slice(1);

/** The fold line's words for the choice that counts (rc-fold): "Roll again (Fen Rules)". */
export const countingWords = (choice: string, pack: string): string => `${choice} (${pack})`;

/**
 * A `ruleKey` group two or more packs offer (tf-1, 2026-11-03; mockup library/05 #1 A): each pack's name and its
 * choices as full-width strips; one tap picks that choice and that pack for the campaign. The ✓ and the Selected wash
 * mark the one that counts. The packs' order doesn't matter here: the pick is the campaign's answer.
 * It folds as the groups around it do (rc-fold, Francis 2026-11-20: "it takes up too much screen real estate and
 * never closes"; his pictures approved with fixes the same day): folded, a plain row like theirs, "▸ Initiative ties,
 * Roll again (Fen Rules)", no box; open, the box under the row, "Two packs offer it; one choice counts." first (the
 * topic is on the row, not again). Folded as it first shows while a choice counts, open while none does, and open
 * from the start where the GM is meant to pick (`startOpen`, the new campaign's step). Plain component state, nothing
 * stored: a pick inside never folds it shut.
 */
export function RuleKeyCard({ topic, packs, startOpen = false }: { topic: string; packs: readonly RuleKeyPack[]; startOpen?: boolean }) {
  const many = COUNT_WORDS[packs.length] ?? String(packs.length);
  const counting = packs.flatMap((pack) => pack.choices.filter((c) => c.id === pack.ticked).map((choice) => ({ pack: pack.label, choice: choice.name })))[0];
  const [open, setOpen] = useState(startOpen || !counting);
  return (
    <div className="rule-card">
      <GroupToggle name={capital(topic)} count={counting ? countingWords(counting.choice, counting.pack) : 'nothing picked yet'} open={open} onToggle={() => setOpen((o) => !o)} />
      {open && (
        <div className="creation-callout rule-key" role="group" aria-label={`Choice for ${topic}`}>
          <p className="creation-callout__text">{many} packs offer it; one choice counts.</p>
          {packs.map((pack) => (
            <div key={pack.label} className="rule-key__pack" role="group" aria-label={pack.label}>
              <p className="rule-key__pack-name" aria-hidden="true">
                {pack.label}
              </p>
              {pack.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className="button-secondary rule-sheet__choice"
                  aria-pressed={choice.id === pack.ticked}
                  aria-label={`${pack.label}, ${choice.name}${choice.pack && choice.pack !== pack.label ? `, from ${choice.pack}` : ''}`}
                  onClick={() => pack.onPick(choice.id)}
                >
                  <span className="rule-sheet__choice-name">
                    {choice.id === pack.ticked && <span aria-hidden="true">✓ </span>}
                    {choice.name}
                    {/* A choice an overlay brought to this pack's rule (of-1, extends). */}
                    {choice.pack && choice.pack !== pack.label && <span className="rule-sheet__default">, from {choice.pack}</span>}
                  </span>
                  {choice.notes && <span className="rule-sheet__choice-notes">{choice.notes}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A rival rule after attaching a pack (07, "New choice for <topic>"): each pack's choice as a button and which one
 * counts. In set-up and Rules for this campaign the group is a `RuleKeyCard` (tf-1). It shows only while the GM's
 * confirm waits, so it starts open; it folds as `RuleKeyCard` does (rc-fold, 2026-11-20): its row, "▸ New choice for
 * item load, Weight (Fen Rules)", no box while folded; open, the box under it, the topic not said again.
 */
export function RuleClashCallout({
  topic,
  offers,
  now,
  nowNote = 'on top',
  title,
}: {
  topic: string;
  offers: readonly { label: string; onOpen: () => void }[];
  /** The choice that counts now, and its pack. */
  now: { choice: string; pack: string };
  /** Why that one counts: "on top" (the order) or "your pick". */
  nowNote?: string;
  /** The row's words in place of the topic: "New choice for encumbrance" after attaching a pack that brings a rival rule (07). */
  title?: string;
}) {
  const [open, setOpen] = useState(true);
  const many = COUNT_WORDS[offers.length] ?? String(offers.length);
  return (
    <div className="rule-card">
      <GroupToggle name={title ?? capital(topic)} count={countingWords(now.choice, now.pack)} open={open} onToggle={() => setOpen((o) => !o)} />
      {open && (
        <div className="creation-callout rule-clash" role="group" aria-label={title ?? `Choice for ${topic}`}>
          <p className="creation-callout__text">{many} packs offer it; one choice counts for the campaign:</p>
          <div className="creation-callout__actions">
            {offers.map((offer) => (
              <button key={offer.label} type="button" className="button-secondary button-secondary--small" onClick={offer.onOpen}>
                {offer.label}
              </button>
            ))}
          </div>
          <p className="creation-callout__meta rule-clash__now">
            Now: {now.pack}, {now.choice} ({nowNote}).
          </p>
        </div>
      )}
    </div>
  );
}

/** A pack's presets (A8; 05 Optional rules grouped): "Presets ·" then one quiet button per preset, opening its preview. */
export function RulePresets({ presets, onOpen }: { presets: readonly { id: string; name: string }[]; onOpen: (presetId: string) => void }) {
  if (presets.length === 0) return null;
  return (
    <div className="rule-presets" role="group" aria-label="Presets">
      <span className="rule-presets__label">Presets:</span>
      {presets.map((preset) => (
        <button key={preset.id} type="button" className="button-secondary button-secondary--small rule-presets__preset" aria-haspopup="dialog" onClick={() => onOpen(preset.id)}>
          {preset.name}
        </button>
      ))}
    </div>
  );
}

/**
 * A preset's preview (A8: a preview and a confirm, then Undo): its notes, each rule it moves ("Creation method: Basic
 * → Advanced"), any further line (the load method it moves), and the rules it leaves with why. Nothing to change says
 * so, and its X closes it (mc-43a: no Close button beside an X).
 */
export function RulePresetPreview({
  name,
  notes,
  moves,
  also = [],
  kept = [],
  onUse,
  onClose,
}: {
  name: string;
  notes?: string;
  moves: readonly { name: string; from: string; to: string }[];
  /** Lines after the moves: "The load method becomes Slots: every character's load is read again." */
  also?: readonly string[];
  kept?: readonly { name: string; why: string }[];
  onUse: () => void;
  onClose: () => void;
}) {
  const nothing = moves.length === 0;
  return (
    <Dialog label={nothing ? name : `Use ${name}?`} onClose={onClose}>
      {notes && <p className="rule-sheet__about">{notes}</p>}
      {nothing ? (
        <p className="reading">Your rules match {name} already: nothing to change.</p>
      ) : (
        <>
          <p className="reading">{moves.length === 1 ? 'It changes one rule:' : `It changes ${moves.length} rules:`}</p>
          <ul className="rule-sheet__notes">
            {moves.map((m) => (
              <li key={m.name}>
                <b>{m.name}</b>: {m.from} → {m.to}
              </li>
            ))}
          </ul>
          {also.map((line) => (
            <p key={line} className="reading">
              {line}
            </p>
          ))}
        </>
      )}
      {kept.length > 0 && (
        <ul className="rule-sheet__notes">
          {kept.map((k) => (
            <li key={k.name}>
              <b>{k.name}</b> stays as it is: it {k.why}.
            </li>
          ))}
        </ul>
      )}
      {/* mc-43a: a sheet with an X has no Close button; with nothing to change the X is the way out. */}
      {!nothing && (
        <div className="dialog__actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => {
              onUse();
              onClose();
            }}
          >
            Use {name}
          </button>
          <button type="button" className="button-secondary button-secondary--small" onClick={onClose}>
            Not now
          </button>
        </div>
      )}
    </Dialog>
  );
}
