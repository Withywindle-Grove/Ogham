# Manual checks: dec-7-2-rule-icon-button (plan dec-7, piece 2: a rule's button as an icon)

Stacked on piece 3 (#726): these checks need #726's harbour.

1. **The splash alone.** Run `npm run dev`, then open `/layout.html?as=player&placeRules=splash` (the URL it prints, with that path). Tap the campaign "The Drowned Marches", then Scene. Under the jetty's description, at the left, you should see one square button, the same height as other large buttons, showing only the water-splash icon (no words).
2. **Its words are its label.** With a screen reader on (VoiceOver: triple-click the side button on an iPad), move to that button. It reads "Someone fell in: Falling into the harbour". Tap it: the rule's sheet opens with the book's words and only the X.
3. **The splash beside a words button.** Open `/layout.html?as=player&placeRules=1` and go to the Scene as above. You should see the splash, then a second button with the scales mark and the words "Someone is swimming for the breakwater at the turn of the tide", 8 px apart. On a phone the second button wraps under the first, its words over two or more lines. There should be as much space above and below the words as on a one-line button.
4. **Light and dark.** Switch the theme (menu, then Theme) and look again: the icon takes the text colour in both.
5. **The checker.** Add `"button": { "icon": "lantern-moth", "words": "The eels are running" }` to a rule in a test pack and run `npm run pack:check -- <file>`. You should see a line starting "Note:" saying the icon isn't in the app's set, and the check still passes. `"button": ""` gives an "Error:" line instead.

There's no long-press reveal of the words yet: no part of the app has one.

Gallery pictures expected to change: the "Places from packs" section (`*-places.png`), whose rules specimen now shows the splash beside a words button. It has no approved baseline yet. The layout page's harbour (pictures of #726's picture 7) now shows the splash in place of "Someone fell in", and its words button is 48 px tall, not 44.
