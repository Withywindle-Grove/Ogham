# Cloud brief: why the Pack tab's page moves when the Log sheet closes (a read-only diagnosis)

Follow `docs/plans/briefs/README.md` with this brief. **READ-ONLY DIAGNOSIS: change no code.** Your only output is one status file, `docs/status/2026-11-15-diag-pack-tab-scroll.md`, on branch `docs-diag-pack-tab-scroll` (cut from `origin/main`), and one docs-only pull request to `main`, no label. If a guard blocks you, stop and say so in the pull request's body.

## The test
`tests/layout/layout.spec.ts:1680`, "the top row stays at the top of a long page". On the Pack tab, after the Log sheet closes, the page has scrolled about 143 px. It fails on a Windows PC's WebKit (4 or 5 of 5 sizes, on main at f5caa2c2 too) and passes on GitHub's Linux WebKit.

## Find, from the code
The sheet's open and close, the focus return, the body's scroll lock and its release, the fixed tab bar, any `scrollIntoView` or `focus` call, the test's own timing and waits.
1. What moves the scroll when the sheet closes.
2. Whether it is the app or the test's timing.
3. Why Windows WebKit and not Linux.
4. **What an iPad's Safari would do.** Francis plays on one: if the page really jumps there, it is a fault on his own device, not a test's quirk. Say plainly how sure you are and what would settle it.

## Propose
The SMALLEST fix, and say which file and which Pack rows (the K-rows in `docs/plans/dec-6-the-whole-pack-tab.md`) it touches. If it is the test's, say how the test should measure instead, and keep its tolerance. If you can run WebKit, measure it; if not, say so plainly. No line in `docs/09-decisions-log.md`.

## Added by the lead
- Say whether the same sheet closing on any OTHER tab (the Scene, the Player screen) moves the page the same way, from the code: one shared sheet part means one cause.
- List what you did not check.
