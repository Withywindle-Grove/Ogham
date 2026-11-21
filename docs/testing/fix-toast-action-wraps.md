# Manual checks: fix-toast-action-wraps

A toast with an action now keeps its message across the toast; when the message and the action don't fit on one line, the action drops under it, at the right (the lead's toast ruling of 2026-11-13). On an iPhone (or a browser at 375 px wide), light theme:

1. [ ] Open the component gallery (`/gallery.html`). The "Toast with Undo" reads "Dropped 3 torches" with **Undo** beside it on one line, the same height as before. The "action variant" toast reads "A new version is ready." with **Reload** beside it, one line.
2. [ ] In a campaign where you already play a character and approval is off, make a second character with a long name (for example "Mirelda Ashgrove-Thistlewaite of the drowned causeway") and send it. The toast "<name> has joined the party." spans the toast in full lines; **Play as <name>** sits on its own line underneath, at the right, and is easy to tap. The draining bar still runs along the toast's whole bottom edge.
3. [ ] Tap **Play as <name>**: the toast changes to "<name> is now your active character." (one line or two, no button).
4. [ ] Give or drop an item with a long name (for example "Lantern of the drowned causeway wardens"). The toast's message keeps the width; **Undo** drops under it at the right only when the two don't fit on one line. Tap **Undo**: the item comes back.
5. [ ] On an iPad in landscape, repeat 2: the toast is at most the reading width; a message that fits beside the button keeps it on one line.

Gallery pictures expected to change: none. The gallery's two toasts are short and stay on one line at their current height; the layout check measures them. The pictures for Design are on the throwaway branch `pictures-for-approval`, `docs/design/pictures-for-approval/toast-play-as-built/png/`.
