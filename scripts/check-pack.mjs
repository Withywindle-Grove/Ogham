// Checks a setting-rules pack file the way the app's importer reads it, without the app or the database:
//   npm run pack:check -- packs/my-pack/my-pack.pack.json
//   npm run pack:check -- packs/a/a.pack.json packs/b/b.pack.json   (several: each, then together as a library)
// Prints what it holds (counts per kind, the same the app's import preview shows), anything left out and why,
// and entries the in-app editor would refuse to save as they are. Reads the app's own code (Node runs
// TypeScript directly), so the answer is the app's answer. Never sends the file anywhere.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { checkEntry, EDITABLE } from '../src/modules/library/editor.ts';
import { readPackFile } from '../src/modules/library/packMarkdown.ts';
import { conditionLookNotes, conditionNoteNotes } from './pack-descriptions.mjs';
import { FORMAT_ONLY_PARTS, USES_PER, formatCounts, formatNotes, rumourWeatherErrors, rumourWeatherLibraryErrors } from './pack-format.mjs';
import { kitDiceFinding } from './pack-additions.mjs';
import { bundlePictures, readPackOrBundle } from './pack-bundle.mjs';
import { itemClashNotes, sameNameOptionNotes, sameNamePairLines } from './pack-library.mjs';
import { manualNotes, manualOptions } from './pack-manual.mjs';
import { fieldGateNotes, optionGateNotes, patchLibraryErrors, patchLibraryNotes, patchPathErrors } from './pack-option-gates.mjs';
import { homelessFields, isOverlay, layoutKeys, sheetFieldNotes, sheetFieldsOf, ungatedHomes } from './pack-sheet-fields.mjs';
import { carriesAsList, carryBonusBandNotes } from './pack-carry-as.mjs';
import { uncommonReferenceNotes } from './pack-uncommon-spells.mjs';
import { saveModifierNotes } from './pack-save-modifiers.mjs';
import { keyedReversibleFinding } from './pack-reversible.mjs';
import { raceOptionNotes } from '../src/modules/library/raceOptions.ts';
import { classReachNotes } from '../src/modules/library/raceReach.ts';
import { weaponModeDrawsNotes } from './pack-weapon-modes.mjs';
import { monsterOverlayLibrary } from './pack-monster-overlay.mjs';
import { requiredIds, todayShapeLibraryNotes } from './pack-today-shapes.mjs';
import { statBlockLayoutFindings } from './pack-stat-block-layout.mjs';
import { ruledFieldFindings } from './pack-ruled-fields.mjs';
import { procedureErrors } from './pack-procedure.mjs';
import { ruleTextErrors } from './pack-rule-text.mjs';
import { rollsErrors } from './pack-rolls.mjs';

// Several files are checked one after another, then together as a library (M5b step 0d.5):
//   npm run pack:check -- packs/a/a.pack.json packs/b/b.pack.json
const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error(
    "Which file? For example: npm run pack:check -- packs/my-pack/my-pack.pack.json (name several files to check them as one library)",
  );
  process.exit(2);
}

