# Sweep audit: every live screen against the self-review (2026-11-18)

Read and report only, for the app-wide sweep after the December mockups (approved by Francis on 18 Nov 2026). Nothing was fixed and no rule is added here: each finding names the rule in `CLAUDE.md` or `docs/06-screens-and-design.md` it breaks. A finding may turn out to be covered by a ruling or mockup this audit didn't find; the sweep's designer has the last word.

## How it was run

- `main` at 4440fd46, `npm ci`, `npm run dev`, then `layout.html` with the fixtures the layout tests use (`?as=player|gm|new`, `skills`, `full`, `combat`, `magic=1|empty`, `coin=1|messy`, `tiny`, `placeRules`, `tables`, `calls=many|long`, `give=long`, `library`, `railSigil`, `mapParts=…`, `moveOn=…`), and each campaign the fixtures seed (Drowned Marches, Dry Ford, Wet Road, Lantern Hall, Long Fen Road, Reed Camp, Weary Causeway, Long Night Ferry, Reedmouth Delve, Old Fen Road).
- 71 views, each at 375 × 812 and 1024 × 768, light and dark (284 renders), in Playwright's Chromium. On each: sideways scroll, targets under 44 px, gaps under 8 px between separate targets (rows of one list and tiles of one set left out, t44-1), text under 14 px, disabled controls, buttons filled with the accent, banned words, and axe (WCAG 2.1 AA, serious and critical). Every screen's 375 picture and the main screens' 1024 pictures were looked at by eye for the heuristics and messy data. Offline was tried on four screens by taking the browser offline.
- Static: `src/ui/designSystem.test.ts` (raw spacing, type and colour in every stylesheet), `noDisabledButtons` and `noMiddleDot` pass; no inline style carries a raw pixel or colour.

## Clean across every view

- No sideways scroll at 375 px.
- No text under 14 px.
- No disabled button or field.
- Never more than one accent-filled button on a screen.
- No contrast failures (axe, both themes, both widths).
- Tokens only: no raw values found (the check leaves widths, heights, borders and media queries alone).

## Findings

Severity: **blocks play**, **annoying** or **polish**. Each line: screen, state (fixture, width), what's wrong, the rule it breaks, severity.

### Every campaign screen (frame and navigation)

