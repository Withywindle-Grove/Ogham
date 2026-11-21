---
status: absorbed
milestone: December first play (`docs/plans/dec-1-creation.md`, piece 1d: same-named entries show their pack)
absorbed-into: With the fix's pull request: 05, 06 (the "From <pack>" line), 07 (`pinnedFrom`; it is read by code, so its line goes with that pull request's review); docs/09-decisions-log.md (2026-11-13). Found 2026-11-18 (rulings catch-up 6): 07 (`pinnedFrom`, sn-1b); docs/09-decisions-log.md (2026-11-13)
supersedes: nothing. sn-1 and sn-1a stand; sn-1b adds the pinned case
---

# A pinned copy names the pack it was pinned from (2026-11-13)

Francis's standing rule: twin classes keep their names and show their source. Piece 1d shows "From <pack>" when two same-named entries of one kind come from different packs, and skips two inside one pack as "that pack's own business".

The Pack Creator found, before anyone saw it on the site, that the December campaign's twins are exactly that skipped case: the conversion pack carries **its own** version of a class and, beside it, a **pinned copy** of the rules pack's class of the same name (pinned so that the plain id always means the rules pack's class, whatever the order of the stack). Both sit in one pack, so neither row says where it is from.

## sn-1b (the lead's, technical, from his standing rule)
| | |
|---|---|
| The field | An entry may carry `pinnedFrom`: the id of the pack it was copied from, as a plain string, on the entry itself (beside `id` and `name`). A pack format fact, written down here for the first time. |
| The rule | For a **class** or a **race**, an entry that carries `pinnedFrom` is treated, for the source line, as belonging to the pack it names, when that pack is attached to the campaign. So two same-named entries inside one pack, one of them pinned from another pack, each show their line: the pinned one "From <the named pack's short name>", the other "From <its own pack's short name>". |
| When the named pack is not attached | The entry's own pack, as today. |
| Other kinds | Unchanged: a pinned stat block or item keeps its own pack on its line. (The conversion's pinned stat blocks are restated in the rules pack's terms, not copies; naming the pack they came from would name a version that differs.) |
| Everywhere the line shows | Creation's rows and the Pick's spoken name, the sheet's identity line, the review's lines: wherever piece 1d shows the pack. |

## Honest notes
- Until the fix is live, the campaign shows two rows of one name for five classes and one kindred, told apart only by their descriptions.
- Not checked by the lead: whether the importer keeps `pinnedFrom` on the stored entry. The builder confirms it first and stops if it does not.
