---
status: pending
milestone: December first play (the Player screen: `docs/plans/dec-player-figure-sheet.md` now; the redesign's own plan to follow)
absorbed-into: pending, with each piece's pull request: 05, 06; docs/09-decisions-log.md (2026-11-14)
supersedes: nothing as a file. Inside it, ps-4 supersedes ps-1 and ps-8 supersedes ps-6. For the Player screen it replaces the order of 2026-10-26 and the two-panel split of 2026-11-09, and tg-1 replaces B10's pressed "Keep lit" button (2026-11-01).
---

# The night of 13 to 14 November: the Player screen for the person playing (2026-11-14)

Francis made a level-2 character, opened the Player screen on his iPad and ruled on it through the night, first on the built screen, then on the Studio's drawings (mockup page 14, `docs/design/mockups/december/14-player-screen-for-the-player.html`, branch `design-december-mockups`). The intent is `docs/intents/2026-11-14-player-screen-redesign.md`. Everything already ruled for this screen is gathered in `docs/design/notes/player-screen-ruled-so-far-2026-11-14.md`.

## A figure's sheet (approved: frames P7 and P7b at 93abd7f6)

| Id | Ruling | Whose |
|---|---|---|
| sv-1 | **The Saves section says one line, not the rulebook's paragraph**: the d20 glyph and "Roll d20: your save's number or higher succeeds.", built from the rules set's die and pass condition so a setting that rolls under reads right. On a save's own sheet the line carries that save's number ("Roll d20: 16 or higher succeeds."). | "Saving throw is missing die icon simplify explanation to just what it takes to pass the check and what die to [roll]"; "Agree on wording" |
| sv-2 | **A tap on a figure opens one sheet that shows its rule at once.** No row that opens a second sheet for the rule. It holds for every figure: a save, a score, armour class, attack and the rest. | "This is two clicks away from the saving throw, it should be what's seen after the first click"; "I like your proposal show me a mockup" |
| sv-2a | **The sheet has no "The rule" heading and no "For <name>" section.** The rule's lines keep their lead-ins. What a score changes for the character is headed "Modifiers", each effect once; an effect that gives nothing is still listed ("Forcing a door: no change."). | "Remove 'the rule' header and the 'for brannock' section entirely. What it changes for brannock gets relabeled 'Modifiers'"; "Duplication" |
| sv-2b | **A save's sheet shows "Modifiers" when a score really changes that save**, and no such section when nothing does. | "Yes to modifiers" |
| sv-3 | **The saves' line sits in the "Saves" heading's own row, and the scores get a matching line with the die glyph in theirs**, where the rules have a check against a score. A setting with no such check shows the heading alone. Where a row is too narrow the line wraps under the heading, above the tiles. | "Add the skill check rule under abilities to match saving throws use the icon. Put the rule for both in the same row as save and score respectively" |

## The screen's order and head (approved: frames P1 and P2 at 4303bd32, ps-9)

| Id | Ruling | Whose |
|---|---|---|
| ps-1 | Superseded by ps-4. (The party list on this screen was to be shown in marching order.) | "Should be marching order" |
| ps-2 | **The order.** Left, top to bottom: the head; hit points; armour class and attack; the weapon in hand; At hand (what is pinned or can be acted on now); then the level block and Details (ps-8, ps-3). Right: scores; saves; movement and load with the load's bar; the traits with uses; then the rest (skills, languages, the full character sheet). | "On right, top to bottom: scores, saves, speed/burden with bar back, abilities, the rest. Pinned spells equipment abilities etc on left above marching order" |
| ps-2a | **On a phone the saves sit directly under hit points and armour class**; then the left column's order, then the right's. Hit points keep the app's segmented bar. | "Under hp and armor. Hp gets its bar back" |
| ps-3 | **Details** (motto, looks and manner, background and the rest, in the pack's and the player's own words, opening in place) sit last in the left column. | "Details replace marching order" |
| ps-4 | **No marching order and no party list on the Player screen.** They live on Scene. A named exception to the intent's "removes nothing a player can read today". Supersedes ps-1. | "Drop marching order from this screen" |
| ps-5 | **The bar reads name, "the" kindred, title.** The portrait is larger. The statuses sit to its right as rings (R3-6: the status's symbol in the middle, the ring emptying with its time), four in view and the rest one tap away; a tap on a ring opens that status's details. With four rings the name and time are on the tap; with one or two they sit in words beside the ring. | "If we're using the top bar put name, 'the' kindred, title. … Portrait gets larger and statuses are tracked to the right of it. Accommodate for four with more one tap away. Tap a status for the details. Duration around the circle like we've designed"; "Status shows an icon at center not a letter" |
| ps-6 | Superseded by ps-8. (The class, level, experience and company sat at the right of a band across the top.) | "Shift class level and experience and company to the right aligned and same height as statuses and profile pic" |
| ps-7 | **No class note above the skills on this screen.** | "Remove the skills explainer" |
| ps-8 | **The class beside the level, the experience with its bar, and the company sit on the left directly above Details.** The head is the portrait and the rings alone, and the first row of score boxes starts on the same line as the top of the hit points box. Supersedes ps-6. | "Goal is for ability boxes (not the header) and hit box bar to line up. Move class level experience company to the left above details" |
| ps-9 | **The tablet and phone frames are approved as drawn** (P1 and P2 at 4303bd32). Approved with them: the lit light sits in At hand with no "Light" heading; the count of refills is in the light's line; Wield stays a button (ah-2). Still to choose: an icon from the set's source for Wield, Use, Quiver, Grip and Refill. | "Approve both" |
| ps-10 | **Every score box is the same size**, with or without a modifier under its number. | "Ability score boxes should be the same size" |

## Standards restated or widened

| Id | Ruling | Whose |
|---|---|---|
| pin-1 | **The pin's star (approved 2026-11-07) reaches spells and traits**: a pinned trait with uses, or a pinned spell, shows in At hand with the small filled star and leaves the list it came from, so each thing shows once. Pinning a spell is in 05 and not built; pinning a trait is new. | "Pinning with a star symbol was definitely covered. Look for it in design" |
| sb-2 | **A row's button on this screen is the stacked button** (mc-36a): the icon above, its word under, every button one size, at the right of its row. A button with no fitting icon in the set takes the set's generic mark until one is chosen. | "Use icon with word underneath for the buttons like we do on scene screen that's another standard" |
| tg-1 | **A pair of opposite actions is a toggle** (the ruled toggle, ds-1a to ds-1c), never two buttons and never one button that stays pressed. A light's lit or out is a toggle on its row; "Keep lit" is a toggle with its name beside it. | "Keep lit/put out is a toggle as are any dual mode button sets like that" |
| md-1 | **Weapon modes belong on this screen** as ruled (ah-3, ah-4): the mode button (Quiver, Pouch, Grip, Stance) beside a weapon's action, the line naming the mode in use. | "Also missing are quiver pouch and the wield-modes, and I'm sure other things as well" |
| nt-1 | **Before a screen is drawn, everything already ruled for it is gathered in one sheet** and given to the drawer, with the app-wide standards ruled on other screens. | "We already ruled on that too- you need to consolidate our notes" |

## The pack format and the order of building (the lead's)

| Id | Ruling | Whose |
|---|---|---|
| pf-20 | **A rules set may carry `rolls`**, beside `naturals` and keyed the same way by roll type (`save`, `abilityCheck`; others later): `{ "die": "d20", "pass": "atOrOver" }` or `"atOrUnder"`. The app builds sv-1's and sv-3's lines from it and from nothing else: "Roll d20: your save's number or higher succeeds." for `atOrOver`, "…or lower succeeds." for `atOrUnder`. A rules set without the key for a roll type shows no line for it. `pack:check` refuses a die it cannot draw and a `pass` it does not know. Additive: no pack carries it today, and each rules pack gains it from its own book. 07 takes the key with the pull request that reads it. | The lead's: the Builder found that no rules set carries the die's pass condition as data, and sv-1 forbids typing the line in |
| po-3 | **A piece of the redesigned Scene is built directly in the book's type** (through a type-only scope split from creation's), not in today's faces to be restyled later. Its as-built pictures go to Francis before merge, as every built piece's do. First: the place page (5b) and the map's pieces. | The lead's, under po-2 ("I want to limit the rework"): the type is ruled (ts-1 to ts-3) and approved in creation (cs-40), the layouts are approved (pg-1) |

## Later the same night (the lead's, each told to Francis in the morning)

| Id | Ruling | Whose |
|---|---|---|
| mv-2 | **A speed typed by hand is marked as such, and a speed that was only filled follows the rules in force.** Every place a speed can be typed adds the field to the character's `edited_fields` (the sheet's edit, the draft and sent-back editor, the finishing saves); Undo clears the mark it set; creation's fill never stores a speed as if typed. A stored speed with no mark counts as filled, so one typed by hand before this change follows the rules: accepted, since the campaign has not started. And a speed is read only from the highest rules set that has a `movement` record, or from sets above it: never a number from one rules set under another's formulas. No migration. Not in it, for a later ruling: load tiers merged across every rules set; a kindred's own speed coming first. | The lead's, technical: Francis found "Movement and burdened show different speeds"; the cause was one rules set's number under another's formulas, stored at creation and then taken for a hand edit |
| pf-21 | **A save modifier's `value` may be `{ "raceField": "<field>" }`**: the number in that field of the character's kindred, alone. The line shows beside the save for a character whose kindred carries the field with a number other than nought, and is absent for everyone else. As with every save modifier it is shown, never added into the save. Additive beside the two shapes read today (`{ fill }`, `{ from, plusRaceField }`). Where such a modifier lives in a stack of packs is not ruled here. | The lead's: the conversion writes a kindred's bonus against magic this way and nothing reads it |
| gp-7 | **A character owned by the party can be given to a player**; the GM taking it as the GM's own from that sheet is not offered, and nothing is built for it before 5 December. | The lead's, from the review of #774 |

## Built pieces approved from pictures

| Id | Ruling | Whose |
|---|---|---|
| ap-2 | **The GM's Knowledge sheet is approved as built** (pull request #770; pictures `pictures-for-approval`, `dec-7-6a/`): a centred wide sheet, the facts as bold lead-ins, sections that fold, no eyes and no sharing lines until sharing has its plan, "The pack gives no knowledge for this place." when there is none. | "Approve both" |

## Not settled
- Whether the Player screen's redesign is built before 5 December or with the app sweep: Francis's, once it has a size.
- Whether every rules set carries a check against a score in a form sv-3's line can be built from: the Builder's to say.
- The hit points box and the block of score boxes start level; their feet are 38 px apart as drawn.

## Honest notes
- The lead told Francis the frames "matched everything ruled" when they matched only the lead's own sheet. Three things already ruled were missing and he caught each: the pin's star, the status's symbol, the stacked button. Two audits followed and found more (the mode buttons, Keep lit and Refill, the Traits heading, Wield, the size of the hit points squares, scores in two rows of three).
- The frames were opened in the dark theme only; contrast, target sizes and Larger text were judged by eye, not measured.
- The frames are drawn from the mockups' own copy of the restyle, not from the app's stylesheet.
