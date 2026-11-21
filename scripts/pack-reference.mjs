// The pack checker's checks for the GM reference panels (`gmReference` on a rules set; ruled 2026-11-01, M5 gate B4,
// G-45; docs/07): 07 says pack:check warns when a panel has no entries or an entry has no text. It also says when
// the field isn't a list of panels, or a panel has no title (the screen would leave it out). Nothing here blocks
// an import: the app leaves such panels and entries out. A panel's `gmOnly` (ruled by Francis 2026-11-07: `false` opens
// the panel to the players) must be true or false; anything else is warned about, and the panel stays the GM's.
//
// Used by scripts/pack-format.mjs; tested in scripts/pack-reference.test.mjs with invented packs.

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');

/** Every rules set's gmReference panels. Never throws on odd input. */
export function gmReferenceNotes(file) {
  if (!isObject(file) || !Array.isArray(file.rulesSets)) return [];
  const notes = [];
  for (const rules of file.rulesSets.filter(isObject)) {
    if (rules.gmReference === undefined) continue;
    const where = `rulesSets: "${label(rules)}": gmReference`;
    if (!Array.isArray(rules.gmReference)) {
      notes.push(`${where} should be a list of panels, each { id, title, entries }.`);
      continue;
    }
    rules.gmReference.forEach((panel, p) => {
      if (!isObject(panel)) return notes.push(`${where}, panel #${p + 1} isn't a panel; it won't show.`);
      const name = isText(panel.title) ? `"${panel.title.trim()}"` : isText(panel.id) ? `"${panel.id.trim()}"` : `#${p + 1}`;
      if (!isText(panel.title)) notes.push(`${where}, panel ${name} has no title; it won't show.`);
      if (panel.gmOnly !== undefined && typeof panel.gmOnly !== 'boolean') notes.push(`${where}, panel ${name}: gmOnly should be true or false; it stays the GM's.`);
      const entries = Array.isArray(panel.entries) ? panel.entries : [];
      if (entries.length === 0) return notes.push(`${where}, panel ${name} has no entries; it won't show.`);
      entries.forEach((entry, e) => {
        const which = isObject(entry) && isText(entry.heading) ? `"${entry.heading.trim()}"` : `#${e + 1}`;
        if (!isObject(entry) || !isText(entry.text)) notes.push(`${where}, panel ${name}, entry ${which} has no text.`);
      });
    });
  }
  return notes;
}
