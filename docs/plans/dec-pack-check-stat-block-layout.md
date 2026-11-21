# dec-pack-check-layout: `pack:check` reads a pack's stat block layout

Ruled: pf-13 (`docs/design/rulings/dec-stat-block-and-type-2026-11-12.md`) and pf-13a
(`docs/design/rulings/dec-night-and-morning-2026-11-13.md`). Size 1 to 2 turns; no migration.
Mockup: none: data and logic only (a script and its tests; nothing a person sees in the app).

This is also **the first piece built by a cloud builder** (Francis, 2026-11-13: "Run it"; a one-piece trial). The
builder works from this file alone, cannot ask questions, and returns a branch and a pull request.

## What

`npm run pack:check -- <file>` says nothing today about `statBlockLayout`. It should, in `scripts/check-pack.mjs`
or a new `scripts/pack-stat-block-layout.mjs` that it calls:

| Case | Result |
|---|---|
| No layout anywhere | Fine and silent. |
| `statBlockLayout` at the pack's top level, not inside `meta` | **Error**: the app ignores it there; say "move it into meta". |
| `meta.statBlockLayout` is not an object | Error. |
| `descriptor` or `hide` present and not a list of strings | Error, naming the key. |
| `groups` present and not three levels deep (a list of groups, each a list of lines, each a list of field names as strings) | Error, saying which group or line. |
| A field name that no creature in the pack carries | **Warning** (a likely typo), naming it. `hp` is reserved (hit points with their average) and never warned about. |
| The same field placed twice, or both placed and hidden | Warning. |
| A key in the layout other than `descriptor`, `groups`, `hide` | Warning, naming it. |

Words follow the checker's existing lines (read a few before writing). A valid pack without a layout reports
exactly what it reports today.

## Must not touch

- `docs/07-content-packs.md` (its paragraph is corrected with the stat block's own pull request).
- `scripts/pack-additions.mjs`, `src/modules/library/statBlockLayout.ts` (in an unmerged pull request), anything
  under `src/`, `supabase/`, `packs/`, `.env*`, any workflow file.
- Existing tests: add, never edit.

## Tests (purpose first), in a new `scripts/*.test.mjs` with invented fixtures

- A pack with no layout reports as before.
- A layout at the top level is an error that says to move it into `meta`.
- A valid three-level layout passes silently.
- Two-level `groups` (a list of lists of strings) is an error that names the group.
- A non-string in `descriptor`, `hide` or a line is an error.
- A field no creature has is a warning; `hp` is not.
- A field placed twice, and an unknown key, are warnings.

Invented names only (the repo's rule): no real game, book or creature names, no numbers from any book.

## Done when

- The new tests pass and `npm run check` passes.
- One push, one pull request to `main` titled "pack:check reads meta.statBlockLayout (pf-13, pf-13a)", with a
  status file `docs/status/2026-11-13-dec-pack-check-layout.md` (what was built, what was not tested, anything
  unclear).
- If anything here is unclear or contradicts the code, stop: write the question in the status file and the pull
  request's description, and build only what is certain. Don't guess.

The coordinating Builder then runs the checker on the private packs on the PC (the cloud builder has none) and its
local reviewer reviews the pull request.

## ⚑

None.

## Departures

None. Two readings of the table, stated here so the review can overrule them: an error makes `pack:check` exit 1 (as "Left out" does) and a warning leaves the exit code as it was; `descriptor` placing a field counts as placing it, so a field in both the descriptor and a group is "placed twice". The importer's own "isn't a part" line for a top-level layout still prints under "Good to know", beside the new error.

Brought up to main, 2026-11-14 (refresh; no behaviour changed): pf-13b, ruled after this plan (exact names, case included; `hp` reserved in lower case only), is what the check already does. 07's layout paragraph, corrected meanwhile by #713, is untouched here as this plan says. The check's errors keep their own heading rather than main's newer single "Errors (n):" section; that's the review's question. Details in the status file.
