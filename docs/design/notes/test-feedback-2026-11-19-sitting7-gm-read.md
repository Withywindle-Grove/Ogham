# The read before sitting 7 (plan ⚑ 5): which player commands refuse the GM today

Kept by Driver 20, 19 Nov 2026. A scout's read-only report (partial; data to weigh, re-check before building).

| Command | App rule | Database | docs/03 |
|---|---|---|---|
| sheet.requestChange (Max HP / a rules figure asked) | `src/modules/characters/sheetChanges.ts:102-103`: owner only; GM refused | Refused too: `supabase/migrations/20261108210000_m5b_sheet_changes_guard.sql:96-97` (owner must be auth.uid()) | line 37: GM "approve, refuse" only |
| request.send (Describe, Sell, Buy, a secret activity, lodging) | `src/modules/requests/requests.ts:271`: owner only; GM refused | Not refused for a GM: `20261101090000_m5_requests.sql:209` checks only membership | not stated |
| member.setActiveCharacter | `src/core/campaignCommands.ts:167-168`: own approved character only | not found | not stated |
| request.withdraw (a player's own ask) | `requests.ts:291-292`: GM only for `gmAsks` | not checked beyond `20261101090000_m5_requests.sql:281` | not stated |

4 commands refuse the GM in the app; the database refuses the GM for sheet.requestChange only. Hit points, portrait, spells, pin/hide and item commands already allow the GM.

Not checked: `src/testing/permissionCases.ts` from line 529 on; the row-level security policies (only functions were read).

For sitting 7: opening any of the four to the GM changes docs/03 and is asked as one more question, for his yes in words.
