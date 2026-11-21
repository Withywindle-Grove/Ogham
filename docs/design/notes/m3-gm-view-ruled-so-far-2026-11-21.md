# Page M3 (page 32): what is ruled for the GM's view as the player (2026-11-21)

The ruled-so-far sheet (nt-1) for mockup page 32 (M3, row C15 of `docs/plans/test-feedback-2026-11-19.md`), compiled before drawing. History only once the page is approved; the specs (03, 05, 06) and the rulings files win over this sheet. The newest ruling wins.

Short names: GV = `../rulings/dec-test-feedback-gm-view-2026-11-19.md` (tfg-1 to tfg-5); D5 = `../rulings/dec5-flags-sitting-2026-11-20.md`; P4S = `../rulings/p4-sitting-2026-11-20.md`; POP = `../rulings/dec-player-popups-centred-2026-11-20.md`; page 28's sheet = `m4-pins-ruled-so-far-2026-11-20.md`.

## The view itself

| What is ruled | Where |
|---|---|
| From the GM's Players list, **View sheet** opens the character's Player tab as its player sees it; **Pack** the Pack; **Magic** and the players' **Scene** the same way | tfg-1 (GV) |
| The GM can act there as the player can, except the player's own actions (below) | tfg-1, tfg-5 |
| **Magic** only for a character who has a Magic tab | tfg-2 |
| In the log an act made there is **the GM's, on that character**, as every GM act is today; nothing to build | tfg-3 |
| The GM's **Edit** sits on the Players list, with View sheet, Pack, Magic and Scene, as the player's sits on "Your characters" | tfg-4 |
| The player's Edit: the stacked button (the quill over "Edit") at the card's top right of "Your characters"; never beside "Remove…" at another height | tfr-4; 06, Character card, Edit |
| **Closed to the GM, each button staying and explaining in a pop-up that only the player can:** asking for a sheet change, sending a request, taking back the player's own request, choosing the active character | tfg-5 |
| **Five more, closed the same way:** taking back a sheet change, answering the GM's offer, Stay here, undoing a purchase, putting away the "New" mark on finds | d5-21 (D5) |
| The "New" mark on finds must not clear because the GM looked | GV, For the builder |
| docs/03 does not change; the GM may see everything (no hidden-data line moves) | tfg-5; 03 |
| **Whose view it is, and the way back to the Players list, show on every tab of the view** | GV, For the builder |
| A character with **no Player tab yet** (waiting, sent back, a draft): View sheet opens the full sheet, as today; the GM reviews from it | d5-22 (D5) |
| The page "Full sheet" stays until after 5 December, reached from the phone menu's "Full character sheet"; then retired; d5-22's review needs a home first | of-8 (P4S) |
| The GM's own characters ("Yours") have rows and open the same way; nothing else ruled for them | GV, For the builder |

## The Players list's row

| What is ruled | Where |
|---|---|
| Today's row: the portrait, the name with its summary, a small line naming the player ("Sam, joined 12 Oct"; the GM's own: "Yours"); small plain buttons View sheet, Pack, "Give to a player…", "Remove…" | 06, Give to a player; page 13 G1, P1 (approved 2026-11-13) |
| "Give to a player…" sits between Pack and Remove…, plain; the page's one accent stays "Invite a player" | gp-1 (page 13) |
| As built: Pack and Give only for an approved character not archived; Remove… for any but one waiting | `src/app/GmCampaign.tsx` (read 2026-11-21) |
| The row's layout with up to seven controls is the page's to draw: "a fourth button or in the row's ⋯"; at 375 px with a long name | tfg-4; GV ⚑ 7; plan ⚑ 18 |
| A row's buttons wrap under its name on a phone | page 13, P1 |

## The Player tab (as the player sees it)

