# Plan: patrons and expanded cleric creation

Written by the design agent, 2026-11-07, night. Rulings: `docs/design/rulings/m5b-patrons-session-2026-11-07.md` (pt-1 … pt-8), the walk in `docs/design/notes/patrons-dry-run-notes.md`, the intent in `docs/intents/2026-11-07-patrons.md`. The pack side is in the zine (0.5.50: 7 `patrons`, the option `expanded-cleric-creation` with `classHint`, garb items by tier; G-204 registered). This plan makes no rulings. It starts after the creation retest fixes (#555) and the players' screens land, since it builds on creation's one-column steps and the Pack's equip warning.

## What this step delivers

### A · Reading patrons
1. The `patrons` kind is read from attached packs (import, pack:check already knows the shape per G-204; the app's "unknown part" note goes). Players read patrons (follower pages are player-readable); a patron's `statBlockId`, realm lore beyond the entry's `realm` line, and any cult stay with their own kinds' rules.
2. The option **Expanded cleric creation** (one ruleKey across packs, off by default): on, the app flags the classes in `classHint.classes` and shows `classHint.text` on their rows and entries (pt-2).

### B · The Patron section (creation)
3. On **Who they are**, before alignment, for a flagged class: a section "Patron" with pick rows (name, blurb, the follower alignments as its line), the entry as a sheet (depiction, who follows, holy symbol, garb by tier, strictures, prayer, weapons where the pack has them, spells, marks, source; Pick at the foot), built on the liege's pieces (cw-5). Pick sets the alignment when one is allowed (toast with Undo) or leaves only the allowed alignment rows open (pt-3).
4. One list per pack, grouped by pack only with two packs (pt-4).
5. The patron fills **Affiliation** (prefilled, editable); the link is kept on the draft and the character (pt-7).

### C · What it applies at creation
6. **Spells:** the class list with `spells.swap` applied, each swapped spell marked "from <patron>" inline; `spells.note` as a line under the list (pt-5).
7. **Gear:** tier-0 `holyGarb` items given free, marked "From <patron>"; a weapon or gear the patron forbids (`weaponsAllowed`, `equipment.forbidden`, where a pack has them) carries the sign and stays buyable, an exception on the GM's card; a kit's forbidden roll kept and flagged (pt-6).
8. **The review and the GM's card:** the patron on the name card (Affiliation), exceptions as today with the patron's reason; the full sheet's identity block shows the patron with its entry one tap away.

### D · In play and at level-up
9. **Equip:** the equip warning with the patron's reason, logged; the attack prompt's penalty with its source (the class rule's path, one more source).
10. **Level-up (M7's preview; the hook here is the data):** the tiers that come online at a level (garb, marks, abilities, effects) listed and applied; garb free at every tier (pt-8). Until M7 builds level-up, the entry shows the ladder and nothing applies past creation; the plan's Departures say so.

## Rests on
pt-1 … pt-8; cw-5 (the liege); creation's final drafts and #555; the Pack's equip warning; G-80's `extends` shape for spells; zine 0.5.50.

## Tests (purpose first)
- With the option off, no Patron section and no class hint; on, a flagged class shows both.
- Picking a patron with one allowed alignment sets it with an Undo toast; with several, the other alignment rows close.
- The spell list shows the swap inline with its source; a note-only patron shows its note.
- Tier-0 garb lands in the pack free, marked; higher tiers do not.
- A forbidden weapon in the shop shows the sign and can be bought; the GM's card lists it with the patron's reason.
- The patron fills Affiliation and stays editable; the link survives an edit of the text.
- A player's device never receives a patron's stat block or cult.

## Scope checks (write one and stop)
No change to the liege's behaviour. Level-up's application waits for M7 (the data is read now). No app-side invention of weapon rules for a patron that has none. The daemonology add-on's patrons come with their own pack version after its session.

## ⚑
1. The zine's acolyte class flagged as well as the cleric: answered, keep it (Francis, 2026-11-07, "good catch").
2. A patron with no allowed alignment listed: treat as any (show nothing, set nothing).

## Estimate (for the Builder to confirm)
A half a day; B a day (the liege's pieces reused); C a day; D half a day (equip) plus M7's part later. One builder, after #555 and the players' screens.

## Departures
(The Builder keeps this current in the same pull request.)

**2026-11-11, branch `dec-1a-patrons`:** parts A to C were built as December step 1a, against the shape the Pack Creator settled for the port pack and the lead's rulings of the day. Where this plan and that shape disagree, the shape was followed; the list is in `docs/plans/dec-1-creation.md`, Departures, 1a (17 items: each patron's own option instead of one shared switch, `followers.classes` instead of `classHint`, no forbidden weapons or gear, part D and level-up not built, and the rest).
