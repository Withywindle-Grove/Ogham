# Creation rework, follow-up E: full ability names, compact roll rows, skipped empty steps, one exit button, send lines (cw-11, cw-13; Design 2026-11-06)

A campaign on the fae-woodland setting (a class whose kit has rolls) and one on the classic setting. A new player: Create your character, then Guided. Slice C (Gear and the kit's rolls, #534) comes in with this pull request: its own checks are in `docs/testing/m5b-creation-rework-c.md`.

1. **iPad, landscape.** On **Scores** every tile shows the ability's full name with ⓘ. Type a number that changes nothing in play (the middle of the range): the caption under it reads **No change**, never blank.
2. On **Adjust scores** (a class with a trade, e.g. a prime to raise): each tile shows the full name with ⓘ; tap the name: a pop-up says what the ability does. Make a trade: the chip under the tiles keeps the short form ("WIT −2 → STR +1"); the line under the chips and the status line use full names ("Lowered Wisdom by 2 · 1 to spend").
3. On **Gear**, tap **Pick** on the kit with rolls. On a roll step the rows read "1–2 · <thing>"; there is **no Pick button** on them. Tap a row once: it fills with the selected wash and shows ✓ at its end. On a kit with a "Choose one" step, that step alone has **Pick** buttons.
4. On a roll made twice with different results, the row the first roll took reads "▲ Already rolled"; tapping it says to roll again.
5. A kit with no price shows no price line at all (no "Free"); a priced kit shows its price.
6. Before Who they are, the top button reads **Leave**. Fill in Who they are and tap **Next**: from the next step on, the top button reads **Save and leave**. On the review there is **one** Save and leave (at the top), none in the foot; tap it: the toast says the character is saved.
7. On the review, the Scores card reads the full names: "Strength 13 · Intelligence 9 · …" (it wraps).
8. Send it. **As the GM**, open the character's approval card: the scores read in full too.
9. **Offline.** Open a draft's review, tap **Change** on Who they are, change the name, switch the iPad to aeroplane mode, tap **Next**: the foot's line reads "▲ You're offline. Nothing is saved until you're back: keep this screen open, then try again." and the step stays. Switch aeroplane mode off and tap **Next** again: back on the review with the new name.
10. **Details (stone kin or any kindred with a usual age).** Tap **Skip · leave blank**: on the review Details reads "Left blank · optional"; nothing is saved for age, height or weight.
11. **Phone, upright (375 wide).** Repeat 3: the roll rows fit without sideways scrolling, each row 44 px or taller; the foot (status, Back, Next) is whole.
12. **Screen reader (VoiceOver), optional.** On Scores, focus a score's box: it reads the name, then the caption ("+1 melee"); on Gear, the coin box reads its line ("Starts at the usual …").
