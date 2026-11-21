# 01 — Product Brief

**Name:** the app (currently **Nemeton**, pronounced NEM-eh-ton), from the Gaulish word for a sacred place or grove where people gathered. Kept easy to change: the name never goes into database names, ids, code identifiers, the repo name or the pack format. The repo stays `grimoire`; the pack format ID stays `tabletop-pack`.

## Vision

One shared, always-current record of the party (who they are, what they carry, what they own, who works for them, what happened) so the table spends its time **playing and talking, not doing paperwork**. Tabletop games are about people, not tablets.

## Prime directive

Limit paperwork and distraction to maximize in-person play and conversation. Every screen, feature and notification is judged by: fewer taps, less reading, eyes back on the table.

**What the app is for (ruled 2026-11-01, M5 gate R3):** it speeds up bookkeeping, record-keeping and rules lookup so players get off their screens and into the narration. Pop-ups and reminders earn their place when someone might miss something or must act quickly. The app doesn't aid narration, except by revealing room descriptions and visual aids (maps, pictures, handouts). During play a player's screen is a live view of the table (clock, light, place, marching order), and players are prompted when they must act rather than left to look for things to do.

## Who it's for (R1)

- **Your group only:** 3–6 players plus one GM, OSR-style play with hirelings, domain play and downtime.
- **Devices:** tablets (iPads) for the GM and, mostly, the players (ruled 2026-11-01, R2); phones fully supported; an optional shared screen (TV or spare tablet).
- **Play pattern:** sessions mostly in person; occasional remote play with players on a voice chat; downtime often remote and asynchronous.
- Everyone has their own login. Each campaign is fully separate.

## Design principles

1. **Glance, don't read.** The most-used info is visible without tapping.
2. **One-tap common actions.** HP, XP, coins, light and time are big +/− controls, not forms.
3. **Calm screens.** Large type, few elements, no clutter, no tiny text.
4. **Rules-agnostic and IP-clean.** The app ships with no game system's rules, tables or numbers. The GM defines or imports them as private content packs. The app ships with almost no rules of its own; rules come from setting rules and homebrew. Where the app still has a default (containers add capacity, side initiative and so on), it's a fallback, used only when no attached pack says otherwise.
5. **Logged and reversible.** Every change is recorded with who and when, and can be rolled back. Simple log by default, verbose on request.
6. **The GM has final say.** Fiat can overrule any rule, result or vote, and is logged.
7. **The party governs itself.** Titles, charter and votes are the players' tools, and the app requires a vote only for charter changes, joining the company, and creating or assigning titles.
8. **No AI required.** The finished app runs without any LLM. AI features are optional add-ons, off by default.
9. **Built for modules.** R1 is a small core designed so later modules plug in without rework.
10. **Your data is yours.** Export everything as JSON at any time.
11. **Downtime is narrative.** Players propose what they want to do in their own words; the GM explains how it would work; the player accepts, asks for a change, or declines. The app records and carries that conversation; it does not reduce downtime to a menu.
12. **Homebrew is first-class.** A GM can make a homebrew pack (rules, setting, adventure or anything else) and load it alongside other setting rules. Where they conflict, homebrew wins by default; the GM can change which one wins, entry by entry, in the setting-rules browser.

## R1 (MVP) focus: player tracking and adventuring

See `08-roadmap.md` for the full release plan. In short, R1 delivers:
- Accounts, campaigns, GM and players, companies, titles (hats; Treasurer and Archivist carry powers)
- Characters with GM-defined fields, portraits, XP awards and level thresholds, personal purses, inventory with containers, encumbrance (none, armour, coin **or** slot, chosen per campaign)
- Character creation: **guided** from the rules pack, or **freeform** for tables without one.
- Adventure mode and Downtime mode
- Expeditions: rounds/turns/days, GM-defined time triggers, light sources, marching order
- Combat tracker with statuses and stat blocks
- Optional GM add-ins: monster disposition, surprise and encounter tables (data from rules packs, results entered by hand)
- Party fund ledger, Split Loot, editable party charter
- Voting mini-app
- Fiat, campaign log with notes (simple/verbose), rollback
- Content library (items, classes, rules, stat blocks) via upload and in-app editor
- Basic hirelings, holdings, organizations and long-term projects
- Scene tab: the shared view on every player's device and on an optional tablet or small monitor for the table; offline reading of sheets
- In-app alerts; dictation for quick text

## Out of scope for R1

- Any built-in rules, tables or numbers from a published system
- In-app PDF parsing (conversion happens outside the app; see `07-content-packs.md`)
- AI features of any kind (planned for R4, with room left in the architecture)
- Email/SMS notifications (email R3, SMS later)
- Public sign-up, multiple groups (later, if ever)
- Native iOS/Android apps
- Dice rolling (dice stay physical, results are entered quickly)

## Success criteria for R1

- A player updates HP, coins or a torch in ≤2 taps.
- The GM advances time in 1 tap; nobody tracks light on paper.
- Entering initiative for a combat takes under 15 seconds.
- End of session wrap-up (XP, loot, log) takes under 3 minutes.
- After two real sessions, the group prefers it to their current method.
