# Domain docs

How the loop's skills (`domain-modeling`, `improve-codebase-architecture`, `codebase-design`, `tdd`, `to-spec`, `to-tickets`) read this repository's domain documentation. Ruled 2026-11-27 (`docs/design/rulings/process-loop-2026-11-27.md`).

## Where the domain lives here

| A skill asks for | In this repository |
|---|---|
| `GLOSSARY.md` | Not written yet. Until it is: the entities and fields in `docs/04-data-model.md`, and the words players see in `docs/06-screens-and-design.md` ("Words and voice"). Read the section you need, not the file |
| `docs/adr/` | `docs/09-decisions-log.md`, "Standing rulings" (the rulings in force). Search the rest of `09` by tag (`[core]`, `[data]`, `[perm]`, …) |

## Rules

- **Do not create `docs/adr/`.** A decision is one line in `docs/09-decisions-log.md`, in its format, with the reason.
- **`GLOSSARY.md` may be created at the repository root** when `domain-modeling` first resolves a term. It holds this app's own terms only. Hard rule 2 applies: no game-system names, invented examples only.
- **Use the domain's words.** A ticket title, a test name or a refactor proposal uses the term from `04` or the glossary, not a synonym.
- **Say so when you contradict a ruling.** Name the `09` line; do not override it silently. A change to approved behaviour is a scope check, not a refactor.
