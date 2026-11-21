# Plan: a clean public copy of Grimoire (public-repo-move)

Written 2026-11-20 (row public-prep-1). Francis ruled: "Start the prep and give me a doc with the instructions so I don't lose it". Source: the audit of 2026-11-20 (summarised below; its full report is a side-session note, not in the repository). **Nothing is switched by this plan's prep steps.** Tick a box when the step is done.

Who: **F** = Francis (clicks in GitHub, Vercel, Supabase), **C** = Claude (files, commands, one pull request each).

## Why

| Reason | Detail |
|---|---|
| Free parallel checks | A public repository gets GitHub's standard machines free. Checks then run side by side, not one at a time on the PC |
| Blocker 1 | The jobs `check` and the three picture shards run on the PC runners. In a public repository a stranger's pull request could run its own code on the PC (`docs/plans/ci-self-hosted-runner.md`: "the runners come off first") |
| Blocker 2 | The old commits, pull requests and one branch name carry the real names of the rules set and the setting. A public history cannot be taken back, and a rewrite cannot clean the pull requests |
| Also found | Two personal email addresses on every commit; his Windows user name and Drive folder in some files; budget figures; no licence |
| Clean | No password, key or token anywhere in history. `packs/` and PDFs were never committed |

## What stays private

- This repository (Withywindle-Grove/Tome): its history, its 1,100+ pull requests and comments, its branches, its Actions logs.
- `packs/` (never committed; stays on the PC and in the Drive).
- The PC runners (they never serve the new repository).

The new repository is one commit of a scrubbed snapshot of `main`. This repository stays the working history until the switch, and as a read-only archive after it.

## Part A: preparation (can happen now, no switch)

- [ ] **A1 (C, done by this pull request): scrub the names on main's docs.** The setting's four peoples are replaced by invented ones (`Thistlekin`, `Duskcat`, `Burrowkin`, `Gloamwight`) in 11 doc files. Not touched: quoted words of Francis's (see ⚑1).
- [ ] **A2 (C, with the next code pull request): fix the one code comment.** `src/modules/characters/bonuses.ts`, line 25, the doc comment on `source` names one of the setting's peoples as an example. Replace it with an invented example (`"Thistlekin", "Friar at level 3"`). Comment only; no behaviour changes.
- [x] **A3 (F): choose a licence.** ⚑2, ruled "1" (2026-11-20): no licence, all rights reserved; the snapshot's rules add `LICENSE`, the README line and `"license": "UNLICENSED"`. Options were:
  - *No licence (all rights reserved):* the code is visible, nobody may reuse it. Says "look, don't copy". The README says so. Keeps a market launch open (decisions log, 2026-11-07).
  - *A permissive licence (MIT):* anyone may use and sell it, with credit. Gives up control.
  - *A source-available licence (for example a non-commercial one):* free to read and run for personal use, not for sale. Middle way.
  C then adds `LICENSE` and a README line to the snapshot (not to this repository unless he says so), and `package.json` gets a `license` field.
- [x] **A4 (F): decide what leaves the snapshot.** ⚑3 to ⚑7 and ⚑9, ruled 2026-11-20 (see the ⚑ list); the cuts list (left-out files; before and after for the brief, the roadmap and the intents) approved on 21 November, "Yes to both", which also gave the same treatment to the book figures in `docs/testing.md`, the player's quotes in the ruling `dec-player-end-user-feedback-2026-11-19.md` (and the same quote in the decisions log), and the two decisions-log clauses keeping a market launch possible. C lists, F ticks "leave out" or "keep":

  | Group | Files | Why |
  |---|---|---|
  | Budget, plan and credit figures | `.claude/README.md` (the budget lines), `docs/health/project-review-2026-11-10.md` (credit balance and expiry), the other lines with a dollar cap in `.claude/`, `docs/09-decisions-log.md` and `docs/testing.md` | Private money facts (⚑3). C finds every line with `rg -F '$' .claude docs`, and edits or removes it in the snapshot |
  | Windows user name and Drive paths | `docs/reviewer/project-review-2026-11-17.md`, `docs/plans/ci-self-hosted-runner.md`, `docs/health/project-review-2026-11-10.md`, `docs/plans/briefs/project-review-2026-11-17-brief.md`, `docs/design/notes/brief-scene-top-states-2026-11-14.md`, `.claude/briefs/builder-brief.md`, `docs/status/2026-11-15-dec13-c1.md`, `docs/status/2026-11-15-dec13-c7.md` (and any others the audit counts; C re-runs the search) | Replace the paths with `<repo>` and `<Drive folder>` in the snapshot (C does this; no choice needed) |
  | Candid internal reviews | `docs/health/` (10 files), `docs/reviewer/` (1 file) | Honest but may not be wanted public (⚑4) |
  | The way of working | `.claude/` (agents, briefs, driver rules), `CLAUDE.md`, `REVIEW.md`, `docs/status/` (about 300 files), `skills/content-pack-converter/` | Shows how it is built, and that books are converted (⚑5). Keep, trim or leave out |
  | Commercial ideas | `docs/01-product-brief.md`, `docs/08-roadmap.md` (licences, a marketplace) | Competitors could read them (⚑6) |
  | Time zone | "2 am local time" in `check.yml` and 3 docs | Say "07:00 UTC" only (C does this, no choice needed) |
  | Players' words | `docs/intents/2026-11-10-players-feedback.md`, `docs/intents/player-tab-end-user-feedback-2026-11-19.md` | Private messages; no player is named (⚑7) |
