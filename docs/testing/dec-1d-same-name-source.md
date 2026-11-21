# Manual checks: dec-1d-same-name-source (plan dec-1-creation 1d, sn-1)

On the pull request's Vercel preview (test project). You need a campaign with two setting packs attached that each have a class of the same name (another id), for example two invented packs each with a "Lantern Warden".

1. **Creation, two packs.** As a player in that campaign: Create your character, Guided, through to the Class step. Each of the two same-named classes shows its name as before; the row's last line, under its one-line description and page source, is a quiet, smaller "From <its pack's short name>". Every other class has no such line.
2. **Phone width.** Same step on a phone (or the browser at 375 px wide): nothing scrolls sideways; the From line is the row's last line.
3. **Pick names it.** With a screen reader (or the browser's accessibility tree), the two Pick buttons are "Pick Lantern Warden (from <pack>)", each its own.
4. **The review.** Pick one of the twins and go on to the review: its line reads "<Class title>: Lantern Warden (from <pack>), level 1".
5. **Rules browser.** The campaign's rules, Classes: each of the two shows "From <pack's name>" under its name (as every row already does with more than one pack).
6. **The sheet.** Open the full sheet of a character with one of those classes: the line under the name reads "Lantern Warden 1 (from <pack>), <kindred>". On a phone, a long class name wraps before the bracket, never inside a word.
7. **One setting.** In a campaign with one setting pack (the usual case): creation's Kindred and Class steps, the review, the Rules browser and the sheet look exactly as before.
8. **pack:check.** `npm run pack:check -- scripts/fixtures/dec-1d-twins-a.fixture.json scripts/fixtures/dec-1d-twins-b.fixture.json` prints "No library notes." and then "Same-named entries, for information (1; …)" with `item "Reed lamp"` and both packs. It ends without an error.

## Gallery pictures

- New: `same-name-source` (phone and tablet, light and dark): the Class step with two pairs of namesakes ("From <pack>" as each row's last line, under the description; moved there on 2026-11-12 from under the name, Francis's change to the first picture, so this picture changes) and a row with none; the sheet's identity line with a long class name and both sources in brackets. Baselines: `tablet-light-same-name-source.png` committed from run 43255775539's `gallery-baselines-1` (1x; the From line as each row's last line, checked by eye). The other three (`phone-dark-`, `phone-light-`, `tablet-dark-same-name-source.png`) committed from run 43294468869's `gallery-baselines-1` (1x), each checked by eye: the From line last in each row, a long name wrapping before the bracket at phone width.
- No existing picture should change: a row without a namesake is drawn as before.
