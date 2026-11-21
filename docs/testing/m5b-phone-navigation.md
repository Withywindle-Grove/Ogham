# Manual checks: m5b-phone-navigation (slice E, the phone's tab bar and drawer)

Open the pull request's Vercel preview on a phone (or a desktop browser at 375 px wide: right-click, Inspect, the phone icon, pick an iPhone). Sign in as a player with an approved, active character, then as the GM of the same campaign.

## A player on a phone

1. Open the campaign. **You should see** ≡ at the top left with your character's name beside it (a long name ends in "…"), no "‹" link, and ✉ at the right with no Log icon and no ⋯. Tap Scene: the name beside ≡ becomes the campaign's. Tap Pack: it reads "<your character>’s pack". At the bottom: Player, Scene, Pack and Log, with a crown, a campfire, a tied sack and an open book. Player is bold, with a short dark-red mark above it (copper in dark mode).
2. Tap **Log**. **You should see** the whole log over the whole screen, as the Log icon opens it on a tablet. Tap ✕: you are back on Player, as you were.
3. As the GM, send the player's character a message. Back on the player's phone, **you should see** a small "1" in a red pill at the campfire's corner. Open Scene and read the message; the pill goes away.
4. Tap **≡**. **You should see** a panel over the left side of the screen, the page dimmed behind it. At its top: the campaign's name and ✕ (no gear for a player). Then the groups: **This campaign** (Full character sheet, Company if your campaign uses companies, Setting rules with a pair of scales), **Your characters** (each character with its first letter in a ring, the active one shaded, then "Your characters"), **Elsewhere** (Your campaigns, with two banners). At the foot: your name and "App settings, sign out".
5. Tap your name at the foot. **You should see** This device (Theme, Text size), Rules library and Sign out appear under it. Switch the theme: the drawer stays open.
6. Tap outside the drawer (on the dimmed page). It closes. Open it again and tap **Setting rules**. **You should see** the drawer close and the setting rules open.
7. Open ≡ again and tap **Your campaigns**. **You should see** your list of campaigns.
8. With a second approved character: open ≡ and tap that character. **You should see** its Player screen; open ≡ again: it is now the shaded one.
9. Open **Create** and start a new character. **You should see** creation's own bar only (← title ⋯): no ≡, no tab bar.

## The GM on a phone

10. Open the campaign as the GM. **You should see** ≡ and the campaign's name at the top left, no Log and no ⋯ at the top right; the bottom tabs are Scene, Players, Rules (a pair of scales) and Log (an open book), the current one bold with the mark; when something waits, Players has a small red pill with the number. Tap Log: the whole log over the screen; ✕ comes back.
11. Tap **≡**. **You should see** a gear beside the campaign's name, then **As the GM** with Companies (if the campaign uses companies), then **Elsewhere** and your name at the foot. There is no "Your characters". Tap the gear: the drawer closes and the Rules tab (Rules for this campaign) opens.

## A tablet (or a desktop browser 820 px wide or wider)

12. Open the same campaign as the player and as the GM. **You should see** nothing new: the "‹" link at the top left, Log and ⋯ at the top right (the ⋯ with everything it had), the player's three sections (Player, Scene, Pack) and the GM's (Players with "· N waiting" in words), no ≡. The icons are the phone's: a crown, a campfire, a tied sack; the GM's Rules a pair of scales; the top row's Log an open book.

## Keyboard (desktop browser at 375 px)

13. Tab to ≡ and press Enter. Focus is inside the drawer, on its first row. Press Escape: the drawer closes and focus is back on ≡.

## Gallery pictures expected (new; CI draws them, they go to Design)

The gallery's new last section, **phone-navigation** ("The phone's navigation: the tab bar and the drawer"), phone and tablet, light and dark: the tab bar with Player current and nothing waiting; Scene current with 1 waiting; Log current with 99; 120 shown as 99+; the GM's bar (Scene, Players with a 99 badge, Rules, Log); ≡ with a long campaign name (the drawer closed); the drawer open for a player, for a player with no characters, and for the GM (with the gear). At the tablet width the tab bar specimens draw the tablet's left column, as the app does there. One existing picture changes too: **molecules** (phone and tablet, light and dark), where the ⋯ menu specimen's Setting rules now shows the scales. No other section's picture should change.
