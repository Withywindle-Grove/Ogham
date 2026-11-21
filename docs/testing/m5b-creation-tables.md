# m5b-creation-tables: creation tables from any pack (ct-3 … ct-7, G-201, G-192)

Needs a tables-only homebrew pack whose tables carry creation slots. Invented example to import (Library › Import), then attach to a test campaign (Setting rules): a pack "Table Kit", kind homebrew, with three tables, each `"gmOnly": false`:
- "Fen names", `"uses": ["creation.names"]`, `"join": ""`, columns First half · Second half, rows `{ "min": 1, "max": 2, "cells": ["Adder", "ley"] }` and `{ "min": 3, "max": 4, "cells": ["Rush", "wick"] }`, die d4.
- "Quirks", `"uses": ["creation.details"]`, two rows ("Hums when nervous", "Counts every step"), die d4.
- "Pocket finds", `"uses": ["creation.trinket"]`, one row "A snail shell painted blue", die d4.

1. **iPad, player, a kindred with no tables of its own** (any setting's kindred without a name table). Create a character, Guided, up to Who they are. Under Name: "Roll a name ›" with "Optional · from Table Kit" under it. Tap it, tap Adder and ley: the name reads **Adderley** (one word). Done.
2. **Same character, Gear.** A "Trinket · roll d4" group; its row says "Optional · from Table Kit" under Trinket. Don't tap it: Next goes on.
3. **Details step.** It appears (the kindred had none before); the Quirks row says "Optional · from Table Kit". Tap Next without filling anything: you reach the review. Send to the GM works.
4. **iPad, player, a kindred that has its own name table.** Its own "Roll a name · <kindred> ›" shows, without the Optional line; its own details too.
5. **iPad, GM, Tables (GM reference or the expedition's table list).** Open "Fen names", type 1: the row reads **Adderley**, not "First half: Adder · Second half: ley".
6. **Two packs offering names** (copy the kit as a second pack, rename its table). In Setting rules, move one above the other: creation offers the higher pack's names; swap the order and it offers the other's.
7. **Phone, 375 px.** On Details and Gear, the "Optional · from Table Kit" line wraps under the label; each row is still one comfortable tap.
8. **Hyphenated halves.** Change Fen names' first row to cells ["Adder-", "-bald"]: rolling it at creation gives **Adderbald**, and so does the GM's Tables.
9. **pack:check.** `npm run pack:check -- <the kit file>`: no notes. Remove `"gmOnly": false` from Quirks: a note says players can't read it. Change a use to `"creation"`: a note lists the three creation slots. Set `"join": 0`: a note says join should be words.
