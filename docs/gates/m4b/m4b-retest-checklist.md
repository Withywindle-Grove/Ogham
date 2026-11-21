# M4b re-test checklist (2026-10-26)

Production after the re-test PRs merge (updated 2026-10-26). Run each line on the **tablet (landscape) and the phone, light and dark**. Tick ✓ / ✗ and note what you saw. ★ = failed at the gate; ★ new = re-test ruling (2026-10-26).

## Your campaigns, Join, ⋯
- A1: open the app → no Ogham saying anywhere.
- A4: Join a campaign → Join and "Which way?" (Guided / Freeform) are two choice cards; one tap moves on.
- A7: player ⋯ → items in the ruled order (words batch 1).
- A12 ★: phone A open on a character; on phone B the GM changes its HP → A updates in seconds. Lock A for 2+ min, change again, unlock → it catches up without a reload.

## New campaign and Rules (GM)
- A2: New campaign → three steps; encumbrance sits on the Setting rules step; time comes from the setting's presets.
- A3: Character fields → hold a field, drag it to a new place (no arrows).
- B15: Rules tab → "Rules for this campaign" is first; groups collapsed with "N changed from default"; each row names its source.
- Ruling 4 ★ new: Rules for this campaign → Optional rules → categories open on their own; ⓘ explains a rule; Use all defaults. Setting rules → a pack's Optional rules is read-only → "Change in Rules for this campaign" opens that group.
- Ruling 1 ★ new: GM ⋯ → Companies, then This device (no Players' characters or Rules); Companies opens the Players tab at Companies. With something waiting the tab reads "Players · N waiting".
- B21 ★: "New characters start at" → four rows, each with its meaning. Pick Fixed level 5 → the stepper stops at the class's highest level.

## Character creation (player)
- A5: Guided → each step has one short instruction at the top; detail behind ⓘ.
- B17: race and class → tablet: list left, detail right with Choose; phone: rows, detail as a sheet; not-allowed options visible with ▲ and the reason.
- A6: the heading reads "<Race> <Class>"; HP, alignment, literacy and languages have guided lines.
- A9: leave a score blank, tap Next → a message names what's missing.
- B21 ★: You start at the level the GM set (Party's lowest shows the number; Player proposes shows a stepper).
- B18: send; as GM send back with a note and tick Backstory → the player's card says "sent back · tap to open"; it opens full screen on the review with the note pinned and Backstory marked. Tap it to fix it.
- B18: tap Resend with a step still marked → the pop-up lists what's left, with "Fix …" and "Resend anyway".
- Ruling 7 ★ new: on a sent-back review tap Gear (or Starting money) → the shopping reopens showing what was bought; buy more or remove something, Done → the review shows it.
- Ruling 8 ★ new: in that reopened shopping (draft or sent back), remove a bought item (a kit refunds its kit price) → the full price comes back to Gold left. Once approved there is no shopping; gear changes go through the Pack, no refunds.
- Ruling 9 ★ new: a player rolls HP and money for a guided draft and stops before Send → the GM sees no character card, count or log lines. (The rolls are kept, labelled "draft · {Name}", for the GM roll list when it's built; there's no roll list screen to check yet. Covered by automated tests.)
- Ruling 6 ★ new: Guided → the details step says Next (it saves a draft) → Gear → Review → Send to the GM. Before Send the GM sees nothing (no card, no count, no log lines). Close the app at Gear, reopen → Your characters shows "Not sent yet · tap to continue"; tap → it continues at the shopping (or the review if the shopping was done). Freeform keeps its flow.
- A6: GM's waiting card → same review layout: scores once, overrides and broken rules marked ("rolled 14"); no section tinted.
- A8: Your characters → one tap opens a character; the sent-back card opens its review.

## Sheet
- B20, A13: full sheet → Combat first (HP, AC, attack, level), abilities as tiles that open what the score does; no "From your setting" heading.
- B25 ★ new (slot-test-homebrew 0.4.0+ attached): a Lantern Warden equips heavy armour → it's allowed, with a toast "… stops … casting" and Undo; the status (the pack's name for it, e.g. "Can't kindle") shows on the card and Player screen; tap it → why; the armour's Pack row says it stops casting; Undo (or unequip) → the status goes.

## Pack
- A10 ★: equip armour or a weapon the class can't use → it stays unequipped; a pop-up says why with its source.
- A10 ★: two-handed weapon while holding a shield → the pop-up offers "Stow the shield".
- B19: Add item → Put it → a vertical list: Equipped / Containers / Party stash, room left per row, full ones say Full; the button names the place ("Add to Backpack").
- B24, B19: Give a stack → how many (starts at all, "All N") and the destination list in one sheet; it starts on the last place you gave that kind of item to, else the first with room (the Party stash).
- B19 ★ new: give arrows to a character, then open Give on more arrows → that character is already chosen. Same for Put it and Add item's Put it.
- B23, ruling 5 and 5b ★ new: give part of a stack → 8-second toast with Undo → the stack is whole again. Give part (e.g. 6 torches) to a character, that character drops 2, then Undo the give from the log → what's left comes back, with a toast "4 of 6 torches came back · {Name} used 2". If they used all of it, Undo is refused with the reason.
- B23: drop an item → toast with Undo → Undo puts it back.
- Undo twice ★: drop, Undo from the log, Undo again → the second is refused; nothing doubles.
- A11: cause an error (e.g. go offline and save) → it shows as a toast, not a box in the page.

## Look (every screen)
- B16: buttons have a soft shadow and lift; pressing drops them 1 px; rare actions are underlined quiet buttons; dark mode's accent is copper.
- A14, ruling 2 ★ new: Rules for this campaign → Table and players → Companies ⓘ → no titles sentence.

## Journeys (automated, phone 375 px and tablet 1180 px, both pass)
- 6a Give a single item: 3 taps (budget 4), 1 screen change (budget 1).
- 6b Give part of a stack: 5 taps (budget 5), 1 screen change (budget 1).
- 8 Write a log note: 3 taps + typing (budget 3), 0 screen changes (budget 0).
- Pending, screens not built: 1 Start a session, 2 Turn nothing due, 3 Turn a check due, 7 Do an activity, combined GM turn (M5); 4 Take damage, 5 Light a torch, 9 Show a picture, 10 End the expedition (M5/M6).
