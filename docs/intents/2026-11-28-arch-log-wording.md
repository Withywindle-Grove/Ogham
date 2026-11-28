# Intent: log wording lives with its module (the trial)

Author: architecture pass 1 (loop step 7), from Francis's rulings · Date: 2026-11-28 · Status: accepted (arch1-5, Francis: "B"; arch1-6, Francis: "A")

## Problem
One function in core, `describeEntry` (`src/core/events.ts`, line 603), writes every log sentence: 205 cases in a file of 1,985 lines. Core cannot import a module (hard rule 6), so core re-types what modules know. Every new command edits this one file: 21 commits in four weeks. Only 28 of the sentences have a test of their words.

## Outcome
A module gives the registry the sentence for each of its commands. Core loads and groups the log and asks the registry for the sentence. From this spec's merge, a new command writes its sentence in its own module and does not touch core's file.

Every sentence comes out word for word the same. Nothing a player or GM sees changes. No stored data changes.

## Touches
- `src/core/events.ts`: `describeEntry` asks the registry first and keeps its own cases as the fallback.
- `src/core/commands.ts`: the registry's new slot for a command's sentence.
- `src/modules/requests/`: its 7 sentences, moved.
- `docs/12-coding-standards.md` and the builder's brief: one line, "a new command's log sentence goes in its module".
- No migration, no permissions, no events, no command added.

## Constraints
- Mockup: none: data and logic only.
- Hard rule 6: core never imports a module. The registry is the only road.
- The safety net comes first and is never edited by a later ticket (arch1-7).
- The December tickets keep working while this runs: the fallback stays, so a command with no registered sentence reads as it does today.

## Tests
- New, first: a test that records one real sentence for each of the 205 cases. This is the safety net.
- Kept unchanged: the four `src/core/events*.test.ts` files and every screen test that reads a log line.
- Moved, not deleted: a requests sentence's own test goes beside the requests module.

## Tickets (3, the trial)
1. The safety net: one recorded sentence per case. No code under test changes.
2. The registry's slot, with core's path as the fallback. No sentence moves.
3. Requests: its 7 sentences move to the module. The standards line and the brief line.

## Out of scope (the second spec, after 5 December or on Francis's word)
- The other modules: characters, inventory, expedition (about 70 sentences, perhaps two tickets), library, messages, fight.
- The copies the report names: the held key's format and the count words, each to its one home.
- Removing the fallback.

## Ruling
`docs/design/rulings/arch-pass-1-2026-11-28.md`, arch1-5 to arch1-7.
