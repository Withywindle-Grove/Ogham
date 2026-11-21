# Manual checks: au-followup-checking-words (the follow-up to #613, 2026-11-11)

On the pull request's Vercel preview (a tablet or a phone browser), signed in, inside a campaign.

1. Open the ⋯ menu (or, on a phone, ≡ then the person row at the drawer's foot). Tap **Check for a new version**.
   You should see "Checking for a new version…" in a toast for a moment, then it is replaced by "You're on the latest
   version." (or, on a first visit before the app has installed itself, "Couldn't check just now. Try again in a
   moment." Tap Check again after a reload; it should then say you're on the latest version).
2. Turn on airplane mode (or switch the Wi-Fi off) and tap Check again. You should see "You're offline. Try again when
   you're back online." in an ordinary toast, the same look as "Saved" (not the error look).
3. With the Wi-Fi back, open the menu's foot again and look at the version line ("Version …, built …"): it should be
   easy to read in light and dark mode, the same size as other small grey lines. The Check row should be as tall as
   the rows above it.

After the merge, on Francis's installed iPad (needs a deploy after this one, so a new version is waiting):

4. Open a character's creation (or any form, such as Add item), leave it open, and tap ⋯ › Check for a new version
   while a new deploy is waiting. A pop-up "A new version is ready" with "Finish or leave what you're typing first,
   then check again." and a **Keep working** button. Tap Keep working: the pop-up closes and **no** "A new version is
   ready." notice follows straight after.
5. With creation still open, switch to another app and come back. Close creation: the "A new version is ready." notice
   with Reload shows, then goes by itself after a few seconds (it doesn't stay). Open creation again (the version stays
   held), switch to another app and come back with creation still open, then close creation: the notice comes back.
   (Without creation open, switching away installs the new version instead, as before.)
6. Tap Reload on the notice with nothing open: the app reloads into the new version, and the ⋯ menu's version line
   shows the new id.

Gallery pictures expected to change: **none**. The notice's words, the menu's foot and the version line are unchanged;
the at-risk pop-up (whose button now reads Keep working) and the "Checking…" toast are not in the gallery.
