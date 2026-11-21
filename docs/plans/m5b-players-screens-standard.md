# Plan: the players' screens on creation's standard

Written by the design agent, 2026-11-07, evening. Francis ruled (2026-11-07, "after D lands, before the gate") that the Player screen, the Pack and the full character sheet take the chrome creation now has, and approved the mockup screen by screen the same day (`docs/design/mockups/players/01-player-pack-sheet-standard.html`, picture in `players/png/`). This plan makes no rulings. It supersedes nothing: what the screens hold stays as ruled (Player 2026-10-26; Pack N18, N19; the sheet sr-1 … sr-10); only the chrome and the row shapes change. Slice E (the phone's tab bar and drawer, #549) lands first; this build starts from it.

## What this step delivers

### A · The chrome on three screens
1. **The top bar** on Player, Pack and the full sheet: ≡ (phone) or the rail's row (tablet), the title centred (the character's name on Player, "<name>'s pack" on Pack, "Full sheet" on the sheet with ← since it is a sub-screen), ⋯ as a sheet with the screen's own options first and a divider (final draft 9's rule; on a phone the campaign items are the drawer's).
2. **No "… ›" links and no middle dot** on these screens: "Full character sheet ›" becomes a label-left row with a chevron; counts read "N items"; figures as sentences ("290 of 500 coins' weight. Unburdened, speed 40"). The creation " · " test widens to these three screens.
3. **The warning sign** wherever ▲ or a plain word marked attention (waiting items, over the limit).
4. **Sheets** (the Sheet row) replace every dialog on these screens: an item's actions, the breakdown, the purse, Add item's form, Give to…, Put in….

