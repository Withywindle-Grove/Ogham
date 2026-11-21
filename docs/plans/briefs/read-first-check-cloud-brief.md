Follow docs/plans/briefs/README.md (its fences and how to work) together with this brief; where this brief is more specific, it wins.

# Cloud brief: a read-first check of one ruling against the code (read-only)

You are a cloud builder (a Virtual Builder). You cannot message anyone: your ONLY output is a pushed branch and a PR holding ONE new docs file. Change NO code. If a guard or a permission check blocks you, stop and write what blocked you in the PR body. Do not reach the same end another way. Never git stash, never force-push, never --no-verify. No line in docs/09.

## Which ruling
The one-line message that sent you here names ONE of these:
- **nm-1**: a person's name is never the front of their email. The name box starts empty; an account with no chosen name shows as "A player"; a name can be changed later from the menu. Source: docs/design/rulings/m5b-morning-rulings-2026-11-11.md; docs/09, 2026-11-11.
- **gs-1 to gs-4**: a change of patron swaps the free holy garb at once, wherever the change is made. Altered garb keeps Gear's rule; the old patron's spell picks go as a change of class treats them; Undo never parts patron and garb. Source: docs/design/rulings/dec-night-and-morning-2026-11-13.md; docs/05-features.md (Patron). Also compare with docs/plans/dec-1-creation.md row 14's older line, and say where the two differ.

## What to do (on origin/main)
1. Quote the ruling's words exactly, with file and line.
2. Split the ruling into its separate claims (one per sentence a person could check). For each claim:
   - BUILT, PARTLY or NOT BUILT;
   - the code that makes it so (file:line), or the place where it would live;
   - what a person sees today, in one plain line (which screen, which words);
   - for PARTLY or NOT BUILT, the smallest change that would make it true, and its size (S, M or L).
3. Say which tests already cover each BUILT claim (file:line). A claim with no test counts as PARTLY.
4. Every place a person's name or the patron's garb shows or changes counts, not only the first one you find. For nm-1, search where a display name is made from an email or an auth field. For gs-1 to gs-4, check every place a patron can change: the Patron step, the review's Change, and any later edit.
5. "What I couldn't check": anything that needs the running app or the database.

## Output
- ONE file: `docs/status/2026-11-15-check-<nm-1 | gs-1>.md`, holding the table, the smallest changes, and "What I couldn't check".
- Branch `docs-check-<nm-1 | gs-1>`, cut from fresh origin/main (the file only). PR to main, docs only, titled "Read-first check: <id> against the code (read-only)". Commit through the hook, one push, no label, no auto-merge.
