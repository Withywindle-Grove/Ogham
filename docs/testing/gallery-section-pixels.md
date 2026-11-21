# Gallery sections on whole pixels (the "1 px offset" pictures; coordinator-ruled technical fix, 2026-11-05)

No screen in the app changes. These checks are on the hidden component gallery and on CI.

1. **iPad, the preview's gallery.** Open `/gallery.html` on this pull request's Vercel preview. Scroll through every section (Colour tokens to Wilderness) in light, then tap Dark. Everything should look exactly as before; the only difference is up to one pixel of extra space at the foot of each section, which you shouldn't be able to see.
2. **Phone (375 px), the same page.** Same as 1: nothing should look different.
3. **CI, this pull request.** Open the pull request's Checks tab, then the layout job. The new test "every gallery section starts on a whole pixel and is a whole number of pixels tall, phone and tablet" passes. The "matches the approved pictures" tests fail on this pull request only because the approved pictures are being redrawn once (see the status report, item 6); the run's failure list now shows **every** changed section at once, not only the first.
4. **After Design approves the redrawn pictures and they're committed,** re-run the layout job twice (Checks → layout → Re-run jobs). Both runs pass with no picture differences.
5. **The next pull request that adds a part to the gallery** (for example a new specimen in Molecules): only the section it was added to shows a changed picture. Choosing, Organisms, States and Wilderness below it don't.
