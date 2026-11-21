# Intents — the front door

Ruled 2026-11-01 (P1 of `design/rulings/process-ai-native-sdlc-2026-11-01.md`). An intent is what Francis wants, in his own words, before anyone designs or builds it. One file per idea, `YYYY-MM-DD-<slug>.md`, from `TEMPLATE.md`. It is the first link of the chain intent → ruling → plan → pull request → status report.

- **Who writes one:** Francis, or an agent writing down what Francis said (he corrects it before it's committed). From a phone: dictate it to a Claude chat and ask for "an intent file for Grimoire"; the file is committed in a docs pull request.
- **What it is not:** a spec. No screens, no fields, no rulings. Open questions go in as ⚑ and the design session answers them.
- **Status line:** `draft` → `accepted` (the designer picks it up) → `done` (the plan and PR are linked) or `closed` (with one line why). Keep the file; never delete it.
- **Where the old prompts are:** design prompts before 2026-11-01 live in the private design folder and stay there. New ones start here, in neutral wording (no real game, book or adventure names: the pre-commit scan checks).
- **Size:** one page. If it needs more, it's two intents.
