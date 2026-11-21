# Plan: a reveal belongs to its campaign, and players read the ways on (hd-2; December step 4, piece e)

Written by the builder, 2026-11-12, from the coordinator's brief. Rulings: hd-2 (`docs/design/rulings/m5b-morning-rulings-2026-11-11.md`, Francis: "A"); mc-28 (`docs/design/rulings/scene-mockup-rulings-2026-11-11.md`); pt-f1 to pt-f3 (`docs/design/rulings/dec-point-travel-format-2026-11-11.md`); piece (e) of `docs/plans/dec-4-point-travel.md`. Model: Fable (row-level security and hidden data; approved by Francis).

## Goal
1. **hd-2.** An item opened to players in campaign A (revealed, put on sale, listed in a starting kit, or named as a patron's garb) is opened in campaign A only. A player who is also in campaign B, on the same pack, reads nothing new in B.
2. **4e (mc-28).** A player's device can ask for the ways on from where their group is. A hidden route is never sent. A way's far end has no name ("not yet explored") until that place has been shown to their group. No travel cost is sent.

## Why one function per question, and not a plain rule
A pack's entries have no campaign: the same row serves every campaign the pack is attached to. A row-level rule can only say "this person may read this row", never "in this campaign". So the campaign has to be asked for by name: the device calls a function with the campaign, and the database answers for that reader in that campaign.

## Steps
1. **Migration** `supabase/migrations/20261111190000_dec_hd2_ways_on_read.sql`, one file, built and held (applied nowhere).
   - `private.item_open_in(campaign, item)`: the four reasons an item is open to players, in one campaign (known, for sale, in a kit, a patron's garb). New.
   - `private.patch_open_in(campaign, pack, patch)`: #629's patch rule, for one campaign. New.
   - `public.campaign_library(campaign, packs)`: every entry of the campaign's packs this reader may see **in this campaign**. The GM: all of them, as today. A player: the player-facing kinds, an item only when open in this campaign, a patch only when its items are. New.
   - `public.campaign_ways_on(campaign)`: for each group the reader is in, the routes leaving its current place: the route's row id, and the far place's id and players' name, or nothing for both while that place hasn't been shown to the group. Never a hidden route, never a cost, never the pack's own ids (they can read like names). New.
   - `private.item_readable(pack, item)` replaced (newest: #636's `20261111130000_dec_1a_patrons.sql`, keeping its patron-garb reason): a direct read of the table now needs the item open in **every** one of the reader's campaigns that attach the pack, so a reveal in A alone no longer opens the row for someone also in B. The read rule on `library_entries` calls this function and so narrows without being rewritten; `private.patch_open_to_me` follows the same way.
   - `public.campaign_exceptions(campaign)` replaced (newest: `20261029090000_m4b_rulings_fixes.sql`): a player's exceptions for items follow this campaign only.
   - Drops, renames and deletes no data; writes no rows.
2. **App.** `loadCampaignEntries` (src/modules/library/campaignPacks.ts) asks `campaign_library` for everyone (the GM gets the same rows as before; hidden fields still come from `library_entry_secrets`, the GM's). The device's pack cache moves to a new format number, so copies stored under the old rule are dropped once. A small reader for the ways on (`loadWaysOn`), no screen: the Move on sheet (piece b) draws it.
3. **Stand-in database** (`src/testing/fakeDb.ts`): the two new functions and the narrowed direct rule.
4. **Types** (`src/core/database.types.ts`) by hand: the migration can't run here.
5. **Docs**: 03 (hidden means hidden: reveals; routes), 07 (routes: who reads them), the visibility matrix (`npm run docs:gen`), status and manual checks.

## Tests (each purpose as a plain sentence)
Database (`supabase/tests/dec-hd2-ways-on-read.test.ts`; first run is CI's local database):
- A player in two campaigns on one pack: an item revealed in campaign A is in A's answer and not in B's, and a direct read of the table doesn't return it.
- The same for an item on sale through A's homebrew copy, and for an item in a kit of a pack only A attaches.
- A player of campaign B only never reads A's reveal, by the function or directly.
- A patch naming a revealed item follows the same campaign.
- The GM reads every entry of the campaign's packs through the function; a player in one campaign reads there what they read before.
- Someone who isn't a member gets nothing from either function.
- A player gets the open routes from their group's place; the hidden route is in nothing they receive (the function, a direct read of the library, the log).
- The far end is nameless until a piece of that place is shown to their group, then carries the players' name; another group's player still gets no name.
- A one-way route is listed only from its start.
- No answer carries a cost, the pack's ids, or the route's type.
Unit: the stand-in database's mirror of both functions and the narrowed rule; `loadCampaignEntries` through the function; `loadWaysOn`; the cache format.

## ⚑ (listed, not decided)
1. **Costs.** Nothing in the data marks "the GM has shown this cost", so players are sent no cost and no way of moving (not "Rowing", not "3 turns"). To show either, something must record that the GM showed it: a design question.
2. **Hidden routes later shown.** Piece (e) speaks of a "shown" record per campaign for a hidden route the GM reveals. Not built: a hidden route is the GM's throughout (pt-f3, mc-28). It needs a new table and a GM action.
3. **Open routes and exits not yet shown.** A place's exits are shown to players piece by piece; this sends every non-hidden route from the group's place at once, as mc-28 says. If a way on should wait for its exit piece, that is a different rule.
4. **"Shown to their group"** is read as: a piece of that place has been shown to that group on any visit (the rule What we know already uses). Chosen: this, because it sends no name a player can't already read.
5. **A player in two campaigns** now gets an item by direct read only when both campaigns opened it; the app no longer reads items that way, so nothing on screen changes. Chosen: narrow, since the rule can't tell campaigns apart.
6. **The stamps of #629** still move in every campaign sharing a pack when one campaign reveals something. Now wider than needed (a reveal reaches only its own campaign); harmless, one extra download. Narrow them back later?

**Ruled since:** ⚑ 1 is closed by mc-28a (Francis, "B", 2026-11-12): players see how each way they are shown is travelled and how long it takes.

**Answered by the Conductor, 2026-11-12** (relayed by the coordinator): build as planned. 1 and 2 stay **open for Francis**, queued as their own question (until then: no cost and no way of moving sent; a hidden way stays the GM's). 3 and 4 are right as mc-28 reads. 5 and 6 are technical and approved (also under Departures, for the reviewer).

## Estimate
One builder turn on Fable for the migration, app, stand-in and tests; CI's first database run may bring a fix round.

## Departures
- The migration assumes #636 (`20261111130000_dec_1a_patrons.sql`) is applied before it: merge and main-push order #636, #629, #634, then this. So that this branch's CI can build a database without #636, the migration states `private.item_in_patron_garb` itself with `create or replace`, word for word as #636 has it; if #636 were applied after this one it would fail loudly on that function, not quietly undo this change.
- Piece (e)'s "shown record per campaign" for hidden routes is not built (⚑ 2). Its "a player's Scene lists the ways on" is not built either: the brief keeps the screen for piece (b).
- The read rule on `library_entries` is not rewritten: it is narrowed through `private.item_readable`, which it calls.
- Technical choices approved by the Conductor (2026-11-12): a direct read of an item now needs it open in every one of the reader's campaigns that attach the pack (⚑ 5); #629's stamps are left as they are, wider than now needed (⚑ 6).
- A fallback for a database without `campaign_library` was built, then taken out in #645's review round (2026-11-12): held pull requests merge after their migration is on main.
- Review round of #645: `campaign_library` reads by key (`after_id`, `page_size`), not by offset, and works out the campaign's open items once per call (`private.items_open_in`); a route's ends are trimmed in the SQL.
- **mc-28b (Francis, "a", 2026-11-12; first built as the lead's interim ruling):** no way's far end is named to a group until something of the place it is standing in has been shown to it. **mc-28c:** "shown" means on any visit, the same test as the far end's (what was revealed stays known), so a group coming back to a place it knows has its ways at once. Built in `campaign_ways_on` and the stand-in.
- Two existing tests (`src/app/packCache.test.ts`, `src/app/keptSettingRows.test.tsx`) counted the old read; they now count the new one.
- **Left for a mockup** (Francis's standing rule, relayed 2026-11-12: nothing a person can see is built without a mockup he has approved): the ways on in a player's Scene and on the Move on sheet, the words "not yet explored", and a tap to propose a way. This piece changes no screen, word or button: database functions, the loaders and tests only.
- **mc-28a (2026-11-12), after the first plan:** `campaign_ways_on` also returns each way's ways of moving (`ways`: by, name, value, unit; nothing else of the route's travel), read as the app's `routeWays` reads them. They sit behind the same gate as the far end's name (mc-28a doesn't say; the safe side, a ⚑ for Francis).
- **Ruled by the lead, 2026-11-12 (reading mc-28b):** until something of the place a group is in has been shown to it, `campaign_ways_on` sends no row at all for that group (first built as nameless rows).
