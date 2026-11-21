# Manual checks: perf-lazy-and-fetch (perf fixes 1 and 2a)

Use the pull request's Vercel preview (the test project). Gallery pictures expected to change: **none** (the
gallery doesn't use the lazy screens, and the fonts are declared exactly as on main).

**A cold load on a phone**
1. [ ] On a phone, in a private (incognito) tab so nothing is stored yet, open the preview. The sign-in screen
   (the name, the tagline, the email box) shows noticeably sooner than on the live app opened the same way.
2. [ ] Sign in. Your campaigns shows; a few grey rows may show for a moment first, never a blank page.
3. [ ] Open a campaign as a player, then Create, then (as a GM) a campaign of yours, New campaign and ⋯ → Rules
   library. Each opens straight away, or after a moment of grey rows; nothing is missing or out of place.
4. [ ] As a player with a character: open the Pack screen, then ⋯ → Setting rules. The rules list shows at once
   (it reuses what the Pack screen downloaded). As the GM: open Reference, then the Setting rules section; both
   show the same packs and entries as on the live app.
5. [ ] As the GM, in Setting rules attach or remove a pack (then Undo). The list changes at once, and a player's
   ⋯ → Setting rules shows the change after they come back to the app.

**Offline after the first load**
6. [ ] On a tablet, open the preview, sign in, open a campaign and wait about ten seconds (the app stores itself).
   Turn on airplane mode, close the tab or the installed app, and open it again. It opens, signed in, and every
   screen from step 3 opens (data you hadn't loaded may say it can't be read; the screens themselves open).
7. [ ] Still offline, in a fresh private tab (nothing stored), open the preview: the browser's own offline page,
   as before. Back online, it loads.

**A new deploy while the app is open**
8. [ ] Open the preview on a tablet and leave it on Your campaigns. Ask Claude to push any small change to the
   branch (or wait for the next one) so the preview redeploys. Come back to the app (switch away and back): it
   switches to the new version at a calm moment, as before (not in the middle of typing).
9. [ ] With a form half filled in (e.g. New campaign's name typed), switch away and back after a redeploy: the
   typing is kept; the switch waits until you leave the form.
10. [ ] Ideally once: if a screen ever says "Couldn't open this screen", tap Try again; if it then offers Reload,
    tap it and the screen opens on the new version.
