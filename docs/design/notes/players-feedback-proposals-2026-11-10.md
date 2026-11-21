# Players' feedback of 10 November: what exists, the gaps, and what Design proposes

Written by the design agent, 2026-11-10, on Francis's ask ("much of this may already be in the app; incorporate gaps and propose new changes"). The feedback itself is in three intents: `intents/2026-11-10-scars-chronicle.md`, `intents/2026-11-10-players-feedback.md` (P-1 … P-4), `intents/2026-11-10-zoom-levels.md` (1 … 12). **Nothing here is ruled.** Each proposal names the design session that should take it; none is built before the M5b gate passes. "Planned" was read from 08's rows and the specs' lines by search, not by a full read of every section.

## The idea underneath most of it

Three of the four intents ask for the same thing from different sides: **a thing the party can come to know, fact by fact.** A place, a person, a faction, a rumour. The app already does this for places: a place card has pieces, and the GM shows each one to the players when they learn it ("What we know" lists them). The proposals below extend that one mechanism instead of adding four trackers.

## What exists, what is planned, what is missing

| Asked for | Built today | Planned, and where | The gap |
|---|---|---|---|
| A larger portrait on a tablet (P-1) | A small round portrait beside the title line | — | The whole of it; small |
| A chronicle of scars | Score edits approved by the GM; one free "Scars and marks" line; traits by source | Statuses that change figures (after the gate, from the rewalk's F25) | A dated entry with an optional effect; a history to read back |
| A persistent look-up of people and factions (P-3) | — | NPCs and factions "with Introduce and status", Handouts with People (M8b, inside an adventure) | A players' reference screen that outlives the adventure; relations |
| The GM's living world: agendas and progress (P-3) | — | A timeline and tracks (M8b, for an adventure); organizations (M9) | A faction's agenda as steps the GM advances; nothing ties it to time passing |
| Downtime at a glance: who is where, doing what (P-2) | Start downtime and End downtime (a full rest) | Downtime in M7; its second stage waits for a design session (G-178 … G-188) | The one view; a character's place and activity during downtime |
| Quests and rumours (P-4) | — | Rumours from the pack (M8b); the Notes session (after the gate) | The party's own tracking: heard from whom, open or done |
| Notes tagged to a place (zoom 10) | Notes on a character; the GM's notes on a place | The Notes session | A note attached to a place, a person or a faction |
| Known locations (zoom 9) | "What we know"; a known place offered at Start expedition | The location browser with search and recently visited (M8b) | Mostly covered; the look-up outside an expedition |
| Facts learned one by one (zoom 12) | A place's pieces, shown one at a time | The same for an adventure's places (M8b) | The same for people, factions and rumours |
| The closest level: a fight, split parties, several fights (zoom 3, 4) | A split party: a group per place, each with its own budget and prompts | Several fights exist at once, one run at a time, the others paused (M6) | Possibly none; to test with a split-party case |
| The site level: a dungeon, a village, a neighbourhood (zoom 1, 5) | The place card and its pieces; the dungeon and settlement modes; the town screen | Two-layer locations, rooms and exits, adventure maps in the map panel (M8b); players' map-tap navigation and fog (R2) | A map the players see is R2; the rest is planned |
| The region level (zoom 6, 8) | Wilderness travel on the region pack's roads and places | Hex grids, roads and tracks as routes (M8b); the hex-map and point-to-point session | Covered by that session |
| The world level (zoom 7) | — | — | The whole of it |
| A side bar of what is known at each level (zoom 11) | — | Tablet panels, activity and reference (ruled 2026-11-09, mockup and play test owed) | What the reference panel holds at each level |

## What Design proposes

1. **One record for everything knowable (people, factions, rumours and quests, beside places).** Each has facts; the GM shows a fact when the party learns it; a hidden fact never reaches a player's device. People and factions gain two more things: relations (to the party, to each other, a person to a faction) and, for the GM only, an agenda. *Takes:* M8b's design, which already plans Introduce and status. *New work:* relations; rumours and quests as records; the agenda.
2. **Two reference screens, as Francis ruled:** the players' ("what we know", grown from today's list into sections by kind) and the GM's (the same records with their hidden facts and agendas). They stay after an adventure ends. *Takes:* M8b's design; the players' screen is a candidate for the tablet's reference panel.
3. **The living world as agendas with steps.** A faction's agenda is a short list of steps; the GM marks one done, by hand or when prompted at downtime ("three weeks pass: anything move?"); the log keeps it; a step can reveal a fact to the party. The app never advances one by itself. *Takes:* downtime's second-stage session, with M9's organizations in mind so a party's own organization and a faction are the same kind of thing.
4. **Downtime at a glance.** One screen for the time between adventures: the known places that matter, each character under the place they are in with what they are doing and until when, and for the GM the agendas due a look. *Takes:* the same downtime session; it is the screen that session was missing.
5. **Zoom as moving between views that already exist, not a new engine.** Four distances: Fight (M6), Site (the location view), Region (travel), World (new). A way to step in and out, and the reference panel showing what is known at that distance. A map shows where the pack or the GM supplies a picture; where there is none the level is a list. **Ruled by Francis the same day: no virtual tabletop for now; a mini map showing where the party is, for wilderness and dungeon exploration, is fine and wanted.** So a map here is a visual aid with the party's place on it, never a board the table plays tactics on. *Takes:* the hex-map and point-to-point session, widened by one question (the levels and how to move between them).
6. **The world level as a picture with known places pinned,** nothing more, for travel decisions. *Proposed for R2,* unless the hex-map session finds it falls out of the region view for free.
7. **Several fights at once:** keep M6's rule (one run at a time, the others paused) and add a split-party case to the fights paper test before deciding more.
8. **Notes that attach.** A note can be tied to a place, a person or a faction and shows on that record; a quest or a rumour is a record (proposal 1) that notes attach to, with a state (open, done, false). Who may tag: to rule. *Takes:* the Notes session.
9. **Scars as lasting marks, on the same mechanism as statuses that change figures.** One entry kind: a name, what happened, the campaign date, an optional effect that shows as a named row wherever that figure is explained, and no end. The GM adds one; a player may propose one for approval. A homebrew pack supplies a table of them. A "Chronicle" on the full sheet lists them in order with the score changes they explain. *Takes:* the statuses-and-figures design (after the gate, before fights, since a fight is where most are earned).
10. **The portrait:** on a tablet, tap the portrait to enlarge it to the column's width, the title line moving below it and everything else shifting down; remembered on the device; small by default; no portrait, no block. *Takes:* a small mockup and one pull request after the gate.

