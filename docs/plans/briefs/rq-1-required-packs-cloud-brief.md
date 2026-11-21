# Brief for a cloud builder: a campaign that lacks a pack another needs says so (rq-1), and which option governs when two packs share one (a test)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `rq-1-required-packs`. Pull request title: "A campaign that lacks a pack another needs says so and offers to attach it (rq-1)".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch (bring it up to `origin/main` first); carry nothing over.

## Read
- `docs/design/rulings/dec-required-packs-and-pack-choices-2026-11-13.md`: "What happened" and the section rq-1. It is your definition of done.
- `src/modules/library/ruleGroups.ts`: `missingBases`, `missingWords`, `needsPicked` (the New campaign side already works out a picked pack's missing required packs). `src/app/CampaignSetupSteps.tsx` (the attach step's line, `metaIdOf`), `src/app/NewCampaign.tsx`, `src/modules/library/libraryList.ts` (`needsLine`), and the campaign's Rules page (Setting rules) with how it lists attached packs.

## Part 1: the logic and the line (rq-1)
1. **A pure function first, with tests**: given a campaign's attached packs and the GM's library, each attached pack's required packs that are **not attached**, and for each whether it is in the library. An attached pack carries no `requires` of its own: map it to its library entry first (as `metaIdOf` does). Reuse `missingBases` if it fits; do not write a second version of the same logic.
2. **The words**: one function for the ▲ line, in the voice of `missingWords`: "<Pack> needs <Other>, which isn't attached to this campaign." (two: "… needs <A> and <B>, which aren't attached to this campaign."); when a needed pack is not in the library the line ends "Import it into your library first.". Tests for one, two, in the library and not.
3. **The attach step's line** names which required packs are missing, not the whole list; when none is missing it reads as today.
4. **On the campaign's Rules page**: the ▲ line on the row of each attached pack with a missing required pack, for the GM only, and when the needed pack is in the library one plain button on that line, "Attach <Other>", which attaches it through the same command the attach step already uses (logged, with Undo). Use existing parts only (the row's line, the ▲ mark, a plain button): no new component, no new CSS beyond what an existing line needs.
5. It refuses nothing and hides nothing.

**This part is visible.** You cannot take pictures; say in the status file exactly where the line and the button appear and in which states, so pictures of the built screen can be taken for Francis before it merges. If placing the line needs a layout decision the ruling does not make, build parts 1 to 3 and stop before the screen, with the question written down.

As-built pictures approved by Francis, 2026-11-14: `pictures-for-approval` @ d0403312, `docs/design/pictures-for-approval/rq-1-721/`.

## Part 2: a test only, no fix
Two packs can carry an option with the same id (the classic rules pack and another setting's). Nobody has confirmed which pack's switch governs. Write a test file that sets up two invented packs with one option id, the choices set differently in each, and **states what happens today**: which choice the rules set reads, and which choice a single global reader reads (`choiceInPlay` and `resolveRules` in `src/modules/library/campaignSetting.ts`), with the stack in both orders. Name each test by what it shows. Change no behaviour; if what it shows looks like a fault, say so at the top of the status file in one plain paragraph.

## Fences particular to this piece
- No migration. If attaching a pack from the Rules page cannot reuse the existing command, stop that part and write it down.
- Do not touch creation, the library's own page or `kindredTables`.
- Invented pack names only.
