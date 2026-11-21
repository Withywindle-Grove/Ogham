# Cloud brief: K20, "New until Got it": the seen mark (migration and command; logic only)

**Blocked means stop and report; never reach the end another way.** If a guard, a hook or a permission check blocks you, stop and write what happened in the pull request. Do not try another tool, branch or command for the same result.
Test files are changed only with the Edit tool (new test files may be created). If the hook refuses, stop and report.
If you're unsure, stop and write the question in the pull request. Don't guess.
**Never edit a migration that has been applied anywhere: fix forward with a new one.**
**Hidden means hidden:** enforced by row-level security, and tested on what the database sends, in the stand-in database (`src/testing/fakeDb.ts`) too.

## Objective
Let a player mark their new finds as seen ("Got it"). Until then the finds read as New. This is row K20 of `docs/plans/dec-6-the-whole-pack-tab.md`.

Francis's ruling (pk-13, ruled 2026-11-14; it goes in the lead's next rulings file), in his words: "A player marks their new finds as seen. That is one mark the player writes on their own character, readable only by that player and you."

Our narrowing, which isn't his words: the mark goes only on the player's own APPROVED character.

**That is ALL his yes covers. STOP and say so in the pull request if this needs:**
- any drop, rename or delete;
- the mark on an unapproved character, or on someone else's;
- any second reader or writer: the GM WRITING it, another player reading it, anyone else;
- any change to a policy on an existing table.

## Output
- **Branch:** `dec-6-k20-seen-mark`, from `main`. **One pull request against `main`.**
- **A migration file (SQL), applied NOWHERE.**
  - The Builder applies it through the database session (test project, then main) and names the migration's final version when applying it.
  - Name it with a timestamp after every migration on main; check that list.
- **The command, the logic and the tests.** No screen files: the New tag and the card's place are later rows. Do not edit `src/app/PackScreen.tsx`, `src/app/PlaceCard.tsx` or `src/app/PlayerScreen.tsx`.
- **Status file:** `docs/status/<date>-dec-6-k20-seen-mark.md`, citing pk-13.

## Read first
- The plan's row K20.
- Rulings: `docs/design/rulings/pack-rework-rulings-2026-11-11.md` (pk-5); pk-13 as quoted above.
- **The precedent: a message's read time.** It's `public.read_messages(message_ids)` in `supabase/migrations/20261102120000_m5b_g4_messages.sql:227-247`:
  - a `security definer` function sets `read_at = now()` on the SERVER, for the caller's own messages only;
  - it's refused with 42501 when none are theirs;
  - it's logged as `message.read` at the **verbose** level (`logged_commands` row at :291, gm_only false; its words in `src/core/events.ts`: "read a message");
  - it's set once and isn't undone.
  Do the same here: logging at verbose, no Undo. Check `public.undoable_tables` and the undo lists to confirm `messages.read_at` isn't undoable, and say what you found.
- How finds reach a character: `inventory` rows and their created time. This row is independent of K28.
- What a new command needs (`CLAUDE.md`): `can(user, command, target)`, an event, allowed and not-allowed cases in `src/testing/permissionCases.ts`, and its `public.logged_commands` row in the migration.

## What to build
- **A SEPARATE TABLE** for the mark (e.g. `public.finds_seen`: the character, its campaign, `seen_at`), with its OWN row-level security:
  - the character's owner (its player) inserts and updates it, and reads it;
  - the GM of that campaign READS it;
  - nobody else.
  - Not a column on characters, which every reader of a character would see. Not an update rule on an existing table. If a separate table can't do it, STOP.
- **The mark is a TIME, set by the server in the command** (`now()`), never a time sent by the device and not an event id.
- **A command** (e.g. `character.seenFinds`): a definer function, as in the precedent. It checks that the caller is the character's player and that the character is approved, sets `seen_at = now()`, and is logged as in the precedent.
- **A pure function:** given a character's finds and the mark, which ones are New.

## Tests (each written first as a plain sentence)
- **Database tests** (a new file in `supabase/tests/`; CI's database job runs them):
  - the player sets their own approved character's mark, and reads it;
  - the GM READS it, and the GM CAN'T write it;
  - another player can't read or write it;
  - an outsider can't;
  - a player can't set it on an unapproved character, or on someone else's;
  - the time is the server's, whatever the device sends.
- **Permission cases** both ways in `permissionCases.ts`.
- **Stand-in database tests** for the same rules.
- **The New function:** before and after the mark, and with no mark.
- Invented names only.

## Boundaries
- Add-only: one new table, its rules, the command and its `logged_commands` row. No policy on any existing table changes.
- Applied nowhere: the Builder runs the database session.
