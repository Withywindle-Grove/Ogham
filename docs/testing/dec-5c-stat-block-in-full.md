# Manual checks: dec-5c-stat-block-in-full

December step 5c: a creature's stat block, from the waiting card and in Rules, in the approved layout (mockup `docs/design/mockups/december/06-stat-block.html`). Use 5a's and 5b's invented packs (`docs/testing/dec-5a-cross-pack-rows.md`, `docs/testing/dec-5b-several-creatures.md`). Give the setting's `bog-lurker` `"hp": "2d8"`, `"hpAverage": 9`, `"fields": { "Size": "Medium beast", "Wits": "animal wits", "Level": "2", "Armour": "7", "Saves": "D12 W13", "Attacks": "Bite (+1, 1d6)", "Speed": "60 swimming", "Morale": "8", "Met": "2d4" }`, one ability `{ "name": "Drag under", "note": "A bitten character is held." }` and `"source": "p. 12"`. In the setting's `meta`, add `"statBlockLayout": { "descriptor": ["Size", "Wits"], "groups": [[["Level", "Armour", "hp", "Saves"], ["Attacks"], ["Speed", "Morale"]], [["Met"]]], "hide": [] }`. Import it again.

1. **The stat line.** As the GM, roll a hit on row 4 (the acolyte and her lurkers). On the waiting card, tap View. Under "Bog lurker, 1d4" and its description you see one small wrapping line: "Level 2 Armour 7 Hit points [d8 glyph] 2d8 (9) Saves D12 W13 Attacks Bite (+1, [d6 glyph] 1d6) Speed 60 swimming Morale 8", the labels in brick red (light) or copper (dark), and a small View under it.
2. **The block.** Tap View. You see "Bog lurker" in a slab serif, bold; how many; the description; "MEDIUM BEAST, ANIMAL WITS" in small capitals; then three short lines of figures; a dotted rule; "Met [d4 glyph] 2d4"; then "**Drag under:** A bitten character is held."; then "From your setting: <short name>, p. 12"; and a "‹ Back to the encounter" button at the foot.
3. **Back.** Tap "‹ Back to the encounter". The details are back as they were, focus on the View you tapped, and the card is still waiting.
4. **Rules.** Rules › Browse these rules › Stat blocks › Bog lurker. The same block, laid out the same way.
5. **No layout.** Remove `statBlockLayout` from the meta and import again. The block shows its figures as one run of pairs, in the pack's order, with no small-capitals line and no rule; the waiting card's stat line shows the first six.
6. **Not in your packs.** A row naming a creature in another pack that isn't attached shows "Not in your packs: <link>, <count>" in that creature's place in the list.
7. **A phone.** At 375 px wide, the pairs wrap between pairs (a short pair never splits), and nothing runs off the side.
8. **Light and dark.** Switch the theme: the labels are brick in light, copper in dark, never bold.
9. **Players.** Signed in as a player, there's no waiting card, no stat line and nothing of the stat block anywhere.

## Pictures expected to change
- **Gallery, new section `stat-block`** (phone and tablet, light and dark: `phone-light-stat-block.png`, `phone-dark-stat-block.png`, `tablet-light-stat-block.png`, `tablet-dark-stat-block.png`): new pictures, made by CI on the first run, for Design to approve. Specimens: frame 1 (View), frame 3 (the waiting card's stat lines, with a missing creature), frame 4 (three figures only; no abilities; a very long attacks line with 999 and 2,300 and a d3), frame 6 (no layout, the block and the stat line); the phone run is the 375 px frames 5 and 5b.
- **No existing gallery picture changes**: the section is last, and the new fonts are drawn only inside it.
- **Layout screens** (not compared): `gm-rules-browser` (the Bog lurker now in the stat block part, Bitter, coloured labels) and `gm-encounter-started` (the creature's stat line under its name).
