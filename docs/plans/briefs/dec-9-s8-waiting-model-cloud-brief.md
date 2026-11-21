# Cloud brief: S8, the model of "Waiting for you" (logic only)

**Blocked means stop and report; never reach the end another way.** If a guard, a hook or a permission check blocks you, stop and write what happened in the pull request. Do not try another tool, branch or command to get the same result.
Test files are changed only with the Edit tool. If the hook refuses, stop and report.
If you're unsure of anything, stop and write the question in the pull request. Don't guess.

Drafted by the Builder, read and corrected by the lead (2026-11-14).

## Objective
Build the **model** behind "Waiting for you" on the GM's Scene: one pure function, with tests, that turns everything waiting for the GM into one ordered list with its count. This is row S8 of the whole-Scene plan, logic half only. The panel's drawing and its wiring into the Scene are a later row, built by someone else on top of yours.

## Output
- **Branch:** `scene-s8-model`, from `dec-7-5b-gm-place-page` (the stack's base, #785).
- **One pull request** against `dec-7-5b-gm-place-page`, never against `main`.
- **Logic and tests only.** No screen, no CSS, no gallery and no layout specs. Do not edit `src/app/SceneTime.tsx`, `src/app/WaitingForYou.tsx` or any `.tsx` screen file.
- **New files:** a module such as `src/modules/expedition/waitingModel.ts` and its test. Name them as you see fit and say why.
- **Status file:** `docs/status/<date>-scene-s8-model.md`, with a Departures list for the Builder to move into the plan.

## Read first
1. `docs/plans/dec-9-the-whole-scene.md` (from `main`): row S8, and "How it is built".
2. `docs/design/rulings/dec-scene-whole-2026-11-14.md`: **st-1** and **wy-1**.
3. Page 16 on branch `design-december-mockups` at commit `662d45fa`: `docs/design/mockups/december/16-the-scenes-top-in-every-state.html`, frames **T2** (everything due at once), **T6b** (more homes) and **T8b** (the phone, everything due). Read the frame notes in the HTML.
4. Today's sources, on the base branch:
   - `src/app/WaitingForYou.tsx` and `src/app/sceneWaiting.tsx` (including `accentOwner`);
   - `src/app/ReminderCard.tsx` (the card and `HitPanel`);
   - `src/app/RestPrompt.tsx` (`RestPanel`);
   - the "Move on" proposals (`src/modules/expedition/moveOnWays.ts` and its callers);
   - the end-of-expedition questions (`EndSummary` in `src/app/SceneTime.tsx`). Read this one only; don't edit it.

## What the model must do
**The sources.** Everything that needs the GM:
- an encounter waiting;
- a rest due;
- the weather to roll;
- a reminder due;
- a proposed way (Move on);
- the questions after an expedition ends.

Today they come from four places:
1. the strip's portalled cards;
2. the inventory and requests;
3. the device-local reminder card;
4. Move on's proposals.

The model takes each as an input. It reads nothing itself; a loader can come later.

**The order.** Use this order:
1. the questions after an expedition ends;
2. an encounter waiting;
3. a rest due;
4. the weather to roll;
5. a reminder due;
6. a proposed way.

This follows T2's drawing (the encounter's card first, then the rest, the weather and the reminder as rows) and puts the end of an expedition, which blocks everything else, above it. **Before building, check this order against T2 and T8b.** If the frames show a different order, follow the frames, and write the difference in the pull request as a question.

**Its shape**
- **The open item is "a whole card"**: its title, its words and its actions. The first item is the open one by default. When the GM opens another row, that item becomes the card and the others are rows (wy-1: "a row opened takes its number"). Exactly one item is open while anything waits.
- **The accent goes with the open item:** the first action of the open item is the page's accent (mc-27, as `accentOwner` decides today). Keep that decision in the model, not in the screen.
- **The rest are one-line rows**: the mark, the title and its one button.
- **Past four, "N more":** show four items, then a row "N more" that holds the rest.
- Check this shape against T2's notes. If the frame says the first item stays a card when another row is opened, follow the frame and write the difference as a question.
- **What opening an item held inside "N more" does** is not ruled. Do not guess: build the model so the question is isolated in one place, and ask it in the pull request.

**The count (wy-1), exactly**
- The count names **which one is open of how many**: "1 of 4".
- A row opened takes its number: open the third and the count reads "3 of 4".
- One answered: the next opens and the total drops. Answer item 1 of 4 and the count reads "1 of 3", with the next item open.
- **With one waiting there is no count.**
- **Past four, the total counts them all** ("1 of 6", even though four are drawn and "2 more" is a row).

**Empty.** With nothing waiting, the model says so, and the panel will read **"Nothing waits."**

**What doesn't belong.** An effect that simply ends is a toast and a log line, not an item (st-1). Keep it out of the model. Only where the pack says something must then be decided does it become an item.

## Tests (each written first as a plain sentence)
At least:
- the order above;
- the open item is the whole card and owns the accent; the first is open by default;
- the count's four rules (1 of 4; an opened row takes its number; answering drops the total and opens the next; no count with one);
- past four: "N more", and the total counts all;
- "Nothing waits." when empty;
- an effect that simply ends is not an item.

Use invented fixtures only: no game-system names, rules text or numbers from any book.

## Boundaries
- No migration, no database change, no new read. If the model can't be built without one, stop and say so.
- No change to who may read or write anything.
- Don't build the panel, don't move today's boxes and don't delete anything: that's the later wiring row and S18.
