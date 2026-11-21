# Plan: the one app sweep after the December mockups

Written 2026-11-19 by the docs agent, from the driver's running list and the rulings it cites. **Adds no rule and decides nothing**: every line says where it was ruled, or says it is not ruled and is listed as ⚑. Francis said yes on 2026-11-19 to this file being the list's home (09, 2026-11-19, `[process]`). **Not sized.**

## What the sweep is and when it runs
- **One sweep of the whole app, after every December mockup is approved** (Francis, 2026-11-12, `design/rulings/dec-stat-block-and-type-2026-11-12.md` ts-2: "the pair everywhere, done with the sweep after the mockups").
- The Design Studio lists every place each standard applies; a builder sizes it; Francis approves from pictures (mockups first, `CLAUDE.md`).
- **Shared parts carry their change at once** (toggle, sheet heads, table rule); **everything else is adopted when a screen is next touched** (ds-2, `dec-mockup-rulings-2026-11-12.md`; the sweep is what is left after that).
- Until the sweep, creation alone carries the book's type through tokens of its own (cs-1, ts-2; 06, "Creation in the book's type").
- Pictures of record for the December set live on the branch `design-december-mockups` (`docs/design/mockups/december/`); that folder is not in this tree.

### How it sits beside the Style release
| Source | Says |
|---|---|
| `08-roadmap.md`, Style release | A **token pass** "before table test 1, late Nov / Dec, between milestones after the M5b gate": type scale, colour pairs with contrast checked, surfaces, spacing, through 06's tokens, one builder pull request plus the gallery pictures re-approved once; the **full release** after the table test, with the name question. |
| ts-1, ts-2 (2026-11-12) | The type pair (Bitter with Alegreya Sans SC) goes to the whole app in the sweep. |
| ds-5, ds-6 (2026-11-12) | Icons from one open set replace the app's existing icons in the sweep. |

The type pair and the icons are work the Style release's token pass and "final symbol family" also name. **Whether the sweep is that token pass, or runs before or after it, is not ruled: ⚑ 1.** Nothing in this file orders the two.

