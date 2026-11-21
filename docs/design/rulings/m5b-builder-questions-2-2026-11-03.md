---
status: absorbed
milestone: m5b
absorbed-into: docs/07-content-packs.md (race `byOption`), docs/09-decisions-log.md (2026-11-03), docs/plans/m5b-0c-creation-survey.md, docs/plans/m5b-1-travel.md, docs/plans/m5b-0c-creation-options.md (Departures and O14)
supersedes: cs-5's closed list of race `byOption` fields (bq2-1: any field, as of-3); cs-3's "Hard: Next explains" wording (bq2-2)
---

# Open questions from the builders, second batch (design ruling, 2026-11-03)

From #365 (creation survey PR 1) and #364 (the location view's phone sheet). Ruled one at a time with Francis. Ids `bq2-1` … `bq2-4`.

- **bq2-1 (A) A race's `byOption` may change any of its fields**, `abilityModifiers` included (classic-advanced's Human with lifted limits), read by the shared option reader (of-3). 07 line; about an hour to build.
- **bq2-2 (A) A hard limit refuses at Pick.** Pick moves on at once (ct-1), so a hard-limited row's Pick shows the explaining toast ("<class> isn't open to <kindred>…") and stays on the step; never a disabled button.
- **bq2-3 (A) The location view's phone sheet, four readings confirmed** (#364, m5b-1 Departures (a)–(e)): the phone card reuses What we know's card and the sheet is the existing wide pop-up (build once); with no place set the GM reaches the checks list after Set place (due checks still prompt in the strip); a blank Where now? keeps "somewhere unnamed" in its toast and log line (only the card's empty state was ruled); dungeon mode keeps the place on the page on a phone (06 asks for the sheet in the wilderness only).
- **bq2-4 (technical) The creation-options table:** row O14 (`no-alignment-languages`) struck, the option dropped by rc-5; the table stays the source of the creation tests, the options audit the record of what each option does.
