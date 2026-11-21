# docs/ — writing docs

Loads when you work in `docs/`. The root `CLAUDE.md` rules still apply.

- Specs say what is true now, in short lines. History goes in `09` (one line with a `[topic]` tag) and in `design/rulings/`.
- Topic tags: `[core] [perm] [data] [ui] [words] [sheet] [items] [expedition] [fight] [xp] [hirelings] [packs] [adventure] [testing] [process] [ip]`.
- Each fact has one home. Link to it instead of repeating it.
- Ruling files start with a header: `status: pending | absorbed | superseded`, `milestone`, `absorbed-into`, `supersedes`. Never rewrite a ruling: write a new one and mark the old one `superseded`.
- When a milestone's docs update lands, mark its rulings `absorbed`.
- Prefer a table or a decision table to prose.
- Never edit `docs/generated/` by hand; run `npm run docs:gen`. `npm run docs:check` checks links, ruling headers, the mockup index, inventory paths and the register (`docs/testing.md`, Docs checks).
- No real game, book or adventure names; use the neutral pack IDs. The pre-commit hook checks for them.
