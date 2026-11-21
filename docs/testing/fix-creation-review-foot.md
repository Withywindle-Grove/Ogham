# Manual checks: fix-creation-review-foot

The creation review's foot on a phone (frame 22-G1) and the sent-back note's author line (frame 22-G5).

1. On a phone (or the browser at 375 px wide), make a character up to its review (Step "Review").
   You should see: the grey line ("Goes to the GM for approval") straight above the buttons, with no empty space
   between; "Start over" and "Save and leave" side by side at the right; "Send to the GM" on its own row below them,
   at the right, only as wide as its words. No "Back" button in the foot.
2. Leave a step unfinished (for example, skip a language) and come back to the review.
   You should see: the warning line (with the sign) above the buttons, still with no empty band, even if it takes two lines.
3. On an iPad (or 820 px wide), open the same review.
   You should see: the line at the left, then "Start over", "Save and leave" and "Send to the GM" on one row at the
   right, as before.
4. As the GM, send a waiting character back with a note. Sign in as its player and open the character.
   You should see: under the note, a small grey line "<the GM's name>, your GM, today".
5. The next day (or with a note sent back earlier), open it again.
   You should see: "…, your GM, yesterday", or the day and month ("6 Nov") for an older one.

## Gallery pictures this changes

- The two "Creation review" specimens (the review's foot at phone width: no band, Send at its own width).
- The organisms review specimen (the GM's note now has its author line, "Priya, your GM, today").

No baseline is updated in this pull request.
