# Plan: perf-pack-cache (perf report fix 2(b), the on-device pack cache)

Approved by Francis on 2026-11-07. Source: the performance report, cost 2 and fix 2(b)
(`docs/status/2026-11-06-perf-report.md`), and fix 2(a) as built (`docs/status/2026-11-06-perf-lazy-and-fetch.md`,
`docs/plans/perf-lazy-and-fetch.md`). This file is the plan only: no app code until the ⚑ below are answered.

## What it does

Today every fresh app start downloads the campaign's whole setting rules again: a player about 825 rows (1.6 MB,
about 470 KB compressed) for the biggest setting, a GM up to 3,085 rows (4.1 MB) with a region pack. Fix 2(a) keeps
one copy **in memory** (`loadCampaignPacksAndEntries`, `src/app/campaignSetting.ts`, keyed `userId:campaignId`),
so the rules screens reuse it; it's gone when the app closes, and it's forgotten on every return to the app
(`campaignLog.tsx`, `back`), which downloads it all again.

This step keeps each campaign's pack entries **on the device, in IndexedDB (Dexie)**, stored per person and per
pack, each with a stamp saying which version of that pack's content it is. On start (and on each return to the
app) the device asks one small question, "which stamps are current?", which it already almost asks: the packs list
it reads every time (`loadCampaignPacks`). Only a pack whose stamp moved is downloaded again. Creation, the Pack
screen's Add item and the three rules screens read from the stored copy at once.

What's stored is **exactly what the server sent this person**: the rows of `library_entries` and
`library_entry_secrets` their own queries returned, merged as today (`withHiddenFields`). Nothing is worked out,
added or copied from another person's copy. The packs list, the GM's exceptions, the campaign's settings and the
players' calendar read (`addCampaignCalendars`) are small and stay read fresh every time, as now.

Not changed: what anyone may read (row-level security is untouched), the screens, the words, `settingFrom`.

## The two conditions, each a test to build

### 1. A player's stored copy never holds a hidden field

How it's guaranteed:
- **The server sends only what the person may see.** Row-level security on `library_entries` (newest policy in
  `20261104230000_fix_review_2026_11_04.sql`) and `library_entry_secrets` (pack owner and GM only) already decides
  this; the cache adds no read of its own.
- **The cache stores exactly what that person's read returned**, under their user id. It never merges two people's
  copies and never fills a gap from another copy.
- **One person's copies on a device at a time.** The store remembers whose it is; when a different person signs in
  on the same device (a shared tablet), every stored copy is deleted before anything is read or written. So a GM's
  copy, with its hidden fields, can never be read by a player on the GM's tablet, even if the GM didn't sign out.
- **A download that finishes after the person changed is thrown away.** If the GM signs out and a player signs in
  while the GM's download is still arriving, it's not written (the write checks the signed-in user is still the one
  who asked).

