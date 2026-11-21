Follow docs/plans/briefs/README.md (its fences and how to work) together with this brief; where this brief is more specific, it wins. NO screen: no component, no route, no CSS.

# Cloud brief: S19's LOGIC half, the card after an expedition ends (the whole Scene, dec-9; frames 16-T11 to 16-T11d at 3c5f5959, approved 2026-11-14, ap-11)

You are a cloud builder (a Virtual Builder). You cannot message anyone: your ONLY output is a pushed branch and a PR. If a guard, a hook or a permission check blocks you, stop and write what blocked you in the PR body. Never git stash, never force-push, never --no-verify. No line in docs/09 (dl-1).

## The branch
`scene-s19-end-card-logic`, which already exists on origin at the head of `dec-7-5b-gm-place-page` (the Scene's held stack). Bring it up to that branch first. PR against `dec-7-5b-gm-place-page` (NOT main).

## Read first
docs/plans/dec-9-the-whole-scene.md row S19 (on the stack, ~:39) and the rulings it names (ap-11, mm-8, ic-2, ft-1).
What exists (src/app/SceneTime.tsx on the stack; DO NOT EDIT IT): `endNow` (~:1446) runs `endExpedition` (src/modules/expedition/play.ts:509); `EndSummary` (~:2822-2930); `FullRestPanel` (~:2936); `SafePlaceQuestion`/`StayingAWhile` (src/app/EndSafety.tsx); `answerSafePlace` (play.ts:540); time taken = `expedition.summary.seconds` (play.ts:55, :115-123) worded by `timeWords` (src/core/timeWords.ts:6); `fullRest` (play.ts:517), `restRefills` (:824); the rest's line `fullRestWords` (src/modules/characters/nightRest.ts:83); the healing rule `healingText` (play.ts:836) with its source computed INLINE in SceneTime ("From your setting: <first non-homebrew pack's shortName>"); `loadWhoWent` (play.ts:377: WentCharacter with hpCurrent, hpMax); the bar helper `hpSegments` (src/modules/characters/play.ts:48).

## Build (logic and tests ONLY; a new module, e.g. src/modules/expedition/endCard.ts)
1. ONE pure function giving the end card's rows from data already loaded: for each character who went, the name, the hit-points line ("x of y"), the bar's fills (from `hpSegments`), a "hurt" flag; and an "everyone is at full hit points" flag.
2. ONE helper returning the healing rule WITH its source (move the source wording out of SceneTime's inline code into this helper, WITHOUT editing SceneTime: SceneTime keeps its own until the screen step; say so in the status file).
3. Which words are DATA and where they come from, listed in the status file: the rest's line (fullRestWords), the healing rule and its source, the time taken (timeWords). NO WORD from this module reaches a screen in this PR.
4. "Who was left out" of the rest is React state only today and NOT stored: compute it from inputs passed in; do NOT store it (storing it needs a migration and a ruling: write the question).
5. No migration, no new read, nothing under supabase/. The GM-only gate stays where it is.

## Tests (purposes first)
Rows for a party with some hurt and some full; the all-full flag; the bar fills match hpSegments; the healing rule with its source for a stack with and without a homebrew pack; a character with hit points unset reads "—" (never "0 of N"); nothing here imports a component.

## Pre-flight (tick in the status file)
(a) the plan's Departures under S19 (logic half) written in the plan; (e) no new words (or list them). The rest are n/a (no screen).

Status file `docs/status/2026-11-15-scene-s19-end-card-logic.md`. PR title: "S19's logic half: the end card's rows and the healing rule with its source". No label, no auto-merge.