- [ ] **A5 (F then C): the commit email.** GitHub gives each account a private address. F: GitHub, top right photo, Settings, Emails, tick "Keep my email addresses private" and "Block command line pushes that expose my email", and copy the address that looks like `12345+login@users.noreply.github.com`. C: in the snapshot folder only, `git config user.name "Francis"` and `git config user.email <that address>` before the one commit. The other contributor's address never enters the new repository.
- [x] **A6 (C): workflow changes for a public repository** (made in the snapshot, or in this repository once the switch is near). All four workflows read one setting, `CI_RUNNER`, in their first job: `runs-on: ${{ (vars.CI_RUNNER == 'github' || vars.CI_RUNNER == 'auto') && 'ubuntu-latest' || fromJSON('["self-hosted","grimoire"]') }}` (`check.yml` line 60, `preview.yml` 29, `review.yml` 39, `changelog-draft.yml` 21). Every other job follows the `pick` job's answer (`scripts/ci-pick-runner.mjs`).

  | Change | Where | Effect |
  |---|---|---|
  | Set the repository **variable** `CI_RUNNER` = `github` in the new repository (not `auto`, not unset) | Settings, Secrets and variables, Actions, Variables | `pick` runs on GitHub, and `heavy_runs_on` (check and the three picture shards, `check.yml` lines 219 and 393) becomes GitHub too. Under `auto` or unset they would ask for the PC |
  | Leave `DB_RUNNER` **unset** | same | The database shards (`check.yml` line 282) run only on `ubuntu-latest` unless it equals `self` |
  | Leave `CI_LOCAL_SLOTS` unset | same | It only counts PC lanes |
  | Optional tidy-up, in a later row: delete the `self-hosted` branch from the four `runs-on` lines and from `ci-pick-runner.mjs` | the four workflow files, `scripts/` | Then a missing variable can never fall back to a PC |

  Also: (1) **Settings, Actions, General, "Require approval for all external contributors"**: F ticks it at once when the repository is created (it cannot be set while private). (2) **Review workflow key:** `review.yml` and the triage and changelog jobs use `ANTHROPIC_API_KEY`. The workflows start on `pull_request`, never `pull_request_target`, so a fork's pull request gets no secrets; do not add `pull_request_target` or `workflow_run`. (3) F also turns on secret scanning and push protection (Settings, Code security).
  **Checked 2026-11-20 (public-prep-2):** no job names `self-hosted` outside these switch expressions, so the snapshot keeps the four workflows as they are (only comments lose a figure and the time zone) and the repository variable does the work: `CI_RUNNER` = `github` (B6) makes `pick` run on `ubuntu-latest` and print `ubuntu-latest` for `runs_on` and `heavy_runs_on`, which every other job reads; the database shards stay on `ubuntu-latest` while `DB_RUNNER` is unset. If the variable were missing, `pick` would ask for the PC's labels and wait for a runner the new repository doesn't have (B10), never reaching the PC. Forks: the workflows start on `pull_request` and `workflow_dispatch` only, and the one job that writes to a branch (redraw) checks that the pull request comes from the repository itself, so a fork's pull request reaches no secret; nothing to change.
- [x] **A7 (C): dry run.** Done 2026-11-20 (public-prep-2): `npm run public:snapshot -- <folder>` builds it (below), the scan passed, and in the folder `npm ci`, the type check, lint, the tests, the function-lineage check and the build passed. `npm run docs:check` needs a git repository (it lists the docs with `git ls-files`), so in the folder it ran from a copy that lists them from the folder: passed. On switch day it runs as is, after the folder's `git init` (B4).

