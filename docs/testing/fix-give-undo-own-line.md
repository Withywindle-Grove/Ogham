# Manual checks: fix-give-undo-own-line (Give to a player…: Undo, "From your GM", the refusal words)

Use the preview of the pull request (the test database). As the GM, have a campaign with two players (call them Sam and Robin) and one character of your own (Ash).

1. **Undo undoes this give only.** Open the campaign, then **Players**, in two browser tabs. In tab 1, tap **Give to a player…** on Ash and tap Sam: the toast says "Ash given to Sam." with **Undo**. Within the toast's seconds, in tab 2, give Ash to Robin. Back in tab 1, tap **Undo**. You should see "That's changed since. Undo the later change first." and Ash stays Robin's: Robin's give is never the one undone (the log shows tab 2's line still standing). Without a second tab, Undo works as before: Ash is yours again.
2. **"From your GM" survives an undone give.** Give Ash to Sam. Then give Ash to Robin and tap **Undo** on that toast. Sign in as Sam: in **Your characters**, Ash's card still says **"From your GM, <date>"**.
3. **The refusal words.** Open **Give to a player…** on Ash and leave the sheet open. In another tab, remove Ash (archive it, then delete it). Back in the first tab, tap Robin: the toast says **"You don't have permission to do that."**, not "Robin is no longer in this campaign". Then repeat with a player who really left: remove Robin from the campaign in the other tab, tap Robin's row: "Ash wasn't given: Robin is no longer in this campaign. Nothing changed."

Gallery pictures: none change (no screen changed; only which line Undo picks, which cards show the line, and the refusal's words).
