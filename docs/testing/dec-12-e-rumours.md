# Manual checks: dec-12-e-rumours

Piece E of `docs/plans/dec-12-calls-to-adventure-and-notes.md` (mc-65, tb-1, rm-1). On the pull request's Vercel preview (test project), signed in as the GM of a campaign with an adventure attached that has a table of rumours (any of the private adventures; each has one), and a second device or window signed in as one of its players.

1. On the GM's Scene, find **Calls to adventure** on the place card and tap it, then the adventure. You should see **Rumours** after the hooks, with a row for the table: its name, a die, and "d8. 0 of 8 heard so far." (its own die and count).
2. Tap that row. You should see a sheet titled **Rumours**, the adventure's name above it, and the table in the book's style: its name in the coloured bar, a head row with the die, "Rumour" and a crossed eye with "Truth", then five rows, each its number, its words and True, False or Partly at the end. Below: "3 more rows." (or however many) and **Show all 8**. Tap Show all: every row shows.
3. Tap a row. You should see **Who hears it?**, the row's table and number above it, its words in quotes, **Character** and **Party**, and below them a small dashed box with the crossed eye and its truth word. Tap **Party**. A toast says "Sent to the party: <table>, <number>" with **Undo**, and you are back on the table with that row marked and "Heard by the party, day N." under its words.
4. On the player's device, nothing should show the rumour's truth anywhere. (Where the player sees the rumour is piece C's card and piece D's Notes, not built yet; this step checks only that nothing leaks.)
5. Back on the GM's device, tap the same row and **Party** again. A toast says "It wasn't sent again: the party already has it. Nothing changed."
6. Tap another row, then **Character**: the list of characters in play shows, as for a hook. Tap one. The toast names that character.
7. Tap **Undo** on that toast. The row's "Heard by …" line goes away.
8. On a phone (375 px wide): open the table again. Rows wrap their words; the number and the truth word stay on one line; nothing scrolls sideways.

9. Open any of B's steps (the adventure's hooks, a hook). Its title and words are now in the book's faces, like the rumour table; the line on the place card is unchanged.

Pictures expected to change: none in the gallery (the Calls to adventure sheet has no gallery picture). As-built pictures for the lead (pq-1): frames 5 and 6 (light and dark, and a phone), and one of B's frames re-taken (the adventure's hooks list), since the whole sheet is now in the book's scope. Their README states: (1) the sheet is in the book's scope, wrapped by `BookTypeScope` in `CallsSheet`, B's merged frames changing with it, and the line on the place card staying in the app's faces; (2) main is merged into the branch; (3) every picture was taken at the branch's final commit, named.
