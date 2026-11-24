// The review screen's sections (B18, ruled 2026-10-25): the same for a sent-back character and the GM's review
// card (A6). In reading order: who they are, the scores (once), hit points, details, gear, starting money and the
// backstory. A score the player changed from the roll, or a filled field they edited, is marked "Changed"; going
// over the starting money is a broken rule (it becomes 0 when play starts). The sections the GM ticked stand out.
import { entryMoneyOf, type Coin } from '../modules/characters/startingGear.ts';
import { averageScoresLine, changedRolls, moneyOf } from './creationReview.ts';
import { holdsAbility } from '../modules/characters/creation.ts';
import { toFinishName, toFinishOf } from '../modules/characters/creationGuide.ts';
import type { FieldDefinition } from '../modules/characters/fields.ts';
import { patronNameOf } from '../modules/characters/patrons.ts';
import { traitLookup, type TraitList } from '../modules/characters/traitLists.ts';
import type { ReviewSection } from '../ui/organisms.tsx';
import type { ReviewDetails } from './reviewDetails.ts';

export const REVIEW_STEPS = [
  { id: 'who', title: 'Who they are' },
  { id: 'scores', title: 'Scores' },
  { id: 'hp', title: 'Hit points' },
  { id: 'details', title: 'Details' },
  { id: 'gear', title: 'Gear' },
  { id: 'money', title: 'Starting coin' },
  { id: 'story', title: 'Backstory' },
] as const;
export type ReviewStep = (typeof REVIEW_STEPS)[number]['id'];

export const isReviewStep = (value: string): value is ReviewStep => REVIEW_STEPS.some((s) => s.id === value);
export const stepTitle = (step: ReviewStep) => REVIEW_STEPS.find((s) => s.id === step)!.title;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export interface ReviewInput {
  name: string;
  level: number;
  hpMax: number | null;
  backstory: string;
  fields: unknown;
  fieldDefs: FieldDefinition[];
  /** Filled fields the player changed from the setting's value. */
  editedFields: readonly string[];
  creation: unknown;
  made: ReviewDetails;
  /** The sections the GM ticked when sending it back. */
  flagged: readonly string[];
  /** The GM sees hidden fields too. */
  showHidden?: boolean;
  /** An ability's short name (the GM's label, else the setting's, else the key; ruled 2026-10-29, B6). */
  abilityName?: (key: string) => string;
  /** The setting's trait lists (M5b step 0b): a trait field shows its entry's name, and a list put off its name. */
  traitLists?: readonly TraitList[];
  /** The setting's coins, so what's spent and left reads as the Gear step said it ("1 gp 5 sp"). */
  coins?: readonly Coin[];
  /**
   * The GM's card lists each exception, with its reason, Allow it and Take it off, above these sections (Design,
   * 2026-11-07): here each is only its value with the sign inline. Left out (a sent-back character's review, which has
   * no such block): the line with its reason, as before.
   */
  exceptionsAbove?: boolean;
}

