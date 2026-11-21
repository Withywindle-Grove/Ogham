# Manual checks: library-count-rules-sets (lr-2a)

On the pull request's Vercel preview (test project).

1. Your campaigns → ⋯ → Rules library. Look at a setting pack's row: its count line ends with ", 1 rules set" (for example "3 classes, 2 kindreds, 12 items, 1 rules set").
2. A pack that holds only a rules set (for example a small house-rules file) says "1 rules set", not "Nothing in it yet"; a pack that holds nothing at all still says "Nothing in it yet".
3. A pack that calls its races "kindreds" still says "kindreds" in its row.
4. Start a new campaign → Next: setting rules: the pack rows show the same count line; open one: the Browse header shows it too.
