# Manual checks: dec-8 piece D, getting it back (the GM's rest prompt)

Plan `docs/plans/dec-8-magic-first-cut.md`, piece D. Mockup `docs/design/mockups/magic/06-prepare-and-rest.html` (the rest prompt), approved 2026-11-10. Use the pull request's Vercel preview (the test database), a campaign with a setting pack, a caster (a class with spell slots) and a character whose class or kindred has a power that comes back on a rest.

1. **As the caster's player:** open the caster's Player screen and Prepare a spell or two so something is ready; cast one (the Magic tab once #787 is in, or the old Spells section). Note what is ready and what is cast.
2. **As the GM:** on Scene, Start expedition, then ⋯ › **End expedition**. The summary shows "Expedition ended" with Undo and **Full rest**.
3. Tap **Full rest**. A sheet "A night's rest" opens (on a phone from the bottom; on a tablet beside the button): "Who gets their magic back?", a toggle for the caster (their name at the left, the switch at the right) and one for the character with the once-a-rest power ("<power>, once a rest" quiet under the name), then "Once-a-day uses come back to everyone with the new day." and **Apply rest** (a sleeper icon above the words). The sheet is in the book's type; the Scene behind it is not. Every toggle starts on (a tick on the knob). There is a ✕ at the top and no Cancel.
4. Tap the caster's toggle: it goes off (a cross on the knob, the knob at the left). Tap again: back on.
5. Tap ✕ at the top: the sheet closes, nothing changes, and Full rest is still offered. Tap Full rest again; leave every toggle on and tap **Apply rest**. The summary shows "Full rest: rest and day abilities are back." with the healing rule and Heal.
6. **As the caster's player:** the spells chosen for the next rest (or today's again, if nothing was chosen) are ready, and nothing is cast. The once-a-rest power's dots are full again on the other character.
7. **The log (GM):** one line "gave the party a full rest" and one "changed <caster>'s spells" for each caster on ✓; each undoes from the log.
8. Repeat 2 to 5 with the caster's toggle off before Apply rest: the summary reads "Full rest: rest and day abilities are back, except for <caster>."; that caster's spells and casts, and their once-a-rest uses, stay as they were; once-a-day uses still come back.
9. **No one to ask:** End an expedition where nobody who went has magic or a once-a-rest power: Full rest applies at once, with no sheet, as before.
10. **At 375 px and in dark mode:** the sheet fits with no sideways scroll; a long name wraps beside its toggle; each toggle row is at least 44 px tall.
11. **Changed while open:** open the sheet as the GM; on another device, as the caster's player, change what is chosen for the next rest; then Apply rest. The new choice is what becomes ready.

**Gallery pictures expected to change:** one new section, `night-rest` ("A night's rest: the GM's rest prompt"), in all four sizes and themes; it has no approved picture yet, so the layout job reports it missing until Design approves it. No other section should change (the section is last).
