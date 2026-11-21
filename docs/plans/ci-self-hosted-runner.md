# Plan: a self-hosted runner for the GitHub checks

Written by the Builder, 2026-11-07. Francis said yes to a self-hosted runner to stop paying for GitHub Actions minutes (the repository stays private), and chose **this Windows PC, under WSL2** (a Linux machine running inside Windows) over a spare computer or a rented server.

## What changes, in plain words

Today every check runs on a computer GitHub rents us by the minute. After this, the checks run on Francis's own PC, inside a small Linux environment that is walled off from his Windows files. GitHub still shows the same checks on every pull request, and merging works the same way. The checks stop costing minutes.

The cost moves to his PC instead. It must be on, awake and logged in while checks run. While they run, it is busy: they use a few CPU cores and a few gigabytes of memory for 10–20 minutes. If the PC is off, checks wait in a queue (up to a day) and start when it comes back.

## Where it runs

- **A dedicated WSL2 Linux system named `grimoire-ci`** (Ubuntu 24.04), used only for the checks. It is not his everyday Ubuntu, if he has one.
- **Docker Engine inside it** (the free, command-line Docker, not Docker Desktop). The database tests start a local Supabase in Docker. The picture checks run in Playwright's prebuilt image (#540), which is a Docker container.
- **The GitHub runner program**, installed three times in that system, as three background services (see "Three runners").

## Three runners, and why

Each check run has up to six heavy jobs: three database shards and three picture shards. One runner would run them one after another, and a run would take about 45 minutes instead of about 12.

- **runner-1** carries the extra label `db`. All three database shards run there, one after another. Each starts its own local Supabase on fixed ports, so two at once on the same machine would collide. That is about 15 minutes for the three.
- **runner-2 and runner-3** take the picture shards and the small jobs. Each picture shard runs in its own container, so they can run side by side with no port clashes.

Expected time for a full run: about 15–20 minutes. That is a little slower than GitHub's runners, because one machine does it all, and it costs no minutes.

## How the workflows choose the runner

Every `runs-on: ubuntu-latest` becomes a choice read from one repository setting, `CI_RUNNER`:

```yaml
runs-on: ${{ vars.CI_RUNNER == 'github' && 'ubuntu-latest' || fromJSON('["self-hosted","grimoire"]') }}
```

The database shards ask for `["self-hosted","grimoire","db"]` in the same way.

