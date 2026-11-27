---
status: pending
milestone: December first play (the first build loop: the "to add" automated checks)
absorbed-into: none yet; the spec `docs/specs/` from `/to-spec` absorbs it
supersedes: nothing
---

# Loop 1, sitting A: the "to add" automated checks (2026-11-27)

Francis ruled in chat with the driver's cloud session on 27 November, at a `grill-me` sitting in words only: the work has no screen and changes no stored data, so it has no mockup. His words are in quotes. The checks are the "To add" rows of `docs/12-coding-standards.md`, Automated checks.

| Id | Ruling | Francis |
|---|---|---|
| atc-1 | **The first loop is the "to add" checks**, with this sitting in words only | "Yes, run it as the first loop" |
| atc-2 | **This loop: the hard-rule checks and the size and speed checks** (nine rows): `modules` reach `core` only through its public entry (rule 6); no AI service package or host in the app (rule 1); `package.json` dependencies equal the list in `02` (rule 9); no `disabled` attribute on a control (rule 10); tokens only in inline styles in screens (rule 7); no float column for money, quantities, weights or slots (rule 8); the name scan says so when its private list is absent (rule 2); a new source file over 400 lines (cs-10); a unit test over 300 ms (cs-34). **After 5 December, as a second loop:** type-aware lint, the four compiler-flag rows' flags and `exhaustive-deps` as an error (they touch hundreds of files that the work before 5 December also edits) | "Yes, A and B now, C after December 5" |
| atc-3 | **Old code that breaks a new check is recorded as known**; only new breaks fail. The list of old breaks goes to Francis at sitting B. Fixing them is a later loop, starting with the disabled buttons, with pictures (a disabled button that becomes a tappable one with a why-pop-up is visible) | "Yes, record them as known" |
| atc-4 | **Each check fails a pull request as soon as it merges**, before 5 December too. The slow-test report only reports, as `12` says | "Yes, a" |

## Technical (Claude's, technical ownership)

Which packages and hosts count as AI services; how the list in `02` is read; whether test files count toward the 400 lines; where the known breaks are recorded (`eslint-suppressions.json` for lint rules, a list beside each test-based check). The spec's technical part says each.

## Open

- Nothing waits for a ruling.
