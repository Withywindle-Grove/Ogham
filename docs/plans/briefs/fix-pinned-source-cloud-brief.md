# Brief for a cloud builder: a pinned copy names the pack it was pinned from (sn-1b)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `sn-1b-pinned-source`. Pull request title: "Same-named entries: a pinned copy names the pack it was pinned from (sn-1b)".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch (bring it up to `origin/main` first); carry nothing over.

**This is the most urgent piece in the queue: players are making characters and see two classes of one name with nothing to tell them apart.**

## Read
- `docs/design/rulings/dec-pinned-source-2026-11-13.md`: all of it. It is your definition of done.
- `src/modules/library/namesakes.ts` and its tests, `src/app/sameNameSource.test.tsx`, and the fixtures `scripts/fixtures/dec-1d-twins-a.fixture.json` and `-b`: how the "From <pack>" line is decided today and where it is shown.
- How an imported entry's own keys reach the app (does a key such as `pinnedFrom`, beside `id` and `name`, survive the import and arrive in the entry's data?). **Confirm this first.**

## The task
1. **First, a test that fails on main**: one pack that carries two classes of the same name with different ids, one of them with `"pinnedFrom": "<another attached pack's id>"`; a second attached pack with that id. On main neither row shows a "From" line. Write it with invented packs and names.
2. Then the rule (sn-1b): for a **class** or a **race**, an entry carrying `pinnedFrom` counts, for the source line, as belonging to the pack it names when that pack is attached; otherwise its own pack. So the pinned one reads "From <the named pack's short name>" and its twin "From <its own pack's short name>". Everywhere piece 1d shows the line: creation's Kindred and Class rows and the Pick's spoken name, the sheet's identity line, the review's lines.
3. Other kinds are unchanged: a pinned stat block or item keeps its own pack. Test that.
4. No namesake, nothing shown: a campaign where the names do not clash is unchanged. Two same-named entries in one pack with **no** `pinnedFrom` on either stay as today (no line). Test both.
5. `npm run pack:check` with several files, under "Same-named entries, for information": a pair inside one pack where one is pinned is listed with the pack it was pinned from.

## If the importer does not keep `pinnedFrom`
Stop the app part there. Do not change the importer or anything under `supabase/`. Write exactly what you found (where the key is dropped) at the top of the status file, build what can be built without it (the pure function and its tests, taking the value as an argument), and push that.

## Fences particular to this piece
- This is a normal branch (it extends a ruled behaviour): you may add to existing tests' files, but do not change what an existing test asserts unless sn-1b makes it untrue; say which, and why.
- Words only: the line's form is the existing "From <pack's short name>". No layout, no CSS, no new line elsewhere.
- Do not edit `docs/07-content-packs.md`: put a proposed one-line entry for `pinnedFrom` in your status file.
