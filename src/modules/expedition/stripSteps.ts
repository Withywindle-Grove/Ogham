// The Scene's strip: which steps it shows (plan dec-9-the-whole-scene, row S7; dec-9 C; rulings mc-53 to mc-56, mc-54b,
// mc-60, mc-60a, pf-14, pf-14a, pf-12c). The strip is a reminder of the procedure in force, not a process: it keeps no
// state. The procedure in force is the place's own (the party's place, else the nearest place it sits in), else the
// expedition's mode's, else the rules set's default, else the app's own five (Describe, Question, Act, Test, Resolve,
// mc-54b). In point to point it is the place's own, else the app's five, whatever the rules set says (p2p-7, ruled
// 2026-11-18). A pack's steps keep its own names (mc-60a). A step's `text` is the rule-text shape (pf-14a), read by the one
// reader (library/ruleText.ts). Reading is forgiving: a step with no name is left out, and nothing a pack writes can
// make it fail. Pure.
import { readRuleText, type RuleText } from '../library/ruleText.ts';
import { isPointToPoint } from './modes.ts';

export interface StripStep {
  id: string;
  name: string;
  /** The icon name as the pack writes it (pf-12c; the screen says what it draws); null: none, so its number shows (mc-60). */
  icon: string | null;
  /** The step's own words; null: none, so the step is no tap (mc-55). */
  text: RuleText | null;
}

export type StripSource = 'place' | 'mode' | 'rules' | 'app';

/** The app's own procedure (mc-54b, ruled 2026-11-12): the app's words, with the set's five icons in order. */
export const APP_STEPS: readonly StripStep[] = [
  { id: 'describe', name: 'Describe', icon: 'trumpet-flag', text: null },
  { id: 'question', name: 'Question', icon: 'crystal-ball', text: null },
  { id: 'act', name: 'Act', icon: 'sword-brandish', text: null },
  { id: 'test', name: 'Test', icon: 'pointy-hat', text: null },
  { id: 'resolve', name: 'Resolve', icon: 'locked-chest', text: null },
];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const words = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** A `procedure` as a pack writes it, `[{ id, name, icon?, kind?, checkId?, text? }]` (pf-14), as the strip's steps. */
export function readStripSteps(raw: unknown): StripStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).flatMap((step, i) => {
    const name = words(step.name);
    if (!name) return [];
    // Blank words open nothing, so they are no text (the pack checker calls them an error).
    const text = typeof step.text === 'string' && !step.text.trim() ? null : readRuleText(step.text).value;
    return [{ id: words(step.id) ?? `step-${i + 1}`, name, icon: words(step.icon), text }];
  });
}

/**
 * A mode's procedure as the rules sets write it: the mode with that id, read from the top rules set down (as the
 * exploration rules pick their modes). Read raw, so a step keeps its set icon's name and its text.
 */
function modeSteps(rulesSets: readonly Record<string, unknown>[], modeId: string): StripStep[] {
  for (const rules of [...rulesSets].reverse()) {
    const modes = isRecord(rules.exploration) && Array.isArray(rules.exploration.modes) ? rules.exploration.modes.filter(isRecord) : [];
    const mode = modes.find((m) => m.id === modeId);
    if (mode) return readStripSteps(mode.procedure);
  }
  return [];
}

/**
 * The procedure in force and where it comes from (mc-54). `chain` is the party's place first, then each place it sits
 * in (the GM's read; empty where there is none or it isn't read); `modeId` is the expedition's mode (null with none).
 * A source that gives no step with a name is passed over. Point to point (p2p-7) has two sources only: a place's own
 * steps, else the app's five; the rules set's steps, for a mode or by default, are never its strip.
 */
export function procedureInForce({
  chain,
  modeId,
  rulesSets,
}: {
  chain: readonly { data: Record<string, unknown> }[];
  modeId: string | null;
  rulesSets: readonly Record<string, unknown>[];
}): { source: StripSource; steps: readonly StripStep[] } {
  for (const place of chain) {
    const steps = readStripSteps(place.data.procedure);
    if (steps.length > 0) return { source: 'place', steps };
  }
  if (isPointToPoint(modeId)) return { source: 'app', steps: APP_STEPS };
  if (modeId) {
    const steps = modeSteps(rulesSets, modeId);
    if (steps.length > 0) return { source: 'mode', steps };
  }
  for (const rules of [...rulesSets].reverse()) {
    const steps = readStripSteps(rules.procedure);
    if (steps.length > 0) return { source: 'rules', steps };
  }
  return { source: 'app', steps: APP_STEPS };
}
