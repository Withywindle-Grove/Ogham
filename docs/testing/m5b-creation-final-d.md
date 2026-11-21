# Manual checks: m5b-creation-final-d (creation final drafts D and F)

Run `npm run dev`, open the URL it prints, sign in as a player in a campaign with the fen sample pack (or your own test campaign), and tap **Create your character**, then **Guided**. Check on a phone width (375 px, the browser's device toolbar) and on a tablet width (820 px).

## Magic, Languages, Weapon skills (final draft 4)

1. Make a Reed Witch (or any class that starts with spells). On **Magic**, the class's spells sit under **From your class**, each reading **Given** at its right, with no Pick button. Tapping the name opens the spell.
2. A kindred with a knack to roll: the group shows a Roll row ("Roll d6 at the table, then tap the row.") with the die drawn, then the rows.
3. On **Languages**, the given ones are under **You speak**, marked Given. Under **Pick 1 more** there is a Roll row ("Roll d6, or choose."), the rolled languages in the die's order with their number first in the line ("2 to 3. The common speech…"). A language your kindred can't learn shows in its place as a closed row: its number, the sign and "Not open to <kindred>"; tapping it explains. Then **Or choose one of these**. A language that needs the GM's approval shows the sign and "Needs the GM's special approval" on its own line.
4. The count ("0 of 1 picked") is only in the footer, never on the group's heading. Same on **Weapon skills**: the heading reads only "Pick 2".

## Gear (final draft 5)

5. On **Gear**: a Roll row ("Roll 3d6 × 10 gp for your starting coin, then enter it. The stepper moves by 10."), then the coin at 100, lighter, with "Average value, replace with your roll". Tap + once: 110, full weight, and the line reads "110 rolled, 0 gp spent, 110 gp left".
6. Type **190**. The card's edge turns the warning colour and says, with the sign, "3d6 × 10 can't give 190. The most is 180". The number stays 190 (never clamped). The footer says "Coin is over the dice's most" and Next is plain (not the accent).
7. Tap **Next**: a toast explains ("… Your GM sees it when you send.") and the step goes on. On the review, the last card reads "1 thing needs the GM's special approval" with "Starting coin 190".
8. Back on Gear with no kit taken, the first kit's **Pick** is the accent and Next is plain. Take a kit with rolls: the roll sequence opens as a sheet. Finish it: the row shows "9 items: …, spear (rolled), …" and one **Change** button. Change reopens the rolls with the earlier taps. Picked ✓ puts the kit back.
9. A kindred with a trinket table: a Roll row, then **Trinket** with Open. After a pick, "Rolled 11: …" with Change.
10. The shop is a row, **The shop**, with Open. **Yours already** has one fold per group ("Given to every character", "From your kindred"), each row marked Given.

## Details (final draft 6)

11. For a kindred whose pack gives `usual` values: **Body** has one Roll row, and each card's line reads "Average value, replace with your roll. 1d6 + 18, years" (the dice from the pack). Step or type one: its line becomes just the dice. A kindred without `usual` keeps the typed box.
12. **Looks and manner**: a Roll row, each table one row with Open ("Stone kin, d20. Not rolled yet"). Open one: a Roll row, the rows, and **Or type your own** at the foot. Tap a row: the step row reads "Rolled 7: …" with Change. Type your own words: "Typed: …".
13. The footer reads "Nothing filled yet", then "N of M filled".

## The review and the GM's card (final draft 7)

14. On the review at 375 px: the foot has **Send to the GM** full width (the accent), then **Save and leave** and **Start over** side by side. No foot Back (the ← at the top goes back).
15. Any exceptions (a closed pick asked for, a language needing approval, a coin outside the dice) are listed in the last card, under the sign and "N things need the GM's special approval", each over the pack's reason.
16. Tap **Change** on Details or Languages and change nothing: the counter reads "From the review" and both foot buttons read **Back to review**.
17. Tap **Start over**: a sheet asks "Start over?" naming the character and saying nothing has been sent. **Keep going** closes it. **Start over** deletes the draft and opens creation at step 1; Your characters no longer lists it.
18. As the GM, open the waiting character: the exceptions come first, each "Needs your special approval" with the reason, **Allow it** and (for a language) **Take it off**. Tap Approve with one unsettled: it says what's left to settle. Allow it, then Approve: the log reads "… approved <name>, allowing <exception>". Take it off on a language removes it from the character and the card.

## The states (final draft 8)

19. Loading: on a slow connection (the browser's network throttling, "Slow 3G"), opening creation shows "Loading your setting's rules…" with grey skeleton rows.
20. Offline (the browser's network "Offline") on Languages, Weapon skills, Magic, Gear, Details or the review: a box at the top with the sign, "You're offline" and what it means; the footer reads "Offline. Next waits for the connection" and Next is plain; tapping Next repeats the line. Back online, it goes.
21. A failed send: offline on the review, tap Send: a sheet "Not sent" with the sign, "Your GM didn't get it", **Try again** (the accent) and **Save and leave**.
22. Continue: Leave creation from Scores with some scores typed, then Create again: a sheet "Continue where you left off?" says what was kept and when ("today"), "Kept on this device only. Nothing has been sent to your GM.", **Continue** (the accent) and **Start again**.

## Gallery pictures expected to change (for Design)

- creation-gear and creation-final (Gear): the coin's Roll row and average stepper, the shop row, the folds by group, Given rows.
- creation-review and creation-final (review): the stacked foot, the exceptions card; the Kindred and class card no longer carries the special-approval lines.
- creation-shell (if it draws Languages or Magic): Given rows, the Roll rows, no count on the group headings.
- Any scene with a Details step: Body and Looks and manner.
- New states drawn here have no gallery scene yet (see the status file).
