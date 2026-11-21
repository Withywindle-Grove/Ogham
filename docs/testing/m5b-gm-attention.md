# Manual checks: m5b-gm-attention (the GM rail's glow)

Plan `docs/plans/m5b-sheet-revised.md`, PR 2 (steps 9–11). Use the pull request's Vercel preview (test database), two devices or two browsers: one signed in as the GM, one as a player.

1. **Lit.** As the player, make a new character and send it for approval. On the GM's device, open the campaign (it opens on Scene). The Players icon in the left column (iPad) or the tab bar (phone) is drawn in the warm glow colour and slowly brightens and dims, about every 2.4 seconds. Scene and Rules stay plain.
2. **Selected keeps it.** Tap Players. The tab is selected (framed) and its icon still glows. "Waiting for approval" with the character is near the top of the tab.
3. **Goes out when the list empties, not on a visit.** Tap Scene, then Players again: still glowing. Approve the character: the glow goes out at once and the tab reads just "Players".
4. **A sheet change lights it too.** As the player, on an approved character, Edit, raise a score, Send to the GM. The GM's Players glows again; Approve or Refuse puts it out.
5. **Reduced motion.** On the iPad, Settings, Accessibility, Motion, Reduce Motion on. Repeat step 1: the icon glows but doesn't pulse.
6. **Screen reader (optional).** With VoiceOver on, touch the Players tab: it says "Players: 1 to approve" (with a request waiting too: "Players: 1 to approve, 1 to answer").
7. **Light and dark.** Check steps 1–2 in both themes; on the light page the glow is softer (the words in the tab still say it).

Gallery pictures expected to change:
- `phone-navigation` (all four): its GM tab-bar specimen has 99 waiting on Players, so that icon now glows. Baselines deleted; CI draws new ones for Design.
- `gm-attention` (new section, all four): lit, lit and open, unlit, reduced motion (still), the GM's phone bar lit. No baselines yet.
