# Manual checks: process-layout-one-at-a-time

Nothing to tap in the app: this changes only how CI runs. Claude checks these on the pull request's own run and the next ones.

1. After the **ready** label is added, open the pull request's **Check** run (Checks tab → Check). **You should see** **check** and the three **layout shard N/3** jobs run one after another, never two at once (each starts when the one before it ends); the **database shard** jobs may run beside them. No job says "Canceled".
2. On the next night with several pull requests, open two runs started close together. **You should see** one run's check or layout shards waiting ("Waiting for a pending job in this group") while the other's run, with nothing cancelled.
3. After a week (by 20 November), Claude reports two numbers: runs that failed on load alone, and the longest a pull request waited for its check and layout jobs.
