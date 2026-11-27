---
status: approved at sitting B, 2026-11-27 (tickets #131 to #139)
loop: 1
rulings: docs/design/rulings/process-checks-loop-1-2026-11-27.md (atc-1 to atc-4)
mockup: none: data and logic only (no screen changes; no stored data changes)
---

# Spec: the hard-rule and size checks

Loop 1 of the build loop. It builds nine rows marked "To add" in `docs/12-coding-standards.md`, Automated checks (atc-2). The other five "To add" rows (type-aware lint, the compiler flags, `exhaustive-deps`) are a second loop after 5 December.

## Problem Statement

The hard rules in `CLAUDE.md` protect the players and the group: no AI in the app, no game IP, tokens only, integers only, no new package without a yes, no disabled buttons. Today a person or a review must find each break by reading. A review can miss one. A builder can add one without knowing. Francis cannot read code, so he cannot check these rules himself. He must trust that every pull request kept them.

Two standards have the same problem. A source file can grow past the size a fresh worker reads well. A unit test can become slow, and the check then takes longer for everyone.

## Solution

The full check (`npm run check`) and the database tests check each of these rules by machine. A pull request that adds a new break fails, with a message that names the file, the rule and the fix. This starts on the day each check merges, before 5 December too (atc-4).

Old code that already breaks a rule does not fail. Each old break is recorded as known (atc-3). The list of known breaks goes to Francis at sitting B. The list can only get shorter: when someone fixes a known break, the record of it must go too. Fixing the old breaks is a later loop.

The slow-test check only reports. It never fails the check.

The nine checks:

| # | Rule | What fails |
|---|---|---|
| 1 | Hard rule 6: modules reach core only through its public entry | A module imports a core file that is not on the allowed list |
| 2 | Hard rule 1: no AI in the app | App code imports an AI service package, or names an AI service host |
| 3 | Hard rule 9: no new package without a yes | The packages in `package.json` differ from the package list in `docs/02-architecture.md` |
| 4 | Hard rule 10: never a disabled button | A control in the app has a `disabled` attribute |
| 5 | Hard rule 7: tokens only | An inline style in a component sets a raw spacing, type or colour value |
| 6 | Hard rule 8: integers | A database column has a decimal or floating-point number type |
| 7 | Hard rule 2: the name scan | (Not a failure.) The name scan warns clearly when it has no private list |
| 8 | cs-10: a new source file over 400 lines | A source file has more than 400 lines |
| 9 | cs-34: a unit test over 300 ms | (Not a failure.) The check's output lists every unit test over 300 ms |

## User Stories

1. As Francis, I want each hard rule checked by machine, so that I do not have to trust that every review read every line.
2. As Francis, I want a pull request that breaks a hard rule to fail, so that it cannot merge by accident.
3. As Francis, I want the failure message in plain words, so that I can understand why a pull request is red.
4. As Francis, I want old breaks recorded as known, so that the new checks do not stop the work before 5 December.
5. As Francis, I want the list of known breaks at sitting B, so that I can see how much old code breaks each rule.
6. As Francis, I want the known-break lists to only get shorter, so that the old code moves toward the rules and never away from them.
7. As Francis, I want the checks to start on the day they merge, so that no new break gets in while we wait.
8. As Francis, I want no new package to be needed for these checks, so that hard rule 9 holds for the checks themselves.
9. As Francis, I want a package that is not in the list in 02 to fail the check, so that no package gets in without my yes.
10. As Francis, I want the package list in 02 to be short and plain, so that I can read what is installed and say yes or no.
11. As a player, I want the app never to send my data to an AI service, so that our table's words stay ours.
12. As a player, I want every button to be tappable and to say why when an action is blocked, so that I am never stuck at a grey button.
13. As a player, I want money, weights and slots always whole numbers, so that a purse never shows 0.30000000000000004.
14. As a player, I want calm, consistent screens, so that I look at the table and not at the tablet.
15. As a builder, I want a lint error the moment I import a core file that modules may not use, so that I fix it before I commit.
16. As a builder, I want the allowed list of core files in one place, so that I know which core files a module can use.
17. As a builder, I want to add a core file to the allowed list in a reviewed change, so that a real need is possible and seen.
18. As a builder, I want a lint error when I write a `disabled` attribute, with the fix in the message, so that I use the blocked-action pattern instead.
19. As a builder, I want a test failure when an inline style has a raw value, naming the file and the value, so that I change it to a token.
20. As a builder, I want a lint error when a new file passes 400 lines, so that I split it while the code is fresh in my mind.
21. As a builder, I want old long files to stay quiet, so that a small change to an old file does not make me split it now.
22. As a builder, I want the slow-test report at the end of the check, so that I see when my new test is slow.
23. As a builder, I want the slow-test report never to fail the check, so that a slow machine does not block my commit.
24. As a builder, I want a database test failure when my migration adds a decimal column, so that I use an integer before the migration reaches the main project.
25. As a builder, I want a check failure that names the package and which side it is missing from, so that I know whether to ask for a yes or to remove the package.
26. As a builder, I want the check to fail when I fix a known break but leave its record, so that the record stays true.
27. As a builder working locally, I want a clear warning when the name scan has no private list, so that I know my commit was not scanned.
28. As the driver, I want the name scan's warning on Dependabot pull requests, so that I scan them where the list is before I merge.
29. As the driver, I want each check to run inside the full check and the database job, so that CI needs no new job and no new minutes.
30. As a reviewer, I want the hard rules checked by machine, so that I spend my review on the judgement rules.
31. As a reviewer, I want each known-break list to say which rule it is for, so that I can see when a pull request adds to one.
32. As a fresh worker, I want source files to stay under 400 lines, so that I can read a whole file within my context.
33. As Project Review, I want the known-break counts easy to read, so that I can report the trend at each gate.

## Implementation Decisions

### Where each check lives (the seams, ruled by Francis)

Five existing seams, and no new one:

- **The lint configuration and its suppressions file.** Checks 1, 2, 4 and 8 are lint rules. The known breaks are ESLint's own suppressions file, written by ESLint's suppress-all command. ESLint is already at a version that has it.
- **The scan tests beside the design-system test.** Checks 3 and 5 are scan tests in the app's test run, beside the existing test that scans stylesheets for raw values.
- **One database test.** Check 6 is a database test over the information schema, beside the existing health tests. It runs in the database job.
- **The test runner's slow-test report.** Check 9 is a setting of the runner and a short summary in the check's output.
- **The name scan script.** Check 7 changes the existing script.

### Known breaks (atc-3)

- **Lint rules:** the suppressions file holds the known breaks. The check fails when a suppression is no longer needed (ESLint's default), so a fix must also prune the file. The file is written once per rule, when that rule is switched on.
- **Test-based checks (5, 6):** each test has a known list beside it. Check 3 has none (see "Check 3: packages equal the list in 02": an unnamed package goes to Francis, not to a list). Each entry names the file or column and the reason. The test fails on a new break, and also on a known entry that no longer breaks (so the list only gets shorter).
- **No known list for checks 7 and 9:** they do not fail.

### Check 1: modules reach core only through the allowed list

- Core has no single public entry today. Modules import 17 core files, in about 250 places.
- Decision: the public entry is an allowed list of those 17 files, held in the lint configuration. A module that imports any other core file gets a lint error.
- So check 1 starts with no known breaks.
- A new core file that a module needs is added to the list in a reviewed change. The lint message says so.
- The existing rule for the other direction (core never imports a module) stays as it is.

### Check 2: no AI service in the app

- Scope: the app's own code (the source folder), not the repository's scripts or the CI workflows.
- A banned-import list in the lint configuration: the client packages of the known AI services (OpenAI, Anthropic, Google's generative AI, Mistral, Cohere, Groq, Together, Replicate, Hugging Face inference, Ollama, LangChain, and the Vercel AI SDK), by name and by scope.
- A host scan: a lint rule that fails on a string or template literal naming one of those services' API hosts.
- Both lists sit in one place in the lint configuration, with a line that says to add a new service there.
- Check 2 is expected to start with no known breaks. If it finds one, it is a hard-rule break: it goes to Francis, not to the known list.

### Check 3: packages equal the list in 02

- Today the packages are named in the prose of 02's stack table. A script cannot compare prose reliably.
- Decision: add a short plain list to 02, under its own heading, one package per line, split into app packages and dev-only packages. The prose stays.
- A scan test reads that list and the dependencies and dev dependencies of `package.json`, and fails on any difference. The message names the package and the side it is missing from.
- The version is not compared: only the name.
- The list is first written to match `package.json` as it is. A package installed today that 02's prose does not name goes to Francis at sitting B, for a yes or a removal. It does not go on a known list.

### Check 4: no `disabled` attribute

- A lint rule that fails on a `disabled` attribute in the app's components (test files excluded).
- The message says: "Never a disabled button (hard rule 10): keep it tappable and explain why in a pop-up."
- Old cases go in the suppressions file. Fixing them is visible (a grey button becomes a tappable one with a pop-up), so it is a later loop with pictures (atc-3).

### Check 5: tokens only in inline styles

- The existing stylesheet scan is extended to inline `style` values in the app's components (test files and the component gallery's own fixtures excluded).
- A raw value: a number with a length unit (px, rem, em), a colour literal (hex, rgb, hsl, or a named colour), or a bare number on a spacing, size, type or colour property.
- Allowed: a token (`var(--…)`), a calculation made only of tokens, zero, a percentage, and bare numbers on properties that are not spacing, size, type or colour (for example flex, order, opacity, z-index).
- Old cases go in the known list beside the test, one entry per file and property.

### Check 6: no decimal or float column

- A database test over the information schema of every schema the app's migrations create.
- It fails on any column of a table or view with type `real`, `double precision` or `numeric`.
- The generated database types cannot show this: they type every number the same way.
- Decision: the test bans all such columns, not only money, quantity, weight and slot columns. The app has no other use for them today. A real future need goes on the known list with its reason, in a reviewed change.

### Check 7: the name scan says so

- On a pull request from this repository on GitHub, the scan already fails when the private list is missing. That stays.
- Locally and on Dependabot, it passes and prints one plain line. Decision: make it a warning that stands out in the check's output, and on GitHub a warning on the run's summary page. It still passes.

### Check 8: no source file over 400 lines

- A lint rule: 400 lines at most, counting every line.
- Excluded: test files, the generated database types, and generated docs.
- About 80 source files are over 400 lines today. They go in the suppressions file.
- A known long file that grows stays quiet: the suppression covers the file, not its size. Splitting the old files is a later loop.

### Check 9: the slow-test report

- The runner's slow-test threshold is set to 300 ms.
- At the end of the full check, a short summary lists each unit test over 300 ms with its time, slowest first, and the count.
- It never fails the check.

### Where each check runs (atc-4)

- Checks 1 to 5, 8 and 9 run inside `npm run check`, locally, in the commit hook and in the GitHub check job.
- Check 6 runs in the database job.
- Check 7 runs where the name scan already runs.
- No new CI job.

### Docs in the same pull requests

- Each row's "To add" in `docs/12-coding-standards.md` becomes "On", with where it runs.
- `docs/testing.md` names the new checks where it lists what the check runs.
- A line in `docs/09-decisions-log.md` for each technical choice above (tag `[process]`).

## Testing Decisions

- A good test here checks what a person sees: a planted break fails with the right message, clean code passes, a known break passes, a fixed-but-still-listed break fails. It does not test the lint configuration's shape or a regular expression on its own.
- Each lint rule gets a test that lints a small planted file with the project's own configuration and checks the error and its message. Prior art: the tests of the repository's own scripts in the app's test run.
- Each scan test (checks 3 and 5) gets planted-input cases for the scan function, plus the real scan over the repository. Prior art: the design-system test's stylesheet scan.
- The database test (check 6) runs against the local database in the database job, like the existing health tests. A planted case: a temporary table with a decimal column, created and dropped inside the test.
- The name scan (check 7) gets cases for each place it runs: list present, list missing locally, list missing on GitHub with the required flag. Prior art: the name scan's existing tests.
- The slow-test report (check 9): a test of the summary function with planted timings; no slow test is planted in the real run.
- Each test's purpose is written first as a plain sentence (`CLAUDE.md`, Testing).
- No test uses game names, rules text or numbers (hard rule 2). Planted examples are invented.

## Out of Scope

- The second loop after 5 December: type-aware lint, `noImplicitOverride`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, and `exhaustive-deps` as an error (atc-2).
- Fixing any old break. That is a later loop. The disabled buttons go first, with pictures (atc-3).
- A single public entry file for core. The allowed list stands in for it.
- Comparing package versions.
- Any screen change, any change to stored data, any migration.
- Any new package.

## Further Notes

- The counts of known breaks per check are measured by each row's builder and put in its pull request's text. The driver gathers them for Francis at sitting B (atc-3).
- Checks 1, 2, 4 and 8 all edit the lint configuration and the suppressions file. They share files, so they are one batch of at most three rows, or two batches one after the other.
- ESLint's suppressions file is new to the repository. Its count per rule is the number Project Review reports.
