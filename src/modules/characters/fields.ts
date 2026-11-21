// GM-defined character fields: the GM adds them under Setting rules → Character fields; players fill them in.
// Values live in each character's `fields`, keyed by the field's key (fixed when the field is made).
// All fields are optional. The database can't type-check the values, so these commands do.
import { defineCommand, failed, fromWrite, isGm, ok, type CommandResult } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import { ALIGNMENT_KEY, loadCampaignAlignments } from '../../core/alignments.ts';
import { layoutKey } from '../library/optionGate.ts';

export const FIELD_TYPES = ['number', 'text', 'longtext', 'checkbox', 'list'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  number: 'Number',
  text: 'Text',
  longtext: 'Long text',
  checkbox: 'Yes/No',
  list: 'List',
};

export interface FieldDefinition {
  id: string;
  campaignId: string;
  key: string;
  label: string;
  type: FieldType;
  choices: string[];
  group: string;
  order: number;
  showOnCard: boolean;
  hidden: boolean;
  /** The filled value it shows (ruled 2026-10-25): "saves.D", "attack"…; from the sheet layout it came from. */
  fill: string | null;
  /** Character creation asks for it (a sheet layout's `required`, ruled 2026-10-24). */
  required: boolean;
  /**
   * A list field fed by the setting's trait list of this id (07 `from`; M5b step 0b): the value saved is the entry's
   * id, the step and the sheet offer the list; without the list (no pack), free text.
   */
  from: string | null;
}

export type FieldValue = number | string | boolean;
export type FieldValues = Record<string, FieldValue>;

const LABEL_MAX = 60;

/** The campaign's character fields, in the GM's order (hidden ones included). Null if they couldn't be loaded. */
export async function loadFieldDefinitions(db: Db, campaignId: string): Promise<FieldDefinition[] | null> {
  const { data, error } = await db
    .from('field_definitions')
    .select('id, campaign_id, key, label, type, choices, field_group, sort_order, show_on_card, hidden, created_at, fill, required, from_list')
    .eq('campaign_id', campaignId)
    .eq('applies_to', 'pc');
  if (error) return null;
  return [...data]
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    .map((row) => ({
      id: row.id,
      campaignId: row.campaign_id,
      key: row.key,
      label: row.label,
      type: row.type as FieldType,
      choices: row.choices,
      group: row.field_group,
      order: row.sort_order,
      showOnCard: row.show_on_card,
      hidden: row.hidden,
      fill: row.fill ?? null,
      required: row.required === true,
      from: row.from_list ?? null,
    }));
}

/** Keys that some character in the campaign has a value for (those fields can be hidden, not deleted). */
export async function loadUsedFieldKeys(db: Db, campaignId: string): Promise<Set<string> | null> {
  const { data, error } = await db.from('actors').select('fields').eq('campaign_id', campaignId);
  if (error) return null;
  const used = new Set<string>();
  for (const row of data) {
    if (row.fields && typeof row.fields === 'object' && !Array.isArray(row.fields)) {
      for (const key of Object.keys(row.fields)) used.add(key);
    }
  }
  // The alignment lives in its own table (M5b step 0c): a character with one uses the field too.
  if ((await loadCampaignAlignments(db, campaignId)).size > 0) used.add(ALIGNMENT_KEY);
  return used;
}

