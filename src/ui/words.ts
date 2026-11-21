// The words-guide check (docs/06 "Words and voice", ruled 2026-10-25): flags the app's own text that breaks the
// guide: exclamation marks, Title Case labels, and the listed phrases. It reads the app's source files, looking only
// at text people see (JSX text and quoted sentences), never pack content or player notes (those aren't in the
// source). Pure, so a test can run it over every screen.
import { BRAND } from '../brand.ts';

/** Words and phrases the guide rules out (rules 4 and 9), matched as whole words, any case. */
export const BANNED = ['successfully', 'simply', 'delve', 'embark', 'unleash', 'adventure awaits', "let's", 'dive in', 'seamless', 'unlock', 'oops', 'awesome'];

// Capitalised words that are fine mid-label: names, abbreviations and the guide's own terms. "Location" is the place
// word of p2p-1, capitalised in the Depart sheet's approved words ("Pick a Location"; page 24, DP1, 2026-11-18; B7).
const PROPER = new Set([BRAND.appName, BRAND.persona, 'GM', 'GMs', 'HP', 'AC', 'XP', 'OK', 'I', 'Google', 'Drive', 'PDF', 'JSON', 'Markdown', 'AI', 'STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA', 'Location']);

export interface WordProblem {
  line: number;
  text: string;
  why: string;
}

/** Text a person reads: JSX text between tags, and quoted strings that read as words (a space and a letter). */
function shownText(source: string): { line: number; text: string }[] {
  const found: { line: number; text: string }[] = [];
  const lines = source.split('\n');
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*') || line.startsWith('import ')) return;
    // Names (a character's, a class's) are content, not the app's words: a line marked "words: names" is skipped.
    if (raw.includes('words: names')) return;
    // JSX text: a whole line of words inside an element, or text between tags on one line.
    if (/^[A-Z][^<>{}=;()]*[.?…:!]?$/.test(line) && /\s/.test(line)) found.push({ line: index + 1, text: line });
    for (const m of line.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) if (/\s/.test(m[1]!.trim())) found.push({ line: index + 1, text: m[1]!.trim() });
    // Quoted strings with a space and a letter, not class names or code.
    for (const m of line.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*?)\1/g)) {
      const text = m[2]!;
      if (/\s/.test(text) && /[a-z]/i.test(text) && !/^[a-z0-9_-]+(\s[a-z0-9_-]+)*$/.test(text) && !/[{}<>=;]|\$\{|\(\)|=>|^\s*\w+\.\w+/.test(text))
        found.push({ line: index + 1, text });
    }
  });
  return found;
}

const SMALL = new Set(['and', 'the', 'for', 'with', 'from', 'into', 'your', 'you', 'not', 'but', 'off', 'out']);

/** Title Case: two or more words (three letters or more, not small words or names), every one capitalised. */
function titleCase(text: string): boolean {
  const words = text.replace(/[^\p{L}\s'’-]/gu, ' ').split(/\s+/).filter((w) => w.length >= 3 && !SMALL.has(w.toLowerCase()) && !PROPER.has(w));
  return words.length >= 2 && words.every((w) => /^\p{Lu}/u.test(w)) && !/^\p{Lu}+$/u.test(words.join(''));
}

export function wordProblems(source: string): WordProblem[] {
  const problems: WordProblem[] = [];
  for (const { line, text } of shownText(source)) {
    if (/\p{L}!(\s|$)/u.test(text)) problems.push({ line, text, why: 'exclamation mark' });
    const lower = text.toLowerCase();
    for (const word of BANNED) if (new RegExp(`(^|[^a-z])${word.replace("'", "['’]")}([^a-z]|$)`).test(lower)) problems.push({ line, text, why: `"${word}"` });
    if (titleCase(text)) problems.push({ line, text, why: 'Title Case' });
  }
  return problems;
}
