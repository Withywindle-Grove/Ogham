# Pack-building playbook

How we turn a book Francis owns into a pack the app can use, and how we find out what the app can't yet model. It goes alongside `SKILL.md`: the skill says who does what, and this playbook says how a job goes from start to finish and what we've learned. Where this and `docs/07-content-packs.md` differ, 07 wins. IP-clean: invented examples only, and neutral pack IDs (listed in `docs/00-start-here.md`, Where things are).

## 0. The job in one line

Survey → fit check → plan the stages → build with scripts → check → import test → gap register → hand over. Every stage leaves a file behind so the next agent can pick it up.

**Names (ruled 2026-10-30).** At intake, ask "What's this source called?", pre-filled from the PDF's title, and slug it (add an edition or publisher suffix if two sources clash). The private files carry that source slug (SKILL.md, Before you start, step 2; 07 §18, File names):

| File | Where and name |
|---|---|
| The pack | `packs/<source-slug>/<source-slug>-<version>.pack.json` |
| Build candidates | `packs/<source-slug>/build/<source-slug>-candidate-<version>.pack.json` |
| A conversion | `conv-<from-slug>-to-<to-slug>-<version>.pack.json` |
| Reports (gap report, changelog) | Beside the pack: `GAP-REPORT.md`, `CHANGELOG.md` |

`meta.id` stays the neutral alias; the real name lives only in the file names and `meta.name`. The repo (docs, register rows, tests) uses the neutral alias.

## 1. Survey (before any conversion)

Write `packs/<source-slug>/build/SURVEY.md`:
- What the source is, answering three questions. These decide the work; size and audience don't.
  1. **Rules or places?** Rules make a v2 pack (setting or homebrew); an adventure with locations makes a v3 pack.
  2. **Stand alone, or lean on another pack?** A setting-agnostic book needs nothing else. A supplement built for one system (a single class, say) depends on that setting's XP, saves and sheet, so it lists that pack in `meta.requires`. A book can be partly each.
  3. **Add, change or decorate?** See §6. One book can do all three.
- Who sees what, entry by entry (player-facing, GM-only, mixed). This goes on each entry through `gmOnly` and visibility, not on the pack as a label.
- A chapter map with page ranges, and how many entries each kind has (classes, spells, items, stat blocks, tables, options, places).
- The rules that touch the app's systems: time, light, encumbrance, initiative, morale, death, naturals, XP, spells, hirelings.
- Anything that looks unusual, like an odd die, a nested table, a rule that depends on level, a secret roll, or a monster in several parts.

## 2. Fit check (the step that matters most)

Go through every rule and data shape from the survey against what the app and 07 support today. Mark each one:

| Mark | Means | Action |
|---|---|---|
| ✅ | Fits the current format and app | Convert it |
| 🟡 | Needs a format extension, no app change | Draft it in `meta.proposedExtensions`, add a register row, and get a ruling before keeping it |
| 🔴 | Needs an app or data-model change | Keep it as text (a note or a rules entry), add a register row with a suggested release |
| ⚪ | Out of scope (domain play, campaign state, flavour) | Leave it out and note the reason |

Write the result to `packs/<source-slug>/GAP-REPORT.md`, in a table for each system (Characters, Options, Encumbrance, Time and light, Fights, Magic, Hirelings and money, Referee material). It's private, because it names the book's rules.

Then copy every 🟡 and 🔴 into **`docs/11-modelling-gaps.md`** in neutral words: describe the mechanism, not the book. Write "movement set by worn armour weight rather than carried weight", not the book's rule name. Before adding a new row, check whether an existing one already covers it; if so, add the pack's neutral ID to its Seen in column. The register is how gaps reach the roadmap: the design agent reviews it and moves rows into a release or the parking lot.

**Rule:** never invent a field when an existing shape fits, and never keep an unregistered field. Every field 07 doesn't define appears in both `meta.proposedExtensions` and the register.

## 3. Plan the stages

Write `packs/<source-slug>/job.md`, following SKILL.md step 1. Big books build in **stages**, with one system group per stage and a version bump per stage (0.1 classes and races, 0.2 magic, 0.3 bestiary, and so on). Each stage ends with a checker pass and an import test. Write the plan as a short table: stage, kinds, pages, owner, status.

## 4. Build with scripts, not by hand

