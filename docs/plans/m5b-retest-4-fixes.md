# Plan: m5b-retest-4-fixes (creation retest 4, 2026-11-09)

Francis's creation retest 4 on an iPad (2026-11-09, 8:45–9:15), relayed by Design (`docs/design/notes/gate-m5b-walk-2026-11-05.md` on `design-gate-m5b-walk`, entry 0w). One pull request, branched from `m5b-sheet-revised` (#567), because T8 rests on the revised full sheet. #567 and #569 (`m5b-at-hand`) merge first; `origin/main` is merged in before the push if either has landed. While #569 is open its files are left alone: `ItemRow.tsx`, `AtHandSheets.tsx`, `weaponModes.ts`.

T9 and T6's pack shape were added by the coordinator during the build (the Pack Creator's G-212 and G-213, ruled 2026-11-09).

No migration is expected. If one turns out to be needed, the build stops and reports first.

## Items, as written

### Technical

| Item | As written | Estimate (hours) |
|---|---|---|
| **T1** | Rules library: after a pack update, scroll to the result message, or show it as a toast where the eye is. | 0.5 |
| **T2** | The kit roll sheet, and any sheet, on an iPad: the last row and the foot are cut off at the bottom. Add safe-area padding in the shared Sheet part, the same family as #567's Players column fix (env(safe-area-inset-bottom)). | 1 |
| **T3** | The kit roll sheet: a row rolled twice shows nothing. R3-8 applies: show "Picked ×2", with − to put one back. | 1.5 |
| **T4** | Table sheets on a tablet take the available width, by one rule for every table sheet: trinkets, backgrounds, names, any describing table. Nothing should wrap as if the screen were 375 px wide on a 1024 px screen. | 1 |
| **T5** | Help me choose on the Draconic bloodline trait-list step shows the Secondary skill's text. Key help by step and list id. A trait list without pack help gets the generic trait-list help. | 1 |
| **T6** | Sources show codes ("i3 p. 8"). Always show the pack's full book name; the app never prints a bare code. Read the pack's sources map: `meta.sourceTitles: { "<code>": "<the book's own title>" }` (G-212). Match the longest code a `source` starts with and print "<title>, <rest>", the page tidied ("p96" → "p. 96"); the key "" is the pack's own book, for a bare "p. 12"; a source no code matches is shown as written. Add the field to the pack types, the pack checker and docs/07. | 2.5 |
| **T7** | A trait entry on a one-column step opens beside the list. It should be a sheet; only Race and Class keep the side-by-side pair. | 0.5 |
| **T8** | A character whose class uses the pack's sheet layout path renders bare on the sheet: scores as a text line, "Weapon proficiencies —", no skills. After #567, the pack-layout path must fill the same rows (skills, abilities, traits) from the class, never a bare fallback. Use an invented class with a pack sheet layout in the tests. | 2.5 |
| **T9** | `traitLists[].entries[].abilities: [{ name, note, uses?, spellId? }]` (G-213), the same shape as the classes' `abilities`. When the entry is picked or rolled, its abilities join the sheet's Abilities rows; `uses` is `{ count, per }`, for the dots; `spellId` links the spell the power casts, and may resolve into another attached pack's spells. An entry's ability with no uses shows no dots; a uses-bearing ability with the same name stays on the class or race. Add it to the pack types, the checker and docs/07, with tests on invented data. | 3 |

### Systemic, each with a guard test

| Item | As written | Estimate (hours) |
|---|---|---|
| **S1** | Every roll in the app has its Roll row and die glyph. The pack-driven steps were missed: trait lists, kindred and class tables, Details. The guard test fails on "Roll" text outside a Roll row. | 2 |
| **S2** | Every step's Help is its own. The guard test fails when two steps share help text, unless the pack says so. | 1.5 |

### Gallery, docs, report

| Item | As written | Estimate (hours) |
|---|---|---|
| Gallery | Add or adjust specimens for T2, T3, T4 and S1. Delete any baseline whose picture changes. Commit no new baselines; CI draws them and Design approves. | 1 |
| Docs and report | 06 Code column, 07 (G-212, G-213), `docs/status/2026-11-09-m5b-retest-4-fixes.md`, `docs/testing/m5b-retest-4-fixes.md`. | 1 |

**Total: 19 hours.**

## Approach

