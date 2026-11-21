# Manual checks: m5b-retest-4-fixes (creation retest 4, 2026-11-09)

On the pull request's Vercel preview (the test project), on an iPad unless a step says a phone. Plan: `docs/plans/m5b-retest-4-fixes.md`.

1. **T1, the library's result where the eye is.** Rules library → scroll down to a pack → **Update** → choose a newer file → **Update**. You should see "<pack> was updated." as a toast at the bottom of the screen, where you are, not a line at the top of the list.
2. **T2, the foot of a sheet.** A new character → Gear → **Pick** a kit with rolls (the roll sheet opens). Turn the iPad upright, then sideways. The last row, the status line, **Back** and **Next** are all above the home bar; nothing is cut off. Tap rows until the sheet grows: it stays on the screen and scrolls inside.
3. **T3, a row rolled twice.** In the same kit's roll made twice (Weapons), tap the same row twice. The row says **Picked ×2** with a **−** square beside it. Tap **−**: it goes back to one ("1 of 2 tapped"). Tap the row again, **Next**, **Done**: the kit gives two of it.
4. **T4, table sheets as wide as the screen.** On Details (or a trinket, backgrounds, Roll for a name), open a table. On the iPad sideways, the sheet is wide (up to the page's width); rows don't wrap as on a phone. On a phone, it is the sheet from the bottom as before.
5. **T5, Help keyed to the step.** With the zine overlay attached, make a character whose kindred has a bloodline list (no help of its own) → its step → **Help me choose**. The text names the bloodline ("<list name>: roll …"), and says nothing about secondary skills. The Secondary skills step still shows its own help.
6. **T6, book titles, not codes.** After the Pack Creator's pack with `meta.sourceTitles` is attached: any creation row or entry from the zine shows its book's title and page ("<title>, p. 8"), never "i3 p. 8". A pack without the map shows what it did before.
7. **T7, a trait entry as a sheet.** On the iPad sideways, a trait-list step (Secondary skills, a background) → tap an entry's name. It opens as a sheet over the step, not in a column beside it. Race and Class still open beside the list.
8. **T8, the sheet of a zine class.** Open the full sheet of the character that was bare in the retest. You should see the Score tiles, Skills and Abilities. If its identity line says "Class not in this campaign’s setting rules", the class is missing from the campaign's packs: tell Design (that's the cause; see ⚑ 1 in the status report).
9. **T9, a trait entry's powers.** Needs a pack whose trait entry has `abilities` (the Pack Creator's G-213). Pick that entry at creation, finish, and open the full sheet: its powers are Abilities rows; one with uses says them ("1 use a day"). On the Player screen, that power has a **Use** row under Traits and dots in its sheet; one without uses has neither.
10. **The trait line (Design on #570).** A trait list without notes (a zine bloodline): its step shows only the Roll row, "Roll 1d8 at the table, then tap the row, or pick one." (its own die), and no line about secondary skills or backgrounds.
11. **S1, every roll with its die.** Walk a creation with trait lists, kindred tables and Details: every "Roll …" sits in a Roll row with the die's picture (the d6 cube, the d20…), or on a button with it ("Roll d8" on a table's row before it's rolled). No "Roll" words in a plain line.
12. **S2.** Open Help me choose on every step of one creation: no two steps show the same text (unless the pack wrote the same words for two lists).

## Gallery pictures expected to change

- `creation-gear` (all four: phone and tablet, light and dark): two new specimens (a row rolled twice with Picked ×2 and −, T3; a Detail row with its die beside "Roll d8", S1), and the roll sequences are now Table sheets, wider on a tablet (T4). Its four baselines are deleted; CI draws new ones for Design.
- No other picture should change. T2's safe area doesn't show in the gallery (no home indicator there).
