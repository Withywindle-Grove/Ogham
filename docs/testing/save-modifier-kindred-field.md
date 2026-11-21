# Manual checks: save-modifier-kindred-field

None needed beyond the tests: no screen, no component, no CSS. A save modifier written `{ "raceField": "<field>" }` now fills its sheet field the way the two older shapes do (a layout that shows `saveModifiers.<id>` shows it). When a pack uses it:

1. As a player in a campaign whose rules set has such a modifier (invented: `vs hexes`, `{ "raceField": "hexWard" }`), make a character of a kindred that carries the field (`hexWard: 2`) and open the sheet. **You should see** "vs hexes 2" beside the saves; tap it and the breakdown reads "+2 from <kindred>.", then "vs hexes 2 in all.". The save's own number is unchanged.
2. Do the same with a kindred that lacks the field. **You should see** no "vs hexes" figure (the dash a layout shows for an empty field).