### B · The Player screen
- The header: the name in the bar; under it "<Class> <level>, <Race>" (the pack's words) and the **statuses as chips** (symbol and word, 14 px, tappable for the effect and when it ends).
- The three vitals tiles as built, each **tappable for its breakdown**; one quiet line under them: "Tap a figure for where it comes from".
- Sections, each only when present: Light; **Spells** (the slots line "Level 1: 2 of 2 left", one row per spell with Cast); **Abilities** (Use where there is a use, a chevron for a passive one); At hand (the item's action: Fire, Drink, Light…; the row's body opens the item's sheet); **Skills** (label-left rows with the odds in the pack's style, a chevron); Saves (five named tiles, tappable); then Purse and Full character sheet as rows with a chevron.
- **The breakdown sheet**: the number to beat (or the figure), then one row per part with its source, "The rule" as a row with a chevron, the source line at the foot. One shared piece (M4b's "where this number comes from") for a score, a save, AC, attack, a skill.
- Landscape tablet: the play column left, the sheet right; **nothing repeated** between them (06).

### C · The Pack
- The load line with its bar first (the same piece as creation's Gear).
- At hand and Worn always open; **an At hand row carries its action** (Fire, Drink) and its body opens the sheet; other rows open the sheet (a chevron). Gear and the Party stash as fold rows (N19's folding rule), with a one-line summary ("9 items: rope, 3 days' food, torches ×6…").
- Waiting items as a card with the sign ("2 items waiting for the GM") that opens the list.
- **Add item** is the screen's one accent button, in the foot with the count ("20 items").
- **An item's sheet**: the description and its source line; the actions as rows (Light it, Give to…, Put in…), a chevron where one asks more; **Drop** last and set apart, no confirm, Undo in the toast.
- **Pin**: a star in the sheet's head beside ✕, a toggle (empty star "Pin to top", filled star "Unpin", `aria-pressed`); a pinned item shows the small filled star alone at the start of its line (no word; a screen reader hears "pinned"); the toast "Lantern pinned to the top" with Undo. The "Pin to top" row goes.

### D · The full sheet
- Phone: the ← bar; the identity line ("Wren, Lantern Warden 1, Human, Lawful"); the four captioned tiles two across (HP with its die, Armour with what gives it, Attack with melee and missile, Level with "N of M experience"); **Scores as six tiles in two rows of three** (the pack's short name, the value, the modifier under; tappable); **Saves as five tiles**; Movement, Skills, Traits, Languages, Magic as fold rows with a one-line summary; the foot "Up to date" with Back and Edit (plain).
- Tablet, in the Player screen's right column: Level with its experience bar, Scores and Saves as the same tiles, Movement and Languages as rows with a chevron, Skills, Traits and Magic folded.
- sr-1 … sr-10 stand for everything else (the Magic section's pips and tabs, Advancement, a field only when it applies).

### E · The app-wide formatting sweep (same pull request, or its own if the diff is too large: the Builder says)
- " · " out everywhere (829 lines in 144 files on 2026-11-07's count), by the creation rules: a colon after a count, figures as a sentence, a second line where there is room, commas inside a line; the test that no screen renders " · ".
- "… ›" links out everywhere: a row with a chevron, or a plain button.
- ▲ out everywhere: the warning sign.
- A picture batch for every gallery scene it touches, to Design in one go.

## Rests on
Slice E (#549); creation's A–F and the follow-up (#543–#548); 06's inventory rows added by creation (App bar, Sheet, Warning sign, Roll row); the players' mockup; the Player, Pack and sheet rulings named above.

## Build order
A with B (one builder), C (one builder), D after B (the sheet's tiles reuse the Player's); E last, or in parallel as its own PR. Pictures per PR to Design. Inventory rows and the Code column in the same pull request: Status chip (new), Score tile and Save tile (variants of the vitals tile), Breakdown sheet (the Sheet row's variant), Fold row (one component, the + at the right edge). Gallery scenes for each state drawn in the mockup.

## Tests (purpose first)
- No Player, Pack or sheet screen renders " · ", "›" or "▲".
- Every tappable figure opens the breakdown sheet; the sheet lists each part with its source and a row to the rule.
- An At hand row's button acts; a tap on its body opens the item's sheet.
- The star toggles pinned; a pinned item's line starts with the filled star and a screen reader hears "pinned"; the toast's Undo unpins.
- Drop removes at once with an Undo toast; no confirm appears.
- Add item is the only accent button on the Pack.
- The sheet's scores are six tiles in two rows at 375 px; the tablet's play column and sheet share no section.
- Gear folds by N19's rule; the device remembers how it was left.
- The sweep's test: no screen in the app renders " · ".

## Scope checks (write one and stop)
No change to what the Player screen, the Pack or the sheet hold or compute. Mode actions stay on Scene (ruled 2026-11-07). Downtime stays a mode of the campaign, not a tab (ruled 2026-11-07). No second accent colour. The Magic tab is M5c's, not this plan's.

## ⚑ and data questions
1. The pack's short ability names: `abilities[].short` exists in every pack (Pack Creator, 2026-11-07, "short and the printed-sheet labels left as they were"); the tile uses it, the breakdown the full name.
2. A status chip's "when it ends" needs the status's end on the character's state; where a status has none, the chip shows the word only.
3. The breakdown for a skill in a pack that gives odds as "2-in-6": the sheet shows "Succeeds on 5 or 6, 2 in 6" (CS-5a).

## Estimate (for the Builder to confirm)
A + B about a day; C about a day; D half a day; E a day with its picture batch. Two builders at once at most until E lands (E and this touch the same shell).

## Departures
(The Builder keeps this current in the same pull request.)

**Estimate, confirmed by the Builder (2026-11-07):** A + B a day; C a day; D half a day after B; E (the app-wide sweep) its own pull request, last, 1 to 1.5 days.

### A and B (branch `m5b-players-a-b`)
- **⋯ keeps slice E's rule on a phone:** with no options of its own (the Player screen today) the phone shows no ⋯, as Design ruled on #549; the mockup draws one. On a tablet ⋯ is always there, a Sheet with the app's menu below the screen's options.
- **The tablet keeps its back link** ("‹ <campaign>", slice E) at the left of the standard bar; the title is centred beside it. The full sheet, a sub-screen, has ← named "Back to <where>".
- **Scene shares the bar** (centred title, ⋯ as a sheet) so it doesn't jump between tabs; Scene's own pop-ups stay as they are until E.
- **The name's heading** stays on the Player screen for screen readers (visually hidden; the bar shows the name). The portrait and the campaign/company line stay (what the screen holds doesn't change); the line reads with commas.
- **HP's tap stays the damage pad** (bq-2); the quiet line sits under the three tiles.
- **Spells:** no Cast and no "N of N left" (Cast is M5c's Magic tab; "never a count left" is ruled, 09 2026-10-26). Levels still fold; each spell is a row with its duration and range under the name, a chevron opening it. Scope check in the status file.
- **Traits** keep their heading (Francis, docs PR #485), not the mockup's "Abilities". Each row has **Use** (one tap, Undo in the toast; with none left it says why); the dots that give a use back move into the trait's sheet. Passive abilities with a chevron are not added (they aren't on the Player screen today: a scope check).
- **Purse** isn't built (no purse on the Player screen yet; M7).
- **At hand** rows are the Pack's (`ItemRow`), slice C's; the Player screen's mark check leaves them to C's.
- **The full sheet's body** (dots, "… ›", tiles, fold rows, its own breakdown pop-ups) is D's; A gives it the bar and Sheets for its pop-ups.
- **The landscape split** already repeats nothing (the sheet beside leaves out Skills and Saves); moving them to the right column, as the mockup draws, is D's right column.
- **The breakdown's "number to beat"** is the figure itself (the save's number, the skill's odds in words): the app has no per-pack sentence for "Roll d20: 16 or more saves", and writing one would be new rules text.
- **The status sheet's title** is the status's word, "Blessed" (was "Blessed · Wren"), the character's name on its first line (Design on #553), and its level line "Dazed, level 1 of 3": it opens from the Player screen's chips.
- **The skill odds** read with a comma everywhere ("Succeeds on 5 or 6, 2 in 6"; Design's ⚑ 3), Scene's roll line included; the rest of Scene's dots are E's.
- **The status symbol's ▲** is the warning sign everywhere it's drawn (one component).
- **The mark check** is a shared helper (`src/testing/markScan.ts`) that C and D call for their screens.
- **Added with this pull request:** the sign-in-link flow in WebKit (P24, ruled A): `tests/layout/signInLink.spec.ts`.

### Slice C (the Pack), branch `m5b-players-c`
- **The Pack's At hand group** (Design on #552, scope check 1 answered (a); corrected by Francis, 2026-11-07): first and always open, it holds the pinned items **that have an action**, each listed only there and not again in its own group; its line keeps where it is ("In hand"). A pinned or worn thing with nothing to do stays in its own group (its star still on its line). `atHandLines` applies the same rule on the Player screen and the overview. A pinned container's things stay under "In the <container>".
- **Every At hand row carries its action** (Francis, 2026-11-07): Use a charge; a light's Light or Put out (the Light section's own `lightLight` and `douseLight`); **use one up**, named by the item's kind (Fire for ammunition, Drink for a draught, Eat for food, Use for another stack), its own logged command `item.use` (Design on #552: the log says what happened, "Wren drank a Moss draught, 1 left", never "dropped"), Undo in the toast, the last one leaving play with the log keeping a copy (hard rule 4), with one migration (`20261107200000_m5b_players_c_item_use.sql`: its `logged_commands` and `undoable_deletions` rows); and **Attack** for a weapon with nothing to count, which opens the weapon's sheet with its figures until M6 wires the attack. **Fragile, accepted by Design on #552:** the kind is guessed from the pack's category id (ammunition, ammo, arrows, bolts, quarrels, shot, bullets; potion, draught, drink, elixir, tonic, philtre; food, rations, provisions) and its `food` field, with Use for any other stack; a pack with other ids gets Use for a stack and no button for a single thing. A pack's own `verb` field is parked for later; the bow says Attack and its arrows Fire, as built. The mockup's "Light it" row on the lantern's sheet isn't built.
- **The − and + stepper moved from the row to the item's sheet** (confirmed by Design on #552), as a "How many: N" row, so a row ends in its chevron as drawn. Use a charge on the Pack moved into the sheet too; At hand rows keep it on the row.
- **The load line keeps LoadSummary's shape** (the tier button, the bar, the figures; confirmed by Design on #552). Only its middle dots became commas and full stops.
- **Gear folds only where it exists**: as a group, Gear is armour mode's alone (N19), so coin and slot packs have no Gear fold row. The Party stash and Tiny things are fold rows everywhere.
- **The waiting items no longer fold** (N19 had them fold): they are the card that opens a sheet, as drawn.
- **Unpin has a toast too**, "<item> unpinned" with Undo (confirmed by Design on #552).
- **A weightless tiny row shows no weight** rather than "—": the weight now sits in the row's line.
- **The weapon breakdown is reached from the item's sheet** (an Attack row), since the row's body opens the sheet.
- **Add item's form stays a full screen**, not a sheet.
- **The full sheet's Pack load follows the Pack** (Design's picture review on #552): each group is the inventory's Fold row (`FoldedGroup`, + and −) instead of a ▸/▾ row, reading "Worn and in hand: Reed spear, Storm lantern, Waxed coat", "In the Backpack: 8 items", "Tiny things: 5, not counted" (built from the groups, `groupWords`). Each group now opens on its own (before, one at a time). Its section's own phone fold ("▸ Pack load · Speed 35 · 9 items", `SheetSection`, shared by every section of the full sheet) is left for the app-wide sweep.
- **The item sheet's details are kv rows** (Design on #552): `Lines` gains a `kv` variant (the label at the left, the value at the right edge, "Slot", "hand"), used only by the item sheet; the rules browser keeps its two columns. The sheet's source line still reads "From your setting: <pack> · <page>" (`sourceLine`, shared with the rules browser), left for the sweep.
### Slice D (branch `m5b-players-d`)
- **Estimate:** half a day, as planned.
- **Combat keeps its heading** (the mockup draws the four tiles with none): the class form switch and the layout's own combat fields sit in it under the tiles.
- **The head keeps the portrait and the company line** (as A and B on the Player screen: what the sheet holds doesn't change). The identity line reads "Wren, Lantern Warden 1, Bog folk, Lantern"; the name is the page's heading for screen readers only. Without a class it is the GM's card fields with commas.
- **The tiles' words** (Design's answer 3, 2026-11-07): a tile takes the layout's word where it has one (the AC field's label, an HP field's), ours where not ("hit points", "ac"); the attack keeps its own label. Hit points' line is the die a level, "1d8 a level" (`hpDieCaption`); the score's modifier is in its breakdown. The other captions lose only the middle dot (commas). Level's caption reads "120 of 1,500 experience" (`levelExperience`).
- **A score tile's modifier** (Design's answer 5): one number, never "+1, −1" bare: the one the pack marks as main, else the first the score's row gives (no pack marks one yet, and the pack format has no such mark: only "the first" is built); "+0" where the row's numbers are all nothing; none without a modifier table. A screen reader hears what it modifies ("Muscle 13, +1 melee"). The breakdown says every modifier in the pack's words for what each modifies, "+1 melee, −1 AC" (creation's `modifierWords`), replacing the sheet's old "Melee: +1" lines. What the score affects (the old tile caption) moved into its breakdown sheet, after the setting's blurb.
- **The section is headed "Scores"** (was "Abilities"), as the mockup and this plan name it; a layout group named Abilities keeps its own heading beside it.
- **The phone's order** follows the mockup: Combat, Scores, Saves, Movement, Skills, Traits, Languages, Magic, then the Pack load, Identity and Advancement as before. The tablet's two columns keep sr-7's order, with Scores and Languages in the right column.
- **Languages is its own section** (the languages field leaves its layout group for it).
- **The layout's save fields are left out while the Save tiles show**, at every width (before, only beside the Player screen); a pack without saves keeps its Saves group of fields.
- **Beside the Player screen the sheet is one column** (06 had two once the pane is 600 px wide; the mockup draws one): Level as a row with its experience bar (a tap opens its breakdown), the rest of Combat, Scores, Saves, Movement and Languages as rows with a chevron (each opens its section in a Sheet), Skills, Traits and Magic folded, then the Pack load, Identity and Advancement (its bonus and title only; the experience is the Level row's). The play column leaves out Skills and Saves. "Traits" heads a section on both sides (the play column's traits with Use, the sheet's every trait as chips): ⚑ 1.
- **Edit moved from the bar to the foot** on the sub-screen (every width); beside the Player screen it stays beside the sheet's heading. The foot's status line reads "Up to date", the saved notice after a save ("Saved."), or, offline, "Offline. Saved on this device" with the warning sign on one line (Design's answer 4).
- **The fold row** is `FoldedGroup` itself (Design's picture review on #558, replacing the first build's own button with creation's square): `SheetSection` composes it and keeps only its memory per device, by name. The label is bold sentence case like every fold row (small caps stay for section headings); the summary shows while folded, on its own line, kept to one line and cut with "…" at the row's end (a rule scoped to the sheet, `.sheet__section > .creation-fold .creation-fold__note`, since `FoldedGroup`'s note wraps elsewhere: see the status file's ⚑). A folded section is no longer a heading with a named button: it is the `<details>`/`<summary>` row the Pack uses, inside its named region.
- **The summaries keep their ruled content** (06's Sheet section, sr-7): only the separators change (commas, a colon after a count: "5: Hark, Slip through reeds…"). The mockup's own words ("From Human: 2. From Lantern Warden: 3", "2 of everyone's, 3 of the class's", Languages' "Literate", Magic's "Level 1: 2 of 2") are ⚑ 2.
- **Skills on the sheet are List rows** (the Player screen's look, the kindred's tag under the name); `SkillGrid` is now used by no screen (kept for the gallery). A long group's "N more ›" is a small secondary button "N more"; Magic's too.
- **No middle dot elsewhere on the sheet:** the trait chips' group titles ("Kindred: Bog folk"), ", drawback" and ", lv N" inside a chip; Magic's tabs ("Spell book: 4"); Advancement's line ("Level 1, 0 XP"); a background's rolled spell; the attack breakdown's rows; the edit form's "Level 3, your GM changes it". "Change details ›" is a button "Change details".
- **Every pop-up on the sheet is a Sheet** (`BreakdownSheet`), none with Got it; AC's Clear is a row, as on the Player screen. The save tiles and a skill's sheet are the Player screen's own pieces, moved to `src/app/FigureSheets.tsx`.
- **The Pack load section** on the sheet is the Pack's piece (slice C): its insides are C's (the inventory's Fold rows); the section's own phone fold, which C left for the sweep, is D's fold row like every other section, and its folded line takes commas (`packLoadSummary`).
- **Merged with main on 2026-11-08** (C, #552; creation retest 2, #555): no behaviour changed by the merge. (Since #558's review the full sheet's fold rows are `FoldedGroup` too: one build.)

### E, the app-wide sweep, with the Tome rename (branch `m5b-players-e-sweep`)
- **Scope as Design confirmed it (2026-11-08)**, which differs from this plan's E: no disabled buttons, no middle dot, square chits (R3-6), the Code column, the Tome rename and the gallery's Light section. **"… ›" links are not swept here** (this plan's E lists them; Design, ⚑ 6 on #561: leave them). **▲ is** (the review round, ⚑ 6): the last plain ▲ used as a mark (a blocked destination) is the warning sign.
- **Sign-in (Design on #561):** the wordmark block starts a third of the way down only on a screen at least 700 px tall; below that N1 (2026-10-28) holds and it sits high. The sign-in draws no header line; the short rule is the only one.
- **Stored words keep " · "** (the review round): a patch's name, a draft roll's label and a watch choice are saved and matched as before; only their display takes the comma (`src/core/storedWords.ts`).
- **Review round on #561:** the full sheet's other worked-out figures became tiles of the same part after the four (⚑ 1); "Take back the invite" / "Take back the request" (⚑ 2).
- **Middle dots:** by the creation rules, commas inside a line by default; a colon after a label that leads its value ("Off: <choice>", "Retired: 2", "Hit: <row>", "Closed: <note>", "Course changed: …", "2nd watch: Reed, Moss", a group prefix "Group 2: …", a patch line "Max HP +2: <choice>, <pack>", a count after a title "Spells: 4"). Done by a script over the code's strings, templates and JSX text only (comments and regexes untouched), then by hand where a comma read badly. A rule group's count keeps a comma ("Optional rules: Fen Rules, none") so a line never has two colons.
- **Kept lines read both ways:** a watch kept on an encounter ("2nd watch · Reed, Moss") and a camp check's group ("… · now") were written with the dot before the sweep; the chip and the camp lookup read both.
- **Busy is not disabled:** a button whose action is running carries `aria-busy` (its busy look, 06's Buttons: default, pressed, busy) and ignores a second tap through one document listener (`src/ui/busyGuard.ts`), instead of `disabled`. A blocked action (a limit, a missing choice, a lock, a countdown) opens `BlockedSheet` with why.
- **The loading screen** is the wait while the device checks for a saved session (it was the words "Opening…"); the screens' own "Opening…" lines are unchanged.
- **Wordmark sizes** use the type tokens nearest the mockup: 48 on sign-in (mockup 44), 36 loading, 20 on Your campaigns.
- **Derived values as Score tiles outside creation:** the full sheet shows its scores as tiles (D) and, since the review round, its other worked-out figures as tiles too. The creation review's derived tiles are retest 3's PR 1.
