# m5b-gate-bugs-2 — the step total (ruled B), "Run by hand ›", and "‹ Campaigns" on a phone

Francis's rulings of 2026-11-05 on the early gate walk. Feeds gate checks 9 (guided creation's steps), 6–7 (the rules rows in set-up and on the Rules tab) and 8 (the phone layout).

1. **iPad, the step total.** On classic-advanced (or the fixture pack `scripts/fixtures/m5b-creation.fixture.json`), Create your character → Guided. Scores says **"Step 1"**, Kindred **"Step 2"**, Class **"Step 3"**, with no "of …".
2. **iPad, after the class.** Pick a class. The next step (Adjust scores, or Who they are) says **"Step 4 of N"**. Walk on with Next to the review: the number goes up by one each step and N never changes; the review says "Step N of N · Review".
3. **iPad, Change › on the class.** From the review, Change › on the class, pick a different class (one with first spells, if the setting has one) and walk on: the steps after it say "Step 4 of M", M worked out for the new class, and it holds to the review.
4. **iPad, set-up step 3.** New campaign with a setting that has a rule run by hand (a pack option marked `manual`). In its group the row reads **"Run by hand ›"** (underlined, a link) then **"· the app doesn't apply this yet"** (grey, not underlined). Tap "Run by hand ›": the rule's words open in a pop-up.
5. **iPad, the Rules tab.** The same campaign's Rules tab: the same row looks and works the same way.
6. **Phone (375 px), the campaign screen.** Open a campaign. The back link at the top left reads **"‹ Campaigns"** in full, never "‹ Your campaig…". On an iPad it still reads "‹ Your campaigns".
