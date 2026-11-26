// The Expertise step (G-208; ruling design/rulings/g208-expertise-points-2026-11-20.md ex-3 to ex-7; mockup
// december/29 frames X1 to X5, approved 2026-11-20; 06 Expertise step). On the creation step shell: the step's line,
// Help me choose, "Spend 3 points" with its count, one muted line with the die's glyph saying where every skill starts
// and its best, then one card per class skill: the name (a tap opens the skill's words: a sheet on a phone, the pane
// beside the list on a tablet), under it the points on it, and at the right − and + with the skill's figure between
// them in the pack's own style (the Stepper's figure variant). A card with points is on the Selected wash with its
// edge. Every limit is a tap that says why (hard rule 7: never a greyed button). Three forms: creation (before
// approval, − and + free, Decide later), after approval (the owner only adds: "1 new point, for level 2", a card says
// which points are new, − on a point spent before says why, Done), and the GM's Move points (− and + free, Done).
// The figures and rules are the pure module's (src/modules/characters/expertise.ts).
import { useState } from 'react';
import { atItsBest, classSkillCodes, mayTakeBack, pointsAllowed, pointsRule, pointsSpent, pointsToBest, readExpertise, skillDirection, skillFigure, type Direction, type Expertise, type PointsRule } from '../modules/characters/expertise.ts';
import { skillOdds } from '../modules/characters/skillOdds.ts';
import { CreationStep, EntryPanel } from '../ui/creation.tsx';
import { DieGlyph, type DieSize } from '../ui/dice.tsx';
import { Stepper } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { useCreationSplit } from './useWide.ts';
import './ExpertiseStep.css';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** One class skill as the step shows it. */
export interface ExpertiseSkill {
  code: string;
  name: string;
  /** What the skill does, in the pack's words (the rules set skill's `notes`, else the class's `skills.notes` entry). */
  text: string;
  direction: Direction;
  /** The die and the roll the figure is written for (the skill's own, else the class's). */
  die: unknown;
  rollMode: unknown;
}

/** The class's points rule and its skills, as the step reads them; null when the class has no points in force. */
export interface ExpertiseSetup {
  rule: PointsRule;
  skills: ExpertiseSkill[];
  /** The die drawn beside "Every skill starts at …" (the class's skills' die), when the app draws it. */
  die: DieSize | null;
}

const DIES: readonly DieSize[] = [4, 6, 8, 10, 12, 20, 100];

/** "d6" → 6, when it is one die the app draws; null otherwise. */
function dieOf(value: unknown): DieSize | null {
  const found = /^d(\d+)$/i.exec(text(value));
  const sides = found ? Number(found[1]) : NaN;
  return DIES.includes(sides as DieSize) ? (sides as DieSize) : null;
}

/**
 * The step's setup from the class as the setting reads it (its `byOption` and patches merged in): the rule and each
 * class skill, its name, words and the way its figure is written, in the class's order. Null without points in force.
 */
export function expertiseSetup(klass: Record<string, unknown> | null | undefined, rulesSets: readonly Record<string, unknown>[] = []): ExpertiseSetup | null {
  const rule = pointsRule(klass);
  if (!rule || !klass) return null;
  const codes = classSkillCodes(klass);
  if (codes.length === 0) return null;
  const skills = isRecord(klass.skills) ? klass.skills : {};
  const names = isRecord(skills.names) ? skills.names : {};
  const words = isRecord(skills.notes) ? skills.notes : {};
  const defOf = (code: string) => {
    for (const rules of [...rulesSets].reverse()) {
      const found = (Array.isArray(rules.skills) ? rules.skills : []).find((s) => isRecord(s) && s.id === code);
      if (isRecord(found)) return found;
    }
    return null;
  };
  return {
    rule,
    die: dieOf(skills.die),
    skills: codes.map((code) => {
      const def = defOf(code);
      return {
        code,
        name: text(def?.name) || text(names[code]) || code,
        text: text(def?.notes) || text(words[code]),
        direction: skillDirection(klass, code, rulesSets),
        die: def?.die ?? skills.die,
        rollMode: def?.rollMode ?? skills.rollMode,
      };
    }),
  };
}

/** A skill's figure in the pack's style ("2-in-6", "5+") with this many points on it. */
export function figureWords(rule: PointsRule, skill: ExpertiseSkill, points: number): string {
  return skillOdds(skillFigure(rule, skill.direction, points), skill.die, skill.rollMode).shown;
}

/** Where every skill starts and its best, in the pack's style: { base: "1-in-6", best: "4-in-6" }, from the first skill. */
export function baseAndBest(setup: ExpertiseSetup): { base: string; best: string } {
  const first = setup.skills[0]!;
  return { base: figureWords(setup.rule, first, 0), best: figureWords(setup.rule, first, pointsToBest(setup.rule, first.direction)) };
}

/** "1 point", "3 points". */
export const pointWords = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;

