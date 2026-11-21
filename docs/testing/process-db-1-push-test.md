# Manual checks: process-db-1-push-test

Run only at the next TEST turn Francis approves (through the lead); this pull request doesn't touch the test project.

1. On the migration branch whose turn it is, in its folder, run `npm run db:push:test`.
2. If the test project holds other pull requests' migrations, you see "The test project holds N migration(s) from other pull requests; they stay as they are:" and their numbers, then the CLI's usual list of what it will apply: only this branch's new migrations. Answer Y.
3. It ends with "Finished supabase db push." Then run the branch's own database test file as usual.
4. If it says "could not read the migration list", stop and tell the Builder: nothing was pushed.

No gallery pictures change.
