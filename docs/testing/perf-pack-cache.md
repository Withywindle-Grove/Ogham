# Manual checks: perf-pack-cache (perf fix 2(b), the on-device pack cache)

Use the pull request's Vercel preview (the test project, where the two migrations already run). Gallery pictures
expected to change: **none** (online, nothing on any screen changes; the one new line shows only offline on a
stored copy, which the gallery never is).

**The main database push (Francis's step, after the pull request merges)**
1. [ ] In a terminal at the project folder: `npm run db:backup` (a backup of the main project; it prints where it
   saved the file).
2. [ ] Then `! npm run db:push` (applies `20261107120000_perf_pack_stamps.sql` and
   `20261107121000_perf_pack_stamps_guard.sql` to the main project; they add a column, a table, triggers and one
   read rule, and drop nothing). Expect "Finished supabase db push." with both file names.
3. [ ] Then `npm run db:types` and check `git status` shows no change to `src/core/database.types.ts` (the hand
   edit matched the generator) or, if it does, commit the regenerated file on a small branch.
4. [ ] Optional: `npx supabase db advisors --linked` shows nothing new about `campaign_rules_revs` or the
   `bump_*` functions.

**The cache at work (any device, signed in as a player)**
5. [ ] Open a campaign, then ⋯ → Setting rules. It opens as before. Close the tab, open the preview again, sign
   in if asked, open the same campaign and Setting rules: the list shows at once (no download of every entry;
   with the browser's developer tools open on the Network tab, the only `library_entries` request is missing or
   tiny).
6. [ ] As the GM, in the campaign's Setting rules, change an optional rule (or attach and detach a pack). As the
   player, leave the app and come back (switch tabs or lock and unlock): Setting rules shows the change after a
   moment, and the Network tab shows a download for that one pack only.
7. [ ] As the GM, edit a homebrew entry (or save a new one). As the player, come back to the app: only the
   homebrew pack downloads again; the setting pack doesn't.

**Hidden means hidden (two people, one tablet)**
8. [ ] On one tablet, sign in as the GM and open a campaign (its hidden fields are now stored on that tablet).
   Sign out. Sign in as a player on the same tablet and open the same campaign: the Pack's Add item shows items
   without any GM-only field; ⋯ → Setting rules shows no stat blocks, tables or treasure. (In the developer tools,
   Application → IndexedDB → `grimoire-packs`: the `owner` row is the player's id and every `packs` row carries
   it; nothing of the GM's remains.)
9. [ ] Sign out. In the developer tools, `grimoire-packs` has no rows in `owner`, `campaigns` or `packs`.

**Offline**
10. [ ] As a player, open a campaign and ⋯ → Setting rules, then turn on airplane mode. Leave the app and come back
    (or reload if the app is installed): Setting rules opens on the stored copy with one quiet line under the
    campaign's name, "Setting rules as of <date>, offline". Create (a new character) and the Pack's Add item open
    too. Nothing says error.
11. [ ] Turn airplane mode off and come back to the app: the line is gone.
12. [ ] On a fresh device (or a private tab) with airplane mode on from the start: the screens say they couldn't
    load the setting rules, with Try again, as before. Back online, they load.
