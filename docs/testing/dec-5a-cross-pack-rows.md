# Manual checks: dec-5a-cross-pack-rows

December step 5a: a table row's links into another attached pack. You need two invented packs, both attached to a campaign where you're the GM. Use the pull request's preview.

1. **A setting pack.** Its meta has `"id": "fen-rules"`. It has a stat block `bog-lurker` ("Bog lurker", with a description) and a table `eel-folk` (d4, one row "Eel-folk traders" on 1–4).
2. **An adventure pack.** Its meta has `"id": "mire-tower"` and `"requires": [{ "packId": "fen-rules" }]`. It has a table `harbour-night` (d6) with these rows:
   - 1: "Bog lurkers", `"statBlockRef": "fen-rules:bog-lurker"`, `"count": "1d4"`;
   - 2: "Eel-folk", `"tableRef": "fen-rules:eel-folk"`;
   - 3: "Salt hag", `"statBlockRef": "fen-rules:salt-hag"`;
   - 4–6: "Fog".
3. **The table list.** On the Scene, open Encounter tables and then Harbour by night. You should see:
   - row 1 with the bog lurker's description under it;
   - row 2 tagged "opens Eel-folk ›", and tapping it opens Eel-folk;
   - row 3 with "Not in your packs: fen-rules:salt-hag" under it.
4. **A hit.** Roll the wandering check to a hit and pick Harbour by night, row 3. On the waiting card, tap View. You should see "Salt hag" and "Not in your packs: fen-rules:salt-hag". Nothing fails; Start and Dismiss work as usual.
5. **Row 1 on a hit.** The same with row 1: View shows the bog lurker's name and description, and "How many: 1d4".
6. **GM reference.** Open GM reference and the table Harbour by night. Row 2 links to Eel-folk, and row 3 says "Not in your packs".

Gallery pictures expected to change: none.
