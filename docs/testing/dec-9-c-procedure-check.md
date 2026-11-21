# Manual checks: dec-9-c-procedure-check

No screen changes in this piece; these checks are in the terminal.

1. Run `npm run pack:check -- scripts/fixtures/g07-format.fixture.json` (a test pack whose modes have procedures). You should see no "Errors" heading and no line about a procedure that you didn't see before this change.
2. Save this invented pack as `procedure-try.pack.json` in the project folder (delete it afterwards):
   `{"format":"tabletop-pack","formatVersion":2,"meta":{"id":"reed-marsh","name":"The reed marsh","kind":"setting"},"rulesSets":[{"id":"reed-rules","name":"Reed rules","procedure":[{"id":"test","name":"Test","checkId":"bog-lurker-stirs"}]}],"locations":[{"id":"reed-fen","name":"The fen","procedure":[{"id":"act","name":"Act"},{"id":"act"}]}]}`
3. Run `npm run pack:check -- procedure-try.pack.json`. Under "Format notes" you should see that checkId "bog-lurker-stirs" names no check in this pack. Under "Errors (2)" you should see that "reed-fen" has two steps with the id "act", and that a step has no name.
4. Run `echo $?` straight after. You should see `1`: errors fail the check.
5. Delete `procedure-try.pack.json`.
