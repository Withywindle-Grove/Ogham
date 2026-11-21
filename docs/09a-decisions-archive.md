# 09a — Decisions archive (before 2026-10-22)

Entries moved unchanged from `09-decisions-log.md` on 2026-10-22. Format: `YYYY-MM-DD — [topic] Decision — Why`. Topics: `[core] [perm] [data] [ui] [words] [sheet] [items] [expedition] [fight] [xp] [hirelings] [packs] [adventure] [testing] [process] [ip]` (tags added 2026-10-28; search by tag to find the why). Some were later superseded; the rulings still in force are summarised in `09-decisions-log.md` (Standing rulings).

## 2026-10-21

- 2026-10-21 — [perm] Players see the player-facing parts of a campaign's setting rules (classes, races, items, spells, spell lists, conditions, light types, starting kits); stat blocks, tables, treasure types, rule hooks and option internals stay GM-only, enforced by the database — hidden means hidden for monsters, encounters and treasure
- 2026-10-21 — [packs] The library lives in two places: "Your setting rules" from the account ⋯ menu (import, update, see what's in each) and Campaign → Setting rules (attach, import straight in, optional rules) — packs belong to the account and are reused across campaigns
- 2026-10-21 — [ui] Starting a campaign has all five steps from the design: name → setting rules → optional rules → encumbrance → time lengths, each after the name skippable with defaults; existing campaigns attach setting rules from the Campaign screen — choices made once, at the start, as approved
- 2026-10-21 — [packs] The in-app editor covers every kind of entry in M3 (items, stat blocks, conditions, light types, XP tables, classes, races, spells, spell lists, tables, treasure types, starting kits, rules sets, options, hooks, field templates), saving into the campaign's homebrew pack; brought forward from R2 at Francis's request — homebrew without files from day one
- 2026-10-21 — [packs] The rule-hook engine (formula and lookup evaluator, and the fill, warn, factor and remind hooks) is built and tested in M3 and shown in plain words in the setting-rules browser; features call it as they arrive (level-up, retainers, encumbrance…) — one evaluator, tested once
- 2026-10-21 — [packs] Pack storage: one database row per entry (with its pack id and the entry's own id), imported in one database step; the importer reads what a file actually contains and warns when the stated format version doesn't match (e.g. version 1 using version-2 kinds) instead of refusing; tests use only invented mini-packs, never real pack content — searchable, updatable entry by entry, IP-safe
- 2026-10-21 — [process] M2 gate passed: change HP, undo it, see both in the log; the M2 checklist passed on the iPad and a phone after the fresh-session review's fixes — M2 done, about seven weeks ahead of its Dec 13 forecast
- 2026-10-21 — [perm] M2 fresh-session review fixes: undo reverses only the picked person's changes (an action's events must share its request id and its author), a player's undo runs as the player under the normal access rules (only the GM's goes through a privileged path) and only on entries they can see, with rows locked while checked; a note about a character takes that character's visibility; the database names log entries from a fixed list of commands (GM-only names only for the GM) and sets their level — a player could otherwise have reversed the GM's or another player's changes, or read notes about hidden characters
- 2026-10-21 — [perm] A log entry keeps the visibility it had when written (e.g. if a waiting character changes owner, its first owner still sees its earlier entries) — simple and predictable; revisit if it matters in play
- 2026-10-21 — [perm] When entries held back until downtime arrive (M5), a note added to one must be held back too — notes copy their entry's visibility but not yet its reveal time
- 2026-10-21 — [process] GitHub builds the app itself with the Supabase address and publishable key passed in (production: repository variables for the main project; previews: the test project's secrets), and a guard refuses to deploy a build that doesn't point at the expected project — Vercel doesn't hand its settings to outside builds, which once put a build with no database address live (rolled back within minutes)
- 2026-10-21 — [process] GitHub deploys to Vercel (Vercel's own CLI in the GitHub check): production after every merge to main once all checks pass, a preview per pull request — Vercel's free plan can't connect to a private repo owned by a GitHub organization, and this keeps the organization, branch protection and the free plan
- 2026-10-21 — [core] Fiat in M2 is automatic when the GM uses a player's own power on that player's character (editing their sheet, setting their HP, changing or removing their portrait); the GM's own powers (approving, sending back, companies, removing) aren't fiat. Editing a player's sheet says so and offers an optional Reason; the log line shows a seal with the word "Fiat" and the reason; only the GM can undo it — rulings are visible and reversible without an extra step for the GM
- 2026-10-21 — [core] Notes live in their own table, logged like everything else (note.add simple; note.edit verbose, showing "Was: …" the old text); the author is stamped by the database; a note added to a log entry takes that entry's audience, and you can only add one to an entry you can see; only the text changes; never deleted — notes can't leak what their entry hides, and nothing is erased
- 2026-10-21 — [ui] Tapping a log line shows its actions (Add a note to this, Edit note, Undo) instead of an Undo button on every line; notes on a line show indented under it with the writer's name; "Write a note" sits at the top of the log with an optional "About" character — the design's "tap any entry to annotate it", and calmer than buttons on every line
- 2026-10-21 — [process] Backups run with PostgreSQL 17's own pg_dump (the Supabase CLI supplies short-lived connection details), because the CLI's dump needs Docker — a backup before every main migration, without installing Docker
- 2026-10-21 — [testing] The GitHub check runs once per pull request (and on pushes to main), and database runs queue one at a time — two at once hit Supabase's sign-in rate limit on the test project

## 2026-10-20

- 2026-10-20 — [core] Undo runs in the database in one step (undo_request): it checks the person made the change or is the GM, that it changed existing things, that it wasn't already undone and that nothing changed since; then it puts every row the action touched back, each new event linked to the one it reverses, at the original's log level. It runs with the database's privileges so the GM can also put back rows a player's action touched (like the active character an approval set); every guard rule still applies — an undo is all-or-nothing and can't be forged
- 2026-10-20 — [ui] Undo differences from the R1 design for M2 step E3: an "Undo" button on each log line you made (every line, for the GM), none on making or deleting things; an undone line stays, marked "undone"; the undo reads "You undid a change to Wren's HP (back to 11)."; refusals are plain ("That's changed since. Undo the later change first.", "That was already undone.") — canvas to be updated
- 2026-10-20 — [process] Work on branches, merge only when checks pass; previews use the test database; database-change safety rules; milestone tags and changelog; Dependabot, security advisor and accessibility checks; fresh-session review per milestone — the live app can't be broken by one push, and real data stays safe
- 2026-10-20 — [process] Error reporting, backups with a practice restore, and uptime alerts in M10 — needed before players depend on the app, noise before then
- 2026-10-20 — [ui] Log differences from the R1 design for M2 step E2: the players' Events tab shows only the log until M5 (no time, initiative or party yet), headed "Log" with a "Verbose: every change, like each HP tick" box instead of a "Full log ›" page; filters, search and sessions come later; the GM's Campaign screen gains a Log section (not drawn); each line is one action in plain words ("Sam set Wren's HP to 9 (was 11).") with its time, and "You" for the reader; notes, annotations, Undo and the fiat seal arrive in E3–E5 — canvas to be updated
- 2026-10-20 — [core] Events are written by database triggers on each table, in the same transaction as the change, with before and after values; each command tags its request with the event's name (and fiat and reason) — atomic, can't be forged or skipped, commands barely change
- 2026-10-20 — [perm] Each event has an audience (everyone, the GM, or the owner and the GM), enforced by database rules, so the log never shows what someone can't otherwise see — hidden means hidden, in the log too
- 2026-10-20 — [ui] In M2 the log lives on the players' Events tab (the rest of Events comes in M5) and in a Log section on the GM's Campaign screen — where the design puts it, without waiting for M5
- 2026-10-20 — [core] Whoever made a change, or the GM, can undo it, and only if nothing has changed since — no undo wars at the table, and no silent overwrites
- 2026-10-20 — [core] In M2, changes to existing things can be undone; creating and deleting are logged but not undoable — undoing a deletion is a restore, not an undo
- 2026-10-20 — [core] Fiat in M2: GM changes to things players own are marked fiat with an optional reason, shown with a seal, and the GM can undo them; the wizard-hat Fiat button comes with the GM console (M5) — the record is right from the start; the button belongs with the console
- 2026-10-20 — [core] Notes: anyone adds a note (optionally about a character) or annotates any log entry; you can edit your own note and the old text stays in the log; notes are never deleted — nothing erased
- 2026-10-20 — [core] The log updates live on every open screen (Supabase Realtime), respecting each event's audience — a shared log that only refreshes on reopen would feel broken
- 2026-10-20 — [core] Both permanent-delete exceptions to hard rule 4 stay now that the log exists; the deletion event keeps a full copy of the character — revisited as planned
- 2026-10-20 — [words] The invite form says "We don't email invites yet. Copy or share the link." under "Who's it for?"; remove it when emailed invites arrive — the note field looked like it sent an email
- 2026-10-20 — [process] M1 gate passed: two test logins see one party, and the M1 manual checklist passed on the iPad and a phone — M1 done, about five weeks ahead of its Nov 29 forecast
- 2026-10-20 — [data] Each character gets an empty classes list ({classRef, level, xp}) and an optional race slot in M1, unused until packs (M3/M4b); like the level, only the GM changes them after approval — keeps the "cheap now, costly to retrofit" ruling and the M1 roadmap line
- 2026-10-20 — [ui] For the M1 gate, players get a read-only "The party" list (every approved character with its player, level and company) on Your characters, and under hit points on a landscape tablet; the full party view still comes with Events in M5 — so two logins truly see one party
- 2026-10-20 — [ui] Layout differences from the R1 design for M1 step C6: on a landscape tablet the GM's left column also holds "‹ Your campaigns" above the sigil and name, and editing the name or sigil opens in that column; the player's two-pane view titles the right pane "Full character sheet" with Edit beside it, doesn't repeat the name there, and leaves out "Full character sheet" from ⋯; the bottom tabs stay full width with each tab at most 280px — canvas to be updated
- 2026-10-20 — [ui] Layout follows the window's width, not the device: phone under 600px, tablet portrait 600–1023px, tablet landscape 1024px and up — rotation and iPad Split View get the right layout
- 2026-10-20 — [ui] On a landscape tablet the Player screen and the full sheet sit side by side (Player left, sheet right, Edit opens there); narrower windows keep one column — uses the tablet's room, as "list left, detail right"
- 2026-10-20 — [ui] On a landscape tablet the GM's Campaign screen uses the design's left column (sigil, name, section list) with the section on the right; narrower windows keep tabs across the top — matches the approved design
- 2026-10-20 — [testing] Layouts are checked with Playwright (dev only) in a real browser at phone, tablet portrait, Split View and tablet landscape widths, against the stand-in database — layout can't be measured in the pretend browser
- 2026-10-20 — [sheet] Full character sheet differences from the R1 design for M1 step C5b: until packs, the GM's fields grouped by category stand in for ability scores, experience, class abilities, race traits, saves and languages; a "Level and hit points" section comes first; Backstory and Notes are shown in full and changed through Edit (no Backstory popup yet); Edit opens one form (name, level, HP max, fields, backstory, notes); the GM reaches it from "View sheet" on the player list and also sees hidden fields in a last section — canvas to be updated
- 2026-10-20 — [perm] Hidden fields aren't secret: hiding retires a field from forms and the player's sheet, but its saved values still reach the owner's device; anything truly GM-only belongs in GM notes (actor_secrets) — keeps "hidden means hidden" honest
- 2026-10-20 — [ui] Player screen differences from the R1 design for M1 step C5a: only the name line and hit points so far (statuses, combat values, At hand, saves, spells, skills, light, coin and the urgent banners arrive with their milestones); the line under the name is the fields the GM marked "on the card" plus the level, with the campaign and company beneath; the ⋯ Character options menu has only "Your characters" (Full character sheet comes in C5b; Arrange this screen and the level-up setting later; the theme stays in the account menu); no tap-for-rules popups until packs; HP changes made on another device show after reopening (live updates later) — canvas to be updated
- 2026-10-20 — [ui] Opening a campaign with an active character lands on its Player screen; the character list (switch, make another, portraits, archived) moves to ⋯ → Your characters; with no active character the list shows as before — the screen used at the table comes first
- 2026-10-20 — [sheet] HP −/+ and the keypad work in M1, before the event log; M2 adds the log entry and undo to the same command — the Player screen is useful from the start
- 2026-10-20 — [sheet] HP is a whole number and may go below 0; + stops at max, but the keypad accepts any whole number, including above max (temporary HP), shown as "over max" — fits settings with negative or temporary HP without mis-taps past max
- 2026-10-20 — [ui] The Player · Events · Pack tabs show from M1; Events and Pack say they're coming later until built — the final navigation is visible from the start
- 2026-10-20 — [perm] The GM opens any player character's full sheet ("View sheet" on the player list) and can edit it like the owner, plus the level after approval — the GM can check and fix sheets
- 2026-10-20 — [ui] Companies differences from the R1 design for M1 step C4b: no Charter or Treasury buttons yet (M7); each company's line lists its characters (archived ones marked), not hirelings or title holders; the "No company" row has no "asked to join" or vote (M8); a new "Who's in which company" list gives each current character a company dropdown; a company shows its first letter (company sigils come with the charter); no count beside the Companies tab; Delete appears only on an empty company — canvas to be updated
- 2026-10-20 — [data] The database enforces both company rulings: a company with any character in it (archived ones included) can't be deleted, and an archived character's company can't be changed, not even by the GM — the screen can't be bypassed

## 2026-10-19

- 2026-10-19 — [ui] Campaign name and sigil differences from the R1 design for M1 step C4a: tapping the sigil or the name opens one "Edit the campaign" panel (name and sigil saved together, with Change and Remove sigil) instead of opening the photo chooser or renaming straight away; the sigil also shows at the top of the player's campaign page — one calm place to edit, and a way to remove the sigil — canvas to be updated
- 2026-10-19 — [perm] A campaign's sigil must be a sigil picture from that same campaign, checked by the database; replacing or removing a sigil deletes the old picture — no stray or borrowed files
- 2026-10-19 — [perm] A company can be deleted only while no character is in it; it becomes archive-only once charters and treasuries exist (M7) — in M1 a company is just a name, so nothing real is erased
- 2026-10-19 — [ui] Players see their character's company on the campaign picker row and on their character card — the party is visible without a Company page yet
- 2026-10-19 — [data] The GM can put any current character in a company, approved or not (archived ones keep theirs) — the GM can set up the party before approving
- 2026-10-19 — [perm] The GM can change or remove the campaign sigil; with none, the campaign's first letter shows — a sigil is optional
- 2026-10-19 — [testing] Light theme background changed to Bone (#FAFAF7, tint #EDEAE3, rule #D6D3CC) — less tan, still calm and readable
- 2026-10-19 — [process] Hidden data lives in separate tables with their own access rules — Supabase rules are per row, not per column
- 2026-10-19 — [process] Automated tests run against a second free Supabase project (grimoire-test) — tests never touch real data, no Docker needed
- 2026-10-19 — [data] M1 invites are a copied link or code; emailed invites later — no server code needed in M1
- 2026-10-19 — [perm] In M1 the GM creates companies and assigns characters directly; voted joining in M8 — companies exist early without waiting for voting
- 2026-10-19 — [data] Handout merged into Asset; visibility lives only on Asset — one source of truth for who can see a file
- 2026-10-19 — [perm] Monster HP lives only in actor_secrets; combatants show damage taken — hidden means hidden at the database level
- 2026-10-19 — [perm] Rejected characters are marked "rejected" (kept, owner and GM only, can be resubmitted), not deleted — nothing erased
- 2026-10-19 — [sheet] Players create their own characters and companions (hireling, animal, vehicle), all pending; NPCs and monsters are GM only — companions belong to players, the world to the GM
- 2026-10-19 — [perm] An invite code alone is enough to join (email optional); one use, 14-day default expiry, always joins as a player — matches copy-and-share invites
- 2026-10-19 — [perm] Handout and map visibility alone decides who sees them; revealedAt records when they were shared — one rule for the database to enforce
- 2026-10-19 — [perm] Anyone signed in can create a campaign and becomes its GM — every group starts with whoever runs the game; creation goes through one database function so a GM-licence check can be added there if the app is sold
- 2026-10-19 — [core] Thin command layer in M1 (named commands, `can()`, screens never write to the database directly); event writing added inside commands in M2 — keeps hard rule 3 from day one without pulling M2 into M1; M1 setup changes aren't logged
- 2026-10-19 — [perm] Sign-ups are open: anyone with an email can sign in with a 6-digit code (expires in 15 min) — fine for one group; revisit with GM/player licences if the app is sold
- 2026-10-19 — [process] Sign-in emails come from mail.withywindlegrove.com through Resend — a sending subdomain keeps the main domain's mail reputation separate
- 2026-10-19 — [ui] The app asks for your name once, on first sign-in, then never again — fewer taps
- 2026-10-19 — [ui] Invites arrive by an invite code box and /join/CODE links on the campaign picker, not the design's "You're invited" row — matches copy-and-share invites with no emails sent
- 2026-10-19 — [testing] Click-through smoke tests use Testing Library with jsdom (added in M1 sign-in step S4) — tests the screens the way a person uses them, without a real browser
- 2026-10-19 — [ui] The ⋯ menu lives in the top bar on every screen: "This device" (theme) and Sign out; it replaces the separate theme buttons — matches 06 (theme in the ⋯ menu) and keeps screens calm
- 2026-10-19 — [perm] An invite preview (campaign name and GM name) is shown before joining, only to signed-in people, with the same "not found" answer for unknown, expired, revoked and used codes — people see what they're joining without codes leaking anything
- 2026-10-19 — [ui] Campaign picker differences from the R1 design, until later steps fill them: no third "next" line (downtime offers, last played), sigil shows the first letter, new campaigns ask only for a name, tapping a campaign opens a placeholder, Join comes before character creation — canvas to be updated
- 2026-10-19 — [sheet] A player's first approved character becomes their active one automatically; waiting or sent-back characters are never active; later characters don't replace it (the player switches) — nothing in play uses an unapproved sheet
- 2026-10-19 — [sheet] Starting level is a plain whole-number level (1 or more) on each character, set by the GM at approval, until classes come from packs; then it becomes the class entry's level — works for freeform characters and hirelings without packs
- 2026-10-19 — [sheet] Character creation has an optional Backstory box — players who like writing can, others skip it; the GM sees it when approving
- 2026-10-19 — [ui] The GM's Players and characters section lists players only; NPCs and monsters live with the GM console — keeps the list short once monsters exist
- 2026-10-19 — [sheet] Freeform creation asks for an optional HP max (whole number); current HP starts equal to it; the GM can fill it at approval — every character needs HP to play, but players who haven't rolled aren't blocked
- 2026-10-19 — [sheet] With a setting pack, freeform characters pick race and class from the pack's lists without requirement checks; scores and gear stay typed — the sheet can still show class abilities and auto-fill at level-up
- 2026-10-19 — [ui] GM Campaign screen differences from the R1 design for M1 step C1: no section list until a second section exists, "Invite a player" makes a link and code to copy or share (optional "Who's it for?" note, no email sent), a new Waiting invites list with Revoke, a "‹ Your campaigns" link, rows stack on phones — canvas to be updated
- 2026-10-19 — [sheet] The player chooses the starting level when making a character, then rolls HP for it; the GM approves it or sends it back with a note. Replaces the earlier ruling that the GM sets the level at approval (the plain level field stays) — HP only makes sense once the level is known, and the GM still has final approval
- 2026-10-19 — [ui] Character creation and approval differences from the R1 design for M1 step C2: the invite screen has no illustration or setting-rules line; no Guided/Freeform choice and no step bar (freeform only until packs); "Who are they?" asks Name, Starting level, HP max and Backstory (no alignment, languages, company or portrait yet); a new "sent back" state with the GM's note and "Send it again"; on the GM's approval row the level is shown, not picked ("Start at" removed), Approve is an ordinary button (Invite a player keeps the one accent), there's no "View sheet" yet, and an HP max box appears when the player left it empty — canvas to be updated
- 2026-10-19 — [core] Removing a character is split by whether it ever entered play: never approved (waiting or sent back) → its owner or the GM deletes it for good; approved → its owner or the GM archives it (kept, hidden, never active), and only the GM restores it or deletes it permanently after typing its name. Documented exceptions to hard rule 4 — useful for testing and for players' false starts; revisit the permanent delete once the event log exists (M2)
- 2026-10-19 — [data] Before removing, "Download a copy" saves the character as a labelled, versioned JSON file (`grimoire-character`, version 1) without this campaign's ids or the GM's review note; restoring from the file comes later — a backup now, without building import yet
- 2026-10-19 — [sheet] Players can make more than one character in a campaign and switch which approved one is active from their campaign page (instant until Adventure mode exists) — character switching from M1, placed where players already are
- 2026-10-19 — [perm] Players can also permanently delete their own archived characters (after typing the name), not just the GM; players see their archived characters collapsed on their campaign page, to view or download — players manage their own false starts and test characters
- 2026-10-19 — [sheet] GM-defined character fields are all optional (no "required" switch) — the GM uses Send back when something's missing
- 2026-10-19 — [ui] Character fields live in the GM's Campaign screen under Setting rules → Character fields — matches the design's sections; packs' field templates will land there too
- 2026-10-19 — [data] A field the GM no longer wants is hidden (values kept, can be shown again); a field no character has filled in can be deleted outright — nothing filled in is erased, typos can go
- 2026-10-19 — [data] Number fields hold whole numbers, negatives allowed (for modifiers) — integers for game values (hard rule 8)
- 2026-10-19 — [ui] A player's row on the campaign picker shows their active character's portrait (the campaign's sigil letter if there's none); GM rows keep the letter — more personal at a glance
- 2026-10-19 — [sheet] In "Who are they?" the portrait comes first, under the name, not last as in the R1 design — the fun part first, not buried under a long form
- 2026-10-19 — [ui] GM Campaign screen differences from the R1 design for M1 step C3a: two sections (Players and characters, Setting rules) shown as tabs across the top on every screen size (the design's left-hand list on a wide tablet comes later); Setting rules holds only Character fields until packs arrive; the Character fields editor is new (no design): list with Move up/down, Edit, Hide, Delete (only when unused), a collapsed Hidden fields list, and an add/edit form (name, type, choices, group, show on the card); the approval row shows field values; "Players and characters · N waiting" on the tab — canvas to be updated
- 2026-10-19 — [data] Field values are checked by the app's commands (whole numbers, list choices, known fields), not by the database; a player bypassing the app could only put odd values on their own character — cosmetic, not a hidden-data risk
- 2026-10-19 — [words] A field's group is called "Category" on screen (fields with the same category show together under it) — clearer than "Group"
- 2026-10-19 — [data] Portraits are shrunk on the device to 512 pixels (JPEG) before upload, with the browser's own tools (no new library) — quick on the iPad, small in storage; a picture that can't be read gets a plain message
- 2026-10-19 — [perm] A character's portrait must be a portrait from its own campaign, uploaded by whoever links it (the GM may link any portrait in the campaign); the uploader or the GM can remove it; deleting a never-approved character removes its picture, archiving keeps it — enforced by the database
- 2026-10-19 — [ui] Portrait differences from the R1 design for M1 step C3b: the dashed "Add a portrait (optional)" box sits under the name (not last); once chosen it shows a round preview with Change portrait / Remove portrait; character cards show the picture with Add/Change portrait; the GM's approval row and player list show small portraits; a player's picker row shows their active character's portrait. The GM can set portraits through the command, but there's no GM button for it yet — canvas to be updated

## 2026-10-18 (R0 setup)

- 2026-10-18 — [process] R0 complete (shell live on Vercel, check green); auth email will send from a subdomain of withywindlegrove.com — R0 done three weeks early; subdomain protects the main domain

- 2026-10-18 — [process] R0 gate passed: shell loads on PC, iPad and phone, light/dark switch works, installs to the iPad home screen, no setup warning on Vercel, Folio look matches the approved canvas — foundations ready for M1
- 2026-10-18 — [testing] ESLint added (recommended rules, typescript-eslint, React hook rules); TypeScript held at 6.0 until typescript-eslint supports TypeScript 7 — catches hook misuse and slips the type-checker misses
- 2026-10-18 — [testing] Regression testing grows with every step: one check command, GitHub check on every push, tests required for every feature and bug fix, access-rule tests from M1, manual checklist per milestone — catch breakage early, keep hidden info hidden
- 2026-10-18 — [process] Auth email via Resend on a custom domain, set up before M1 — Supabase's built-in sender can't edit templates or reach players

## 2026-10-18 (design session: setting pack v2 and R1 final review)

- 2026-10-18 — [process] R1 moved to Jun 20, 2027 (option B: +2 weeks); message pictures and the location picture strip deferred to R2 — keeps R1 in June while building the encounter flow and companies
- 2026-10-18 — [process] R1 design approved (final review canvas, 26 screens); subject to change after testing — ready to build
- 2026-10-18 — [perm] Email 6-digit code sign-in, stay signed in, no tablet lock — magic links open in the browser, not the installed app
- 2026-10-18 — [data] Campaign has its own name and sigil (GM-edited); zero to many companies per campaign, a character in at most one — not every campaign has exactly one party
- 2026-10-18 — [sheet] Player tab shows attacks and spells with modifiers applied — quick reference, no digging
- 2026-10-18 — [ui] Backstory popup on the full sheet; one-off items saved to the campaign homebrew pack — less clutter, reusable items
- 2026-10-18 — [ui] GM sends text and pictures to one player, all, or the shared screen; Explore shows current location and reference tables — the table sees what the GM chooses
- 2026-10-18 — [fight] Encounter flow: check → table → Encounter (surprise, reaction) → optional Fight — an encounter is not always a fight
- 2026-10-18 — [packs] Homebrew packs in one priority order with per-rule exceptions; campaign homebrew pack automatic; full editor R2 — robust homebrew without blocking R1
- 2026-10-18 — [process] Rules lookup and rules-section display deferred — revisit later
- 2026-10-18 — [items] Loot: no company = equal split among present; several companies = GM sets each company's portion, then its charter applies — supports any party structure
- 2026-10-18 — [perm] GM messages can be "burn after reading"; surprise and reaction results GM-only unless sent — secrets stay secret
- 2026-10-18 — [xp] Level-up asks per edited value (use the setting's or keep yours); unedited values update after preview — reconciles auto-fill with player control
- 2026-10-18 — [words] "Encounter check" replaces "wandering check"; GM modes are Explore / Encounter — an encounter is not always a fight
- 2026-10-18 — [packs] Homebrew packs load alongside setting rules; homebrew wins conflicts by default, GM can override in Optional rules — robust homebrew support
- 2026-10-18 — [process] Level up, Downtime and Company screens approved for R1
- 2026-10-18 — [sheet] Character sheet order; auto-filled values update unless edited, edited values show the setting's number beneath — the setting does the math, the player keeps control, nothing goes stale silently
- 2026-10-18 — [sheet] Spell screen chosen by the class's spellcasting type (book or divine); reversible spells chosen at casting; scrolls by casting type — one app, any setting's casters
- 2026-10-18 — [items] Add/equip flow with live AC and non-blocking hook warnings — resolves the open question on adding and equipping items
- 2026-10-18 — [adventure] Adventure packs (meta.kind = adventure) carry module tables, monsters and handouts; imported like settings; converter skill reads adventure PDFs — encounter tables are usually adventure-specific
- 2026-10-18 — [fight] Quick table builder with paste, copy-and-edit, and a "current table" the GM can switch on the fly, in R1 (M6) — tables change mid-campaign and must be at hand
- 2026-10-18 — [ui] No explanatory subheadings under screen titles — screen space for content
- 2026-10-18 — [fight] Encounter tables show in full; the GM taps the matching row; tables come from setting rules or the in-app editor — faster than number pads, same physical dice
- 2026-10-18 — [fight] Tap any combatant for details; add foes or allies mid-fight from stat blocks or custom, in R1 — the GM never leaves the fight screen
- 2026-10-18 — [ui] Charter: tap sigil or name to propose changes; one share per member unless an exception — less chrome, simpler math
- 2026-10-18 — [packs] Setting rules carry declarative rule hooks (fill, warn, factor, remind) interpreted by the app; no code in packs; engine in M3 — setting-specific mechanics without breaking rules-agnosticism or safety
- 2026-10-18 — [hirelings] Wage and expense periods add per day and per adventure; players get personal recurring expenses — retainer upkeep as the source rules describe it
- 2026-10-18 — [hirelings] Hirelings can be groups with a count; wartime doubles mercenary wages — mercenary companies without a row per soldier
- 2026-10-18 — [hirelings] Retainer XP and leveling move into R1 (M7) using the setting's penalty — retainers grow as the setting intends
- 2026-10-18 — [hirelings] Strongholds and domains stay R2 — scope discipline
- 2026-10-18 — [perm] Email-link sign-in only for R1 — simplest for everyone
- 2026-10-18 — [ui] Company page (charter, members and titles, Treasury, hirelings, holdings) opens from the party sigil on Events — one tap away without a fourth tab
- 2026-10-18 — [perm] Titles managed from the charter; joining, new titles and holders go to a vote; only Treasurer and Archivist carry powers in R1 — fewer mechanics, more table agency
- 2026-10-18 — [perm] Archivist gets expanded log-note powers; their notes show in a distinct colour and script — the record keeper's voice stands out
- 2026-10-18 — [items] Treasury spending can recur (weekly, monthly, per session) and shows under Due — lodging and wages without paperwork
- 2026-10-18 — [process] Dropped the Stash, Library and Marching power bundles — scope discipline
- 2026-10-18 — [perm] Joining and title votes pass by simple majority; charter changes stay unanimous — membership and roles shouldn't stall on one holdout
- 2026-10-18 — [items] Charter shares: party fund and each charter member only; no animal shares; section renamed House Rules and Customs — simpler, matches how the table plays
- 2026-10-18 — [ui] One GM Campaign screen (setting rules, players, handouts and maps, during play, data) replaces GM settings — one place to run the campaign
- 2026-10-18 — [ui] Handouts and maps in R1 as uploads with visibility and reveal; interactive maps later — useful now, no screen-staring
- 2026-10-18 — [sheet] Invites and deaths lead into character creation; GM approves and picks starting level; no spectators — everyone at the table plays
- 2026-10-18 — [sheet] Several characters per player, one active; switch freely in downtime, GM approval mid-adventure; benched earn no party XP — supports troupe play without confusion
- 2026-10-18 — [perm] Charter: founding version free until session 1; players-only unanimous votes after; GM can override by fiat — pact with a safety valve
- 2026-10-18 — [hirelings] After founding, charter changes (incl. name and sigil) need a unanimous player vote — the charter is a pact, not a wiki
- 2026-10-18 — [ui] Hireling pay comes from contracts, not the charter — one source for each hireling's terms
- 2026-10-18 — [words] Party gets a name and an uploaded sigil, held in the charter — identity for the company
- 2026-10-18 — [perm] UI says "Setting rules" for packs and "Optional rules" for their options — plainer words for players
- 2026-10-18 — [sheet] Character creation is in R1: guided from the pack or freeform; dice stay physical; GM approval on by default — players start play inside the app
- 2026-10-18 — [perm] Treasury power manages party treasure after Split Loot (move, spend, transfer to purses without acceptance); ledger rights stay open to all; withdrawals mid-adventure need GM approval — real role, no new bottleneck
- 2026-10-18 — [items] Starting gear can be bought from the pack list or taken as a pack starting kit — both styles are common
- 2026-10-18 — [items] New storage places go to the GM as Approve/Deny prompts; denial notifies the player — the GM explains in person, not the app
- 2026-10-18 — [process] Approved mockups get a fresh canvas for final review before R1 approval — a clean, single source for the build
- 2026-10-18 — [expedition] Downtime activities are text threads (propose → GM terms → accept / change / decline), logged, and can stay active across sessions — downtime is narrative and open-ended
- 2026-10-18 — [xp] Split Loot proposes Treasure XP from the pack; the GM confirms in Award XP — one flow, no double entry
- 2026-10-18 — [ui] Completed downtime activities kept in a collapsed section — history without clutter
- 2026-10-18 — [items] No encumbrance in downtime; purses and coffers track carried vs stored (named places) — matches how treasure is really handled between delves
- 2026-10-18 — [xp] GM can award bonus XP to a character or the party with a reason — rewards play beyond loot and monsters
- 2026-10-18 — [ui] Light/dark theme switch in settings in R1; automatic switching later — comfort at the table without extra buttons
- 2026-10-18 — [process] Downtime progress tracking moves to R2; R1 keeps activities active across sessions with terms in text — scope discipline
- 2026-10-18 — [items] Money moves between places freely in downtime; during an adventure, withdrawals need GM approval and go to inventory — storage means something
- 2026-10-18 — [items] New storage places need GM approval and can carry a flat fee or ongoing rate — banks and caches are part of the world
- 2026-10-18 — [perm] GM sees everything a player sees and can edit player sheets via fiat (logged, reversible) — the GM can apply world events directly
- 2026-10-18 — [fight] Side initiative is an "Acting now" choice (Party / Foes); individual mode keeps number entry and its settings — fewer taps, dice stay at the table
- 2026-10-18 — [expedition] Every check reminder uses Hit / Miss, logged at once and auto-scheduling the next check; Hit never auto-starts a fight — not every encounter is a fight
- 2026-10-18 — [ui] Fiat button uses a pointed wizard hat icon — instantly readable, no text
- 2026-10-18 — [perm] Check results are logged at once but shown to players only at the next Downtime — no spoilers during play, full record afterwards
- 2026-10-18 — [ui] GM console and shared Events tab switch between Explore and Fight modes, set by the GM — only one is active at a time, so each gets the whole screen
- 2026-10-18 — [ui] Log folds into Events: three tabs (Player · Events · Pack); full log one tap from Events — calmer screens, bigger targets
- 2026-10-18 — [ui] Events light and dark-sight cues use shape plus colour, no text — calm screen that still works without colour vision
- 2026-10-18 — [fight] No roll prompts to players' screens; rolls are called out loud and the GM types the result — keeps eyes off screens
- 2026-10-18 — [sheet] GM-rolled skills in R2; R1 shows all skill numbers — the GM handles secrecy at the table for now
- 2026-10-18 — [fight] Initiative modifiers are a reminder in R1, auto-added in R2 — side initiative is the table's default; avoids double counting
- 2026-10-18 — [items] Lantern fuel in R1 with one-tap refill — otherwise the lantern itself gets consumed
- 2026-10-18 — [xp] One-level-per-session cap is a Cap/Keep warning in the XP preview (R1) — visible, never silently removes XP
- 2026-10-18 — [ui] Players arrange their own Player screen (show, hide, reorder) from the ⋯ menu; small default; one layout per character on all devices — keeps screens calm without hiding what a player needs
- 2026-10-18 — [ui] Urgent items (light running out, status ending, ready to level) show in a strip even when their section is hidden — nothing important gets lost by hiding
- 2026-10-18 — [items] Gear in armour mode sits in a collapsed section — tracked, out of the way
- 2026-10-18 — [ui] Rules popups show a one-line pack source — players and GM can check where a number came from
- 2026-10-18 — [xp] Level-up fills hit dice, attack values, saves, spell slots and skills from class progression when the pack has it; player confirms or edits — less paperwork at the table
- 2026-10-18 — [data] Data model stores a list of classes per character; multi-class screens in R2 — cheap now, costly to retrofit
- 2026-10-18 — [items] Encumbrance adds an "armour" mode (armour worn + carrying treasure) in R1 — common OSR option that fits neither coin nor slot
- 2026-10-18 — [items] Whether containers add capacity is a campaign setting a pack can preset; app default stays "add" — systems differ
- 2026-10-18 — [sheet] Spell books and memorized spells in R1 — casters are core to play
- 2026-10-18 — [packs] Level-scaled values written into packs as small formulas; the app computes, never rolls — keeps players out of the rulebook
- 2026-10-18 — [fight] Treasure-type rolling and encounter XP totals in R2 — nice to have, not core
- 2026-10-18 — [fight] "Acts last" flag and heal-per-round statuses in R2 — rare, the GM can handle them by hand
- 2026-10-18 — [perm] GM-secret timers and GM-only item fields in R1 — part of Hidden means hidden
- 2026-10-18 — [fight] The app never rolls in R1; pack dice are shown worked out (e.g. 5d6) and rolled at the table — dice stay physical
- 2026-10-18 — [process] R1 slips about 2 weeks (play-tests May 16, 2027) — pack v2, spells, armour mode and auto-fill added scope
- 2026-10-18 — [packs] Re-importing a pack updates entries in place by id after a preview — characters keep working across pack versions
- 2026-10-18 — [xp] Level-up auto-fill overwrites earlier edits after a preview; a player can choose manual level-up per character — speed by default, control when wanted (superseded 2026-10-18 by the per-value Use/Keep rule)
- 2026-10-18 — [packs] New pack kinds are JSON only in R1; Structured Markdown stays v1 — keeps the simple importer simple
- 2026-10-18 — [ip] Rules notes in packs: up to three short sentences in your own words — tap-for-detail needs more than one; IP stays safe
- 2026-10-18 — [packs] Pack format v2 (options, races, spells, treasure types, formulas, two-dice and nested tables, item charges) — needed to model a full OSR system; tested with a private test pack

## 2026-10-17 (design session)

- 2026-10-17 — [ui] Session quiet mode: no app alerts during play, screen kept awake, Focus/DND reminder at start; the app can't silence other apps — honest platform limit
- 2026-10-17 — [ui] Events optimized for tablets and small monitors; no TV layout — keeps roleplay at the table, not facing a screen
- 2026-10-17 — [expedition] Marching order is one column; any player can drag to reorder, all moves logged, GM can lock by fiat; Marching bundle removed — the party arranges itself at the table
- 2026-10-17 — [ui] Events tab: party in marching order, light shown as a glow only, roll-for-surprise prompt removed, event log at the bottom with player annotations — less to read; the log becomes shared table memory
- 2026-10-17 — [ui] Party tab replaced by an Events tab, open to players and usable on a TV — one shared view instead of a separate table view
- 2026-10-17 — [fight] GM-only add-ins in R1 (M6): disposition, surprise, encounter table; data from rules packs with manual override; results secret; dice stay physical and results are typed in — speeds GM work without hidden info leaking
- 2026-10-17 — [packs] New pack kind "table" (die, ranges, results, optional stat block links) — needed for the GM add-ins
- 2026-10-17 — [ui] Folio design tokens approved (colors, EB Garamond + Atkinson Hyperlegible, type scale, rules, tap sizes) — basis for the R0 React shell
- 2026-10-17 — [ui] Tap cue: press flash plus a one-time hint, no chevrons — keeps pages clean while confirming taps
- 2026-10-17 — [ui] Folio chosen as the app's look, light and dark, after five mockup rounds — calm, book-like, legible; replaces the Look A/B hybrid
- 2026-10-17 — [ui] Tap any element for a details sheet with its rules reference — calm screens, rules one tap away
- 2026-10-17 — [items] Inventory stays on its own Pack screen; quantities only for stackable items — calm Player screen, less noise
- 2026-10-17 — [ui] Player screen gets player-chosen "At hand" pins (weapons, spells, items, notes) — personal shortcuts with rules references
- 2026-10-17 — [expedition] Light source picker covers any light type from packs — not just torches
- 2026-10-17 — [words] Player's own tab named "Player" instead of "Me" — Francis's preference

## 2026-10-17 (decision session 2)

- 2026-10-17 — [process] Weekly automated database backup plus a keep-alive ping every 3 days (M10); manual resume as fallback — free tier has no backups, and the 7-day inactivity pause is a minor risk by comparison
- 2026-10-17 — [ui] Table view widgets shown by context, max 2–3 at once, GM can toggle each — shared screen stays calm and relevant
- 2026-10-17 — [perm] Secret ballots hidden from everyone, including the GM; voter and choice never stored together; secret ballots final once cast — real secrecy even from the database owner
- 2026-10-17 — [xp] Party XP split is a GM-only setting, separate from player-edited charter loot shares; R1 is PCs only, hireling XP shares in R2 — XP is a GM award, and hireling depth is R2 scope
- 2026-10-17 — [fight] Initiative rules are campaign settings (range, re-roll, order, ties) with a neutral app default; the GM's own rule (d6 per side each round, high first, party wins ties) lives in a private rules pack — keeps the app rules-agnostic
- 2026-10-17 — [fight] Individual initiative: GM or player can enter, last entry wins, GM never waits on missing entries — keeps eyes on the table and fights moving
- 2026-10-17 — [expedition] Time set as durations with editable defaults: 6-second round, 10-minute turn, 24-hour day; app computes ratios — GMs think in durations; generic real-time defaults, not system rules
- 2026-10-17 — [packs] Markdown importer lenient on format, strict on meaning; unknown keys warned, never dropped — avoids silent wrong numbers in packs
- 2026-10-17 — [perm] Membership and GM role stored only in the Member table; no arrays on Campaign — one source of truth for permissions and security rules; multi-GM is just more GM rows
- 2026-10-17 — [process] R0 mockups built as design mockups in the Project; React in R0 limited to app shell and design tokens — judge look and flow without fighting code; real tap feel tested in M1
- 2026-10-17 — [packs] Pack format ID "tabletop-pack", frozen — neutral of any product name so renames never break packs
- 2026-10-17 — [process] Working title "Grimoire" (non-final); repo name grimoire — name clashes with existing TTRPG tools rule it out as a public name; renameable until M10
- 2026-10-17 — [process] Hosting: Vercel — free for a private group, GitHub auto-deploys and preview links; static PWA can move to Netlify if the app ever goes commercial

## 2026-10-17 (design sessions)

**Timeline**
- [process] Timeline starts Mon Oct 19, 2026 at ~6 hours/week average; dates are a flexible forecast — hours vary week to week
- [process] Milestones on Google Calendar with alerts 1 week and 1 day before; weekly Sunday check-in re-forecasts and proposes date moves only with approval

**Scope and audience**
- [process] Working title "Campaign Ledger", to be renamed
- [process] R1 is for Francis's group only (3–6 players + GM)
- [process] MVP = player tracking and adventuring; holdings, organizations, long-term projects and hirelings are basic in R1 and the focus of R2
- [core] Core must accommodate later modules without rework (events, actors, commands, packs, module registry)

**Platform**
- [ui] Tablets primary, full phone mode, one responsive PWA
- [process] Build on Francis's PC with Claude Code and Git; Francis is a novice and needs clear instructions
- [process] Both a claude.ai Project (planning) and a Claude Code repo (building); repo `docs/` is the single source of truth
- [core] Common Wi-Fi assumed; no Bluetooth sync; offline reading of sheets and own-sheet edits
- [process] Mostly in-person sessions; remote play assumes a voice chat; downtime often remote and async

**Design**
- [ui] Hybrid look: Look A structure and numbers, Look B touches as an optional theme
- [ui] Minimal, calm, large text, no tiny text; limit paperwork and distraction
- [sheet] Portrait uploads supported
- [perm] Shared table view optional, well supported, minimal, never shows GM-only data

**Rules and IP**
- [ip] Rules-agnostic; no published system data ships with the app
- [packs] Items, classes, rules, stat blocks uploadable as private content packs (JSON or structured Markdown); GM can create them in-app
- [packs] PDF conversion happens outside the app via a skill or any LLM following in-app instructions

**AI**
- [core] Finished app requires no LLM
- [core] Voice in R1 = dictation for quick text only
- [core] Table assistant: Off or your own AI account, with usage limits; hosted API left possible but not roadmapped; all agentic features are R4 but accounted for in the build

**Roles and governance**
- [perm] Base roles GM and Player; one GM in R1, multi-GM accounted for
- [perm] Titles (hats): anyone creates, renames and describes; power bundles tied to titles, granted by the GM only; room for more dynamic powers later
- [perm] Votes: standalone mini-app; GM or party calls; open or secret; broadcast to all screens; GM doesn't vote, can sanction or overrule; never required unless the campaign's rules say so
- [perm] Charter: players edit directly; versioned with rollback; share distribution structured, funeral and other sections freeform
- [perm] Fiat: GM can overrule anything; reason optional; logged and reversible

**Mechanics**
- [perm] Personal purses separate; hidden from other players; GM sees all
- [items] Party ledger: anyone can edit, all logged, rollback available
- [xp] XP: GM awards to one character or the party (split per rules, usually evenly) with value and explanation; cumulative per character; thresholds entered or imported
- [xp] Leveling up is a player-entered downtime activity in R1; automation explored later
- [items] Encumbrance: slot or coin, chosen per campaign, only the chosen type shown; precise weights/slots with quantities; containers add capacity
- [items] Coin weight uses one denomination; value can be one to many denominations
- [expedition] Time in rounds, turns and days; calendar import later
- [expedition] GM owns time; GM-defined time triggers, creatable mid-session
- [fight] Combat tracker with HP and statuses for all; monster HP hidden, damage and statuses public; side initiative default, individual optional; dice rolled at the table and entered quickly
- [sheet] Death handling deferred; characters can be added anytime
- [hirelings] Hirelings R1: contract terms, level, stats, rules, notes
- [core] Log: simple (default) and verbose; anyone can add notes
- [packs] Content library at account level, assigned to campaigns
- [ui] Alerts: in-app R1, email R3, SMS later
- 2026-10-21 — [packs] Rule hooks (fill, factor, warn, remind) are part of pack format v2; test syntax stays open until the runner is built — the full test-pack conversion needed them and no code runs from packs
- 2026-10-21 — [items] Equip warnings (armour, weapons, two-handed with a shield) in R1; wood/metal shield rules not warned — they're the common mistakes; the shield cases are rare
- 2026-10-21 — [fight] Variable-HD foes prompt for Hit Dice when added (R1, M6) — 18 monsters in the private test pack need it and it's tiny
- 2026-10-21 — [process] Warning hooks move from M9 to M4b — equip ships in M4 and its warnings shouldn't wait five milestones
