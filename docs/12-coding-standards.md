# 12 — Coding standards

Ruled 2026-11-27 (lp-9, `design/rulings/process-loop-2026-11-27.md`). The sources are at the end.

## How to use this file

- **The reviewer reads it** (loop step 5, the `code-review` skill, with `REVIEW.md` and the hard rules in `CLAUDE.md`). A builder does not read it: a builder has the least room in its context, and the checks below stop its mistakes.
- **A machine checks what a machine can check.** A rule with a fixed pattern (a banned import, a flag, a size) is an automated check, in "Automated checks" below. This file keeps the rules that need judgement.
- **A finding names its rule** by id (`cs-7`). A rule here is a judgement call unless it also breaks a hard rule; `REVIEW.md` says what counts as Important.
- **The target is higher than today's code.** The rule for old code is cs-2.
- **To change a rule:** the retro (loop step 6) proposes it; Francis picks by number. First ask: can a check do this instead?

## Scope of a change

| Id | Rule | Why |
|---|---|---|
| cs-1 | **The smallest change that delivers the ticket.** No option, parameter, layer or helper for a need the spec does not have | Code for a guessed future is paid for now and is usually wrong (Fowler: Speculative Generality) |
| cs-2 | **New and changed code meets this file. Old code is not a finding** unless the change makes it worse. A ticket does not tidy code outside its scope; tidying is its own ticket, from the architecture pass | A mixed change hides the behaviour change from the reviewer, and one ticket must fit one worker |
| cs-3 | **Make the change easy, then make the easy change.** A refactor that prepares a ticket is a separate commit with no behaviour change, before the behaviour commit | Each commit can be checked by itself (Fowler, Beck) |
| cs-4 | **Fix the cause, not the symptom.** A special case added at the place a bug showed up needs a reason why the cause cannot be fixed | Symptom fixes pile up as cases nobody can explain (Hunt and Thomas) |

## Modules

| Id | Rule | Why |
|---|---|---|
| cs-5 | **A module is deep:** a small interface over much behaviour. Ask the deletion test: if this module were deleted, would its complexity vanish, or only move to its callers? If it would vanish, the module is shallow: merge it | A shallow module adds an interface to learn and hides nothing (Ousterhout) |
| cs-6 | **A module hides one decision.** A change to a storage shape, a rule or a format touches one module. The same knowledge in two modules is a finding | One decision in two places is changed in one and forgotten in the other (Ousterhout: information leakage; Hunt and Thomas: DRY is about knowledge, not text) |
| cs-7 | **Duplicated text is not always duplicated knowledge.** Two pieces of code that look alike but change for different reasons stay apart. Extract on the third real use, not the second | A wrong shared helper couples things that should move apart |
| cs-8 | **The interface is the test surface.** Tests call a module the way its callers do. A function exported only so a test can reach it is a finding | Such tests break on every refactor and miss the bugs in how the parts are joined |
| cs-9 | **Complexity goes down, not up.** A module takes the hard case itself; it does not hand its callers a flag, a mode or a step they must remember | One module is fixed once; many callers are each a chance to be wrong (Ousterhout) |
| cs-10 | **A new source file stays under 400 lines; a function does one thing at one level.** A file that passes 400 is a prompt to find the second module in it, not to cut it in two at a line | An agent reads a file whole. Two screens here are over 3,000 lines, about 30,000 tokens for one read |
| cs-11 | **Dependencies point one way:** `app` and `ui` use `modules` and `core`; `modules` use `core` through the registry; `core` uses none of them (hard rules 3 and 6) | The checks cover part of this; the rest is judgement until they cover all |

## Types