- Every extraction and every fix is a **script** in `packs/<source-slug>/build/`: `extract_*.py` reads the source, `*_build.py` shapes the entries, `merge.py` or `assemble_*.py` joins them, and `fixes_vNNN.py` handles each later correction. Re-running the chain must rebuild the pack.
- Each build writes `build/<source-slug>-candidate-<version>.pack.json`; the live pack is `<source-slug>-<version>.pack.json`, beside `build/`.
- If a direct edit to the pack JSON can't be avoided, list it in `CHANGELOG.md` (beside the pack) with its version and what changed, so the next rebuild can fold it into a script.
- Paths go at the top of each script as constants (`SRC`, `OUT`), never written into the code: older scripts point at container paths and need editing before they run on the PC.
- Raw book text never goes into `build/`, only scripts, notes in our own words, and fragments.
- After each stage, put a zip of `build/` on Drive (`Test Files/build/`), because the folder is git-ignored and not backed up any other way.

## 5. Check

Run these on every stage, in order, and save the output to `packs/<source-slug>/check.txt`:
1. `npm run pack:check -- <pack>`: counts, entries left out and why, and what the editor will flag. The goal is nothing left out. The only accepted "unknown kind" warnings are kinds listed in the register.
2. Adventures: `check_adventure.py` with `--id-plan` and `--other-pack`.
3. Links: every `*Id`, `*Ref` and `links[]` resolves (for overlays and conversions too, across packs).
4. The copy check: `copy_check.py --text`, for information only: private packs may keep the book's exact wording (ruled 2026-11-03, [ip]).
5. **Build every class:** make a level 1 character of each class in the app (or the pack:check simulation, once it exists) and level each one up once. This catches broken progressions, missing XP tables and spell-slot gaps.
6. **Import test:** Rules library → Import a file on the test site. The counts in the preview must match check.txt.
7. A fresh reviewer agent, using the coverage report (adventures always; setting packs at the end of each big stage).

## 6. Mechanisms: add, change, decorate

- **Add:** new entries (classes, items, stat blocks, tables, options). This is an ordinary v2 pack. If the entries rely on another pack's rules, list it in `meta.requires`.
- **Change (conversion pack, `conv-A-to-B`, file `conv-<from-slug>-to-<to-slug>-<version>.pack.json`):** maps one setting's content onto another setting's rules, such as classes, max levels and saves. An empty `classMaxLevels` means no limit, and the empty value is deliberate. Only what changes goes in the pack; everything else comes through the references.
  A change to another pack's rules set that isn't a full conversion is a rules patch (register G-06).
- **Decorate (overlay pack, `meta.kind: "overlay"`):** adds behaviours, modifications and tables to stat blocks in another pack without copying their numbers (`keepNumbers: true`). Every `links[]` entry names `packId`, `statBlockId` and `behaviourId`, and a check fails if any link doesn't resolve. Build it in stages like a setting pack, and ship a preview page (`overlay-preview.html`) so Francis can judge the behaviours before importing.
- **Rules overlay (`meta.kind: "homebrew"` or `"setting"` with `meta.requires` and no rules set of its own, or a stub one):** house rules, classes, spells, items, tables, trait lists, conditions, GM panels and drop-in `locations` on top of another setting pack (07, "Format additions from the zine-compendium survey"). `meta.requires` is the only link (no `meta.overlays`); `meta.sources[]` (`{ part, pages, kinds }`) says which part of a growing source each stage came from. A plain `itemId` on a kit or trait-list line may name the required pack's item; `pack:check` resolves ids against this pack and stays quiet about the rest when `meta.requires` is set. **After a ruling,** re-shape the pack in one scripted pass (a `reshape.py` the merge script calls last, so later stages come out right), empty `meta.proposedExtensions` of what the ruling settled, and record the mapping in GAP-REPORT.md.
- **Note, homebrew test pack:** invented content that exercises a feature, such as tables with a `use` tag or slot encumbrance. This is the only kind of pack whose content could ever be copied into tests.

## 7. Hand over

