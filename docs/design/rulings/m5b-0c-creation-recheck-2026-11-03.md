---
status: absorbed
milestone: m5b
absorbed-into: docs/07-content-packs.md (classes primeXp; trait-list entries), docs/09-decisions-log.md (2026-11-03), docs/11-modelling-gaps.md (G-96), docs/plans/m5b-0c-creation-survey.md (PR 1 and PR 4)
supersedes: 07's "primeXp (rules with any / all thresholds)" and the app's `{any|all: [{min, bonus}]}` reading (rc-1)
---

# Creation, the independent re-check (design ruling, 2026-11-03)

The re-check of both settings' creation (`design/notes/fae-woodland-creation-survey-2026-11-03.md` §9, `design/notes/classic-advanced-creation-survey-2026-11-03.md` §10) left four questions and gap G-96. Ruled one at a time with Francis after cs-1 … cs-7 (`m5b-0c-creation-survey-2026-11-03.md`). Ids `rc-1` … `rc-5`.

- **rc-1 (A) The shape of `primeXp`: the packs' shape is canonical.** `primeXp: { "type": "standard" }` reads the rules set's `primeRequisiteXp` table (`[{ range, xp }]`); `{ "type": "rules", "rules": [{ "all" | "any": { "<ABILITY>": <min> }, "bonus": <n> }] }` sets a threshold per ability. The rules set's `primeRequisiteRule: "lowest"` (the lowest prime decides) applies to every class in it. **The app changes** (the reader and its fixture); the packs stay. Today no class shows its XP modifier at creation; this fixes it.
- **rc-2 (A) Entries that give coins or a random spell (G-96).** A trait-list entry may carry `money` (a number, or dice rolled at the table and typed, as starting money) added to starting money, and `spells.roll { listId, level }`, a roll added to the Magic step ("From your background · roll for one …", the list's spells at that level numbered for the die). Read at creation with G-48's items; M5b.
- **rc-3 (A) Items by id, or a one-off by name.** Trait-list entry items (and kit lines) prefer item ids; a `{ name }` line is allowed and creates a one-off item (no weight or price) at creation; `pack:check` notes each one.
- **rc-4 (confirmed) Level 0 stays in M7** (G-50: the Level 0 path and the GM's Graduate at the first XP award; 08's M7 row). Until then the option only adds its background lists to normal creation; M7 reads the pack's `levelZero` section.
- **rc-5 (A) Hard or soft, by the book's words.** "Must", "cannot", "only" = **hard**; "uncommon", "typically", "with the GM's leave" = **soft** (pickable, special approval, ca-3). Applied: classic-advanced's class alignment limits, hard; its race class and level limits, hard while the lifting option is off (cs-5); demihuman priests NPC-only, hard when the GM picks that choice (cs-5); the no-alignment-languages house rule, dropped (ruled earlier today); fae-woodland's Church classes for mortals only and never Chaotic, hard; the knight outside its usual kindreds, the enchanter for a mortal, the Mewl tongue for non-fairies and the obscure languages, soft.
