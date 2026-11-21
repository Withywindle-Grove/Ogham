# A label no longer cancels the automatic review (technical fix, 2026-11-10)

No screen in the app changes. Both checks are on GitHub.

1. **On this pull request.** Open its page, then the **Checks** tab (or **Actions** → **Review**, filtered to this branch). There are two Review runs. The one started when the pull request opened finishes, and its comment "Automatic review (Claude, against REVIEW.md)" appears on the pull request. The one started by the **ready** label shows as skipped. Neither shows as cancelled.
2. **On the next build pull request** that touches `src/` or `supabase/` and takes the **ready** label right after it opens: the same two runs, and its review comment appears.