/** Checks one file and prints what it found; returns its exit code and, when it reads, the pack's name and entries. */
async function checkOne(path) {
  // A bundle (B14): the pack file inside the .zip is checked as any pack file is.
  const picked = await readPackOrBundle(basename(path), readFileSync(path));
  if (!picked.ok) {
    console.error(`Can't be imported: ${picked.message}`);
    return { code: 1, pack: null };
  }
  const fileText = picked.text;
  const read = readPackFile(picked.name, fileText);
  if (!read.ok) {
    console.error(`Can't be imported: ${read.message}`);
    return { code: 1, pack: null };
  }

  const { meta, counts, problems, entries } = read.pack;
  // Parts the format defines that the app doesn't read yet (07) aren't "unknown": the format checks below cover them.
  const formatOnly =
    FORMAT_ONLY_PARTS.length > 0
      ? new RegExp(`^"(${FORMAT_ONLY_PARTS.join("|")})" isn't a part`)
      : null;
  const warnings = read.pack.warnings.filter((w) => !formatOnly?.test(w));
  console.log(
    `${meta.name}${meta.version ? ` (version ${meta.version})` : ""}, format version ${meta.formatVersion}, ${meta.kind}`,
  );
  console.log(`${entries.length} entries:`);
  for (const [kind, count] of Object.entries(counts))
    console.log(`  ${kind}: ${count}`);

  // The parts 07 defines that the app doesn't read yet (M7 and M7b, "Characters, XP and spells"; the exploration
  // fields of G-07, "Exploration"): checked against the format, read by the app from M5 and M7.
  let file = null;
  try {
    file = JSON.parse(fileText);
  } catch {
    // A Markdown pack has none of the new parts (they're JSON only).
  }
  const newParts = formatCounts(file);
  if (Object.keys(newParts).length > 0) {
    console.log(
      "Format parts the app reads from M5 and M7 (checked here, not imported yet):",
    );
    for (const [part, count] of Object.entries(newParts))
      console.log(`  ${part}: ${count}`);
  }
  // In a run of several files, an uncommon spell's list and place ids are checked together below (us-1): the file's
  // own "check it together" lines would repeat or contradict that, so they're left out, as the carry-bonus notes are.
  // So are a save modifier's raceField lines naming a field no kindred carries (pf-21): the stack may carry it.
  const togetherLater = paths.length > 1 ? new Set([...uncommonReferenceNotes([file]), ...saveModifierNotes([file]).filter((n) => n.includes('no kindred'))]) : new Set();
  const notes = formatNotes(file).filter((n) => !togetherLater.has(n));
  // A Markdown pack's conditions need their brief effect too (07, conditions): checked on what the reader made of them.
  if (file === null) {
    const markdownConditions = entries
      .filter((e) => e.kind === "condition")
      .map((e) => ({ name: e.name, ...e.data }));
    notes.push(...conditionNoteNotes(markdownConditions), ...conditionLookNotes(markdownConditions));
  }
  // Entries' option gates and byOption keys against the pack's own options (of-12; an overlay's base is checked below).
  notes.push(...optionGateNotes(entries));
  // Sheet fields for some classes or kindreds only (cs-3), and a field from a table players can't read.
  // (An overlay's field for a class of the pack it requires isn't wrong alone: only the stack shows the class.)
  notes.push(...fieldGateNotes(entries, false, requiredIds(file).length > 0));
  // An option's `manual` that isn't true or false (ex-7).
  notes.push(...manualNotes(entries));
  // The printed sheet's fields (sr-10): the list's shape and its option gates.
  notes.push(...sheetFieldNotes(file, entries.filter((e) => e.kind === 'option')));
  // A gated printed field homed in a layout field with no gate: the sheet would show it with the option off (of-9).
  notes.push(...ungatedHomes(file, entries));
  // meta.replaces may never name another pack in your library (07); one file alone can't show the library.
  if (Array.isArray(file?.meta?.replaces) && file.meta.replaces.length > 0) {
    notes.push(
      "meta.replaces: this checker reads one file, so it can't see your library; make sure none of these ids belongs to another pack you have (other than the one this replaces).",
    );
  }
  if (notes.length > 0)
    console.log(
      `\nFormat notes (${notes.length}):\n${notes.map((n) => `  - ${n}`).join("\n")}`,
    );

  // Every option the app doesn't apply yet (ex-7): listed, not a fault; the app shows them as "Run by hand".
  const manual = manualOptions(entries);
  if (manual.length > 0)
    console.log(
      `\nRun by hand, the app doesn't apply these yet (${manual.length}):\n${manual.map((m) => `  - ${m}`).join("\n")}`,
    );

  // Armour that carries as another category than it's worn as (al-1): a list, not a fault, so a typo shows.
  const carriesAs = carriesAsList([file]);
  if (carriesAs.length > 0)
    console.log(
      `\nArmour that carries as another category than it's worn as (${carriesAs.length}):\n${carriesAs.map((m) => `  - ${m}`).join("\n")}`,
    );

  // Printed fields with no home (sr-10): no `home`, or one naming nothing. An overlay's home that isn't in its own
  // layout waits for the stack (name its base's file too).
  const fields = sheetFieldsOf(file);
  if (fields.length > 0) {
    const { homeless, waiting } = homelessFields(file, layoutKeys(entries), isOverlay(file));
    console.log(`\nPrinted sheet fields: ${fields.length}, ${homeless.length} with no home.`);
    if (homeless.length > 0) console.log(`Printed fields with no home (${homeless.length}):\n${homeless.map((h) => `  - ${h}`).join('\n')}`);
    if (waiting.length > 0) console.log(`Homes this overlay's base may have (${waiting.length}; check it with its base's file too):\n${waiting.map((h) => `  - ${h}`).join('\n')}`);
  }

  // The stat block layout (pf-13, pf-13a): errors the app can't read (exit 1), warnings for likely typos.
  const layout = statBlockLayoutFindings(file);
  if (layout.errors.length > 0) console.log(`\nStat block layout, to fix (${layout.errors.length}):\n${layout.errors.map((e) => `  - ${e}`).join('\n')}`);
  if (layout.warnings.length > 0) console.log(`\nStat block layout notes (${layout.warnings.length}):\n${layout.warnings.map((w) => `  - ${w}`).join('\n')}`);

  // A bundle's pictures (B14, p2p-27): a missing one is named; the pack still imports, so the exit code stays.
  if (picked.picture) {
    const pictures = bundlePictures(file, picked.picture);
    console.log(`\nBundle: the pack file is ${picked.name}; pictures for ${pictures.found} of ${pictures.maps === 1 ? '1 map' : `${pictures.maps} maps`}.`);
    if (pictures.missing.length > 0) console.log(`Missing pictures (${pictures.missing.length}; the pack still imports, and each can be added by hand):\n${pictures.missing.map((m) => `  - ${m}`).join('\n')}`);
  }

  if (warnings.length > 0) console.log(`\nGood to know (${warnings.length}):\n${warnings.map((w) => `  - ${w}`).join('\n')}`);
  // Shapes the app can't read: a procedure on a place or the rules set (pf-14) and rule text (pf-18). Errors, so the
  // exit code is 1.
  // A patch path that can never be followed (pf-19: a forbidden or empty step) is an error too.
  // So is a rules set's `rolls` with a die the app can't draw or a pass it doesn't know (pf-20).
  // A weather table that is a table of rumours (dec-12 E follow-up): a player rolling the weather would read rumours.
  const formatErrors = [...procedureErrors(file), ...ruleTextErrors(file), ...patchPathErrors(file), ...rollsErrors(file), ...rumourWeatherErrors(file)];
  if (formatErrors.length > 0) console.log(`\nErrors (${formatErrors.length}):\n${formatErrors.map((e) => `  - ${e}`).join('\n')}`);
  if (problems.length > 0) console.log(`\nLeft out (${problems.length}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);

  // The importer is lenient on purpose; the editor checks each entry more strictly before saving it.
  const strict = entries
    .filter((entry) => EDITABLE.includes(entry.kind))
    // A kit line's dice quantity (07, G-57) isn't a mistake, though the editor can't save it yet.
    .map((entry) => ({
      entry,
      found: checkEntry(entry.kind, entry.data).filter(
        (f) =>
          !(entry.kind === "startingKit" && kitDiceFinding(entry.data, f)) &&
          // A spell's reversible keyed by list (a5-1) isn't a mistake either.
          !(entry.kind === "spell" && keyedReversibleFinding(entry.data, f)),
      ),
    }))
    .filter(({ found }) => found.length > 0);
  if (strict.length > 0) {
    console.log(
      `\nThe editor would ask for fixes before saving these (${strict.length}):`,
    );
    for (const { entry, found } of strict.slice(0, 40))
      console.log(`  - ${entry.kind} "${entry.name}": ${found.join(" ")}`);
    if (strict.length > 40) console.log(`  … and ${strict.length - 40} more`);
  }

  // The file's own id and the packs it needs (07 meta.requires: `[{ packId }]` or ids), for the library checks.
  const requires = Array.isArray(file?.meta?.requires)
    ? file.meta.requires
        .map((r) => (typeof r === "string" ? r : r?.packId))
        .filter((r) => typeof r === "string")
    : [];
  return {
    // An error on a ruled field (pf-12d, rp-6, pf-17; printed among the format notes as "Error: …") fails the check too;
    // a warning alone doesn't.
    code: problems.length > 0 || layout.errors.length > 0 || formatErrors.length > 0 || ruledFieldFindings(file).some((f) => f.level === 'error') ? 1 : 0,
    pack: {
      name: meta.name,
      entries,
      file,
      id: typeof file?.meta?.id === "string" ? file.meta.id : null,
      requires,
    },
  };
}

const results = [];
for (const path of paths) {
  if (paths.length > 1) console.log(`\n=== ${path}`);
  results.push(await checkOne(path));
}
const packs = results.map((r) => r.pack).filter((p) => p !== null);
/** Errors only the packs together show (pf-19's refused sets); any makes the exit code 1. */
const libraryErrors = [];
// Weapon modes' draws.itemId against the items of every file given (G-211): notes, the exit code stays.
const drawNotes = weaponModeDrawsNotes(packs);
if (drawNotes.length > 0) console.log(`\nWeapon mode notes (${drawNotes.length}):\n${drawNotes.map((n) => `  - ${n}`).join('\n')}`);
if (packs.length > 1) {
  // Same-named options across packs without a ruleKey (07, ruleKey; ruled 2026-11-02). A warning: the exit code stays.
  // A class's raceMaxLevels against every pack's races (pg-2): notes the files alone couldn't show (a race in another
  // file, a clash across packs). Warnings too.
  const alone = new Set(packs.flatMap((p) => classReachNotes(p.entries)));
  const all = packs.flatMap((p) => p.entries);
  // A race's byOption naming an option (cs-5): checked alone an overlay names its base's, so only here is a missing one a note.
  const unknownOptions = raceOptionNotes(all, true).filter((n) =>
    n.includes("isn't in any of these packs"),
  );
  // Option gates against every pack's options (of-12), and overlay patches against every pack's entries (of-13).
  const gatesAlone = new Set(packs.flatMap((p) => optionGateNotes(p.entries)));
  const gates = optionGateNotes(all, true).filter((n) => !gatesAlone.has(n));
  const fieldGatesAlone = new Set(packs.flatMap((p) => fieldGateNotes(p.entries)));
  const fieldGates = fieldGateNotes(all, true).filter((n) => !fieldGatesAlone.has(n) && !n.includes("can't read"));
  // Sheet fields across the stack (sr-10): an overlay's homes against every pack's layouts, its gates against every
  // pack's options. Only what checking alone couldn't say.
  const keys = layoutKeys(all);
  const options = all.filter((e) => e.kind === 'option');
  const sheetAlone = new Set(packs.flatMap((p) => sheetFieldNotes(p.file, p.entries.filter((e) => e.kind === 'option'))));
  const sheet = [
    ...packs.flatMap((p) => sheetFieldNotes(p.file, options, true)).filter((n) => !sheetAlone.has(n)),
    ...packs.flatMap((p) => ungatedHomes(p.file, all, packs.map((q) => q.file))).filter((n) => !packs.some((q) => ungatedHomes(q.file, q.entries).includes(n))),
    ...packs.filter((p) => isOverlay(p.file)).flatMap((p) => homelessFields(p.file, keys).homeless.filter((h) => h.includes(': home "')).map((h) => `${p.name}: printed field with no home: ${h}`)),
  ];
  // A carry bonus in a banded stack (cb-1) and an uncommon spell's list or place (us-1), as only the stack shows them.
  const bandsAlone = new Set(packs.flatMap((p) => carryBonusBandNotes([p.file])));
  const bands = carryBonusBandNotes(packs.map((p) => p.file)).filter((n) => !bandsAlone.has(n));
  const uncommon = uncommonReferenceNotes(packs.map((p) => p.file), true);
  // A save modifier's raceField no kindred in the stack carries (pf-21).
  const raceFields = saveModifierNotes(packs.map((p) => p.file), true);
  const library = [...sameNameOptionNotes(packs), ...itemClashNotes(packs), ...classReachNotes(all, true).filter((n) => !alone.has(n)), ...unknownOptions, ...gates, ...fieldGates, ...patchLibraryNotes(packs), ...sheet, ...bands, ...uncommon, ...raceFields];
  console.log(`\n=== The ${packs.length} packs together`);
  console.log(
    library.length > 0
      ? `Library notes (${library.length}):\n${library.map((n) => `  - ${n}`).join("\n")}`
      : "No library notes.",
  );
  // A patch's set that a matched entry refuses (pf-19: a list index, or a value in the way): errors, so the exit code is 1.
  libraryErrors.push(...patchLibraryErrors(packs));
  // A weather table that is another pack's table of rumours (the review of #835): the database reads across packs.
  libraryErrors.push(...rumourWeatherLibraryErrors(packs.map((p) => p.file)));
  if (libraryErrors.length > 0) console.log(`Errors (${libraryErrors.length}):\n${libraryErrors.map((e) => `  - ${e}`).join('\n')}`);
  // Same-named entries of one kind with different ids (sn-1): information, so keeping both is a choice made on purpose.
  // In a campaign each shows its pack ("From <pack>", "<name> (from <pack>)"). Never a warning: the exit code stays.
  const pairs = sameNamePairLines(packs);
  if (pairs.length > 0) {
    console.log(
      `Same-named entries, for information (${pairs.length}; a campaign using these packs shows each with its pack's short name):\n${pairs.map((n) => `  - ${n}`).join("\n")}`,
    );
  }
  // Armour the stack's rules sets let the checker compare (al-1): only what checking each file alone didn't list.
  const carriesAlone = new Set(packs.flatMap((p) => carriesAsList([p.file])));
  const carriesAs = carriesAsList(packs.map((p) => p.file)).filter((l) => !carriesAlone.has(l));
  if (carriesAs.length > 0)
    console.log(
      `Armour that carries as another category than it's worn as, seen together (${carriesAs.length}):\n${carriesAs.map((m) => `  - ${m}`).join("\n")}`,
    );
}
if (packs.length > 1) {
  // Today's shapes that only the stack shows (sizes, conjured stat blocks, a tableRef's table) and each overlay link
  // against the stat blocks of the pack it names (fi-5). Notes: the exit code stays.
  const overlays = monsterOverlayLibrary(packs);
  const shapes = [...todayShapeLibraryNotes(packs, USES_PER), ...overlays.notes];
  const bullets = (lines) => lines.map((n) => `  - ${n}`).join('\n');
  if (overlays.summary.length > 0) console.log(`\nOverlay links:\n${bullets(overlays.summary)}`);
  if (shapes.length > 0) console.log(`Shape notes across the packs (${shapes.length}):\n${bullets(shapes)}`);
}
process.exit(Math.max(...results.map((r) => r.code), libraryErrors.length > 0 ? 1 : 0));
