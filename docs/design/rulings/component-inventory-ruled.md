---
status: absorbed
milestone: m4b
absorbed-into: docs/06-screens-and-design.md (Components)
supersedes: —
---

# Component inventory (atomic design): RULED

Status: RULED 2026-10-25 (component system approved, with gallery and screenshot tests; gate rulings B15–B25 added). Destination: a new section in `06-screens-and-design.md`, "Components".

## How it works (proposed rules)

1. Every reusable part of the interface is listed once here, with its level, where it's used, and the ruling it came from.
2. **Build once.** A screen composes listed parts; it never rebuilds one. A part needed on a second screen moves into the inventory in the same change.
3. **Change once.** Changing a part changes it everywhere it's used. A screen that needs a variant gets a named variant here, not a copy.
4. Claude Code keeps a **code column** (the component's name in `src/`), and flags any duplicates it finds.
5. Design principles (06) still apply to every part. The inventory says *what* exists; the principles say *how* it behaves.

Levels: **Atoms** (tokens and single controls) → **Molecules** (small groups with one job) → **Organisms** (self-contained sections) → **Templates** (page layouts) → **Pages** (actual screens).

## Atoms

| Part | What it is | Source |
|---|---|---|
| Colour tokens | Folio light (Bone) and dark; accent; warning; party circles | 06 tokens |
| Type scale | Garamond names/labels (small caps), Atkinson body; 14 → 52 px steps | 06 tokens |
| Spacing and shapes | 18 gutter, 12 section, 8 inner; double section rule, dotted row rule; 4 px / 20 px corners | 06 tokens |
| Tap sizes | 44 minimum; 56 HP ±; 48 other ± | 06 tokens |
| Icon | One family, the same icon for the same thing (placeholders now) | 2026-10-23 |
| Primary button | Accent; at most one per screen | 06 |
| Secondary button | Outlined, with more presence than a word in a box | M4 gate 11 |
| Button row | Replaces a dropdown whose choices fit one row; none = "—" | M4 gate 7 |
| Text field, stepper, switch, chip | Standard controls | 06 |
| ⓘ | Opens the explanation; nothing explanatory on screen | M4 gate 6 |
| Source line | "From your setting: <short name> · <page>" | 06, M4 |
| Archivist ink | Handwritten script, ink-blue | 06 |

## Molecules

| Part | Job | Used by | Source |
|---|---|---|---|
| Tap line | Any tappable line: flash ≥150 ms, then opens its detail sheet | everywhere | 06 |
| Stat | Value with optional caption; "filled by your setting" and "setting N" edited note | sheet, overview, cards | 05 sheet, CS-2 |
| Status symbol | Symbol with a filling or draining ring, stack badge, hidden-timer variant, screen-reader label | cards, Player, marching order, combat, overview | S17-10.1 |
| Light symbol | The status symbol for a lit light (drains; warning shape at warnAt) | marching order, overview | M5-6, M5-8 |
| Chance | "2-in-6", "5+" or "35%" in the pack's style; popup gives both forms | skills, prompts, activities | CS-5, CS-5a |
| Modifier line | "+1 · Hunter (class)"; "+ Modifier" for the GM | prompts | S17-2.1 |
| Roll prompt | Shows the chance with modifiers; the GM enters a die result or taps the outcome; never rolls | checks, activities, recharge, starting money | 05, S17-2 |
| Use dots | Limited uses with Use / Undo | abilities, spells | 05 |
| Load bar | Bar with tier marks and label | Pack, overview | 05 |
| Time line | Date, season, weather, step | Explore, Scene | S17-9, 11 |
| Budget line | "Miles 18 / 24 · Weather −2" | Explore (day modes) | S17-4, weather tags |
| Recipient picker | Everyone, or chosen characters | Send, Reveal, handouts | M5-10 |
| Tick-confirm | "Heal 1 to: ✓ ✓ ✓" with one confirm | rest, camp, End expedition | S17-7, M5-7 |
| Count label | "Players · N" (the only allowed count) | GM tabs | 2026-10-23 |
| Log line | One log entry, with annotations and Undo | log, Scene | 05 |

## Organisms

| Part | Job | Used by | Source |
|---|---|---|---|
| Top row | Sticky back link, Log, ⋯ | every screen | 2026-10-23 |
| Tab bar | GM: Scene · Players · Rules; players: Player · Scene · Pack | every screen | 06 |
| Detail sheet | Rules or detail popup: bottom sheet on phone, centred card on tablet; opens at the first field; ends with the source line | everywhere | 06, M4 gate 8 |
| Log sheet | Full screen on every device, follows the finger, swipe down to close | top row | M4 gate 2 |
| Character overview | One popup for any character, limited to what the viewer may see | marching order, cards, combat, party list | M5-6 |
| Reminder card | Due items: 4 lines then "N more", decision lines keep buttons, All done | Explore, Downtime | M5-5 |
| Hour track | One row of turn pips with upcoming-event symbols | turn modes | X-1 |
| Procedure strip | One row of step symbols, current step named, never wraps | day modes | S17-2 |
| Procedure reference | The full procedure list, one tap away; players see the player-facing one | Explore | S17-2, 11 |
| Act menu | Usable activities only; "Act…" in turn modes; "Other…" last | Explore, players' Scene | X-2, S17-8 |
| Marching order | Rows of 1–3 characters; hold to drag, tap for overview; presets | Explore | M5-6 |
| Watches | Ordered list, hold to drag | Camp | S17-7 |
| Map panel | Picture panel on iPad landscape, Map chip elsewhere; collapses when empty | Explore | S17-12 |
| Send sheet | Text, check result or picture, recipients, keep or burn | GM Scene, Hit prompts | M5-10 |
| Urgent strip | One-line urgent items at the top | Player | 05 |
| Waiting list | Items and characters waiting for the GM | GM Players | 06 |
| Identity block | Name, title, race and class, level, alignment, trait fields | full sheet | CS-1 |
| Abilities grid | 3×2 scores with captions (device switch) | full sheet | CS-2 |
| Saves block | Saves plus set-apart modifier box | full sheet | CS-3 |
| Combat block | HP, AC, one attack figure, sub-line; to-hit row and AC breakdown behind taps | full sheet, overview | CS-8, CS-9 |
| Skills block | Everyone's skills, then class skills | full sheet | CS-5 |
| Languages block | Languages, Literate, "N more to choose" | full sheet | CS-9 |
| Pack groups | Equipped / containers / Tiny / Other; A–Z; Put it actions; summary | Pack, Whose pack | 05, CS-6 |
| Item sheet | Item details and actions; returns to the top of Pack after an action | Pack | M4 gate 9 |
| Add item sheet | Search, categories collapsed, "Add to …" | Pack | 05 |
| Spell line and slot header | One line per spell; "Level 1 · 2 per day · 1 left" | spell book, prayers | SP |
| Optional rules list | Collapsible categories, choose-one rows, presets with preview | Rules, campaign setup | X-4 |
| Reveal popup | Hidden facts in plain words, Tell them everything | item sheet (GM) | 05 |
| Vote banner | Broadcast vote, two-tap ballot | every screen | 05 |

## Templates

| Template | Rules | Source |
|---|---|---|
| List and detail | Tablet landscape: left column at least a third, names end in "…", right side never empty, details as a centred card | M4 gate 36 |
| Single column | Phone and tablet portrait: one column, bottom tabs, bottom sheets | 06 |
| Full sheet | One scrolling sheet in the fixed section order | 05 |
| Explore | Time area (strip or hour track), reminder card, panels, map panel that collapses when empty | S17, X-1 |
| Fight | Three columns on tablet (M6) | 06 |
| Form | Opens at the first field; on phone, buttons on top | M4 gate 8, 18 |

## Pages

Sign-in · Your campaigns · Player · Full sheet · Pack · Scene (players and GM) · Players (GM) · Rules (GM) · Explore and Downtime (M5) · Fight (M6) · Character creation · Charter, Vote, Treasury (companies). Each page lists its template and organisms in 06.

## States, variants and accessibility (ruled)

Every part documents, in its 06 row: **states** (default, pressed, empty, hidden from this viewer, loading, error, nothing to show → collapses), **named variants** (never copies), **accessibility** (screen-reader label, shape as well as colour, tap size ≥44), the **source ruling**, and a **code column** Claude Code keeps current in the same pull request as any change.

Default state sets by kind:
- Buttons: default, pressed (drops 1 px, shadow off, press flash), busy. Never disabled: a blocked action stays tappable and explains why in a pop-up.
- Lines and rows: default, pressed (flash ≥150 ms), selected, not allowed (▲ plus reason on tap; never greyed), chosen (✓ in a fixed end-edge slot plus heavier border), viewed (heavier border only, list and detail), hidden from this viewer (not rendered).
- Panels: content, empty (collapses, space reclaimed between actions only), loading.
- Pop-ups: toast (information, 8 s with Undo where something left your view), dialog (a choice).

## Gallery and screenshot tests (ruled)

- **Component gallery:** a hidden developer page showing every part in every state, light and dark, at Standard / Large / Larger text, at phone and tablet widths, with invented sample data. Built **first**, right after the M4b gate fixes, before more M5 screens.
- **Screenshot tests:** an automated check photographs the gallery on every change and compares it with approved pictures; Francis approves intended changes.
- **One audit:** when the code column is first filled, list parts built twice in M1–M4b and merge them during M5.

## Added by the M4b gate rulings (2026-10-25)

| Part | Level | Job | Source |
|---|---|---|---|
| Button, primary / secondary / quiet | Atom | Soft shadow (B), 1.5 px outline kept; pressed drops 1 px and loses the shadow; quiet = underlined accent text in a 44 px area, rare actions; pop-ups carry the only deeper shadow | B16 |
| Dark accent token | Atom | Copper #C9875A with near-black text (replaces salmon #D4836B); check against the dark warning colour in the gallery | B16 follow-up |
| Toast | Molecule | One at a time above the tab bar; 8 s with a draining bar and Undo for anything that leaves your view (drop, give, empty, last of a stack, light burnt out); same Undo as the log | A11, B23 |
| Dialog | Molecule | Messages needing a choice; never a box in the page | A11 |
| How-many prompt | Molecule | Stepper starting at the whole stack, plus "All N"; shared by Give, Drop, Move; skipped for single items | B24 |
| Destination list | Molecule | Vertical list grouped Equipped / Containers / Party (and people for Give); room left per row; blocked rows show ▲ and explain on tap; main button names the result | B19, B24 |
| Choice card | Molecule | Large selectable card ("Which way?") | B17 |
| Option row | Molecule | List row with name, one-line summary, marks (prime requisite), ▲ when not allowed | B17 |
| Guided-flow instruction | Atom | One line, ≤ about 12 words, Ogham's voice, at the top of each guided step (named exception to principle 6) | A5 ruling |
| Pinned note panel | Organism | Working panel (space reserved) for a GM's sent-back note | B18 |
| Detail panel | Organism | Full detail of a highlighted option with "Choose" (right pane on tablet, sheet on phone) | B17 |
| Kit card | Organism | Kit name, contents folded, cost and gold left, Take this kit / Buy your own, with the In-pack list below | B17 |
| Review screen | Organism | One screen for first submission, sent-back characters and the GM review card; sections jump to their steps; flagged sections marked | B18, A6 |
| Rules for this campaign | Organism | App settings and pack options in fixed topic groups, source tag per row, "N changed from default", presets | B15 |
| Derived status | Variant of Status symbol | No timer, no Remove; appears and ends with its cause (e.g. "Can't cast", crossed-out wand) | B25 |
| Full sheet layout | Template | Combat first, then Abilities; tablet two balanced columns, full-width blocks below; phone one column of compact grids | B20 |
