# Manual checks: night-prep-2026-11-14

1. On the pull request, open the Checks tab. The layout job should be green once it has run (by day it reports
   "deferred"; the night run is the real test).
2. Run `npm run dev` and open the gallery page it prints (`/gallery.html`). Make the window phone-narrow (375 px).
3. Scroll to "Creation: long tables in their sheet". You should see:
   - Each row is one line: the range first ("3 to 4"), then the words.
   - The picked row is marked with ✓.

Gallery pictures this step changes (all four size × theme combos):
- **Refreshed:** places (#783), creation-review, creation-gear (#789), creation-final (#781 ds-8, #789),
  creation-long-tables (#786). These come from those merged pull requests, not from this step.
- **First pictures:** tapped-tables (#780) and stock-rows (#789).
