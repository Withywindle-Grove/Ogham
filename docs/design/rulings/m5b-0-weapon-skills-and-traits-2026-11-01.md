---
status: absorbed
milestone: m5b
absorbed-into: docs/04-data-model.md (PC extras: weaponSkills), docs/05-features.md (Guided creation revisited: weapon skills, trait lists; The full character sheet: Skills block), docs/06-screens-and-design.md (Components: Weapon skills step, Trait list step), docs/07-content-packs.md (weaponProficiency), docs/09-decisions-log.md (2026-11-01), docs/11-modelling-gaps.md (G-47)
supersedes: —
---

# M5b step 0: the weapon skills step and the trait-list steps (design ruling, 2026-11-01)

Asked by the builder's two scope checks in `plans/m5b-0-creation.md` (PR #231). Francis ruled the weapon skills step **Now** (2026-11-01); the trait-list steps' Now / Later is his ⚑ below. The follow-up plan is `plans/m5b-0b-weapon-skills-and-traits.md`.

## 1. Weapon skills: what the step offers

- **When:** only while the campaign has the rules set's `weaponProficiency.option` on, and the class names a `weaponProficiencyCategory` that `byCategory` knows. Otherwise there is no step (and `pack:check` warns when the option exists but a class has no category).
- **What is picked: the setting's weapons**, one Option row each — every item with a `weapon` block that the class may use (`weaponsAllowed`, through `allows()`), grouped under the pack's item categories as collapsible headings (expanded), the way Add item groups them. Not weapon groups: the pack's rule is written in weapons, and the format has no proficiency groups (a pack that groups them is G-47, parked). A homebrew weapon in the campaign counts like any other.
- **How many:** `byCategory[<class category>].start` at level 1; the count reads "2 of 3 picked". More than the count can't be picked (the row says "3 of 3 picked · unpick one first", never greyed).
- **Restricted weapons** (`restrictedWeapons.option` on): the class's forbidden weapons are **not picks**. They show at the foot in a collapsed group "Not your class's weapons · usable with the penalty" as reference only; M6 applies the penalty whenever one is used.
- **Specialisation** (`specialisation.option` on, and the class's category in `specialisation.categories`): a picked row gains a **Specialise** toggle (pressed when on): it spends `cost` picks on that weapon for its `bonus` ("spends 2 of your 3 picks · +1 to hit, +2 damage"); one weapon at most; turning it off gives the picks back.
- **Decide later** sends `weaponSkills` to the To finish card; `creation.require` makes the step required. **Help me choose** opens the side panel (tablet) or sheet (phone) with the weapons the character already carries first ("in your pack"), then the rest with their blurbs.
- The row's one line is the weapon's damage and tags from the pack ("d6 · melee, one-handed"); ⓘ opens the item's full entry.

## 2. Where the picks live (04) and who changes them

- On the **character** (not the creation record, since they grow with levels): `weaponSkills: [{ itemId, specialised?: true }]`. The number allowed is derived: `start + floor((level − 1) / gainEvery)`; **unspent = allowed − picks** (a specialisation counts `cost`).
- **To finish:** while unspent > 0 the To finish card carries "Weapon skills · N to pick" — at creation (Decide later) and again after each level-up that grants one (M7's level-up lists it too). That is where levelling's picks happen: the owner taps the line and gets the same step.
- **Who may change them:** before approval the owner, freely. After approval the owner may **add** a pick while unspent > 0 (logged); removing or swapping a pick, or changing a specialisation, is the GM's (fiat, logged) — the same rule as class and race after approval.
- **Shown:** on the full sheet in the **Skills block**, one row "Weapon skills · sword, spear" (a specialised weapon marked "· specialised"), with ⓘ giving the pack's rule and penalty; nothing on the Player screen; nothing players' Scene.
- **Read by M6:** the attack prompt from a weapon not in the picks adds the penalty as a modifier with its source ("−2 · not a weapon skill of yours"); a restricted weapon the same ("−2 · not your class's weapon"); a specialised weapon adds its bonus.

## 3. The step's screen (06)

"Weapon skills" step: the why-line from the pack's `weaponProficiency.note` (fallback: "Your class fights best with a few weapons. Pick N."), the count "2 of 3 picked" under it; Option rows with the ✓ slot, grouped by weapon category (collapsible); **Specialise** toggle on a picked row when allowed; the collapsed "Not your class's weapons" group when restricted weapons are on; **Help me choose**; **Decide later** (quiet) unless required; **Back · Next** on one row, Next always tappable and saying what's missing ("Pick 1 more, or Decide later"; N10). 44 px rows, 375 px as one column. Empty: a class that may use no weapon shows no step.

## 4. Trait-list steps (design; ⚑ Now or Later for Francis)

- **One step per trait list** the setting's sheet fields point at (`type: "list", from: "<traitList id>"`), in the pack's order; the step's title is the list's name, its why-line the list's `notes`.
- **Rows** are the existing Option rows: entry name, `blurb`, ⓘ for the full `notes`; with a **`die`**, the why-line adds "Roll dN at the table, then tap your result" and each row shows its range first ("3–5 · Reed cutter"); picking by tap is always allowed (a pack that insists on the roll says so in its notes).
- **Decide later** sends the list's id to To finish; `creation.require` makes it required; after approval the owner changes it any time (05 Identity, as ruled 2026-10-25), logged.
- **Data:** the sheet field keeps its `from`; the value is the entry id (free text without a pack, as today). `traitLists` becomes a **player-readable library kind** (the hooks-readable rule; row-level security), which is why the step qualifies for Fable.
- No new screen part: the step reuses the choice step with Option rows.

## ⚑ for Francis
1. **Trait-list steps: Now (as the follow-up step m5b-0b, on Fable, right after #231) or Later (M7)?** The builder and the designer both say Now: the importer drops trait lists from every pack until the kind exists.

## 09 line
- 2026-11-01 — [characters] Weapon skills at creation (M5b-0, ruled Now): the setting's weapons the class may use, picked one tap each up to the class category's start count, specialisation as a toggle spending picks when its option is on, restricted weapons shown but never picked; the picks live on the character, grow with levels through the To finish card, the owner adds while any are unspent and the GM changes the rest; shown in the Skills block and read by M6's attack prompts for the penalty — weapons, not groups, because that is how the pack's rule is written
