# Brief for the Design Studio: the Pack tab, reworked (2026-11-11)

Written by the lead (Conductor). **You produce mockups and a proposal note; you report to the lead; you never ask Francis for a ruling and never edit rulings, 09 or specs.** Start from this file and the files it names.

## Objective
Francis, planning the campaign that starts on 5 December: "we need to do a visual rework of Pack and make sure it works properly (including party stash)." On the first night his players buy things in a port, find treasure and items on an island, and share some of it. So the Pack tab is where "what they find" lands, and it must be easy to read and to act on at the table.

He has not yet said what he dislikes about today's Pack tab. So your first job is to find out from what exists, and to propose.

Redraw the **player's Pack tab** (what a character carries: worn, at hand, in containers, the purse, the load) and the **party stash** (the shared store: what is in it, who put it there, taking and adding), in the visual language of the Scene redesign he has been ruling on (`docs/design/mockups/scene/`, and `docs/design/rulings/scene-mockup-rulings-2026-11-11.md`): a title and one line of identity, facts in a row, bold lead-ins, tables as titled rows, actions as short panels at the right edge where a step is asked, an answer that moves on with Undo.

**The mechanics stay:** the commands, what is logged, Undo, encumbrance as the setting counts it, who sees what (other players' purses stay hidden; a Down or dead character's pack opens to the others, as ruled 2026-10-29). You change arrangement, hierarchy, words on controls, and how an action is presented. If the mockups need a behaviour changed, it goes on your ⚑ list.

## What to produce
1. **An audit first, one page** (in your proposal note): today's Pack tab and party stash against the self-review list (Nielsen's ten; every state; contrast; 44 px targets with 8 px between; a 375 px width; messy data; no disabled buttons; Undo over confirm; one accent button per screen; never colour alone). Work from the gallery's pictures of the Pack screens, `docs/design/r1/`, 05 and 06. Say what you could not see. If you need a fact about what the app really does (the stash's permissions, how a found item arrives, what "Give to…" offers), ask the lead: it gets the Builder's answer.
2. **Mockups**, one HTML page per proposal in `docs/design/mockups/pack/`, light and dark side by side, iPad landscape first, then a wide PC window, then the phone at 375 px (Francis: "primarily for iPad and PC, with phone a distant third"):
   - (a) the player's Pack tab, standing;
   - (b) the party stash, standing, for a player and for the GM;
   - (c) the short actions: an item's sheet; give to someone; put in a container; drop; use one of a stack; split a stack; take from and add to the stash; coin into and out of the stash;
   - (d) **a find arriving**: the GM hands a character (or the stash) an item or coin picked from the adventure's pack; what the player sees; an unidentified item (its bonus hidden until identified, ruled 2026-11-10).
3. Every state (empty pack, empty stash, loading, a container nested in a container, 60 items, an over-loaded character, offline, a refusal), and messy data (long item names, 0 and 999, a stack of 1).
4. **A proposal note** `docs/design/notes/pack-rework-proposal-2026-11-11.md`: the audit; what changes and why; what is NEW behaviour against re-arrangement (ask the lead for the Builder's facts before labelling); numbered ⚑ questions, one decision each, each asked once, with your recommendation.

## Read first
- `docs/05-features.md`: inventory, encumbrance, containers, the party fund and stash, giving and dropping; `docs/03-roles-permissions.md` for who sees and does what.
- `docs/06-screens-and-design.md`: tokens, the component inventory (At hand, the item sheet, the load line), the words and voice guide.
- The gallery's Pack and item pictures; `docs/design/r1/` for the approved screens this replaces; `docs/design/mockups/index.md`.
- Your own Scene pages for the shared parts (`scene.css`, `scene-seq.css`): reuse them; name any new variant.

## Boundaries
No code, no `src/`, no `supabase/`, nothing from `packs/`. Don't redesign the Sheet or the Scene. Invented examples only ("Bog lurker", "Lantern Warden"). Tokens from 06 only; a new value is listed for approval, not used silently. One push per finished batch; your own board row. Order: the audit and (a) first, as one message to the lead with pictures (one PNG per frame, dark, iPad first, in your scratchpad); then (b), (d), (c). If unsure, stop and ask the lead; don't guess.

## Time
This sits at step 6 of the December plan (`docs/plans/december-first-play.md`), wanted built by about 1 December, so Francis needs to rule on (a), (b) and (d) by about 20 November. The audit and (a) today if you can.
