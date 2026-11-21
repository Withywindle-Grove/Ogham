# Manual checks: fix-rule-text-box (the shared rule text keeps a box's words)

The lead's ruling of 2026-11-14 under mc-34: a place's knowledge and rules carry the book's full text. The shared rule-text part (`RuleText`) now draws a boxed aside and keeps a numbered list's numbers; nothing in a rule's text is dropped.

1. Run `npm run dev`, open the URL it prints with `/gallery.html` on the end, and scroll to the section **Places from packs**.
2. Find the specimen "A place's rules for players (dec-7 piece 3) …". Under the place line is the rule "Falling into the harbour" in the book's words.
3. You should see, in this order: the opening paragraph; the heading "Each turn in the water"; "**Swimming.** A save …"; a bulleted list of three ways out; **a bordered box** titled "**The old ladder**" holding a sentence and a one-item list; the table "Hauled out"; the source line.
4. The box's words are in the same face and size as the text around it (not the heading face); its border is the thin rule colour, with rounded corners, inside the text's width.
5. Switch to dark mode (the gallery's theme switch, or your device's): the box's border is still visible and the words readable.
6. Narrow the window to a phone's width (375 px): the box fits the width with no sideways scrolling; long words wrap.

Gallery pictures expected to change: the **places** section, phone and tablet, light and dark: the "Falling into the harbour" specimen gains a list and a box (the fix's gallery entry). Nothing else should change: no pack today puts a box in a place rule, so real screens look as before.
