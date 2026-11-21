# Manual checks: dec-4a-route-kind

December step 4, piece (a): an adventure pack's `routes` import as a GM-only kind. Nothing on screen uses routes yet (piece b draws the Move on sheet), so the checks are on the import and the pack checker. Run them after the migration is on the database the preview uses.

1. **Make a small invented pack.** Save this as `mire-tower.pack.json` anywhere outside the repository:
   `{ "format": "tabletop-pack", "meta": { "name": "Mire Tower", "kind": "adventure", "version": "0.1" }, "locations": [ { "id": "mt-jetty", "name": "The jetty" }, { "id": "mt-islet", "name": "The reed islet" } ], "routes": [ { "id": "mt-jetty-islet", "from": "mt-jetty", "to": "mt-islet", "travel": [ { "by": "row", "name": "Rowing", "value": 1, "unit": "turn" }, { "by": "swim", "name": "Swimming", "value": 3, "unit": "turn" } ] }, { "id": "mt-islet-jetty", "from": "mt-islet", "to": "mt-jetty", "hidden": true, "oneWay": true, "travel": { "value": 2, "unit": "turn" } } ] }`
2. **The checker.** In a terminal in the project folder, run `npm run pack:check -- <path to mire-tower.pack.json>`. You should see `route: 2` in the counts, and no line saying `"routes" isn't a part`.
3. **A broken route.** In the file, change the first route's `"to": "mt-islet"` to `"to": "mt-tower"` and run the same command. You should see: `routes: "mt-jetty-islet": to "mt-tower" isn't a place in this pack.` Put it back.
4. **Import as the GM.** On the pull request's preview, sign in as a GM, open Library, and import the file. The preview should list 2 routes and 2 places, and no line saying routes were left out.
5. **The Rules browser.** As the GM, open the campaign's Rules. You should see the pack's other kinds, and no "Routes" group (routes stay out of it until the Move on sheet).
6. **Players never get routes.** Attach the pack to a campaign that has a player. Signed in as that player, nothing about the routes shows anywhere (there's no screen for them yet, so this is mostly the database test's job; check the Library shows no routes to the player).

Gallery pictures expected to change: none (no screen changed).
