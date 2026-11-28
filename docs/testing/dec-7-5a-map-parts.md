# Manual checks: dec-7-5a-map-parts (the map's card and pop-up)

The parts are on no screen yet. You see them on two test pages, on an invented harbour picture.

Start the app with `npm run dev` (it starts a local server and prints a web address, usually `http://localhost:5173`).

1. Open `http://localhost:5173/layout.html?mapParts=1` on an iPad (or a browser window about 1,024 wide). You should see "The Drowned Harbour", a line, and a card holding the harbour picture alone, with "The Drowned Harbour" at the left under it, then a zoom-out magnifier, a zoom-in magnifier and a closed eye at the right.
2. With a mouse, hover over the picture: its edge turns darker (ink). Press and hold: the edge turns the accent colour and thickens.
3. Tap zoom in on the card twice: the picture grows inside the card. Drag it: it moves, and does not open. Tap zoom out until it stops: the whole picture again.
4. Tap the picture (a short tap, no movement): a large pop-up opens with "THE DROWNED HARBOUR" over "The map", the eye and ✕ at the top right, the whole picture, and under it "75%" (on a 1,024 window), zoom out, zoom in and **Fit** (Fit looks pressed).
5. Tap zoom in: the figure grows and Fit no longer looks pressed. Drag the picture: it moves, never past its edges. Tap Fit: the whole picture again.
6. On a PC: the mouse wheel zooms about the pointer; + and − zoom; the arrow keys move; 0 is Fit; Escape closes. Ctrl with + still zooms the whole browser page (the map leaves it alone).
7. On an iPad: pinch to zoom, drag with one finger.
8. Open `layout.html?mapParts=loading&open=1`: the pop-up shows a still grey block and "The picture is on its way.", with no zoom buttons.
9. Open `layout.html?mapParts=failed&open=1`: "▲ The map’s picture couldn’t load.", Try again (centred), and "Everything else about the place still works: the locations are in the list."; no zoom buttons.
10. On a phone (375 wide), repeat 1, 4 and 5: the card's title is a step smaller, and the pop-up fills the whole screen.
11. Switch the device to dark mode and look again at 1, 4, 8 and 9: everything readable, the picture itself unchanged.
12. Open `gallery.html` and go to the last section, "The map: its card and its pop-up": three card specimens (titled, a long title cut short, no title and no eye; loading and failed) and the pop-up fitted, loading and failed, in place.

## Gallery pictures expected to change

- New: `phone-light-map-parts`, `phone-dark-map-parts`, `tablet-light-map-parts`, `tablet-dark-map-parts` (the new last section). CI draws them; they go to Design.
- No other section changes: the section is last, and the Dialog's changes apply only to the new Picture variant and to a title given `over` (no built pop-up uses either).
