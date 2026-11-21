---
status: pending
milestone: after the M5b gate (small; `docs/plans/after-m5b-gate.md`)
absorbed-into: pending, with the pull request that builds it (05 Rules for this campaign; 06 the Rules tab and the players' Setting rules page; 03 who reads a campaign's choices); docs/09-decisions-log.md (2026-11-10)
supersedes: —
---

# A campaign's set-up, readable and shareable (2026-11-10)

From the M5b gate rewalk's pause (finding F36, `design/notes/gate-m5b-rewalk-2026-11-10.md`). The Tester, playing as a player in a fresh test campaign, could not tell that the option lifting race limits was on: a campaign's choices are on the GM's Rules tab only, and a player's Setting rules page lists what the packs hold, not what was chosen. Francis: "we need a way to quickly export the rules for a campaign so that Tester can read them." Design proposed two things and he ruled both. Ids `cs-set-1`, `cs-set-2`.

- **cs-set-1 Copy the set-up.** The GM's Rules tab has **Copy the set-up**: one tap puts a plain-text summary on the clipboard, with a toast saying so. In order: the campaign's name; each attached pack with its version; the start level and the app's own settings; then every optional rule, **the ones that differ from the book first**, each as "<rule>: <choice>" in the pack's words. For pasting to a tester, a player or a bug report. It copies nothing a player may not see: GM-only tables and notes are not part of it.
- **cs-set-2 Players see the campaign's choices, read-only.** A player's rules page shows which optional rules are on and how each is set, and the start level, with no controls. They play under them. What stays the GM's: the GM-only kinds, as today.

**Not ruled here:** the full campaign export (M10's JSON); a "Copy" for players too (it follows from cs-set-2 if wanted).

09: 2026-11-10 — [ui] The GM's Rules tab gets Copy the set-up: a plain-text summary of the campaign's packs and versions, start level, settings and every optional rule's choice, the changed ones first; and players see the campaign's choices read-only on their rules page (cs-set-1, cs-set-2; built after the M5b gate) — A tester playing as a player couldn't tell that race limits were lifted; players play under these rules and should be able to read them — `design/rulings/m5b-rewalk-campaign-setup-2026-11-10.md`
