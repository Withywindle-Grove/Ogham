---
status: pending
milestone: December first play (the whole Scene at a spot; magic B, C and D; Notes and rumours; "About this app"; the words a pack gives a spell level)
absorbed-into: pending, with each piece's pull request: 05, 06, 07; docs/09-decisions-log.md (2026-11-14)
supersedes: nothing as a file. Inside it: nt-7 replaces the reading of nt-6 in `dec-scene-whole-2026-11-14.md` (the button shares a kept call, not a player's own note); pf-19b widens pf-19 (a numeric step under an object is a key).
---

# 14 November, late morning to midday: magic approved, icons on every button, the guard on a fix branch, a pack's own words for a spell level (2026-11-14)

Francis answered from his phone and then at his PC, one question at a time. The lead's own answers to builders, given during the build of the whole Scene, are here too so that nothing ruled lives only in a message. Ids that were first said in messages under a clashing name are renamed here: **lv-1** (said as ct-1), **clr-1** (said as cl-1), **ua-1** (said as us-1), **pf-19b** (said as pf-19a).

## Francis's rulings

| Id | Ruling | Whose |
|---|---|---|
| ua-1 | **The week's allowance is run flat out**: four seats on the PC and the cloud seats, the first night's path first, what the first night needs most merged first. It may run out before Thursday 19 November, 6 am; there is no second reset. A seat's limit warning is reported at once. | "Run flat out" |
| nt-7 | **A player may pass a call the GM sent to their character on to the whole party**: only that character's player, only its player-readable words, logged, with Undo. This is Notes' Share button as drawn; nt-6's "one of their own notes" was the lead's wrong description. | "a player can pass a call you sent to their character on to the whole party" |
| nt-8 | **A player may pin a call to adventure in their notes**: one mark and nothing else changed; the party's pin by any member, a character's own pin by its player. | "Yes" |
| dw-1, dw-1a | **Nothing about downtime is final until a deep dive after 5 December.** Until then the Scene's top in downtime is built as drawn on page 16's frame T5, as a placeholder. | "Don't finalize anything in downtime until we deep dive after the fifth."; "We build once where we can. Keep them in as placeholders" |
| ap-4 | **The Magic tab and the GM's rest prompt are approved as built** (#787, #790), with mm-11, mm-12 and ic-1. The lead opens the re-taken pictures before either merges; he does not look again. | "Yes approved on magic and rest" |
| mm-11 | **Cast carries an icon**, the word under it, on a spell's row and at the foot of an opened spell. | "Cast should be an icon" |
| mm-12 | **An opened spell shows its whole description in the book's format**: the shared rule-text part, with its level, range and duration written as the book heads a spell, not as stacked label fields. | "the whole spell description should be here book formatted" |
| ic-1 | **Every button in the app carries an icon from the set, with its word under it.** A row that opens a screen is not a button: it takes a leading icon before its word, as the side menu's rows do (the lead's reading). | "All of the buttons as icons!" |
| ic-2 | **Four icons are chosen**: Cast, an open hand casting (`magic-palm`); Prepare, an open book with sparks (`spell-book`); Heal, a bundle of herbs (`herbs-bundle`); Undo, the plain turned-back arrow (`anticlockwise-rotation`). Undo is not medieval or fantasy in nature; nothing in the source reads as undo, and he ruled it knowing so. | "heal herbs icon, undo simple icon, otherwise keep icons as proposed." |
| clr-1 | **For first play the GM alone sets the caller of the marching order.** Players changing or proposing the caller (page 04, frames C4 and C8) is built after 5 December; it needs a new logged command and a write rule, put to him then. | "Agreed" |
| gd-1 | **On a fix branch a new test may be edited freely until the first commit that contains it; from then on the guard holds** (the file may only gain new failing tests or lose the mark). The first commit is still the tests alone, and the pull request shows each new test's real failure message once. The guard's script is changed to match in its own pull request. | "c" |
| ap-5 | **"About this app" is approved as built** (#797): the menu row and its sheet of version and credits. For the sweep: the row's plain "i" and the menu's other plain icons; the version line shown twice on a phone. | "About section approved" |
| lv-1 | **The app never writes a word of its own for a spell level's spells.** It shows the pack's label for that level where the pack gives one, and "Level 0" (and so on) where it does not. The app wrote "Cantrips" itself in nine places. | "agreed" |
| pf-23 | **The fae-woodland pack shows its book's own word for its spell levels and its three named tiers of runes**, through pf-22. | "Yes to rank question" |

## The pack format

| Id | Ruling | Whose |
|---|---|---|
| pf-22 | **A spell list may carry `levelNames`**, a map from level number to `{ one, many }` (an invented example: `"levelNames": { "0": { "one": "glimmer", "many": "glimmers" } }`). The app uses `many` for a heading or a count and `one` for a single spell (a row, a roll for one), and "Level N" where a list names nothing for that level. It lives on the list, read after patches; an add-on names a level on another pack's list with a patch; the highest pack in the stack wins, as patches already do. The checker notes a key that is not a whole number of 0 or more and an entry missing `one` or `many`. | The lead's, with the Pack Creator |
| pf-23a | **The words are stored as the book prints them in the middle of a sentence**; the app capitalises the first letter where a name starts a title or a line. A list whose spells have no level in the book names its one level with the book's own noun, so no level word appears. Where that name equals the heading above it, the group title drops it ("Pick 1"). | The lead's |
| pf-19b | **In a patch's change path a numeric step is an ordinary key when its parent is an object**, existing or made by the patch; a parent made by a patch is always an object. A step is a list index only under an existing array, and a patch still never makes or pads a list. Widens pf-19 so `"levelNames.0"` can be set and leaves other named levels alone. | The lead's |

## The whole Scene: the lead's answers during the build

| Id | Ruling | Whose |
|---|---|---|
| st-9 | **Leave the dungeon's test.** "The dungeon" is the nearest place in the spot's chain whose pack type is a site, else the outermost place that is not a region; nested floors are inside it. A way out counts only if it is shown to players, so a hidden way never makes "leave at once" appear, and nothing sent to players names it. An exit written as plain words beside known links is "cannot tell": the sheet, with its first row leaving at once. | The lead's, under st-4 |
| st-10 | **The light theme's glow token is darkened** so a ring drawn with it clears 3:1 on the page, a sheet and a rank box; a token test holds it. The dice glyphs that use the same token as a text colour are a follow-up after the Scene. | The lead's |
| st-11 | **On the stacked branch, controls may sit in an interim place** until the row that homes them is built, since nothing merges alone; one list of them is kept and the last row checks none is left. After Start expedition the band's button holds until the reload lands; it is never shown disabled. | The lead's |
| st-12 | **In downtime the facts row is not drawn**: T5 draws a Weather fact, and the app keeps no weather outside an expedition. For the deep dive (dw-1). | The lead's |
| mo-2 | **Not built on the marching order, and told to Francis at the one look**: the prompt "Who is the caller this session?"; holding a single circle; circles floating over the heading. Hit points are hidden on screen only until M6. | The lead's |

## How the sessions are run

| Id | Ruling | Whose |
|---|---|---|
| dk-1 | **Seats are still started from the terminal; the desktop app is a window onto them.** A trial on 14 November showed: a session started in the app is a plain session (no role file, the app's model, "auto" permissions) and cannot be started as an agent; a seat moved with `/desktop` keeps its history, role, model and messages, and its permission mode must be set back to Manual by hand; a session in the app can start another and switch its remote control on, and cannot archive one while a remote client is attached; a `!` command sent from a phone is an ordinary message in both kinds of session. The Tester stays in the app as the pilot; the rest is reviewed at the reset of 19 November. | The lead's recommendation; Francis ran the trial |

## Also decided, without an id
- A shared part for a button with its icon above its word, and the Studio's icons in the app's table, go to main first in one pull request, so magic and the Scene do not each build their own.
- A fault found while building: on a GM's other screens, Undo from the time toast puts the clock back and takes the wrong lines off the shared card. It is live; its fix goes to main on a fix branch, test first.
- gp-9 (the words when Undo would hand a character back to a player who has left) is written in `docs/plans/dec-give-a-character-to-a-player.md`.

## Honest notes
- The magic pictures first put to Francis were stale: taken before the restyle's last batch merged, and the Magic tab's before its own review fixes. He asked whether they carried the latest style; they did not. As-built pictures now name the commit they were taken at.
- The lead told Francis the app wrote its level-0 word "in two places"; it was nine, most of them in creation.
- The lead advised a launch setting against low-memory stops that has no effect on Windows; withdrawn. What stops the watch is not known.
- Not tested in the app trial: whether the project's four file hooks fire in an app session; whether a moved seat keeps its browser tools.
