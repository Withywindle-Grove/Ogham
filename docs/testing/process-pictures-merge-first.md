# Pictures merge first, and a full regression run on demand (process, ruled 2026-11-09)

No screen in the app changes. These checks are on GitHub, after this pull request is merged: GitHub only offers **Run workflow** once the change is on main.

1. **The button is there.** GitHub → the repository → **Actions** → **Check** in the left column. A bar above the list of runs says the workflow can be started by hand, with a **Run workflow** button at its right end.
2. **A full run on main.** Tap **Run workflow**, leave the branch on `main`, tap the green **Run workflow**. A new run appears at the top of the list within a few seconds; open it. The **changes** job's summary says "Started by hand: everything runs." **check**, **database shard 1/3** to **3/3** and **layout shard 1/3** to **3/3** all run and go green, none skipped. **deploy-production** and **triage** show as skipped. It takes roughly half an hour on the PC.
3. **Nothing went live.** Vercel → **Deployments**: no new Production deployment at the time of that run.
4. **The label.** GitHub → **Issues** → **Labels**: **design-look** is in the list.
