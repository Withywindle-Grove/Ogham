---
status: absorbed
milestone: m7, m7b
absorbed-into: docs/05-features.md, docs/06-screens-and-design.md, docs/07-content-packs.md, docs/08-roadmap.md (through m7-rulings.md); the split (M7 and M7b) in docs/08-roadmap.md (M7b row) and docs/09-decisions-log.md (2026-10-28, M7 split); confirmed in the rulings catch-up 8 (2026-11-18)
supersedes: —
---

# M7 design plan (v1, for approval)

Status: proposal · 2026-10-28 · design agent

**M7 scope (08):** XP awards and thresholds, bonus XP, retainer XP, level-up auto-fill, spell book and memorised spells, the starting spell-book choice, hidden purses and places, company ledgers with rollback, Split Loot, the Treasury screen, the charter, factor hooks and the scroll-type warning, ability-use dots.
**Changed on 2026-10-28:** "Lose a level" moves to R2. Spell books are confirmed for M7 (G-17). Restore a character from a download is added (with export). The trait-lists format ruling is due at M7 planning (G-04). The per-session level cap (G-18) is already specified in 05 ("Cap / Keep").
**From the roadmap doc:** revisit character creation (spells, shopping as Add item, guided proficiency and languages), export, and the Archivist's recap (M5 ruling).

**What exists already:** 05 specifies most of M7's behaviour. The R1 design boards include Level up, Spell book, Prayer spells, Split loot, Treasury, Charter and Vote. So M7 design is mostly a **refresh** against later rulings (the components inventory, the player-screen redesign, words and voice, M6) plus a few real gaps. It isn't a blank page.

## Design items

| # | Item | Kind of work | Known issues to settle |
|---|---|---|---|
| M7-1 | **Award XP** (split preview, bonus XP, retainer XP and its penalty, Treasure XP from Split Loot, "XP waiting" from M6-11 fights and foes outwitted, the one-level cap) | Refresh plus one gap | Where M6's "XP waiting" lands; how often the GM awards (per fight, session or expedition) |
| M7-2 | **Level up** ("Ready to level", a downtime activity, auto-fill preview, Use/Keep, manual mode, the HP roll, the title from `levelTitles`) | Refresh | What new abilities and spells look like in the preview; trait lists (G-04 format ruling) |
| M7-3 | **Spells** (book and list casters, preparing, casting with Spent, reversing, scrolls with the scroll-type warning, timed effects from X-3, copy chance as pack text) | Refresh plus a conflict | ⚑ The SP ruling's slot header says "1 left", but Francis later ruled "no N left count, use Spent". Prepared spells close at hand (player-screen redesign) |
| M7-4 | **Character creation revisit** (starting spell book, shopping as Add item, guided proficiencies and languages) | Gap | The order of steps, and the tap budget against the M4b 3-minute gate |
| M7-5 | **Ability-use dots and factor hooks** (uses per day, refresh on rest) | Gap | Where the dots live on the new player screen; what "rest" means in each mode |
| M7-6 | **Purses, places and ledgers** (hidden purses, carried and stored, named places, company ledgers with rollback) | Refresh | Hidden means hidden on every screen |
| M7-7 | **Split Loot and Treasury** (the charter split, previewing loads, Due and recurring costs) | Refresh | Coins and gems arriving from the M6 loot strip |
| M7-8 | **Charter** (founding version, share distribution, house rules) | Refresh | ⚑ Changes need votes, which arrive in M8. M7 builds the founding version only? |
| M7-9 | **Export and recap** (Export adventure, the Archivist's recap, export a character, restore a character) | Spec exists (M5 ruling) | Restore lands as a waiting character for GM approval |

## Order of design sessions (proposal)

1. M7-1 and M7-2 together (the XP to level-up flow)
2. M7-3 spells (the biggest, and has the conflict)
3. M7-4 creation revisit and M7-5 dots
4. M7-6, M7-7 and M7-8 (the money group)
5. M7-9 (light: mostly a confirm)

Each session: proposals with mockups in light and dark where a screen is involved, the uiux self-review run and stated, rulings, then 09 lines.

## Risk: M7 is the biggest milestone left

⚑ **Split option:** M7 covers XP, level-up, spells, creation and dots; a new **M7b** covers money (purses, places, ledgers, Split Loot, Treasury, the charter, export and recap). M7b would sit before M8, which is fitting since M8's titles and votes act on the charter and treasury. Cost: one more gate, about a week on the calendar. Gain: two gates that can each be tested properly, and one less overloaded milestone.
