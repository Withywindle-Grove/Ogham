# Manual checks: dec-9a-icon-set (plan dec-9, piece A)

Piece A is data and logic only: no screen uses the new icons yet (pieces B, C and D do), so there is nothing new to see in the app.

1. **The app looks the same.** Run `npm run dev`, open the URL it prints, sign in and open the Scene, the Player screen and the drawer. You should see every icon exactly as before (the line icons; nothing filled).
2. **The source files are there.** On GitHub, open the pull request's Files tab and find `src/ui/iconSet/`. You should see seven `.svg` files: crystal-ball, hourglass, locked-chest, pointy-hat, sword-brandish, trumpet-flag, water-splash. Tapping one shows the icon white on a black square (the set's own file, unchanged).
3. **The credits are recorded.** Open `src/ui/iconSet.ts` in the same tab. Each of the seven rows names its author (Lorc or Delapouite); the top of the file names the set (game-icons.net) and the licence (CC BY 3.0, with its link).

Gallery pictures expected to change: none (no screen draws a set icon yet).