/** "Hit dice (d6)" → "hit_dice_d6"; a taken key gets _2, _3… */
export function keyFromLabel(label: string, taken: Iterable<string>): string {
  const base = layoutKey(label) || 'field';
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

/** List choices as the GM typed them (one per line): trimmed, blanks and repeats dropped. */
export function cleanChoices(text: string | string[]): string[] {
  const lines = Array.isArray(text) ? text : text.split('\n');
  return [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
}

/** What a player typed (or ticked) for one field: a value, nothing (left empty), or a plain-words problem. */
export function readFieldInput(field: FieldDefinition, raw: string | boolean): { value?: FieldValue } | { error: string } {
  if (field.type === 'checkbox') return raw === true ? { value: true } : {};
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text === '') return {};
  if (field.type === 'number') {
    if (!/^-?\d+$/.test(text) || !Number.isSafeInteger(Number(text))) {
      return { error: `${field.label} must be a whole number (it can be negative).` };
    }
    return { value: Number(text) };
  }
  // A list fed by a trait list holds an entry's id (or, without the list, what was typed): the step offers the list.
  if (field.type === 'list' && !field.from && !field.choices.includes(text)) return { error: `${field.label} must be one of its choices.` };
  return { value: text };
}

/** The words shown for a trait-list field's value (the entry's name), or null to show the value as it is. */
export type TraitLookup = (field: FieldDefinition, value: string) => string | null;

/** A field's value as words: a trait list's entry by name when the setting has it, else as saved. */
function shown(field: FieldDefinition, value: unknown, lookup?: TraitLookup): string {
  const text = String(value);
  if (field.from && lookup) return lookup(field, text) ?? text;
  return text;
}

export type FieldInputs = Record<string, string | boolean>;

/** A character's saved values as form inputs (text for most, ticked or not for Yes/No). */
export function fieldInputsFrom(fields: FieldDefinition[], values: unknown): FieldInputs {
  const record = values && typeof values === 'object' && !Array.isArray(values) ? (values as Record<string, unknown>) : {};
  const inputs: FieldInputs = {};
  for (const field of fields) {
    const value = record[field.key];
    inputs[field.key] = field.type === 'checkbox' ? value === true : value === undefined || value === null ? '' : String(value);
  }
  return inputs;
}

/** Reads every visible field's input: the values to save, or the first problem in plain words. */
export function readFieldInputs(
  fields: FieldDefinition[],
  inputs: FieldInputs,
  { creating = false }: { creating?: boolean } = {},
): { ok: true; values: FieldValues } | { ok: false; message: string } {
  const values: FieldValues = {};
  for (const field of fields.filter((f) => !f.hidden)) {
    const read = readFieldInput(field, inputs[field.key] ?? (field.type === 'checkbox' ? false : ''));
    if ('error' in read) return { ok: false, message: read.error };
    // A field the sheet layout marks required is asked for when the character is made.
    if (creating && field.required && field.type !== 'checkbox' && read.value === undefined) return { ok: false, message: `${field.label} is needed.` };
    if (read.value !== undefined) values[field.key] = read.value;
  }
  return { ok: true, values };
}

/** Checks values against the campaign's visible fields; empty values are left out. */
export function cleanFieldValues(
  fields: FieldDefinition[],
  values: Record<string, unknown>,
): { ok: true; values: FieldValues } | { ok: false; message: string } {
  const byKey = new Map(fields.filter((f) => !f.hidden).map((f) => [f.key, f]));
  const clean: FieldValues = {};
  for (const [key, value] of Object.entries(values)) {
    const field = byKey.get(key);
    if (!field) return { ok: false, message: "That field isn't part of this campaign." };
    if (value === undefined || value === null || value === '' || value === false) continue;
    const raw = typeof value === 'number' ? String(value) : value;
    if (typeof raw !== 'string' && typeof raw !== 'boolean') return { ok: false, message: `${field.label} isn't valid.` };
    const read = readFieldInput(field, raw);
    if ('error' in read) return { ok: false, message: read.error };
    if (read.value !== undefined) clean[key] = read.value;
  }
  return { ok: true, values: clean };
}

/** A label without its bracketed aside, for one-line summaries: "THAC0 [attack bonus]" → "THAC0". */
export const shortLabel = (label: string) => label.replace(/\s*\[[^\]]*\]\s*/g, ' ').trim() || label;

