// The pack checker's notes on a town laid out as the source lays one out (docs/design/rulings/
// dec-pack-formats-2026-11-11.md, pf-3 and pf-5, "The checker warns on"): an aspect without a `lead`; a person's
// leads out of the pack's order (every person in one pack carries the same leads in the same order); a link
// `[[kind:id|label]]` that resolves to nothing in this pack; and a link inside a player's piece (players read the
// label as plain text, and the app strips the mark before a piece is made). Warnings only; nothing blocks. Links are
// read the way the app reads them (src/modules/library/linkMarks.ts). A link to another pack (`packId:id`) or a rule
// isn't resolved here.
//
// Used by scripts/pack-format.mjs; tested in scripts/pack-town.test.mjs with invented packs.
import { readAdventureHooks } from '../src/modules/library/adventureHooks.ts';
import { LINK_KINDS, linksIn } from '../src/modules/library/linkMarks.ts';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const entriesOf = (file, part) => (Array.isArray(file[part]) ? file[part].filter(isObject) : []);
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');

/** The part of a pack a link's kind names (a rule isn't checked: rt-1's rule text has no ids yet). */
export const PART_OF = { place: 'locations', npc: 'npcs', item: 'items', table: 'tables', statBlock: 'statBlocks', spell: 'spells', adventureHook: 'adventureHooks' };

/** Every string in a value with the path it sits at ("locations[2].gm.notes"). */
function stringsIn(value, path, out) {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => stringsIn(v, `${path}[${i}]`, out));
  else if (isObject(value)) for (const [k, v] of Object.entries(value)) stringsIn(v, path ? `${path}.${k}` : k, out);
  return out;
}

/** An aspect without its lead (pf-3): the app shows it with no bold lead-in. */
function aspectNotes(file) {
  const notes = [];
  for (const loc of entriesOf(file, 'locations')) {
    const aspects = isObject(loc.playerView) && Array.isArray(loc.playerView.aspects) ? loc.playerView.aspects : [];
    aspects.forEach((aspect, i) => {
      if (!isObject(aspect) || !isText(aspect.text)) notes.push(`locations: "${label(loc)}": playerView.aspects ${i + 1} should be { lead, text }.`);
      else if (!isText(aspect.lead)) notes.push(`locations: "${label(loc)}": playerView.aspects ${i + 1} has no lead (pf-3: the bold words it starts with).`);
    });
  }
  return notes;
}

/** A person whose leads come in another order than an earlier person's (pf-5: the same order for everyone). */
function leadOrderNotes(file) {
  const notes = [];
  const seen = [];
  for (const npc of entriesOf(file, 'npcs')) {
    const leads = isObject(npc.gm) && Array.isArray(npc.gm.leads) ? npc.gm.leads.filter(isObject).map((l) => (isText(l.lead) ? l.lead.trim() : '')).filter(Boolean) : [];
    for (let a = 0; a < leads.length; a++) {
      for (let b = a + 1; b < leads.length; b++) {
        const before = seen.find((order) => order.indexOf(leads[b]) >= 0 && order.indexOf(leads[a]) > order.indexOf(leads[b]));
        if (before) {
          notes.push(`npcs: "${label(npc)}": its leads put "${leads[a]}" before "${leads[b]}", the other way round from an earlier person (pf-5: the same order for everyone in the pack).`);
          a = leads.length;
          break;
        }
      }
    }
    seen.push(leads);
  }
  return notes;
}

/**
 * The four fields that carry rule text (pf-18, pf-18b): a place rule's `text`, an area's `gm.text`, a GM section's
 * `text` (`gm.sections[]`), a procedure step's `text` (on a place, a rules set, a mode or its camp). Their links are
 * checked with the rest of their shape by scripts/pack-rule-text.mjs, so the walk below leaves them alone and nothing
 * is said twice.
 */
export const RULE_TEXT_PATH =
  /^(?:locations\[\d+\]\.(?:rules\[\d+\]\.text|gm\.text|gm\.sections\[\d+\]\.text|procedure\[\d+\]\.text)|rulesSets\[\d+\]\.(?:procedure\[\d+\]\.text|exploration\.modes\[\d+\]\.(?:camp\.)?procedure\[\d+\]\.text))(?:$|[.[])/;

/** Links that name nothing in this pack, or a kind no link may name (rule text's links: scripts/pack-rule-text.mjs). */
function unresolvedLinkNotes(file) {
  const notes = [];
  const own = isObject(file.meta) && isText(file.meta.id) ? file.meta.id : '';
  const ids = Object.fromEntries(Object.entries(PART_OF).map(([kind, part]) => [kind, new Set(entriesOf(file, part).filter((e) => isText(e.id)).map((e) => e.id))]));
  // A hook is linkable only as the app reads it (#690's review): a skipped entry's id resolves to nothing.
  ids.adventureHook = new Set(readAdventureHooks(file).hooks.map((h) => h.id));
  for (const [path, text] of stringsIn(file, '', [])) {
    if (!text.includes('[[') || RULE_TEXT_PATH.test(path)) continue;
    for (const link of linksIn(text)) {
      if (!LINK_KINDS.includes(link.kind)) notes.push(`${path}: the link [[${link.kind}:${link.id}|${link.label}]] names "${link.kind}", which isn't a kind a link may name (${LINK_KINDS.join(', ')}).`);
      else if (link.kind !== 'rule' && (!link.packId || link.packId === own) && !ids[link.kind].has(link.id)) notes.push(`${path}: the link to ${link.kind} "${link.id}" resolves to nothing in this pack; the app shows "${link.label}" as plain text.`);
    }
  }
  return notes;
}

/** A link in what players may be shown: the app strips it to its label, so it's never a tap there. */
function playerLinkNotes(file) {
  const notes = [];
  const check = (where, value) => {
    for (const [path, text] of stringsIn(value, where, [])) if (linksIn(text).length) notes.push(`${path}: a link inside a player's piece; players read its label as plain text, never a tap (pf-5).`);
  };
  entriesOf(file, 'locations').forEach((loc, i) => {
    if (isObject(loc.playerView)) check(`locations[${i}].playerView`, loc.playerView);
  });
  entriesOf(file, 'npcs').forEach((npc, i) => {
    if (isObject(npc.playerView)) check(`npcs[${i}].playerView`, npc.playerView);
  });
  return notes;
}

/** Everything this file checks. */
export function townNotes(file) {
  if (!isObject(file)) return [];
  return [...aspectNotes(file), ...leadOrderNotes(file), ...unresolvedLinkNotes(file), ...playerLinkNotes(file)];
}
