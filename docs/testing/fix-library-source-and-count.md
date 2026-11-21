# Manual checks: fix-library-source-and-count

On the pull request's Vercel preview (test project), with at least two packs in your Rules library.

1. Your campaigns → ⋯ → Rules library. Tap Browse on a pack, open a group, tap an entry that has a page reference.
2. Under the entry you should see "From your setting: <that pack's short name>, <page>" (or the book's title when the pack has a sources map), never "other setting rules".
3. Back to the library, Browse the other pack, open an entry: its line names the second pack.
4. Start a new campaign → Next: setting rules → tap a pack's row → in Browse open an entry: the same line, naming that pack.
5. Not changed here (fault 2, waiting on a ruling): a pack holding only a rules set still says "Nothing in it yet", and a pack that calls its races "kindreds" still says "kindreds" in its row.
