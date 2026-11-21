# Manual checks: au-version-and-notice (F55, au-1 and au-2)

The automatic tests prove the words and the rule with a stand-in for the service worker. They don't prove that an
installed app on a real iPad reloads. These checks do. Run them on the Vercel preview first, then (after the merge)
on the installed app.

## On the preview (any browser)

1. Open the pull request's Vercel preview and sign in. Open any campaign screen and tap ⋯ (on a phone, ≡, then your
   name at the drawer's foot). **You should see**, at the very bottom: a small grey line "Version xxxxxxx, built
   10 Nov 2026" (seven letters and digits, the commit's short id), and under it a row with a circling arrow,
   "Check for a new version".
2. Tap **Check for a new version**. **You should see** the menu close and a toast "You're on the latest version."
3. Turn on airplane mode (or, in Chrome, DevTools > Network > Offline), open ⋯ again and tap **Check for a new
   version**. **You should see** "You're offline. Try again when you're back online." Turn the network back on.

## On Francis's installed iPad (after the merge reaches main)

4. Open the installed app from the home screen. Open ⋯ and read the version line. Write down the seven-character id.
5. Wait for the next deploy to main (any merged pull request). Keep the app open on a plain screen (the Player
   screen, nothing being typed). Tap ⋯, then **Check for a new version**. **You should see** the app reload by itself
   within a few seconds; open ⋯ again: **the id is the new one** (it matches the newest commit on main on GitHub).
6. To see the held case: after another deploy, start making a character (New character, any step after the first)
   and pick something on the step. Open creation's **More** (top right) and tap **Check for a new version**. **You
   should see** a pop-up "A new version is ready" with "Finish or leave what you're typing first, then check again."
   and **OK**. Tap OK: the pop-up closes, nothing reloads, your picks are still there.
7. Leave creation (More > Save and leave). **You should see**, within a second or two, near the bottom, a toast
   "A new version is ready." with **Reload** (no accent colour; it goes after a few seconds). Tap **Reload**: the app
   reloads into the new version; ⋯ shows the new id.
8. Unchanged: with a form open and a version waiting, switch to another app and back. The app should switch to the
   new version (as before this change); during character creation it should not (it waits until creation closes).

## Gallery pictures this step changes

- **molecules** (phone and tablet, light and dark: 4 pictures). The ⋯ menu specimen gains its foot (the version line,
  with the fixed stand-in "Version a1b2c3d, built 15 Jan 2026", and Check for a new version); a new specimen,
  "Toast, action variant: a new version held back", shows the notice. The four baselines are deleted in this pull
  request and redrawn from the next run's gallery-baselines artifacts.
- **phone-navigation** should not change: the drawer specimens show the foot folded, and the version sits inside it.