/** "Class Lantern Warden · STR 13 · Swims" — visible fields with a value, in order; long text is left out. */
export function fieldSummary(fields: FieldDefinition[], values: unknown, options: { onlyCard?: boolean; lookup?: TraitLookup } = {}): string {
  const record = values && typeof values === 'object' && !Array.isArray(values) ? (values as Record<string, unknown>) : {};
  return fields
    .filter((f) => !f.hidden && f.type !== 'longtext' && (!options.onlyCard || f.showOnCard))
    .flatMap((f) => {
      const value = record[f.key];
      if (value === undefined || value === null || value === '' || value === false) return [];
      return [f.type === 'checkbox' ? shortLabel(f.label) : `${shortLabel(f.label)} ${shown(f, value, options.lookup)}`];
    })
    .join(', ');
}

/**
 * The line under a character's name on the Player screen: values of the visible fields marked for the card
 * (words alone, numbers with their label, ticked boxes by label), then the level. "Marsh folk · Might 13 · Level 3".
 * A text value that's a number gets its label too, and a label's bracketed aside is left off ("THAC0 19", not a
 * bare "19" or "THAC0 [attack bonus] 19"; M4b gate, 2026-10-25).
 */
export function cardLine(fields: FieldDefinition[], values: unknown, level: number, lookup?: TraitLookup): string {
  const record = values && typeof values === 'object' && !Array.isArray(values) ? (values as Record<string, unknown>) : {};
  const parts = fields
    .filter((f) => !f.hidden && f.showOnCard && f.type !== 'longtext')
    .flatMap((f) => {
      const value = record[f.key];
      if (value === undefined || value === null || value === '' || value === false) return [];
      const label = shortLabel(f.label);
      if (f.type === 'checkbox') return [label];
      const words = shown(f, value, lookup);
      return [f.type === 'number' || /^[+-]?\d+$/.test(words.trim()) ? `${label} ${words}` : words];
    });
  return [...parts, `Level ${level}`].join(', ');
}

export interface SheetSection {
  /** The category ("" for fields without one). */
  name: string;
  /** `key`: the field's, so the sheet can open the row's breakdown or entry (ct3-9, ct3-11). */
  rows: { key: string; label: string; value: string }[];
}

/**
 * The fields on the full sheet: visible ones grouped by category in the GM's order, empty values as a dash,
 * boxes as Yes or No. The GM also sees the hidden fields, in a last "Hidden fields" section.
 */
export function sheetSections(fields: FieldDefinition[], values: unknown, options: { includeHidden?: boolean; lookup?: TraitLookup } = {}): SheetSection[] {
  const record = values && typeof values === 'object' && !Array.isArray(values) ? (values as Record<string, unknown>) : {};
  const row = (f: FieldDefinition) => {
    const value = record[f.key];
    if (f.type === 'checkbox') return { key: f.key, label: f.label, value: value === true ? 'Yes' : 'No' };
    return { key: f.key, label: f.label, value: value === undefined || value === null || value === '' ? '—' : shown(f, value, options.lookup) };
  };
  const sections: SheetSection[] = [];
  for (const field of fields.filter((f) => !f.hidden)) {
    const section = sections.find((s) => s.name === field.group);
    if (section) section.rows.push(row(field));
    else sections.push({ name: field.group, rows: [row(field)] });
  }
  const hidden = fields.filter((f) => f.hidden);
  if (options.includeHidden && hidden.length > 0) sections.push({ name: 'Hidden fields', rows: hidden.map(row) });
  return sections;
}

// Commands (GM only). Each checks the campaign's GM; the database's access rules agree.

type FieldRef = { id: string; campaignId: string };

