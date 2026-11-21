# Manual checks: dec-8-a-magic-state (the magic state, December step 8 piece A)

Piece A is data and logic only: **nothing on any screen changes**, and no gallery picture is expected to change. The checks are that nothing a caster already uses broke, and that the database session went in cleanly.

## After the database session (the coordinator runs it on TEST)
1. Run `npm run test:db -- supabase/tests/dec-8a-magic-state.test.ts`. You should see 7 tests pass.
2. Run `npm run test:db -- supabase/tests/commands.test.ts supabase/tests/m3-health.test.ts supabase/tests/character-play.test.ts`. All pass: the 14 new permission cases (choose, Same as yesterday, cast, undo a cast, the GM's set) agree with the database, and the five new commands each have their `logged_commands` row.

## On the pull request's preview (it uses the TEST project)
3. Sign in as a player whose character casts spells and open their Player screen. The Spells section looks exactly as before and lists the same prepared spells.
4. Tap an ability's use dot, then Undo. It works as before.
5. Open the Log. Nothing new appears from simply looking around: piece A adds no buttons, so no new log lines can be made from the app yet.

## Gallery pictures
None expected to change.
