# Manual checks: m5b-players-a-b (the players' screens on the standard, slices A and B)

Plan `docs/plans/m5b-players-screens-standard.md`, mockup `players/01-player-pack-sheet-standard`. Open the pull request's Vercel preview (it uses the test database), sign in as a player with an approved character, and open the campaign.

## On a phone (or the browser at 375 px wide)

1. **The bar.** At the top: ≡ at the left, the character's name in the middle, no ⋯ (the drawer holds the menu). No "‹" anywhere in it.
2. **The header.** Under the bar: the portrait, "<Class> <level>, <Race>" with a comma (no "·"), then each status as a chip: a small symbol and its word. A status with a timer reads "Blessed, 3 turns"; one with no end shows its word only. Tap a chip: a sheet rises from the bottom with what it does and when it ends; its title is the status's word ("Blessed"), with the character's name on its first line.
3. **The vitals.** Hit points, AC and the attack tile as before. Under them, one quiet line: "Tap a figure for where it comes from". The attack tile's line reads "Melee +1, Missile +0" (a comma).
4. **A breakdown.** Tap AC, then the attack tile. Each opens a sheet from the bottom: the number in bold first, the parts under it, the source line at the foot. ✕ or a tap on the dimmed page closes it. No "Got it" button.
5. **Hit points** still open the damage pad (now a sheet). Take 1 damage: the toast reads "Took 1 damage, HP 5" with Undo.
6. **Traits.** Each trait with uses is a row: its name, "1 of 1 left, back each day" under it, and a **Use** button at the right. Tap Use: the toast says "Used <trait>, 0 of 1 left" with Undo, and the row says "None of 1 left". Tap Use again: it's still a button, and a toast says no uses are left and when they come back. Tap the trait's name: its sheet has the dots; tap the empty dot to give the use back.
7. **Spells** (a caster): each level folds as before ("Level 1: 2 spells"); each spell is a row with its duration and range under the name and a chevron; a tap opens the spell. No Cast button yet (that's the Magic tab, M5c).
8. **Skills.** One row per skill, the value at the right ("2-in-6", "6+"), a chevron. Tap one: the sheet starts with the odds in words, "Succeeds on 5 or 6, 2 in 6".
9. **Saves.** Five small tiles in a row with the pack's short names. Tap one: the breakdown sheet with the number first; if the setting says how saves work, a row "The rule" with a chevron opens it.
10. **Full character sheet.** The last row, with a chevron (no "›"). Tap it: the bar reads ← at the left, "Full sheet" in the middle, Edit and ⋯ at the right. ⋯ opens a sheet named More from the bottom (Your characters, Setting rules, This device, …). ← goes back to the Player screen.
11. **Pack tab.** The bar reads "<name>'s pack" in the middle. Tap an item: its actions open as a sheet from the bottom (the rows themselves are slice C's).
12. **Scene tab.** The bar shows the campaign's name in the middle; nothing else on Scene changed.

## On a tablet (or the browser at 1024 px wide)

13. The bar: "‹ <campaign>" at the left, the name in the middle, ⋯ at the right. ⋯ opens a sheet beside the button (not a small panel): the screen's options first, then the app's menu below a line. Choosing an item closes it; switching the theme leaves it open.
14. The full sheet on the right: tap any figure; its pop-up opens as a sheet beside what you tapped.

## Sign-in link (P24)

15. Nothing to check by hand: `tests/layout/signInLink.spec.ts` opens the email link in a fresh WebKit browser in CI.

## Gallery pictures this pull request changes (for Design)

- **molecules**: the Status symbols specimen's low status has the warning sign in its corner, not ▲ (and its caption says so); the save row is now five tiles; prepared spells are rows with a chevron and their details after a comma. Any other section that draws a low light or status (the marching order) shows the same sign.
- **phone-navigation**: the "no characters yet" drawer shows only Setting rules under This campaign (Design's nit). Its four approved baselines from #549 are **not** added here, since this changes that section.
- **players-standard** (new): status chips, list rows, save tiles, two breakdown sheets, ⋯ as a sheet. No pictures yet; CI draws them.