export function reviewSections(input: ReviewInput): ReviewSection[] {
  const creation = isRecord(input.creation) ? input.creation : {};
  const scores = isRecord(creation.scores) ? creation.scores : {};
  const values = isRecord(input.fields) ? input.fields : {};
  const sections: Omit<ReviewSection, 'flagged'>[] = [];

  // Picks whose requirement wasn't met (ruled 2026-11-02): flagged here for the player's review and the GM's card alike.
  const special = (Array.isArray(creation.specialApprovals) ? creation.specialApprovals : []).filter(isRecord);
  sections.push({
    id: 'who',
    title: stepTitle('who'),
    lines: [
      { text: input.name },
      ...(input.made.kinds.length > 0 ? [{ text: input.made.kinds.join(', ') }] : []),
      { text: `Level ${input.level}` },
      // The patron picked (December 1a; pt-7): named for the player and the GM alike.
      ...(patronNameOf(creation) ? [{ text: `Patron: ${patronNameOf(creation)}` }] : []),
      ...special.map((s) =>
        input.exceptionsAbove
          ? { text: String(s.name ?? s.entryId ?? ''), mark: 'exception' as const }
          : { text: `Needs the GM's special approval: ${String(s.name ?? s.entryId ?? '')}`, mark: 'broken' as const, why: String(s.requirement ?? '') },
      ),
    ],
  });

  const keys = Object.keys(scores);
  const named = input.abilityName ?? ((key: string) => key);
  if (keys.length > 0) {
    sections.push({
      id: 'scores',
      title: stepTitle('scores'),
      lines: [
        { text: keys.map((k) => `${named(k)} ${String(scores[k])}`).join(', ') },
        // A score changed from its roll, with the roll; a score left at the average is no roll (caf-8, as the review).
        ...changedRolls(creation).map((c) => ({ text: `${named(c.key)} ${String(scores[c.key])}`, mark: 'override' as const, why: `rolled ${String(c.rolled)}` })),
        // The scores left at the average (A5): said, so the GM knows they weren't rolled.
        ...(averageScoresLine(creation, named) ? [{ text: averageScoresLine(creation, named) }] : []),
        // A score kept below what the class or race needs, with the player's reason (05: overrides carry a reason).
        ...(typeof creation.overrideReason === 'string' && creation.overrideReason.trim()
          ? [{ text: 'Kept below the minimum', mark: 'broken' as const, why: `“${creation.overrideReason.trim()}”` }]
          : []),
      ],
    });
  }

  // An average left as it was prefilled (final drafts A5, C: the record's `hpAverage` flag) says so.
  const average = creation.hpAverage === true ? ', the average, not rolled' : '';
  sections.push({ id: 'hp', title: stepTitle('hp'), lines: [{ text: input.hpMax === null ? 'Not entered yet' : `HP ${input.hpMax}${average}` }] });

  const lists = input.traitLists ?? [];
  const lookup = traitLookup(lists);
  // The scores show once, in Scores (N12): the fields that hold them are left out of Details.
  const holdsScore = (f: FieldDefinition) => keys.some((k) => holdsAbility(f.key, k));
  const shownFields = input.fieldDefs.filter(
    (f) => (input.showHidden || !f.hidden) && !holdsScore(f) && values[f.key] !== undefined && values[f.key] !== null && values[f.key] !== '',
  );
  if (shownFields.length > 0) {
    sections.push({
      id: 'details',
      title: stepTitle('details'),
      lines: shownFields.map((f) => {
        const value = f.type === 'checkbox' ? (values[f.key] === true ? 'Yes' : 'No') : (f.from && lookup(f, String(values[f.key]))) || String(values[f.key]);
        return input.editedFields.includes(f.key) ? { text: `${f.label}: ${value}`, mark: 'override' as const, why: "the setting's value was changed" } : { text: `${f.label}: ${value}` };
      }),
    });
  }

  // Steps left with Decide later (M5b step 0): marked under Details, so the GM sees what's unfinished; the GM can
  // still approve (05).
  const later = toFinishOf(creation);
  if (later.length > 0) {
    const line = { text: `To finish: ${later.map((id) => lists.find((l) => l.id === id)?.name ?? toFinishName(id)).join(', ')}`, why: 'decided later' };
    const details = sections.find((sec) => sec.id === 'details');
    if (details) details.lines.push(line);
    else sections.push({ id: 'details', title: stepTitle('details'), lines: [line] });
  }

  if (input.made.gear || input.made.way === 'guided') sections.push({ id: 'gear', title: stepTitle('gear'), lines: [{ text: input.made.gear ?? 'None chosen' }] });

  if (typeof creation.startingMoney === 'number' || entryMoneyOf(creation) > 0) {
    // The coin in words (cw-11): "100 gp rolled · +10 gp from Reed cutter · 60 gp spent · 40 gp left", or "the usual
    // (not rolled)"; the pick that added coin named by its trait field's value.
    const pickName = (listId: string) => {
      const def = input.fieldDefs.find((f) => f.from === listId);
      const value = def ? values[def.key] : undefined;
      return def && value !== undefined && value !== null && value !== '' ? (lookup(def, String(value)) ?? String(value)) : null;
    };
    sections.push({
      id: 'money',
      title: stepTitle('money'),
      lines: [{ text: moneyOf(creation, input.coins ?? [], pickName).text }, ...(input.made.over ? [{ text: `${input.made.over}: it becomes 0 when play starts`, mark: 'broken' as const }] : [])],
    });
  }

  sections.push({ id: 'story', title: stepTitle('story'), lines: [{ text: input.backstory.trim() || 'Nothing written yet.' }] });

  return sections.map((s) => ({ ...s, flagged: input.flagged.includes(s.id) }));
}

export interface StillToDo {
  step: ReviewStep;
  text: string;
  /** Whether the player can change it on the review screen. */
  fixable: boolean;
}

/**
 * What a sent-back character still needs before it's resent (B18; words batch 1, §8), in reading order: HP the GM
 * asked to be rolled again, each ticked section not yet changed, and starting money gone over. Resend stays
 * tappable; these are explained in its pop-up.
 */
export function stillToDo({
  flagged,
  changed,
  hpAsked,
  hpEntered,
  over,
  canShop = false,
}: {
  flagged: readonly string[];
  changed: ReadonlySet<string>;
  hpAsked: boolean;
  hpEntered: boolean;
  over: string | null;
  /** Whether the shopping can reopen (a guided character with starting money): gear and money are then fixable. */
  canShop?: boolean;
}): StillToDo[] {
  const fixable = (step: ReviewStep) => FIXABLE.has(step) || (canShop && SHOPPING.has(step));
  const items: StillToDo[] = [];
  for (const { id, title } of REVIEW_STEPS) {
    if (id === 'hp' && hpAsked && !hpEntered) items.push({ step: id, text: 'Hit points: the GM asked you to roll again.', fixable: true });
    else if (flagged.includes(id) && !changed.has(id)) items.push({ step: id, text: `${title}: your GM asks for a change.`, fixable: fixable(id) });
    if (id === 'money' && over && !flagged.includes('money')) items.push({ step: id, text: `Starting coin: ${over.charAt(0).toLowerCase()}${over.slice(1)}.`, fixable: fixable(id) });
  }
  return items;
}

/** The sections a player changes in a dialog on the review. */
export const FIXABLE: ReadonlySet<string> = new Set<ReviewStep>(['who', 'hp', 'details', 'story']);
/** The sections that reopen the shopping, with what was bought (ruled 2026-10-26). */
export const SHOPPING: ReadonlySet<string> = new Set<ReviewStep>(['gear', 'money']);
