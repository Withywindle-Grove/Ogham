---
status: absorbed
milestone: standing design rule (it changes hard rule 7 of `CLAUDE.md`); first use in the December stat block
absorbed-into: `CLAUDE.md` (hard rule 7), `REVIEW.md`, `.claude/agents/designer.md`, `docs/06-screens-and-design.md` (Colour and shape; the Book label token, cr-c2) in the same pull request; `src/CLAUDE.md` with the builder's next pull request; docs/09-decisions-log.md (2026-11-12)
supersedes: "never colour alone" as an absolute rule (hard rule 7; 06, Colour and shape), for new work; signals already drawn keep their text or shape until the sweep looks at them
---

# Colour may carry a distinction by itself (2026-11-12)

Ruled by Francis on the Design Studio's picture of a stat block's labels with and without bold, each also with the hue taken away (`docs/design/mockups/december/06-stat-block.html`, picture `06-12`, branch `design-december-mockups`). His words: "so, i think dark mode no bold is easily readable in both forms. i think light mode is readable in grayscale more so than in color - let's change the color in lightmode. include my ruling to relax the rules - for everything not just stat blocks. note i myself am partially colorblind and a good judge of this."

| Id | Ruling |
|---|---|
| cr-c1 | **"Never colour alone" is relaxed, for everything.** Colour may carry a distinction by itself where the mockup shows it with the hue taken away beside the coloured version, the contrast is measured in light and in dark, and Francis has approved it. He judges it himself. The floors for text contrast still hold. |
| cr-c2 | **A stat block's labels are coloured at the regular weight, not bold.** In dark mode the label colour stands as drawn. In light mode the label colour changes: the Design Studio proposes it (a token of its own), shown in colour and with the hue taken away. |

**The lead's reading, his to change.** The relaxation is a permission, not a sweep: signals already drawn with a shape or a word keep them until the sweep of the app looks at each. A review treats colour alone as a fault only where no approved mockup shows it. The measured figures on the picture he ruled from: the label colour on the sheet 5.84 to 1 in dark and 10.43 to 1 in light; label against value with the hue gone 2.47 to 1 in dark and 1.72 to 1 in light, which is why light mode's colour changes.

**Costs and caveats.** One new colour token for light mode. Other people at his table may see colour differently than he does; the greyscale strip in each mockup is the check for them.

Docs to update: done in this pull request for `CLAUDE.md`, `REVIEW.md`, the designer's agent file and 06's principle; `src/CLAUDE.md` (one line) by the builder; 06's tokens when the light-mode label colour is chosen; 09.

09 line:
- 2026-11-12 — [ui] "Never colour alone" is relaxed for everything: colour may carry a distinction by itself where its mockup shows it with the hue taken away, the contrast is measured in both modes and Francis approves it; a stat block's labels are coloured at the regular weight, with a label colour of its own in light mode (cr-c1, cr-c2; changes hard rule 7) — "Include my ruling to relax the rules - for everything not just stat blocks. Note I myself am partially colorblind and a good judge of this" (Francis) — `design/rulings/dec-colour-rule-2026-11-12.md`
