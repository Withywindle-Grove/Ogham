---
status: absorbed
milestone: m5b
absorbed-into: docs/07-content-packs.md (Settlements: fields), docs/plans/m5b-6-settlements.md (step 6.0; ⚑ 2 and 3), docs/05-features.md (Settlements, ST4), docs/09-decisions-log.md (2026-11-03), docs/10-open-questions.md (the switches' ⚑), docs/testing.md (gate run, check 48)
supersedes: the ⚑ "Out and about today / Active tonight: who sets them" (10; plans/m7-downtime.md)
---

# The town switches and `onlyWhen` (design ruling, 2026-11-03)

The builder stopped on `checks[].onlyWhen` (07, ST4): neither switch exists, so the reader has nothing to read. Francis ruled B on the settlement scope check (settlements stay in M5b) and then these four, one at a time. Test data: fae-woodland 0.3.16 (town-day checks `outDay`, town-night `activeNight`). Ids `sw-1` … `sw-4`.

- **sw-1 (A) The GM sets** Out and about today and Active tonight; players see their state.
- **sw-2 (A) Where:** the time strip's ⋯ (as Travelling in darkness), kept with the campaign, with a small marker on the strip while one is on. When the town screen lands (step 6c) it shows the same two switches: one state, two ways in.
- **sw-3 (A) Reset and log:** both turn off at the next morning (in a mode without parts of the day, when the day changes) and at Start downtime. Each flip is one Simple log line with Undo on the toast; the automatic reset is logged too.
- **sw-4 (A) What players see:** a quiet line on their Scene while a switch is on ("Out and about today", "Active tonight"); never that a check was skipped or exists. Checks keep their own secrecy (a secret result reaches players in downtime or when revealed).
- **The reader:** a check with `onlyWhen: "outDay"` runs only while Out and about today is on, `"activeNight"` only while Active tonight is on; no `onlyWhen`, always. `pack:check` accepts the two values and warns on any other.

## Amendments
- **2026-11-03, the plan's other two ⚑:**
  - **st-3 (A) One lodging rule everywhere:** only "Somewhere else…" needs the GM's yes, in town on an expedition as in downtime (dt-11 replaces ST7's approval of each stay).
  - **st-2 (A) Settlement fields (07):** `settlement.services[] { id, name, kind: buy | sell | identify | store | loan | other, rate?, note }` (a seller's `rate` is the share of the price it pays; `other` offered as a town activity); `settlement.availability { bySize: [{ size, chance }] }` (the Ask for… Hit / Miss); `settlement.salePrice { default, byService? }`; a town mode's `step: { value: 1, unit: "partOfDay" }` (morning, afternoon, night). Lodgings, stored places, loans and lifestyles keep dt-46's shapes. *Pack session:* write these for fae-woodland (services from its text, availability by settlement size, the sale rule, the settlement mode's step) and classic-advanced where its volumes give them.
