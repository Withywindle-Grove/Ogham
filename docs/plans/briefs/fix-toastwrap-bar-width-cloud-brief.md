Follow docs/plans/briefs/README.md (its fences and how to work) together with this brief; where this brief is more specific, it wins.

# Cloud brief: toastWrap.spec:69, the Undo toast's bar width at 375 px (a measured cause)

You are a cloud builder (a Virtual Builder). You cannot message anyone: your ONLY output is a pushed branch and a PR. If a guard, a hook or a permission check blocks you, stop and write what blocked you in the PR body. Never git stash, never force-push, never --no-verify. No line in docs/09 (dl-1).

## The failure
On GitHub's main run (43707642086, layout shard 3) and sometimes locally:
`tests/layout/toastWrap.spec.ts:69`: `expect(Math.abs(t.bar.width - t.toast.width), "bar width at 375 px").toBeLessThanOrEqual(1)` received 1.19 and 1.21. Line 68 (`bar start`) passes. Locally it came and went (failed once in a pair run, passed 3/3 alone).

## What to find, MEASURED (the lead's condition: a wider tolerance alone is NOT acceptable)
1. Open the toast's CSS and the spec. What do `t.bar` and `t.toast` measure: border box or content box? Does either have a 1 px border, a rounded edge, padding?
2. Compare with the APPROVED toast frame (docs/design/mockups on branch design-december-mockups: the Undo toast as drawn in the gallery/frames; find it). Is the bar drawn FLUSH with the toast's inner edge, or its outer edge?
3. Decide, and say which in the PR body with the numbers:
   - (a) the 1.2 px is the toast's BORDER (bar flush with the inner edge in the frame): measure the bar against the toast's INNER width (clientWidth / content box), tolerance unchanged;
   - (b) it's WebKit SUB-PIXEL rounding at that viewport: say so and compare ROUNDED boxes (Math.round of each), tolerance unchanged;
   - (c) the toast really is out by a pixel against its frame: FIX THE TOAST (CSS), not the test, and say what the frame draws.
4. If the cause is (b): also say WHY it shows on Linux WebKit at 375 and only sometimes locally (the viewport's device scale, a fractional toast width), so the next sub-pixel test is written right the first time; and add ONE line to the test file's header saying how widths are compared.
5. Prove it: run the spec 5 times at 375 and 1180 (light and dark) and report each result.

## Branch and PR
- Branch `fix-toastwrap-bar-width` (it already exists on origin at main's head; bring it up to origin/main first). Test-only unless (c). PR against main. Body: the measured cause, the numbers, the frame reference, the 5 runs. Commit through the hook. One push. Open ONE pull request to main titled "Fix: toastWrap's bar width at 375 px, by its measured cause", with NO label and no auto-merge (as docs/plans/briefs/README.md says).
- Status `docs/status/2026-11-15-fix-toastwrap-bar-width.md` (short).

## Added by the lead
- If the cause is (b), also say why it shows on Linux WebKit at 375 px and only sometimes on a Windows PC (the device scale, a fractional toast width), so the next sub-pixel test is written right the first time; and add one line to the spec file's header saying how widths are compared.