Tests (purpose first):
- **Database test** (`supabase/tests/pack-cache.test.ts`): *a player's reads, the exact queries the cache stores,
  return no GM-only field and no stat block, table or treasure entry; the GM's return the hidden fields.* It runs
  `loadCampaignEntries`'s two selects as a player and as the GM on a fixture pack with `gmOnly` fields, checks no
  `gmOnly`-named key and no `library_entry_secrets` row reaches the player, and checks the player can read the new
  stamps (and an outsider can't).
- **Unit test** (`src/app/packCache.test.ts`): *the cache key includes the person*: a copy written for user A is
  never returned to user B, for the same campaign and pack.
- *Signing in as someone else on the same device deletes the previous person's copies before the first read.*
- *A download that completes after the signed-in person changed is not stored.*
- *What's stored deep-equals what the server returned* (no added, merged or computed fields).
- *Only the cache module writes to the store*: a source test that `dexie` is imported by `src/app/packCache.ts`
  alone, and that the store's write is called only from `loadCampaignPacksAndEntries`.

### 2. The copy is dropped when the GM changes the packs, or the person signs out

What makes a stored pack stale, and how the device learns of it:

| Change | How the device learns | Cost |
|---|---|---|
| A pack attached, detached, moved in the order, options changed | The packs list read on every start (already fetched today) differs from the stored list | none extra |
| A pack's content changed (a new version imported, an entry edited, homebrew saved or deleted, a hidden field changed) | The pack's **content stamp** in that same packs list read differs from the stored one | none extra (one more column in the read); **needs a migration** |
| What a player may read changed without the pack changing (an item revealed: `known_items`; which pack wins an item: the GM's exceptions and the order) | The campaign's **seen stamp**, read with the campaign's settings | none extra (one more column); **needs a migration** |
| While the app is open, any of the above | The live log already forgets the in-memory copy on changes to the rules tables (`RULES_TABLES` in `campaignLog.tsx`); that now triggers the same stamp check | one small read |
| Coming back to the app (unlock, focus, back online) | Today: forget and download everything. Now: the stamp check, then only what moved | one small read instead of the whole download |
| Sign-out | The auth watcher (`watchSession`, `App.tsx`) on `SIGNED_OUT` deletes every stored copy (from the app layer: `src/core/auth.ts` doesn't import the app's cache) | none |
| The app's cache format changes | A format number in the store; a new number deletes everything (a Dexie version upgrade that clears the tables) | one re-download after that update |

**Cheapest:** the stamp check on start and on return, riding on reads the app already makes. Realtime alone isn't
enough (changes made while the app was closed never arrive), and a full "updated since?" query per pack is more
requests. The live log stays as the trigger for changes while the app is open.

The version string a pack carries (`packs.version`) is **not** enough: editing an entry (`library.editEntry`) and
homebrew saves change entries without changing it, and a player's readable items change with `known_items`
without any pack changing. Hence the stamps, and the migration below.

Tests (purpose first):
- *Attaching or detaching a pack, or moving it, re-reads the packs list and drops or adds only that pack's copy.*
- *A pack whose content stamp moved is downloaded again; the others aren't* (requests counted on a fake database).
- *A moved seen stamp re-reads the campaign's item entries* (or the whole campaign, see Build order 4).
- *Sign-out deletes every stored copy; so does a different person signing in.*
- *A new cache format number deletes the old store.*
- *Coming back to the app checks stamps and downloads nothing when nothing moved.*
- **Database test**: *each change bumps the right stamp*: `import_pack` with `replace_pack_id`, `library.editEntry`,
  homebrew save and delete, a hidden field changed (content stamp); a `known_items` row added or removed, a
  `campaign_packs` change, a `campaign_pack_secrets` exception change (seen stamp); and a player reading entries
  bumps nothing.

## Invalidation, in one list

A stored pack copy is used only when all four match:
1. **The person**: the store's owner is the signed-in user id (else the whole store is deleted).
2. **The campaign's packs list**: the pack is still attached to this campaign.
3. **The pack's content stamp** (and, for a player, the campaign's seen stamp) equals the stored one.
4. **The app's cache-format version** equals the store's.

## Offline

- **With a stored copy:** creation, Add item and the rules screens open on it at once, as the last online start
  left it. It may be out of date if the GM changed something since (⚑ 4: say so on screen or not). Saving a new
  character still needs a connection, as today (commands queue offline only from M9).
- **Without a stored copy:** as today: the screen can't load the setting rules and says so (the existing error and
  Try again). Nothing new.
- An offline start never deletes the stored copy (a failed stamp check isn't "changed").

## Storage size and eviction

- **Size:** a player stores about 1.6 MB per campaign with the biggest setting; a GM up to about 4 MB (setting plus
  region). IndexedDB allows far more on every browser the app supports (hundreds of MB at least), so size isn't the
  limit; the store is kept small anyway.
- **Eviction, by the app:**
  - all of it on sign-out, on a different person signing in, and on a new cache format;
  - a campaign's copies when it no longer appears in Your campaigns (left, removed, deleted);
  - a pack's copy when no stored campaign uses it any more;
  - beyond the **5 campaigns opened most recently** per person, the oldest (chosen; an invented number, rarely
    reached).
- **Eviction, by the browser:** Safari may clear a site's storage after about 7 days without a visit (for a site
  not added to the home screen), and any browser may under storage pressure. Then it's simply downloaded again.
  The app doesn't ask for persistent storage.
