# Plan: the light's ring is the tap (page 35)

Written by the designer on 2026-11-22 (row `plan-light-tap`). Its ruling: [`../design/rulings/light-tap-2026-11-22.md`](../design/rulings/light-tap-2026-11-22.md) (lt-1 to lt-9). Its page: `docs/design/mockups/december/35-the-light-ring-is-the-tap.html`, frames 35A to 35F, pictures `docs/design/mockups/december/png/35-*.png`, **every frame approved by Francis from pictures, 2026-11-22** ("Approved"). The frame is the home of every word drawn on it; the rows name the frame, not the words. Page 34 was not approved and is not followed.

Paths and lines are `main`'s at `12001d5`. Examples are invented (Brannoch, the Storm lantern, the Hooded lantern of the drowned bell). Each row follows `REVIEW.md`, the self-review and hard rules 1 to 9. No migration, no new command: the four light commands (`light.light`, `light.douse`, `light.keepLit`, `light.refill`) and their toasts stay as they are.

## The rows

| # | What it builds | Rulings | Mockup (approved 2026-11-22) |
|---|---|---|---|
| LT1 | **The ring is the tap, lit.** The lit light's row loses its toggle (`Switch bare label="<light>: lit"`). Its Status ring stands over the verb "Put out", the ring and the word one button with no edge, 72 by 76 px, the verb in the stacked button's word style, read aloud "Put out <light>"; the rows' press flash (`--tint`). A tap runs today's `douse` at once, no pop-up, with today's toast and Undo ("Put out Storm lantern"). Running low keeps the warning sign and colour in the line. The name still opens the item's sheet. The head's status rings are untouched: they open details, and only this ring acts (the verb tells them apart) | lt-1, lt-2, lt-3, lt-7, lt-8 | **35A** (right), **35B** (middle, right), **35D**, **35F** (left) |
| LT2 | **Keep lit's own row.** Under the lit light: "Keep lit" and its ⓘ at the left, the bare switch (unchanged) at the row's right edge, and for a holder with fuel **Refill** (the stacked button with the jug, ic-3) 8 px to the toggle's left. Shown only while the light burns, as today. Long names and Larger text: the toggle stays at the right edge, nothing wraps under it at 375 px. The character overview's Keep lit is left exactly as it is | lt-6, lt-9 | **35A**, **35B**, **35C**, **35D** |
| LT3 | **Not lit and burnt out, in At hand; the Light section goes.** No "Light" heading and no separate Light button above At hand. A light not burning is drawn in At hand where the lit light sits (`LightInAtHand`'s place): **one light** to light, the ring empty (the track alone, no arc, the flame in `--muted`) over "Light", a tap lights it at once with today's toast and Undo ("Lit Torch"); **several**, the row "No light lit" with what there is to light, the ring over "Light…" (read aloud "Light: choose which"), which opens today's "Which light?" pick unchanged (its "Refill and light" rows too). **Burnt out**: the ring struck through, in `--muted`, no verb and not a button (an image named "<light>, burnt out"); the line in today's words; **Refill** and **Light another** as stacked buttons at the right in one `StackedGroup`, each only when it can act; with nothing to light, the words alone and no button. With nothing else at hand the light alone makes At hand, as it does lit. With one light, that light's own item row is left out and its name opens its sheet, as the lit light's does today | lt-4, lt-5 | **35B** (right), **35E1**, **35E2** (1 to 4), **35F** (right) |

All three change `src/app/LightSection.tsx` and its tests: **one batch**, branch `light-tap` from `main`, into `main`. Title: "LT1 + LT2 + LT3: the light's ring is the tap (page 35)".

## Files

| File | What changes |
|---|---|
| `src/ui/StatusRing.tsx`, `StatusRing.css` | A named variant **ring as a tap** (lt-2): the 52 px ring over a verb, one `<button>`, 72 by 76, no edge, press flash; a new export (for example `StatusRingTap`) or a `layout`, the builder's call, never a copy of `StatusRingMark`. `StatusRingMark` gains the two still looks: **not lit** (no arc, the symbol in `--muted`) and **burnt out** (the flame struck through, `--muted`; the stroke as page 35 draws it, from `scene/scene.js`'s `flameout`). The struck flame is drawn inside the mark, **not** added to `STATUS_SYMBOLS` (the pack checker reads that list, `src/modules/expedition/statusLook.ts`) |
| `src/app/LightSection.tsx` | `LitLight` (`:292-334`): the ring's `role="img"` span and the row's `Switch` (`:326`) replaced by the ring tap; its Keep lit row rebuilt (LT2). `KeepLit` (`:257-274`): an optional slot before its switch for Refill and a row variant that puts the switch at the right edge; with neither, it draws exactly as today (the overview, lt-9). `LightInAtHand` (`:340-347`) draws lit, not lit and burnt out; `litLineOf` (`:280-285`) becomes the line the block stands for (the lit light's, the one light's, or the burnt-out holder's; null for several or a line no longer in the pack). `LightSection` (`:354-462`) goes, but for its error state (⚑ 6); the pick (`:426-458`) and `optionWords` move into the block unchanged |
| `src/app/LightSection.css` | `.light-block__keep` as LT2's row; the ring tap's place in `.light-block__row`; the stacked buttons' row for burnt out; `.light-block__actions` and `.light-block__meta` removed if nothing uses them |
| `src/app/player/PlayerAtHand.tsx` | The block is given whenever there is a light, lit or not (`:44`, `:54`); `beforeAtHand={<LightSection … />}` (`:60`) removed (or the error alone, ⚑ 6). Its header comment |
| `src/app/PackScreen.tsx` | `litLight` (`:83`, `:95`, `:316-327`, `:389`) carries the not-lit and burnt-out block too (renaming it, say `lightBlock`, is the builder's call); `atHandShown` counts it; `beforeAtHand` (`:105`, `:377`) kept only if ⚑ 6 keeps the error there |
| `src/modules/expedition/lightPlay.ts` | A pure helper for what the block shows (lit, one to light, several, burnt out with which actions, nothing to light), built on `lightState`, `lightable`, `refillable`, `othersThan`, `burnoutWords`, so the screen holds no rules |
| `src/gallery/PlayersStandardSpecimens.tsx` | `LIGHT_SPECIMENS` drawn as At hand's block (lit, low, endless), plus one not lit, one several, one burnt out |
| Not changed | `src/app/CharacterOverview.tsx` (lt-9: its `KeepLit` as today); `src/app/CarrierItems.tsx` `lightFor` (`:236-243`: the Pack tab's rows keep Light and Put out); the toasts' words (`:157`, `:220`); `Darkness` and the notices (⚑ 1); the database |

## Tests

Each test's purpose is written first as a plain sentence.

| Kind | File | What it proves |
|---|---|---|
| Vitest | `src/modules/expedition/lightPlay.test.ts` | The helper: lit gives "Put out"; one lightable light gives "Light" and its line; two or more give "Light…" and no line; a holder put out keeps its fuel in its line ("Not lit. 4 turns left. 3 refills left", 35B); burnt out with fuel and others gives Refill and Light another, with fuel only Refill, with others only Light another, with nothing no action; a torch put out keeps its time (05, A2; ⚑ 2) |
| Vitest | `src/ui/statusRing.test.tsx` | The ring tap is one button named "Put out Torch", the verb under the ring, at least 72 by 76; not lit draws no arc and the symbol muted; burnt out is an image, not a button, with the struck flame |
| Vitest | `src/app/lightSection.test.tsx` (rewritten for the block) | A tap on the lit ring puts the light out at once, no dialog, toast "Put out Storm lantern" with Undo; Undo brings the lit row back in the same place. No switch named "<light>: lit" anywhere. One light: "Light Torch" lights it at once, toast "Lit Torch", Undo. Several: "Light: choose which" opens "Which light?" with today's rows, "Refill and light" included. Burnt out: no button on the ring; Refill uses one flask; Light another lights the next; none left, the words and no button. Keep lit's row: name, ⓘ, Refill, switch, in that order; shown only while lit. Every test kept from today's file that still holds (the arc, refills, the burnout toast, fuel kept on a swap) |
| Vitest | `src/app/player/PlayerAtHand.test.tsx` | No "Light" heading in any state; the not-lit light sits at the lit light's index among At hand's rows; it makes At hand by itself; the one light's own item row is not drawn twice and its name opens its sheet; "leaves At hand when put out" (`:120`) becomes "stays in its place, not lit" |
| Vitest | `src/gallery/playersStandardSpecimens.test.tsx` | `:45-61` re-pointed: the ring tap at the left, no toggle on the light's row, Keep lit's row under it |
| Vitest | the overview's test (or a new one beside `CharacterOverview.tsx`) | Keep lit there reads and switches as today (lt-9) |
| Layout | new `tests/layout/light-tap.spec.ts` | At 375 and 1180, light and dark: the ring target 72 by 76 and at least 8 px from the name's target; Keep lit's toggle flush with the column's right edge, Refill 8 px to its left; burnt out's two stacked buttons one width; no sideways scroll; a long name and 999 turns and refills wrap beside the ring (a messy light head, new or `p1=messy` extended); Larger text, "Put out" under the ring; the pick from the foot on a phone and centred on a tablet. **Measures** At hand's left column at 1180 and writes it in the pull request (the ruling's third note: drawn at about 440) |
| Layout | fixtures, `src/testing/layoutP1Character.ts` | New heads for not lit (one light), several lights, a holder burnt out, a torch burnt out with none left, and a long-named light with 999 turns and refills |
| Layout | `player-c9.spec.ts`, `journeys.spec.ts:150`, `ruleHeading.spec.ts:64`, `player-p1-fixes.spec.ts:51,67`, `gallery.spec.ts:100-112` | Re-pointed: no lit toggle; the Keep lit row. The gallery's new baselines (the light's rows) are announced in the pull request |

## The spec lines the pull request updates

| Doc | Lines |
|---|---|
| 05 | B10 (`docs/05-features.md:233`): its tg-1 note gains "lit or out replaced by lt-1 (2026-11-22): the light's ring is the tap", and Keep lit sits "under the light in At hand". Darkness (`:263`): "Keep lit, a per-light switch in both the Light section and the character overview" becomes "under the light in At hand and in the character overview" |
| 06 | Light section row (`docs/06-screens-and-design.md:668`): rewritten to lt-1 to lt-6 (it keeps its name; it is no longer a section of its own), and its Code column. Switch row (`:546`): the bare switch's "(a light's lit or out; Keep lit…)" loses the light's lit or out, noting lt-1 supersedes tg-1 there. Status ring row (`:608`): the new variant **ring as a tap** and the not-lit and burnt-out marks, in its Code column; "the Light section's lit light" becomes At hand's light. Weapon in hand row (`:734`): "`beforeAtHand` holds the Light section under it" as built. The overview line (`:135`): "as well as in the Light section" becomes "under the light in At hand". Key journey 5 (`:226`): Light is the ring's, taps unchanged (1 to 2). The Toast row is unchanged (lt-8) |
| ruling | `light-tap-2026-11-22.md`: its header goes `absorbed` once these lines land (`docs/CLAUDE.md`) |