## Order Design suggests

After the gate, by what unblocks building: (9) with statuses, since magic in play and fights both lean on figures; (10) as a small filler; (1), (2), (5) and (8) into the M8b and hex-map design, which comes before the first full-table test; (3) and (4) into downtime's second stage; (6) and a players' map to R2.

## What this would add to the plan

Nothing here needs a new milestone. Proposals 1, 2, 3, 4 and 8 add scope to design sessions that are already owed (M8b, downtime, Notes); 9 adds to the statuses piece; 5 adds one question to the hex-map session; 6 and 10 are new and small. The first forecast that includes them is the one already owed (`design/notes/forecast-proposal-2026-11-04.md`).

## The player's answers (2026-11-10, relayed by Francis)

Design asked eight questions; the answers are condensed here, the player's own words in quotes.

1. **Portrait.** An individual preference, kept on the device: "if I want to see someone else's portrait, that stays big for me too". So the choice follows the viewer, not the character.
2. **Scars.** A list in order, "with a bit more detail: to an ogre while exploring some ruins when questing for X". "Yes, players should see each other's things."
3. **People and factions.** "Easy reference mid session, when deciding who to see next, or why, without scouring notes." All of it (who they are, where met, how they feel about us, what they want), "categorized".
4. **Relations.** "Just about the party, and only as far as we have learned how they feel about us, about individual members." Politics between factions only "to the extent that we learn" it and it matters to the campaign: "can't assume knowledge, unless of course it's public domain knowledge". An idea: "perhaps each faction has levels of 'secrets' to it? Public, private, leadership only, top secret, as example."
5. **Downtime.** See and set your own activity: "yes, exactly right". And tags that shortcut to what matters about the place people are in or the person they are talking to: "easy context reference mid session without digging around or clicking around too much".
6. **The mini map.** "Only see explored parts", with two levels of the unknown: a general layout "because perhaps we got a rough map, or an NPC gave us a rough layout description, but still covered by fog of war", or "complete blank because we know nothing". Once explored it shows the party. Important locations marked, "subject to either prior knowledge or direct discovery". "Again, tags tags tags!"
7. **A fight without a board** ("barring a fight map, perhaps slated for v3"): a clear list of who is in the fight and who is not, their health, and "an idea of mob health (healthy / bloodied / dead / disabled)"; for the disabled, "a counter for when [they] will come back"; ongoing spell effects, on an area and on individuals; area effects that aren't spells (difficult ground, darkness "unless dark vision / light source"). **The order, broad to detailed:** lasting area effects first, then area spells, then the participants with their statuses and spell effects. And "a clear marker in the top corner of how many turns have elapsed", in every view: a fight in turns, exploring a dungeon or a city and downtime in elapsed time, the world in days.
8. **Quests, rumours, notes.** Both: "GM could submit the root/baseline. Players should be able to add to it." Links from them to free-form session notes. The party's notes are visible to all; each player also has private notes "indexed to these": "private never seen by others besides GM". **And an extension:** players see each other's sheets and inventory, but "should be able to mark items as private (except for GM)": "I steal something from my party member's backpack while they are sleeping or disabled; all they know is that it's gone, not that I have it."

