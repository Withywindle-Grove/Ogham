---
status: absorbed
milestone: December first play (how the work is run from 27 November)
absorbed-into: docs/specs/hard-rule-and-size-checks.md (story 27, check 7), CLAUDE.md (Docs current, the build loop), .claude/README.md (loop step 5, Review before a merge)
supersedes: lp-1, the words "review per ticket" only (`design/rulings/process-loop-2026-11-27.md`); the rest of lp-1 stands
---

# Loop 1, sitting C: three rulings (2026-11-27)

Francis ruled in chat with the driver session on 27 November, about 19:10 UTC, by choosing options. His words are in quotes.

| Id | Ruling | Why | Francis |
|---|---|---|---|
| lc-1 | **Story 27, the name scan with no private list: the commit hook stays quiet.** The warning shows on the pull-request scan (`--pr`) and, on GitHub, as the `::warning` annotation | On the PC the list exists. In the cloud there is never one, so a warning on every commit would be noise once the hooks run there | "Keep it quiet" |
| lc-2 | **The local review runs once per batch, not per ticket.** One review of the whole pull request, after its last row. It replaces "review per ticket" in lp-1 and the loop table's step 5 | Loop 1 ran 9 Opus-high reviews for 4 batches. Once per batch saves about 5 a loop, and the reviewer sees how the rows fit. `CLAUDE.md` already says one review per batch | "Per batch" |
| lc-3 | **A builder's departure from the spec goes in the pull request's text only.** After the merge, the design agent brings the spec in line. A builder does not edit a spec. The `09` line and `10` still go in the same commit; the spec line follows from the design agent | One owner for specs | "The design agent" |
