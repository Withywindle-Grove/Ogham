# m5b-gate-bugs-3b: #504 re-landed; an empty rule group's summary; Back's padding

#504 (side-menu name, Rules tab indent, small row actions) merged into `m5b-gate-bugs-2` after that branch had landed, so it never reached main. This branch brings it to main, with the checks of `docs/testing/m5b-gate-bugs-3.md` (still valid), plus:

1. **iPad, landscape, as the GM: Rules tab.** Open a campaign, tap Rules. Under "Setting rules", expect every action the same small size: on a pack's row "What's in it", "Optional rules", "Update from a new file", "Sheet layout…", "Remove…"; under the list "Browse these rules" and "+ New homebrew entry".
2. **Same tab, "Optional rules · 1 changed" → "Change rules for this campaign".** Expect every group's arrow and title to start at one left edge. A pack with no optional rules reads "Optional rules · Fen Rules · none" as one line of words; with a long pack name it wraps like a sentence, "· none" right after the last word (never pushed to the right edge, never a "·" alone on a line).
3. **Same list.** A rule the app doesn't apply yet shows "Run by hand ›" (in the layout harness: "Ferry tolls by the hour").
4. **iPhone (390 px): repeat 1–3.** Same results; nothing sideways.
5. **iPhone (390 px), as a new player: Create your character → Guided → … → Who they are.** The foot's "Back" has room on both sides of its word, inside its border, the same as other secondary buttons; Next beside it. If the foot is too narrow, the hint wraps above them.
6. **Who they are with alignments** (layout harness `?as=new&alignments=1`, or a setting whose pack names alignments with blurbs). Each alignment row shows its one-line blurb under the name.

Feeds the M5b gate's Rules-tab and guided-creation checks (docs/testing.md).
