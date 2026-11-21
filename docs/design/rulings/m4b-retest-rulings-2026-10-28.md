---
status: absorbed
milestone: m4b
absorbed-into: docs/05-features.md and docs/06-screens-and-design.md (the re-test fixes, 2026-10-28), docs/09-decisions-log.md (2026-10-28); the deferred items are now in the specs too (checked 2026-11-18): the twelve M7 items N2, N4, N5, N6/N14, N8, N9, N10, N11, N13, N15, N16, N29 and the creation half of N23 in 05 (Characters, guided creation) and 06 (guided creation, Prepare sheet); the M6 items N26 and N27 in 05 (At hand; the death panel)
supersedes: m4b-retest-design-rulings.md (Pack groups only); the 2026-10-22 Later button ruling
---

# Design rulings on the M4b re-test (2026-10-28), approved by Francis — saved by Claude Code
Fix NOW (one batch before M5): N18 stash containers only; N17 one ⋯ menu everywhere in a campaign (screen actions above divider, campaign items below); N19 At hand open + rest collapsed when At hand has items, else Gear open; N20 Character fields collapsible section in Rules for this campaign, only when rules name fields; N21 setting rules line "Press and hold a row to move it."; N22 AC shows setting's no-armour value when nothing worn; N23 pop-ups use long names + setting's short description, saves as words (compact saves row on Player screen keeps short names); N25 damage-pad steps clamp at the minimum (−5 at 2 → 1), never greyed; N24 AC at top fixed, and with no max HP show the number + quiet "Set max" link (not a bar); N1 sign-in not centred, title+email above keyboard; N3 INT label; N7 "Alignment" as a language; N12 scores twice on check step; N28 iPad scroll chosen race/class detail into view; N30 Race "—" / Title "Medium" on new character.
M7: N2 N4 N5 N6/N14 N8 N9 N10 N11 N13 N15 N16 N29, creation half of N23. M6: N26 (weapon "Sword · 1d8+1 · Attack +2", tap for breakdown), N27 (HP floor follows death rule).
09 lines (2026-10-28), add with the batch:
- [sheet] Guided creation has no Later button; Back on the first step leaves (replaces 2026-10-22) — one way out, no dead end
- [sheet] Mandatory creation fields must be filled before Next; Next explains what's missing — no half-made characters, no disabled button
- [sheet] Creation asks for HP whenever the setting's sheet includes it (die and modifier, or the setting's rule) — HP belongs to the sheet spec
- [sheet] Scores step enforces the setting's trade and minimum rules; overrides only on the final check step with a reason for the GM — rules can't be broken by accident
- [items] Party stash: containers only, no Worn/Carried/Gear/Other groups — nothing in the stash is worn or carried
- [sheet] Alignment choices show the pack's one-line explanation — choosing with understanding
- [sheet] Secondary skill and literacy explained from the setting, hidden when it has none — no unexplained fields
- [sheet] Languages: the setting's list plus Other… — quick and still open
- [ui] One ⋯ menu everywhere in a campaign: screen actions above a divider, campaign items below — the same menu wherever you are
- [items] Pack groups: At hand open and the rest collapsed when At hand has items, else Gear open (replaces 2026-10-26) — the useful group first
- [ui] Character fields live as a collapsible section in Rules for this campaign, only when the rules name fields — less clutter
- [words] Setting rules list explains reordering in one line — the gesture isn't discoverable otherwise
- [sheet] AC shows the setting's unarmoured value when nothing is worn — never blank
- [words] Explanations use long names and the setting's short description; saves as words; the compact saves row keeps short names — clear where people read, compact where they glance
- [sheet] At hand weapons show damage with modifier and attack modifier, tap for breakdown (M6) — the numbers players ask for mid-fight
- [fight] HP floor follows the setting's death rule; without one, negative HP is allowed and the dialog opens at 0 — rules-driven, never silently wrong
- [ui] Damage-pad steps clamp at the minimum instead of greying out (−5 at 2 → 1) — keeps "never a disabled button"; the result explains itself
Order: fix batch → KB prompt (B–E) → M7 docs prompt → "docs pushed". Packs: setting-1 0.5.8, setting-2 0.2.10 (blurbs in meta.proposedExtensions).
Also: review fixes (1 medium + 7 small) + health fix-now (split undo fn, advisor list, character_play db test) before M5, after tag.
