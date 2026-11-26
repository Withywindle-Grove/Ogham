// Larger shared parts from the component inventory (docs/06 "Components", Organisms; ruled 2026-10-25, B15, B17,
// B18): the pinned note panel, the review screen and "Rules for this campaign".
// Built once here with invented data in the gallery; screens compose them.
import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ActionBar, ButtonRow, InfoButton, ListRow, OptionRow, RowList, WarningSign } from './parts.tsx';
import { GroupToggle, RuleSourceGroup, type RuleSourceRow } from './ruleRows.tsx';
import './organisms.css';

/** A working panel for the GM's note on a sent-back character: in the page, its space kept, until resent. */
export function PinnedNote({
  from,
  title,
  by,
  children,
}: {
  from: string;
  /** Its heading in words with the warning sign ("Your GM asks for a change", cs-53); left out, "From <who>". */
  title?: string;
  /** The author line under the note (22-G5): "Maren, your GM, today". */
  by?: string;
  children: ReactNode;
}) {
  return (
    <aside className="pinned-note" aria-label={`Note from ${from}`}>
      <p className="pinned-note__from">
        {title ? (
          <>
            <WarningSign /> {title}
          </>
        ) : (
          `From ${from}`
        )}
      </p>
      <div className="pinned-note__text">{children}</div>
      {by && <p className="pinned-note__by">{by}</p>}
    </aside>
  );
}

export interface ReviewSection {
  id: string;
  title: string;
  /** `exception`: the value, then the warning sign inline (its reason is in the GM's exceptions block above). */
  lines: { text: string; mark?: 'override' | 'broken' | 'exception'; why?: string }[];
  /** The GM ticked it when sending back: the only sections that stand out. */
  flagged?: boolean;
}

/**
 * The review screen (B18): one screen for the first submission, a sent-back character and the GM's review card.
 * Sections in reading order, each opening its step; overrides and broken rules marked with words and a shape;
 * flagged sections marked. The main action stays enabled; what's still needed is explained on tap. Sent back, its own
 * foot (clo-2, 22-G5; `onBack`): the count of marked parts, Back and the action.
 */
export function ReviewScreen({
  heading,
  sections,
  note,
  action,
  stillNeeded = [],
  onOpenStep,
  onAction,
  onExplain,
  onBack,
  layout = 'auto',
}: {
  /** "phone" shows the phone version at any width (the gallery). */
  layout?: 'auto' | 'phone';
  /**
   * The sent-back foot (clo-2, frame 22-G5): given, the action sits in a foot at the end at every width, under a rule:
   * how many parts the GM ticked ("1 part marked", none when none are), then Back (plain) and the action (accent).
   */
  onBack?: () => void;
  heading: string;
  sections: ReviewSection[];
  note?: ReactNode;
  /** Left out on the GM's review card (A6): its actions sit below the sections, which are read, not opened. */
  action?: string;
  /** What the player must still change before resending (empty when nothing is). */
  stillNeeded?: string[];
  onOpenStep?: (id: string) => void;
  onAction?: () => void;
  onExplain?: (needed: string[]) => void;
}) {
  const main = action && (
    <button type="button" className="button-primary" onClick={() => (stillNeeded.length > 0 ? onExplain?.(stillNeeded) : onAction?.())}>
      {action}
    </button>
  );
  const marked = sections.filter((s) => s.flagged).length;
  return (
    <section className={`review${layout === 'phone' ? ' review--phone' : ''}`} aria-label={heading}>
      <div className="review__head">
        <h2 className="review__heading">{heading}</h2>
        {main && !onBack && <div className="top-action">{main}</div>}
      </div>
      {note}
      {sections.map((s) => {
        const Box = onOpenStep ? 'button' : 'div';
        return (
        <Box key={s.id} {...(onOpenStep ? { type: 'button' as const, onClick: () => onOpenStep(s.id) } : {})} className={`review__section${s.flagged ? ' review__section--flagged' : ''}`}>
          <span className="review__title">{s.title}</span>
          {s.flagged && (
            <span className="review__flag">
              <WarningSign /> Your GM asks for a change
            </span>
          )}
          {s.lines.map((l) => (
            <span key={l.text} className="review__line">
              {/* Inside a flagged box only the title line carries the warning sign. */}
              {l.mark === 'broken' && (
                <span className="review__mark review__mark--broken">
                  {!s.flagged && <WarningSign />}Broken rule:{' '}
                </span>
              )}
              {l.mark === 'override' && <span className="review__mark">Changed: </span>}
              {l.text}
              {l.mark === 'exception' && (
                <span className="review__mark review__mark--broken">
                  {' '}
                  <WarningSign />
                  <span className="visually-hidden">, needs your special approval</span>
                </span>
              )}
              {l.why && <span className="review__why">, {l.why}</span>}
            </span>
          ))}
        </Box>
        );
      })}
      {onBack ? (
        <div className="review__foot">
          {marked > 0 && <p className="review__foot-state">{`${marked} ${marked === 1 ? 'part' : 'parts'} marked`}</p>}
          <div className="review__foot-actions">
            <button type="button" className="button-secondary" onClick={onBack}>
              Back
            </button>
            {main}
          </div>
        </div>
      ) : main && (
        <div className="bottom-action">
          <ActionBar phone={layout === 'phone'}>{main}</ActionBar>
        </div>
      )}
    </section>
  );
}

