---
status: absorbed
milestone: m5b
absorbed-into: docs/07-content-packs.md (encumbrance slot bands; table rows `next.byTerrain`; modifiers `chance`; skill `fill` best-of), docs/08-roadmap.md (releases), docs/09-decisions-log.md (2026-11-03), docs/11-modelling-gaps.md (G-106 … G-117)
supersedes: G-114's remaining "per-cell table ids" (ga-2); G-117's proposed `modifiers: [{ class, chance }]` (ga-3, on top of ex-2)
---

# Pack review, area 2: the gaps (design ruling, 2026-11-03)

From the pack session's area-2 review (`design/notes/area-2-exploration-review-2026-11-03.md` §6 and §10; gaps G-106 … G-117), after the re-check's questions (`m5b-pack-review-area-2-2026-11-03.md`, ex-1 … ex-7). Ruled one at a time with Francis, each with A — Builder, B — Critic and a synthesis. Ids `ga-1` … `ga-5`.

- **ga-1 (A) Slot encumbrance with two bands (G-115).** `encumbrance.slot` may carry `bands: { equipped: [{ maxSlots, speed }], stowed: [{ maxSlots, speed }] }` and `combine: "slowest"`. The load bar shows two short bars (each band's count and speed); the character's speed is the slower, its breakdown naming the band. One list (`tiers`) keeps working. *Pack session:* fae-woodland's two slot tables into `slot.bands`.
- **ga-2 (A) One result, a table by terrain (G-114's rest).** A table row may carry `next: { byTerrain: { "<terrain or terrain class>": "<tableId>" }, default: "<tableId>" }`; the app opens the current terrain's table (the GM can pick the other from the table's header); `pack:check` warns on a missing table. Name matching (ex-1) stays for the plain case. *Pack session:* the classic-advanced result that splits by terrain.
- **ga-3 (A) A modifier that sets the chance (G-117).** On top of ex-2 (`ifPartyHas`, `who: "self"`), a modifier may carry `chance: { on: [faces] }` instead of `add`, with `ifClass` for a self modifier and `onlyOnTerrain`; when several set the chance, the best for the party wins; the roll line says why. *Pack session:* the class traits on lost and surprise checks.
- **ga-4 (A) A general skill using a class's own (G-116).** A skill's `fill` may be `{ best: ["base", { classSkill: "<code>" }] }`: the sheet shows the better of the general chance and the class's skill at the character's level, its breakdown naming which (ct3-9); the activity's skill list (ex-3) uses the same rule. *Pack session:* listen with the classes' hear-noise.
- **ga-5 (A) Releases.** G-106 water travel and G-107 flying: **R2** (a travel extension; the wind options stay "Run by hand", ex-7). G-108 a day's food from a bundle: **M5b**, with G-92's `units`. G-109 food from a fight: **M6** (fight endings). G-110 camp results on the sleep check: **M5b**, a small camp follow-up (more camp facts for `camp.sleep.modifiers`). G-111 spoilage by place: **R2**. G-112 two-band rolls on special roads: **R2**. G-113 light from a spell: **M7**, with Cast.
