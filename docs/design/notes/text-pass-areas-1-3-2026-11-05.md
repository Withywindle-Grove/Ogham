# Text pass: every rules text in the books' own words (pack session, 2026-11-05)

Francis (2026-11-05), after an audit showed areas 1–3 had been reviewed for values and shapes but kept summarised rules
text: replace every rules text with the book's exact wording (the exact-wording ruling, 2026-11-03), confirm it, then
(later) rewrite the app's own wording for truth and clarity. Shapes and counts only here.

## Method
1. **Audit** (`review_tools/verbatim_audit.py`): every text field checked against the books' text, normalised for
   spaces, soft and line-end hyphens, bullets, quote and dash forms. Rules-text fields are notes, ability notes, option
   notes, table notes and results, rules-set texts; blurbs, table descriptions and the creation guide's why and help
   lines are the app's own words by design.
2. **Class and race abilities** (`review_tools/ability_units.py`): each book entry split into headed, labelled and
   bulleted units, each ability matched by name, every match read. Book rules the pack lacked were added under the
   book's headings.
3. **Everything else** (`review_tools/text_worklist.py`, `apply_proposals.py`): a worklist of every non-verbatim rules
   text with its path; helpers proposed the book passage for each, or said why it has none (the pack's own note, app
   wording, no book source). A proposal was applied only if the pack still held the text the worklist saw and the new
   text is found in the books, as one span or sentence by sentence (passages joined in book order). Samples read by hand.
4. **Confirm:** the worklist re-run on the final packs; every remaining non-verbatim rules text is one kept on purpose.

## Results

| Pack | Replaced by book text | Kept as the pack's words | Remaining, unexplained |
|---|---|---|---|
| classic-advanced (0.6.45) | 252, plus 179 class and race abilities (19 rules added) | 78 (app wording 47, pack notes 22, no book source 9: the newer-edition options kept under fi-6) | 0 (one line where the book's text layer runs two words together) |
| fae-woodland (0.3.38) | 643 | 153 | 0 (six texts the book prints with a large initial letter) |
| zine overlay (0.5.29) | 496 | 97 | 0 |
| deathcaster-class (0.10) | 15 | 2 | 0 |

**Held for area 6:** classic-advanced's magic item notes (truncated tables); area 6 redoes them in full.

**Data errors the book text corrected:** two fae-woodland regions placed wrongly; the overlay's level-0 funnel described
the other way round; a statue's number of heads; nineteen class rules missing from classic-advanced (deity disfavour,
a paladin's vow, a ranger's possessions, a knight's code, a duergar's power use, and others).

**Tool lessons** (for the converter skill): a number line is a page number only at a page's edge and close to the
page's own number; a soft hyphen always joins its word; a hard hyphen at a line end is a real hyphen in some books;
large initial letters split the first word; two-column tables read out of order; footnote markers sit mid-line.

**Next:** an independent re-check of this pass with area 5; then area 6; then the rewrite pass on the kept app wording
(`review_tools/work/keep_*.json` lists every kept text and why).

## Round 2 (after the third re-check, 2026-11-05)

The first pass looked at five field names; the re-check found rules texts under other keys and table cells it never read. Round 2 widened the worklist to every string but app text, names and references, added a cell audit for lookup tables, and added guards to the apply step (no lost numbers, no pulled-in table legends, drop caps rejoined).

| Pack | Texts replaced | Kept with a reason | Cells set / tables rebuilt | Remaining, unexplained |
|---|---|---|---|---|
| classic-advanced (0.6.50) | 32 | 13 | 3 / 0 | 0 |
| fae-woodland (0.3.41) | 97 | 24 | 14 / 2 | 0 |
| zine overlay (0.5.31) | 31 | 17 | 61 / 4 | 0 |
| deathcaster-class (0.11) | 2 | 0 | 1 / 0 | 0 |

Kept by design: table cells where the app reads the pack's layout (encounter columns, monster stats by level), row labels that fold in a printed column heading, roll-table labels joined from their printed cells, and a few texts where the book's text layer is faulty (`review_tools/work/keep_*.json`, `keep_w5.json`).

## Round 3 (after the fourth re-check, 2026-11-05)

Strings inside lists and rules lines of 25 characters or more under any key: 92 replaced by the books' words (classic-advanced 34, fae-woodland 41, zine 17), the rest kept with a reason (values in the pack's format, skill labels, monster wants). Table cells, second round: single-value rows and short results now read; 31 set, 7 tables rebuilt. Remaining unexplained in every pack: 0.
