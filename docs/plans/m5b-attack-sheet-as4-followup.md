# Plan: as-4's follow-up, curses, a foe's bonus on ammunition, and the weapon penalty in more places (as-5 … as-8, id-1)

Written by the builder, 2026-11-10, from the coordinator's brief and the ruling `design/rulings/m5b-evening-rulings-2026-11-10.md` (Francis's rulings on as-4's ⚑ list, the same evening; the 09 lines are Design's and already on `main`). One pull request, branch `as4-followup-curses-skills`, on top of #606 (as-4). Sized 1–1.5 hours, one picture round.

## What it delivers

1. **as-5, a curse always counts.** A negative `magicBonus` on the drawn ammunition is added to hit and to damage whatever the launcher and whatever the rules set says about adding two bonuses (a cursed arrow from a magic bow in a silent setting is a row, not the GM's mw-4 note). The weapon's own curse already counted. It stays hidden from the player (#594's rule; id-1).
2. **as-6, the ammunition's bonus against a kind of foe** always shows to whoever may see the ammunition's bonus, as a named note ("Ember arrows, +3 vs bog lurkers"), also where its plain bonus is the GM's mw-4 note. Never added.
3. **id-1, ruled and deferred.** No code: the M6 plan (`plans/m6-fights.md`, ⚑ 7) and `plans/after-m5b-gate.md` record it, dated 2026-11-10.
4. **as-7, specialised in a weapon outside the class** (the GM's approval, the same route as picking one: the step already offers it and flags it): `weaponPenalty` returns both modifiers, "Specialised" then "Not your class’s weapon", and the Attack sheet, At hand's line and the item sheet's breakdown net them.
5. **as-8, the penalty in two more places.** The sheet's Weapon skills line, beside a pick outside the class: "Bog sling (not your class’s weapon, usable at −2 to hit)". The GM's exception card, under the pack's reason: "If you allow it: usable at −2 to hit." Both words for Design to approve.

## Build order

1. `weaponPenalty` returns a list; `penaltyWords` for the two new lines (`weaponSkills.ts`).
2. `play.ts`: the `skill` option takes the list; `weaponMagic` for as-5 and as-6.
3. `FinishCreation.tsx` (`WeaponSkillsLine`) and `GmCampaign.tsx` (`ApprovalRow`) for as-8.
4. Gallery: two specimens in at-hand-actions (as-7, as-6); its 4 baselines deleted, redrawn from the run's `gallery-baselines-N`.
5. Docs: 05, 06, 07; the M6 plan and the after-gate list (id-1).

## Tests (each purpose a plain sentence)

- A cursed arrow from a magic bow in a setting that says nothing is added to hit and damage, the GM seeing it marked (as-5).
- The cursed arrow's row stays off the player's sheet (as-5 with id-1).
- Under mw-4 the player sees the arrows' bonus against a kind of foe as a named note, never added (as-6; replaces #606's GM-only test).
- An unidentified arrow's bonus against a foe stays off the player's sheet under mw-4, the GM seeing it marked.
- Specialised in a weapon outside the class brings both modifiers (as-7), and the rolls show both rows netted in the to-hit line, the bonus alone in damage.
- The sheet's Weapon skills line says the penalty beside a pick outside the class (as-8).
- The GM's exception card for a weapon outside the class says it is usable at the penalty (as-8).
- The gallery draws 16 specimens, the two new ones with their rows and sums.

## ⚑ for Francis (built, not ruled: collected, not decided)

1. **A cursed launcher with magic ammunition** (a −1 bow drawing +1 arrows, no rule): **built, not ruled (Design's answer, 2026-11-10; Francis to rule).** The bow's curse counts (as-5) and the arrows' own bonus counts too: a curse isn't "the bow having a bonus of its own" that would silence the arrows under mw-4. The GM sees both rows and no note; the player, who can't see the curse, sees the arrows' row as before. (Before: the GM saw the arrows' +1 as the mw-4 note.)
2. ~~The GM's exception card doesn't say a pick is specialised.~~ **Answered by Design, 2026-11-10:** the card reads "Bog sling, to specialise in: <the pack's reason>", with "If you allow it: usable at −2 to hit." under it. Built.
3. ~~The words of the two new lines (as-8).~~ **Approved by Design as they are, 2026-11-10.**

## Estimate

1–1.5 hours, one picture round.

As-built pictures approved by Francis, 2026-11-14: `pictures-for-approval` @ d0403312, `docs/design/pictures-for-approval/as4-followup-618/`.

## Departures

Kept by the builder.

- This plan file was written by the builder from the brief and the ruling; there was no plan file before.
- The as-8 lines are worked out when shown, from the setting's rules, not stored on the exception: a character already waiting shows the line too, and a change of the setting's penalty shows at once.
- After the pull request opened, Design answered its ⚑ (2026-11-10): ⚑ 1 built as both counting (built, not ruled), ⚑ 2 built ("…, to specialise in"), ⚑ 3 approved. Same pull request, a second commit, with the local review's 6 findings (the GM card's penalty read from `proficiencyFor` only when a weapon skill is an exception; the React Compiler memoizes it, as its lint refuses a manual `useMemo` there).
- The sheet's line shows the penalty only for a pick in the setting's list of weapons the class may not use (the step's folded group); a weapon the class's current form or a weapon rule allows carries no class penalty in the rolls (#606) but the line reads the class alone.
- As-built pictures approved by Francis, 2026-11-14: `pictures-for-approval` @ d0403312, `docs/design/pictures-for-approval/as4-followup-618/`.
