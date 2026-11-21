# Plan: perf-lazy-and-fetch (perf report fixes 1 and 2a)

The plan of record is the performance report of 2026-11-06 (branch `perf-report-2026-11-06`,
`docs/status/2026-11-06-perf-report.md`) and its ruling: Francis, via Design, 2026-11-06 night, approved
**fix 1** (lazy-load the signed-in screens, with the heading font, cost 3) and **fix 2(a)** (the three screens
reuse the kept setting rules; pages fetched side by side). **Fix 2(b)**, the on-device pack cache, waits for a
design ruling and is not built here.

Builder's brief (from the coordinating session): one commit per fix, branch only (no push, no pull request
until Francis says), a calm loading state from the 06 inventory, no white screen on a failed chunk, the PWA's
`registerType: 'prompt'` and `appUpdates.ts` kept, every chunk precached, focused tests, before and after sizes.

Estimate: fix 1, 3–5 turns; fix 2(a), 2–3 turns (the report's).

## Departures

1. **No plan file existed for this step**; the report and its ruling served as the plan, and this file was
   written alongside the build so the Departures have a home.
2. **The font (cost 3) is not done.** It wasn't one character: Fontsource's per-subset CSS files leave out
   `unicode-range`, so every subset of a font downloads as soon as the font is used. Declaring the ranges fixed
   that, but #542's layout run showed it moves pictures (`1ch` changes from half an em to the real digit 0, and
   some letters come from the other file), so `src/ui/fonts.css` is back to main's and the choice is Design's
   (⚑ in the status report).
3. **The database library stays on the sign-in screen.** Sign-in itself needs it (the saved-session check and
   sending the code), and the library loads as one piece; splitting its sign-in part off would mean reworking
   sign-in. It's 230 KB of the 482 KB the sign-in screen now loads.
4. **Split inside the signed-in screens too.** Not one lazy piece but six: Your campaigns and its frame, then
   the player's campaign, character creation, the GM's campaign (with its reference), New campaign and the
   Rules library, each fetched in the background once Your campaigns shows, so opening one rarely waits.
5. **Tests load the lazy screens first.** A test setup file (`src/testing/setupLazyScreens.ts`, in
   `vite.config.ts` `test.setupFiles`) loads every lazy screen a test file's imports make before its tests
   run, as the app does in the background; without it, tests that tap and look at once saw the loading rows.
6. **Retry, then Reload.** A failed screen says so with Try again; if a retry fails too while online (most
   likely a file a new deploy replaced, when the service worker wasn't yet in charge), it offers Reload, in
   Design's words (2026-11-07). The words show only while a screen's code hasn't arrived: an error from a
   screen that loaded passes on as before, so they never cover an open creation flow (Design's question).
7. **Pages: a bounded batch, not a count first.** After a full first page, three pages are asked for at once
   until a short page: exactly the same query per page as before (no count). A 3,085-row read takes two waits
   instead of four; a short read is still one request.
8. **Setting rules no longer forgets the kept copy on opening.** It opens on the kept copy, forgets it before
   reloading after a change made there, and on leaving (as before). Changes from other devices or an undo are
   forgotten by the campaign log, as before.
9. **The kept copy is keyed by person** from the campaign log's signed-in user; a screen outside a campaign's
   screens (no one named) reads afresh, as before.
