# m5b-creation-follow-up-f: creation follow-up F (after-test list and the players' test)

Open the pull request's preview (test project). Use the creation fixture campaign, or a campaign with fae-woodland and the table-generator pack attached. iPad first, then the phone. Each check says what to tap and what you should see.

1. **iPad. Scores and Adjust.**
   - A score whose number changes nothing has a blank caption, not "No change".
   - On Adjust, lower a score already under the setting's floor: the pop-up reads like "Nimbleness is 8: already under 9, so it can't be lowered" (full name).
2. **iPad. Kindred and Class.**
   - A kindred or class you don't meet reads "Needs Grit 9 · you have 8" (full names). The score strip at the top still says GRT.
   - Open a class with two primes in fae-woodland: its "Prime requisite" line ends with the setting's sentence on the lowest prime.
3. **iPad. Pick rows.** On Kindred, Class, Languages and Gear, the Pick button sits at the right of the name's line. Only a very long name puts it under.
4. **iPad. Help me choose.** Tap it on any step. The button stays one line, and the help opens across the full width, its lines a comfortable length.
5. **iPad. Who they are.**
   - The hit points line reads "Roll 1d8 and enter what you rolled. The app adds … for your <ability>; never below 1." Enter 4: the line beside it says "4 rolled + … for <ability> = … hit points".
   - The folded figures are headed **Derived values**.
6. **iPad. Name tables from the table pack.** Use a kindred with no names of its own, the table-generator attached. Under Name there's one row per name table: two first-name tables and the surnames, each with Open. Open the surnames: two columns of halves. Tap a first name in one table and a surname in the other: the Name field reads "First Surname".
7. **iPad. A table sheet.**
   - Open a describing table (Details) or the trinket. There's no box to type a number: tap the row you rolled.
   - Open a d100 table (a long trinket or a table pack's d100): its rows sit under small headings "1–9", "10s" … "90s", "100". Row 39 is under "30s"; tap it and it's picked.
   - A d6 table is one list with no headings.
8. **iPad. Details.**
   - The first row ("Face") is laid out like the others: the label, a dash or the value under it, the Roll button at the right.
   - Turn on aeroplane mode and tap Next: the foot's line shows "▲ You're offline…". The step stays. Back online, Next goes on.
9. **iPad. Gear.**
   - A kit that gives a rolled number of torches or rations says them by the piece ("3 torches" or "Torch ×3").
   - The "Pick up to N" adventuring rows show price and weight.
10. **iPad. A class with no kit of its own.** Pick a class no kit names. On Gear every kit is offered, each "▲ Needs the GM's special approval". Take one. The review lists it as needing the GM's special approval, and so does the GM's approval card. Take it off: the line goes.
11. **iPad. Weapon skills.** With specialisation on, the step's lead says "Specialisation is on: " then the setting's rule. On the approved character's full sheet there's the Weapon skills line, and no empty Weapon proficiencies box.
12. **iPad. The review.**
    - Change Class to a class with its own trait or talents list: that step is asked before the review comes back.
    - From the review, tap Change on Gear (or any card): the foot's Back reads **Back to review**, and returns there.
    - Change something on that step, then look again: Back now reads plain "Back" (to the step before).
13. **iPad. Languages.** A language usually learnt by other kinds reads "Usually learnt only by … kinds · Needs the GM's special approval" (a dot between).
14. **iPad. First spells / knacks.** Tap a roll's row: the group says nothing more, and only the foot counts ("All picked · 9 yours").
15. **iPad. Keep picks; updates wait.**
    - Start a character, pick scores, a kindred and a class, then close the tab without Leave. Open Create again: "Continue where you left off" brings the picks back.
    - (If a new version is published while you're mid-creation, the app doesn't reload until creation is closed.)
16. **iPad, landscape. The menu's fold handle.** On the menu's edge there's a small ◀ left of the pill. Fold the menu: the triangle turns ▶ and sits right of the pill.
17. **iPhone. Sign in.**
    - New account: on "What should we call you?" the box isn't filled with your email.
    - (Once the email template carries a link, ⚑ 1:) tap the email's link and you're signed in without typing. Open it in a fresh Safari tab: the app asks your email once, then signs in with the same code.
18. **Phone (375 px).** Repeat 3, 7 and 12. Nothing is cut off. Pick stays beside short names. The table sheet's rows and its tens headings fit.

**Gallery pictures expected to change** (to Design after CI):
- creation-shell (baselines taken out)
- creation-who (incl. the two new #526 specimens)
- creation-review
- creation-gear

end-safety now has its approved baselines.
