// The pack checker's notes on an adventure's hooks (docs/design/rulings/dec-pack-formats-2026-11-11.md, pf-7 and
// pf-7a): a `giverNpcId` that names no npc in this pack. Each entry's shape is the importer's to say (dec-12 piece B:
// the importer reads them with src/modules/library/adventureHooks.ts and its notes are the import's warnings, which
// the checker prints), so it isn't said twice here. An `[[adventureHook:id|label]]` link that names no hook is said
// by the link check (scripts/pack-town.mjs), with every other kind of link (pf-5a). Warnings only; nothing blocks.
//
// Used by scripts/pack-format.mjs; tested in scripts/pack-adventure-hooks.test.mjs with invented packs.
import { readAdventureHooks } from '../src/modules/library/adventureHooks.ts';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';

/** Everything this file checks. */
export function adventureHookNotes(file) {
  if (!isObject(file)) return [];
  const { hooks } = readAdventureHooks(file);
  const notes = [];
  const npcs = new Set((Array.isArray(file.npcs) ? file.npcs : []).filter((n) => isObject(n) && isText(n.id)).map((n) => n.id.trim()));
  for (const hook of hooks) {
    if (hook.giverNpcId && !npcs.has(hook.giverNpcId)) notes.push(`adventureHooks: "${hook.id}": giverNpcId "${hook.giverNpcId}" names no npc in this pack; the GM sees no one giving it.`);
  }
  return notes;
}
