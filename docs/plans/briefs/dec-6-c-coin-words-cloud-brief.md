# Brief for a cloud builder: dec-6 c, the coin line's words (a formatter only)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `dec-6-c-coin-words`. Pull request title: "dec-6 c (logic): the coin line's words from the setting's denominations".

## Read
- `docs/plans/dec-6-purse.md`: the section "Words" and ⚑ 1. You build a small slice of piece c: **the words only**. The coin line's place on the Pack tab, its sheet and its buttons are built later by someone else.
- The purse's data as merged (piece a): find where a purse's amounts by denomination and the setting's denominations are typed and read. Do not guess paths.
- `docs/07-content-packs.md`: only where a rules set names its coins.

## The task
Pure functions with tests; no component, no screen, no command, no database.

1. **The coin line**: from the setting's denominations, in the order the setting lists them, and a purse's whole-number amounts, the words "12 crowns, 30 herons, 4 bits" (invented coin names; the app prints the setting's own). Denominations with none are left out. With nothing at all, or no purse: **"No coin"**.
2. **An amount's words**, as the buttons and log lines will need them: "2 herons", "10 herons", "1 heron". Use the setting's own singular and plural where the format gives them; where it gives one name only, use that name as given and do not invent a plural.
3. Amounts are integers (hard rule 8): a fraction or a negative is never printed; say in the status file what the function does with one (refuse, or floor at zero) and test it.

## Tests (purpose first)
Three denominations with amounts; one denomination at zero left out; all zero gives "No coin"; no purse gives "No coin"; one coin reads in the singular where the setting gives one; a setting that lists its coins in an unusual order keeps that order; a long coin name is not cut.

## Fences particular to this piece
- If a setting names no denominations at all, do not invent any: that is the plan's ⚑ 1. Return "No coin", and write the question down.
- Hidden means hidden: these functions only format what they are given. Do not add any read of a purse.
