# Manual checks: m5b-pack-update-reaches-items (F27)

On the pull request's Vercel preview (the test project), or the live app after the merge, in the fae-woodland campaign where the hunter has a longbow added before the 0.3.74 update:

1. Sign in as the hunter's player. Open the campaign, then **Pack**.
2. Under **At hand**, the longbow's row should end with "Quiver: …" (the arrows it carries, or "nothing chosen"), and a **Quiver** button should sit beside it. Before this fix there was neither.
3. Tap **Quiver**. The mode sheet lists the bow's arrows as pick rows. Pick one: the row's line changes, and Undo puts it back.
4. Tap the longbow's row to open its sheet. The weapon's lines include anything the update added (a range, for example). The damage is what it was before.
5. On the same sheet, the last line reads "From your setting: …" with the book's title and the page, never a short code such as "PB" (gate check 73).
6. As the GM, open the marching order and tap the hunter. Under what's at hand, the longbow reads "Longbow, Quiver: …".
7. A typed item (added with a name only, not from the setting rules) looks exactly as before.

Gallery pictures expected to change: none. The gallery's specimens draw items from fixed data, not from a pack update.
