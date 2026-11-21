---
status: pending
milestone: December first play (`docs/plans/december-first-play.md`, tier 1: the turn at a place of linked spots)
absorbed-into: pending, with the pull requests that build each piece (`docs/plans/dec-9-the-strip-and-next-turn.md`; 05 a place's rules and who reads them; 06 Components: the strip, the icon part, the menu; 07 `procedure`, a rule's `gmOnly`); docs/09-decisions-log.md (2026-11-12)
supersedes: the guided turn of set 2's first drawing (stage sheets, a put-off state, a queue: never ruled, dropped); mc-49's "generic mark" set as the icon source (ds-6 names the set); the default that a place's rules start closed to players (mc-51)
---

# The December mockups, set 2: Francis's rulings on the walk (2026-11-12)

Ruled by Francis picture by picture on the Design Studio's set 2 (`docs/design/mockups/december/02-the-turn.html` and `08-credits.html`, branch `design-december-mockups`). Set 2 was first drawn as a guided turn; he re-thought it as a reminder, and approved the result as drawn ("approved"). Examples are the mockups' invented ones.

## The strip of the procedure's steps
| Id | Ruling | His words |
|---|---|---|
| mc-53 | The steps of play are a reminder, not a process: a strip of circles with icons on the GM's Scene and the players'. It keeps no state, marks no step as current, opens no stage and stops nothing. | "I love the strip… but i like it as a reminder to the gm and to players of the flow of a turn, not because i want it systemetized" |
| mc-54 | The steps shown are those of the procedure in force: the place's own if its pack gives one; else its exploration mode's from the rules pack; else the app's default for general play, five steps: Describe, Clarify, Act, Judge, Resolve. | "in the absence of rules for that region, we use this" |
| mc-55 | A step is a tap only where a pack carries text for it; the tap opens that text in the book's words. A step with no text is a label. | "yes" |
| mc-56 | The strip has no heading, for the GM and the players alike; "Sequence of play", or the pack's name for its procedure, is its name for a screen reader. On a tablet each icon has its word under it; on a phone the strip is icons only. | "i want the icons for sequence of play but not the title"; "both"; "on phone remove the words" |
| mc-60 | The default's icons: a herald's trumpet (Describe), a crystal ball (Clarify), a raised sword (Act), a wizard's hat (Judge), a chest (Resolve). A pack may name an icon for each of its own steps; a step with none shows its number in the ring. | "sword brandish for act, trumpet flag for describe"; "pack can name an icon" |

## Time, and the map on the GM's Scene
| Id | Ruling | His words |
|---|---|---|
| mc-57 | The Scene has one time control, "Next turn" with an hourglass: one tap advances one unit of the mode in force (a turn, a round, a day, as the pack defines), at once, with Undo. No sheet and no advance-by on it. The menu's existing "Advance by…" stays as built. | "one turn at a time is fine that's how it's done at the table"; "next turn is enough for now" |
| mc-58 | At a spot of a place with a map, the GM's Scene carries the place's map card under "Waiting for you", opened on where the party is. | "where's my map?" |

