---
status: pending
milestone: December first play (`docs/plans/dec-7-linked-spots-screens.md`, piece 6: Knowledge and Rules, verbatim; `dec-9-the-strip-and-next-turn.md`, a step's text)
absorbed-into: pending. 07 (the rule-text blocks; it is read by code, so its paragraph goes with the reader's pull request); docs/09-decisions-log.md (2026-11-13)
supersedes: nothing. It writes down the shape rt-1, pf-12a and pf-14a named without giving its keys
---

# Rule text set out like the book: the format of record (2026-11-13)

rt-1 (Francis, 2026-11-11: "A") ruled that a rule opens formatted like a page of its book, and pf-12a and pf-14a put an area's full text and a procedure step's text in "the same block shape". The shape's keys were written down nowhere in the repo, and the app has no reader for it: today it reads rule text as plain words. This file is the shape **exactly as the one pack that carries it writes it** (the Pack Creator's account, 2026-11-13; nothing tidied), so the reader, the checker and the packs agree.

## pf-18: the shape (the lead's, technical; the Pack Creator's format, taken as built)
**Where:** a place rule's `text`, an area's `gm.text`, a procedure step's `text`. The same shape in all three.

**The value is either** a plain string (today's meaning, always valid) **or** an object `{ "blocks": [ … ] }`. Never a bare list.

**A block** is an object with one marker key. There is no `kind` word.

| Block | Shape | Required |
|---|---|---|
| Paragraph | `{ "p": "…" }` | `p` |
| Sub-heading | `{ "h": "…" }` | `h` |
| Bold lead-in | `{ "lead": "Term", "text": "…" }` | both; `text` never empty |
| List | `{ "list": ["…", "…"], "numbered": true }` | `list`, of strings only; `numbered` optional |
| Titled table | `{ "table": { "title", "die", "columns": […], "rows": [[…]] } }` | `title`, `columns`, `rows`; `die` optional; a column header may be empty, as printed |
| Table by id | `{ "tableRef": "<table id>" }` | `tableRef` |
| Titled box | `{ "box": [ blocks… ], "title": "…" }` | `box`; `title` optional |
| Source line | `{ "source": "p. 10, p. 12" }` | `source`; always the last block |

**Nesting:** one level. A box holds blocks, never another box. A list holds strings only. A list that belongs under a lead-in is written as the lead-in, then a separate list block.

**Inside any text:** one mark only, the link `[[kind:id|label]]` or, across packs, `[[kind:packId:id|label]]` (pf-5, pf-5a: place, npc, item, table, statBlock, spell, rule, adventureHook). The label shows; the id links. No bold or italic inside text: bold exists only as a lead-in's term.

**The link mark is read in plain strings too**, not only inside blocks (as pf-5 has it: "any text").

Invented example:

```json
{ "blocks": [
  { "h": "Crossing the Mire" },
  { "p": "Each hour in the bog, the [[table:mire-hazards|Mire hazards]] table is rolled." },
  { "lead": "Sinking", "text": "A wader who fails a check sinks to the waist." },
  { "list": ["Drop the pack", "Grab a rope", "Call the lantern warden"], "numbered": true },
  { "table": { "title": "Mire hazards", "die": "d4", "columns": ["d4", "Hazard"], "rows": [["1-2", "Leeches"], ["3-4", "Sinkhole"]] } },
  { "box": [ { "p": "Optional rule: a bog lurker takes the last in line." } ], "title": "Bog lurkers" },
  { "source": "p. 12" } ] }
```

## pf-18a: what the app does with it (the lead's)
| | |
|---|---|
| One reader | One typed reader for the three fields: a string stays a string; an object with `blocks` becomes typed blocks; anything else, and any block it does not know, is kept out and named (never a crash, never raw JSON on a screen). |
| Plain words | One function turns blocks into plain words in reading order (headings, lead-ins as "Term. text", list items, a table's title, a box's title and words, the source last), for every place that shows rule text as words today and for search. |
| Hidden means hidden | In a player's piece a link is a tap only to what that player can already see; otherwise its label shows as plain text; **no id reaches a player's device** (rp-5). This holds for blocks and for plain strings alike. |
| The checker | `pack:check` validates the shape wherever it may appear, with one shared function. |
| The screen | How blocks are drawn (the book's type, a titled table, a box) is `dec-7` piece 6, from its approved pictures; not this ruling. |

## Where the packs stand (the Pack Creator, 2026-11-13)
- Blocks are carried by one pack only, an adventure not yet shipped: 29 texts (3 place rules, 26 areas' GM text), 159 blocks. No pack carries a procedure step's `text` yet; the fae-woodland rules pack's next build adds the first.
- Everything else is still plain strings: the rules sets' rule texts and GM reference entries (several hundred across classic-advanced and fae-woodland). Converting them is pack work in tranches, sized on 2026-11-11.

## Honest notes
- The lead told a builder that a step's text was "a string or a list". That was wrong (no pack carries a bare list) and was corrected the same hour, before anything merged.
- The adventure carries link marks in plain strings in the players' view of a place. Read from the code the same day (the Builder): a place made from a pack has every mark turned into its label before its pieces are saved, players are sent only the saved pieces, and they are drawn as plain text; so no id reaches a player by that path. **A gap remains**: the marks are stripped on the GM's device, not by the server, so a mark that reached a piece another way (typed by hand, or a changed client) would be sent raw. A server-side strip where pieces are written closes it: about half a turn, one migration; to build this month, not needed before the adventure ships.
