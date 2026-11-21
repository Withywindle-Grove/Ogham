# Manual checks: dec-5b-several-creatures

December step 5b: a table row with several creatures, each with its count. Use 5a's two invented packs (`docs/testing/dec-5a-cross-pack-rows.md`, steps 1 and 2), and add to the adventure's `harbour-night` table:

1. **A row with counts.** Make row 4 read "The acolyte and her lurkers", with `"statBlockIds": [{ "statBlockId": "drowned-acolyte", "count": 1 }, { "statBlockRef": "fen-rules:bog-lurker", "count": "1d4" }]`. Give the adventure a stat block `drowned-acolyte` ("Drowned acolyte").
2. **A row without its own counts.** Make row 5 read "Lurkers", with `"count": "2d4"` and `"statBlockIds": ["fen-rules:bog-lurker"]`.
3. **Run the checker** on the adventure file: `npm run pack:check -- <file>`. There should be no note about these rows. Remove row 5's `count` and run it again: you should see "… creature 1 ("fen-rules:bog-lurker") has no count, and the row has none either." Put it back.
4. **A hit on row 4.** Roll the wandering check to a hit and pick row 4. On the waiting card, tap View. The Stat blocks list shows "Drowned acolyte, 1" and "Bog lurker, 1d4", and there's no "How many" line.
5. **A hit on row 5.** View shows "How many: 2d4" once, and "Bog lurker" with no count of its own.
6. **The recorded row.** On row 4's hit, the waiting card's line reads "Harbour by night: The acolyte and her lurkers" with no count after it.

Gallery pictures expected to change: none.
