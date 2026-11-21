// A pack's formulas worked out at a level (docs/07-content-packs.md, Formulas): numbers, `level`, + - * /
// (also × ÷), brackets, floor(), and dice ("1d6", "d8", "level d6", "(level + 1)d4"). The result is a whole
// number or a dice expression ("3d6 + 1"); the app never rolls. Whole numbers only: anything with a fraction
// is rounded down, and the result says so. Anything it doesn't understand gives null and the pack's text
// stays as written. A formula is an expression of the hook language (expression.ts: one evaluator everywhere)
// that uses only these parts; pack text is read by that small parser only, never run as code; sizes are capped.
import { CantRun, Dice, evaluate, ExpressionError, parseExpression, type Node } from './expression.ts';

export interface Worked {
  text: string;
  /** A fraction was rounded down on the way (outside an explicit floor()). */
  roundedDown: boolean;
}

const MAX_LENGTH = 200;
const MAX_LEVEL = 99;
/** Bigger answers are a broken formula, not a game value (and would show as "Infinity"). */
const MAX_RESULT = 1_000_000_000;

/** Only the formula parts of the language: numbers, level, + - * /, floor() and dice. */
function formulaOnly(node: Node): boolean {
  switch (node.type) {
    case 'number':
      return true;
    case 'name':
      return node.name === 'level';
    case 'dice':
      return node.count === null || formulaOnly(node.count);
    case 'unary':
      return node.op === '-' && formulaOnly(node.of);
    case 'binary':
      return ['+', '-', '*', '/'].includes(node.op) && formulaOnly(node.left) && formulaOnly(node.right);
    case 'call':
      return node.name === 'floor' && node.args.length === 1 && formulaOnly(node.args[0]!);
    default:
      return false;
  }
}

/** The formula at this level, e.g. "2 + level" at 3 → "5", "level d6 + 1" at 3 → "3d6 + 1"; null if unreadable. */
export function workOut(formula: string, level: number): Worked | null {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return null;
  if (formula.length === 0 || formula.length > MAX_LENGTH) return null;
  try {
    const node = parseExpression(formula.toLowerCase());
    if (!formulaOnly(node)) return null;
    let roundedDown = false;
    const result = evaluate(node, { names: { level }, onRoundDown: () => (roundedDown = true) });
    const value = result instanceof Dice ? result : typeof result === 'number' ? new Dice(result, new Map()) : null;
    if (!value || !Number.isFinite(value.constant) || Math.abs(value.constant) > MAX_RESULT) return null;
    const constant = Math.floor(value.constant + 1e-9);
    if (Math.abs(constant - value.constant) > 1e-9) roundedDown = true;
    const parts = [...value.dice].map(([sides, count]) => `${count}d${sides}`);
    let text = parts.join(' + ');
    if (parts.length === 0) text = String(constant);
    else if (constant > 0) text += ` + ${constant}`;
    else if (constant < 0) text += ` - ${-constant}`;
    return { text, roundedDown };
  } catch (error) {
    if (error instanceof ExpressionError || error instanceof CantRun) return null;
    throw error;
  }
}
