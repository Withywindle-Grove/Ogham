# Full character sheet review — the printed sheets against the app (designer, pass 1, 2026-11-03)

Francis's aim: every field on each setting's printed sheet is on the app's **full character sheet**, or one tap from it (the Player screen and the Pack tab count, generously: an item in the Pack tab is one tap away even if the item needs another), and fields that exist because of an **optional rule** appear when it's on and go when it's off. This becomes the model for future settings. Method: check, recheck, check again until a pass is clean; the last pass by a fresh session (`docs/plans/pack-review-method.md`). Sources (private): the fae-woodland sheet, the classic-advanced sheet (standard) and its item-encumbrance version, in `packs/*/source/`. Field labels only; no rules text.

**Pass 1** reads the printed sheets, the packs' sheet layouts (`fieldTemplates`, fae-woodland 0.3.13, classic-advanced 0.6.14) and the app's code read-only (`CharacterSheet.tsx`, `PlayerScreen.tsx`, `PackScreen.tsx` on main). **Pass 2** checks the seeded characters (`plans/test-seed-campaigns.md`) on the preview, every class, both option sets. Key: **Sheet** on the full sheet · **Tap** one tap away (where) · **Missing** · **?** to verify on a seeded character.

## The app's three screens today (from the code)
- **Full sheet** (`CharacterSheet`): the heading (name, class and level, race), the vitals, then **Combat**, **Abilities**, one section per layout **group** (the pack's `fieldTemplates`: Identity, Saves, Movement, Skills…), Backstory, Notes. Most of a setting's sheet comes from its layout.
- **Player screen**: vitals (HP, AC, attack), light, **Spells** (prepared spells by level, only for a caster with slots or something prepared; M7 adds Cast), abilities with uses, at hand, skills, saves, the party.
- **Pack tab**: carriers, items, load and tiers; the purse arrives with M7b.

## fae-woodland — the printed sheet

| Printed field | Layout / app | Where today | Verdict |
|---|---|---|---|
| Name | app | Sheet heading | Sheet |
| Kindred & Class | `kindred` ref + class | Heading, Identity | Sheet |
| Background · Alignment · Affiliation · Moon sign | layout (moon sign gated by its option) | Identity | Sheet (the moon sign's gate: **?** on/off) |
| Liege (knights) | layout `liege` text, not class-gated yet | Identity, every class | **Wrong scope** (cs-3: `forClasses`) |
| Six scores, modifiers, each score's caption | layout + tiles' affects line | Abilities | Sheet |
| Save targets (five) | layout fills | Saves | Sheet |
| Magic resistance | layout fill (WIS) | Saves | Sheet; kindred part ct3-12a |
| **Kindred & Class Traits** (a box) | — | Player screen shows only traits with uses | **Missing** (cs-7: a traits section; layout here) |
| Skill targets: Listen, Search, Survival, a modifier line | layout fills | Skills | Sheet; class skills (thief, bard, hunter) **?** where; kindred part ct3-12a |
| Languages | layout text | Identity | Sheet (each opens its entry: ct3-11) |
| XP · Next level · Level | app | Heading / XP | Sheet for XP and level; **Next level ?** |
| Max HP · HP | app | Vitals | Sheet |
| AC · Attack | layout fills + vitals | Vitals, Combat | Sheet (bonuses: cs-7) |
| Movement: speed, exploring, overland | layout fills | Movement | Sheet (blank: ct3-10) |
| Encumbrance method; weight or slots; speed track | option + Pack | Pack tab | Tap |
| Equipped · Stowed · Tiny items | Pack carriers | Pack tab | Tap (**tiny items ?**) |
| Total weight | Pack load | Pack tab | Tap |
| Coins (four metals) | purse (M7b) | — | **Missing until M7b** |
| Other notes | app Notes | Notes | Sheet |

## classic-advanced — the printed sheet (standard)

| Printed field | Layout / app | Where today | Verdict |
|---|---|---|---|
| Name · Title · Class · Level · Alignment · Race | app + layout (`title` fill, `alignment`, `race`) | Heading, Identity | Sheet |
| Portrait, symbol or description | app portrait | Heading | Sheet (**?** shown) |
| Six scores and captions; ability-check line | layout + tiles | Abilities | Sheet; the check line **?** |
| Saves (five) and WIS modifier to magic saves | layout fills | Saves | Sheet; the WIS line **?** |
| HP · Max · CON modifier | app + vitals | Vitals | Sheet (the modifier in its breakdown: ct3-9) |
| AC · unarmoured AC · DEX modifier | layout fill + breakdown | Vitals | Sheet (via the tap, ct3-9) |
| Attack: THAC0 or attack bonus; melee and missile modifiers | layout fill + vitals | Vitals, Combat | Sheet |
| **Attack matrix** (descending AC: the to-hit row by AC) | — | — | **Missing** (05 says Tap Attack shows it with descending AC: **?**) |
| Adventuring skills: listen, open doors, secret doors, traps, forage, hunt (x-in-6) | — in the layout | Player screen skills **?** | **Missing from the layout** |
| Initiative DEX modifier (optional) · reactions CHA modifier | — | — | **Missing** (the initiative line is option-gated) |
| Languages · Literate | layout (`languages`, `literacy` fill) | Identity | Sheet |
| Abilities, skills, weapons box (weapon proficiencies and secondary skills, if used) | layout: `secondary skill` gated by its option; **`weapon proficiencies` not gated** | Identity, Combat | Sheet; **the proficiencies field ignores its option** |
| Movement: base, overland, exploration, encounter | layout `movement` (one text) | Combat | Sheet as one line; the three rates **?** |
| XP · Next · prime-requisite % | app | XP | Sheet for XP; **Next ?**; prime % (rc-1) |
| Equipment · weapons and armour · magic items · treasure | Pack | Pack tab | Tap |
| Coins (five metals) · treasure weight · equipment weight · total (optional) | purse M7b; Pack load | Pack tab | Coins **missing until M7b**; weights Tap |
| Other notes (spells, mounts, retainers, areas explored, clues) | Notes; spells on the Player screen | Notes, Player | Sheet / Tap (**spell book: missing**) |

**Item-encumbrance version (an optional rule):** equipped and packed slots, the STR slot modifier (optional), unencumbering items, the movement rate by slots used → Pack tab with slots (**?** each with the option on and off).

## Spells (Francis's concern)
- The Player screen shows **prepared** spells by level, only for a caster with slots or something prepared. A fighter shows nothing (right); a magic-user shows the day's spells.
- **No spell book** anywhere: the spells a character *knows* (the book, glamours, runes, knacks), with each one's entry. 05 plans it for M7 (M7-3); no screen is designed. **In scope for this review** (a mockup).

## Option-gated fields seen so far
- classic-advanced: `secondary skill` (gated), `weapon proficiencies` (**not gated**), initiative modifier (not on the layout), item encumbrance (Pack).
- fae-woodland: `moon sign` (gated), `liege` (not class-gated).
- The full list waits for the pack session's **options audit** (`plans/options-audit-2026-11-03.md`, to come).

## Next passes
- **Pass 2:** the seeded characters, every class, both campaigns per setting: each **?** above resolved, each field filled or blank, the option-gated ones toggled.
- **Pass 3:** recheck against the options audit.
- **Pass 4:** a fresh session re-checks everything; repeat until clean.
- Then the rulings with Francis, one at a time (the traits section, the spell book, the missing fields, the field-to-option rule for 07), and the model for future settings.

## Pass 2 (2026-11-03): the seeded characters on screen

Read-only screenshots on the test project (signed in as the seed GM and a seed player through a local script; the app at `main` with the test project's values): fae-woodland defaults (fighter and thief duskcat, magician elf, knight thistlekin, cleric human as a player) and classic-advanced defaults (fighter gnome, magic-user elf, thief halfling, the thief's Pack). The seeded scores are the dice average, so every modifier is 0; alignment and the optional fields weren't seeded.

**Resolved from pass 1**
- classic-advanced's **adventuring skills** do show (listen at doors, open stuck doors, secret doors, room traps, forage, hunt, each x-in-6) and the WIS modifier to magic saves; pass 1's "missing from the layout" was wrong.
- fae-woodland's kindred **Listen** target applies (a duskcat's 5); class skills (thief, magician's detect magic) show.
- A race's CON save bonus shows beside the save ("13 (+2 to the roll vs poison)"), as bq-8.
- The Pack tab shows worn and in-hand items, the backpack's contents with steppers, and carried items.

**Found (both settings unless named)**
1. **Movement as raw engine labels:** the Combat grid lists "Movement: combat · running · familiar · swimming · encounter · exploration" as six boxes, while the Movement section shows Speed, Exploring (blank) and Overland. Duplicated, unnamed in the pack's words, and **Exploring is blank** (fae-woodland: the layout's `movement.explore` vs `movement.exploration`, #337).
2. **Class skills in the Combat grid:** a thief's skills, a magician's detect magic and classic-advanced's adventuring skills sit under Combat, not under Skills.
3. **Spell slots as a raw list** ("1, 0, 0, 0, 0, 0"); **no spell book anywhere** on the full sheet (the magician's and magic-user's known spells); prepared spells only on the Player screen.
4. **Fields that should be hidden show as "—":** fae-woodland's **Liege** for every class (cs-3 `forClasses`), **Moon sign** for a duskcat (excluded kindred; ct3-4b); classic-advanced's **Weapon proficiencies** with the option off (of-9).
5. **No traits section** (cs-7): no kindred or race ability (shape-shifting, cold iron, infravision…) anywhere on the sheet.
6. **No XP, next level or prime-requisite %** on the full sheet (the heading shows the level only).
7. **Blank fills:** classic-advanced's **Literacy** "—"; fae-woodland's **XP modifier** "—" (rc-1, #347 not merged); **magic resistance 2** for an elf and a duskcat (the kindred part not added; ct3-12a).
8. **The Attack figure** reads "1" or "0" alone in fae-woodland (no label of what it is); classic-advanced shows THAC0.
9. **The Player screen's skill names are lower case raw ids** ("listen", "search", "survival").
10. **The heading names** are the class and kindred ("Fighter · Duskcat") because the seed gave no names; not a defect.
11. **Not seen:** coins (M7b), the attack matrix, initiative and reaction modifiers (classic-advanced), the item-encumbrance page (option off in these campaigns).

**Next:** pass 3 against the options audit (each option-gated field on and off, in the options-on campaigns); then a fresh session's pass; then the rulings (the traits section, the spell book, the Combat grid's contents, the field labels).

## Pass 3 (2026-11-03): the "options on" campaigns
fae-woodland options on (kindred-class elf, enchanter duskcat, knight elf, fighter burrowkin, friar human) and classic-advanced options on (ranger human, illusionist svirfneblin).

**Corrections to pass 2**
- **Magic resistance does include the kindred's part:** elves and duskcats read 2, humans and burrowkins 0, with WIS at 10. Pass 2's item 7 (magic resistance) is withdrawn.

**Found**
12. **Weapon skills twice** (classic-advanced, option on): a line under the heading ("Weapon skills · Battle axe, Club, Crossbow, Dagger ⓘ") **and** an empty "Weapon proficiencies —" field in Combat (the layout's text field next to the real picks).
13. **Moon sign "—" for kindreds that never get one** (elf, duskcat) even with the option on; humans and burrowkins show their sign (ct3-4b; of-9's hiding).
14. **Liege blank for the knight** and shown for every other class (cs-3: `forClasses` and the liege step not built yet).
15. **Known magic isn't on the sheet:** the enchanter's glamours and rune, a burrowkin's knack, the elf kindred-class's glamours appear nowhere; only "Spell slots" as a raw list for slot casters (item 3).
16. **The friar's AC** reads 10 (its armour-of-faith bonus not counted; cs-7, not built).
17. **Secondary skill** shows filled with the option on (works; and hides with it off is item 4's check).

**The design work this review now needs** (mockups `design/mockups/sheet/01-sheet-review.html`): the Combat block and the movement labels; the class skills' place; the traits section (cs-7); the magic section and spell book; advancement (XP, next level, prime %); and how option-gated fields read when present.

## Questions for Francis (proposals in `design/mockups/sheet/01-sheet-review.html`, `02-sheet-extras.html`)
One at a time, each A — Builder, B — Critic and a synthesis, when Francis is back:
1. **Combat and movement:** four captioned tiles (HP with hit dice, AC, Attack with melee and missile, Level with XP); one Movement section in the pack's words (speed, exploring, in a fight, overland), the rest folded under Speed.
2. **Skills in one place:** everyone's and the class's own, out of the Combat grid; the pack's names on the Player screen too.
3. **Traits (cs-7's layout):** A rows by source (recommended) or B cards.
4. **Magic:** A a Magic section on the full sheet with slots as pips and a tab per kind (recommended now), or B its own tab beside Player · Scene · Pack (decide with M7's Cast).
5. **Advancement:** XP with a bar to the next level, the prime bonus with its reason, the title.
6. **Identity:** fields show only when they apply (of-9, cs-3, ct3-4b), "—" only for an applicable empty field.
7. **The whole sheet's order:** play figures left (Combat, Saves, Movement, Skills), who they are right (Abilities, Traits, Magic, Identity, Advancement); a phone stacks and folds each to a summary line.
8. **Attack's tap:** the breakdown and, with descending AC, the to-hit row (the printed sheet's matrix).
9. **The Pack tab's load:** a bar per band with the band that sets the speed named; tiny items as their own group; coins with M7b.
10. **The model for future settings:** a written method (this note's passes) and a 07 rule: a setting's sheet layout covers its printed sheet; pack:check lists printed-sheet fields with no home (a checklist the pack session fills per setting).

The last pass (a fresh session's re-check) runs after these rulings, on the rebuilt sheet.
