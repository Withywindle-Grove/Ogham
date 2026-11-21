# Manual checks: process-ci-db-on-github (cq-4)

1. Open this pull request's run (Checks → Check). Each **database shard N/3** job's first lines say "Runner name: GitHub Actions …", not pc-1. The three start at about the same time and pass.
2. After it merges, main's run does the same, and **deploy-production** follows within a few minutes of the shards.
3. In GitHub, Settings → Billing and licensing → Usage: the Actions minutes rise by about 12 per run that tests the database.