## Items
Columns: **Ruled** is the file and id (or the 09 date). **Mockup** is the approved picture, or "none yet". **State**: ruled, ⚑ (a question is open), or "notes only" (in the driver's list, no ruling in the repo: listed as ⚑ 20).

Rulings files are in `docs/design/rulings/`. 09 is `docs/09-decisions-log.md`.

### The standards (ruled)
| # | What changes | Ruled | Mockup | State |
|---|---|---|---|---|
| S-1 | **Bare eye**: open when shown to players, closed when hidden, no box, no word beside it; 44 px target; the crossed eye only for the GM's alone. The notes name hand-made boxed eyes in `PlaceCard.tsx`, `TownScreen.tsx` and a piece eye with its word (#641) | `dec-mockup-rulings-2026-11-12.md` ds-2 (code places: from the notes) | the standard drawn in the December set (the ruling names no file); per-screen: none yet | ruled |
| S-2 | **No Close beside an X**: a sheet or pop-up with an X has no Close button. The notes name `ruleRows.tsx` ("Close" with nothing to use) and `Messages.tsx` ("Close the message", check if inside a Dialog) | `dec-mockup-rulings-2026-11-12.md` mc-43a (code places: from the notes) | none yet | ruled |
| S-3 | **Die glyph** wherever a die is named or a roll is called for: table die lines, counts like 2d4, hit dice; no glyph where a roll names no die | `dec-mockup-rulings-2026-11-12.md` ds-3 | the glyph as drawn in the December set; per-screen: none yet | ruled; style ⚑ 2 |
| S-4 | **No explainer lines**: no line says what the screen already shows; words with a fact or a consequence stay | `dec-mockup-rulings-2026-11-12.md` mc-46; 06 Words and voice | none yet | ruled |
| S-5 | **Verbatim book text**, nothing silently trimmed; where length hurts, alternatives go to Francis | `dec-mockup-rulings-2026-11-12.md` mc-34 | none yet | ruled |
| S-6 | **The type pair everywhere in one change**: body and display tokens point at Bitter (text 400, names 700, labels 800; a stat block's labels regular weight, coloured, cr-c2) and Alegreya Sans SC Bold (descriptors); EB Garamond retired (and Atkinson Hyperlegible unless kept: from the notes) | `dec-stat-block-and-type-2026-11-12.md` ts-1, ts-2; 09, 2026-11-12 | creation's use approved as built 2026-11-13 (`dec-evening-2026-11-13.md` cs-40); the rest of the app: none yet | ruled; ⚑ 1, ⚑ 3 |
| S-7 | **Plain zero** in figures; figures still line up in columns; a lone number box uses the face's normal figures | ts-3; `dec-evening-2026-11-13.md` cs-40b | creation: cs-40b, 2026-11-13 | ruled; ⚑ 3 |
| S-8 | **Colour alone** is allowed where an approved mockup shows the hue taken away; signals already drawn keep their text or shape until the sweep looks at each | `dec-colour-rule-2026-11-12.md` cr-c1, cr-c2 | none yet (each signal needs one) | ruled |
| S-9 | **Icons**: medieval or fantasy, from game-icons.net (CC BY 3.0, each author credited); every existing icon swapped; an old icon name a pack uses keeps resolving through the app's own table | `dec-mockup-rulings-set2-2026-11-12.md` ds-5, ds-6, pf-12c; 06 Icon | the chosen icons: `dec-mockup-rulings-sets3-5-2026-11-12.md` ds-6b, `dec-midday-2026-11-14.md` ic-2, ic-6; the swap per screen: none yet | ruled; ⚑ 2 |
| S-10 | **Credits** and "About this app": built; follow-ups for the sweep: the row's plain "i", the menu's other plain icons, the version line shown twice on a phone | `dec-midday-2026-11-14.md` ap-5 | approved as built, 2026-11-14 | ruled |
| S-11 | **Toggle** on state: the selected wash, the accent edge and a soft glow, knob right with a tick; off, knob left with a cross. **Two-sided switch**: wash, edge, bold name, no tick | `dec-mockup-rulings-sets3-5-2026-11-12.md` ds-1c, ds-1d | December set 5, approved 2026-11-12 | ruled (a shared part: carried at once) |
| S-12 | **Sheets**: a sheet that opens over the Scene closes by its X and has no "Back to the town"; "Back" only for a step inside a sheet | same file, ds-9 | December set, 2026-11-12 | ruled |
| S-13 | **Buttons at a form's foot** right-justified, the accent outermost | same file, ds-10 | December set, 2026-11-12 | ruled |
| S-14 | **The strip of steps** centred, links stretched a little, on every Scene where it shows; no heading | same file, ds-11; `docs/plans/dec-9-the-strip-and-next-turn.md` piece C | December set, 2026-11-12 | ruled |
| S-15 | **The marching order** at the bottom right of every Scene under the map; no "You" tag anywhere | same file, ds-12 | December set, 2026-11-12 | ruled |
| S-16 | **A place's sheet** follows the region book's settlement layout; a town's top row has no light fact | same file, ds-7, ds-7a, mc-69, mc-70 | December set, 2026-11-12 | ruled |
| S-17 | **Book tables**: a filled title bar with the table's name, a head row over a rule, banded rows | same file, ds-8 | December set, 2026-11-12 | ruled |
| S-18 | **Controls side by side in one row share one height**, built screen by screen at the sweep | `scene-point-to-point-2026-11-18.md` p2p-16 (06, line "One height in a row") | page 23 LA1 (band and map tools), 2026-11-18; elsewhere none yet | ruled |
| S-19 | **Words on a long press** for every icon button at once (needs a long-press part, not built) | `dec-evening-2026-11-13.md` rp-12 | none yet | ruled |
| S-20 | **Lines that remind the player what the GM does, checks or decides**: "the app sweep looks for them" | `dec-test-feedback-words-2026-11-19.md` (last note; voice rule 16) | none (words only) | ruled |
| S-21 | **Pack and Rules tabs**: the Pack foot counts each carried thing once and each row's weight sits under a "Weight" head; the Rules tab, library and a rules set's page dressed as built (rsw-1 to rsw-5, rs-1) | 09, 2026-11-13 `[ui]`; `dec-pack-and-rules-sweeps-2026-11-13.md` | the Pack and Rules pictures of those batches; each page not yet built: none yet | ruled; ⚑ 4 |
| S-22 | **Gear specimen** in the gallery shows no trinket rows and a stand-in "Browse the shop" button: redraw its baseline. The creation shop keeps its behaviour with the town stock row's anatomy and "Buy" | 09, 2026-11-12 `[ui]` (the creation shop); the baseline redraw is from the notes | none yet | ruled (shop); baseline: notes only |
| S-23 | **The wide window**: on a window wider than a sideways tablet the same layout widens; no new column, panel or part; **drawn first**, one picture per screen family at about 1600 and 2000 px | `docs/intents/wide-window-2026-11-19.md`; 09, 2026-11-19 `[ui]` Scope | none yet (asked for first) | ruled Later; five ⚑ open (⚑ 5) |
| S-24 | **Pop-ups centred on a tablet, fitted to their content (440 to 720 px), on every screen but the Player tab**, which is row fb-7 of `dec-player-popups-centred.md`: the Pack tab, the Magic tab and the full sheet beside it, the Scene's sheets, creation, the GM's screens. Until then they open beside their button (final drafts A7). Each screen family with its pictures; creation's sheet checks change with it | `dec-player-popups-centred-2026-11-20.md` fb7-7 (the rule: fb7-1, fb7-3, fb7-4) | the Player tab's: page 31, approved 2026-11-20; per screen: none yet | ruled |
| S-25 | **A long pop-up keeps its heading, ✕ and "Got it" in view while its words scroll.** Today the whole card scrolls and they scroll away | `dec-player-popups-centred-2026-11-20.md` fb7-8 (on the sweep's list; how it looks is not ruled) | none yet (page 31's frame FB7e shows today's) | on the list; needs a mockup |

### Questions the rulings leave for the sweep
| # | What | Where | Mockup | State |
|---|---|---|---|---|
| Q-1 | Which zero the book's face shows (the mockups slash it, the app's book block does not) | `dec-afternoon-2026-11-14.md` ms-3, against ts-3 | none yet | ⚑ 3 |
| Q-2 | Six places where the app as built and a ruling or drawing differ: the pop-up centred on every width against rising from the foot on a phone; the toast inverting with the theme; Undo as an underlined word against a bordered button; the section label at 20 against the Pack's group heads at 14; a book table's title bar on the accent against ink; the Pack list's card title against small capitals | same, ms-3 | none yet | ⚑ 6 |
| Q-3 | Faults measured on the app as built: a link on the dark table band at 4.35 to 1, the two-sided switch at 38 px, a tapped table row at 33 px, a trail link at 21 px, a short name link at 40 px, the sortable list's landing rule everywhere; the amber mark in light at 2.81 to 1 (a colour for Francis); nine faults on the town and Scene pages | `dec-night-2026-11-14.md` ("For the sweep"); `dec-town-ask-card-2026-11-14.md` | none yet | ruled to go to the sweep; the amber colour ⚑ 7 |
| Q-4 | Whether an error toast that asks the player to act stays until closed (every toast goes after 6 s) | `dec-evening-2026-11-13.md` ("for the one app sweep after the December mockups, with a mockup") | none yet | ⚑ 8 |
| Q-5 | The toast's own Undo carries ic-2's arrow (drawn on the card's Undo only) | `docs/plans/dec-9-the-whole-scene.md` ("S17's or the sweep's") | none yet | ⚑ 9 |
| Q-6 | The die glyphs as "a third style" beside the solid icons and the thin line icons | `dec-mockup-rulings-set2-2026-11-12.md` ("to be decided at the sweep"); st-10 (`dec-midday-2026-11-14.md`: the glow-coloured glyphs follow the Scene) | none yet | ⚑ 2 |
| Q-7 | The words for a movement result held at 0 | `dec-night-and-morning-2026-11-13.md` mv-1 ("wait for the sweep"); the notes propose "(never below 0)" | none yet | ⚑ 10 |
| Q-8 | The right-hand panel for sheets: frame 7 draws it; it is "one later change to the shared sheet for every sheet (the sweep)" | `docs/plans/dec-7-5-place-page-and-map.md` (Shape) | frame 7 of that plan's page, in the December set; not ruled as built | ⚑ 11 |
| Q-9 | The players' Scene on a phone: shown pieces not folded for 5 December, "for the sweep" | `docs/plans/dec-9-the-players-scene.md` P11, p2p-24 | none yet (no whole-page frame) | ⚑ 12 |
| Q-10 | Whether the Player screen's redesign and the restyle are one pass (built once) | `docs/intents/2026-11-14-player-screen-redesign.md` (po-2); the screen went live 2026-11-19 (09) | P1, P2 approved 2026-11-14 | the screen is done; ⚑ 13 |

### Found in the repo, not in the driver's notes
| # | What | Where | Mockup | State |
|---|---|---|---|---|
| R-1 | **The audit**: 49 findings on 71 views (12 annoying, 37 polish, none blocks play), each naming the rule it breaks; "the sweep's designer has the last word". Examples: no offline pill (sa-1), rail tabs 40 px (sa-2), two rest controls (sa-12), explanations in the camp (sa-15), symbols with no words (sa-33) | `docs/design/notes/sweep-audit-2026-11-18.md` | none yet | audit, not ruled; ⚑ 14 |
| R-2 | Mockups' measured faults (pages 16, 18, 19) are "also a fault in the app as built and go to the sweep" | `dec-town-ask-card-2026-11-14.md` | none yet | ruled (with Q-3) |
| R-3 | The app-wide type sweep and the Rules tab sweep named as work after 5 December, each owing a plan | `dec-morning-2026-11-15.md` ord-2; `docs/design/notes/sweep-rulings-vs-plans-2026-11-15.md`; `docs/plans/dec-13-the-player-screen.md` ("each owes its own plan") | none yet | ⚑ 4 |

### In the driver's notes, no ruling in the repo
| # | What (from the notes) | Matched to the repo? | State |
|---|---|---|---|
| N-1 | Bitter's `zero` and `tnum` may not combine; test four cases on the Fontsource files at install | no ruling; ts-3 gives up the slashed zero, which may make it moot | notes only; ⚑ 20 |
| N-2 | Two creation step names and a clue line on the Scene wrap in Bitter | no ruling | notes only; ⚑ 20 |
| N-3 | One wording app-wide, "Not open to <name>" (no article); the Studio's frames capitalise the name: change everywhere at once | no ruling found | notes only; ⚑ 20 |
| N-4 | Player screen's Saves line as one line with the die glyph; the hint lines "Tap a figure for where it comes from"; "Attack bonus 1" beside "Melee +2" | Player screen shipped 2026-11-19; whether P1 covers these is not checked | notes only; ⚑ 13, ⚑ 20 |
| N-5 | Sweep questions of 13 Nov night: OptionRow announces as a radio where a tap acts at once; "Scores saved." shown for a redo that changes nothing; a pack-checker warning for blank rule text | no ruling | notes only; ⚑ 20 |
| N-6 | Kit rolls dialog: closing it unfinished toasts "<kit> put back"; at desktop width it sits low and right | no ruling | notes only; ⚑ 20 |
| N-7 | Pack sweep: kit entry container heading and "Free", tablet empty right column, foot count by quantity; Rules sweep: raw field dumps, table row nesting | the raw dumps match rsw-3; the foot count matches audit sa-18; the rest: no ruling | partly ruled; ⚑ 20 |
| N-8 | Move on's narrow messy-data frame (a column of about 90 px): the three way buttons' words overlap ("Climbi/Rowin/Wading"); on main since B16 part 2 (#1014) | not in the repo | notes only; ⚑ 20 |
| N-9 | A formula clamped at 0 reads "Sprint: speed - 40 = 0." | see Q-7 | notes only; ⚑ 10 |
| N-10 | Read each class's experience table by its own `xpTableId` within its own pack's stack position, never a merged id map; only 26 of 80 classes have titles, and they stop at level 9 | cs-16 rules the level table; the reading rule is not ruled | notes only; ⚑ 20 |

### In the driver's notes, not sweep items
Listed so the old note can be turned into a pointer without losing them.

| What | Where it lives |
|---|---|
| The order of 12 Nov night (first-night pieces, Pack tab, Rules tab) | overtaken by ord-2 (`dec-morning-2026-11-15.md`) |
| The strip's fallback words (Describe, Question, Act, Test, Resolve) | ruled in `dec-creation-sweep-built-screens-2026-11-12.md` (mc-54b, mc-60a); built in dec-9 piece C |
| Creation goes live batch by batch | cs-17, `dec-creation-sweep-built-screens-2026-11-12.md` |
| `pack:check` validating `meta.statBlockLayout` | `docs/plans/dec-pack-check-stat-block-layout.md` |
| Cap vitest workers on CI; lighter main runs | process ideas, not ruled |
| Fix- branches (library source line, count line, kit Pick click), the Player screen faults of 14 Nov (duplicated effect, a save two taps away, Movement against Burdened) | faults, fixed test-first; sv-2 (`dec-player-screen-2026-11-14.md`) |
| The Player screen's party in marching order (ps-1) | superseded by ps-4 |
| A person's name shown as the start of an email (F73) | nm-1, `m5b-morning-rulings-2026-11-11.md` |
| Picture folders pack-as-built/ and rules-as-built/; stale header comments in `creation.tsx` | housekeeping |

## ⚑ For Francis
1. **The Style release's token pass and this sweep both name the type pair, the icons and the colour work.** Is the sweep the token pass, or do they run in a set order? (08 puts the token pass "late Nov / Dec", before the sweep exists.)
2. **The three icon styles** (solid game-icons, thin line, die glyphs): which stays, which goes at the sweep (ds-6, st-10).
3. **Which zero**, and whether Bitter's figures keep columns aligned (ms-3, ts-3).
4. **Does the Rules tab sweep and the app-wide type sweep (ord-2) live inside this sweep, or have their own plans?** The 15 Nov list says both owe a plan.
5. **The wide window's five questions**: a cap or the whole window; which columns grow; which screens; a paragraph's line length; the shared table view (`intents/wide-window-2026-11-19.md`).
6. **The six built-against-drawn differences** of ms-3 (pop-up position, toast, Undo, heading sizes, table bar, Pack card title).
7. **The amber mark's colour in light** (2.81 to 1).
8. **Does an error toast that asks for an action stay until closed?**
9. **Does the toast's Undo carry the arrow?**
10. **The words for a result held at 0.**
11. **Is the right-hand panel for sheets part of the sweep?**
12. **The players' Scene on a phone**: fold or not.
13. **Which of the Player screen's sweep items P1 already covers** (Saves line, hint lines, "Attack bonus").
14. **The audit's 49 findings**: which are taken into the sweep, and which are not.
15. **Order of the sweep's own steps** (the shared parts first, then the Player screen and Scene, then the rest): not ruled; Francis's 12 Nov order was overtaken.
16. **Who draws the sweep's pictures** and how many (a page per screen family, with the wide window first, per the intent).
17. **Where the sweep is merged**: one pull request or batches (creation went batch by batch, cs-17).
18. **Whether the sweep runs before or after table test 1** (08: Jan 23, 2027).
19. **The size**: not sized; a builder's sizing is owed.
20. **The notes-only items** N-1 to N-10: keep, drop, or rule each.
