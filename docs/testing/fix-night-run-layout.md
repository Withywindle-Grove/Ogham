# Manual checks: fix-night-run-layout

1. Run `npm run dev` and open the gallery page it prints (`/gallery.html`). Make the window phone-narrow (375 px).
2. Scroll to "Creation: the final drafts' pieces" and find "A table in the book's style (ds-8)". You should see:
   - Level, Experience and Hit dice each on one line ("9d8 + 15" never splits).
   - Only the titles ("Keeper of the Long Causeway") wrap.
3. In the same section, find the Lantern Warden entry's level table. You should see:
   - The last column runs to the right edge.
   - Swiping the table sideways shows "9d8 + 15" whole.
   - The page itself never scrolls sideways.

Gallery pictures this step changes:
- **creation-final:** the ds-8 table's figures are on one line. This picture comes from this pull request's own CI run.
- **The refreshes listed in the status file:** these come from the book type and the new parts merged since the
  pictures were last approved, not from this step.