The `09` line is already written (2026-11-22). A departure Francis rules gets its own.

## Estimate

**4 to 6 builder turns**, one batch: about 1 for the ring variant and its tests, 2 to 3 for the block and its states with the tests rewritten, 1 to 2 for the layout checks, fixtures and the gallery's baselines.

## ⚑ for this plan

Collected, not decided. Each is **built as today until ruled**, unless it says otherwise.

1. **The "No light" prompt above hit points** (page 14, P5; the Notices box) keeps its own "Light a torch (N left)" button. With a not-lit light now in At hand, the screen can show two ways to light. Built as today: both show.
2. **A torch put out keeps its fuel.** 05 (`:264`, A2) already says a consumable light keeps its time when put out, and loses it when a different one is lit. Built as today; the line reads like the holder's (35B) less the refills. Confirm.
3. **Put out with other lights in the pack.** 35B draws a pack with one light (it shows itself, "Light"). With other lights, lt-4 read word for word gives "No light lit" and "Light…", as today's section does. Built so.
4. **Another light's own row in At hand** (a pinned or held lantern while "No light lit" shows): it keeps its own Light button, as today. Not drawn.
5. **Not lit, and the only light needs fuel first.** Today: "Light" with ", Refill and light" in its words; with no fuel, "Nothing to light: … needs fuel …". Not drawn. Built as: the ring's "Light" refills and lights it, today's words in the line; with no fuel, the still ring and the words, no button.
6. **The error state** ("Couldn't load the light", Try again) is not drawn and lives in the Light section. Built as today, above At hand with its heading, the one place that heading is left. The alternative: the same words and Try again in the light's place in At hand.
7. **Words not drawn:** a single torch not lit (35E1 draws "Torch ×4, Not lit. 6 turns each"), a light that never runs out, not lit. Built on 35E1's pattern ("Not lit. 6 turns"; "Not lit. Burns on").

Every other visible piece is on page 35, or is today's and unchanged (the pick, the toasts, the burnout toast, the overview).

## Honest notes

- **Not run:** the app. Read from `main`'s source and page 35's pictures.
- **Not drawn, built the same way:** a tablet held upright and the Large step (the same rows); loading (nothing, as today); offline (the commands' own behaviour, as today).
- **The Pack tab** keeps its rows' Light and Put out buttons (05, At hand: "a light's Light or Put out"); page 35 is the Player screen's light only.
- **Costs build time:** the burnt-out states and the pick move out of a section that was tested as one; most of `lightSection.test.tsx` is rewritten, not added to.
- **Line numbers** are `main`'s at `12001d5`; they will drift.
