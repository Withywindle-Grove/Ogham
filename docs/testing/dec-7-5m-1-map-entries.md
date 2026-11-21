# Manual checks: dec-7-5m-1-map-entries

Data and logic only: no new screen. Two optional checks.

1. [ ] In a terminal in the project folder, run `npm run pack:check -- packs/_current/<an adventure pack with maps>.pack.json`
   (for example the port-town pack). It counts `map: N` among the entries, says nothing like `"images" isn't a part`,
   and lists in its warnings any picture that is not a map ("images: … left out; the app reads maps only so far.").
2. [ ] Once the migration is on TEST, open the preview's Rules library as the GM, import the same adventure pack (or
   Update it). The preview's count line includes "N maps". Sign in as a player in a campaign using it: nothing about
   the maps shows anywhere (the database test `supabase/tests/dec-7-5m-1-map-kind.test.ts` checks this for real).

Gallery pictures expected to change: none.
