# One-off items from creation come in approved (bq3-6)

Technical step; written by the builder session (Francis accepted the builder's recommendation B on bq3-6, 2026-11-04, and approved Fable for it: it changes the guard on players' item lines). Rests on `design/rulings/m5b-builder-questions-3-2026-11-04.md` (bq3-6, bq3-7) and `m5b-0c-creation-survey.md`, Departures: PR 3's scope check "a trinket waits for the GM like any one-off" and PR 4's "Tied to PR 3's open scope check".

## The problem
The database (`private.guard_lines_from_players`, newest in `20261030100000_m5_small_fixes.sql`) makes every player's one-off item wait for the GM, unless the campaign's **One-off items need approval** is off. A new character's trinket (PR 3: a table row is no library item) and a kit's or background's `{ name }` lines (PR 4, rc-3) are one-offs, so they wait in the pack and on the GM's **Waiting for you**, beside the character's own approval: one extra tap per new character, for an item the GM reviews anyway when approving the character.

## What to build
1. **Migration `20261104140000_m5b_0c_creation_one_offs.sql`** (one file; replaces one function; drops, renames and deletes nothing). `private.guard_lines_from_players`, from its newest definition, plus:
   - **Insert:** a player's one-off on a character **of their own that isn't approved yet** (`kind = 'pc'`, `owner_type = 'user'`, `owner_user_id = auth.uid()`, `approval` draft, pending or rejected) comes in **approved**. The character's own approval covers it: the GM sees the pack when approving the character. Everything else is as before: an approved character's one-off waits (unless the campaign's setting is off); "given" is the GM's; a split keeps its stack's approval.
   - **Update:** a one-off that **leaves** a never-approved character of yours (its `actor_id` changes) waits again, as if added where it lands (pending, unless the campaign's setting is off). So the creation path can't be used to put an approved one-off on an approved character by moving it. Nothing else in the update branch changes.
   - Who else: another player can't add to a character they don't own (row-level security, unchanged); the GM passes the guard as before; a one-off on another player's character is refused before the guard runs.
2. **The app's fake database** (`src/testing/fakeDb.ts`) mirrors the rule, so the app tests see what the real database does.
3. **Words and tests that said they wait:** `src/app/kitLines.test.tsx` and `src/app/kindredTables.test.tsx` expect `approved`; `scripts/pack-additions.mjs`'s rc-3 note no longer says the line waits for the GM; `docs/testing.md`'s PR 4 check (the Spell book one-off) says it's in the pack at once. No screen words change: the Gear step never showed a waiting line as waiting (it filters them out of the load), and the trinket row's words don't mention approval.
4. **Docs:** 04 (`oneOffApproval`, InventoryLine.approval), 05 (One-off items), 07 (rc-3's line), a 09 line, testing.md (manual checks), the follow-ups file, the board, and the creation-survey plan's two open notes (closed by this step).

## Tests (purpose first)
Database (`supabase/tests/m5b-0c-creation-one-offs.test.ts`, test project only):
- "A player's one-off on their own draft comes in approved, with the campaign's one-off approval on."
- "A player's one-off on their own character that was sent (pending) or sent back (rejected) comes in approved too."
- "A player's one-off on their own approved character still waits for the GM."
- "A player can't put a one-off on another player's draft or approved character."
- "The GM's one-off on a player's character is approved, as before."
- "A one-off moved off a draft to the player's approved character waits for the GM again."
App:
- `kitLines.test.tsx`: the `{ name }` line is approved on the draft; `kindredTables.test.tsx`: the trinket is approved.
- `pack-additions.test.mjs`: the rc-3 note's new words.

## ⚑ for Francis
- **Ruled oo-1, as built** (Francis, 2026-11-04, `design/rulings/m5b-one-offs-approval-off-2026-11-04.md`). The question was: with **Characters need approval** off and **One-off items need approval** on, a new character's trinket and `{ name }` lines now join with no GM look at all (the character joins at once, and its creation one-offs come with it). The ruling says the character's approval covers them; with that approval off, nothing does. Fine as built (the GM put those tables and kits in play), or should one-offs wait when the character didn't?

## Estimate
About 8 turns on Fable. One migration, test project only.

## Departures
(The builder keeps this current.)
- **Built as planned** (2026-11-04). The migration was pushed to the test project with three empty placeholder files for versions the test project carries from other open branches (`20261104110000`, `120000`, `130000`), deleted after the push and never committed, as the builder brief says.
- **Silent choices (standing rule 2026-10-31):** the rule names `kind = 'pc'` only; a player's pending companion (hireling, animal) keeps today's behaviour, its one-offs waiting. "Sent back" (`rejected`) counts as never approved, so a one-off added after the GM sends a character back comes in approved: the GM reviews it again on re-send.
- **Not changed:** `supabase/tests/m4b-draft.test.ts` buys a one-off on a draft and never asserted its approval; it still passes (the line is now approved rather than waiting).
- The checker's rc-3 note now says the line "joins the new character's pack at once, covered by the character's approval" (it used to say it waits for the GM).
