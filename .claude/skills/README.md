# .claude/skills/ — the project's skills

| Skill | From | Used at |
|---|---|---|
| `design-session` | this project | paper dry runs with Francis |
| `to-spec`, `to-tickets`, `implement-spec`, `tdd` | Matt Pocock | loop steps 2 to 4 |
| `code-review` | Matt Pocock | loop step 5. It has the same name as Claude Code's built-in review; the project's copy is the one meant |
| `retro`, `writing-for-agents` | Matt Pocock | loop step 6 |
| `improve-codebase-architecture`, `codebase-design`, `domain-modeling`, `grilling` | Matt Pocock | loop step 7 |

The loop: `docs/design/rulings/process-loop-2026-11-27.md`.

## The copied skills

- **Source:** github.com/mattpocock/skills, commit `6f7f783`, copied 2026-11-27. MIT licence: `LICENSE-mattpocock-skills`.
- **Left out of each:** its `agents/openai.yaml` (for another tool).
- **Changed here, and nothing else:**
  - `to-spec`, `to-tickets`, `implement-spec`, `code-review`: the line that sends the reader to the setup skill now points at `docs/agents/issue-tracker.md`.
  - `code-review`, `retro`: the standards file is named as `docs/12-coding-standards.md`.
- **To update one:** copy it again from the source, re-apply the two changes above, and change the commit here.
- **Not installed:** the setup, triage, wayfinder and router skills, and the rest of the set. Do not add one without Francis's yes (lp-3).
