# 02 — Architecture

The core is small, and five foundations make later modules plug in without rework. Read this before writing any code.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict), 6.0 for now | Catches mistakes early; good for a novice with Claude's help. Stays on 6.0 until typescript-eslint supports TypeScript 7 |
| UI | React + Vite | Widely documented, fast dev loop |
| App type | Progressive Web App (vite-plugin-pwa) | One codebase for tablet, phone, PC; installable; offline cache |
| Styling | Plain CSS with design tokens (CSS variables) | No framework to learn; easy theming (Folio, light and dark) |
| Fonts | Fontsource packages, bundled for offline use, latin and latin-ext only, only the weights used: `@fontsource/eb-garamond`, `@fontsource/atkinson-hyperlegible`, `@fontsource/caveat`, and for book text in the stat block (December 5c; Francis said yes, 2026-11-12) `@fontsource/bitter` (400, 700; 800 and 900 for the book format's entry name and sub-headings, dec-10 S3, ruled by the lead 2026-11-13) and `@fontsource/alegreya-sans-sc` (700) | All SIL Open Font License; no font fetched from the internet |
| Local data | IndexedDB via Dexie (`dexie`, in use from the pack cache, perf fix 2(b), 2026-11-07) | Offline reading, queued edits |
| Server | Supabase: Postgres, Auth (email 6-digit code), Realtime, Storage | Free tier fits one group; real row-level security. Auth emails sent through Resend from a custom domain (custom SMTP); required because new free Supabase projects can't edit email templates or email non-team addresses on the built-in sender. Sending domain: a subdomain of withywindlegrove.com (e.g. mail.). The app talks to it through `@supabase/supabase-js`; the Supabase CLI (dev only) keeps database changes as migration files in `supabase/migrations/`. |
| Tests | Vitest (logic), Testing Library (`@testing-library/react`, `@testing-library/user-event`) with jsdom for click-through smoke tests of the screens (dev only), ESLint (typescript-eslint, React hook rules), Playwright (`@playwright/test`, dev only, from M1 step C6: layout checks in a real browser at phone and tablet widths, against the stand-in database) with axe (`@axe-core/playwright`, dev only: accessibility checks in the same run); `npm run check` runs type-check, lint, tests and build, locally and on GitHub on every push | Keep core rules tested; catch breakage early (see `testing.md`) |
| Hosting | Vercel (free Hobby plan) | Free for personal use; deployed by the GitHub check with Vercel's CLI (the free plan can't connect to an organization's private repo), production after checks pass on main, a preview per pull request |

Keep dependencies few. Ask before adding any library not listed here.

## Foundation 1 — Everything is an event

Every change is an **event**: `{ id, campaignId, actorUserId, type, targetTable, targetId, before, after, createdAt, fiat?, revertsEventId?, revealAt? }` (`revealAt`: `now` | `downtime`, see `04-data-model.md`).

- The log, undo/rollback, offline sync and notifications all read from events.
- Current state (HP, balances, inventory) is stored as normal tables for speed, and every write to them goes through a command that also writes an event, in one transaction.
- Rollback = a new event that reverses an earlier one. Nothing is erased.
- Each event type declares a **log level**: `simple` (shown by default) or `verbose`.
- Players and the GM can add **free-text notes** as events.
- **How events are written (M2):** a database trigger on each table writes the event in the same transaction as the change, with the before and after values. Each command tags its request (a request header) with the event's name, fiat flag and reason; a write without a tag is still logged, under a generic name. The names the log accepts, each one's level and whether only the GM may use it are rows in `public.logged_commands` (tested against the app's commands). Clients can't insert events directly (except notes, through their own rule).
- Each event has an **audience**: everyone in the campaign, the GM only, the owner and the GM, or a **group** and the GM (fm-1, 2026-11-10): the players who had a character in that travel group when the line was written, kept on the line itself (`group_number`, `group_user_ids`). Group numbers are used again by the next split, so reading by "who is in the group now" would hand an earlier group's lines to other people. Database rules enforce it for reading and for live updates. Each logged table has its own small function saying who sees its lines (`private.log_audience_<table>`, M5 step 4); a new table adds one, and a table without one logs for the GM only. A function that answers `group` also gives the group and its readers (`group_no`, `readers`); without readers the line stays the GM's.
- **Copy versions and repeats (M5 step 4).** Shared rows carry a version the database raises on every change (inventory lines first: a character's Pack and the Party stash). A change made from a device's copy names the version it saw; the database refuses it if the row has changed since (code `GR409`; the screens say "That's changed since. Here's the latest." and show the latest). Each request of a command carries the command's request id and its number in the command (`part`), so a request sent again after a lost answer changes nothing and logs nothing twice: a repeated change gives back the row as it is, a repeated add finds the line it made (its id is the request id), a repeated split gives back the part it made. Commands covered so far: every inventory and charges command on a line except Empty… (several lines at once).
- **Lines the database works out itself.** "<name> is now <tier>" is written by the database at the end of a change to a character's items, once, whichever devices are open (M5 step 4). Light running out and reminders follow the same pattern: decided in one place, never by a device.
- **Undo** (`undo_request`, one database step) puts back the "before" values of every row the action changed (the events sharing its request id and its author) and logs reversing events (`revertsEventId`). A player's undo runs as the player, under the normal access rules, and only on entries they can see, with one exception: a player's own forced march (fm-1) goes through `private.undo_own_march`, with the database's rights, because a player can't write the travel row or the group's place an arrival moved. It takes only the caller's own `travel.forceMarch` line, only while they still have a character in that group (fm-6), only when the request wrote nothing outside `travel_groups`, `travel_group_secrets`, `group_places`, `places` and `place_notes`, and with the ordinary undo's checks (refused once the points are spent or the day has moved on). The GM's goes through a privileged path (so it can put back rows a player's action touched). Refused if anything changed since or it was already undone; rows are locked while checked. Creating and deleting are logged but not undoable in M2.
- The database names each event from a fixed list of commands (GM-only ones only for the GM) and sets its level; a request's tag can't relabel or hide a change.

## Foundation 2 — Everyone is an "actor"

Characters, hirelings, animals, vehicles, NPCs and monsters are all **actors** with:
- a `kind`
- an owner (a user, the party, or the GM)
- **template-defined fields** (from campaign field definitions or a content pack)
- common parts: HP, statuses, inventory, notes, portrait

The combat tracker, encumbrance, light and marching order work on any actor. Later modules (deep hirelings, followers, mounts) add fields and screens, not new plumbing.

## Foundation 3 — Commands

Diagram: [command flow](diagrams/command-flow.md). Every command and who may run it: [generated list](generated/commands.md); who can read and write each table: [visibility matrix](generated/visibility-matrix.md).

Every action is a named **command** with a typed input, a permission check, and the event(s) it produces, e.g. `hp.adjust`, `xp.award`, `time.advance`, `light.ignite`, `ledger.add`, `vote.call`.

- Buttons call commands. Dictation fills text fields. Future voice and AI add-ins call the same commands, always through a confirm card.
- Commands are the only way state changes. No component writes to the database directly.
- Fiat is a flag on a command: `{ fiat: true, reason? }`, allowed for the GM only, and logged.
- Built in two stages: **M1** adds the command layer (named commands, typed input, `can()`, screens call only commands; the database access rules stay the real gate). **M2** adds event writing inside each command (one transaction with the change), so screens don't change. M1 changes before M2 are not logged.

## Foundation 4 — Content packs

Rules data lives in **content packs** (items, classes, XP tables, rules settings, stat blocks, conditions, calendars) stored in the user's **account library** and **assigned to campaigns**.
- Packs are imported (JSON or structured Markdown) or created in the in-app editor, which writes the same format.
- The app ships with **no** packs and no game-system data. See `07-content-packs.md`.
- Packs are private to the account that imported them.
- The app ships with almost no rules of its own; rules come from setting rules and homebrew. Where the app still has a default (containers add capacity, side initiative and so on), it's a fallback, used only when no attached pack says otherwise.

**Dice entry (convention, from M4).** Every place a player or the GM enters a dice result (HP, charges, initiative, table rows, money) goes through one shared roll prompt. Every roll is stored with its dice expression, the result, who entered it, and the method (`manual` for now), so digital dice can later be a campaign setting without changing any screen.

## Foundation 5 — Modules

A module registers:
- data tables and actor fields
- commands and event types (with log levels)
- screens/tabs for Adventure and/or Downtime mode
- time triggers (things that happen when time advances)
- settings panels
- table-view widgets

R1 core modules: characters, inventory/encumbrance, expedition (time/light/marching), combat, treasury, charter, voting, log, content library, basic retainers/holdings.
Later modules: deep retainers, holdings/organizations/projects, downtime actions, calendar, notifications (email/SMS), table assistant (AI), multi-GM tools.

Rule: core code never imports a module. Modules talk to the core through the registry.

## Rule-hook engine

Rule-hook engine: interprets setting hooks (fill, warn, factor, remind) through the shared formula evaluator; no executable content in packs. See `07-content-packs.md`.

## Sign-in

- R1 sign-in is email only, with a **6-digit code** (no passwords, no Google, no magic links: links open in the browser instead of the installed app on iPhone/iPad).
- Devices stay signed in until the user signs out. No tablet lock.

## Permissions

- One function decides everything: `can(user, command, target)`.
- Inputs: base role (GM/player), ownership, title power bundles, campaign settings, fiat.
- Enforced twice: in the app (to hide controls) and in Supabase row-level security (the real gate).
- See `03-roles-permissions.md`.

## Offline

- All campaign data the user can see is cached locally (IndexedDB).
- **The pack cache is the first piece of the device store** (perf fix 2(b), 2026-11-07): each campaign's setting rules, stored per person and per pack exactly as the database sent that person, each copy stamped with the pack's content stamp (`packs.content_rev`) and the campaign's seen stamp (`campaign_rules_revs.seen_rev`). A start checks the stamps (reads the app already makes) and downloads only the packs whose stamp moved. One person's copies on a device at a time: sign-out, or a different person signing in, deletes every copy; so does a new cache format. Offline with a stored copy, the rules screens open on it and say "Setting rules as of <date>, offline"; without one, as before (the screen says it couldn't load). Row-level security stays the only gate on what is sent; the cache adds no read of its own.
- Offline users can **read everything** and **edit their own character**; edits queue as commands and sync when back online.
- Conflicts: the server re-checks permissions and applies queued commands in order; if a command no longer applies, it is logged as rejected and the user is told.
- A command tried again keeps its request id (`runCommand`'s `requestId`; a failed result says it), so the database applies it once (M5 step 4).
- **The GM's own commands queue too** (ruled 2026-10-25): advancing the clock, resolving checks and reminders, lights and marching order. They're written as **intents with request ids** ("advance 1 turn", "check resolved: lost"), never results, so a replay can't apply twice and everything that follows (light burn, reminders due) is worked out again on replay. Each carries the clock time it belongs to; the log sorts by it and adds "GM was offline N min · N turns caught up". Only one GM device queues at a time; another is read-only. Queued commands become undoable once synced. The offline cache clears on sign-out. Fallback if M9 runs tight: only Next turn, checks and reminders queue.
- Live sync needs Wi-Fi or internet. Bluetooth sync is out (browsers on iPad/iPhone don't support it).

## Realtime

- Supabase Realtime pushes events to all open screens (votes broadcast, time advances, HP changes).
- The **Scene tab** subscribes to a filtered event stream with no GM-only data. Players use it on their own devices; a spare tablet or small monitor can show it for the whole table. No TV layout.

## Storage

Images in packs (2026-10-24): maps, handouts, art and page crops live in the GM's Google Drive. Only the GM's device opens them, with a Google sign-in made on that device (Drive file-access permission). No Google sign-in is ever stored on the server. Revealing an image (whole, or a GM-cropped rectangle) copies it into the app's private storage, with storage access rules matching its visibility. App storage holds revealed copies plus the GM's direct uploads (resized images, PDFs up to 10 MB), all under access rules matching their visibility (2026-10-24). A step-by-step guide runs on first use, then sits behind 'How this works'.

## Room for AI later (do not build in R1–R3)

- The command layer is the only interface an AI add-in will use.
- Settings has a reserved "Table assistant" section: **Off** (default) or **Your own account** (provider, API key, model, usage limits). A hosted API option is left possible but not planned.
- Nothing in core may call an AI service.

## Folder layout (target)

```
src/
  core/        events, commands, permissions, registry, sync, storage
  modules/     one folder per module (characters, expedition, combat, ...)
  ui/          design tokens, shared components, layouts (tablet, phone, table view)
  app/         routes, mode switching, campaign shell
supabase/      migrations, row-level security policies
docs/          specs (source of truth)
skills/        content-pack-converter
```
