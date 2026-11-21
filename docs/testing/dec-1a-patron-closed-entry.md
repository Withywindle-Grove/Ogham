# Manual checks: dec-1a-patron-closed-entry (cp-1 and the review nits of #665)

Use the pull request's Vercel preview (the test project), a campaign with the patrons' option on, a class with a hard alignment limit (a "may only be" class) and one patron whose followers it can't have. Phone width first, then a tablet.

1. Create a character, pick that class. On the Patron step, the closed patron's row shows ▲ "Not open to <class>" and no Pick. Its blurb, if it ends without punctuation, has a full stop before "<Alignment> followers".
2. Tap the closed patron's name. The entry opens as a sheet: one ▲ line "Not open to <class>" (no small-capitals heading saying the same), and under it, in ordinary text (not yellow, not bold), "<Alignment> followers. A <class> may only be <A> or <B>." There's no Pick and no Close button: only the ✕ at the top closes it.
3. Tap an open patron's name. The entry has the ✕ and its Pick button, nothing else at the foot.
4. Take a class with a soft limit ("usually"), pick a patron outside it and send the character. As the GM, on Players, the card's reason reads "<Patron>: <Alignment> followers; a <class> is usually <A> or <B>." with a full stop at the end.
5. A closed patron kept from before (only reachable by editing data, or a pack change; skip if you can't set it up): open the draft and tap Send to the GM. It doesn't send; it says "A <class> can't follow <Patron>. Pick another patron." and opens the Patron step, where that patron reads Picked ✓ with the ▲ "Not open to <class>" line, and the foot says the same line in ▲. Next says it again and stays. Pick another patron: Next goes back to the review, and Send works.
6. A class whose only patron is closed: no Patron step, and the review never says "Patron: Not picked yet". As the GM, Approve approves it.
7. Approve while the rules are still loading (cp-4): can't be done by hand. The field list arrives together with the Players list, so the Approve button only shows once it has loaded; the hold shows only when the field list fails to load. The test `patronClassAlignment.test.tsx` ("holds while the field list isn't loaded") covers it.

## Gallery pictures expected to change
- `patron` (phone and tablet, light and dark: 4 pictures): the closed entry in cp-1's shape (one ▲ line, the why plain, no heading), the GM's reason with its full stop, a new specimen for the kept closed patron, and the GM card full width on a tablet (`gm--sub`; on a phone the empty room under the card also goes).
- No other section shows patron rows or the closed entry; the closed class entry (`creation-who`'s "A closed class's entry") keeps Ask the GM and is unchanged.
