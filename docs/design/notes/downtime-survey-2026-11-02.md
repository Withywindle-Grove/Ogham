# Downtime — survey of the sources (design agent, 2026-11-02)

What the sources at hand say about the time between adventures, as **shapes** only (no numbers, no rules text; the books stay in `packs/`). Feeds the downtime design session before M7 (08, ST14) and the plan for modelling it. Aliases: **downtime-reference** (a 40-page downtime supplement, to be converted to a pack by the pack session), **classic-advanced** (its referee's volume is at hand; the players' volume's downtime pages are not — retainers, strongholds, magical research, cost of living are known through the pack's rules set), **zine-compendium** (six issues), **fae-woodland** (through its pack: no source PDF at hand).

## What downtime is, in these sources
- **The white space between adventures**, handled haphazardly at the start of a session; the engaged players fill it with schemes, leads, relationships, institutions. The supplement's aim: a scaffold for the less pushy players and relief for a GM swamped by the pushy ones (downtime-reference, theory).
- **Narrative first, procedure second:** the player says what the character does and how; the GM says whether it has a hope, suggests alternatives, and sets the shape; a roll with a small modifier decides *how well*; a tracker records *how far*. Resolved at the table in half an hour, or between sessions by post (downtime-reference, the system).
- **One significant action per character per downtime** plus any number of errands adjudicated on the spot; a player may give up their action to aid another's; hirelings can't be used to multiply actions (downtime-reference). The base game has no such limit: time is the only budget (classic-advanced, fae-woodland).

## The recurring shapes (what the app would model)
1. **An activity with a tracker.** Steps (1, 3, 5, or a scale of seven), a roll per downtime with a tiered result (fail · progress with a complication · progress), a cost per attempt in gold and time, and a **complication table** per activity whose entries carry a deadline ("in the next N downtimes") and a consequence (lose a step, pay, shut). Used for institutions, relationships, skills, martial techniques, research questions, spells, spiritual exercises (downtime-reference).
2. **A fixed-duration task with a cost.** Weeks × gold per spell level (potions, items, new spells, runes), weeks with a mentor (training to level, learning a rune), days per value (an NPC brewer), construction days per cost (strongholds). The result is certain or has a flat failure chance (classic-advanced, zine-compendium, fae-woodland).
3. **Spending that converts to XP** with a side effect: revelry / carousing — spend up to a cap, gain XP per gold, roll for a boon or a mishap (hangover, brawl, lost item, bad reputation, secret divulged, offence given, debt) (downtime-reference; fae-woodland as an optional rule; the base game's XP-for-spending option).
4. **Recurring costs by the week or day:** lodging and meals (or one lifestyle cost), hireling and retainer wages, institution shakedowns and licence fees, a stronghold's upkeep (fae-woodland's lodging items and lifestyle option; zine-compendium's wage table; downtime-reference's complications).
5. **People and standing:** a relationship tracker per NPC (five steps, modifiers to recruit and to gather intelligence, a reciprocal "need" at the middle result), recruiting a companion for one session as a separate roll; retainer hiring (search method by settlement size, applicants, a wage offer with a generosity modifier and a reaction roll) (downtime-reference; zine-compendium).
6. **Information and leads:** a research question with a tracker whose steps are GM-written findings, branching into new questions; gathering intelligence with a tiered result (nothing but a rumour · shaky · solid) (downtime-reference).
7. **Things made:** splendid artifacts commissioned from a named artisan (a property per item kind; the magic "quickens" later in play), spell books written or copied (a chance of a corrupted spell), potions and specialty brews, runes carved (downtime-reference, zine-compendium).
8. **Level-up gates:** training weeks with a mentor before XP counts again (classic-advanced option, fae-woodland option), learning spells on level-up without a roll (downtime-reference).
9. **Worldbuilding prompts for the GM:** institutions at each level, named artisans, a rival party, a secret site — the supplement wants the setting stocked so downtime has somewhere to land (downtime-reference).

## What the sources leave to the GM (where the app must help with memory, not rules)
- The deadline on a complication ("something must be done in the next 2 downtimes") — nothing in the books tracks it.
- Which trackers exist, their current step, and what each step meant (the research findings, the institution's rivals).
- What falls due each week: wages, lodging, licence fees, shakedowns, upkeep; week-uses refreshing.
- The on-the-fly rulings: "this counts as a skilled teacher", "that institution gives +1 here" — homebrew made at the table, forgotten by next month.
- The back-and-forth: the player's proposal, the GM's terms, the player's acceptance — the base of 05's text threads.

## Already in the specs
05 Downtime: activities as text threads with terms (time, cost, what happens at the end, how progress is measured), accept / ask for a change / decline, threads live across sessions, GM view by Needs your reply · Waiting on players · Active, progress measures R2; Game time moves only when the GM moves it; Start downtime applies a full rest; Purse Due with repeating spends; week-uses; level-up Downtime only / Any time; the XP waiting pot. 11: G-32 training, G-54 projects, G-69 study of an item — all parked here. 08 R2: progress clocks, costs over time, an activities catalogue from packs, a downtime calendar per character.

## Gaps the survey adds (to rule in the session)
- A **tracker** as a first-class record (steps, current step, a line per step) — R1 says progress measures are R2; the sources make the tracker the heart of it.
- A **complication with a deadline** as a reminder that fires at a downtime boundary.
- **Per-downtime actions** (one per character) vs **time-based** tasks (weeks) in the same screen.
- **NPC relationships** as a tracker on a person (M8b has NPCs; the relationship step could live on them).
- **Activity catalogues from packs** (the supplement's ten, a setting's options such as training and carousing) feeding the proposal with a shape the GM can accept in one tap — R2 by 08, but the pack session converting the supplement now makes the catalogue real.
- **Converting the supplement to a pack**: a `downtime` kind with activities (name, who, tracker shape, roll, modifiers source, results, complications table with deadlines, costs), reference panels for the GM, and the worldbuilding prompts as a GM panel. Format to be ruled in the session (07).
