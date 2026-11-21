# Manual checks: fix-score-popup-repeats

You need a character in a campaign whose setting is classic-advanced, with Constitution 12 (Francis's fighter will do).
The pull request's Vercel preview uses the test project; or check on the live app after the merge.

1. Open the character, tap **Full character sheet**, and tap the **Constitution 12** tile.
   You should see "Hit points" **once**, as the start of its sentence ("Hit points: Applies when rolling…"), with no
   bare "Hit points" line above it. Before this fix: "Hit points", "Hit points", then the sentence.
2. Close it and tap another score whose lines differ (for example Strength). Every line it showed before is still
   there, in the same order: nothing that says something different is dropped.
3. Optional: a score with a modifier line (a high or low score) still ends with its modifier line.

Gallery pictures expected to change: none (no layout or words change; the gallery's settings have no repeated lines).