Page 28's sheet holds the tab's rulings in full (order, notices box, the foot's rows, pins, At hand, "Got it"); they hold here unchanged. The ones M3 leans on:

| What is ruled | Where |
|---|---|
| Two columns on a tablet; left: head, hit points, armour class and attack, the weapon in hand, At hand, the level block, Details; right: the notices box, scores, saves, movement and load, the pinned abilities and traits, skills, languages, the foot's rows | ps-2, ps-8, ps-3, tfr-5, euf-3 |
| The notices box: the herald's trumpet, its count in words; a waiting change shows only there, with its own "Take back" | tfn-1, tfn-2; page M1's fixes 1, 2; 06, Notices box |
| "No light" shows in the Player tab's notices box and on Scene only | d5-20 |
| Reading pop-ups on the Player tab end with "Got it", plain | tfb-2 |
| On a tablet held sideways every Player tab pop-up opens centred, the page dimmed; 440 px at least, 720 px at most, fit to content; the phone's sheet comes up from the bottom | fb7-1 to fb7-6 (POP) |
| Hit points change in place with − and +, at once, one Undo | 06, Players, Player |

## The Pack

| What is ruled | Where |
|---|---|
| Grouped by where it is carried, A to Z; At hand first; Worn and in hand always open; Gear and the Party stash as fold rows; **Add item** the screen's one accent button, in the foot with the count | 06, Players, Pack; N18, N19 |
| A tap on an item opens its sheet: details, the actions as list rows (Give to…, Put in…, Drop last), the Pin star in the head | 06, Item sheet |
| Unidentified items: the player sees what it appears as and "What you notice"; hidden facts don't change the player's numbers until revealed | 05, Unidentified items |
| Today the GM's Pack carries **Reveal** (a pop-up of each hidden fact and "Tell them everything") and a hidden bonus marked "(hidden from the player)" | 05 |
| GM **Whose pack** (Players, Inventory): characters on the left, the chosen character's Pack on the right | 06, Layouts |
| "As the player sees it" has none of the GM's extras; where they go is **open** | GV ⚑ 3 |

## Magic

| What is ruled | Where |
|---|---|
| A tab for a character with any magic: Prepare, then spells by level with Cast, then other kinds of magic under the pack's own word; its icon a crescent moon with a spark | mp-20, mm-1, mm-2; `magic/04-magic-tab` (approved 2026-11-10) |
| Cast is never disabled: when something stops the caster, the tap explains why | mm (magic/04) |
| "No light" is not on the Magic tab | d5-20 |

## The players' Scene

| What is ruled | Where |
|---|---|
| Structure: the top (band, four facts, the strip), the prompt slot under it; two columns of one width (left: the place, Where to?, Activities; right: the map, the place's card, the marching order); one column under 768 px, the left first | page 18, PL1, PL5, PL5b (ap-10); 06, Players' page (P1 built) |
| Light and Rest are the player's own group's; Weather and the Encounter check their place's | page 18, PL6; st-5 |
| A request waiting on the GM: "Waiting for your GM: search the piles." with Cancel (never the accent) | page 18, PL4b |
| For first play a way's button opens a pop-up saying the GM moves the party (pw-1) | page 18, PL4c |
| Activities, Rest and entering a roll are open to the GM (03); a secret activity, buying, selling and "Somewhere else…" are requests, so closed to the GM by tfg-5 | 03; tfg-5 |
| Whether the GM sees **that player's group only** (its place, its lights, what was shown to it) is **open** | GV ⚑ 2 |

## App-wide standards

| Standard | Where |
|---|---|
| Never a disabled button: a blocked action stays tappable and says why in a pop-up | Hard rule 7; 06 |
| The blocked action's words: a short title, then why, then the way forward | 06, Words and voice (Blocked action) |
| One accent button per screen; Undo over confirm | Hard rule 7 |
| Targets 44 px with 8 px between; nothing under 14 px; light and dark | Hard rule 7; t44-1 |
| Colour alone carries a distinction only where its mockup shows it without the hue and Francis approves it | Hard rule 7 (2026-11-12) |
| The top row: a back link at the left ("‹ Players" on a sub-screen), Log, ✉ and ⋯ at the right; on a phone the bar's title centred | 06, Navigation; Top row |
| The phone's player tab bar: Player, Scene, Pack, Log, and Magic for a caster (five at most); the current tab bold with a 3 px accent mark | 06, Tab bar (mm-2) |
| A stacked button: an icon above its word, 88 by 56 px or more | 06, Stacked button (ic-1, stk-1) |
| No explaining lines where the screen already shows it | p2p-17 |
| Invented names only; no game, book or adventure names | Hard rule 2 |

## Not settled: drawn on page 32 as choices

| ⚑ | Frame | The designer's lean |
|---|---|---|
| GV 7, the row's buttons | M3a, M3b | The four views as small buttons, Edit as the stacked quill at the row's right, "Give to a player…" and "Remove…" in the row's ⋯ |
| Whose view, and the way back | M3c, M3d | "‹ Players" as the back link, and a band under the top row on every tab |
| GV 4, the player's numbers or the GM's marks | M3e | The player's numbers exactly |
| GV 3, the GM's Pack tools | M3g | The view is the player's alone; one row at its foot to Whose pack |
| GV 2, the Scene | M3i | That player's group only |
| The blocked pop-up's words | M3f | "Only Sam can …", naming the player |
