// The Player screen's and the full sheet's shared figure pieces (plan m5b-players-screens-standard B, D): the save tiles
// with their breakdown sheet, and a skill's breakdown sheet. One piece each, so the two screens show the same words
// (bq-2) and the landscape tablet can move them from the play column to the sheet beside it without a copy.
import { useState } from 'react';
import './FigureSheets.css';
import { skillLines, type SkillRoll } from '../modules/characters/explain.ts';
import type { Save, Skill } from '../modules/characters/play.ts';
import { BreakdownSheet } from '../ui/BreakdownSheet.tsx';
import { saveOwnLine, savesLine, type RollLine } from '../modules/library/rolls.ts';
import { DieGlyph, RollRow } from '../ui/dice.tsx';
import { SaveRow } from '../ui/parts.tsx';

/** A roll line's parts as the Roll row and the sheet draw them: the glyph's die, the words. */
const drawn = (line: RollLine | null) => (line ? { die: line.sides, words: line.words } : null);

/**
 * Five named tiles (the Save tile), the pack's short names, and under them the Saves line (sv-1, plan
 * dec-player-figure-sheet piece 4: the d20 glyph and "Roll d20: your save's number or higher succeeds.", built from the
 * rules set's `rolls.save`, pf-20, library/rolls.ts; none when the rules carry no roll for saves). A tap opens the
 * breakdown sheet, one sheet with the rule at once (sv-2, sv-2a, sv-2b; piece 3, mockup 14 frames P7, P7b): the
 * save's name and its number large in the head (the Figure head); its roll line with its own number ("Roll d20: 16 or
 * higher succeeds."); "Modifiers", what really changes this save, from a score, the kindred or the class (`modifiers`,
 * play.ts saveModifierLines), none when nothing does; the rule's lines (`rules`); the source. No class-and-level line
 * and no section about the character (sv-2a; the lead's ruling on ⚑ 1).
 */
export function SaveTiles({
  saves,
  rules,
  rulesSets,
  source,
  modifiers = () => [],
  lineInHeading = false,
}: {
  saves: Save[];
  rules: string[];
  /** The campaign's rules sets as the options leave them, lowest first: the roll lines are built from them. */
  rulesSets: readonly Record<string, unknown>[];
  source: string | null;
  /** What changes a save, one line each ("Spell ward: +1 from Lore."). */
  modifiers?: (save: Save) => readonly string[];
  /** The Saves heading's row carries the line (sv-3, `RuleHeading`), so it isn't drawn again under the tiles. */
  lineInHeading?: boolean;
}) {
  const [open, setOpen] = useState<Save | null>(null);
  const line = drawn(savesLine(rulesSets));
  const rolled = open ? drawn(saveOwnLine(rulesSets, open.value)) : null;
  return (
    <>
      <SaveRow saves={saves} onOpen={(key) => setOpen(saves.find((s) => s.key === key) ?? null)} />
      {line && !lineInHeading && <RollRow die={line.die}>{line.words}</RollRow>}
      {open && (
        <BreakdownSheet
          title={open.name}
          figure={open.value}
          figureHead
          roll={rolled}
          modifiers={modifiers(open)}
          rule={rules}
          {...(rules.length === 0 && !rolled ? { ending: "Your setting doesn't say how saves are rolled. Ask your GM." } : {})}
          source={source}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

/**
 * A skill's top line when it is rolled the target or higher on one die (tfs-1; mockup december/26 frames M2c, M2d):
 * "Succeeds on a 5+," in bold, then the die's glyph and "roll 1d6" plain. When the line wraps it wraps after the die
 * (M2d, case 5): the glyph stays with the bold lead. A screen reader hears "Succeeds on a 5+, roll 1d6" (the glyph is
 * decorative).
 */
export function SkillRollLine({ roll }: { roll: SkillRoll }) {
  return (
    <span className="skill-roll">
      <span className="skill-roll__lead">
        <strong>Succeeds on a {roll.target}+,</strong>
        <DieGlyph die={roll.sides} size={20} />
      </span>{' '}
      roll 1d{roll.sides}
    </span>
  );
}

/**
 * A skill's breakdown sheet (tfs-1, 2026-11-19): one top line on what succeeds and what to roll ("Succeeds on a 5+,",
 * the die's glyph, "roll 1d6"; a skill rolled another way keeps today's words, ⚑ 13), whether the GM rolls it, then
 * what the skill does in the pack's words (R3-13: the rules set skill's `notes`, else the class's `skills.notes` entry;
 * play.ts skillsOf), and the source. Nothing on where its number comes from. Only when the pack says nothing, the
 * ending asks the GM. No figure beside the title: the top line is its figure.
 */
export function SkillSheet({
  skill,
  roll,
  source,
  expertise,
  onMovePoints,
  onClose,
}: {
  skill: Skill;
  roll: SkillRoll | null;
  source: string | null;
  /**
   * With expertise points in force (G-208, ex-6; mockup december/29 X6): one labelled line after the pack's words and
   * before the source, "Expertise 2 points. Every skill starts at 1-in-6; at best 4-in-6".
   */
  expertise?: { label: string; words: string } | null;
  /** The GM's view (ex-6): a plain Move points beside Got it, opening the step with − and + free. */
  onMovePoints?: () => void;
  onClose: () => void;
}) {
  const [top, ...parts] = skillLines(skill, roll);
  return (
    <BreakdownSheet
      title={skill.name}
      figure={roll ? <SkillRollLine roll={roll} /> : top}
      lines={skill.text ? [...parts, skill.text] : parts}
      {...(skill.text ? {} : { ending: "Your setting doesn't describe what this skill does. Ask your GM how it works at your table." })}
      source={source}
      footAction={
        onMovePoints ? (
          <button type="button" className="button-secondary" onClick={onMovePoints}>
            Move points
          </button>
        ) : undefined
      }
      onClose={onClose}
    >
      {expertise && (
        <p className="book-line skill-sheet__expertise">
          <span className="book-label">{expertise.label}</span> {expertise.words}
        </p>
      )}
    </BreakdownSheet>
  );
}
