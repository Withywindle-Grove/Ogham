# Manual checks: W12, a shop's stock for the day (`dec-3-w12-day-stock`)

No screen in this step (data and logic only), so there is nothing to tap yet. The checks are the tests:

1. In a terminal in the project folder, run `npx vitest run src/modules/requests/shopStock.test.ts`. You should see "12 passed".
2. After the Builder applies migration 20261115110000 to the test database, run `npm run test:db -- supabase/tests/dec-3-w12-shop-stock.test.ts`. You should see every test pass: players read only the things in stock; Undo puts answers back; a new day starts clean.

Gallery pictures expected to change: none.