## A place's rules and their buttons
| Id | Ruling | His words |
|---|---|---|
| mc-51 | A place's rules are open to players by default, from the moment the party is in the place (the lead's reading with mc-28b: once the place has been shown to them). The pack marks a rule that is the GM's alone (pf-12d), which starts with the eye closed; the GM may close or open the eye on any rule, at once, with Undo. On the GM's Rules list an open rule carries no line saying so; a rule the pack closed says "The book keeps this for the GM." | "This is not a hidden rule - players should be aware of it before they fall in" |
| mc-49a | A rule's button opens that rule's sheet (the book's words, its table if it has one) and runs nothing, for the GM and for a player. A player's sheet has no eye and no in-force toggle. The button is the height of the screen's other large buttons, with no divider beside it. | "this feels too small and the wrong icon, and what's the bar next to it?" |
| mc-52 | One rule button sits on the place's card beside Move on. Two or more sit in a row under Move on, right-justified. On a phone Move on takes the full width and the row sits under it, right-justified. Past what fits a row, the rest go under the card's "more" with their words (the Studio's proposal, not drawn). | "next to move on"; "right justify the buttons when they're under move on" |

## Icons, and "About this app"
| Id | Ruling | His words |
|---|---|---|
| ds-5 | The app's icons are medieval or fantasy in nature. | "a design principle for this app is that icons should be medieval or fantasy in nature" |
| ds-6 | Icons come from one open-licence set, game-icons.net (CC BY 3.0: free, commercial use allowed, each icon's author credited). Nothing from any other licence is mixed in. Each icon taken is recorded with its name, author and licence. Icons already in the app change at the sweep after the December mockups; until then the two styles sit side by side. | "b"; "yes" |
| ds-6a | The menu gains "About this app" above Sign out. Its sheet: the app's name and version on one line; a section "Credits" with the line "Icons are shown in the app's colours.", a row for each icon in use (the icon, its plain name, its author, the set, the licence as a link), then the fonts with their licence. An X closes it. | "Put it in a subsection of new menu item 'About this app'"; "good" |

## Pack format
| Id | Ruling |
|---|---|
| pf-14 | `procedure` keeps the list shape the exploration modes already carry, `[{ id, name, icon?, kind?, checkId?, text? }]`, and is now also allowed on a place (a region or a location) and on the rules set as its default. `text` is new and optional: the step's own words from the book (rt-1 block shape). The Pack Creator's correction of the lead's first shape; no pack changes. |
| pf-12d | A rule in a place's `rules` may carry `gmOnly: true`: the book keeps it from the players. Absent means open to players (mc-51). It marks a whole rule; a rule is not split to hide a line. |
| pf-12c | Confirmed: a rule's `button` and a procedure's step name an icon from the app's set (ds-6). Every icon name a pack already uses keeps resolving: the app maps old names to new pictures in its own table at the sweep; packs are not renamed. An unknown name falls back (a step to its number, a rule button to a generic mark with its words). |

## The pictures approved (branch `design-december-mockups`, `docs/design/mockups/december/png/`)
| Picture | What |
|---|---|
| `02-01-scene-at-rest-dark`, `-light` | The GM's Scene: the strip, Next turn, the rule button beside Move on, the map |
| `02-24-players-no-strip-dark`, `02-25-players-no-strip-phone-dark` | The players' Scene, tablet and phone (the file names predate the ruling: the strip is there, its heading is not) |
| `02-11-pack-steps-dark`, `02-12-step-text-dark`, `02-21-pack-strip-phone-dark` | A pack's own steps; a step's text |
| `02-13-strip-phone-dark`, `02-14-strip-long-names-dark`, `02-15-five-icons-dark`, `-light` | The phone strip; long names; the five icons |
| `02-18-three-rule-actions-dark`, `02-19-three-rule-actions-phone-dark` | Two and three rule buttons |
| `02-20-players-rule-aid-dark`, `02-22-players-rule-sheet-dark`, `02-23-rules-open-and-closed-dark` | A rule for players; the GM's Rules list |
| `08-01-credits-tablet-dark`, `-light`, `08-02-credits-long-dark`, `08-03-credits-phone-dark`, `-light`, `08-04-credits-menu-item-dark` | "About this app" |

## Honest notes
- With no heading, a pack's own strip no longer says which procedure it is; the icons are the only sign that a place swapped the default.
- On a phone a new player cannot learn a default step's name from the strip (no words, no tap); the table tells them.
- Solid icons sit beside the app's thin line icons until the sweep; the die glyphs will then be a third style, to be decided at the sweep.
- The line "Icons are shown in the app's colours." is the lead's cautious reading of the licence's wish that changes be indicated, not a legal one.
- "Grimoire 0.9.2" in the picture is a placeholder; the menu's real order was not checked against the app.
- Still open, for Francis one at a time: what a player's rule sheet says of a rule the GM has switched off (rg-5); whether the default five step names, which follow one book's sequence of play, sit well with the app's IP rule as a built-in default.
