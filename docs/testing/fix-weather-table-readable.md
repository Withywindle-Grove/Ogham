# Manual checks: fix-weather-table-readable

Database only; the app's screens don't change, and no gallery picture is expected to change.

1. Nothing to tap: a player's own app only ever offers the weather tables it can read, so the refusal can't be reached from the screen. The database test `supabase/tests/fix-weather-table-readable.test.ts` checks it.
2. Optional, on the preview with a campaign that rolls weather: as a player, enter today's weather as usual. You should see the result on the weather card as before.
