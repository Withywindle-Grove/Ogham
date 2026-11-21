# Manual checks: dec-7-1-standard-parts (December plan dec-7, piece 1, the standard parts)

Rulings: ds-1, ds-1a, ds-1b, ds-2, ds-3, mc-42a (air), mc-43a, mc-48 (`docs/design/rulings/dec-mockup-rulings-2026-11-12.md`).
Pictures: `docs/design/mockups/december/png/05-03-toggle-fill-dark.png` (frame B), `01-*` (branch `design-december-mockups`).

Start the app with `npm run dev` and open the address it prints, then add `/gallery.html` to it (for example
`http://localhost:5173/gallery.html`). Use the Theme buttons at the top for light and dark.

1. **The toggle, off and on.** Scroll to the last section, "The standard parts: the toggle, the eye, dice in words".
   You should see three rows: "Reed spear" (off), "Knife" (on) and a long lantern name (on). The name is at the left,
   the track at the right, and there are no "On" or "Off" words. Off: a plain track with the knob at the left showing a
   small cross. On: the track in the pale selected wash with a coloured edge and a soft golden glow, the knob at the
   right showing a tick. Tap anywhere on a row, the name included: it flips. Check light and dark.
2. **The toggle on a phone.** Narrow the browser to about 375 px wide (or use the phone view in the browser's tools).
   The long lantern name wraps onto several lines; the track stays at the right and never squeezes.
3. **The toggle where it is used.** In the Atoms section, "Dim pictures in dark mode" looks the same way. In the app,
   the same toggle appears in: Messages ("Disappears once read"), the marching order ("Locked: only you move it", GM),
   a request card's modifiers, a scene reminder ("Encounter check", "Players see it") and a status ("Hide time left
   from players", GM). Open one of them: it should look like step 1.
4. **The eye.** In the last section, two eyes with no box and no word: the first open (shown to the players), the
   second closed with lashes (hidden). Tap each: it flips between open and closed. With a screen reader (VoiceOver on
   the iPad), it reads "Map shown to the players, switch, on" (or "off").
5. **Dice in words.** In the last section: "Roll a d6: ..." has a cube before "d6"; "2 in 6" has a cube before it;
   the long line has a glyph before 3d6, d100 (two d10s), d4, d8, d10, d12 and d20, each its own colour; "The tide
   turns at dusk; no roll is needed." has no glyph. The glyphs are the size of the text. On the accent button
   "Swim, d20" the glyph is the button's text colour, not yellow.
6. **No Close beside an X.** In the app, as the GM, open Rules for this campaign and open a preset your rules already
   match. The sheet says "Your rules match ... already: nothing to change." and has only the X at the top right, no
   Close button at the foot. A preset that would change something still shows "Use ..." and "Not now".
7. **Air under a sheet's title.** In the gallery, open any sheet (for example the Molecules section's "End the
   expedition?" preview, or a weapon's sheet in "At hand"). The first line under the title sits a little further from
   it than before (4 px more).
8. **Table headings.** In the gallery's "Creation: the review" section, the prime experience table: the line under
   "Prime score" and "Experience" is a solid 2 px line in ink, clearly stronger than the dotted lines between rows.

## Gallery pictures expected to change (each at phone and tablet, light and dark)
- **standard-parts**: a new section (the toggle, the eye, dice in words). New pictures for Design.
- **atoms**: the "Dim pictures in dark mode" switch is the new toggle (ds-1).
- **creation-review**: the prime experience table's heading rule is 2 px of ink (mc-48).
- **molecules, creation-gear, creation-final-d, phone-navigation, players-standard, pack-standard,
  full-sheet-standard, sheet-revised, at-hand-actions, creation-long-tables**: each holds a sheet drawn in place;
  its first line moves 4 px further from the title (mc-42a), so everything under it moves down 4 px.
- No other section changes. The gallery's head (the Reduced motion switch) is in the whole-page picture only, which is
  not compared.
