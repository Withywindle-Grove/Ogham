# Manual checks: dec13-c4-details (C4, Details)

On the pull request's preview (or `npm run dev`), open `/layout.html?as=player&p1=1` and tap "The Storm Lantern Road".

1. On a tablet held sideways (or a window 1180 px wide): "Details" is the last part of the left column. It shows one line, "Motto" in the book's label colour, then "The beacon before the bed." No chevron (there is nothing more to open).
2. Under "Languages" (right column), the boxes "Reedish" and "Common". No "Literacy" line appears in Details.
3. On a phone (375 px wide): the same "Details" part sits in the one column, its line whole, nothing cut off.
4. Open `/layout.html?as=player` and tap "The Drowned Marches". In "Details", three lines show and a chevron sits at the right. Tap the chevron: the rest opens in place and the page doesn't jump. Tap it again: back to three.
5. Tap anywhere on the lines (not on the chevron): they open or fold the same way.
6. While the page is still opening, "Details" may briefly say "Nothing written yet." in the muted small type (14 px), then the lines replace it.

Gallery pictures expected to change: none of the existing gallery pictures. The Details part is new on the Player screen; the full sheet's own "Details and backstory" is unchanged. The GM's hidden fields can't be seen on any screen today (a GM has no Player screen); the unit tests cover them.
