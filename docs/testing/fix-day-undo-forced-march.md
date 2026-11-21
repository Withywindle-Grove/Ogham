# Manual checks: fix-day-undo-forced-march

On the pull request's Vercel preview (test project), as the GM, with a campaign whose rules have travel and a forced march.

1. Start an expedition in a travelling mode. The travel card shows "<points name> N of N".
2. As a player (or the GM), tap Force march. The card reads more points (for example 6 of 6), and the camp's Sleep step says "Rest due (forced march)".
3. Tap Next day twice. The card shows a fresh day each time, with no forced march.
4. Tap the strip's Undo twice. The heading goes back to day 1. The card reads the forced total again (6 of 6), and "Rest due (forced march)" is back in camp's Sleep step.
5. Tap Next day once more. Day 2 starts afresh: its own points, with no forced march.
6. In Downtime, tap +1 day, then Undo. The clock goes back and the toast says "Put the clock back", as before.

No gallery pictures should change.
