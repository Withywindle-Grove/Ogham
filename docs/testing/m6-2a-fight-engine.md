# m6-2a-fight-engine — the fight engine, logic only (plan `docs/plans/m6-2a-fight-engine.md`; fe-1, fe-2, ha-2, fi-1)

Nothing in the app changes: no screen, no migration, no command. There is no iPad step. The checks run on the PC, in the project folder.

1. `npm test -- src/modules/fight`: 4 files, 36 tests, all green. The purity file proves the module rolls no die and nothing in the app imports it.
2. `npx vitest run src/modules/fight/undo.test.ts`: the property test replays 300 random fights of 40 steps; a failure names its seed and step so it can be replayed.
3. `git grep -n "modules/fight" src -- ':!src/modules/fight'` prints nothing (the fence: nothing imported by the app).
