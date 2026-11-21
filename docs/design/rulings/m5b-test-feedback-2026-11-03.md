---
status: absorbed
milestone: m5b
absorbed-into: docs/05-features.md (Rules for this campaign; creating a campaign), docs/06-screens-and-design.md (tokens: Selected wash; components: Close, choice rows, GM reference), docs/09-decisions-log.md (2026-11-03), docs/plans/m5b-test-feedback-2026-11-03.md
supersedes: lr-6's "the rest behind Show all" (tf-5); the ruleKey group card as built in #283 (tf-1); the black selected fill everywhere (tf-4); text-link Close (tf-8); the GM reference's list layout and "pack" tag (tf-10)
---

# Test feedback, 2026-11-03 (design ruling)

Francis's testing of the Rules tab, messages and the GM reference (11 notes, collected then processed one at a time). Mockups: `design/mockups/library/04-rule-choice-button.html`, `05-feedback-options.html` (pictures in `library/png/04-*`, `05-*`). Ids `tf-1` … `tf-11` follow his numbering.

## Ruled
- **tf-1 (A) Two packs offer the same rule** (a `ruleKey` group): one list of every pack's choices, grouped under each pack's name; one tap is the campaign's answer. No reordering of packs here.
- **tf-2 (A) Rules keep their place while you work.** Toggling doesn't move a row; a "changed" mark shows at once; the section re-sorts (changed first) only when collapsed and reopened, or on reload.
- **tf-3 (C) Rules with several choices:** up to 3 short choices sit side by side (a segmented control, as On / Off); longer or more choices get a button showing the current choice with ▾ and "1 of N", opening the same pop-up. The description moves behind ⓘ on segmented rows. *Pack task:* a short label (about 14 letters) for each choice (`choices[].short`, falling back to the button when absent).
- **tf-4 (A) The selected state across the app** (choice pop-ups, On / Off and other segments, chips, tabs): a pale wash of the accent with a 2 px accent border, ink text, ✓ kept. Two new tokens (06): **Selected wash** `#F3E7E3` / dark `#3A2A20`, border the Accent (light) / Copper (dark). It is a state, not a button, so the one-accent-button rule stands. Every strip in a choice pop-up is full width (technical).
- **tf-5 (B) No Show all.** A pack's section is folded by default; opened, it shows every rule, changed first.
- **tf-6 (B) No "Both" choice** for an option the book gives as either / or; the GM adds the spells by hand (pg-1 unchanged).
- **tf-7 (A) The app's own rules in campaign creation:** the creation rules step opens with an **App** section (charter, starting level and the rest), the same rows as the Rules tab, folded like a pack.
- **tf-8 (B) One Close everywhere:** a bare ✕ at the top right of every sheet, pop-up and full-screen view, 44 px tap area, named "Close" for screen readers. Escape and swipe-down still close.
- **tf-10 (A) The GM reference, wide:** a fixed 220 px left list, left-aligned; the "pack" tag goes, replaced by two quiet headings, **From the rules** (panels the app builds) and **The book's GM pages** (the pack's `gmReference`); the pack switcher wraps and its selected pack uses tf-4.

## Technical (builder, no ruling)
- **tf-9** Message compose: Attach and Send aligned with the text field and inside the screen; then a sweep of every screen for misaligned button groups (the layout tests gain a check where they can).
- **tf-11** The GM reference shows values in words (labels from the rules set, "On a tie · Roll again"), never raw keys ("initiative-ties=party"); the pack switcher wraps.
