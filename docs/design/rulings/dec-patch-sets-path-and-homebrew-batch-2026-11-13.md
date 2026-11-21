---
status: absorbed
milestone: December first play (the homebrew tables overlay; character creation's step sequence)
absorbed-into: docs/07-content-packs.md (Patches in detail: pf-19, with pf-19c's numeric step), docs/05-features.md (Creation: Back, cs-39); docs/09-decisions-log.md (2026-11-13); hb-1 to hb-3 are pack content
supersedes: 07's "a path the entry lacks changes nothing" for a patch that sets a value (pf-19); nothing else
---

# A patch may add what an entry lacks; the homebrew batch; Back in creation (2026-11-13)

## The homebrew batch (Francis: "Approve the batch as shown")
His instruction for his own homebrew tables pack: it "should add age height and weight for all races in the pack - using the same methodology it used to generate random table values to fill those fields (meaning fantasy lore and media, books, etc)". First ruled on 2026-11-09 and never built.

| Id | Ruling |
|---|---|
| hb-1 | The homebrew tables pack gives an age, a height and a weight (each a base and dice, in whole years, inches and pounds) to every kindred it names: the classic rules' ten and the zine's eleven, and one more pack's tiefling. The figures are his own, written from general fantasy lore and not from any one book; where a book states a size the figure keeps to it. He approved the table of 22 as shown. |
| hb-2 | That other pack's tiefling, which had no creation tables anywhere, is added to the homebrew pack's existing tiefling tables. |
| hb-3 | The figures hang on an option of the homebrew pack, on by default, so he can switch back to the books' bare figures. |

## pf-19: a patch may set a path the entry lacks (the lead's, from the batch above)
An overlay changes another pack's entry through a patch. Until now "a path the entry lacks changes nothing", so a pack could not give a kindred a figure it had none of, nor a class a list it lacked. Fifteen of the 22 kindreds have no such figures at all. The same wall stood in front of his homebrew level titles.

| | |
|---|---|
| The rule | A patch that **sets** a value creates the missing keys on its way, **objects only**. |
| Never | A list is never created or padded: a missing step whose next segment is a number is refused. A step that exists and is not an object (a text, a number) is refused, never overwritten. The names `__proto__`, `constructor` and `prototype` are never created or followed, in the app or the checker. |
| Still | A patch hangs on an option's choice, as before. Other kinds of patch (anything that is not a set) keep "a path the entry lacks changes nothing". |
| The checker | `pack:check` lists each patch that creates a path, under its notes, so a slip of the pen is seen; a refused patch (a list index, a non-object in the way, a forbidden name) is an error. |
| Hidden means hidden | A patch whose path begins at a field the entry keeps for the GM stays the GM's, whether the field existed or the patch creates it; a player never reads it. The database already decides this by the field's name; a database test proves the created case. |
| One reading | The app and the checker read a patch's path with one shared function. |

## cs-39: Back in creation returns to where Next came from (the lead's; a fault, from Francis's report)
Francis saw creation go from Class straight to Who they are, and Back from there land on the adjust-scores step. Next was right: with every score at 10 no trade was possible, and a step with nothing to do on it is skipped by design. **Back was wrong**: it landed on adjust scores whenever the rule existed.

| | |
|---|---|
| The rule | Forward and back walk one list of steps for the same character. Back from Who they are lands on adjust scores only when a trade is possible; else on the Patron step if this character has one; else on Class. |
| The guard | A test walks forward to Who they are and back, and the steps match, with a trade possible and impossible, and for a class with a Patron step and one without. |
| For the creation sweep, not built | A step skipped because nothing could be done on it looked like a fault to him. Whether the review should say that no score could be adjusted is a question for the sweep. |
