# Manual checks: dec13-c7-toggles (plan dec-13, row C7: toggles, tg-1)

On the pull request's preview (or `npm run dev`), as a player whose character carries a light (a torch, or a lantern and oil).

1. Open your character's screen and find **Light**. Tap **Light**. You should see the flame ring, the light's name in bold, and under it "Lit, 6 turns left" (a lantern with oil adds ". 2 refills left"). At the right of that row is a **toggle**, switched on (a tick on the knob). There is no "Put out" button.
2. Under the row you should see **Keep lit**, then ⓘ, then a second toggle, switched off (a cross on the knob). Tap the toggle: it slides on, and a toast says "<light> will be kept lit". Tap ⓘ: a pop-up explains Keep lit.
3. With a lantern and oil, **Refill** sits at the right under the row as a box with a jug above the word. Tap it: the line's count of refills drops by one.
4. Tap the light's own toggle. The light goes out at once: the section shows **Light** again, and a toast says "Put out <light>" with **Undo**. Tap Undo: the lit row comes back where it was, its toggle on.
5. Open **Scene**, tap your own tile in the marching order. In the card, under Light, **Keep lit** is the same toggle with its name and ⓘ.
6. Do 1–5 on a phone (375 px wide) and in dark mode: nothing runs off the screen, and every toggle is easy to hit.

## Gallery pictures expected to change
- The players' screens section (`#players-standard`), the Light specimens, at every width and theme: the toggles replace Put out and the pressed Keep lit, the light's name sits above its line, and the first specimen (Storm lantern) now shows Refill and Keep lit on.
