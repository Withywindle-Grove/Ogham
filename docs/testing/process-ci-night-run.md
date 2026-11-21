# Manual checks: process-ci-night-run (cq-3)

No gallery pictures change: this step touches CI only.

1. **A day pull request's deferred notes.** Open this pull request's (or any code pull request's, after this merges) Check run: GitHub → the pull request → **Checks** → **Check**. You should see:
   - **database shard 1/3, 2/3, 3/3** running as before, and **database** green when they pass;
   - **check** green within seconds; open it: its summary says "Deferred to the night run (cq-3): the local check covers this by day.";
   - **layout** green within seconds with "Deferred to the night run (cq-3): the pictures and browser checks run at 07:00 UTC.", and no **layout shard** jobs at all, even without the **ready** label.
2. **Main after the merge.** Open the Check run of the merge on main (**Actions** → **Check** → the top run with event "push"). Same as 1: database runs, check and layout deferred; then **deploy-production** runs and its summary says "Live: …".
3. **The first night run** (the morning after this merges; the schedule only works once the file is on main). **Actions** → **Check** → a run whose event is **schedule**, started about 07:00 UTC, on main. You should see:
   - the **changes** job's summary: "The night run (cq-3): everything runs on main.";
   - **check**, the three **database** shards and the three **layout** shards all doing their work (check and the layout shards one after another, through the heavy-job queue);
   - no **deploy-production** and no **triage** job running (both shown as skipped);
   - under **Artifacts**, gallery-baselines-1, -2, -3 and layout-screens-1, -2, -3.
4. **If no night run appears** by 08:00 UTC, say so in the morning report: GitHub can start a scheduled run late or drop it when busy. Start one by hand instead: `gh workflow run check.yml --ref main`.
