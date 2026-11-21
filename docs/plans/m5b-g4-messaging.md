# Plan: M5b step g4 — messaging (B3)

Written by the design agent, 2026-11-01 (M5 gate B3 ruling). Read the specs it names; this file makes no rulings. **Qualifies for Fable**: a new record with row-level security that must hide messages from everyone but the two parties.

## What this step delivers
One private messaging feature **between the GM and a player only**: the ✉ icon with its unread count in the top row (GM and players), the **Messages** list (GM: one thread per character; player: one thread with the GM), a thread with text (no autofocus), **Attach** (Handouts · A file; From the adventure comes in M8b), one switch **Disappears once read**, **Send** (accent, Undo 8 s), the **silent arrival card** on Scene. It **replaces** Send, From the GM and the Hit panel's Send (now "Message…").

## Already built (verify first; then remove)
`SendSheet`, the "From the GM" list, `close_message`, Keep in Handouts / Burn after reading (M5 step 11). Handouts' storage for attachments does not exist yet: a file attachment is an image kept in Supabase Storage under the campaign, visible to the two parties only.

## Rests on
- 05: *Messaging* (B3) and the lines it marks replaced.
- 06: *Messages* row; *Top row*; *Dungeon on Scene: the players' table view* (the prompt slot); `design/mockups/m5-gate/b3-messaging.html`.
- 03: *Messaging* row (GM to any character; player to the GM only).
- 02: Storage is in the stack; no new dependency.

## Build order
1. **Record and RLS.** `messages` (thread by campaign + character; sender; text; attachment ref; disappears flag; read_at); RLS: the GM and the character's owner only. Migration on test first; Fable builds it.
2. **Commands:** `message.send` (Undo within 8 s = a reversing event; the text stays in the GM's log), `message.read` (sets read_at; a disappearing message's row is hidden from the player after close, kept for the GM), `message.attach`.
3. **Screens:** ✉ icon + count (TopRow), Messages list, thread, New message (GM picks one or more characters; a message to several lands in each thread), Attach sheet (Handouts · A file).
4. **Arrival card** in the players' prompt slot; works in quiet mode; no preview.
5. **Hit panel:** Send → Message… with the result attached as text.
6. **Remove** SendSheet and From the GM; migrate nothing (old messages stay in the log).

## Tests (purpose first)
- A player's query never returns another player's thread (database test as two players).
- A disappearing message leaves the player's device after close and stays in the GM's log.
- Undo within 8 s removes the message from the recipient's thread.
- The unread count matches unread rows and never shows colour alone.
- Offline: a send queues and shows "Sends when back online" (smoke test with the network off).

## Scope checks (write one and stop)
- No player-to-player messages; no Everyone.
- No From the adventure attachments (M8b).
- No keep-as-handout action (M8b).

## ⚑ for Francis
Ruled 2026-11-01 (09): attachments up to **10 MB**, and **only the GM** may attach a file; players send text only.

## Estimate
25–35 builder turns. Independent of g2, g3, g5.

## Departures
(The builder keeps this current in the same pull request.)
- **Two commands, not three.** `message.attach` is folded into `message.send`: the picture is part of the send (its name, type and size go in the row; the file is uploaded next to each message made, and a failed upload takes the send back). A separate attach command would have meant a message row without its picture for a while, visible to its recipient.
- **A player's "Disappears once read"** works the same way as the GM's (the switch is in every thread, as 05 says): the GM sees the message until they close it, then it leaves the GM's thread; the GM's log keeps the text as it keeps everything. Nothing is hidden from the GM for good.
- **A player with several characters in play** writes as one of them, picked with a chip row above the field (the first by name to start); the spec says "as their character" and doesn't cover two.
- **Attach → Handouts** is tappable and explains that Handouts come with M8b (never a disabled button); nothing can be picked there yet. **From the adventure** is a line of words in the sheet, as the plan says (M8b).
- **Offline:** a send waits in the app's memory for this visit ("Sends when back online" on the toast and under the waiting bubble) and goes on the browser's `online` event; a reload loses it. M9's queue replaces this.
- **The old `message.close` logged-command row is deleted** (configuration, not data; as `20261024140000_m4_at_hand.sql` did for `inventory.showAll`): `m3-health.test.ts` requires every row to name a live command. The old `gm_messages` and `message_recipients` rows, tables and functions stay untouched, and the log reads the old lines as before.
- **A second migration** (`…121000_m5b_g4_messages_fixes.sql`) fixed forward what the database test found in the first: a player's Undo was refused by the reading rule (an undone row must stay readable by its sender), and `send_messages` returned nothing without a request tag.
- **The Messages screen opens in the log's full-screen panel** (`LogPanel`, with a `label`) rather than a screen of its own: one part reused, the same Close and swipe-down.
- **Quiet mode** isn't built yet (M8), so "works in quiet mode" couldn't be checked.
