---
status: superseded
milestone: m4b
absorbed-into: —
supersedes: —
---

# UI/UX audit against the "uiux" skill (2026-10-25)

Scope: every UI design and mockup made in this conversation (S17 Explore, M5 rulings, sheet rulings CS-1..9, component inventory, M4b gate rulings B15–B25, words and voice guide, the ten journey storyboards) plus the Folio tokens and copy rules in 06. Nothing has been rewritten; this is the audit and the fix list.

Measured contrast (WCAG 2.2):
- Muted text: 6.8:1 light, 8.3:1 dark. **Pass.**
- Warning: 7.2:1 light, 10.5:1 dark. **Pass.**
- Accent with its text: 10.4:1. **Pass.**
- Rules colour as a control border: **1.5:1 light, 1.4:1 dark. Fails** the 3:1 minimum for component boundaries.
- Copper vs dark warning: 1.6:1, too close to tell apart by colour.

## Top issues, ranked by user impact

| # | Issue | Where | Concrete fix |
|---|---|---|---|
| 1 | **Tappable rows and cards use the "Rules" colour (#D6D3CC / #3A342B) as their only border: 1.4–1.5:1**, below WCAG's 3:1 for component boundaries. In a dim room, players won't see what's tappable. | Option rows, destination list, choice cards, review sections, Give list (B17–B19, B24) | New token **Control border** (light #8A8378 ≈ 3.3:1, dark #6B6252 ≈ 3.1:1) for anything tappable. "Rules" stays for passive dividers only. |
| 2 | **Off-scale spacing and type in 06** (18 px gutter; 17, 19, 28, 40, 52 px type) will be baked into the component gallery, which Claude Code is about to build. | 06 tokens; every mock | Lock the scales below **before** the gallery prompt goes out. Map old sizes onto the scale (conventions §1–2). |
| 3 | **Primary button position on phone:** our M4 gate rule 18 puts form buttons **on top**. The skill says **thumb-reachable** (bottom). They conflict. | Add item, Give, review, creation | ⚑ Conflict to rule. Proposal: a **sticky bottom action bar** on phone for the one primary action; top placement stays on tablet. Keeps M4 gate 18's intent (always visible, never below the fold) with a thumb-friendly spot. |
| 4 | **Secondary text set at 13 px** in most mockups. That's under our own 14 px minimum, and the skill wants body ≥16 on mobile. | All mocks (notes, captions, sub-lines) | 14 px floor for meta and captions, 16 px for anything read as a sentence. Gallery test fails any text under 14. |
| 5 | **Confirmation dialogs where Undo exists.** End expedition (undoable per M5-7) asks for a confirm, and the B25 "Wear it / Don't wear it" dialog interrupts a reversible action. The skill says prefer undo. | M5-7, B25 | End expedition: no confirm; show the summary with an Undo toast. B25 equip: equip happens, the derived status appears, and a toast says "Chainmail stops your arcane casting · Undo". No dialog. Keep dialogs for irreversible or high-cost actions only (death, deleting homebrew). |
| 6 | **Touch targets under 44 px** in some mocks: 36 px Drop buttons, 38 px Cast. | B23 and B25 mocks | Make 44 px an inventory rule for every control, and a gallery test. |
| 7 | **HP entry has no numeric keypad**, so journey 4 only meets its budget if the amount is typed. | Journey 4, HP sheet | HP sheet opens a numeric keypad with "− / +" toggles and quick chips (−1, −2, −3, −5). Inputs for numbers always use the numeric keyboard. |
| 8 | **Copper accent and dark warning are too close** (1.6:1), and both appear together on the B25 status. | Dark tokens | Move dark warning toward a clearer amber-yellow, or give warnings a shape cue (triangle badge) as well as colour. Decide in the gallery, as already noted. |
| 9 | **The creation mock shows a disabled "Choose"** (faded) for not-allowed classes, against our own "never disabled" rule. | B17 mock | "Choose" stays enabled; tapping it on a not-allowed class opens the reason pop-up. |
| 10 | **Borders on every stat tile** (abilities, saves, combat) add ink without information. The skill says separate with spacing or tint first. | B20 sheet mock | Static tiles use a tinted surface (Surface token), no border. Borders mark tappable things only (ties to issue 1). |
| 11 | **No semantic danger or info colours, and no shade ramps.** Destructive actions, errors and info have no defined colour. | Folio tokens | Add Danger (deep red) and Info (slate blue) with light and dark values; build 5–9 step ramps for neutral, accent, warning, danger. Never colour alone. |
| 12 | **Numbers that change don't use tabular figures:** HP, timers, counts and coins jitter as they update. | Sheet, Explore, Pack | Tabular lining numerals everywhere a number updates or aligns in a column. |
| 13 | **Missing default states:** loading (skeletons), offline, and reduced motion (the toast's draining bar, the ring fills). | Component inventory | Add skeleton loading and offline states to the inventory's default state sets. With reduced motion on, rings and bars step instead of animating. |
| 14 | **Reading width on tablet:** rules pop-ups and ⓘ text could run the full card width. | Detail sheet on iPad | Cap reading text at about 65 characters per line. |

## Already follows the skill (keep)

- One primary action per screen, with names that state the result ("Give 3 to Ilsa").
- Undo toasts for things that leave your view; Undo also in the log.
- Never colour alone: status symbols have shapes, "!" marks have text, flagged sections have markers.
- No disabled buttons; blocked actions explain why.
- Progressive disclosure: ⓘ, collapsed groups, "Coming at later levels", Act… menu.
- Prominence follows frequency (Fitts): Next turn always visible, Combat block first.
- Hick's law: activities shown only when usable; destination lists grouped; rules grouped and collapsed.
- Plain language and error pattern (words and voice guide).
- Dark mode by tokens.
- Labels de-emphasised and values emphasised on the sheet.
- Empty panels collapse; working panels never shove content.
- Realistic invented data in every mock.
- 44 px minimum in 06 (to enforce), and system text size respected (Standard / Large / Larger).
- Measurable journeys with tap and screen budgets, plus automated tests.
- Escape closes the log; drafts kept.

## In progress: change before continuing

1. **Gallery prompt (not yet sent):** add the locked conventions (issues 1, 2, 4, 6, 10, 11, 12, 13) so the gallery is built right the first time.
2. **Journey storyboards:** journey 4 assumes the keypad (issue 7); journey 10 drops its confirm (issue 5), going from 3 taps to 2.
3. **B25:** the equip dialog becomes a toast with Undo (issue 5).
4. **B17 mock:** Choose stays enabled (issue 9).
5. **M4 gate rule 18 versus the thumb zone:** needs your ruling (issue 3).

## Proposed conventions to lock in

1. **Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Page gutter **16** (was 18). Section padding 12, inner gap 8 (already on scale). Groups separated by 24.
2. **Type scale:** 14 (meta, minimum) · 16 (body) · 20 (labels, item names) · 24 (saves, step titles) · 30 (sheet titles) · 36 (character name) · 48 (HP, AC display). Old sizes map: 17→16, 19→20, 28→30, 40→48, 52→48.
3. **Fonts:** Garamond 600 for names, labels, small caps and display numbers (tabular lining figures); Atkinson 400/700 for body and buttons. Reading text capped at about 65 characters per line.
4. **Colour tokens:** neutral ramp (9 steps, Bone to Ink); accent ramp (light: dark red; dark: copper); semantic ramps for warning, danger (new), info (new); success used sparingly. Text: primary, secondary (muted), disabled-never. **Control border** token ≥3:1 for tappable things; **Rule** token for passive dividers. All contrast pairs tested in the gallery.
5. **Dark mode:** every token has a dark value; no hard-coded colours anywhere; copper accent; dark warning adjusted if the gallery shows it clashing.
6. **Component patterns:**
   - Tappable things have a ≥3:1 boundary or a filled surface; static tiles use tint, not borders.
   - One primary per screen, in a sticky bottom bar on phone (⚑ pending the issue 3 ruling).
   - Undo over confirm; dialogs only for irreversible or high-cost actions.
   - Numeric keypad for number inputs.
   - Never disabled.
   - 44 px targets with 8 px between.
   - Every view has the states empty, loading (skeleton), partial, overflow, error, offline and reduced-motion.
7. **Self-review:** every UI delivery runs the skill's checklist (Nielsen's 10 plus states, contrast, targets, 375 px width, messy data) before it's shown.
