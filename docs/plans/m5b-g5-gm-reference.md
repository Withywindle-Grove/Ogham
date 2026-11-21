# Plan: M5b step g5 — the GM reference screen (B4)

Written by the design agent, 2026-11-01 (M5 gate B4 ruling). Read the specs it names; this file makes no rulings. Opus, medium.

## What this step delivers
An **open-book icon** in the GM's top row opens the reference full screen: search (no autofocus), a **pack switcher** when several packs are attached, the panel list (**Combat, Dungeons, Class abilities, Equipment, Tables**, then the packs' `gmReference` panels tagged pack or adventure), entries as the pack's text with its page, tables opening g3's table screen. Phone: list first, panel full screen. The place card's GM screen button goes; the common player actions live in Dungeons.

## Already built (verify first)
`RulesBrowser` (the pack's rules as text), the Tables › library, the pack sections the engine reads (fight, exploration, classes, items, tables), `exploration.playerActions`.

## Rests on
- 05: *The GM reference screen* (B4); *The pack's common player actions*.
- 06: *Top row*; *GM reference screen* row; `design/mockups/m5-gate/b4-gm-reference.html`.
- 07: `gmReference` (G-45); `pack:check` warns on an empty panel or an entry without text.

## Build order
1. **Mapping layer:** standard panels from pack sections (document the mapping in code and in 06's row); a panel with nothing behind it is left out.
2. **Screen:** icon, search across panels, pack switcher (absent with one pack), panel list and entries with page tags, "No reference in this setting".
3. **`gmReference` panels** from rules sets and adventures; importer and `pack:check` accept the field.
4. **Links:** an entry's `tableId` opens g3's table screen; Tables panel = the library with session pins.
5. **Remove** the place card's GM screen button.

## Tests (purpose first)
- A pack with no fight section shows no Combat panel.
- Search finds an entry in any panel and in any attached pack.
- The switcher appears only with two or more packs.
- A `gmReference` panel shows after the standard ones with its source tag.
- Players have no route to the screen (permission case).

## Scope checks (write one and stop)
- No editing of pack text; no GM notes here (prep space, M8b).
- No player-facing reference (A5 moved it to the GM).

## ⚑ for Francis (ask at the start)
None.

## Estimate
15–20 builder turns. Independent of g2–g4; depends on g3 for the table link (stub it if g3 isn't merged).

## Departures
(The builder keeps this current in the same pull request.)

Built 2026-11-01 (Opus), PR #238.
1. **A migration the plan didn't list** (`20261102130000_m5b_g5_gm_reference_hidden.sql`): rules sets are player-readable, so a rules set's `gmReference` would have reached players' devices. It now joins `monsters`, `magicItems` and `procedures` as a section the database keeps apart (also inside a `byOption` override); existing rules sets holding one are re-filed (moved whole to the hidden part, nothing removed). Applied to test; not main.
2. **Combat** also shows the rules set's `combat` section (headed "Fighting") and `procedures.encounter` (headed "Encounters", where packs keep surprise), beside the five topics 05 names; both are fight sections the pack already has.
3. **Dungeons** reads "the exploration procedures" as the modes whose step is a turn.
4. **Tables:** g3 isn't merged, so a table opens in the existing `EncounterTablePanel` inside the reference screen, with a back button; **session pins** are g3's and aren't shown yet. When g3 lands, its table screen replaces that one call in `GmReference.tsx`.
5. **Icon:** a new `reference` icon (an open book with a ribbon): the Rules tab already uses the plain open book.
6. **Phone:** reopening shows the panel list first (05: "phone: the first screen") with the last-used panel marked; tablet reopens on it.
7. **Scope check (technical, stopped):** *Where an adventure's `gmReference` sits.* Found: 07 puts `gmReference` "on a rules set or an adventure", but doesn't say where in an adventure pack (pack root, beside `locations`?), and adventure packs aren't imported until M8b. Built now: a rules set's `gmReference`, tagged "adventure" when its pack's kind is adventure. Not built: a pack-root `gmReference` (the importer says it isn't a part it knows). Options: (a) a rules set in the adventure pack carries it (works today); (b) a pack-root part, stored GM-only, built with M8b's importer. Waiting for Francis's ruling.
8. The ✉ Messages icon beside it is g4's; not touched here.
9. **Bug found 2026-11-03 (Francis): the importer drops a pack's top-level `gmReference`** (and, added the same day, `locations` in a rules or overlay pack, G-58) with "isn't a part … knows". 07 (G-55, G-58) says both are kept. Not fixed yet: keeping them needs a migration, so it stopped at this scope check.

   > **Scope check — Where the importer keeps top-level `gmReference` and `locations`** (technical)
   > **What:** the importer keeps every other top-level part as library entries of its own kind (`traitLists` → `traitList`, …). The database refuses any kind not in `library_entries_kind_check` (newest in `20261101170000_m5b_trait_lists.sql`), so storing these two needs a migration. Nothing else fits: a pack's row and its `meta` are readable by players, and both parts are the GM's.
   > **Now:** goes in M5b · cost about 1 day · pushes back nothing on the M5b steps · chance of redoing work low
   > **Later:** goes in M8b (the adventure importer) · cost then the same · what we lose: overlay packs (deathcaster-class, zine-compendium) lose their GM reference panels and drop-in places until then
   > **Signals:** touches the pack format and data model → usually cheaper now; additive only (drops, renames and deletes nothing)
   > **Recommendation:** A, because it is the importer's existing pattern and the database's existing read rule keeps both GM-only with no new policy.
   > **Options:** **A** one additive migration: two new GM-only kinds, `gmReferencePanel` (one entry per top-level panel, its `id` the entry id) and `location`, added to the kind check only (not player-facing, so the existing read rule hides them from players); then the importer keeps them, the GM reference screen merges a pack's top-level panels with its rules sets' (tagged with the pack), and the import preview lists the locations as text; Update keeps both (matched by kind and id, as every kind) · **B** no migration: wrap the top-level parts in a made-up rules set (its `gmReference` is already hidden from players), but the pack would then show "1 rules set" in the library and the Rules tab, an overlay pack would no longer have "no rules set of its own" (07), and `locations` would need extra hiding · **C** later, with M8b's importer · **D** drop

   `npm run pack:check` already doesn't call either part unknown (`FORMAT_ONLY_PARTS` in `scripts/pack-format.mjs`; checked on deathcaster-class 0.2 and zine-compendium 0.5.3, 2026-11-03); only the app's import preview does.

   **Ruled A by Francis (2026-11-03).** Fixed in #314 (bug found 2026-11-03): migration `20261103150000_m5b_top_level_reference_and_locations.sql` (the kind check only; drops nothing); the importer keeps both parts; GM reference merges them; the preview lists places as text; Update and Export keep them. Ruled the same day, in the same PR: the import preview labels any pack with `meta.requires` **"Overlay"**, whatever its `meta.kind`; a pack without one keeps today's label. Technical choices (silent, for the gate):
   - a pack's rules sets' panels come first, then its top-level ones; a panel id seen twice keeps the first (as before);
   - the kind's words are "GM reference panel" and "place" (the counts line: "2 places");
   - a panel entry is named by its `title`, and Export writes it back without a `name`;
   - the places list shows each place's name, then `playerView.text` (or a `description`) — never its `gm` notes, though the preview is the GM's own;
   - `pack:check` no longer lists the two parts under "not imported yet" (they are in its entry counts now).
   - **For the pack session:** monster-overlay 0.1.0 says `meta.kind: "overlay"`, which isn't a 07 kind (read as setting); it should say `"setting"`. 07's kinds are unchanged.
