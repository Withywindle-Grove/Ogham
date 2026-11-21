// A pack's sheet layouts (fieldTemplates), as the character fields "Use this sheet layout" would add.
import type { PackEntry } from './packFile.ts';

/** A field as a sheet layout gives it (docs/07-content-packs.md, fieldTemplates). */
export interface SheetField {
  key?: string;
  label?: string;
  type?: string;
  group?: string;
  showOnCard?: boolean;
  choices?: unknown;
  /** A list field's trait list (07: `from: "<traitList id>"`; M5b step 0b). */
  from?: string;
  /** The filled value it shows (ruled 2026-10-25): saves.D, attack… (fills.ts). */
  fill?: string;
  required?: boolean;
  /** `false`: creation never asks it; it stays on the sheet (07, ruled B 2026-11-03: an affiliation from play). */
  atCreation?: boolean;
}

/**
 * The character fields a pack's sheet layouts give (layouts for other kinds of character left out). A "ref" field
 * (the race, kindred…) points at what the character already has, so it isn't added as a field of its own (07: ref
 * comes later; the M4b gate found the layout's Race beside the character's own race).
 */
export function layoutFields(entries: PackEntry[]): SheetField[] {
  return entries
    .filter((entry) => entry.kind === 'fieldTemplate' && entry.data.appliesTo !== 'npc' && Array.isArray(entry.data.fields))
    .flatMap((entry) => (entry.data.fields as unknown[]).filter((f): f is SheetField => typeof f === 'object' && f !== null))
    .filter((f) => String(f.type ?? '').toLowerCase() !== 'ref');
}
