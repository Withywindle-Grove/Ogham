# m5b-sheet-4-combat — the full sheet's order and gating (sr-6, sr-7; Design's order 4 notes)

Feeds gate check 64 (the full sheet), which Design flips when this lands. Seeded campaigns: `npm run seed:test` (docs/testing.md); invented names only.

1. **iPad, portrait.** Open a seeded player character → ⋯ → Full character sheet. Two columns: Combat, Saves, Movement, Pack load, Skills on the left; Abilities, Traits, Magic (a caster), the layout's groups (Who they are…), Advancement on the right; Backstory and Notes across the bottom.
2. **Same screen, Combat.** The four tiles sit two by two inside the left column; none runs into the right column. A caption that doesn't fit its tile shows each part on its own line, and no line starts or ends with "·".
3. **iPad, landscape.** The Player screen with the full sheet beside it: the sheet has two columns (1180 wide) or one (a narrower pane), never folded lines.
4. **Phone (or a narrow window under 600 px).** The full sheet: Combat's tiles two by two, then one line per section ("▸ Saves · …", "▸ Pack load · Speed 30 · 9 items"). Tap a line: it opens in place ("▾ Saves"); tap again: it folds. Open Skills, leave the sheet and come back: Skills is still open (this device remembers).
5. **Options-on vs defaults campaign.** A field shows only when it applies: Liege only for its class, weapon proficiencies only with the option on, and a field fed by a trait list (a moon sign, an omen) is gone for a kindred the list leaves out. Edit and Save on that character: the hidden field's value is kept (switch to a kindred that takes it, and it's back).
6. **Player screen.** A character with limited-use traits: the section is headed **Traits** (was Abilities); the dots still mark uses.
7. **CI (on this pull request).** The Checks tab shows `layout shard 1/3`, `2/3`, `3/3` and `layout`; the run's Artifacts list `gallery-baselines-1..3` and `layout-screens-1..3`, also on a green run.
