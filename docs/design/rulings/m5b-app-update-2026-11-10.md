---
status: absorbed
milestone: m5b (from the gate rewalk; built the same evening, held until the sitting ends)
absorbed-into: with the pull request that builds it (05 the app's updates; 06 the ⋯ menu's foot and the notice); docs/09-decisions-log.md (2026-11-10); docs/06-screens-and-design.md (⋯ menu: its foot; Toast: the new-version notice)
supersedes: none
---

# Seeing and taking a new version of the app (2026-11-10)

From the M5b gate rewalk (finding F55, `design/notes/gate-m5b-rewalk-2026-11-10.md`): after a deploy the Tester's browser kept the old version through two reloads, and nothing in the app says which version is running or that a new one is waiting. As built before this ruling, the app looks for a new version when it starts and each time it comes back on screen, and switches by itself only when nothing is at risk (no field in use, no form on screen, no creation open); that stays. Francis asked for a way to reload to the current version and ruled **both** parts. Ids `au-1`, `au-2`.

- **au-1 The version, and a way to ask.** At the foot of the ⋯ menu: a quiet line with the version on this device, and one item, **Check for a new version**.

| When tapped | What happens |
|---|---|
| A new version is waiting and nothing is at risk | The app reloads into it at once |
| Already on the latest | A toast: "You're on the latest version." |
| A form, a field in use, a pop-up or creation is open | No reload; a pop-up says why: "A new version is ready. Finish or leave what you're typing first, then check again." |
| Offline | It says so: "You're offline. Try again when you're back online." |

  The item is never disabled.
- **au-2 A notice when a version is held back.** When a new version has been found and the at-risk rule is holding it, a small notice says "A new version is ready." with **Reload**; Reload follows the table above. It covers neither the foot buttons nor a toast, and it is not the screen's accent button. Built from the toast's action variant: no new part.

**Built, not ruled (the Builder's ⚑ list, `docs/status/2026-11-10-au-version-and-notice.md`; for the grouped list):** the notice also waits while a pop-up or creation is open; the pop-up's sentence split into a title and a line; a new refresh icon on the menu item; how long the notice stays; a "Checking…" word; the words when the server can't be reached while online; the version line's own words.

**Not tested on a device:** an installed app on a tablet reloading on demand. Francis checks it by hand after the sitting; the status file says what was and wasn't tested.

09: 2026-11-10 — [ui] The ⋯ menu's foot shows the version on the device with Check for a new version (reloads when nothing is at risk, else says why; says so when current or offline), and a notice says when a new version is ready but held back by something open (au-1, au-2); the automatic switch stays — After a deploy the app could stay on an old version with nothing to say so and no way to ask (rewalk F55) — `design/rulings/m5b-app-update-2026-11-10.md`
