---
status: absorbed
milestone: m5b
absorbed-into: docs/04-data-model.md (`startLevel`, cw-3), docs/05-features.md (Creation: Help me choose, cw-4; cw-9, cw-13), docs/06-screens-and-design.md (cw-5, cw-7, cw-8, cw-13), docs/07-content-packs.md (`creationGuide` help, cw-4; `alsoFills`, cw-5; IP rules, cw-10); docs/09-decisions-log.md (2026-11-06); cw-1, cw-2 overtaken by cw-11; cw-6 is pack content
supersedes: cr-6's three-part shape of Help me choose ("What this decides · What to weigh · If you're unsure"); 09 2026-10-26 "Any class can take any kit" (the setting is removed); the hidden alignment for a class that may not take it (cs-3: now a not-allowed row)
---

# Creation, from the M5b gate walk: words and small rules (design ruling, 2026-11-06)

Ruled one at a time with Francis during the gate walk (`docs/design/notes/gate-m5b-walk-2026-11-05.md`). Ids `cw-1` … `cw-10`. **To build today, at priority:** cw-4, cw-8, cw-9, cw-7, cw-3. The players' remote creation round goes out when they are live.

## Ruled

- **cw-1 (A) The creation layout rework comes after the gate,** as one step, mockups first: the phone layout, the review screen, long lists folded, choices above given items, full ability names and centred steppers, a kit's choices in a pop-up.
- **cw-2 (C) It runs alongside M5c:** Design draws the mockups while magic in play is built; the rework is built in the first gap. M5c → M6 stands.
- **cw-3 (A) Starting level defaults to level 1;** "Player proposes" stays as a choice.
- **cw-4 (A) Help me choose is one short paragraph, no labels:** what the term means, what it decides, then a closing line for the unsure player, ending "or ask your GM" where a GM can help. The app's twelve texts are below. A pack's own step help (`guide.help`) follows the same shape (to the pack session).
- **cw-5 (A) The liege is a pick row like any other:** the house's name opens its entry; **Pick** sets the liege and the alignment with its reason. (After the gate, with the rework; the pack must carry each house's entry.)
- **cw-6 (A) fae-woodland, buying starting equipment:** buying replaces all given gear (general, class and adventuring items); the trinket is still rolled. A reading of the book, Francis's call; done in the pack (0.3.64).
- **cw-7 (A) Derived fields on Who they are start folded on every width** ("Derived fields · N ›"); a tap opens them and the device remembers; the review shows them in full.
- **cw-8 (B) An alignment a class may not take is a not-allowed row,** not hidden and never greyed: full contrast, ▲ and the reason on the row ("Not open to <class>"), no Pick; tapping the row or its name explains in a pop-up (the pack's reason when it has one, else "<class> can't be <alignment>."). Never a disabled button stands, no new exception.
- **cw-9 The app's "Any class can take any kit" setting is removed** (Francis). Class kits only; the stored value is ignored and the row leaves App settings and Rules. No migration: nothing is dropped.
- **cw-10 Test content leaves the packs:** a pack carries nothing written for the app that isn't in its book (classic-advanced's five test kits removed, 0.6.75). The gate's kit checks use a real pack's kits.

- **cw-11 The creation rework is done now, not after the gate** (Francis, later on 2026-11-06, after making a character on the live site: "I want the character creation rework done now"). **Supersedes cw-1's "after the gate" and cw-2's "alongside M5c".** Mockups still come first; the plan is `docs/plans/m5b-creation-rework.md`.

