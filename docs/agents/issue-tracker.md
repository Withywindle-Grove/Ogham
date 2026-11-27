# Issue tracker: a spec file and GitHub issues

Read by the loop's skills (`to-spec`, `to-tickets`, `implement-spec`, `code-review`). Ruled 2026-11-27 (lp-4, `docs/design/rulings/process-loop-2026-11-27.md`).

## The split

- **A spec is a file:** `docs/specs/<name>.md`, committed on the spec's branch. Francis reads its plain-language part at sitting B.
- **A ticket is a GitHub issue** in `Withywindle-Grove/Ogham`. The pull request closes it.

## When a skill says "publish to the issue tracker"

- **For a spec:** write `docs/specs/<name>.md` and commit it. Then create one parent issue titled `Spec: <name>` whose body is the path of the file and nothing else.
- **For a ticket:** create one issue, as a sub-issue of the spec's parent issue.

## Conventions

- **Tools.** In a cloud session there is no `gh` command: use the GitHub tools (`mcp__github__issue_write`, `issue_read`, `sub_issue_write`, `list_issues`, `add_issue_comment`). On the PC, `gh issue …` does the same.
- **Label.** A ticket ready to build carries `ready-for-agent`. No other triage label is used.
- **Blocking.** Use GitHub's native "blocked by" link where the tool offers it. If it does not, the first line of the ticket's body is `Blocked by: #<n>, #<n>`. A ticket is startable when every blocker is closed.
- **Close.** A ticket closes when its work merges into the spec's integration branch: comment with the commit, then close. The parent issue closes when the spec's pull request merges.
- **Never** file an issue in another repository.

## A ticket's size (lp-6)

A ticket must fit one fresh worker of about 150,000 tokens, its reading included. So every ticket:

- names the sections of the spec it implements, by heading;
- names the parts of `docs/` it needs by file and heading, never a whole file (`docs/05`, `06`, `09` and `testing.md` are each too large to read whole);
- names its mockup's file and approval date, or says "none: data and logic only" (mockups first);
- carries `Row: <issue number>` as the first line of its worker's brief.

## What a ticket never does

A ticket does not change approved behaviour or a screen without a mockup Francis has approved. If it would, the worker stops and writes a scope check (`docs/08-roadmap.md`, "Scope checks").
