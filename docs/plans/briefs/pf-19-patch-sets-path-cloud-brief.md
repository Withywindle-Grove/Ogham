# Brief for a cloud builder: a patch may set a path the entry lacks (pf-19)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it**, with the one difference under "A database test". Your branch: `pf-19-patch-sets-path`. Pull request title: "Patches: a set may create the path it names (pf-19)".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch (bring it up to `origin/main` first); carry nothing over.

## Read
- `docs/design/rulings/dec-patch-sets-path-and-homebrew-batch-2026-11-13.md`: the section pf-19. It is your definition of done; every line of its table is a requirement.
- The patch code (`patches.ts` and its `atPath`, in `src/modules/library/` or where a search finds it), how and where patches are applied, and their tests.
- `scripts/check-pack.mjs` and its helpers: what the checker says about patches today.
- `docs/07-content-packs.md`: what it says about patches (read only; do not edit it).
- The database rule that keeps a patch for the GM when its path begins at a hidden field (search the migrations for `patch_hides_target_field`), to understand it. Do not change it.

## The task
1. **One shared function** that reads a patch's path and says what setting it would do: set an existing place; create the missing keys and set; or refuse, with the reason. The app's patch code and the checker both call it. Pure, with tests.
2. **In the app**: a patch that sets a value now creates the missing keys on its way, **objects only**. Every other kind of patch behaves exactly as before. Tests first, each named by its purpose:
   - a set on a path the entry lacks creates it (one level, and three levels deep);
   - a set on an existing path still works as before;
   - a missing step whose next segment is a number is refused and changes nothing (no list is created or padded);
   - a step that exists and is a text or a number is refused and is not overwritten;
   - `__proto__`, `constructor` and `prototype` as any segment are refused, change nothing, and do not touch any prototype (assert that a fresh object is unaffected afterwards);
   - a patch that is not a set, on a path the entry lacks, still changes nothing;
   - an existing fixture with patches gives the same result as on main.
3. **In the checker**: each patch that would create a path is listed under the checker's notes ("sets a path the entry doesn't have: <path>"); a patch that would be refused is an error naming the reason. Tests for each; an existing fixture reports as before.
4. **The proposed line for 07** in your status file, in 07's style.

## A database test (you write it; you do not run it)
Add one test to the database tests, in their existing style and beside the existing tests for hidden patches: a patch that **creates** a field named in the target entry's GM-only list stays the GM's, and a player's read of that entry's patches does not include it. You cannot run database tests in the cloud, and must not try: write it carefully from the neighbouring tests, say plainly in the status file that it has not been run, and the coordinating Builder checks the database job's result before this merges. No migration: if the test cannot be written without one, stop and write down why.

## Fences particular to this piece
- No migration, nothing else under `supabase/` but that one test file.
- No screen, no words on any screen.
- Do not weaken the existing rule for any patch that is not a set.
