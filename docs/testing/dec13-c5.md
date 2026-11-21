# Manual checks: dec13-c5-rule-lines (plan dec-13, row C5: the rule lines in the headings' rows; sv-3, rl-1)

On the pull request's preview, or `npm run dev`.

1. In your December campaign (the conversion, classic, the woodland setting), open your character's screen. Beside the **Saves** heading, on the same line on a tablet, you should see the d20 and "Roll d20: your save's number or higher succeeds." The line is not repeated under the save tiles.
2. Beside the **Scores** heading you should see the d20 and "Roll d20: your score or lower succeeds."
3. On a phone (375 px wide), each line may sit under its heading, but always above the tiles, with its die beside its words.
4. Open the **full character sheet**'s own page: Saves and Scores carry the same lines in their headings' rows.
5. In a campaign with only the woodland setting, the Scores heading stands alone, with no line.

For the builders: `layout.html?as=player&p1=1` opens the shared test character (The Storm Lantern Road, Brannoch Fenward), the one every later Player screen row is pictured against.

## Gallery pictures expected to change
None: the gallery draws no Saves or Scores heading with `rolls`. The full sheet's saves line moves from under the tiles to the heading's row wherever a layout page's setting carries `rolls`; the existing layout pages' settings carry none.