- **A failed write** (storage full or refused, private browsing): ignored; the app runs on the in-memory copy, as
  today.

## Migration: needed (scope check)

> **Scope check — stamps for the pack cache (technical)**
> **What:** add a content stamp to each pack (`packs.content_rev`, a whole number bumped by the database whenever
> the pack's entries or hidden fields change) and a seen stamp per campaign (a side table
> `campaign_rules_revs(campaign_id, seen_rev)`, bumped when `known_items`, `campaign_packs` or
> `campaign_pack_secrets` change for the campaign). Readable by whoever can read the pack or the campaign; written
> only by triggers. Adds; drops, renames and deletes nothing.
> **Now:** goes in this step · cost about 2–3 turns of the estimate · pushes back nothing else · chance of redoing
> work low.
> **Later:** without it, the cache can't tell an edited pack from an unchanged one, so it would have to download
> everything anyway (see the options).
> **Signals:** touches the data model (cheaper now); no change to screens or permissions.
> **Recommendation:** A, because it's the only option that saves the download and stays correct.
> **Options:**
> **A** The migration above (recommended).
> **B** No migration: show the stored copy at once and download it all again in the background, swapping it in if it
> differs. Creation opens instantly, but every start still downloads everything (no saving in data, about the same
> work for the database), and for a few seconds the screen can show rules the GM has just changed.
> **C** No migration, a log-based check: ask the campaign's log for any change to the rules tables since the stored
> time, plus `packs.version`. Fragile: a library pack updated outside the campaign may not log into it, and players
> don't see GM-only log lines that still change which items they may read.
> **D** Drop fix 2(b).

Notes for the builder if A is chosen:
- The seen stamp lives in a side table, not on `campaigns`, because `campaigns` carries the `log_change` trigger
  (every bump would write a log line). `packs` has no `log_change`, only `stamp` (bumps `updated_at`, harmless) and
  `guard_pack_update`; check the newest trigger list on `packs` again before writing.
- The bump is a statement-level trigger on `library_entries` and `library_entry_secrets` (one bump per pack per
  statement, not per row: a 1,700-row import bumps once). Postgres doesn't allow transition tables on a trigger with
  more than one event, so it's one trigger per insert, update and delete. The functions are `security definer`
  with `set search_path = ''`, like the others.
- Start from the newest definitions of anything replaced (none expected: this only adds).
- Test project first (`npm run db:push:test`, then `npm run test:db -- supabase/tests/pack-cache.test.ts`);
  Francis runs the main push after `npm run db:backup`.
- This step **qualifies for Fable** (a migration with row-level security and triggers on the pack tables): the
  builder asks Francis first, in one line.

## Build order

1. **Migration and database test** (stamps, triggers, read policies; `supabase/tests/pack-cache.test.ts`; then
   `npm run db:types`). 2–3 turns.
2. **The store** (`src/app/packCache.ts`): a small interface (`get`, `put`, `dropCampaign`, `dropAll`, `owner`),
   a Dexie adapter, and an in-memory adapter for unit tests (so no `fake-indexeddb` dependency). Database
   `grimoire-packs`, tables `owner` (user id, format number) and `packEntries` keyed by user, campaign and pack,
   holding the content stamp, the seen stamp, when it was saved and the entries as received. 2 turns.
3. **Reading through the store** (`loadCampaignPacksAndEntries`): read the packs list (with stamps) and the seen
   stamp fresh; take each pack's entries from the store when its stamps match, download the rest
   (`loadCampaignEntries` learns to take a list of pack ids), write them back; the in-memory copy stays on top as
   now. 2 turns.
