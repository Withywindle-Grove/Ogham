# Manual checks: dec-6a-purse-data (the purse's data and its read rule)

**Before anything:** this pull request carries a held migration (`20261111160000_dec_6a_purse_data.sql`) and no screen. Nothing here can be walked in the app. The checks are for the pull request itself, and for the day the migration is applied to the test project.

**Gallery pictures expected to change:** none.

## On the pull request
1. [ ] Open the pull request's checks on GitHub. The **database** job is green. It runs `supabase/tests/dec-6a-purse-data.test.ts` on its own throwaway database: that test signs in as the owner, another player, the GM and an outsider and proves who reads a purse.
2. [ ] Open `docs/generated/visibility-matrix.md` and find the row `purses`. You should see one rule under Read ("owner and GM, all for the stash and the Down or dead") and a dash under Add, Change and Delete: nobody writes a purse from a device.

## After the migration is applied to the test project (Francis's word, through the lead)
3. [ ] In a terminal in the project folder, run `npm run test:db -- supabase/tests/dec-6a-purse-data.test.ts`. It runs only the purse test against the test project. You should see "19 passed".
4. [ ] In the Supabase dashboard of the **test** project, open Table Editor, then `purses`. You should see one row for each character and hireling, and one for each campaign's Party stash, every one with coins `{}`. No existing table has changed.
5. [ ] Open the preview of this pull request and sign in as a player. Nothing looks different: no coin line yet (piece c).