- **T1.** The library's result messages (added, updated, deleted, exported) show as a toast (`NoticeToast`, A11) where the eye is, not as a line at the top of a list the GM has scrolled down. The campaign's Setting rules screen does the same for its pack update.
- **T2.** `Dialog.css`: the sheet on a tablet keeps clear of the home indicator (`env(safe-area-inset-bottom)` in its padding and in its height limit); an anchored sheet's height is capped from where it opens to the bottom, and it is placed again when its content grows.
- **T3.** The Roll sequence's roll rows take R3-8's count: a row rolled twice reads "Picked ×2" with a − square that puts one back.
- **T4.** A **Table** variant of the Dialog (`table`): on a tablet the card takes the screen's width up to the page's 1024 px; used by every table sheet (`TableSheet`, `NameTableSheet`, the Roll sequence).
- **T5.** `traitHelp` reads the list's own help, else the app's generic trait-list help naming the list; the step's `creationGuide.traits.help` no longer stands in for every list.
- **T6.** A pure reader (`sourceTitles.ts`) applied once where the campaign's setting is resolved, so every screen that prints a `source` prints the title; the pack-and-page lines drop the short name when the source already starts with a title.
- **T7.** `TraitListStep` opens its entries as a sheet at every width.
- **T8.** From the investigation (see Departures).
- **T9.** The trait-list reader keeps an entry's `abilities`; the sheet's Abilities rows add those of the picked entries.
- **S1.** The trait-list step's roll line moves into the step's Roll row; Details' rows and fields say their dice in Roll rows. A shared guard (`rollRowGuard.ts`) finds "Roll" words outside a Roll row (or a button with its die), run over every pack-driven step.
- **S2.** A guard over every creation step's help for one invented setting with several trait lists: no two steps share help unless the pack gave them the same words.

## ⚑

(Collected in the status report; none decided here.)

## Departures

1. **T1** reaches the campaign's Setting rules screen too: its results (a pack updated, attached, an entry saved) are toasts as well, the same A11 rule; the library's in-pack "Saved." line while browsing stays.
2. **T2** has no gallery specimen: the gallery's browser has no home indicator (the safe area is 0), so a picture can't show it. Checked by a stylesheet test and manual check 2.
3. **T5**: the step's `creationGuide.traits.help` no longer stands in for any list (it spoke of one list); the app's old trait-help paragraph (`APP_HELP.traits`) is gone, replaced by `genericTraitHelp`, which names the list. No real pack loses help: every list that had the guide's text has its own `help`.
4. **T6** follows the coordinator's G-212 rule, which replaced the brief's fallback: a source that no code matches is shown as written (not the pack's title). The titles are applied once, where the campaign's setting is read (`settingFrom`), so every screen in a campaign prints them. **Not titled yet:** the Rules library's own browser outside a campaign (no campaign pack there), and a carried item's sheet (`ItemSheet`, which reads the line's own copy; its short name comes through `ItemRow.tsx`, #569's file, left alone).
5. **T8 was not reproduced.** With both real packs stacked, a zine class renders tiles, skills and abilities. The three symptoms together fit "the class isn't found for the character" (the bare line for a character with no class) or "the campaign has no score fields". Both are now guarded: the Score tiles come from the creation record when no campaign field holds a score, and a class the setting rules don't have is said in the identity line instead of the bare line. The real character is needed to confirm (⚑ 1).
6. **T9** was added by the coordinator during the build (G-213), with the dots on the Player screen's Traits rows.
7. **S1** reworded two lines that said "Roll" outside a Roll row: Gear's coin caption before a value is typed ("Type what you rolled.", the Roll row above already says what to roll) and Body's typed box hint ("2d6 at the table"). A trait list whose notes name the die gives those notes to the Roll row, and the line falls back to the guide's or the app's words.
8. **S2**'s guard checks the help functions as the screens call them (`stepGuide` with `APP_HELP`, `traitHelp`), not a walk through the whole app.
9. **Design's answers on #570 (2026-11-09, one round):**
   - T8: the bare character was a zine class on the live app, likely made before the attached pack's class carried its layout or skills. The guards stay. A new test makes a character from an attached pack, on an older version of it (a creation record with no scores, layout or skills), in a campaign with the base layout, the overlay's, and the weapon rule on. It renders the revised rows from the current class: identity, Score and Save tiles, Skills, Abilities, no Weapon proficiencies line, and the overlay's field for another class hidden. The test passed on the code as it stands, so it showed nothing more to fix: on this path the sheet already reads everything from the current pack. The live symptoms match the class not being found, which the identity guard now names.
   - "Class not in this campaign’s setting rules" is approved. So is the generic trait-list help, which already uses the list's own die.
   - A trait list's line is its own, never another list's or the step's. The roll line is Design's "Roll <die> at the table, then tap the row, or pick one." with the list's own die, in the Roll row. A list without notes has no line beyond its Roll row; one with no die and no notes reads "Pick one." (that case had no wording from Design). The step shell draws no empty line.
