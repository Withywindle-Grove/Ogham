# Manual checks: dec-12-a-adventure-hooks

No screen changes in this piece; these checks are in the terminal.

1. Save this invented pack as `hooks-try.pack.json` in the project folder (outside `packs/` is fine; delete it after):
   `{"format":"tabletop-pack","formatVersion":3,"meta":{"id":"eel-weirs","name":"The eel weirs","kind":"adventure","code":"ew"},"npcs":[{"id":"ew-marda","name":"Marda","gm":{"notes":"Offers [[adventureHook:ew-lost|the lost lantern]] and [[adventureHook:ew-none|nothing]]."}}],"adventureHooks":[{"id":"ew-lost","name":"The lost lantern","text":"A Lantern Warden never came back.","pays":"A boat","giverNpcId":"ew-marda"},{"id":"ew-bounty","name":"Bog lurker bounty","pays":"Ten silver","giverNpcId":"ew-nobody"}]}`
2. Run `npm run pack:check -- hooks-try.pack.json` (checks the pack the way the app reads it).
3. You should see `adventure hooks: 2` in the summary, and under "Format notes": the bounty has no text; its giver "ew-nobody" names no npc; the link to adventureHook "ew-none" resolves to nothing. You should **not** see `"adventureHooks" isn't a part`.
4. Delete `hooks-try.pack.json`.