| Id | Rule | Why |
|---|---|---|
| cs-12 | **A state that cannot happen cannot be written.** Use a union with a tag, not a set of optional fields and booleans that only make sense in some combinations | The compiler then finds every place a new state must be handled |
| cs-13 | **Check data where it enters, once.** Data from the database, the network, storage, a pack file or the URL is checked and given its type at the edge. Past the edge, code trusts the type | A check in the middle means the type before it was a lie |
| cs-14 | **No `as` cast and no `!` to silence the compiler.** Narrow with a check, or fix the type. `as const` and `satisfies` are fine. A cast that must stay has a comment that says why it is true | A cast turns a compile error into a fault at the table. A search finds about 960 casts outside tests and about 990 `!` in all today |
| cs-15 | **A `switch` or `if` chain over a union handles every member**, with no `default` that swallows a new one | A new member must fail the build, not fall through |
| cs-16 | **A domain value has a domain type.** An id of one kind is not passed where another kind is wanted; an amount is an integer (hard rule 8) | Two strings in the wrong order compile (Fowler: Primitive Obsession) |
| cs-17 | **No `any`, no `@ts-ignore`.** `unknown` and a check. `@ts-expect-error` only in a test that proves a type error, with a reason | The code has almost none today; keep it so |

## Names and comments

| Id | Rule | Why |
|---|---|---|
| cs-18 | **A name says what the thing is or does, in the domain's words** (`docs/04`, the glossary). If no honest name comes, the design is unclear | A reader, human or agent, finds code by its name (Fowler: Mysterious Name; McConnell on names) |
| cs-19 | **A comment says what the code cannot:** why, a limit, a ruling's id. It does not repeat the code, and it does not tell the history; history is in git and `09` | A comment that repeats the code goes stale and is then wrong |
| cs-20 | **A test's purpose is one plain sentence, written first** (`docs/testing.md`) | It is what the reviewer checks the test against |

## Errors and state

| Id | Rule | Why |
|---|---|---|
| cs-21 | **Design the error away where you can.** Prefer an operation that is always valid (a delete of a missing thing does nothing) to one whose callers must each handle a failure | Fewer failure paths, fewer of them untested (Ousterhout) |
| cs-22 | **A failure is never swallowed.** A caught error is handled, shown to the person in plain words, or passed on. An empty `catch` and an unawaited promise are findings | A lost write at the table is the worst fault this app can have |
| cs-23 | **One source for each fact.** Do not keep in state what can be computed from other state or from the events | Two copies drift; the event log is the truth (hard rule 4) |

## React

| Id | Rule | Why |
|---|---|---|
| cs-24 | **A component and a hook are pure:** the same inputs give the same output, and rendering changes nothing outside | React may render twice or out of order (Rules of React) |
| cs-25 | **An effect is for a system outside React** (a subscription, the network, a timer). Not for a value derived from props or state, and not to pass data between components | Derived state in an effect renders twice and goes out of step |
| cs-26 | **No `eslint-disable` of a hooks rule** without a comment that says why the rule is wrong here | 34 exist today; each is a possible stale value |
| cs-27 | **A screen composes the listed components** (`06`, Components) and never rebuilds one | The project's own rule; said here so the reviewer cites one id |

## Database

