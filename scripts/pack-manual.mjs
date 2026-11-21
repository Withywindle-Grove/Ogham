// npm run pack:check's list of options run by hand (ex-7, ruled 2026-11-03,
// docs/design/rulings/m5b-pack-review-area-2-2026-11-03.md): an option with `manual: true` is one the app doesn't
// apply yet; the app shows it as "Run by hand" and saves the choice. The checker lists every one, so the pack session
// sees what is still by hand, and notes a `manual` that isn't true or false.

const options = (entries) => entries.filter((entry) => entry.kind === 'option');

/** Every option marked `manual: true`, as "Name (id)", in the pack's order. */
export function manualOptions(entries) {
  return options(entries)
    .filter((entry) => entry.data?.manual === true)
    .map((entry) => `${entry.name} (${entry.packEntryId})`);
}

/** A note for each option whose `manual` is there but isn't true or false (the app reads only `true`). */
export function manualNotes(entries) {
  return options(entries)
    .filter((entry) => entry.data && 'manual' in entry.data && typeof entry.data.manual !== 'boolean')
    .map((entry) => `options: "${entry.packEntryId}": manual should be true or false; the app reads only true (run by hand), so this one counts as applied.`);
}
