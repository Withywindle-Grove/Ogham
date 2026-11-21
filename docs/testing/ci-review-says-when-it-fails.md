# The automatic review says when it didn't run (technical change, 2026-11-10)

No screen in the app changes. Both checks are on GitHub.

1. **On this pull request, while the credit is still used up.** Open its page. A comment from github-actions starts with "**Automatic review didn't run.**" and gives the reason: "Claude stopped with an error before reviewing: Credit balance is too low". It ends with a link to the run.
2. **After the credit is restored.** On any pull request that touches `src/` or `supabase/`, add the **review** label (remove it first if it's on). The same comment is replaced by the review itself, starting "**Automatic review (Claude, against REVIEW.md).**"
