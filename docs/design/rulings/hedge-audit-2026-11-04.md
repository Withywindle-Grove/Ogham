---
status: absorbed
milestone: r1
absorbed-into: docs/08-roadmap.md (M6, M9, M8b, R2), docs/09-decisions-log.md (2026-11-04), docs/10-open-questions.md (dates only)
supersedes: —
---

# Hedge audit: where "a first version now, the real one later" costs more than it saves (design ruling, 2026-11-04)

Francis (2026-11-04 evening): "we are cooking well ahead of schedule … why build a basic version instead of the complete correct version the first time" — after ruling M9 complete (09, 2026-11-04). The designer read M6–M9 in 08, the "R1 keeps / R2" lines in 05 and the R2 gaps in 11, and sorted the hedges: A, rework if kept (ruled one at a time here); B, fine with a build constraint written into the plan; C, genuinely cheap, kept. Ids `ha-1` … .

- **ha-1 (synthesis) The prep-space paper test comes before M6-10 is built.** M6-10 ("GM tables, first version") and M8b's GM prep space would otherwise design the table card, the library and "apply to the scene" twice. A paper test with Francis, scope **tables, encounter tables, treasure and planned encounters** (the parts M6-10 touches; hex maps, regions and dungeon areas stay for M8b's full session), held after the M5b gate and the hirelings session, before M6 starts (M6 is on hold anyway). Its ruling shapes M6-10, which becomes **the prep space's first slice**. No build moves. Not taken: leaving the order (two table UIs, the GM learns both).

- **ha-2 (synthesis) M6's engine reads three hooks from the start.** *Acts last* from a weapon quality (`slow`) or `initiative: "last"` on a stat block, read when the round order is made; a *per-actor initiative modifier* added to the roll when the setting's initiative is individual; a *per-round heal* as a status the round advance applies (like M6-5's per-round effects). Display: the existing order strip, roll line and status chips. G-12, G-13 and the heal half of G-16 move from R2 to M6; "rises again unless killed a certain way" stays R2 (a death-panel rule, not an engine hook). One 07 line, three tests in M6's plan. Why: fi-1 made slow weapons always on in classic-advanced; re-opening the ordering code later costs more than three reads now.
- **ha-3 (synthesis) Animals and vehicles are designed and built in M9.** An animal is a hireling kind (fodder as wages, handling as loyalty, HP, a load limit); a vehicle its own kind (capacity, who draws it, speed); both carriers in the Pack's Other section. Built in M9's slices (mounts and pack animals with the retainers slice; carts when a party buys one); boats stay with water travel (R2) unless a setting's book makes them routine. Travel (M8b) keeps "by hand" speed until then, no redesign. Barding (G-122) comes with them.
- **ha-4 (synthesis) M8b's design session includes dungeon navigation's model.** Rooms with exits and doors (state: open, locked, stuck, secret-found), a route between rooms as a Ways-on choice, the party's position, the cost per move in time and light, and the adventure-pack format for exits and doors, so adventures convert once. M8b builds the GM-side move (Ways on reading exits and doors); the players' map-tap navigation and fog stay R2 as an additive layer. Pack session: hold re-converting dungeon exits until that ruling.
- **ha-5 (synthesis) Charter, votes and the Treasurer are one design session before M7b.** The charter (founding version, M7b) carries a **decision rule per matter**: "the GM decides" (default) · a titled holder · a vote; M7b builds the vote core (a proposal, who may vote, open or secret, the tally, sanction/overrule, the log line) as the third rule; Split Loot and charter changes run through whichever rule the charter names, so nothing is built twice. M8 keeps titles, alerts, quiet mode, the GM inbox, broadcast and required votes.

## ⚑ dates (10)
- The hirelings session (before M7b); the prep-space paper test (before M6); the charter + votes session (before M7b); M8b's full session already in 08.

## B · kept with a build constraint (written into the plans by the designer, no ruling needed)
- HP in its own table (M6's first scope): keyed so one foe may have several pools (G-02, G-59).
- Routes and Travel (M8b): a `mode` (land / water / air) from the start (G-106, G-107).
- Level-up (M7-2): the fill snapshot stored in the event, so Lose a level (G-15) is a reversal.
- Award XP's who-went snapshot (M7-1): keyed by any actor kind, so retainers join (M9) without a migration.
- Multi-class screens (G-11): the data model already allows it.

## C · genuinely cheap hedges, kept
Spoilage as text; armour on watch narrative; the per-character downtime calendar (R2); hex tapping and the pictures strip; GM-rolled skills (G-10); item-count encumbrance in the app (format in 07); players entering damage to foes (a dry-run judgement).