4. **Invalidation wiring**: sign-out and a different person (App.tsx's session watcher); the return-to-app handler
   and the live log in `campaignLog.tsx` check stamps instead of forgetting everything; `known_items` joins
   `RULES_TABLES` (chosen: a reveal then updates a player's lists while the app is open, which today waits for the
   next return to the app); Your campaigns drops campaigns no longer listed; the 5-campaign limit. For a moved seen
   stamp the first version re-downloads the campaign's packs; re-reading only `kind = 'item'` rows is a refinement
   if the measurements ask for it. 1–2 turns.
5. **Real-browser check of the Dexie adapter** (a small Playwright test in `tests/layout/`): write, reload, read
   back; sign out and find it empty. 1 turn.
6. **Docs** (hand to `docs-sync`): 02 (Offline: the pack cache is the first piece of the device store, cleared on
   sign-out), 04 (the two stamps), 09 (the scope check's ruling), 10 if a ⚑ was listed there. 1 turn.

## Files to touch

- New: `supabase/migrations/<timestamp>_perf_pack_stamps.sql`, `supabase/tests/pack-cache.test.ts`,
  `src/app/packCache.ts`, `src/app/packCache.test.ts`, a layout test in `tests/layout/`.
- Changed: `src/app/campaignSetting.ts`, `src/modules/library/campaignPacks.ts` (`loadCampaignPacks` reads the
  stamps; `loadCampaignEntries` by pack ids), `src/app/campaignLog.tsx`, `src/app/App.tsx` (sign-out and person
  change), the Your campaigns screen (drop unlisted campaigns), `src/app/keptSettingRows.test.tsx` (extended),
  `src/core/database.types.ts` (generated), `package.json` and `package-lock.json` (Dexie, ⚑ 2),
  `docs/02-architecture.md`, `docs/04-data-model.md`, `docs/09-decisions-log.md`.
- Untouched: row-level security on the entry tables, every screen's layout, `settingFrom`, the service worker.

## Estimate

**8–12 builder turns** (the report said 6–10 before the migration was known to be needed): migration and database
test 2–3, store 2, reading through it 2, invalidation 1–2, browser check 1, docs 1. One pull request.

## Risks

- **Over-showing a hidden field** (hard rule 5): the main risk; covered by condition 1's tests, the one-person store
  and the discarded late download. Row-level security stays the only gate on what's sent.
- **A stale copy under-showing**: a missed bump would leave a player without a newly revealed item, or a GM with an
  old entry, until the next change. The database test that every write path bumps the right stamp is the guard;
  any future write path to the entry tables gets the bump for free (it's a trigger, not app code).
- **Items readable through another campaign**: the entries read is by pack, so a person in two campaigns sharing a
  pack sees items revealed in either. The stored copy keeps that (it stores what the server sent); a reveal in one
  campaign bumps only that campaign's seen stamp, so the other campaign's copy can miss it until its own next
  change. Rare (a player in two campaigns with the same setting); noted, not handled.
- **Players re-download after a GM-only change**: the content stamp moves for any change to the pack, including a
  stat block players never get, so they download that pack again needlessly. Cheap for a homebrew pack; rare for a
  library pack.
- **Offline staleness**: offline, a stored copy can show what the GM has since hidden (it was sent when allowed).
  Until the next online start. ⚑ 4.
- **Browser differences**: Safari's storage clearing and private browsing; both fall back to downloading, as today.
- **The test database's IO budget**: the new database test is one file, run alone while building; CI runs the rest.

## ⚑ for Francis

1. ⚑ **The migration** (scope check above): A stamps (recommended), B show-then-refresh without a migration,
   C log-based check, D drop 2(b).
2. ⚑ **Add Dexie to the app** (`dexie`, the IndexedDB library 02 already lists for offline; it isn't installed
   yet, the report was wrong to say it was in use). About 30 KB compressed, loaded with the signed-in screens, not
   on sign-in. Alternative: plain IndexedDB, about 80 lines of our own, no dependency. Recommended: Dexie, which M9's
   offline queue will need anyway.
3. ⚑ **The GM's copy holds the hidden fields at rest on the GM's own device** (in IndexedDB, until sign-out). 02's
   Offline section already says everything a user can see is cached on their device, so this matches it.
   Recommended: keep. Alternative: store only the player-safe part for the GM and read the hidden fields fresh each
   start (small, but the GM gets less of the speed-up).
4. ⚑ **Offline with a stored copy that may be out of date** (a design question, to Design): A use it without a word
   (recommended for now; M9 designs the offline signs for everything); B add a quiet line ("Setting rules as of
   <date> · offline"), Design's words.

**Ruled (Francis, 2026-11-07, via Design):** ⚑ 1 A, content stamps (`packs.content_rev`) and the side table
`campaign_rules_revs`; the migration runs on the test project first and the main push is Francis's. ⚑ 2 Dexie approved
as a new dependency (02's list gains it in the build's pull request). ⚑ 3 keep: the GM's hidden fields stay on the GM's
own device until sign-out. ⚑ 4 B (Design): offline with a stored copy, one quiet line where the rules are read,
"Setting rules as of <date>, offline", no sign, gone when online. Model for the build: Fable. Built after slice E
lands, as its own pull request.

Chosen (silent choices, 08 "Scope checks"): one person's copies per device at a time; 5 campaigns kept per person;
`known_items` joins the live log's rules tables; no persistent-storage request.

## Departures

Built 2026-11-07 on `perf-pack-cache` (Fable).

1. **Two migrations, not one.** `20261107120000_perf_pack_stamps.sql` adds the stamps and triggers as planned. The
   database test then showed a pack's owner could write `content_rev` by hand (the owner's update rule covers every
   column), so `20261107121000_perf_pack_stamps_guard.sql` fixes forward (the first had already run on the test
   project): a guard trigger keeps the old value unless the bump itself is writing. A test pins it.
2. **The campaign's settings and calendar rows are stored too**, beside the packs list, so creation and Add item open
   offline as the Offline section promises (they need `settingFrom`'s inputs, not only the entries). Online they are
   still read fresh every time, as planned; the stored ones serve only when the stamp check fails.
3. **The Dexie adapter is its own file**, `src/app/packCacheDexie.ts`, imported statically by `packCache.ts` (not
   lazily: creation's code may ask for no piece at run time, `lazyScreen.test.tsx`). `App.tsx` reaches the cache
   through a lazy import, so the sign-in screen's code still holds no Dexie. The source test pins both.
4. **The store's writes** come from `campaignSetting.ts` (two functions: `loadCampaignPacksAndEntries` for the packs
   and entries, `loadCampaignSetting` for the settings and calendar rows), not from one function as written.
5. **The seen stamp is its own small read** (`loadSeenRev`, in parallel with the packs list), not a column on the
   settings read: it lives in the side table.
6. **`known_items` has no log lines today**, so adding it to the live log's rules tables changes nothing yet: an item
   revealed while the app is open still shows at the next return to the app, as before. The seen stamp covers it then.
7. **"Offline" means the stamp check failed**, whatever the cause (the device offline, the server unreachable): the
   stored copy serves and the line says offline. The device's own online flag isn't consulted.
8. **`database.types.ts` was edited by hand** (the `packs.content_rev` column and the `campaign_rules_revs` table, in
   the generator's order); `npm run db:types` after Francis's main push should produce the same text.
9. **Tests live in a new file**, `src/app/packCache.test.ts`, rather than extending `keptSettingRows.test.tsx`.
10. **The Playwright check of the Dexie adapter** (`tests/layout/packCache.spec.ts`) signs out through the campaign's
    ⋯ menu on a tablet width (where the account items sit), not from Your campaigns; it ran locally in WebKit.
11. **One more database test than planned:** nobody writes a stamp by hand (from departure 1).
