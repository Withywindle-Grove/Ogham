# Brief for a cloud session: 07 catches up with the pack format as ruled (07 only; the full check applies)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md`**, then `docs/CLAUDE.md`. Your branch: `docs-07-catch-up-2026-11-13`. Pull request title: "07: the pack format catches up with November's rulings (pf-13a, pf-13b, pf-17, pf-18, sn-1b, pf-7a, pf-5a)".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch (bring it up to `origin/main` first); carry nothing over.

## Why this is not an ordinary docs piece
`docs/07-content-packs.md` is bundled into the app and read by a test, so a change to it runs the **full check**: `npm ci`, then `npm run check` must pass before you commit (the README's rule for code applies here). **This brief is the one place the README's "do not edit 07" does not apply**: editing 07 is the whole task. Edit nothing else except your status file.

## The task
07 says what the pack format is now. Bring it in line with these rulings, in 07's own short style, each fact in one place, with the ruling's id beside it. Read each ruling's row first; write only what the ruling says.

| What | Ruling (in `docs/design/rulings/`) | In 07 today |
|---|---|---|
| **`meta.statBlockLayout`**: `groups` is **three** levels deep (groups, each a list of lines, each a list of field names); a name matches a creature's field exactly, case included; `hp` in lower case only is reserved for hit points with their average; a layout at the pack's top level is ignored by the app and is an error in the checker | `dec-night-and-morning-2026-11-13.md` pf-13a; `dec-linked-spots-picks-2026-11-13.md` pf-13b | The paragraph in "Patrons, and the December additions" shows `groups` one level too shallow: **correct that paragraph**; do not add a second |
| **Rule text in blocks**: the value is a plain string or `{ blocks: [...] }`; the block table; one level of nesting; the link mark the only inline mark, read in plain strings too; where it may appear (a place rule's `text`, an area's `gm.text`, a procedure step's `text`) | `dec-rule-text-blocks-2026-11-13.md` pf-18 (copy its table and its invented example) | One sentence naming "the rule-text block shape (rt-1)" with no keys: give it a short section of its own and point that sentence at it |
| **`pinnedFrom`**: an entry may carry the id of the pack it was copied from; for a class or a race the app names that pack on the source line | `dec-pinned-source-2026-11-13.md` sn-1b | Nothing |
| **A coin's `unitName` and `pluralName`** in a rules set's currency list; with one label the app prints it as given | `dec-purse-screens-2026-11-13.md` pf-17 | Find where the currency list is described; add there |
| **An adventure's `adventureHooks`** (`id, name, text, pays, giverNpcId?`, GM-only until sent; not `hooks`, which are rule hooks) and **`adventureHook` as a kind a link may name** | `dec-pack-formats-2026-11-11.md` pf-7, pf-7a, pf-5a | Check; add only what is missing |

For each row your status file says: "corrected at <section>", "added at <section>", or "already there".

## Fences particular to this piece
- 07 and your status file only. Nothing under `src/`, `scripts/`, any other doc, any ruling.
- **Leave alone** any 07 text about a creature's stat block that is not the one paragraph named above (another open pull request owns it), and anything about an encounter check's `name` (it arrives with another pull request).
- Invented examples only (the rulings' own examples are invented: use them). No real game, book or adventure names, no pack's real short name.
- If a test that reads 07 fails because of your change, do not edit the test: read what it expects, fit 07 to it if the rulings allow, and otherwise stop and write the question down.
- If a ruling and 07's existing text contradict each other beyond what this table lists, stop on that row and write it down.
