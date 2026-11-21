---
status: absorbed
milestone: m4b
absorbed-into: docs/06-screens-and-design.md (Design tokens; Component patterns; Offline and sync states), docs/05-features.md (offline)
supersedes: uiux-audit.md
---

# UI conventions: RULED (2026-10-25)

Adopted after the audit against the "uiux" skill (see `uiux-audit.md`). These lock the design system before the component gallery is built. Every UI delivery runs the skill's self-review checklist first.

## 1. Primary action on phone
- On phone, the one primary action sits in a **sticky bottom bar**, full width, on any screen that has one (forms, sheets, Give, Add, review). It rides above the keyboard, and the field being typed in always scrolls into view.
- Tablet keeps the primary action top right.
- Secondary actions never share the bar.
- **Replaces M4 gate rule 18's "buttons on top" for phone**, keeping its intent: always visible, never below the fold.

## 2. Spacing scale
Tokens space-1…space-8 = **4 · 8 · 12 · 16 · 24 · 32 · 48 · 64**. No other values in code (the gallery test flags raw pixels).

| Use | Step |
|---|---|
| Icon to label; badge to symbol | 4 |
| Inside a control or row; lines within a group | 8 |
| Section padding; between tappable rows | 12 |
| Page gutter (phone and tablet; was 18) | 16 |
| Between groups or sections | 24 |
| Between major regions | 32 |
| Screen top/bottom; empty-state room | 48 / 64 |

## 3. Type scale
Tokens text-14…text-48. Line height 1.5 for body, 1.2 for headings and display numbers. Tabular lining figures for any number that changes or aligns.

| Size | Font | Used for |
|---|---|---|
| 14 | Atkinson | Meta, captions, source lines (minimum) |
| 16 | Atkinson | Body, sheet text (was 17), buttons, rows |
| 20 | Garamond | Labels, item names, section headings (small caps) |
| 24 | Garamond | Saves, step titles, dialog titles |
| 30 | Garamond | Screen titles, the character's name (was 36) |
| 36 | Garamond | AC, attack figure (was 40) |
| 48 | Garamond | HP, the largest (was 52) |

Reading text (rules pop-ups, ⓘ) is capped at about 65 characters per line on tablet.

## 4. Colour tokens

| Token | Light | Dark |
|---|---|---|
| Page / Surface / Sheet | #FAFAF7 / #F2F1EC / #FFFFFF | #12100D / #1C1915 / #1E1A16 |
| Ink / Muted | #191714 / #5E574C | #F1EADC / #B5AA96 |
| Rule (passive dividers only) | #D6D3CC | #3A342B |
| **Control border** (anything tappable, ≥3:1) | **#8A8378** (3.6:1) | **#756B5A** (3.3:1) |
| Accent / text on accent | #6E2A1F / #FFFFFF | **Copper #C9875A** / #12100D |
| Warning (▲) | #7A4A00 | **#F2D46B** (was #E6BA66) |
| **Danger (✕)** | **#9B1C1C** | **#F08A7E** |
| **Info (ⓘ)** | **#2F5D7C** | **#8DB4D0** |
| Lit-light glow (own token, unchanged) | #C98A1E | #E6BA66 |

- Five-step ramps for accent, warning, danger and info; a seven-step neutral ramp.
- Every semantic colour carries a shape: ▲ warning, ✕ danger, ⓘ info. Never colour alone.
- No success colour; confirmations are toasts.
- Destructive actions are quiet danger-text buttons, never filled red.
- The gallery tests every contrast pair in both themes.

## 5. Dark mode
- Every token has a dark value; no hard-coded colours (gallery test).
- Depth comes from lighter surfaces (page → surface → sheet → pop-up); outlines carry tappable edges; shadows aren't relied on.
- Text is never pure white.
- Pictures are never inverted. In dark mode they have a thin control-border frame, and a per-device switch "Dim pictures in dark mode" (default on) slightly lowers their brightness until opened full screen.
- First run follows the device's light/dark setting; the person's choice then sticks per device.
- Accent fills stay small (one primary per screen).

## 6. Component patterns
1. **Number inputs open a number pad.** *(HP and damage changed 2026-10-26, M6-3: a −5 −1 [N] +1 +5 stepper from the last amount, tap the number to type; no fixed quick amounts.)* The HP sheet has quick chips (starting −1, −2, −3, −5, then adapting to the campaign's most-used amounts from the log); **a chip applies at once with an Undo toast**; typed amounts confirm with "Take N damage" / "Heal N".
2. **Undo over confirm.** Reversible actions happen at once with an Undo toast. Dialogs are only for irreversible or high-cost actions (a character's death, deleting homebrew, **End expedition**, which changes every screen and keeps its confirm). **B25's equip dialog becomes a toast** ("Chainmail stops arcane casting · Undo").
3. **Tappable things** have a control border or a filled surface; **static tiles** are tinted with no border.
4. **Never disabled;** blocked actions explain why in a pop-up (B17's mock "Choose" is enabled too).
5. **Targets** ≥44 px with 8 px between.
6. **Every view covers these states:** empty, loading (skeleton rows; still under reduced motion), partial, overflow (long names, 0 and 999), error, offline (see §7).
7. **Reduced motion:** rings, bars and skeletons step or hold still instead of animating.
8. **Marks (2026-10-25):** ▲ for not allowed, blocked and broken rules (no "!"); not-allowed rows are never greyed. A ✓ in a fixed end-edge slot marks the *chosen* row (with the heavier border); the row being viewed in list and detail has the heavier border only. Choice cards move on with one tap and have no selected state.

## 7. Offline and sync states (ruled 2026-10-25)
1. **Online:** nothing extra shows.
2. **Offline:** a tappable ▲ pill in the top row ("Offline · 2 waiting", 44 px tap area) opens a sheet listing what works offline, the waiting changes (each with Undo) and the last sync time. Your waiting values carry a dashed "waiting" tag. Other people's live values (HP, conditions, position) show their age only when older than 2 minutes ("seen 4 min ago"); your own values never do.
3. **Catching up:** an ⓘ "Catching up…" pill while queued changes send; it disappears when done.
4. **Rejected change:** a toast in plain words naming what and why ("Your Give to Ilsa didn't go through: the GM moved those rations first") with "See in log", plus a ✕ log entry that stays.
5. **Offline hides nothing:** actions that need a connection stay visible and explain why on tap ("Needs a connection: Send reaches players' screens").
6. **GM offline play:** ruled, see 7a.

### 7a. GM offline play (ruled 2026-10-25)
- The GM's own commands (clock, checks, reminders, lights, marching order) queue offline as **intents** with request ids and replay on reconnect with recalculation; each carries its clock time. Intents in M5, the queue in M9 (fallback: only Next turn, checks and reminders queue).
- Players see an ⓘ pill "GM offline · time paused" while the GM's device is offline; the log adds "GM was offline N min · N turns caught up".
- One GM device queues at a time; the other's pill reads "Read-only: your other device is running the session".
- Queued commands become undoable once synced. The offline cache clears on sign-out. ◈ "Sign out other devices" in M10 hardening.
