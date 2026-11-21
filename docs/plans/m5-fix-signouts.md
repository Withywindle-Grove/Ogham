# Fix: unexpected sign-outs (M5 gate item 15, hand-off D1)

Technical fix; written by the builder session (Francis asked for the technical gate items to go ahead, 2026-11-01).

## What the auth logs show (main project, 2026-10-31 and 11-01, UTC)
- **20:39:25:** the GM's account signs out on one device (`/logout`) to switch to a player account. supabase-js's `signOut()` defaults to **scope "global"**, which revokes the account's sessions **on every device**.
- **00:13:33:** the GM's iPad tries to refresh and gets `refresh_token_not_found`, so it's signed out. It signs in again at 00:14. A second `refresh_token_not_found` at 00:23:34 follows a Supabase `/user` timeout (504).
- **About 02:11–02:24:** a player in a private window is signed out with **no** error on the server. The device lost its stored session (Safari private-window storage), and the app went straight to the sign-in screen.

## What to build
1. `src/core/auth.ts` `signOut`: `db.auth.signOut({ scope: 'local' })`. Signing out ends this device's session only, as people expect.
2. `watchSession`: a null session from a `SIGNED_OUT` event that this device didn't ask for (no Sign out tapped) gets one more look. Call `getSession()` once; if a session is back, stay signed in. Only otherwise show sign-in. No new screen or words: a "your session ended" notice would be a design change (⚑ below).

## Tests (purpose first)
- "Signing out on one device asks Supabase to end only this device's session (scope local)."
- "A sign-out event this device didn't ask for, followed by a valid session on a second look, keeps the person signed in."
- "A real sign-out (Sign out tapped) shows the sign-in screen at once."

## ⚑ for Francis
- ~~Show a short "Your session ended; sign in again" notice?~~ Ruled 2026-11-01: no notice; the app shows the sign-in screen as today.
- Tell players not to use private windows: their sign-in can vanish there.

## Estimate
About 6 turns on Opus. No migrations.

## Departures
- **Two extra tests** beyond the three listed: "a sign-out the device didn't ask for, with no session left on the second look, shows the sign-in screen" and "once the app stops watching, a second look that lands late changes nothing".
- **The second look waits one tick** (`setTimeout 0`) before calling `getSession()`: supabase-js warns that calling it from inside the `onAuthStateChange` callback can lock up.
- **How the tests came first.** The test guard blocks test edits on `fix-` branches, so the tests were written on a temporary branch (`signouts-tests`, as the guard's message allows), shown failing without the fix (3 of 5 failed), committed on their own, and `fix-signouts` was fast-forwarded to that commit before the fix was committed. The guard and the pre-commit check don't fit together for a failing test, since `npm run check` fails on it; the test commit passed the hook only because the fix was already in the working folder, unstaged. Worth a process ruling.
- The ⚑ about a "session ended" notice was ruled while building (2026-11-01, relayed by the coordinator): no notice.
