---
status: absorbed
milestone: December first play (`docs/plans/dec-6-purse.md`, pieces b and c)
absorbed-into: With pieces b and c: 05, 06 (the coin line, the coin's sheet), 07 (a coin's `unitName` and `pluralName`); docs/09-decisions-log.md (2026-11-13). Found 2026-11-18 (rulings catch-up 6): 06 (pu-1, pu-2, pu-4 to pu-6, pu-8); 07 (pf-17); docs/plans/dec-6-the-whole-pack-tab.md and docs/plans/dec-6-purse.md (pu-3, pu-7, pu-9); docs/09-decisions-log.md (2026-11-13; pu-7's line written here)
supersedes: the words the lead approved for the purse on 2026-11-11 (the small line under the coin amounts, the sentences under "Spend…" and "Give to…"), and the dashed coin frames of `mockups/pack/01` to `04`
---

# The purse on the Pack tab (2026-11-13)

The Design Studio drew the coin line, its sheet, the stash's coin and the GM's give and take on the swept Pack tab (`docs/design/mockups/pack/07-purse.html`, branch `design-december-mockups`, finals at commit 395076bb). Francis saw six of the frames with the lead's three fixes: **"i approve with your changes"**.

## Approved by Francis, with the lead's fixes
| Id | Ruling |
|---|---|
| pu-1 | The coin line sits under the load and above "At hand": the amounts in the setting's own coin names, a row with a chevron opening the coin's small sheet; with none, "No coin". **No explainer line under it** (mc-46), for the player or the GM. |
| pu-2 | The coin's sheet is titled "<Name>'s coin", lists every denomination the setting names (a 0 shown as 0), then "Spend…" and "Give to…" as rows with no sentence under them. |
| pu-3 | **One pattern for coin everywhere**: the party stash's coin is the same row with a chevron, first in the open stash, opening "Party stash's coin", which offers "Take…" to a player and "Give coin…" and "Take coin…" to the GM. No button on the row; nothing under the "Weight" head. |
| pu-4 | A sheet's title carries no dots ("Spend", "Give to", "Take coin", "Give coin"); the dots stay on the rows that lead there. |
| pu-5 | An action's sheet: a row a denomination with what is held under it, a box for how much, one accent that names the amount ("Spend 2 herons", "Give Moss 5 herons", "Take 10 herons", "Put in 10 herons"); a refusal as words under the coin's row with the warning sign, the button still live; done is a toast in the log line's words, with Undo. |

## The lead's (his to overturn)
| Id | Ruling |
|---|---|
| pu-6 | Coin held under a key the setting does not list is **shown**, after the listed coins, as written. A purse reads "No coin" only when it holds nothing at all. |
| pu-7 | The log lines not in the plan until now, in characters' names: "Your GM took 10 herons from <Name>"; "<Name> gave <Other> 5 herons" (one line, read by both); "<Name> put 10 herons in the stash"; "Your GM put 20 herons in the stash"; "Your GM took 10 herons from the stash"; from a Down or dead character, "<Name> took 10 herons from <Other>". |
| pf-17 | A coin in a rules set's currency list may carry `unitName` and `pluralName`, as a stack does; the app uses them where given ("1 crown", "30 crowns"). Where a pack gives one label, the label is printed as given after the number whatever the amount. The app never invents a singular. (The two packs that carry a currency list today label coins by bare metal names, which read right after any number.) |

## Approved by Francis the same day ("approved"), on the builder's picks and the change said in plain words
| Id | Ruling |
|---|---|
| pu-8 | The purse commands (piece b): the GM does not "spend" a player's coin, the GM's take does that; the refusals "The stash has 0 herons." and "Say how many: a whole number, 1 or more."; an archived character's purse follows its pack (the GM only); one coin is capped at 999,999,999 in a purse, with "<Name> can't hold more than 999,999,999 herons." |
| pu-9 | Piece b's database change, in plain words: a player can put coin into a purse they cannot read (a give to another character or to the stash), and their own Undo takes it back out with the database's rights, only for their own give; nobody reads anything new. It rewrites the routine behind every log line and the one behind Undo, so it is reviewed on the strongest model and gets extra database tests before it reaches the live database. |

## Honest notes
- Nobody has seen these screens built: the pictures are mockups. Not drawn, because no screen for them exists yet: a hireling's purse as its employer sees it, another player's view, a Down character's purse opening to the party; coin in a hoard and on a find card.
- Not checked on the mockups: loading, offline, a failed save, Larger text; the Log tab's own lines.