export interface CampaignRule {
  id: string;
  name: string;
  /** One line of meaning per choice ("Party's lowest · Matches the lowest active character"). */
  /** `extra` sits right under its choice while chosen (the fixed level's stepper under "Fixed level"). */
  choices: { value: string; label: string; meaning?: string; extra?: ReactNode }[];
  value: string;
  defaultValue: string;
  /** The pack's short name, or the app's own name. */
  source: string;
  /** What the rule is, one tap away (ⓘ beside its name). */
  onInfo?: () => void;
  /** Under the choices: what the chosen value needs (the fixed level's stepper). */
  extra?: ReactNode;
}

export interface RuleGroup {
  id: string;
  name: string;
  rules: CampaignRule[];
  /**
   * A group that holds something other than rules (Character fields, ruled 2026-10-28, N20): what it shows when
   * open, and the quiet words beside its name in place of the count line ("6 fields").
   */
  body?: ReactNode;
  summary?: string;
  /**
   * One source's optional rules (lr-7, ruled 2026-11-02): drawn by `RuleSourceGroup` (the set-up's step 3 rows),
   * folded with "23 rules · 2 changed", sharing the screen's open groups; every row, in an order that holds while
   * it stays open (tf-2, tf-5).
   */
  source?: { count: string; rows: RuleSourceRow[]; top?: ReactNode };
  /** Drawn above the group's header whether it's open or not (the `ruleKey` clash callout before the sources). */
  lead?: ReactNode;
}

const changedIn = (rules: CampaignRule[]) => rules.filter((r) => r.value !== r.defaultValue).length;

/** A topic group's count line (lr-7): "6 settings · 1 changed", "1 setting · none changed". */
export function settingsLine(total: number, changed: number): string {
  return `${total} ${total === 1 ? 'setting' : 'settings'}, ${changed === 0 ? 'none' : changed} changed`;
}

function Rule({ rule: r, onChange }: { rule: CampaignRule; onChange: (ruleId: string, value: string) => void }) {
  const fits = r.choices.length <= 3 && r.choices.every((c) => c.label.length <= 12 && !c.meaning);
  const chosen = r.choices.find((c) => c.value === r.value);
  const byDefault = r.choices.find((c) => c.value === r.defaultValue);
  return (
    // A button row is its own group; a list is a radio group named by the rule.
    <div className="campaign-rules__rule" role={fits ? undefined : 'radiogroup'} aria-label={fits ? undefined : r.name}>
      <p className="campaign-rules__rule-name">
        {r.name} <span className="campaign-rules__source">{r.source}</span>
        {r.onInfo && <InfoButton label={r.name} onOpen={r.onInfo} />}
      </p>
      {r.value !== r.defaultValue && <p className="campaign-rules__changed">Changed. Default: {byDefault?.label ?? r.defaultValue}</p>}
      {fits ? (
        <ButtonRow label={r.name} options={r.choices} value={r.value} onChange={(v) => onChange(r.id, v)} />
      ) : (
        r.choices.map((c) => (
          <Fragment key={c.value}>
            <OptionRow name={c.label} summary={c.meaning ?? ''} selected={c.value === r.value} onPick={() => onChange(r.id, c.value)} />
            {c.value === r.value && c.extra}
          </Fragment>
        ))
      )}
      {fits && chosen?.meaning && <p className="campaign-rules__meaning">{chosen.meaning}</p>}
      {r.extra}
    </div>
  );
}

/**
 * Rules for this campaign (B15; rebuilt 2026-11-02, lr-7): the app's settings in fixed topic groups, then the packs'
 * optional rules one group per source (`source`, the set-up's rows), each folded with its count line. `open` lists
 * the open groups; `single` (a phone) keeps one open at a time, a tablet any number. `open` and `onOpen` let the
 * screen open a group from elsewhere (Setting rules' "Change rules for this campaign"). A group tapped open scrolls
 * its heading to the top, so it shows from its first item (phone test, 2026-11-09).
 */
