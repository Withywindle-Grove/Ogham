# Manual checks: dec-6-k16a-hoard-rows

Logic only: no screen yet (the send and its sheets are K16b and K16c). One check for the pack checker:

1. **`pack:check` on a test copy of a pack.** Give a place's treasure entry `"coins": { "<a coin key that pack names>": 2.5 }` and another `"coinsReadAs": { "printed": "hx." }` with no `coins`. Run `npm run pack:check -- <the copy>`. Under the format notes it says the amount should be a whole number of 0 or more, and that `coinsReadAs` has no `coins` and is missing its note. The real pack, unchanged, prints nothing new.
