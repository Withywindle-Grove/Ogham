// The rule-hook expression language (docs/07-content-packs.md, "The test language"): the formula language plus
// text, true / false / null, lists, dotted names and [ ] lookups, comparisons (== != < <= > >= and `in`),
// and / or / not, and a fixed list of functions. One evaluator everywhere: formulas (formula.ts) are expressions
// of this language worked out with only `level` known. Pack text is read by this small parser only, never run
// as code; sizes and depth are capped. A mistake in the text is found when it's read (checkExpression, at
// import); a value that doesn't fit at the table (adding text to a number) means the hook can't run: skipped,
// never guessed.

/** Dice in a value: a constant plus dice (sides → how many). The app shows dice, never rolls them. */
// Plain fields, not constructor shorthand: the pack checker runs this file in Node, which doesn't allow it.
export class Dice {
  readonly constant: number;
  readonly dice: ReadonlyMap<number, number>;
  constructor(constant: number, dice: ReadonlyMap<number, number>) {
    this.constant = constant;
    this.dice = dice;
  }
}

export type Value = number | string | boolean | null | Dice | Value[] | { [key: string]: Value };

export type Node =
  | { type: 'number'; value: number }
  | { type: 'text'; value: string }
  | { type: 'literal'; value: boolean | null }
  | { type: 'list'; items: Node[] }
  | { type: 'name'; name: string }
  | { type: 'member'; of: Node; key: string }
  | { type: 'index'; of: Node; key: Node }
  | { type: 'call'; name: string; args: Node[] }
  | { type: 'unary'; op: '-' | 'not'; of: Node }
  | { type: 'binary'; op: string; left: Node; right: Node }
  | { type: 'dice'; count: Node | null; sides: number };

/** The functions a pack may call (docs/07); lookup, allows and primeXp come from whoever runs the hook. */
export const FUNCTIONS = ['floor', 'ceil', 'min', 'max', 'count', 'has', 'lookup', 'allows', 'primeXp'] as const;

/** A mistake in the text, in plain words. */
export class ExpressionError extends Error {}
/** The expression is fine but can't be worked out with these values. */
export class CantRun extends Error {}

const MAX_TEXT = 1000;
const MAX_DEPTH = 40;
const MAX_DICE = 100;
/** Bigger answers are a broken rule, not a game value. */
const MAX_RESULT = 1_000_000_000;

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'text'; value: string }
  | { kind: 'word'; value: string }
  | { kind: 'die'; sides: number }
  | { kind: 'op'; value: string };

const OPS = ['==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/', '(', ')', '[', ']', ',', '.'];

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  while (at < source.length) {
    const rest = source.slice(at);
    const space = /^\s+/.exec(rest);
    if (space) {
      at += space[0].length;
      continue;
    }
    const levelDie = /^level(?=d\d)/i.exec(rest);
    const die = /^d(\d+)(?![A-Za-z0-9_])/.exec(rest);
    const number = /^\d+(\.\d+)?/.exec(rest);
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (levelDie) {
      tokens.push({ kind: 'word', value: 'level' });
      at += levelDie[0].length;
    } else if (die && !(tokens.at(-1)?.kind === 'op' && (tokens.at(-1) as { value: string }).value === '.')) {
      tokens.push({ kind: 'die', sides: Number(die[1]) });
      at += die[0].length;
    } else if (number) {
      tokens.push({ kind: 'number', value: Number(number[0]) });
      at += number[0].length;
    } else if (word) {
      tokens.push({ kind: 'word', value: word[0] });
      at += word[0].length;
    } else if (rest[0] === '"') {
      let text = '';
      let i = 1;
      for (; i < rest.length && rest[i] !== '"'; i += 1) {
        if (rest[i] === '\\' && i + 1 < rest.length) i += 1;
        text += rest[i];
      }
      if (i >= rest.length) throw new ExpressionError('A piece of "text" has no closing quote.');
      tokens.push({ kind: 'text', value: text });
      at += i + 1;
    } else if (rest[0] === '×' || rest[0] === '÷') {
      tokens.push({ kind: 'op', value: rest[0] === '×' ? '*' : '/' });
      at += 1;
    } else {
      const op = OPS.find((o) => rest.startsWith(o));
      if (!op) throw new ExpressionError(`"${rest[0]}" isn't something a rule can use.`);
      tokens.push({ kind: 'op', value: op });
      at += op.length;
    }
  }
  return tokens;
}

