# Manual checks: mn-1-menu-folded (the menu starts folded)

Francis's ruling of 2026-11-14: "I keep the icon rail collapsed generally, that should be the default mode." The
automatic tests check the stored choice and the handle in a pretend browser, and the folded default at 1180 px in
WebKit; they don't use a real iPad. These checks do. Use the pull request's Vercel preview on an iPad held landscape
(the menu column only shows at 1024 px wide and wider).

1. In a private Safari tab (so nothing is remembered yet), sign in as the GM and open a campaign. **You should see**
   the left menu folded to its icons (Scene, Players, Rules), with the handle's ▶ on the divider.
2. Tap the divider handle. **You should see** the menu open with its names, and the ▶ turn to ◀.
3. Reload the page and open the campaign again. **You should see** the menu still open: your choice is kept.
4. Tap the handle to fold it, reload. **You should see** it still folded.
5. As a player, open a character's campaign. **You should see** the same: folded at first, and the handle opens it.
6. In your usual (not private) Safari: if you had the menu open before this change, **you should see** it folded once;
   open it and it stays open from then on (the old version didn't store "open", so the app can't tell it apart from
   never having chosen).
7. Phone or iPad held upright: unchanged. Tabs at the bottom or the top, no fold, no handle.

## Gallery pictures this step changes

None expected. The gallery draws the menu with its fold set by each specimen, not from the device's stored choice, so
no gallery picture changes.
