---
status: absorbed
milestone: m5c (magic in play); mp-11 also changes M6
absorbed-into: docs/05-features.md (Spells; Abilities; Combat tracker: who changes hit points), docs/06-screens-and-design.md (the players' tabs), docs/07-content-packs.md (turning), docs/09-decisions-log.md (2026-11-05), docs/10-open-questions.md, docs/plans/magic-in-play.md, docs/plans/m6-fights.md
supersedes: 05 Spells as ruled 2026-10-28 (M7-3) where it differs (the slot grid's tap and hold; "Lost when hit" as a line on the damage pad; "Scrolls carried"); the fight screens review's "party damage is entered by the GM; the Player screen has no Take damage" (`m6-fight-screens-review-2026-11-01.md`, ⚑ B); a5-2 and ao-3 (turning's shape, now set); sr-4's open point (a tab for casters)
---

# Magic in play: rulings from the paper test (2026-11-05)

A paper dry run with Francis, thirteen steps walked in both settings (`design/notes/magic-dry-run-notes.md`; rough mockups `design/mockups/magic/01` … `03`). He confirmed the whole list. Ids `mp-1` … `mp-22`; the numbers in brackets are the walk's ⚑.

## Preparing

- **mp-1 The Prepare screen** [1, 3, 7]. Each spell has a − N + stepper (not tap-and-hold). A full level answers + with a pop-up ("Level 1 is full · take one out first"); nothing is swapped and no button is disabled. A prayer caster's list shows what is chosen first, the rest folded.
- **mp-2 Chosen is not yet ready** [2]. Prepare is open at any time; what is chosen becomes ready (castable) only at the next rest, or as the setting's rule says. The GM's rest prompt stays.
- **mp-3 The morning window** [4, 5]. When the rest is applied, each rested caster's screen prompts "Your spells are back · Same as yesterday · Choose…", and the GM's screen names who hasn't answered, blocking nothing. The window closes at the group's first move or time step after the rest, in the wilderness, in town and in a dungeon alike; there is no Break camp tap. Then yesterday's set becomes ready for anyone who hasn't answered, logged with Undo. **The app never picks a spell:** with no yesterday (a first morning, a new slot) those slots stay empty and the GM's line counts them; with fewer slots than yesterday the set carries as far as it fits, in the order chosen, and the log says what dropped.
- **mp-4 After the window: strict for the player** [6]. A change of mind or an empty slot waits for the next rest. The GM can fill or change anyone's spells at any time (logged, Undo).
- **mp-5 The GM's rest prompt** [38, 39]. Every caster carries a mark, ✓ (magic back) or ✕ (not), tapped to switch; a caster whose night was broken starts on ✕ with the reason in words. Per-day uses return to everyone at the new day; per-rest uses only to those who rested.

## Casting

- **mp-6 A spell's target stays narrative** [8, 11, 12]. Cast never asks who or where. The app records the cast, its duration and what the spell brings by itself (a light, a condition, a timer). The cast sheet opens only for a choice the app records: the form, for a class that chooses it at casting, and the number a conjuring spell brings. A spell's light shows as the caster's; the GM can move it. (For now; a spell may add to the list.)
- **mp-7 The reminder** [14]. After a cast that calls for a roll or a target, the caster's screen shows a reminder in words ("Roll it at the table and name your target"). The player enters nothing; the GM gets no shortcut.
- **mp-8 Timers and Undo** [9, 10]. Every spell with a duration puts a quiet timer on the track, even when the app tracks nothing else about it. A cast can be undone from the log by the player or the GM, under the log's usual rules.
- **mp-9 "Spell lost" is a reminder toast** [15, 16]. When a caster with ready spells takes damage and the setting has the rule, the caster's screen and the GM's show it ("Wren was hurt · a spell she was casting is lost"), in a fight or not. There is no list to tap and no separate "lost" state: the player marks the spell by tapping Cast. What a lost spell wrongly starts (a light, a timer) is ended by hand, for now. Declaring before initiative stays at the table.

## Hit points

- **mp-10 Players change their own character's hit points**, damage and healing alike; the GM can change anyone's [13]. The caster rolls a healing spell at the table and the target changes their own; the GM can say "you were all hit for 10" and each player changes theirs. **This reverses the fight screens review's "the GM enters all party damage" and returns to the fight dry run's ruling 6;** M6's Player tab and damage pad follow it.

## Turning and commanding

- **mp-11 Turning is a reference, with one shape for every book** [17, 21, 22, 23]. The class's turning ability points at a table (laid out by turner level and creature kind, or by roll bands); the trait opens the rule in a few words and the table with the turner's own row picked out; a second roll is described in words; outcomes and which creatures flee stay at the table. The pack supplies the outcome words; a note line carries a special case ("counts as tougher unless it serves the turner's own lord"), which the app never matches. Until M6's encounters exist the player works out a level-gap adjustment at the table.
- **mp-12 Help from the encounter** [18]. When an encounter has creatures the table covers, the GM's console shows the number needed for each; players see it on their own table as the campaign's "Monster AC and saves" setting allows. Needs each such stat block to name its column of the table (pack work) and M6.
- **mp-13 Turn, the log and the use** [19, 20]. A Turn button at the foot of the reference logs the attempt, with optional outcome chips that vanish if ignored. Where the rules or the campaign limit attempts, Turn spends a use that comes back when the setting says.

## Conjured creatures (with a5-5)

- **mp-14** [24, 25, 26, 27]. A conjured group is one row with a count; a member's hit points are tracked once it is hurt. Its caster's player changes its hit points. It travels with its caster and takes no place in the marching order. When control breaks, the GM moves it to the foes' side in one tap (ns-1); the app shows the control note and never decides.

## Other kinds of magic

- **mp-15 Use** [28]. A power with uses shows them and a Use button. A power with no limit gets a Use button only when using it starts something the app tracks; otherwise it is a reference row.
- **mp-16 Uses that come back by the calendar** [29, 31]. Weekly and yearly uses return when the campaign's date passes that mark, by themselves, with a log line. A "once ever" use stays spent (the GM can restore it); the spent power leaves the Magic tab and is listed on the full sheet's Magic section ("Spent for good").

## Scrolls and found spells

- **mp-17 Scrolls** [32, 33, 34]. Read and Copy into book live on the scroll's item sheet in the Pack only (a player who wants it close pins it to At hand); there is no Scrolls list elsewhere. Copied or Failed is tapped by the player after rolling at the table. A book's limit is shown in words and never enforced.
- **mp-18 Giving a found spell** [35, 36, 37]. Give a spell… on a character's Magic section lets the GM pick several characters at once. Everyone's log names the spell; only its rules text stays private to those who hold it (refines us-2). For a prayer caster the spell joins the list they may pray for.
- **mp-19 A shrine's extra blessing** [40] is given by the GM with the same action, as one extra ready spell outside the normal slots, lasting until cast and named for its source.

## Where magic lives

- **mp-20 A fourth tab, Magic** [30, 42]. A character with any magic gets a fourth tab beside Player, Scene and Pack: ready spells with Cast, Prepare ›, and the other kinds of magic each as its own list in the pack's words. The Player screen no longer carries a Spells section; powers with uses that aren't magic stay in its Traits list.
- **mp-21 The sheet beside the play column** [41] has no Prepared tab in its Magic section (the same spells are one column away); opened on its own, it has.

## Parking lot

- **mp-22 (not ruled; try at the table test)** a "No effect" tap on the cast toast that keeps the spell spent and blocks what it would start.

## For the pack session

Each turning ability: its table (bands written as a table where the book gives none), the outcome words, the limit on attempts and when it comes back, any special-case note; each creature the table covers names its column. Nothing else: the rest reads fields the packs already carry.

Docs to update: 05 (Spells, Abilities, Combat tracker), 06 (the players' tabs; components when built), 07 (turning), 08 (M5c's line), 09, 10, `plans/magic-in-play.md`, `plans/m6-fights.md`.

09: 2026-11-05 — [sheet] Magic in play, from the paper test: Prepare with steppers, open any time, ready only at the next rest; a morning window that closes at the party's first move, then yesterday carries over and the app never picks; strict after it, the GM able to fix (mp-1 … mp-5) — The table chooses while it talks; nobody is caught without spells; the books' hour of study is kept — `design/rulings/m5c-magic-in-play-2026-11-05.md`
09: 2026-11-05 — [sheet] Casting: targets stay narrative, a sheet only for the form or a conjured count, a reminder in words to roll, a timer for every duration, Undo from the log; "spell lost" is a reminder toast and the spell is marked with Cast (mp-6 … mp-9) — Each spell works differently; the app keeps score and reminds, the table decides — same file
09: 2026-11-05 — [fight] Players change their own character's hit points, damage and healing alike; the GM can change anyone's (mp-10; reverses the 2026-11-01 "the GM enters all party damage") — It saves the GM time: "you were all hit for 10" and each player changes theirs — same file
09: 2026-11-05 — [sheet] Turning is a reference with one shape for every book (a table, the turner's row, outcome words, a limit, a note); the GM always sees the number for the encounter's creatures, players as "Monster AC and saves" allows; Turn logs the attempt and spends a use (mp-11 … mp-13; settles a5-2, ao-3) — A shape per rulebook was the worry; one covers three books — same file
09: 2026-11-05 — [sheet] Conjured companions: one row per group, the caster's player changes their hit points, they travel with their caster, the GM moves one to the foes' side when control breaks (mp-14); powers get Use only with uses or something tracked; weekly and yearly uses return by the calendar; a spent once-ever power is listed only on the sheet (mp-15, mp-16) — Nothing to tap unless it changes the game — same file
09: 2026-11-05 — [items] Scrolls are read and copied from their item sheet in the Pack; Copied or Failed is the player's tap; a book's limit is words only; the GM gives a found spell to several at once, its name public and its rules private; a shrine's blessing is one extra ready spell (mp-17 … mp-19) — The Pack already holds the scroll; limits are the table's — same file
09: 2026-11-05 — [ui] A character with magic gets a fourth tab, Magic, with a list per kind; the Player screen drops its Spells section; the sheet beside the play column drops its Prepared tab (mp-20, mp-21; settles sr-4's open point) — A caster's Player screen had become a long scroll — same file