/** Reads an expression; throws ExpressionError in plain words. */
export function parseExpression(text: string): Node {
  if (text.length > MAX_TEXT) throw new ExpressionError('It is too long.');
  const tokens = tokenize(text);
  let at = 0;
  let depth = 0;
  const peek = () => tokens[at];
  const isOp = (value: string) => {
    const token = peek();
    return token?.kind === 'op' && token.value === value;
  };
  const isWord = (value: string) => {
    const token = peek();
    return token?.kind === 'word' && token.value === value;
  };
  const expect = (value: string) => {
    if (!isOp(value)) throw new ExpressionError(at >= tokens.length ? `It ends too soon (a "${value}" is missing).` : `A "${value}" is missing.`);
    at += 1;
  };
  const deeper = <T>(read: () => T): T => {
    depth += 1;
    if (depth > MAX_DEPTH) throw new ExpressionError('It is nested too deeply.');
    try {
      return read();
    } finally {
      depth -= 1;
    }
  };

  const or = (): Node => {
    let left = and();
    while (isWord('or')) {
      at += 1;
      left = { type: 'binary', op: 'or', left, right: and() };
    }
    return left;
  };
  const and = (): Node => {
    let left = not();
    while (isWord('and')) {
      at += 1;
      left = { type: 'binary', op: 'and', left, right: not() };
    }
    return left;
  };
  const not = (): Node => {
    if (isWord('not')) {
      at += 1;
      return deeper(() => ({ type: 'unary', op: 'not', of: not() }));
    }
    return compare();
  };
  const compare = (): Node => {
    const left = sum();
    const token = peek();
    const op = token?.kind === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(token.value) ? token.value : token?.kind === 'word' && token.value === 'in' ? 'in' : null;
    if (!op) return left;
    at += 1;
    return { type: 'binary', op, left, right: sum() };
  };
  const sum = (): Node => {
    let left = product();
    while (isOp('+') || isOp('-')) {
      const op = (peek() as { value: string }).value;
      at += 1;
      left = { type: 'binary', op, left, right: product() };
    }
    return left;
  };
  const product = (): Node => {
    let left = negative();
    while (isOp('*') || isOp('/')) {
      const op = (peek() as { value: string }).value;
      at += 1;
      left = { type: 'binary', op, left, right: negative() };
    }
    return left;
  };
  const negative = (): Node => {
    if (isOp('-')) {
      at += 1;
      return deeper(() => ({ type: 'unary', op: '-', of: negative() }));
    }
    return dice();
  };
  /** A die after a count ("3d6", "level d6", "(level + 1)d4"), or on its own ("d8": one die). */
  const dice = (): Node => {
    const first = peek();
    if (first?.kind === 'die') {
      at += 1;
      return { type: 'dice', count: null, sides: first.sides };
    }
    const count = postfix();
    const next = peek();
    if (next?.kind === 'die') {
      at += 1;
      return { type: 'dice', count, sides: next.sides };
    }
    return count;
  };
  const postfix = (): Node => {
    let node = primary();
    for (;;) {
      if (isOp('.')) {
        at += 1;
        const key = peek();
        if (key?.kind === 'word') node = { type: 'member', of: node, key: key.value };
        else if (key?.kind === 'die') node = { type: 'member', of: node, key: `d${key.sides}` };
        else throw new ExpressionError('A name is missing after a ".".');
        at += 1;
      } else if (isOp('[')) {
        at += 1;
        const key = deeper(or);
        expect(']');
        node = { type: 'index', of: node, key };
      } else return node;
    }
  };
  const primary = (): Node => {
    const token = peek();
    if (!token) throw new ExpressionError('It ends too soon.');
    at += 1;
    if (token.kind === 'number') return { type: 'number', value: token.value };
    if (token.kind === 'text') return { type: 'text', value: token.value };
    if (token.kind === 'word') {
      if (token.value === 'true' || token.value === 'false') return { type: 'literal', value: token.value === 'true' };
      if (token.value === 'null') return { type: 'literal', value: null };
      if (['and', 'or', 'not', 'in'].includes(token.value)) throw new ExpressionError(`"${token.value}" needs something before it.`);
      if (isOp('(')) {
        at += 1;
        const args: Node[] = [];
        if (!isOp(')')) {
          args.push(deeper(or));
          while (isOp(',')) {
            at += 1;
            args.push(deeper(or));
          }
        }
        expect(')');
        return { type: 'call', name: token.value, args };
      }
      return { type: 'name', name: token.value };
    }
    if (token.kind === 'op' && token.value === '(') {
      const inside = deeper(or);
      expect(')');
      return inside;
    }
    if (token.kind === 'op' && token.value === '[') {
      const items: Node[] = [];
      if (!isOp(']')) {
        items.push(deeper(or));
        while (isOp(',')) {
          at += 1;
          items.push(deeper(or));
        }
      }
      expect(']');
      return { type: 'list', items };
    }
    throw new ExpressionError(`"${token.kind === 'op' ? token.value : 'that'}" is in the wrong place.`);
  };

  if (tokens.length === 0) throw new ExpressionError('It is empty.');
  const node = or();
  if (at !== tokens.length) throw new ExpressionError('Something after the end doesn’t fit.');
  return node;
}