Use SKILL.md step 9, then also:
- update the private pack index in `packs/README.md` (neutral ID, folder, version, kind, one line on what's in it, checker status);
- add the version and changes to `CHANGELOG.md` (beside the pack);
- confirm the register rows were added, and list their IDs in the hand-over message.

## 8. Lessons learned

These are things that went wrong once. Add to this list whenever something new goes wrong.
- **Line-break hyphens:** text pulled from a PDF splits words at line ends ("weap-on"). Run a de-hyphenation pass and check by searching for `[a-z]-[a-z]` inside names.
- **Hidden fields:** cursed or secret properties go in `gmOnly` fields, including the armour value of a cursed item. Check that the player view of each magic item reveals nothing.
- **Stacks:** items carried in numbers need `unitName` and `pluralName` ("arrow", "arrows"), or the app shows "3 Arrows of arrows".
- **Default race:** settings without races still set `rulesSets[].defaultRace`, or character creation asks a question that doesn't apply.
- **Rules behind numbers:** death, morale and natural-roll rules go in the structured fields (`death`, `morale`, `naturals`), not in prose notes, or the app's prompts can't use them.
- **Dice that aren't dice:** read a composite die (d4 and d10 read as tens and units) as one table with a `key` per row. Don't split it into two tables.
- **Level formulas:** use the tiny formula language (`6 + level`). Anything beyond it stays as text, and the user types the number.
- **Tables:** tag each table with its `use` (tactics, crit, fumble, encounters) so the fight screen can offer it.
- **Starting-spell tables (ruled 2026-11-02, fs-1 … fs-3):** any table a class's `spellcasting.firstSpells.rollTable` names gets `"gmOnly": false` (players roll on it at creation) and `spells: [ids]` on every row (a whole-book row lists every spell of the book). A class that rolls on two tables writes `rollTable` as a list, one roll per table. Write the flag on those tables and on no other; `pack:check` warns on both.
- **Routes:** a day-by-day mode writes `movement.routes` (`{ id, name, cost?, column?, note? }`), never `roads` or `tracks`; the lost check's `routeType` lines name those ids.
- **Unknown kinds:** a kind the checker doesn't know is either registered and awaiting a ruling, or removed. Never ship one unexplained.
- **Container paths:** scripts written in the cloud container have `/home/claude/...` paths, so fix them before running locally.
- **Copy check:** information only (ruled 2026-11-03). Rules text should be exact; keep the book's wording where it carries the rule.
- **Looks and one-liners (2026-11-01, M5 gate B1 and B2):** every `contents[]` and `hazards[]` entry gets a player-safe `appearance` from the book's description (what the party sees before the stat line or the trigger matters; a hazard with nothing to see gets none), and every table gets a one-line `description` with a `note` on each row where the book gives one. The app shows rooms to players piece by piece and lists tables with these lines; a pack without them shows bare names.

## 9. Source: a rulings export

The app's **Export rulings** (on the log's Rulings filter, M9) gives a Markdown file built for this skill. Its header names `source: rulings`, the campaign, the date range, and the campaign's homebrew pack `meta.id` and version; then one block per ruling with a stable id (`ruling-<date>-<n>`), date, session, who noted it, and the text.
- **Fit check each ruling** (§2): can the pack express it (a field, an option, a hook, a table row, a note)?
- **Update the named homebrew pack** (the `meta.id` in the header) with the ones that fit, and bump its version.
- **Rulings the format can't express** go to `docs/11-modelling-gaps.md`, in neutral words, like any other gap.
- **List which ruling ids were applied** in the hand-over (and in the `CHANGELOG.md` beside the pack). Ids repeat on re-export, so a later export shows which rulings are new.

## 10. Source: a GM's plain request (planned, R1; scope added 2026-10-30)

Planned work, skill only (no app change); the in-app guided version stays in R2 (Guided pack conversion, `docs/08-roadmap.md`). A GM often wants one small change between sessions, in plain words (invented example: "let a player have a two-headed goat as a pet"). Expect many of these, made during downtime and between sessions.
- **Ask the follow-up questions that matter**, and only those: what kind of entry it is (item, creature, ability, rule, table); its numbers and rules text, in the GM's own words; which setting it extends; any optional rule that gates it (`onlyWithOption`); and who can see it (players, or the GM only).
- **Write a small homebrew pack** (format `tabletop-pack`, `"formatVersion": 2`, kind `homebrew`), its file named after the request's subject per the naming rule (§0, Names; for the example, `two-headed-goat-<version>.pack.json`), ready to import into the campaign.
- **Check it:** the output passes `npm run pack:check` before hand-over.

## Review standard (ruled 2026-11-03)
**Repeats on rolled kits** (bq-1, 2026-11-03): a kit roll made more than once allows the same row twice by default. Where the book says the results must differ ("two different", "re-roll duplicates"), set `distinct: true` on that roll. Search the book's kit text for those words on every conversion.

