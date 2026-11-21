# Manual checks: dec-7-5m-2-add-map

"Add this place's map" is built as parts and not placed on a screen yet (the GM's place page, #785, mounts it). So the
checks are on the gallery and the layout page; the real flow is checked by the tests.

1. [ ] Run `npm run dev`, open the URL it prints and add `gallery.html` (the component gallery). Scroll to the last
   section, "The map: its card and its pop-up". A new specimen, "Map wanted", shows three rows:
   - "The Drowned Harbour, the harbour chart" in bold, "harbour-chart.png" small and grey under it, and a small
     "+ Map" button at the right;
   - the same row with "Uploading the map…" where the button was;
   - a very long title and file name, wrapped inside the row, the button still at the right and still a full-size tap.
2. [ ] Open `layout.html?mapParts=wanted` and narrow the window to a phone's width (375 px): the row stays one row,
   nothing scrolls sideways. Try `layout.html?mapParts=long` the same way.
3. [ ] Once the migration is on TEST and #785 has mounted the row: on the GM's place page for a place whose pack names
   a map, tap "+ Map", pick a picture. "Uploading the map…" shows, then the toast "Map added (hidden): <place>" with
   Undo; the map takes the row's place. Undo brings the row back. Sign in as a player: nothing of the map shows.

Gallery pictures expected to change: the gallery's map section (one new specimen, "Map wanted", after the card's specimens
and before the pop-up's), and its dark twin. No other picture.
