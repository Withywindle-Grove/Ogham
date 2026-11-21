---
status: absorbed
milestone: m5b
absorbed-into: docs/05-features.md (Guided creation, rebuilt), docs/06-screens-and-design.md (Option row, Creation step shell, Score tiles, Derived fields, Weapon skills step, Spell picker), docs/09-decisions-log.md (2026-11-02), docs/plans/m5b-0c-creation-rebuild.md (Follow-up to the second test), docs/design/mockups/creation/10-test-2-alternatives.html and png/
supersedes: parts of design/rulings/m5b-0c-creation-rebuild-2026-11-01.md (cr-5 the ✓ slot; cr-11 Undo per trade and forbidden taps answering; cr-12 the Derived fields list and the hit-points prompt; cr-14 rolls before the kit) and of design/rulings/m5b-0-weapon-skills-and-traits-2026-11-01.md (the weapon skills step's form field)
---

# Character creation, the second test (design ruling, 2026-11-02)

Francis tested the built slices on an iPad in the afternoon of 2026-11-02 with both settings (fae-woodland, then classic-advanced + the zine overlay). His notes, grouped by the design agent, became eight items with alternatives drawn in `design/mockups/creation/10-test-2-alternatives.html` (pictures in `creation/png/`); he ruled them together (1, 2, 4–8 as proposed; 3 as option C). Ids `ct-1` … `ct-10`. The bugs he found are in the plan, not here.

## Rulings
- **ct-1 The pick on a row is a button.** Every pick row (kindred, class, alignment, spell books, kits, languages, weapon skills, trait lists) ends in a 44 px **Pick** button that becomes **Picked ✓** (pressed look, a tinted band and an ink edge on the row: three cues, never colour alone). Tapping the row's text opens the entry, whose foot has the same button. The empty ✓ square goes (supersedes cr-5's ✓ slot). **Pick → Next:** on a one-of-many step (kindred, class, alignment, a rolled book) Pick — from the row or the entry — moves to the next step at once with a toast "<name> picked · Undo"; on an N-of-many step the step stays until Next and the foot counts.
- **ct-2 The entry, formatted.** Six small-caps headings (requirement · score changes · advantages · disadvantages · languages · open classes; a class: requirement · prime requisite · hit die · armour and weapons · advantages · disadvantages · level cap by kindred), advantages and disadvantages as bullet lines **name — effect** (the pack's `abilities[].name` and text, `kind` sorts them), open classes as chips that open the class. Beside the list the Pick is a plain button (Next keeps the accent); in a phone's sheet it is the accent.
- **ct-3 Adjust scores shows only the tradeable scores** (option C). A line above names the scores the rule keeps as rolled ("CON and DEX stay as rolled in these rules"; the strip at the top still shows them); tiles carry only the button the rule allows (−2 on lowerable, +1 on primes); every trade is a **chip** under the tiles ("WIS −2 → STR +1 ✕") and its ✕ undoes that trade. No Undo on tiles, no buttons that answer (supersedes those parts of cr-11); the bank line stays.
- **ct-4 Hit points and the tiles' words.** No "type what the dice show" prompt: the die box, the arithmetic beside it ("1d4 → 4, CON −1 → 3 hp"), and one line under: "Roll 1d4 and type the die. The app adds CON (−1); never below 1." The affects words under a score tile **name the thing** ("open doors 2-in-6", "+1 melee"): the pack's column names are the words, and a bare "x-in-6" is a pack fix. Tiles: the number field 64 px and never shrinking, the three controls on one line, every tile the same height (technical, in the plan).
- **ct-5 Derived fields shows only fields that have a value** ("Derived fields · 4 · from the rules; more appear as you pick gear"); no "—" tiles. AC shows its parts ("9 · unarmoured, DEX +0"). Supersedes cr-12's "every `fill` field".
- **ct-6 Gear: the kit picks first.** A kit's rolls unfold under its row once picked (ranges first, tapped); Next says which roll is missing ("Tap your weapon roll") instead of holding the kit until the rolls are done. Supersedes cr-14's order.
- **ct-7 A spell book's entry is one row per spell** (name in Garamond, the line under, the facts small, a rule between); a spell row opens that spell's full rules.
- **ct-8 Weapon proficiencies are a pick list,** never a form field: the pack's weapons with the count from `weaponProficiency` at the starting level ("pick 2 · 1 of 2 picked"), Other… at the foot; with the specialisation option on the header says so and a second Pick on a picked weapon marks it "Specialised ✓✓", the pack's rule in the why-line. Amends the weapon skills step (2026-11-01).
- **ct-9 Explainers come from the pack.** Every trait-list step (background, affiliation, moon sign, secondary skill) opens with the list's `notes` as its why-line, with the die named ("Roll 1d12 at the table, then tap — or pick"), and `creationGuide.<step>.help` behind Help me choose; the pack session writes the words for both settings in the pack's own terms.
- **ct-10 Options at creation, made explicit.** A creation-relevant optional rule appears in creation when on and is absent when off — kindred-as-class classes, quick equipment, age and lifespan, combat talent, thief expertise, cantrips, weapon specialisation, and every other one in both settings. The builder owns a test per option (on → present, off → absent); the pack session owns tying every such option to data (`option` on lists and kits, `byOption` on rules-set fields) so the app can read it. An option the app can't model yet is listed in the plan's Departures, never silently dropped.

## Not changed
The shell, Back and Next (cr-1, cr-2), the fit line, the scores strip, Decide later where it exists, the spell book as a list, Send to the GM.

## Pack tasks (pack session)
Both settings: the why-line `notes` and `help` for every trait list; affects columns named as the thing ("open doors"); each creation-relevant option tied to data (`option`, `byOption`) — classic-advanced: age and lifespan, combat talent, thief expertise, cantrips, specialisation; the zine overlay: quick equipment; fae-woodland: kindred-as-class, buy-equipment (cf-4), moon signs.

## 09 lines
See `docs/09-decisions-log.md`, 2026-11-02 (six lines tagged [characters]).
