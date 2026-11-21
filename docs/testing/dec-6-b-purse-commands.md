# Manual checks: dec-6-b-purse-commands (December step 6, piece b, the purse commands)

Nothing to walk in the app: this piece has no screen (the coin line and its sheet are piece c), and its migration is applied nowhere until the coordinator's TEST session. These checks are for whoever runs that session; each one is also in the tests named.

**Gallery pictures expected to change: none.** `src/app/LogView.tsx` changed only to pass the setting's coin names to the purse log lines, which no gallery picture holds.

After `npm run db:push:test` with this branch's migration:

1. Run `npm run test:db -- supabase/tests/dec-6b-purse-commands.test.ts`. You should see every case pass (33 cases in 10 groups).
2. Run `npm run test:db -- supabase/tests/commands.test.ts`. The 24 new purse cases (search the output for "coin") should pass, with the rest as before.
3. Run `npm run test:db -- supabase/tests/m3-health.test.ts`. "the logged commands are a table that matches the app" should pass (the five `purse.*` rows are in the migration).
4. Run `npm run test:db -- supabase/tests/dec-6a-purse-data.test.ts`. It should still pass: piece (a)'s read rule is unchanged, and "nobody writes a purse from a device" still holds.
5. Run `npm run test:db -- supabase/tests/log.test.ts` (after `20261114093000_dec_6b_keep_fm1_in_core.sql` too) and `npm run test:db -- supabase/tests/m4b-undo-drop.test.ts`. Both should pass as before: they lean on the two replaced functions (the log trigger and Undo's entry point).
6. Optional, in the Supabase SQL editor on TEST: `select name, level, gm_only from public.logged_commands where name like 'purse.%' order by name;` should list five rows, `purse.add` and `purse.remove` with `gm_only` true.
7. After `20261114093000_dec_6b_keep_fm1_in_core.sql` is applied on TEST: run `npm run test:db -- supabase/tests/m5b-1-travel.test.ts`, and fm-1's own `supabase/tests/fm1-group-log-audience.test.ts` from its branch (#628). Travel commands should log again, and a player's own forced march should undo.