export const createField = defineCommand({
  name: 'field.create',
  target: (input: {
    campaignId: string;
    label: string;
    type: FieldType;
    choices?: string[];
    group?: string;
    showOnCard?: boolean;
  }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<FieldRef>> => {
    const label = input.label.trim();
    if (!label) return failed('Give the field a name.');
    if (label.length > LABEL_MAX) return failed(`Keep the name under ${LABEL_MAX} characters.`);
    if (!FIELD_TYPES.includes(input.type)) return failed('Pick a type for the field.');
    const choices = input.type === 'list' ? cleanChoices(input.choices ?? []) : [];
    if (input.type === 'list' && choices.length === 0) return failed('A list needs at least one choice.');

    const existing = await loadFieldDefinitions(db, input.campaignId);
    if (!existing) return failed("Couldn't check the campaign's fields. Try again.");
    const result = fromWrite(
      await db
        .from('field_definitions')
        .insert({
          campaign_id: input.campaignId,
          applies_to: 'pc',
          key: keyFromLabel(label, existing.map((f) => f.key)),
          label,
          type: input.type,
          choices,
          field_group: input.group?.trim() ?? '',
          sort_order: existing.reduce((max, f) => Math.max(max, f.order), -1) + 1,
          show_on_card: input.showOnCard ?? false,
        })
        .select('id, campaign_id'),
    );
    return result.ok ? ok({ id: result.value.id, campaignId: result.value.campaign_id }) : result;
  },
});

/** A field as a pack's sheet layout gives it (docs/07-content-packs.md, fieldTemplates). */
export interface LayoutField {
  key?: string;
  label?: string;
  type?: string;
  group?: string;
  showOnCard?: boolean;
  choices?: unknown;
  /** A list field's trait list (07 `from`; M5b step 0b). */
  from?: string;
  fill?: string;
  required?: boolean;
}

const LIST_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LAYOUT_TYPES: Record<string, FieldType> = { number: 'number', text: 'text', longtext: 'longtext', checkbox: 'checkbox', list: 'list' };

/**
 * Uses a sheet layout from setting rules: adds its fields after the campaign's own. A field the campaign already
 * has (same name or key) is kept as the GM made it. Logged as one line; returns how many fields were added.
 * A layout's field keyed "hp" is the character's own HP, never a campaign field (ruled 2026-10-25): marked
 * required, it sets the campaign's "HP is asked at creation" instead.
 */
export const applySheetLayout = defineCommand({
  name: 'field.useLayout',
  target: (input: { campaignId: string; fields: LayoutField[] }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<number>> => {
    const existing = await loadFieldDefinitions(db, input.campaignId);
    if (!existing) return failed("Couldn't check the campaign's fields. Try again.");
    const labels = new Set(existing.map((f) => f.label.toLowerCase()));
    const keys = existing.map((f) => f.key);
    let order = existing.reduce((max, f) => Math.max(max, f.order), -1) + 1;
    let added = 0;
    for (const field of input.fields) {
      const label = (field.label ?? field.key ?? '').trim().slice(0, LABEL_MAX);
      const key = keyFromLabel(field.key ?? label, []);
      if (key === 'hp') {
        if (field.required === true) {
          const found = await db.from('campaigns').select('settings').eq('id', input.campaignId).maybeSingle();
          const settings = found.data?.settings && typeof found.data.settings === 'object' && !Array.isArray(found.data.settings) ? found.data.settings : {};
          if (found.error) return failed("Couldn't read the campaign's settings. Try again.");
          if ((settings as { hpRequired?: unknown }).hpRequired !== true) {
            const saved = fromWrite(await db.from('campaigns').update({ settings: { ...settings, hpRequired: true } }).eq('id', input.campaignId).select('id'));
            if (!saved.ok) return saved;
          }
        }
        continue;
      }
      if (!label || labels.has(label.toLowerCase()) || keys.includes(key)) continue;
      const type = LAYOUT_TYPES[(field.type ?? '').toLowerCase()] ?? 'text';
      const choices = type === 'list' && Array.isArray(field.choices) ? cleanChoices(field.choices.map(String)) : [];
      // A list fed by a trait list (07 `from`) keeps the list's id; the step and the sheet offer its entries.
      const from = type === 'list' && choices.length === 0 && typeof field.from === 'string' && LIST_ID.test(field.from.trim()) && field.from.trim().length <= 80 ? field.from.trim() : null;
      const result = fromWrite(
        await db
          .from('field_definitions')
          .insert({
            campaign_id: input.campaignId,
            applies_to: 'pc',
            key: keyFromLabel(field.key ?? label, keys),
            label,
            type: type === 'list' && choices.length === 0 && !from ? 'text' : type,
            choices,
            from_list: from,
            field_group: (field.group ?? '').trim(),
            sort_order: order,
            show_on_card: field.showOnCard === true,
            fill: typeof field.fill === 'string' && field.fill.trim() ? field.fill.trim().slice(0, 60) : null,
            required: field.required === true,
          })
          .select('id'),
      );
      if (!result.ok) return result;
      labels.add(label.toLowerCase());
      keys.push(key);
      order += 1;
      added += 1;
    }
    return ok(added);
  },
});

export interface FieldChanges {
  label?: string;
  choices?: string[];
  group?: string;
  showOnCard?: boolean;
  hidden?: boolean;
}

/** Changes a field's name, choices, group, card setting, or hides/shows it. Its key and type never change. */
export const updateField = defineCommand({
  name: 'field.update',
  target: (input: { field: FieldRef & { type?: FieldType }; changes: FieldChanges }) => ({
    campaignId: input.field.campaignId,
  }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<FieldRef>> => {
    const { changes } = input;
    const patch: { label?: string; choices?: string[]; field_group?: string; show_on_card?: boolean; hidden?: boolean } = {};
    if (changes.label !== undefined) {
      const label = changes.label.trim();
      if (!label) return failed('Give the field a name.');
      if (label.length > LABEL_MAX) return failed(`Keep the name under ${LABEL_MAX} characters.`);
      patch.label = label;
    }
    if (changes.choices !== undefined) {
      patch.choices = cleanChoices(changes.choices);
      if (input.field.type === 'list' && patch.choices.length === 0) return failed('A list needs at least one choice.');
    }
    if (changes.group !== undefined) patch.field_group = changes.group.trim();
    if (changes.showOnCard !== undefined) patch.show_on_card = changes.showOnCard;
    if (changes.hidden !== undefined) patch.hidden = changes.hidden;
    const result = fromWrite(
      await db.from('field_definitions').update(patch).eq('id', input.field.id).select('id, campaign_id'),
    );
    return result.ok ? ok({ id: result.value.id, campaignId: result.value.campaign_id }) : result;
  },
});

/** Puts the campaign's fields in this order (ids first to last). */
export const reorderFields = defineCommand({
  name: 'field.reorder',
  log: 'verbose',
  target: (input: { campaignId: string; ids: string[] }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<string[]>> => {
    for (const [index, id] of input.ids.entries()) {
      const result = fromWrite(
        await db
          .from('field_definitions')
          .update({ sort_order: index })
          .eq('id', id)
          .eq('campaign_id', input.campaignId)
          .select('id'),
      );
      if (!result.ok) return result;
    }
    return ok(input.ids);
  },
});

/** Deletes a field nobody has filled in (otherwise hide it: values are never erased). */
export const deleteField = defineCommand({
  name: 'field.delete',
  target: (input: { field: FieldRef & { key: string } }) => ({ campaignId: input.field.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<FieldRef>> => {
    const used = await loadUsedFieldKeys(db, input.field.campaignId);
    if (!used) return failed("Couldn't check whether characters use this field. Try again.");
    if (used.has(input.field.key)) return failed('Some characters have filled this in. Hide it instead.');
    const result = fromWrite(await db.from('field_definitions').delete().eq('id', input.field.id).select('id, campaign_id'));
    return result.ok ? ok({ id: result.value.id, campaignId: result.value.campaign_id }) : result;
  },
});
