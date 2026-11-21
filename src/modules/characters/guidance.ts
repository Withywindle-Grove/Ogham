// Guided creation's words (A5, ruled 2026-10-25; text: words batch 1, ruled 2026-10-26): the HP prompt line, the
// ⓘ texts for alignment and literacy (the pack's own, else the fallbacks), and the hint for extra languages. Pure.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const top = (rulesSets: readonly Record<string, unknown>[], key: string): unknown => {
  for (const rules of [...rulesSets].reverse()) if (rules[key] !== undefined) return rules[key];
  return undefined;
};

/**
 * The HP prompt: the roll first, then what to add (words batch 1, §2). "to each die" and "(at least 1)" only when
 * the pack says so; a zero modifier is left out. With no hit die, the GM gives the number.
 */
export function hpPromptLine(input: {
  hitDice: string | null;
  level: number;
  /** The HP modifier from the scores and its ability's label ("CON"), when the setting has one. */
  modifier?: { value: number; ability: string } | null;
  perDie?: boolean;
  atLeastOne?: boolean;
}): string {
  if (!input.hitDice) return 'Enter the hit points your GM gives you.';
  const roll = input.level > 1 ? `Roll ${input.hitDice} for level ${input.level}` : `Roll ${input.hitDice}`;
  const mod = input.modifier;
  if (!mod || mod.value === 0) return roll;
  const each = input.perDie && input.level > 1 ? ' to each die' : '';
  const floor = input.atLeastOne && mod.value < 0 ? ' (at least 1)' : '';
  return mod.value > 0 ? `${roll}, then add ${mod.value} for ${mod.ability}${each}` : `${roll}, then subtract ${-mod.value} for ${mod.ability}${each}${floor}`;
}

/** The HP modifier the scores give: the first ability row that fills "hp" (abilityModifiers.CON → { hp: 1 }). */
export function hpModifierOf(filled: Record<string, unknown>): { value: number; ability: string } | null {
  for (const [name, row] of Object.entries(filled)) {
    if (!name.startsWith('abilityModifiers.') || !isRecord(row) || typeof row.hp !== 'number') continue;
    return { value: row.hp, ability: name.slice('abilityModifiers.'.length) };
  }
  return null;
}

/** Alignment's ⓘ: the pack's general note and each alignment's line, else the fallback (words batch 1, §3). */
export function alignmentAbout(rulesSets: readonly Record<string, unknown>[]): string {
  const notes = top(rulesSets, 'alignmentNotes');
  if (isRecord(notes)) {
    const lines = [typeof notes.general === 'string' ? notes.general : '', ...Object.entries(notes).filter(([k, v]) => k !== 'general' && typeof v === 'string').map(([k, v]) => `${k}: ${String(v)}`)];
    const text = lines.filter(Boolean).join(' ');
    if (text) return text;
  }
  if (typeof notes === 'string' && notes.trim()) return notes.trim();
  return "Alignment is your character's broad outlook, in your setting's own words. It can matter to some magic, items and places. Your GM decides what it means at your table.";
}

/** Literacy's ⓘ: the pack's literacyNote (one line per level, or text), else the fallback. */
export function literacyAbout(rulesSets: readonly Record<string, unknown>[]): string {
  const note = top(rulesSets, 'literacyNote');
  if (isRecord(note)) {
    const text = Object.entries(note).filter(([, v]) => typeof v === 'string').map(([k, v]) => `${k}: ${String(v)}`).join(' ');
    if (text) return text;
  }
  if (typeof note === 'string' && note.trim()) return note.trim();
  return 'Literacy is whether your character can read and write. Some settings tie it to a score or a background. Ask your GM how yours works.';
}

/**
 * A new character's languages, for an empty languages field: the race's and the class's, once each. A language
 * named after one of the campaign's fields (a class that speaks its "Alignment" tongue) takes that field's value
 * once it's chosen, and is left out until then (N7, M4b re-test 2026-10-28: "Alignment" showed as a language).
 */
export function startingLanguages(
  lists: readonly unknown[],
  fields: readonly { key: string; label: string }[],
  inputs: Readonly<Record<string, unknown>>,
  /** How a language id reads (creationRules.ts languageNamer: its name from the setting's list); as written by default. */
  languageName: (named: string) => string = (named) => named.trim(),
): string {
  const named = (language: string) => fields.find((f) => f.label.trim().toLowerCase() === language.trim().toLowerCase() || f.key.toLowerCase() === language.trim().toLowerCase());
  const languages = lists.flatMap((list) => (Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : []));
  const shown = languages.flatMap((language) => {
    const field = named(language);
    if (!field) return [languageName(language)];
    const value = inputs[field.key];
    return typeof value === 'string' && value.trim() ? [value.trim()] : [];
  });
  return [...new Set(shown)].join(', ');
}

/** "Additional languages: 2 to choose", from the scores' language row, when it gives a number; null otherwise. */
export function extraLanguagesHint(filled: Record<string, unknown>): string | null {
  for (const [name, row] of Object.entries(filled)) {
    if (!name.startsWith('abilityModifiers.') || !isRecord(row)) continue;
    const n = typeof row.extraLanguages === 'number' ? row.extraLanguages : null;
    if (n !== null && n > 0) return `Additional languages: ${n} to choose, as your setting allows.`;
  }
  return null;
}
