# Manual checks: book-listrow-titles

The List row's title at 20 px inside the book's type (the lead's ruling, pq-1 sizes, 2026-11-14).

1. Run `npm run dev`, open the gallery (`/gallery.html`) and scroll to the last section, "The List row in the book's type".
   You should see four rows: "Lantern ward" and the long ability name larger (20 px; the long one wraps onto a second
   line, "87 %" staying whole at the right), "Bog sense" at the normal size beside its large "3-in-6", and "Set by" at the
   normal size with "The GM, day 2" under it.
2. Make the window 375 px wide (or open it on a phone). Nothing should run off the right edge.
3. Scroll up to "The players' screens" section. Its rows' names are the normal size, as before.
4. In a campaign, open a status's sheet (tap a ring on the marching order, then the status). "Source", "Set by" and
   "Log" look exactly as before.

## Gallery pictures expected to change

- The new last section `book-list-rows` (all four sizes and themes): new pictures, for Design.
- The whole-page `gallery-*` pictures: longer by the new section.
- No other section should change: no gallery section drew a List row inside the book's type before this.