/** Every dotted name an expression reads ("item.slot"), and every function it calls, for checking. */
export function namesIn(node: Node): { paths: string[]; functions: string[] } {
  const paths: string[] = [];
  const functions: string[] = [];
  const pathOf = (n: Node): string | null =>
    n.type === 'name' ? n.name : n.type === 'member' ? ((p) => (p === null ? null : `${p}.${n.key}`))(pathOf(n.of)) : n.type === 'index' ? pathOf(n.of) : null;
  const walk = (n: Node) => {
    switch (n.type) {
      case 'name':
      case 'member': {
        const path = pathOf(n);
        if (path) paths.push(path);
        if (n.type === 'member') walkInside(n.of);
        return;
      }
      case 'index': {
        const path = pathOf(n);
        if (path) paths.push(path);
        walkInside(n.of);
        walk(n.key);
        return;
      }
      case 'call':
        functions.push(n.name);
        n.args.forEach(walk);
        return;
      case 'list':
        n.items.forEach(walk);
        return;
      case 'unary':
        walk(n.of);
        return;
      case 'binary':
        walk(n.left);
        walk(n.right);
        return;
      case 'dice':
        if (n.count) walk(n.count);
        return;
      default:
        return;
    }
  };
  // Inside a path only [ ] keys and calls add anything new.
  const walkInside = (n: Node) => {
    if (n.type === 'index') {
      walkInside(n.of);
      walk(n.key);
    } else if (n.type === 'member') walkInside(n.of);
    else if (n.type !== 'name') walk(n);
  };
  walk(node);
  return { paths: [...new Set(paths)], functions: [...new Set(functions)] };
}

/** What an expression may read and call while it's worked out. */
export interface Scope {
  names: Record<string, Value>;
  /** lookup, allows, primeXp: supplied by whoever runs the hook. Missing ones mean the hook can't run. */
  functions?: Partial<Record<string, (args: Value[]) => Value>>;
  /** Called when a fraction is rounded down to a whole number (a dice count). */
  onRoundDown?: () => void;
}

const isRecord = (value: Value): value is { [key: string]: Value } =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Dice);
const asDice = (value: Value): Dice | null => (value instanceof Dice ? value : typeof value === 'number' ? new Dice(value, new Map()) : null);
const number = (value: Value): number => {
  if (typeof value !== 'number') throw new CantRun();
  return value;
};
const truth = (value: Value): boolean => {
  if (value === null) return false;
  if (typeof value !== 'boolean') throw new CantRun();
  return value;
};
const same = (a: Value, b: Value): boolean => {
  if (a instanceof Dice || b instanceof Dice) throw new CantRun();
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
};

