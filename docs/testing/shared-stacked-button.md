# Manual checks: shared-stacked-button (the shared stacked button and the Studio's icons)

Almost nothing a player sees changes in this pull request: the shop's Buy is now drawn by the shared part and must look exactly as before; the new icons are in the app's icon table but no screen draws them as buttons yet. The one visible change is that About this app's Credits list the new icons.

1. **Open the pull request's Vercel preview, then the component gallery** (the preview's address with `/gallery.html` at the end). Scroll to the very bottom. You should see a new last section, **"The stacked button: the icon above its word, secondary and primary"**.
2. **In its first row (Secondary):** three buttons with a light surface and a thin border, each with a picture above its word: a tick over **Done**, a running figure over **Ask for escape rolls** (on two lines, centred), and two coins over **Buy**. None is narrower or shorter than a fingertip.
3. **In its second row (Primary):** two buttons in the accent colour: a play triangle over **Start**, and a door over **Leave the dungeon** (on two lines, centred).
4. **Switch the gallery to dark mode** (add `?theme=dark` to the gallery's address and reload). Both rows stay readable: the words and pictures stand out from their buttons.
5. **Scroll up to "The shop's stock rows".** Each row's **Buy** looks exactly as it did before: the two coins above the word, at the row's right end.
6. **In the app, start creating a character and reach the Shop** (the Gear step's shop). Tap **Buy** on any thing: it is bought at once, as before, and Buy looks the same as before.

7. **Open ⋯, then About this app.** Under Credits there is now a row for each of the 40 icons (the new ones too, such as Banner, Magic palm, Spell book and Heraldic sun by Caro Asercion), A to Z, each with its author and CC BY 3.0.

Gallery pictures expected to change: the new **stacked-button** section (new pictures at every size and theme, for Design), and the **molecules** section, whose About this app sheet now lists 40 icons. Every other section, the shop's **stock-rows** included, must not move.
