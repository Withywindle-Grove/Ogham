# m8b-0 delivery 5: safety is a question at End expedition (ruled 2026-11-06; plan `docs/plans/m8b-0-places-from-packs.md`, pull request 4)

Needs the migration `20261106130000_m8b_0_safe_place_answer.sql` on the database the build uses (the preview uses the test project, where it is applied). Any setting with an exploration mode works; no pack beyond the usual.

1. **iPad, GM, Scene:** Start expedition with Where? "Brackenford". On its place card there is **no "Safe or hostile" row** any more.
2. **Where now?** "The Old Mill", then **Where now?** "Brackenford": **no card** appears under the strip ("The party is back in a safe place" is gone). The main advance stays the accent.
3. Tap **⋯** (Time options): End expedition's grey line reads "You'll be asked whether the party is somewhere safe". Tap **End expedition**: it ends at once (no pop-up).
4. The **Expedition ended** summary's first line, under its heading: "In a safe place?" · **Yes** · **No**, two small grey buttons, neither pressed. No "Staying a while?" yet.
5. Tap **Yes**: Yes looks pressed (heavier edge); under the summary "Staying a while?" · **Start downtime** · **Not yet**, both grey.
6. Tap **No**: No looks pressed, and "Staying a while?" goes. Tap **Yes** again: it comes back.
7. Tap **Undo** on the summary: the expedition is under way again. End it again from ⋯: the question is back unanswered (neither pressed).
8. Answer **Yes**, then **Not yet**: the offer goes; the party stays in Adventure. Close the summary; **⋯** still offers **Start downtime**.
9. **The log:** open **Log** (Simple): one line, "You ended the expedition in a safe place after …". Switch to Verbose: the answer has its own line too ("You said the party ended in a safe place.").
10. End another expedition and answer **No**: the Simple log line is the plain "ended the expedition after …"; ⋯ still offers Start downtime.
11. **Players (a phone signed in as a player):** at every step above their Scene shows no question, no offer and no Safe or hostile row.
12. **Phone 375 px, GM:** the summary's "In a safe place?" line and its two buttons fit without sideways scrolling (they wrap under the question if needed); Start downtime · Not yet wrap the same way.
13. **A town marked before this change** (an older campaign with a place marked Safe): its town screen still shows on that place. A place named from now on has no town screen (expected until pull request 2: towns from a pack's settlement).

Gallery: the new section **End of an expedition** (`gallery.html`, last section): the summary unanswered, after Yes and after No; tap the buttons to change the answer.