Follow `docs/plans/pack-review-method.md` for every new pack and every update: values by script, book × pack × app, passes until clean, then the `pack-reviewer` re-check in a fresh session. Kit and entry quantities count bundles (the app multiplies qty by the item's `bundle`).

## 11. Book text: what is the book's words and what is ours (method 2026-11-05)

Ruled 2026-11-03: in setting and homebrew packs, **rules text is the book's exact words; app text is the pack's own.**
- **Rules text** (word for word): `notes`, `note`, `text`, `result` and `effect` on classes, abilities, races, spells, items and their `properties`, stat blocks, options, conditions, trait lists, rules-set panels and every table cell. A rule printed in several places may be joined into one text, in the book's order, when every sentence is the book's.
- **App text** (our words, short, true to what it describes): `blurb`, a table's `description`, the creation steps' `why` and `help`, and `meta.notes`. Never present a paraphrase as the rule.
- Values (dice, ranges, costs, weights, levels) are always the book's.
- **The whole rules prose** (ruled 2026-11-05): every rules paragraph the book prints is in the pack, not only the rules the app reads: in the rules set's sections where the format has a home, else in reference panels (`gmReference`, player-readable unless GM-only in the book), grouped by the book's chapters and headings. The scorecard (below) measures it.

**Extracting text from a PDF's text layer:**
- **Page numbers:** a number-only line is a page number only at the page's edge (first or last three non-empty lines) and close to the page's own number. Anywhere else it is table data (a round, a count, a die face). Dropping every bare number once deleted a table's numbers.
- **Hyphens:** a soft hyphen (U+00AD) is a line-end break: join the word with no space. A hard hyphen at a line end is usually also a break, but check compound words ("ten-foot") against the rest of the book.
- **Drop caps:** the first letter of a section may sit apart from its word; rejoin it.
- **Two-column pages and tables:** the text layer can read across columns or down a table out of order. Render the region (`page.get_pixmap(clip=rect, dpi=130)`) and read it when cells don't line up.
- **Sidebars:** a table in a sidebar becomes a pack table, not text pasted into the nearest entry.
- **No bleed:** an entry stops at the next entry's name, a section heading, a credit line or a chapter break. Check the last sentence of every entry; leaks once carried a whole chapter into one spell.
- Parse entries from the book's table of contents (name and page) rather than guessing headings from type size.
- **Cut entries by the book's headings** (font size and face from the PDF), not by the next known name: an entry ends at the next item, a category's general section, a chapter, a table heading or a variant printed as its own heading inside the entry. Lines printed under an entry's table are that table's notes, not the entry's parts. Re-checks found whole chapters inside one item when this was skipped.
- **Every string is in scope:** list items (a class's restrictions, procedure steps) and short rules lines too, not only `notes`/`text`. Table cells in every form: `values`, a single `value`, short `result`s, column headings (each by its position in the list).
- **Rolled tables keep their ranges:** when the book prints several columns, keep `min`/`max`/`result` and give the printed columns as each row's `cells`; never turn a rolled table into a lookup.
- **Changes the app reads:** before rewording a cell, check whether the app or another field matches its words (encounter columns, `next.byColumn` keys, kit lines); keep those and record why.

**The scorecard** (`book_units.py` → `map_units.py` → `score.py`, with `triage_list.py`): the book as printed units, each mapped to the pack, scored by script; misses graded big or small; every unit left out has a written reason in the triage file. A pack is done at 100% carried and 0 unexplained misses. It replaces open-ended re-checks: reviewers check the triage and sample the scripts.

**Gates before hand-over (every stage):**
1. `py skills/content-pack-converter/scripts/text_fidelity.py <pack> <book text dump(s)> --list misses.json`: every rules text (under any key but app text, names and references) and every word cell of a lookup table the book's words. Each miss is fixed, or kept with a reason (a structured value, a merged label, a known text-layer fault); the kept list is input for the app-text pass.
2. Every table and per-level value compared with the book **by script, over the whole population**, not a sample.
3. Kits and stacks (`pack:check`), then build every class.
4. An independent `pack-reviewer` re-check in a fresh session, **repeated until one comes back clean**; each round's findings fixed and their root cause (usually a tool) fixed too.
   When replacing a pack's text with the book's, refuse any replacement that loses a number the old text had (unless the pack holds it elsewhere: say where), that pulls in a neighbouring table's legend or footnote, or that stops at a rule's opening sentence. Keep a real hyphen before a number ("x-in-y") and check every word joined at a line end against the book's mid-line forms.
5. Only then the app-text pass: blurbs, descriptions, `why` and `help` rewritten to be true to the rule and easy to read.