/** Works an expression out; throws CantRun when it can't be (the hook is then skipped, never guessed). */
export function evaluate(node: Node, scope: Scope): Value {
  const whole = (value: number) => {
    const down = Math.floor(value + 1e-9);
    if (Math.abs(down - value) > 1e-9) scope.onRoundDown?.();
    return down;
  };
  const run = (n: Node): Value => {
    switch (n.type) {
      case 'number':
      case 'text':
      case 'literal':
        return n.value;
      case 'list':
        return n.items.map(run);
      case 'name':
        return Object.prototype.hasOwnProperty.call(scope.names, n.name) ? (scope.names[n.name] ?? null) : null;
      case 'member': {
        const of = run(n.of);
        return isRecord(of) && Object.prototype.hasOwnProperty.call(of, n.key) ? (of[n.key] ?? null) : null;
      }
      case 'index': {
        const of = run(n.of);
        const key = run(n.key);
        if (isRecord(of) && (typeof key === 'string' || typeof key === 'number')) {
          return Object.prototype.hasOwnProperty.call(of, String(key)) ? (of[String(key)] ?? null) : null;
        }
        if (Array.isArray(of) && typeof key === 'number' && Number.isInteger(key)) return of[key] ?? null;
        return null;
      }
      case 'unary': {
        const of = run(n.of);
        if (n.op === 'not') return !truth(of);
        if (typeof of !== 'number') throw new CantRun();
        return -of;
      }
      case 'dice': {
        const count = n.count ? whole(number(run(n.count))) : 1;
        if (n.sides < 2 || count < 0 || count > MAX_DICE) throw new CantRun();
        return new Dice(0, new Map(count === 0 ? [] : [[n.sides, count]]));
      }
      case 'call':
        return call(n.name, n.args);
      case 'binary':
        return binary(n.op, n.left, n.right);
    }
  };
  const call = (name: string, args: Node[]): Value => {
    const numbers = () => args.map((a) => number(run(a)));
    switch (name) {
      case 'floor': {
        const [x] = numbers();
        if (args.length !== 1) throw new CantRun();
        return Math.floor(x! + 1e-9);
      }
      case 'ceil': {
        const [x] = numbers();
        if (args.length !== 1) throw new CantRun();
        return Math.ceil(x! - 1e-9);
      }
      case 'min':
      case 'max': {
        const values = numbers();
        if (values.length < 2) throw new CantRun();
        return name === 'min' ? Math.min(...values) : Math.max(...values);
      }
      case 'count': {
        const list = args.length === 1 ? run(args[0]!) : undefined;
        if (Array.isArray(list)) return list.length;
        if (list !== undefined && isRecord(list)) return Object.keys(list).length;
        if (list === null) return 0;
        throw new CantRun();
      }
      case 'has': {
        if (args.length !== 2) throw new CantRun();
        const map = run(args[0]!);
        const key = run(args[1]!);
        return isRecord(map) && (typeof key === 'string' || typeof key === 'number') && Object.prototype.hasOwnProperty.call(map, String(key));
      }
      default: {
        const given = (FUNCTIONS as readonly string[]).includes(name) ? scope.functions?.[name] : undefined;
        if (!given) throw new CantRun();
        return given(args.map(run));
      }
    }
  };
  const binary = (op: string, leftNode: Node, rightNode: Node): Value => {
    if (op === 'and') return truth(run(leftNode)) && truth(run(rightNode));
    if (op === 'or') return truth(run(leftNode)) || truth(run(rightNode));
    const left = run(leftNode);
    const right = run(rightNode);
    switch (op) {
      case '==':
        return left === null || right === null ? left === right : same(left, right);
      case '!=':
        return left === null || right === null ? left !== right : !same(left, right);
      case '<':
      case '<=':
      case '>':
      case '>=': {
        // Any comparison with null is false (docs/07).
        if (left === null || right === null) return false;
        const a = number(left);
        const b = number(right);
        return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
      }
      case 'in':
        if (left === null) return false;
        if (Array.isArray(right)) return right.some((item) => item !== null && same(left, item));
        if (right === null) return false;
        throw new CantRun();
      case '+':
      case '-': {
        const a = asDice(left);
        const b = asDice(right);
        if (!a || !b) throw new CantRun();
        if (op === '-' && b.dice.size > 0) throw new CantRun();
        if (a.dice.size === 0 && b.dice.size === 0) return op === '+' ? a.constant + b.constant : a.constant - b.constant;
        const dice = new Map(a.dice);
        for (const [sides, count] of b.dice) dice.set(sides, (dice.get(sides) ?? 0) + count);
        const total = [...dice.values()].reduce((sum, count) => sum + count, 0);
        if (total > MAX_DICE) throw new CantRun();
        return new Dice(op === '+' ? a.constant + b.constant : a.constant - b.constant, dice);
      }
      case '*':
      case '/': {
        const a = number(left);
        const b = number(right);
        if (op === '/' && b === 0) throw new CantRun();
        const result = op === '*' ? a * b : a / b;
        if (!Number.isFinite(result) || Math.abs(result) > MAX_RESULT) throw new CantRun();
        return result;
      }
      default:
        throw new CantRun();
    }
  };
  return run(node);
}

/** A hook's test worked out: true or false, or null when it can't run (the hook is skipped). */
export function testHolds(text: string, scope: Scope): boolean | null {
  try {
    const result = evaluate(parseExpression(text), scope);
    if (result === null) return false;
    return typeof result === 'boolean' ? result : null;
  } catch (error) {
    if (error instanceof ExpressionError || error instanceof CantRun) return null;
    throw error;
  }
}

/** What's wrong with an expression's text, in plain words; null when it reads fine. */
export function checkExpression(text: string): string | null {
  try {
    parseExpression(text);
    return null;
  } catch (error) {
    if (error instanceof ExpressionError) return error.message;
    throw error;
  }
}

