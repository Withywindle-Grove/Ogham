# Manual checks — ci-playwright-image

1. Push the branch (`git push -u origin ci-playwright-image`), open its pull request and add the label: `gh pr edit <n> --add-label ready`. Open the run on GitHub (Actions tab).
2. Open **layout shard 1/3**. Near the top you should see "Initialize containers" pulling `mcr.microsoft.com/playwright:v1.64.0-noble`, and no step that installs Playwright or its dependencies.
3. In the same job, the `npm run test:layout` step should end with "N passed", like before. Do the same for shards 2/3 and 3/3.
4. The **layout** check is green. If a gallery picture fails instead, open its `layout-screens-N` artifact: a difference only in small symbols (ⓘ, ⚑, arrows) means a fallback font differs (status file, section 4); stop there and decide (new baselines through Design, or roll back).
5. Compare the shard times to an older run (about 7, 7 and 8 minutes): they should be about the same, give or take a minute.

Gallery pictures expected to change: none.
