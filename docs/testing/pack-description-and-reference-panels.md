# Manual checks: pack-description-and-reference-panels

Use the pull request's Vercel preview (test project), signed in as a player in a campaign whose setting includes the current private compendium pack (its classes and kindreds have a `description`).

1. Open the campaign, tap **New character**, and go to the Kindred step. Tap a kindred's name (the text, not Pick). You should see its one-line blurb, then one or more paragraphs of the book's description, then the headings as before.
2. On the Class step, tap a class's name. The same: blurb, then the description's paragraphs, then the headings.
3. Back on the Kindred step, open a kindred whose entry has open-class chips and tap a chip. The class you open shows its description too.
4. Finish the character to the review step and tap the kindred or class value. The entry that opens shows the description.
5. Open the finished character's sheet and tap the kindred or class. The description shows there too.
6. In a campaign with a pack whose classes have no `description`, open a class. The entry looks as it did before: no extra paragraphs.
7. On a phone width (375 px), open a class with a long description. The sheet scrolls; the text wraps and nothing runs off the side.
8. Optional: run `npm run pack:check -- <pack file>` on a pack where a class's `description` is a list, or a panel's `gmOnly` is `"false"` (in quotes). You should see one warning for each.

Not to check yet: GM reference panels marked `gmOnly: false` stay GM-only (scope check in the status file).

Gallery pictures expected to change: none.