### The snapshot builder (public-prep-2)

- `npm run public:snapshot -- <folder outside the repo> [--replace]` runs `git fetch origin` first and prints the commit and its date, then reads `git archive origin/main` (tracked files only, line endings as git stores them), applies `scripts/public-snapshot.rules.json` in order, turns links into left-out files into plain text, adds `LICENSE`, writes a staging folder beside the output (`<folder>.staging`) and runs the scan on it last. Only when the scan passes does the staging folder become `<folder>`, with a marker beside it, `<folder>.snapshot-ok.txt` (outside the folder, so never committed), naming the commit and its date. Any failure deletes the staging folder, the old `<folder>` and the marker: a folder without its marker is not a current snapshot. Every rule must find its target: when `main` has moved on, a rule that finds nothing, or a line or file that changed since it was reviewed, stops the build and names the rule. Fix the rule; never delete it to get past.
- `npm run public:scan -- <folder>` fails, with file and line, on a real name, an email address (other than noreply and example ones), a home or Drive folder, or a secret's shape (Supabase secret keys and personal tokens, a service_role token, a database address with a password, every GitHub token kind, an Anthropic key, a private key block), and lists any money amount left in the docs. Pictures and other binary files get the same checks on the text they carry (a PNG's text chunks, and the readable runs outside its image data). It also lists, without failing, every line where a name sits inside a longer word (a camelCase identifier, a joined slug; a name under 4 letters only as its own part of a joined word), for a person to read before B4. Its names come from two private lists, never committed: `packs/_design/denylist.txt` and `packs/_design/public-scan-names.txt` (the peoples, the setting's house name, the Windows user name). Without them it refuses to run. Reviewed lines (invented test values, Supabase's and npm's own notices) pass by the rules' `allow` list, by file and line hash.
- The builder, the scan, their tests, the rules and `scripts/public-snapshot/` (the reworded intents) never enter the snapshot.
- On switch day, after `git add`: `.githooks/commit-msg` and `.githooks/pre-commit` need `git update-index --chmod=+x` (the builder prints the list).

## Part B: the switch (about an hour, at a quiet moment)

Pick a moment with few open pull requests and no migration waiting.

- [ ] **B1 (F with the driver): clear the line.** Merge or close the open pull requests. Any that must go across are re-created in the new repository from their branch by C (one at a time; the old pull request text stays in this repository).
- [ ] **B2 (C): freeze.** No merges to this repository's `main` until B10. Note the last commit id.
- [ ] **B3 (F): create the new repository.** GitHub, New repository, owner `Withywindle-Grove`, a new name (⚑8), **Public**, no README, no licence, no `.gitignore`. Send C the address.
- [ ] **B4 (C): push the snapshot as one commit** (the scrubbed folder from A7, committed under the noreply address from A5, pushed to `main`). `npm run docs:check` and the name search run once more first.
- [ ] **B5 (F): add the secrets** (Settings, Secrets and variables, Actions, Secrets). Names only; values from the old repository's owners (Anthropic console, Vercel, Supabase test project):
  - `ANTHROPIC_API_KEY`
  - `TEST_SUPABASE_URL`
  - `TEST_SUPABASE_PUBLISHABLE_KEY`
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
  - any other test-project secret the old repository lists (the audit counted seven; the workflows name these six; compare with the old Secrets page).
- [ ] **B6 (F): add the variables** (same page, Variables tab):
  - `CI_RUNNER` = `github`
  - `MAIN_SUPABASE_URL` and `MAIN_SUPABASE_PUBLISHABLE_KEY` (the main project's public address and key; the same values as in the old repository)
  - leave `DB_RUNNER`, `CI_LOCAL_SLOTS` and `DEFER_BY_DAY` unset.
- [ ] **B7 (F): Vercel.** Project, Settings, Git: disconnect the old repository and connect the new one, for production and previews (`main` is production). Check the preview protection setting (who can open a preview link). Check that the Vercel variables for the test project are still set on Preview.
- [ ] **B8 (F): Supabase.** In the main project check Authentication settings (is sign-up open?) and run the security advisor once more (`npx supabase db advisors --linked`, C). Nothing in the project changes address.
- [ ] **B9 (F): protect `main`.** Settings, Rules, New branch ruleset on `main`: require a pull request, require the checks `check`, `database` and `layout` green, block force pushes and deletion. Also Settings, Actions, General: tick "Require approval for all external contributors"; set the default token to read-only; secret scanning and push protection on.
- [ ] **B10 (F): keep the PC out.** Settings, Actions, Runners in the new repository must show none. The PC runners stay registered to the old repository only; do not add them to the new one. (If they are registered at organisation level, F removes the new repository from their allowed list.)
- [ ] **B11 (C): the trial pull request.** A tiny change on a branch, labelled `ready` and `preview`. It must show: `check` green, `database` three shards green, `layout` three shards green, all on GitHub's machines (the `pick` log says "CI_RUNNER is 'github'"), and a preview link that opens. Then F merges it, and the main run must deploy production once.
- [ ] **B12 (C): move the working places to the new address.** Worktrees (`git remote set-url origin <new>`), the memory notes, `CLAUDE.md`, `.claude/README.md`, the docs that name the old repository, the Vercel and Supabase notes. One docs pull request in the new repository.

## Rollback

Until B11 has deployed production once, the old repository is untouched: its `main`, its Vercel link until B7, its runners and its secrets. To go back before B7: delete the new repository. After B7 and before the first deploy: reconnect Vercel to the old repository (one click, Project, Settings, Git) and unfreeze. After the first good deploy the old repository stays as an archive (read-only: Settings, Archive this repository) and is never made public.

## What the audit could not check

| Gap | What to do |
|---|---|
| Pictures (about 6,600 in history; 3 opened) | The snapshot carries the current pictures only. C opens a sample of the current mockups and gallery baselines before B4; a screenshot from a live campaign with a private pack could show real names |
| Actions logs and artifacts | Not carried over (new repository, new logs). Nothing to do |
| Vercel preview protection, Supabase sign-up | B7 and B8 |
| Legal view of paraphrased book content | A lawyer's call. The survey note (`docs/design/notes/fae-woodland-creation-survey-2026-11-03.md`) and a few figures in `docs/testing.md` and `docs/plans/m5b-0c-creation-survey.md` read as a summary of one book. ⚑9 |
| Names not on the search list | After the scrub C searched for the four peoples, the setting's name, the rules set's short name and the setting's book wording; a name nobody thought of could remain |

## ⚑ for Francis

**All nine ruled on 2026-11-20**, a one-word answer each to the driver's question: ⚑1 "A" (alias inside the quotes, snapshot copy only, marked `[name swapped]`); ⚑2 "1" (no licence: all rights reserved, a `LICENSE` notice and a README line); ⚑3 "A" (budget, plan and credit figures left out, the rules around them kept); ⚑4 "A" (`docs/health/` and `docs/reviewer/` left out); ⚑5 "A" (the way of working kept, trimmed of figures, the Windows user name and Drive paths; `docs/status/` left out; `skills/content-pack-converter/` kept, the name scan found it clean); ⚑6 "A" (the brief and the roadmap kept, trimmed of pricing, market and business passages; he sees the exact cuts first); ⚑7 "A" (players' quoted messages in `docs/intents/` reworded, no name, no quote); ⚑8 the name **Ogham**, the switch about 04:00 UTC on 21 November with Francis at his PC; ⚑9 "A" (the survey note left out, the creation plan's figures reduced to shapes). The questions as asked:

1. **His own words name the setting or a people.** Four lines, left as they are: `docs/intents/test-feedback-2026-11-19.md` lines 379 and 381 (a people, in his quote and the screen text he describes), `docs/design/rulings/dec-required-packs-and-pack-choices-2026-11-13.md` line 29 (the setting's calendar, in his quote), `docs/design/rulings/dec-mockup-rulings-sets3-5-2026-11-12.md` line 45 (a book term, in his quote). Keep these files out of the snapshot, or alias inside the quotes in the snapshot copy?
2. Licence: none (all rights reserved), permissive (MIT), or source-available (non-commercial)?
3. Budget, plan and credit figures: leave out of the snapshot, or keep?
4. `docs/health/` and `docs/reviewer/` (candid reviews): leave out, or keep?
5. The way of working (`.claude/`, `docs/status/`, `skills/content-pack-converter/`, `CLAUDE.md`, `REVIEW.md`): keep, trim, or leave out?
6. `docs/01-product-brief.md` and `docs/08-roadmap.md` (commercial ideas): keep, trim, or leave out?
7. Players' quoted messages in two `docs/intents/` files: keep, or leave out?
8. The new repository's name, and the date and hour of the switch.
9. The pack survey note `docs/design/notes/fae-woodland-creation-survey-2026-11-03.md` (a close summary of one book): keep it out of the snapshot? (Recommended: out, with `docs/plans/m5b-0c-creation-survey.md`'s figures reduced to shapes.)