### What the answers change

- **Tags are the thread.** Asked for three times: a way to get from any mention of a place, a person, a faction or a quest to what the party knows of it, in one tap, mid-session. Proposal 1's records need **links between records and from notes to records**, and the reference shows what is linked to where the party is now. This is the feature that turns four lists into "easy context".
- **Proposal 10 (the portrait):** the enlarged setting belongs to the viewer and applies to any character they look at.
- **Proposal 9 (scars):** an entry holds a few lines of story (who, where, on what quest), and other players can read it.
- **Proposal 1 (records):** relations are recorded toward the party and toward single characters; a fact about two factions is a fact like any other, shown when learned.
- **Proposal 4 (downtime):** a player sets their own character's activity there.
- **Proposals 5 and 6 (the mini map):** three states of a place on the map: unknown (blank), known roughly (a layout under fog), explored (drawn, with the party on it); a marked location needs prior knowledge or discovery.
- **Proposal 7 (fights):** input for M6's design: the list's order from area effects down to each participant; who has left the fight; a counter on anyone disabled; the elapsed count in the corner of every view (the time strip already shows the turn and day; a fight needs its rounds there too).

### New questions the answers raise (⚑, for Francis)

- ⚑ **A foe's condition in words.** Hard rule 5 hides monster hit points from players. The player asks for a band (healthy, bloodied, disabled, dead), not the number. Proposed: a campaign setting, as "Monster AC and saves" is, that sends players only the band, in the pack's words where it has them. Needs his ruling because it changes what a player's device receives.
- ⚑ **Open sheets with private items, and theft inside the party.** Today another player's purse is hidden and a Down or dead character's pack opens to the party. The player asks for the opposite default (everyone sees everyone's sheet and pack) with a private mark on single items, and for an item to be able to leave one pack and enter another with the loser told only that it is gone. That touches hard rules 4 and 5: the take is logged, but the log line and the item must be hidden from everyone except the taker and the GM. A large permissions design; proposed for after R1 unless he wants play between party members sooner.
- ⚑ **Levels of secrecy on a faction's facts** (public, private, leadership only, top secret). Proposed: a label on each fact for the GM's own bookkeeping, with "public" facts shown as soon as the faction is introduced; players still see only what has been shown. Whether the labels are fixed words or the pack's.
- ⚑ **Private notes "indexed to" a record:** a player's own note on a quest, a place or a person, seen by them and the GM only. Proposed as part of proposal 8.

### Francis's rulings on the answers (2026-11-10)

- **The feedback goes into the design sessions.** "We won't do everything he asks but we should incorporate his ideas into design sessions; many of them are great ideas, and as an end user he deserves priority feedback." Each owed session (statuses and figures, M8b and hex maps, downtime's second stage, Notes, fights) starts from this note's relevant rows.
- **Hidden information stays as it is ruled.** "We will use hidden information the way we've outlined it. So assume his responses and ideas obey those rules." So: no open sheets by default, no private mark on items, no theft inside the party that the log hides from the loser; other players' purses, monster hit points and the GM's notes stay as hard rule 5 and its named exceptions say. The second ⚑ above is closed: not taken up.
- **Tags: yes.** "I like the tags idea too." Links between records and from notes to records are part of proposal 1 and of the Notes session.
- **"Mini map" is a working word only.** "Mini map is not the final term, but does convey the idea. I don't want it called that on the app." Its name on screen is to choose with the words guide when it is designed.
- **A foe's condition in words: not for now.** "Tough to convey, and today I do it narratively. We can bounce ideas for this in a design session, but for now the combat outline we've written stands (with review)." The first ⚑ above is closed for now: no setting; monster hit points stay hidden, and the fight screens stay as M6's plan has them. The player's list order and counters are input for M6's review.
- Still open: the secrecy labels on a faction's facts and private notes tied to a record (the third and fourth ⚑), for their sessions.
