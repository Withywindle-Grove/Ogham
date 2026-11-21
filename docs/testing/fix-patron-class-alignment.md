# Patron vs the class's alignment limit (fix-patron-class-alignment)

Needs a campaign with a patrons pack whose cleric-like class has a hard alignment limit, and a patron whose followers
have only an alignment that class can't take (in the invented fixture: Marsh Chaplain, Lantern or Reed; a patron with
Mire followers).

1. [ ] Start a character, guided; pick that class. The Patron step opens. The patron the class can follow has its Pick.
   The fold "1 more needs the GM's approval" holds the other one: open it. Its row says "Not open to <class, lower case>"
   with the warning sign, and has **no** Pick.
2. [ ] Tap that closed row's name. Its entry opens: at the top the warning "Not open to …" and a line like "Mire
   followers. A marsh chaplain may only be Lantern or Reed."; no Pick at the foot. Close it.
3. [ ] Pick the open patron and go on to Who they are: the alignment rows offered can be picked (never only closed rows).
4. [ ] A class with a **soft** alignment limit (fixture: Mire Stalker) and a patron outside it: on the Patron step the
   patron is in the fold, marked "Needs the GM's special approval". Pick it: the foot reads "<name> picked. Your GM
   decides on the review". Finish to the review: the patron is flagged for the GM's special approval.
5. [ ] A class whose **every** patron is closed to it: no Patron step after Class (the step count has none), and Send
   to the GM sends (no "Choose a patron first").
6. [ ] A class with **no** alignment limit: every patron it's offered has its Pick, nothing marked "Not open to".
7. [ ] Repeat 1 at 375 px: the closed row's words fit, nothing clipped.
8. [ ] Open the component gallery (`npm run dev`, then `/gallery.html`) and go to the section "The patron: its creation
   step and the sheet's section". Under the two pictures it had, four more: The Mire Mother's row with the warning
   "Not open to marsh chaplain of the drowned bell" and no Pick; its entry opened, with that warning as a heading and
   "Mire followers. A marsh chaplain of the drowned bell may only be Lantern or Reed.", no Pick at the foot; The Sunk
   Lamp's row in the open fold "1 more needs the GM's approval", marked "Needs the GM's special approval", with its
   Pick; and the GM's card: "Needs your special approval", "The Sunk Lamp: Mire followers; a marsh chaplain of the
   drowned bell is usually Lantern or Reed", Allow it. At 375 px the long class name wraps, nothing clipped; the
   same in dark mode.

Gallery pictures expected to change: the patron section (`patron`), phone and tablet, light and dark: `phone-light-patron.png`, `phone-dark-patron.png`, `tablet-light-patron.png`, `tablet-dark-patron.png` (tests/layout/gallery-baselines). Why:
closed and soft patron specimens added (a closed row, its entry, a soft row, the GM's soft reason), ruled by the
Conductor 2026-11-12. No other section changes.
