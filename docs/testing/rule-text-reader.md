# Manual checks: rule-text-reader

No screen changes for a pack that carries plain strings; these checks are in the terminal.

1. Run `npm run pack:check -- scripts/fixtures/g07-format.fixture.json` (a test pack with plain-string rules). You should see no "Errors" heading and nothing about rule text.
2. Save this invented pack as `rule-text-try.pack.json` in the project folder (delete it afterwards):
   `{"format":"tabletop-pack","formatVersion":2,"meta":{"id":"reed-marsh","name":"The reed marsh","kind":"setting"},"tables":[{"id":"mire-hazards","name":"Mire hazards","die":"d4","rows":[{"min":1,"max":4,"result":"Leeches"}]}],"locations":[{"id":"mire-causeway","name":"The causeway","gm":{"text":{"blocks":[{"source":"p. 12"},{"h":"Crossing the Mire"},{"lead":"Sinking"},{"tableRef":"eel-weirs"}]}}}]}`
3. Run `npm run pack:check -- rule-text-try.pack.json`. Under "Format notes" you should see that the source block should be the last block, and that tableRef "eel-weirs" names no table in this pack. Under "Errors (1)" you should see that block 3 (lead "Sinking") has no text.
4. Run `echo $?` straight after. You should see `1`.
5. Delete `rule-text-try.pack.json`.
