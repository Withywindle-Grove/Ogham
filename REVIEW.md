# Review instructions

Read by the `reviewer` agent (`.claude/agents/reviewer.md`) and by the automatic review in CI (P3, `docs/plans/process-sdlc-1.md`). Ruled 2026-11-01. The specs in `docs/` are the source of truth; read only the sections the diff touches. Review is read-only and comments only. **Who runs it (ruled 2026-11-10):** the driver runs the `reviewer` once on each code pull request before it merges (docs-only and scripts-only pull requests are skipped; a migration or access rules are always reviewed); its findings are one comment on the pull request and a line in the pull request's text ("Reviewed: local reviewer, N findings, fixed / not"). For a pull request that draws a screen, the comment names the mockup or ruling its design pass compared against, since such a pull request may merge before Design's look (`docs/testing.md`, The component gallery).

Since 2026-11-27 the loop's review (`code-review`, step 5) also reads `docs/12-coding-standards.md`: cite its rules by id (`cs-7`); they are judgement calls, and nits unless "What Important means here" applies.

## Passes
Run three passes and tag each finding with its pass:

1. **Bugs** — logic errors, broken edge cases, undo that doesn't reverse, integers that became floats, offline or concurrent paths that lose a write.
2. **Rules** — the hard rules in `CLAUDE.md`, in this order of weight: hidden means hidden (row-level security, not just the UI; the named exceptions in `docs/09`); everything through commands with `can()` and an event; everything logged, nothing erased (deletions only from the closed list); IP-clean (no real game, book, adventure or publisher names, rules text, tables, stat blocks or numbers; nothing from `packs/`); no LLM in the app; modules don't touch core; no new dependency outside `docs/02`.
3. **Compliance** — the diff matches its plan (`docs/plans/<step>.md`, and the departures listed in the pull request's own text), the behaviour in `docs/05`, the screens and tokens in `docs/06` (calm UI: tokens only, body 16, nothing under 14, 44 px targets with 8 px between, one accent button per screen, colour carrying a distinction by itself only where the approved mockup does (relaxed 2026-11-12), never a disabled button, Undo over confirm, light and dark), and the words guide. Tests exist for each feature and each bug fix, with plain-sentence purposes; on a `fix-` branch the history shows the failing test committed first as `it.fails` / `test.fails`, then the fix commit removing `.fails` and changing nothing else in that test (bq-6). Migrations: none edited after being applied; drops or renames flagged for Francis. The components inventory's Code column and `docs/09` are updated when behaviour or decisions changed. **Shared files (ruled 2026-11-05):** a build pull request doesn't edit the numbered lines of the gate list in `docs/testing.md`; its manual checks are in its own text (rvw-12). **Mockups first (ruled 2026-11-12):** every visible change in the diff traces to a mockup Francis approved, named in its plan piece with the approval date (or the piece says "none: data and logic only" and the diff draws nothing new); a visible change with no approved mockup is **Important**, and the review comment names the mockup each screen was compared against. **Pictures:** every changed gallery picture is one the pull request's text announced; an unannounced change waits for Design before merge, and first pictures of a new screen, component or variant with no approved mockup or ruling stop as a scope check (`docs/testing.md`, The component gallery).

## What Important means here
Reserve **Important** for findings that would leak hidden data, break a hard rule, lose or erase a record, break behaviour at the table, or depart from the plan without a departure listed in the pull request's text. Style, naming and wording are **nits**.

## Cap the nits
At most five nits per review; summarise the rest as a count.

## Do not report
`docs/generated/`, `src/core/database.types.ts`, lockfiles, anything `npm run check` or the layout job already enforces, and anything the plan's ⚑ list already hands to Francis.

## Output
Most serious first: `file:line — the problem — why it matters — a suggested fix`, each tagged Important or nit and with its pass. Then one line: what you couldn't check. If it's clean, say so in one line. End with the tally `Important: N · nits: N` on its own line (machine-readable).

## Feeding back
A mistake flagged for the second time across reviews goes into `CLAUDE.md` → "Things Claude gets wrong" in the same pull request, as one line.
