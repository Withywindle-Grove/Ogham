Follow docs/plans/briefs/README.md (its fences and how to work) together with this brief; where this brief is more specific, it wins. NO screen: no component, no route, no CSS. K21 has no approved picture, so it stops before the screen.

# Cloud brief: K21's logic half, coin in a hoard and on the find card (the Pack, dec-6)

You are a cloud builder (a Virtual Builder). You cannot message anyone: your ONLY output is a pushed branch and a PR. If a guard, a hook or a permission check blocks you, stop and write what blocked you in the PR body. Do not reach the same end another way. Never git stash, never force-push, never --no-verify. No line in docs/09 (dl-1).

## The branch
`dec6-k21-coin-logic`, cut from fresh origin/main. PR against main. Title: "K21's logic half: coin in a hoard and on the find card". No label, no auto-merge.

## Read first
- docs/plans/dec-6-the-whole-pack-tab.md: row K21, "The first-night seven" table, and the purse plan it names (dec-6-purse, piece c).
- The rulings K21 names: pf-6, pk-11, pu-3, pu-5. Search docs/design/rulings/ for each id and quote each ruling's words in your status file.
- docs/07-content-packs.md, for how a pack writes a hoard and its coin.
- What exists today: search src/ for the hoard (its words as the pack prints them) and the find card (where a found thing waits for the party), and for the purse's coin model (integers, hard rule 8). Write in your status file what each does today, with file and line.

## Build (logic and tests ONLY, in the module that owns finds or the purse; no new module unless none fits)
1. ONE pure function: from a hoard as the pack writes it, give the coin it holds, in the purse's own coin units (integers), plus the hoard's printed words kept as written. Add pk-11's note where the ruling says it belongs.
2. ONE pure function: the coin lines a find card would carry, from data already loaded. These are the words as DATA (which come from the pack, which from the app), listed in the status file. NO word reaches a screen in this PR.
3. Whatever a ruling leaves open (rounding, an unknown coin, a hoard with coin and items, coin with no value): never guess. Write the question in the status file as a ⚑ for the lead, and make the function refuse or skip that case plainly, with a test.
4. No migration, nothing under supabase/, no read rule. If the logic needs stored data that doesn't exist, stop and write the question.
5. Modules don't import other modules (hard rule 6). Invented names and numbers only (hard rule 2).

## Tests (purposes first)
- A hoard with coin of one kind; of several kinds; with coin and items.
- A hoard with no coin gives nothing, never a "0" line.
- Big numbers stay integers (999999).
- The printed words are kept as written.
- Each open case refuses or skips as written.
- Nothing here imports a component.

## Pre-flight (tick in the status file)
(a) the plan's Departures under K21 (logic half) written in the plan; (e) no new words, or list them. The rest are n/a (no screen).

## Output
Status file `docs/status/2026-11-15-dec6-k21-coin-logic.md`. Commit through the hook, ONE push, ONE PR.

## Added by the lead (binding)
- The first line of this brief is out of date on one point: K21 HAS approved pictures (page 08, frames PK3 and PK5, ap-6, 2026-11-14; see "The first-night seven" in the plan). This brief is still logic only: the screen half is built later, to those frames.
- From the frames, for the logic to carry: coin lands in the purse, not the lists; a find card that names coin goes to that character's player alone and others get a log line with no amount; a coin word only the book prints is kept as printed, with a note (pf-24a: `coinsReadAs`). Say in the status file which of these are logic you built and which are the screen's.
- A treasure entry's `coins` map is coin to hand out and `value` is worth only (pf-24); an entry with no `coins` hands out no coin.
