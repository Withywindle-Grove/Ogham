# skills/ — packs and the converter

Loads when you work in `skills/`. The root `CLAUDE.md` rules still apply.

- Packs are private user data: keep them in `packs/` and never in the repo. Skills and tests use invented content only.
- Start with `content-pack-converter/SKILL.md`, then `PLAYBOOK.md`. Where they differ from `docs/07`, 07 wins.
- Every rule or field the format can't express gets a row in `docs/11-modelling-gaps.md`, in neutral words.
- When "pack updated": re-run `npm run pack:check -- <file>` on the affected pack and report any discrepancies before continuing.
- Script tests: `py -m unittest discover -s skills/content-pack-converter/scripts/tests`.