/** The points line under a skill's name: "No points", "1 point", "2 points, 1 new" (ex-5: new since the saved points). */
export function pointsLine(points: number, newPoints: number): string {
  if (points <= 0) return 'No points';
  return newPoints > 0 && newPoints < points ? `${pointWords(points)}, ${newPoints} new` : pointWords(points);
}

/**
 * The heading over the list (ex-3, ex-5): "Spend 3 points"; after approval at a level past the first "1 new point, for
 * level 2"; after approval at level 1, the points still to spend ("Spend 2 points", as the count's "0 of 2 spent").
 */
export function expertiseHeading(allowed: number, toSpend: number, level: number, afterApproval: boolean): string {
  if (afterApproval && level > 1) return `${toSpend} new ${toSpend === 1 ? 'point' : 'points'}, for level ${level}`;
  return `Spend ${pointWords(afterApproval ? toSpend : allowed)}`;
}

/** The foot's line: what is left ("1 point to spend"), nothing once every point is spent (ex-4, X1). */
export const expertiseHint = (left: number) => (left > 0 ? `${pointWords(left)} to spend` : '');

/** What the review's Expertise card says (ex-7, X7): the skills with points and their figures, then "The rest 1-in-6". */
export function expertiseReviewLine(setup: ExpertiseSetup, expertise: Expertise, level: number, decidedLater: boolean): string {
  const left = pointsAllowed(setup.rule, level) - pointsSpent(expertise, setup.skills.map((s) => s.code));
  if (decidedLater && left > 0) return `Decided later: ${pointWords(left)} to spend, on the To finish list`;
  const withPoints = setup.skills.filter((s) => (expertise[s.code] ?? 0) > 0);
  const { base } = baseAndBest(setup);
  if (withPoints.length === 0) return `No points spent: every skill ${base}`;
  const named = withPoints.map((s) => `${s.name} ${figureWords(setup.rule, s, expertise[s.code]!)}`).join(', ');
  const rest = withPoints.length < setup.skills.length ? ` The rest ${base}.` : '';
  return `${named}.${rest}`;
}

/** The toast after Done (ex-5): "Expertise: Work locks 3-in-6." naming each skill that changed. */
export function doneWords(setup: ExpertiseSetup, saved: Expertise, now: Expertise): string {
  const changed = setup.skills.filter((s) => (saved[s.code] ?? 0) !== (now[s.code] ?? 0));
  return `${setup.rule.name}: ${changed.map((s) => `${s.name} ${figureWords(setup.rule, s, now[s.code] ?? 0)}`).join(', ')}.`;
}

/** Points with the empty ones left out (a skill with no points has no key, 04). */
export function cleanExpertise(points: Expertise): Expertise {
  return Object.fromEntries(Object.entries(points).filter(([, n]) => n > 0));
}

/** Whether two sets of points are the same. */
export const sameExpertise = (a: Expertise, b: Expertise) => {
  const x = cleanExpertise(a);
  const y = cleanExpertise(b);
  return Object.keys(x).length === Object.keys(y).length && Object.entries(x).every(([code, n]) => y[code] === n);
};

