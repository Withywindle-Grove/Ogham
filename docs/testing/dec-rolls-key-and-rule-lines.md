# Manual checks: dec-rolls-key-and-rule-lines

No screen changes in this piece; these checks are in the terminal.

1. Save this invented pack as `rolls-try.pack.json` in the project folder (delete it afterwards):
   `{"format":"tabletop-pack","formatVersion":2,"meta":{"id":"reed-rules-pack","name":"Reed rules","kind":"setting"},"rulesSets":[{"id":"reed-rules","name":"Reed rules","saveCategories":[{"key":"river","name":"Save vs river"}],"rolls":{"save":{"die":"d7","pass":"atOrOver"},"abilityCheck":{"die":"d20","pass":"under"}}}]}`
2. Run `npm run pack:check -- rolls-try.pack.json`. Under "Errors (2)" you should see that `rolls.save`'s die "d7" isn't a die the app can draw, and that `rolls.abilityCheck`'s pass "under" should be "atOrOver" or "atOrUnder". Then run `echo $?`: you should see `1`.
3. In the file, change `"d7"` to `"d20"` and `"under"` to `"atOrUnder"`, and run the check again: no Errors section, and `echo $?` shows `0`.
4. Remove the whole `"rolls": {…}` part (and the comma before it) and run it again: under "Format notes" you should see that the rules set has saves and no `rolls.save`. The exit code stays `0`.
5. Delete `rolls-try.pack.json`.