- By default (`CI_RUNNER` unset), everything runs on his PC.
- **The fallback is one switch:** set `CI_RUNNER` to `github` (GitHub → Settings → Secrets and variables → Actions → Variables) and checks go back to GitHub's paid runners. Unset it to return.
- **Recommendation: keep this manual fallback, not an automatic one.** GitHub has no built-in "use mine, else theirs", and the home-made versions of it are fragile. The switch covers a holiday, a broken PC or an urgent fix while away.
- **A third value, `auto` (ci-auto-1, Francis 18 Nov: PC first, GitHub when it's busy).** Since ci-auto-1 the choice is made once per run by a first job, **pick** (`scripts/ci-pick-runner.mjs`), and every other job reads its answer, so a whole run (its database and picture shards included) stays on one choice:
  - `CI_RUNNER` unset (or any other value): the PC, as before. pick itself runs on the PC.
  - `CI_RUNNER` = `github`: GitHub, as before. pick runs on GitHub.
  - `CI_RUNNER` = `auto`: pick runs on GitHub (seconds, so it never waits for a busy PC) and counts the other **runs** on the PC: runs with at least one unfinished job (queued, waiting or running) that asked for the PC, each counted once however many jobs it has (a check plus three picture shards is one run). It reads them with the run's own token (`actions: read`; no extra secret). Fewer runs than lanes: the PC. As many or more: GitHub, the run is marked **overflow**, and its page shows an "Overflow to GitHub" notice. If the runs can't be read, the PC.
  - **Check and the picture shards never overflow** (ci-pc-pictures, Francis, 20 Nov 2026: "Yes, PC only"): pick gives them their own answer (`heavy_runs_on`, `heavy_target`), the PC under `auto` whatever the count, so in an overflow run they wait their turn in the PC's one-at-a-time queue and only the small jobs go to GitHub. On 20 Nov a picture shard took 19 to 40 minutes on GitHub against 3 to 5 on the PC, and check 12 to 18 against 4 to 6 (`docs/testing.md`, Overflow and the spending limit). `CI_RUNNER` = `github` still sends them to GitHub: that is how a picture run that timed out on the PC is re-run there.
  - **Lanes:** the PC runners that are online, when the runners list can be read; that list needs admin rights, which the run's own token never has, so today the lanes are `CI_LOCAL_SLOTS` (a repository variable, default 2; set to 1 since 19 Nov). Only pc-1 and pc-2 are used: Francis keeps pc-3 off, because three runners together run out of memory.
  - **What auto can't see:** without the runners list an offline PC looks the same as an idle one, so a run would wait for it. Restart the runners with **(PowerShell)** `wsl -d grimoire-ci --exec sleep infinity`, or set `CI_RUNNER` to `github`. The choice is made once, at the start: a run sent to GitHub stays there even if a lane frees a minute later.
  - **pick itself runs on GitHub in auto**, so at the Actions spending limit every workflow goes red, even with the PC idle (docs/testing.md, Overflow and the spending limit). It stays on GitHub because on the PC it would wait behind the very lanes it is meant to count, and forever when the PC is off.
  - The database shards keep their own rule: GitHub unless `DB_RUNNER` = `self` and pick chose the PC.
- This covers all four workflows: check, preview, review and changelog-draft. The small jobs (changes, triage, the aggregate checks, deploy) move too; they are seconds each.

## Browsers and the Playwright image

Nothing changes here. The picture shards already run in `mcr.microsoft.com/playwright:v1.64.0-noble` (#540). Docker on the PC pulls the same image once (about 1 GB) and reuses it, so the pictures are drawn exactly as on GitHub. No browser is installed on the PC itself.

## Security (a private repository)

- **Who can make code run on the PC:** only people with write access to this private repository can trigger these workflows, which today means Francis and his Claude sessions. Forks of a private repository can't run them. Dependabot's pull requests also run: they install new versions of npm packages, whose install scripts run on the PC.
- **Walling off Windows:** the `grimoire-ci` system is set up with Windows drives not mounted (`automount = false`) and Windows programs not callable from it (`interop = false`). A job can't read his documents or start Windows programs. The runner runs as an ordinary Linux user, `runner`, not root. Docker runs inside that system only.
- **Secrets:** the Vercel and Anthropic keys are passed into the jobs that use them, the same as on GitHub. They exist in the job's memory while it runs, and the runner doesn't store them.
- **Leftovers:** each job checks out fresh (`actions/checkout` cleans the folder). A new first step in each database shard stops any local Supabase a crashed run left behind, and a weekly `docker system prune` keeps the disk in check.
- **Never on a public repository:** self-hosted runners must never serve a public repository, where anyone's pull request could run code on the PC. If the repository ever goes public, the runners come off first.

## What it needs from the PC

- Windows 11 Home with virtualization on (WSL2 needs it; the steps check it).
- About 25 GB of free disk: the Linux system, Docker images (Supabase about 5 GB, Playwright about 1 GB) and the runners' caches.
- At least 16 GB of memory is comfortable. WSL is capped at 8 GB in `.wslconfig` so Windows stays responsive.
- Sleep set to "never" while plugged in, or at least during working hours. Checks wait while it sleeps.
- WSL kept running after a reboot: a small Task Scheduler entry starts `grimoire-ci` at logon. Otherwise the runners stop when WSL idles out.

## The steps Francis runs (with the Builder, one at a time)

Each step is done together. The Builder explains each command before it runs and says what Francis should see. Steps marked **(PowerShell, admin)** are typed in an administrator PowerShell window; the rest in the `grimoire-ci` Linux window.

1. **Check virtualization:** open Task Manager → Performance → CPU, and look for "Virtualization: Enabled".
2. **(PowerShell, admin)** Install WSL and the dedicated Ubuntu: `wsl --install -d Ubuntu-24.04 --name grimoire-ci`. It asks for a Linux user name and password; use `runner`. It may ask for a restart.
3. **Wall it off and keep services running:** write `/etc/wsl.conf` with systemd on, automount off and interop off (the Builder gives the exact text), then **(PowerShell)** `wsl --terminate grimoire-ci` to apply it.
4. **Install Docker Engine** from Docker's own apt repository (the Builder gives the commands), add `runner` to the `docker` group, then check with `docker run hello-world`.
5. **Cap WSL's memory** with `<home>\.wslconfig` (`memory=8GB`, `vmIdleTimeout=-1`), then **(PowerShell)** `wsl --shutdown`.
6. **Get three runner tokens:** GitHub → the repository → Settings → Actions → Runners → New self-hosted runner → Linux x64. The page shows a download command and a `config.sh` command with a one-hour token. Done three times, once per runner.
7. **Install three runners** in `~/runner-1`, `~/runner-2` and `~/runner-3`: download, then `./config.sh --url https://github.com/Withywindle-Grove/Tome --token <token> --name pc-1 --labels grimoire,db` (runner-1; the others use `--labels grimoire`), then `sudo ./svc.sh install runner && sudo ./svc.sh start`. GitHub's Runners page then shows three green "Idle" runners.
8. **(PowerShell, admin)** Start at logon: a Task Scheduler task that runs `wsl.exe -d grimoire-ci --exec sleep infinity`, hidden. The Builder gives the one-line `schtasks` command.
9. **Power:** Settings → System → Power → Screen and sleep → "When plugged in, put my device to sleep after": Never.
10. **Switch the workflows** (the Builder's pull request): `runs-on` as above, the db label on the shards, and the stale-Supabase cleanup step. Its own check run is the first one on the PC, a full end-to-end test.
11. **Watch one full run** together on GitHub's Actions page, then compare the minutes used and the time taken.

Expected time with Francis: 45–60 minutes for steps 1–9, mostly waiting on downloads. Then the Builder's pull request, step 10, runs about 20 minutes on its own.

## Undoing it

Set `CI_RUNNER` to `github`: checks go back to GitHub at once. To remove completely: `sudo ./svc.sh uninstall` and `./config.sh remove` in each runner folder, then **(PowerShell)** `wsl --unregister grimoire-ci`. That deletes the whole Linux system, and nothing else on the PC is touched.

## Tests

- The pull request's own check runs entirely on the PC: every job lists a `pc-*` runner in its log.
- A run with `CI_RUNNER=github` still goes to GitHub (checked once, then unset).
- The picture shards match the existing baselines exactly (same image, so no new pictures).
- Two pull requests pushed close together: the second waits for runners and doesn't fail.

## ⚑ for Francis (ruled 2026-11-07)

1. **Three runners**, as above.
2. **Dependabot's pull requests run on the PC too**, walled off as above, under the same `CI_RUNNER` switch.

The setup steps happen with Francis when he says, the Builder leading in his terminal.

## Estimate

Builder: the workflow pull request, 2–3 turns. Francis plus Builder: one sitting of 45–60 minutes for the PC setup.

## Departures

- ci-auto-1 (18 Nov) adds `CI_RUNNER` = `auto` and the pick job (see How the workflows choose the runner); unset and `github` behave as before. The plan's recommendation of a manual-only fallback stands for unset; `auto` is Francis's opt-in. After review (ci-auto-1-fix), "busy" counts runs on the PC against its lanes, not jobs (one run's check and shards filled the two slots on their own), and an overflow run says so on its page.
- Step 10 is built ahead of the setup (branch ci-self-hosted-switch, pushed once the three runners show Idle): every job in check, preview, review and changelog-draft reads the CI_RUNNER switch; the database shards ask for the db runner; a stale-Supabase stop runs before each start; scripts/ci-jobs.test.mjs checks all three.
