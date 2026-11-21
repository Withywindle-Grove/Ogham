---
status: absorbed
milestone: m5b
absorbed-into: docs/07-content-packs.md (options: lists of choices; overlay patches), docs/09-decisions-log.md (2026-11-03), docs/plans/options-gates.md
supersedes: of-3's single-choice `option` (of-12 allows a list)
---

# Options gating several choices, and an overlay patching a base pack (design ruling, 2026-11-03)

Follow-up to `m5b-options-format-2026-11-03.md` (of-3), from the pack session (`design/notes/area-2-exploration-review-2026-11-03.md` §12): the zine overlay's weaker materials change the base pack's armour and weapons under three choices and remove armour under one; its energy weapons exist under three of four choices. Ruled one at a time with Francis. Ids `of-12`, `of-13`.

- **of-12 (A) A gate on several choices.** `option` may be a list (`["energy=commonplace", "energy=exceptional", "energy=artefacts"]`): the entry exists while any is chosen. A `byOption` key may list several choices, comma-separated (`"energy=exceptional,energy=artefacts"`). `pack:check` warns on an unknown choice. No "not equal" form (a list says exactly what it means; a choice added later isn't swept in).
- **of-13 (A) An overlay patching the base's entries.** A pack may carry `patches[]`: `{ byOption: "<choices>", match: { kind, category?, ids? }, change: { "<field>": value | { "delta": n } } }`, or `option: null` in place of `change` (the matched entries don't exist under those choices). The shared option reader (of-3) applies an attached pack's patches when it reads the base's entries; each changed figure's breakdown names the reason ("AC −1 · bronze, <pack>"); `pack:check` warns when a `match` finds nothing. The base pack is never edited; this is the first, narrow form of G-06's rules-set patches (after R1).

*Pack session:* the zine's energy weapons with `option` lists and their price and "found, never sold" under `byOption` keys; its weaker materials as `patches` (armour AC delta under bronze and bone, weapon damage delta under bone, armour removed under stone).
