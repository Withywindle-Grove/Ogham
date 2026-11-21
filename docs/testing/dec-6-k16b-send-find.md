# Manual checks: dec-6-k16b-send-find

Logic only. There is no screen to tap yet (the sheets are K16c), so these checks are run against the **test** project after the Builder applies the migration.

1. `npm run test:db -- dec-6-k16b-send-find`: every test passes.
2. `npm run test:db -- commands`: the find's permission cases pass (they use `freshFind`).
3. `npm run test:db -- dec-6b-purse-commands undo known-items`: the purse's Undo, the generic Undo and the known-items tests still pass (they are unchanged).
4. In the test project's log, as the GM, a send shows one action: "Your GM gave <Name> <things>, <coin>, at <place>." Its Undo shows "Your GM took back …", and the thing and the coin are gone from the character.
5. Signed in as a player, the same send shows "coin" and no place. Nothing that player's device receives for it contains the place's id or `"rows"`.

Gallery pictures expected to change: none (no screen changed).
