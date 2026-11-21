Follow docs/plans/briefs/README.md (its fences and how to work) together with this brief; where this brief is more specific, it wins.

# Cloud brief: the town's go-live audit (read-only; the last row of set 2, its audit half)

You are a cloud builder (a Virtual Builder). You cannot message anyone: your ONLY output is a pushed branch and a PR holding ONE new docs file. Change NO code. If a guard or a permission check blocks you, stop and write what blocked you in the PR body. Never git stash, never force-push, never --no-verify.

## Why
The town goes live from its held stack (origin/dec-3-town-stack) with only some rows built (Francis's ord-2: the buying path and the eyes before 5 Dec; the rest, the "extras", run by hand on the night: W14 notices, W15 the town's map, W10 the players' stock list, W10a the at-once answer, W6 encounters in town, W8's player half, W18, W13's remainder, W16 the players' town, W19, W20). Nothing on screen may lead to an unbuilt row: no dead buttons, empty sections or links to unbuilt things. The fix comes later; this is the AUDIT the lead reads first, and it also becomes Francis's "by hand on the night" sheet.

## What to do (read the code on origin/dec-3-town-stack; the plan docs/plans/dec-3-the-whole-town.md there)
For the GM's town (TownScreen and its parts) and the PLAYERS' town as it stands (TownLine and its parts; W16 is not built), list EVERY visible button, link, section heading, tab and empty state. For each, one row:
- where it is (file:line, and the words a person sees);
- what it leads to;
- whether that is BUILT (on the stack), BUILT ON MAIN only, or NOT BUILT (name the plan row);
- the proposed treatment if not built: HIDE it (never disable: hard rule 7), and what the GM does instead on the night, in one plain line.
Also list anything the frames (page 19 on design-december-mockups) draw that the stack doesn't show, for the record.

## Also
- At the TOP of the file, say the stack COMMIT you read (`git rev-parse origin/dec-3-town-stack`). The town's set is still being built: this audit is the baseline now and is RE-RUN (same brief, a new commit) just before the stack goes live.
- The SAME table for anything on the GM's and the players' town that shows a NUMBER, COUNT or BADGE fed by an unbuilt row (a "0 notices" or an empty "Board" heading counts as leading nowhere).

## Output
- ONE file: `docs/status/2026-11-15-town-go-live-audit.md` with the table, a short "by hand on the night" list grouped by what the GM does, and "What I couldn't check".
- Branch `docs-town-go-live-audit` (it already exists on origin at main's head; bring it up to origin/main first) (the file only). PR against main, docs only. Commit through the hook. One push. Open ONE pull request to main titled "The town's go-live audit (read-only)", with NO label and no auto-merge (as docs/plans/briefs/README.md says).

## Added by the lead
- Say at the top of the status file the commit of origin/dec-3-town-stack that was read: the town is still being built, so this audit is the baseline and is re-run from this same brief just before the stack goes live.
- List also anything on the GM's or the players' town that shows a number, a count or a badge fed by a row that is not built (a "0 notices", an empty "Board" heading): it counts as leading nowhere.
