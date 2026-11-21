# Manual checks: rules-tab-copy-setup (Copy the set-up, cs-set-1)

On the pull request's Vercel preview (test project), signed in as a GM of a campaign with at least one pack that has optional rules, one of them changed from the book.

1. Open the campaign, tap **Rules**. At the foot of Rules for this campaign you see **Copy the set-up**, above **Reset to the books' defaults** and **Retire campaign…**.
2. Tap **Copy the set-up**. A toast says "Set-up copied".
3. Paste into any notes app. You see, in this order: the campaign's name; "Setting rules" with each pack and its version; "New characters start at: …"; "App settings" with Yes/No lines, the start time and (if the setting has a calendar) the calendar start; "Optional rules changed from the book" with your changed rule first as "<rule>: <choice>"; then "Optional rules as the book has them".
4. Change one more optional rule, tap Copy again, paste: the newly changed rule is now in the changed list.
5. On a phone (375 px wide), the button is full size and nothing runs off the screen.
6. Optional: open the preview over plain http on a device that blocks the clipboard. Tapping Copy opens a pop-up, "Couldn't copy it here. Select the text below and copy it by hand.", with the summary and **Done**.

Gallery pictures: none expected to change (the gallery draws the `RulesForThisCampaign` organism, not the Rules tab's foot). The layout screen `gm-optional-rules-rows` gains the button in its screenshot; it has no baseline.