- **cw-12 (A) Affiliation stays one free-text line; a knight's starts as their liege's house,** still editable (fae-woodland's sheet; the book prints the line and never defines it). Its help line is reworded and "comes from play" goes. **After the gate, to design** (Francis): a character may have several affiliations, each with its own relationship level: an "Add affiliation" button that opens a pop-up, and an editable list on the sheet.

- **cw-13 (B2) Leaving creation early keeps the picks on the device.** Before Who they are nothing is saved to the campaign (a draft needs a name); **Leave** remembers the scores and picks on that device, for that player and campaign, and says so in a toast; the next Create offers **Continue where you left off** or **Start again**. Lost on another device (accepted). A full draft from step 1 is large and not part of the rework. No confirm dialog on Leave.

## cw-4: the texts (`APP_HELP` and `GEAR_HELP`)

Plain paragraphs; no headings, no bold. Where a setting has its own word (kindred, race, alignment), the step's title already shows it; the text names both.

| Key | Text |
|---|---|
| `method` | Your setting can build a character in more than one way. In some, you choose your people (your kindred, or race) and then your class, the adventuring trade you follow. In others, one choice covers both. This step only sets how many choices come next. If you're unsure, take the first one, or ask your GM which the group is using. |
| `scores` | Ability scores are the numbers that say what your character is naturally good or bad at: strength, quickness, wits and so on. You roll them at the table, as your setting says, and type in what you rolled. They decide which choices are open to you later, and they give small bonuses or penalties that follow you everywhere; each tile shows what its number changes. If you're unsure, keep them as rolled, or ask your GM. |
| `race` | Your kindred (some settings say race) is the people your character was born to. It decides what your body can do, which languages you start with, and which classes are open to you. Tap a name to read about it before you pick. If you're unsure, read two or three and pick the one you'd most like to play, or ask your GM. |
| `class` | Your class is your character's trade as an adventurer: a fighter, a thief, a spell-caster and so on. It decides how you fight, what you can learn, what you may wear and carry, and how fast you gain levels. Tap a name to read about it before you pick. If you're unsure, pick the class your best score suits, or ask your GM. |
| `adjust` | Some settings let you trade points between scores before you start: you lower one score to raise another that matters more to your class. A higher score in your class's main ability usually means you gain experience faster. The tiles show what you may lower, what you may raise, and what each change costs. If you're unsure, trade nothing and tap Next, or ask your GM. |
| `who` | Here your character gets a name, an outlook and their starting hit points. Hit points are how much harm they can take before they fall. The outlook (your setting may call it alignment) is where your character stands on the world's big questions; it matters to some magic and some places, and only you and your GM see it. If you're unsure, pick a name you'll enjoy saying out loud and the outlook that sounds most like them, or ask your GM. |
| `spells` | Your character starts with a few spells already learned. They are the only spells you can cast until you find or learn more, so they shape your first adventures. Tap a spell's name to read what it does. If your setting has you roll for them, roll at the table and tap what you rolled. If you're unsure, pick the ones you can picture using on your first adventure, or ask your GM. |
| `traits` | These are details from your character's life before adventuring: a trade, a home, a mark of birth. Most are flavour for the table; a few give a small knack. If your setting has you roll, roll at the table and tap what you rolled. If you're unsure, roll and take what comes, or ask your GM. |
| `languages` | Languages are the tongues your character speaks, and reads if they can read. They decide who you can talk to without a go-between and which old writings you can make out. Some come with your kindred; here you choose any extra ones. If you're unsure, ask your GM which tongue is most spoken where your first adventure is set. |
| `weaponSkills` | Weapon skills are the weapons your character has trained with. You fight normally with those; any other weapon is clumsier in your hands. Your class sets how many you may choose. If you're unsure, pick the weapons you expect to carry, one for close fighting and one for range, or ask your GM. |
| `details` | These are touches that help the table picture your character: looks, manner, a belief, a keepsake. None of them change the rules. Fill in what you like, roll for the rest, or skip the step; you can add them later from your sheet. If you're unsure, skip it. |
| `GEAR_HELP`, when the campaign offers a kit | Gear is what your character carries into their first adventure: armour, weapons, light and food. A kit is a ready-made set that covers the basics in one pick; the shop lets you choose item by item with your starting coin. What you carry has weight, and a heavy load slows you down: the load line shows it as you add. If you're unsure, take a kit, then check you have light and food, or ask your GM. |
| `GEAR_HELP`, when it offers no kit | Gear is what your character carries into their first adventure: armour, weapons, light and food. You buy it item by item in the shop with your starting coin. What you carry has weight, and a heavy load slows you down: the load line shows it as you add. If you're unsure, buy armour and a weapon your class can use, then light and food, or ask your GM. |
| `GEAR_HELP`, when gear is given and nothing is bought | Gear is what your character carries into their first adventure. In this setting it is given or rolled, not bought: the step shows what you start with and asks only for the rolls and choices your setting leaves to you. If you're unsure, roll at the table and tap what you rolled, or ask your GM. |

## For the builder (today)

1. **cw-4:** replace the texts; the Help me choose box renders plain paragraphs (no bold lead-ins left over). `GEAR_HELP` becomes a choice of three by what the step offers. Tests: no text holds "What to weigh"; the no-kit campaign's text doesn't name a kit.
2. **cw-8:** the alignment list shows a not-allowed row for each alignment the class may not take, as the not-allowed class row already does (06 row states: requirement not met / not allowed). Tests: a Church class sees the row, can't pick it, the pop-up explains; a draft that held that alignment before a class change says so at Next, as today.
3. **cw-9:** remove the setting from App settings, Rules for this campaign, the kit filter and the tests; `logged_commands` unchanged unless a command goes (say so if one does).
4. **cw-7:** `DerivedFields` starts folded on every width; opening is remembered per device (as the sheet's sections).
5. **cw-3:** the new-campaign default for starting level is level 1.
6. **Scope checks:** nothing from cw-1's rework list; no layout change beyond these.

## Docs to update (when absorbed)

05 (creation: Help me choose, alignment, Derived fields, kits; App settings: starting level, the removed kit setting), 06 (row states; words and voice: Help me choose), 07 (a pack's `guide.help` shape; test content), `docs/testing.md` (checks 3, 11, 13, 53, H2-53; the fixture out of the set-up), 09.

## 09 lines

- 2026-11-06 — [words] Help me choose is one short paragraph without labels: what the term means, what it decides, a last line for the unsure player ("or ask your GM") — a new player needs the terms explained, not a framework (M5b gate walk, cw-4)
- 2026-11-06 — [ui] An alignment a class may not take shows as a not-allowed row (▲, the reason, explains on tap), not hidden and not greyed — the player sees the option exists and why it's closed; never a disabled button keeps one meaning for grey (cw-8)
- 2026-11-06 — [items] The app's "Any class can take any kit" setting is removed; class kits only — Francis, M5b gate walk (cw-9; supersedes 2026-10-26)
- 2026-11-06 — [sheet] Derived fields on Who they are start folded on every width and the device remembers; the review shows them in full — one behaviour instead of one per width (cw-7)
- 2026-11-06 — [core] Starting level defaults to level 1; "Player proposes" stays a choice (cw-3)
- 2026-11-06 — [packs] A pack carries nothing written for the app that isn't in its book; classic-advanced's test kits removed — Francis (cw-10)
- 2026-11-06 — [packs] fae-woodland's buying option replaces all given gear; the trinket is still rolled — the plainest reading of an option the book doesn't spell out; Francis's call (cw-6)
- 2026-11-06 — [process] The creation layout rework is one step after the M5b gate, mockups first, drawn alongside M5c — the screens work; the complaint is how they look and scan (cw-1, cw-2)