export function ExpertiseStep({
  setup,
  level,
  saved,
  chosen,
  who,
  title,
  why,
  help,
  counter,
  source,
  nextLabel,
  onPicks,
  onSave,
  onLater,
  onBack,
  backInFoot = false,
}: {
  setup: ExpertiseSetup;
  level: number;
  /** The points as saved on the character before this visit: after approval, the owner can't take these back. */
  saved: Expertise;
  /** The points the step opens with (kept by Back, cr-2). */
  chosen: Expertise;
  /** Who is spending: the GM moves any point (Move points); after approval the owner only adds (ex-2). */
  who: { gm: boolean; approved: boolean };
  title: string;
  why: string;
  help: string | null;
  counter?: { at: number; of: number | null };
  /** The skills' pack and page, under a skill's words. */
  source?: string;
  /** "Done" from To finish and Move points (ex-5). */
  nextLabel?: string;
  /** Told of every change, so Back keeps the points (cr-2). */
  onPicks?: (points: Expertise) => void;
  onSave: (points: Expertise) => Promise<boolean>;
  onLater?: () => void;
  onBack: () => void;
  /** Back beside Done in a pop-up's foot (X5): it closes without saving, as the bar's ‹ does. */
  backInFoot?: boolean;
}) {
  const toast = useToast();
  const wide = useCreationSplit();
  const [points, setLocal] = useState<Expertise>(() => readExpertise(chosen));
  const [openedWith] = useState(points);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const { rule, skills } = setup;
  const codes = skills.map((s) => s.code);
  const allowed = pointsAllowed(rule, level);
  const spent = pointsSpent(points, codes);
  const left = Math.max(0, allowed - spent);
  // After approval the owner's visit spends only the points not spent before (ex-5).
  const afterApproval = who.approved && !who.gm;
  const savedSpent = pointsSpent(readExpertise(saved), codes);
  const toSpend = afterApproval ? Math.max(0, allowed - savedSpent) : allowed;
  const spentHere = afterApproval ? Math.max(0, spent - savedSpent) : spent;
  const { base, best } = baseAndBest(setup);
  const setPoints = (next: Expertise) => {
    const clean = cleanExpertise(next);
    setLocal(clean);
    onPicks?.(clean);
  };

  function raise(skill: ExpertiseSkill) {
    const on = points[skill.code] ?? 0;
    // Every limit says why (ex-3; X2, X3), and nothing changes.
    if (atItsBest(rule, skill.direction, on)) return toast({ text: `${skill.name} is at its best: ${figureWords(rule, skill, on)}.` });
    if (left < 1) return toast({ text: `All ${pointWords(allowed)} spent: take one back first.` });
    setPoints({ ...points, [skill.code]: on + 1 });
  }

  function lower(skill: ExpertiseSkill) {
    const on = points[skill.code] ?? 0;
    if (on <= 0) return toast({ text: `${skill.name} has no points to take back.` });
    // After approval a point spent before is the GM's to move (ex-2, ex-5).
    if (!mayTakeBack(who, readExpertise(saved), points, skill.code)) return toast({ text: 'Spent before: ask your GM to move it.' });
    setPoints({ ...points, [skill.code]: on - 1 });
  }

  async function next() {
    if (busy) return;
    // Next stays tappable and says what's missing (cr-2; X2: "Spend 3 points, or Decide later."). The GM's Move points
    // and an owner's visit that spent a point save with points still unspent (ex-5, ex-6; #1093 review, 1).
    const mayLeave = who.gm || (afterApproval && spentHere > 0);
    if (left > 0 && !mayLeave) return toast({ text: `Spend ${pointWords(left)}${onLater ? ', or Decide later' : ''}.` });
    setBusy(true);
    await onSave(points);
    setBusy(false);
  }

  const open = opened ? skills.find((s) => s.code === opened) : undefined;
  // The skill's words (ex-3, X4): its figure now, where it starts and its best, the pack's text and the source; the
  // stepper stays on the row, so the pane has no button of its own.
  const panel = open ? (
    <EntryPanel
      name={open.name}
      lead={`Now ${figureWords(rule, open, points[open.code] ?? 0)}. Starts at ${base}, at best ${best}.`}
      description={open.text ? [open.text] : []}
      headings={[]}
      {...(source ? { meta: source } : {})}
      onClose={() => setOpened(null)}
      asSheet={!wide}
    />
  ) : null;

  return (
    <CreationStep
      title={title}
      counter={counter}
      why={why}
      help={help}
      // After approval the step is the line and the list (X5): no Help me choose.
      helpChoices={afterApproval ? undefined : skills.filter((s) => s.text).map((s) => ({ name: s.name, blurb: s.text }))}
      onBack={onBack}
      backInFoot={backInFoot}
      panel={wide ? panel : undefined}
      decideLater={onLater ? { onPick: onLater } : undefined}
      hint={expertiseHint(left)}
      busy={busy}
      waitsOnline
      nextLabel={nextLabel}
      unchanged={sameExpertise(points, openedWith)}
      onNext={() => void next()}
    >
      <h2 className="pick-group__head expertise__count">
        <span className="pick-group__title">{expertiseHeading(allowed, toSpend, level, afterApproval)}</span>
        <span className="visually-hidden">,</span>{' '}
        <span className="pick-group__meta">
          {spentHere} of {toSpend} spent
        </span>
      </h2>
      <p className="expertise__range">
        {setup.die && <DieGlyph die={setup.die} size={16} />}
        <span>
          Every skill starts at {base}; at best {best}.
        </span>
      </p>
      <ul className="expertise__list" aria-label={title}>
        {skills.map((skill) => {
          const on = points[skill.code] ?? 0;
          const fresh = afterApproval ? Math.max(0, on - (saved[skill.code] ?? 0)) : 0;
          return (
            <li key={skill.code} className={`expertise-row${on > 0 ? ' expertise-row--points' : ''}${opened === skill.code && wide ? ' expertise-row--open' : ''}`}>
              <button type="button" className="expertise-row__name" aria-expanded={opened === skill.code} onClick={() => setOpened(opened === skill.code ? null : skill.code)}>
                {skill.name}
              </button>
              <div className="expertise-row__line">
                <span className="expertise-row__points">{pointsLine(on, fresh)}</span>
                <Stepper
                  label={`points on ${skill.name}`}
                  value={on}
                  min={0}
                  max={on + left}
                  figure={figureWords(rule, skill, on)}
                  onChange={(value) => (value > on ? raise(skill) : lower(skill))}
                  onLimit={(side) => (side === 'max' ? raise(skill) : lower(skill))}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {!wide && panel}
    </CreationStep>
  );
}
