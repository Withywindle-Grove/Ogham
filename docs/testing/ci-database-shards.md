# CI: the database tests in three parallel shards behind one `database` check (Francis, 2026-11-05)

1. On any computer, open pull request #473 on GitHub and scroll to the checks: you should see **database shard 1/3**, **database shard 2/3**, **database shard 3/3** and **database**, all green. **database** should finish about 5 minutes after **changes**. Before this change it took about 9.
2. Open the next docs-only pull request's checks: the three shards show as skipped (grey), and **database** is green with "the shards were skipped" in its summary.
3. Open the next pull request whose database test fails: the failing **database shard N/3** is red, and **database** is red too, with the message "A database shard didn't pass". The pull request can't merge.
