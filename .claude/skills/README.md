# .claude/skills/ — the project's skills

| Skill | From | Used at |
|---|---|---|
| `design-session` | this project | paper dry runs with Francis |
| `to-spec`, `to-tickets`, `implement-spec`, `tdd` | Matt Pocock | loop steps 2 to 4 |
| `code-review` | Matt Pocock | loop step 5. It has the same name as Claude Code's built-in review; the project's copy is the one meant |
| `retro`, `writing-for-agents` | Matt Pocock | loop step 6 |
| `improve-codebase-architecture`, `codebase-design`, `domain-modeling`, `grilling` | Matt Pocock | loop step 7 |

The loop: `docs/design/rulings/process-loop-2026-11-27.md`.

## Who starts a skill

Five of the loop's skills are **started by Francis only**: he types the command in the driver's session. Their files say `disable-model-invocation: true`: they are not in an agent's list of skills, and they cost no context until he types one. **The setting is not a lock.** In one trial, a cloud session that has the Skill tool named `to-spec`, and the tool loaded it. (The `driver` agent's own tool list has no Skill tool; that case was not tried.) So the rule is the guard: an agent does not start the five, and does not do their work by another route. The driver tells Francis which command to type when each step is ready (`.claude/agents/driver.md`, The loop).

| Francis types | When |
|---|---|
| `/to-spec` | after sitting A |
| `/to-tickets` | after the spec is written |
| `/implement-spec` | after sitting B |
| `/retro` | after the reviews of a spec |
| `/improve-codebase-architecture` | every third loop |

The other six (`tdd`, `code-review`, `writing-for-agents`, `codebase-design`, `domain-modeling`, `grilling`) are started by agents, from inside the five.

## The copied skills

- **Source:** github.com/mattpocock/skills, commit `6f7f783`, copied 2026-11-27. MIT licence: `LICENSE-mattpocock-skills.md`.
- **Left out of each:** its `agents/openai.yaml` (for another tool).
- **Changed here, and nothing else:**
  - `to-spec`, `to-tickets`, `implement-spec`, `code-review`: the line that sends the reader to the setup skill now points at `docs/agents/issue-tracker.md`.
  - `code-review`, `retro`: the standards file is named as `docs/12-coding-standards.md`.
  - `code-review`: its two sub-agents are the `reviewer` agent, and the Standards one also runs the Bugs and Rules passes of `REVIEW.md` (the project's copy replaces the built-in review, which looked for bugs).
  - `implement-spec`: an implementer is the `builder` agent, within the seat limits.
  - `grilling`: its description no longer answers to "grill"; `grill-me` is the skill for a sitting.
- **To update one:** copy it again from the source, re-apply the changes above, and change the commit here.
- **Not installed:** the setup, triage, wayfinder and router skills, and the rest of the set. Do not add one without Francis's yes (lp-3).