export function RulesForThisCampaign({
  groups,
  onChange,
  open: openGroups,
  onOpen,
  single = false,
  label = 'Rules for this campaign',
}: {
  groups: RuleGroup[];
  onChange: (ruleId: string, value: string) => void;
  open?: readonly string[];
  onOpen?: (groupIds: string[]) => void;
  single?: boolean;
  /** The section's name for screen readers (campaign creation's App section: "The app's rules", tf-7). */
  label?: string;
}) {
  const [ownOpen, setOwnOpen] = useState<string[]>([]);
  const open = openGroups ?? ownOpen;
  const setOpen = onOpen ?? setOwnOpen;
  // A group tapped open lands with its heading at the top (under the sticky top row: html's scroll-padding-top), so
  // its first item shows, never the middle of it (Francis's phone test, 2026-11-09): on a phone the group above folds
  // as this one opens, and the page would otherwise keep its place and show the middle of the opened group.
  const groupEls = useRef(new Map<string, HTMLDivElement>());
  const opened = useRef<string | null>(null);
  const toggle = (id: string) => {
    const opening = !open.includes(id);
    opened.current = opening ? id : null;
    setOpen(opening ? (single ? [id] : [...open, id]) : open.filter((g) => g !== id));
  };
  useLayoutEffect(() => {
    const id = opened.current;
    if (id === null || !open.includes(id)) return;
    opened.current = null;
    groupEls.current.get(id)?.scrollIntoView?.({ block: 'start' });
  }, [open]);
  return (
    <section className="campaign-rules" aria-label={label}>
      {groups.map((g) => {
        const isOpen = open.includes(g.id);
        return (
          <Fragment key={g.id}>
            {g.lead}
            <div
              className="campaign-rules__group"
              id={`rules-group-${g.id}`}
              ref={(el) => {
                if (el) groupEls.current.set(g.id, el);
                else groupEls.current.delete(g.id);
              }}
            >
              {g.source ? (
                <RuleSourceGroup title={g.name} {...g.source} open={isOpen} onToggle={() => toggle(g.id)} />
              ) : (
                <>
                  <GroupToggle name={g.name} count={g.summary ?? settingsLine(g.rules.length, changedIn(g.rules))} open={isOpen} onToggle={() => toggle(g.id)} />
                  {isOpen && g.body}
                  {isOpen && g.rules.map((r) => <Rule key={r.id} rule={r} onChange={onChange} />)}
                </>
              )}
            </div>
          </Fragment>
        );
      })}
    </section>
  );
}

/**
 * The To finish card (05 Character sheet, 06; M5b step 0): at the top of the sheet while creation steps left with
 * Decide later wait. One line per open step; each opens that step. The card goes when the last is done.
 */
export function ToFinishCard({
  steps,
  onOpen,
  // cs-27 (22-G7): "You can play now." only; the card's own title says the rest.
  title = 'You can play now.',
  action,
  notice = false,
}: {
  steps: { id: string; name: string }[];
  onOpen: (id: string) => void;
  /** The review variant (cr-18): "To finish · 1 — you can do these later, from your sheet". */
  title?: string;
  /** The review variant's words ("Do it now"), with no "›" (cw-11: creation draws no "‹ ›"); the sheet's card keeps its ›. */
  action?: string;
  /**
   * The **notice** variant (the Player tab's notices sheet, frame M1e; Francis's fix of 2026-11-20): no card, "You can
   * play now." a plain line, each step a List row with its chevron, dotted rules under each (`RowList` dotted).
   */
  notice?: boolean;
}) {
  if (steps.length === 0) return null;
  if (notice) {
    return (
      <section className="to-finish to-finish--notice" aria-label="To finish">
        <p className="to-finish__words">{title}</p>
        <RowList dotted>
          {steps.map((step) => (
            <ListRow key={step.id} title={step.name} label onOpen={() => onOpen(step.id)} />
          ))}
        </RowList>
      </section>
    );
  }
  return (
    <section className="to-finish" aria-label="To finish">
      <h2 className="to-finish__title">{title}</h2>
      <ul className="to-finish__lines">
        {steps.map((step) => (
          <li key={step.id}>
            <button type="button" className="button-secondary to-finish__line" aria-label={action ? `${step.name}, ${action}` : undefined} onClick={() => onOpen(step.id)}>
              <span>{step.name}</span>
              {action ? <span>{action}</span> : <span aria-hidden="true">›</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