| Id | Rule | Why |
|---|---|---|
| cs-28 | **Each access rule has a test for each role and each operation, and always the other-user case** (a player reading another player's row) | Hard rule 5. A rule that is too open returns rows quietly; only a test from the wrong role shows it |
| cs-29 | **A test never passes because a policy was loosened.** Change the test or the code, and say which in the pull request | The policy is the thing under test |
| cs-30 | **A policy names its roles (`to`), filters on an indexed column, and wraps a call such as `auth.uid()` in `(select …)`** where the result does not depend on the row | Supabase's guidance: the call then runs once for the statement, not once for each row |
| cs-31 | **A migration is forward only and built on the newest version of the function it replaces** (`docs/testing.md`; the lineage check) | The project's own rule; said here so the reviewer cites one id |

## Tests

| Id | Rule | Why |
|---|---|---|
| cs-32 | **A test checks behaviour through the interface,** not how the code is built. It fails when the behaviour breaks and passes through a refactor | Otherwise the tests are a cost on every change and a guard on none |
| cs-33 | **Use the highest existing seam.** Prefer a test at a place the code is already tested from. A new seam needs a reason | Fewer seams, fewer stand-ins to keep true (Feathers) |
| cs-34 | **A unit test is fast and alone:** no network, no real clock, no order it depends on, no state left for the next. One slower than 300 ms is reported by the runner and needs a reason | A slow suite is run less, by people and by agents |
| cs-35 | **A test file asks for a browser environment only if it draws something.** Logic is tested as logic | The browser stand-in costs 200 to 500 ms for each file that loads it |
| cs-36 | **A stand-in is checked against the real thing.** A change to the fake database (`src/testing/fakeDb.ts`) names the migration or database test it mirrors | A fake that drifts makes green tests mean nothing |

## Automated checks

"On" is checked today. "To add" is a ticket; the first loop builds the hard-rule and size-and-speed rows, and the type-aware lint, compiler-flag and `exhaustive-deps` rows wait for a second loop after 5 December (atc-2, `design/rulings/process-checks-loop-1-2026-11-27.md`); none needs a new package unless the row says so. Each "to add" will show old code that does not comply. That list goes to Francis before any refactor. For a lint rule, old cases are recorded as known and only new ones fail (ESLint's own `--suppress-all`, which writes `eslint-suppressions.json`). A compiler flag has no such list: it is switched on only when the code passes it, so each flag is a ticket that fixes its cases first.

| Check | Covers | State |
|---|---|---|
| `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` | cs-12 to cs-17 in part | On (`tsconfig.json`) |
| Screens cannot import the database client or call it | Hard rule 3 | On (`eslint.config.js`). It matches the names `db` and `supabase` only |
| `src/core` cannot import `modules` | Hard rule 6, one direction | On |
| Tokens only in `.css` files; contrast in both themes | Hard rule 7 | On (`src/ui/designSystem.test.ts`) |
| Every command has a permission case; logged commands match the table | Hard rule 3 | On |
| Access rules from each role | Hard rule 5, cs-28 | On (`supabase/tests`) |
| Migration lineage; applied migrations not edited; a `fix-` branch's tests | cs-31 | On (scripts and hooks) |
| Type-aware lint: `strictTypeChecked`, plus `no-unsafe-type-assertion` and `switch-exhaustiveness-check` | cs-14, cs-15, cs-17, cs-22 | In part. On: `no-floating-promises` and `no-misused-promises` (cs-22; `eslint.config.js`, with `projectService`; retro of loop 3, 2026-11-28). Their 63 old cases are known in `eslint-suppressions.json`. Lint took about 1.75 times as long. To add: the rest of `strictTypeChecked` and the two named rules. They are in the installed package. Pin the package version first: this rule set may change in a minor release |
| `noImplicitOverride`, `verbatimModuleSyntax`, `erasableSyntaxOnly` | cs-12 to cs-17 | To add. Expected cost: small (6 classes; no enums) |
| `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature` | cs-12, cs-13 | To add after a trial. Expected cost: large, in the generated database types (1,656 optional properties) |
| Hooks rule `exhaustive-deps` from warning to error | cs-26 | To add |
| `modules` reach `core` only through its public entry | Hard rule 6, the other direction | On (`eslint.config.js`, `no-restricted-imports` on `src/modules`, tests included; in `npm run check`). The public entry is the allowed list `ALLOWED_CORE_FILES` there; a new one is added in a reviewed change |
| No AI service package or host in the app | Hard rule 1 | On (`eslint.config.js`, the project's own rule `tome/no-ai-service`; in `npm run check`). App source (`src/**/*.{ts,tsx}`, its tests included); scripts and CI workflows are not checked. Fails an import (or re-export, or `import()`) of a listed AI client package or a package under a listed scope, and a listed API host in a string or template literal; the one list is `AI_SERVICES` there, where a new service is added. No known break, and none may be recorded: a break goes to Francis, and a test (`scripts/lint-hard-rules.test.mjs`) fails on any `tome/no-ai-service` record in `eslint-suppressions.json` |
| `package.json` dependencies equal the list in `02` | Hard rule 9 | On (`src/ui/packageList.test.ts`, inside `npm run check`). Names only, not versions; the list is `02`, "Packages" |
| No `disabled` attribute on a control | Hard rule 10 | On (`eslint.config.js`, the project's own rule `tome/no-disabled`; in `npm run check`). App components (`src/**/*.tsx`), tests excluded |
| Tokens only in inline styles in screens | Hard rule 7 | On (`src/ui/designSystem.test.ts`, inside `npm run check`). Reads every `style={…}` in the app's components, tests and the gallery excluded; old cases go on `src/ui/inlineStyles.known.ts` (none when switched on) |
| No decimal or float column (`real`, `double precision`, `numeric`) in any table or view | Hard rule 8 | On (`supabase/tests/float-columns.test.ts`, in the database job; known list beside it, empty) |
| A new source file over 400 lines | cs-10 | On (`eslint.config.js`, the project's own rule `tome/max-lines` at 400, every line counted; in `npm run check`). App source (`src/**/*.{ts,tsx}`) and scripts (`scripts/**/*.{js,mjs}`); test files and the generated database types excluded; stylesheets are not checked (lint does not read CSS without a new package). The old long files are known in `eslint-suppressions.json`; a known file that grows stays quiet |
| A unit test over 300 ms | cs-34 | On (reported, never a failure: `slowTestThreshold` 300 in `vite.config.ts`, and the reporter `scripts/slow-tests.mjs`, beside Vitest's own, saves each test's time; the last step of `npm run check`, after the build, prints the count and the slowest 20, and `node scripts/slow-tests.mjs --all` lists them all) |
| The name scan says so when its private list is absent | Hard rule 2 | On (`scripts/check-names.mjs --pr`, where the scan already runs: the changes job, or by hand). Without its list it still passes, with a warning: on GitHub (a fork or Dependabot) a warning on the run's summary page, elsewhere a framed WARNING in the output; with `GRIMOIRE_NAMES_REQUIRED=true` (our own pull requests) a missing list fails, as before |

## Speed of the checks

Today, from the repository's own notes, not measured for this file: the full check takes 3 to 6 minutes on the PC and 12 to 18 minutes on GitHub; the type check takes about 7 seconds; the build runs the type check a second time.

1. Measure first: the runner's `Duration` line and `vitest doctor`.
2. Then set a budget for the unit suite in this section, and fail the check past it.
3. Likely gains, in order of cost: remove the second type check from the build; run only the tests related to the changed files while building a ticket (`vitest related`), the full suite once for each batch; try the suite without isolation between files where the tests allow it.

## Sources

Books: John Ousterhout, *A Philosophy of Software Design*; Martin Fowler, *Refactoring* (2nd edition); Andrew Hunt and David Thomas, *The Pragmatic Programmer*; Steve McConnell, *Code Complete*; Michael Feathers, *Working Effectively with Legacy Code*.

Documentation, read 2026-11-27 from each project's own source for the installed version: typescript-eslint 8.71.2 (shared configurations, typed linting, the rules named above); TypeScript (the tsconfig reference); Vitest 5.0.5 (improving performance); React (Rules of React); eslint-plugin-react-hooks 7.1.1; ESLint 10.13.0 (`no-restricted-imports`, bulk suppressions); Supabase (testing row-level security; row-level security performance); Claude Code (best practices; memory).

Not verified: the live documentation sites could not be reached from the session that wrote this file, so the text was read from each project's source repository. No lint run and no test run was made; every count above is a search count, and every cost is an estimate.
