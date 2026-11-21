# Gate run cast: which seeded campaign and characters for each part (M5b)

For the hand walk of `docs/testing.md` "M5b — gate run, in play order", checks 17–52 (Francis, iPad landscape plus a 375 px phone). One line per part. Campaign names are the app's: "Seed · <pack> · <mode>" (`npm run seed:test`; docs/testing.md, Seeded test campaigns). Rebuild the seed from the newest packs first (check 65), and expect the characters below to be the ones the rebuild makes: classes are named, not the kindreds, which the seed rotates.

**Accounts:** the seed GM is the GM; "Player A" is the first seed player (owns every other seeded character, starting with the first class alphabetically), "Player B" the second. The second seed account shows under the GM's own display name on the Players list: give it its own name before the walk, or the two are hard to tell apart.

| Checks | Campaign | Who | Notes |
|---|---|---|---|
| 1–8 library, new campaign | any; make "Walk test" with classic-advanced and the zine overlay | GM | Retire the walk campaign afterwards. |
| 9–13, 15 guided creation, classic-advanced | "Seed · classic-advanced · defaults" | Player A, iPad | Make a new character (+ Make another character → Guided); the GM approves it. |
| 12 weapon proficiencies | "Seed · classic-advanced · options on" | Player A | The step only appears with its option on. |
| 14 fae-woodland on the phone | "Seed · fae-woodland · defaults", and "· options on" for kindred-as-class | Player B, phone | Class with a trait list and a book-magic caster (first spells from the table). |
| 16 an add-on class | "Seed · classic-advanced + deathcaster overlay · defaults" | Player A | The overlay's class reaches its races. |
| 17–26 day 1: travel, weather, forage, camp | "Seed · fae-woodland · defaults", Wilderness mode | GM; Player A's Fighter; Player B's Thief | The trek's own pieces (Cut reeds, Scout ahead, camp, watches) are in the **invented fixture**, not the real packs: import `scripts/fixtures/m5b-creation.fixture.json` by hand on top of a campaign. The seed does not build a fixture campaign. |
| 27–29, 34 day 2: lost, encounters | same campaign | GM; both players | Split the party with Player B's character. |
| 30–33 the ruin: dungeon mode, rest, light, statuses | same campaign, Dungeon mode | GM; Player A's Magician for the light and rest prompts | |
| 35–40 day 3: reference, messages, end of expedition | same campaign | GM; Player B on the phone for the message | |
| 41 every screen at 375 px; 42 hidden stays hidden | "Seed · fae-woodland · edge cases" (the eight edge-case characters) and the defaults campaign | Player B on the phone; the GM's notes and unshown pieces made first | The long name (character B) and the empty character (G) are the 375 px tests. |
| 44–51 day 4: a town | "Seed · fae-woodland · defaults" | GM; Player B | Needs a place marked Safe with shops shown. |
| 52 a setting with no settlement mode | "Seed · classic-advanced · defaults" | GM | A place marked Safe shows the town screen. |
