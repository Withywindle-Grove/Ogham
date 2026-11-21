# Brief for a cloud builder: creation skips "adjust scores" on the way forward (a fix, test first)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `fix-adjust-scores-skipped`. Pull request title: "Fix: creation no longer skips adjusting scores after the class is picked".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch (bring it up to `origin/main` first); carry nothing over.

**Seen by Francis on the live app today, in his own campaign. This goes ahead of everything else you have.**

## What he saw
In guided creation, with a campaign on the classic rules that also holds another setting's pack and a conversion pack on top: after picking a kindred and a class that come through the conversion, **Next goes straight to "Who they are" (name and alignment), skipping the step where scores are lowered and raised. Back from "Who they are" then lands on that adjust-scores step.** So the step exists for this character; the way forward jumps over it.

The steps' ruled order (docs/05, Character creation, guided): method · scores · race · class · patron (only under its option, for a class a patron's followers name) · adjust scores · who they are · … A step exists only when the setting defines it and this character can use it; Back keeps every value; Next never skips a step that exists.

## The task
1. **Find it and prove it with a test that fails on main.** Start from how the shell works out "the next step" and "the previous step" (`src/app/GuidedCreation.tsx`, `src/ui/creation.tsx` and what they call): the two must be the same list walked in two directions. Suspects, not conclusions: the Patron step inserted between Class and adjust scores (does Next from Class, or from a Patron step that does not apply to this class, add one step too many?); the class's scores rules read from one pack while the class entry comes from another; a step whose "does this character have it?" answer differs between the forward and the backward walk. Reproduce with invented packs: a rules pack, a second setting, a conversion-like pack on top whose class entries point across packs, the patron option on and off.
2. **Fix the cause**, so that forward and backward walk one and the same list of steps for the same character.
3. **A guard test**: for a handful of characters (a class with a patron step, one without; a class from the rules pack, one through the conversion-like pack), walking Next to the review and then Back to the start visits exactly the same steps in reverse.

## If you cannot reproduce it
Do not guess at a fix. Write what you tried, with the fixtures, at the top of the status file, add the guard test of point 3 if it passes, and push that: the lead will get the exact kindred, class and options from Francis.

## Fences particular to this piece
- A fix branch: add tests, do not edit existing ones.
- No change to any step's words, layout or order as ruled; only which step Next lands on.
- Another builder is changing the order of the Kindred and Class rows (`cs-38-alphabetical`) and how the "From <pack>" line is chosen (`sn-1b-pinned-source`) in neighbouring code: keep your change as small as the cause allows.