| # | Screen | State | What's wrong | Rule | Severity |
|---|---|---|---|---|---|
| sa-1 | All, player | Offline (`as=player`, Player, Pack, Scene; and `as=gm` Scene), 375 | Taking the device offline changes nothing on screen: no "Offline, N waiting" pill, no "waiting" tag. The pill exists only in the gallery (`OfflinePill`); the roadmap puts the offline queue in M9. | Every state: offline (06 Offline and sync states) | annoying |
| sa-2 | All, player | Tablet landscape, folded rail, 1024 | The player's rail tabs (Player, Scene, Pack, Magic) are 40 px wide; the GM's are not. | 44 px targets | polish |
| sa-3 | All, GM and player | Tablet landscape, 1024 | The rail's tabs and sigil touch the divider handle's 44 px tap zone (0 px apart). | 8 px between targets | polish |
| sa-4 | Scene (player), Sign-in | Every fixture | No level-one heading: a screen reader user can't jump to the screen's title. | Self-review: accessibility (06 Accessibility, screen-reader labels) | polish |
| sa-5 | No character yet (new player) | `as=new`, Drowned Marches, 375 | Uses the older top row (back link, ✉, book, ⋯) with no tab bar or drawer, unlike every other campaign screen on a phone. | Nielsen 4, consistency (06 Navigation, the phone's navigation N1) | polish |
| sa-6 | Rules library, New campaign | `as=gm`, both widths | The back link reads "‹ Campaigns". | Words: one name per thing (06 Navigation: outside a campaign it reads "‹ Your campaigns") | polish |
| sa-7 | GM Scene | Every campaign, both widths | Quiet links end in › ("Set start time ›", "Tables ›"). | Words rule 11 (never a link ending in ›) | polish |

### Player screen

| # | Screen | State | What's wrong | Rule | Severity |
|---|---|---|---|---|---|
| sa-8 | Player | `as=player`, both widths | The section heading "Light" and the button "Light" sit together with the same word. | Nielsen 8, minimal design | polish |
| sa-9 | Player and Scene (player) | Weary Causeway, Lantern Hall | "No light, Nothing to light in your pack": two sentences joined by a comma with a capital N, under a "No light" chip that already says it. | Words: sentence case; Nielsen 8 | polish |

### Scene (player)

| # | Screen | State | What's wrong | Rule | Severity |
|---|---|---|---|---|---|
| sa-10 | Scene (player) | Drowned Marches, 375 | Ash's long status ("Bog-sickness of the Seven Drowned Lanterns of Old Reedmouth ×12") wraps a word or a syllable per line in a narrow column beside the rings; the tile runs about ten lines tall. | Messy data (long names), 375 width | annoying |
| sa-11 | Scene (player) | Every campaign | A marching-order tile with no status shows a lone "—". | Nielsen 8, minimal design | polish |
| sa-12 | Scene (player) | Weary Causeway, Reed Camp | A "Rest in 1" / "Rest day in 6" chip and a separate "Rest" button: two rest controls with different words. | Nielsen 4, consistency | annoying |
| sa-13 | Scene (player) | Long Fen Road, 375 | The activity buttons wrap to two lines at uneven widths ("Scout ahead, 3 points", "Hark for prowlers", "Force march"), the ⓘ floats beside them, and "Hark for prowlers" touches the marching-order tiles (0 px). | 375 width; 8 px between targets | annoying |
| sa-14 | Scene (player) | Dry Ford | The player reads "Travel points: waiting for the GM to start the day" while the GM's Recently says "You started day 1 for the party: 0 points". | Nielsen 1, visibility of system status | annoying |
| sa-15 | Scene (player) | Reed Camp | The camp is a column of explanations: "A day without food: the hungry tire, and tire more each day.", "Each watch: 2 hours, the night's length is the GM's call", "The GM rolls it in the night.", "Sleep comes with the next part of camp." | No explanations on screen (06 principles); visual, not walls of text (dt-26) | annoying |
| sa-16 | Scene, player and GM | Reed Camp, 375 | The watches − and + are 4 px from "Split evenly". | 8 px between targets | polish |
| sa-17 | Scene (player) | Reed Camp, 375 | "Force march" sits alone, off-centre, under the leagues. | Nielsen 8 | polish |

### Pack

| # | Screen | State | What's wrong | Rule | Severity |
|---|---|---|---|---|---|
| sa-18 | Pack | `tiny=1` (999 eel hooks), both widths | The foot's count adds quantities ("1033 items"; "32 items" without tiny things) while the section heads count lines ("Carried 5 items"). | Nielsen 4; messy data (999) | polish |
| sa-19 | Pack | Every fixture, both widths | "About In the Sack" ⓘ touches the first row under it (0 px). | 8 px between targets | polish |

### Full character sheet

| # | Screen | State | What's wrong | Rule | Severity |
|---|---|---|---|---|---|
| sa-20 | Full sheet | `full=1`, 375 | The identity line breaks into chips with stray commas ("Warden" "," "Lantern Warden" "3," "Bog folk"), the chips touching (0 px). | 375 width; 8 px between targets | annoying |
| sa-21 | Full sheet and Player | `full=1` | The same figure is "Armour" on the full sheet and "AC" on the Player tile; the sheet's title is "Full sheet" at 375 and "Full character sheet" at 1024. "Armour" is also UK spelling unless it is the pack's word. | Words rule 7 (one name per thing), rule 10 | polish |
| sa-22 | Full sheet and Player | `full=1` | One use is "0 of 1 left" in Abilities and "None of 1 left, back each day" in the Player's Traits. | Words rule 7 | polish |
| sa-23 | Full sheet | `full=1` | Empty fields show as "—" (Literacy, Affiliation). | 06 full sheet ruling: a field only when it applies | polish |
| sa-24 | Full sheet | `full=1` | Magic shows "Spell book: 4" and "Prepared: 2" tabs at 375 but only a "Spell book: 4" heading at 1024. | Nielsen 4 | polish |
| sa-25 | Full sheet | `full=1`, 375 | The sticky foot has a "Back" button as well as the top bar's ←. | Nielsen 8 | polish |

### Magic

| # | Screen | State | What's wrong | Rule | Severity |
|---|---|---|---|---|---|
| sa-26 | Magic | `magic=empty` | Empty: "Nothing ready", with no invitation and no way to Prepare beyond the row above. | Words pattern: empty screen, an invitation with the action | polish |
| sa-27 | Magic | Both themes | Prepare's icon is drawn in full colour, unlike the one-colour icon family. | 06 Navigation, icons: one family | polish |
| sa-28 | Magic | `magic=1` | Prepared counts show as dots after the name ("Glimmer ●●") with no words. | dt-26 (symbols always with words beside them) | polish |

### Messages and Log

| # | Screen | State | What's wrong | Rule | Severity |
|---|---|---|---|---|---|
| sa-29 | Recently and Log (GM) | `calls=many` | Two lines read "You changed something." after a call was sent and a rumour given. | Words pattern: log line, plain facts | annoying |
| sa-30 | Log | Both roles | "Verbose: every change, like each HP tick": an explanation in the label, and "Verbose" is jargon. | No explanations on screen; words rule 3 | polish |
| sa-31 | Messages (player) | Both widths | The message list's `<ol>` holds `<div>`s directly (axe, serious): screen readers misread the list. | Self-review: accessibility | polish |
| sa-32 | Messages (GM) | 1024 | Close touches "New message" (0 px). | 8 px between targets | polish |

### GM Scene

| # | Screen | State | What's wrong | Rule | Severity |
|---|---|---|---|---|---|
| sa-33 | GM Scene | Every campaign | Symbols with no words: the reminders as small icon circles after "+ Reminder" (the encounter check drawn as ✕ in a circle, which reads as "close"), the procedure strip's pips and the icons stacked under them, the travel status icons (cloud, "L", marsh). | Nielsen 6, recognition; dt-26 | annoying |
| sa-34 | GM Scene | Every campaign | The marching order's switch is labelled "Locked: only you move it" while it shows off. | Nielsen 1 and 2 | annoying |
| sa-35 | GM Scene | Long Fen Road, `calls=long`, 375 | A long character name drops its card onto the next line, leaving the number "2" alone on its own line. | Messy data (long names), 375 width | annoying |
| sa-36 | GM Scene | Dry Ford, Long Fen Road, Lantern Hall, 375 | The accent "Next day" / "Next turn" wraps onto two lines. | 375 width | polish |
| sa-37 | GM Scene | Dry Ford, Long Fen Road, Reed Camp, both widths | The time strip's title is 4 px from the weather symbol. | 8 px between targets | polish |
| sa-38 | GM Scene | Dry Ford | An info box in the page: "No speed known for anyone in the party: set today's travel points by hand." | Messages are pop-ups, never a box in the page (06 principles) | polish |
| sa-39 | GM Scene | Lantern Hall, `calls=many` | Explanations on screen: "From this device; hidden until you show it.", "One line players will see; show it when you say it.", "No encounter tables in this setting". | No explanations on screen | polish |
| sa-40 | GM Scene | Long Fen Road | Buttons in one row at different sizes ("Found the way" and "Still lost"; "Spend the day looking" and "Set by hand…" smaller than "Move…"). | Nielsen 4 | polish |

### GM Players, Rules, Reference

| # | Screen | State | What's wrong | Rule | Severity |
|---|---|---|---|---|---|
| sa-41 | GM Players | 375 | Wren's buttons are right-aligned with "Remove…" wrapping alone; other characters' buttons are left-aligned. | Nielsen 4 | polish |
| sa-42 | GM Players | Both widths | "Wren of the Lantern Wardens (active), Folk Marsh folk, Path Lantern Warden": labels and values run together. | Nielsen 8; messy data | polish |
| sa-43 | GM Players | `give=long` | For a player with no character, bold "No character yet" sits above the person's name. | Nielsen 4 | polish |
| sa-44 | GM Rules | Both widths | Explanations and developer words on screen: "When two have the same entry, the higher one wins.", "Press and hold a row to move it." (06: "hold to move" behind an ⓘ), "From your library, or import a JSON or Markdown file. Newer additions sit on top, under any homebrew.", "+ New homebrew entry", "1 rules set". | No explanations on screen; words rule 3 | polish |
| sa-45 | GM Reference | 1024 | "Abilities" shows as a label row with no value. | Nielsen 8 | polish |

### Rules library and new campaign

| # | Screen | State | What's wrong | Rule | Severity |
|---|---|---|---|---|---|
| sa-46 | Rules library | `library=1` | "Your own: 7 packs." and "1 rules set": developer words. | Words rule 3 | polish |
| sa-47 | Rules library | 375 | "Convert a book with an AI…" is cut off. | 375 width | polish |
| sa-48 | No character yet (new player) | `as=new`, Drowned Marches | "No one is in the ledger yet. Make your first character." while the party list below shows Ash and Wren. | Nielsen 1; words (empty screen) | annoying |

### Parts not yet on a screen

| # | Screen | State | What's wrong | Rule | Severity |
|---|---|---|---|---|---|
| sa-49 | Map pop-up (`mapParts`) | `failed&open=1` | The eye switch at the top is a symbol with no words. | dt-26 | polish |

## Counts

| Severity | Findings |
|---|---|
| Blocks play | 0 |
| Annoying | 12 |
| Polish | 37 |
| **Total** | **49** |

## Not covered

- **Loading:** the stand-in database answers at once, so no skeleton was seen. **Error:** only the map's failed picture (handled well). Both need the live app.
- **Text sizes** Large and Larger, **WebKit** (Chromium only here), and real devices.
- **Flows not opened:** character creation and review, the damage pad, Give, Add item, campaign set-up past step 1, the GM's campaign menu at 375 and the player's ⋯ at 1024 (the clicks missed).
- The `railSigil` fixture's pictures didn't load here (the network blocks `files.example`), so the sigils weren't seen.
