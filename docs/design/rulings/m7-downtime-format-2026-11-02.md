---
status: absorbed
milestone: m7
absorbed-into: docs/07-content-packs.md (Downtime section), docs/09-decisions-log.md (2026-11-02), docs/10-open-questions.md (the format ⚑ ruled), docs/11-modelling-gaps.md (G-71 … G-78 ruled; G-79 stays open), docs/plans/m7-downtime.md (stages)
supersedes: "Proposed for 07" in design/rulings/m7-downtime-2026-11-02.md; amends dt-1, dt-31, dt-32, dt-33 there
---

# The downtime pack format (design ruling, 2026-11-02)

Francis chose to wait for the pack session's survey before ruling the format (option C). The survey, `design/notes/downtime-pack-shapes-2026-11-02.md` (PR #300; 30 activities: 4 fit, 14 need a change, 12 miss a field; gaps G-71 … G-79), proposed 11 field changes and named four rulings it presses on. Francis ruled each, one at a time. Ids continue from `m7-downtime-2026-11-02.md`.

- **dt-46 The shape (A).** A `downtime` **section** carried by a homebrew or overlay pack (no new pack kind; the supplement depends on no system). All 11 changes go into 07 now, so the pack converts once. **The app reads the format in stages;** a field it doesn't read yet shows to the GM as one plain line of words in the activity's terms, and the GM applies it by hand (progress, Due and the log still track it). The pack checker lists which fields the app reads. Stages: **1** (M7) fixed costs and durations, the roll and its bands moving progress, plain steps, troubles with a clock, `atTheEnd` text; **2** (M7 or just after) formulas, band effects, blocking and repeating troubles, natural-dice bands, `kind: free`; **3** (with M8b's NPCs and places) `target`, secret / branch / wall steps, `grants`, lifestyles and loans. The worldbuilding prompts go in `gmReference` (the format's name; the earlier ruling said `gmPanels` in error).
- **dt-47 Secret steps (A; amends dt-33).** A tracker may be `secret`: the player sees the steps reached, the next shows as "? · the GM knows"; the bar keeps the total ("2 of 5").
- **dt-48 Natural-dice bands (A; amends dt-32).** An activity with a band on the natural dice shows a chip above the bands ("Natural 2?"); the player taps it instead of a band when the dice showed that.
- **dt-49 Three kinds of trouble (A; amends dt-31).** The clock is optional. A trouble has a **deadline** (as dt-31), **blocks** (a ⛔ wall on the bar and "Waiting on…", cleared by the GM's **Done**) or **repeats** (a Due line every downtime until the GM marks it **Settled**). `whenItRunsOut` may take a step back, reset progress, or end the activity.
- **dt-50 Free activities (A; extends dt-1).** A third kind, `free`: no action slot, any number per downtime, each with its own roll, result and log line; the GM can still say no in the thread.

## For the pack session
Convert downtime-reference as a downtime overlay (homebrew pack) to 07's Downtime section; mark the setting packs' downtime options (training, XP for spending, lodging, lifestyles, money changers) in their sections; G-79 (an item that wakes into magic later) stays open, handled by the GM's item edit.
