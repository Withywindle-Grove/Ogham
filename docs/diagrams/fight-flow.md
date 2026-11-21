# Fight flow

From exploring to an encounter, a fight and back (M6, ruled 2026-10-26; revised after the fight dry run, 2026-10-29). Spec: `docs/05-features.md`, "Explore, Encounter and Fight" and "Combat tracker (GM)"; screens: `docs/06-screens-and-design.md`, "Fight layouts". The app never rolls or decides an outcome: dice stay at the table.

```mermaid
flowchart TD
  explore[Explore mode] --> check{Encounter check}
  check -- miss --> explore
  check -- hit --> table[Encounter table: the GM taps a row]
  explore -- keyed room or story --> start[Start encounter]
  table --> enc[Encounter panel: the pack's order]
  start --> enc
  enc --> surprise[Surprise: on/off per side]
  surprise --> distance[Distance: a reminder line]
  distance --> reaction["Reaction: the pack's table (an attitude, not a limit)"]
  reaction --> ending{"Fight, Talk or Avoid?"}
  ending -- Talk --> logged[Logged, time passes, Undo]
  ending -- Avoid --> evade{"Evasion rule: Got away?"}
  evade -- yes --> logged
  evade -- Caught --> fight
  ending -- Fight --> fight[Fight layout]
  logged --> explore
  fight --> round["Round N: initiative as the setting says (every round or once per fight)"]
  round --> turns["Turns end by tap: End our turn / End foes' turn (or End turn each); Delay"]
  turns --> nudges[GM sees foe nudges and ▲ lines]
  nudges --> damage["Damage pad: players for their own characters, the GM for foes<br>(a player's target tap pre-selects the foe)"]
  damage --> down{Foe at 0 or a character at the threshold?}
  down -- foe --> marks["Down, Dead, Fled or Surrendered"]
  down -- character --> death["Marked Down quietly; tap for the death panel"]
  down -- no --> morale
  marks --> morale{"Morale trigger (from the pack only)?"}
  death --> morale
  morale -- yes --> moralecheck["Check: They hold or They break"]
  morale -- no --> next
  moralecheck --> next{"All turns done, or end?"}
  next -- "round advances by itself (GM: Next round)" --> round
  next -- "We run (any player or the GM)" --> escape["Escape: the pack's pursuit rule; Undo returns to the fight"]
  escape -- Caught --> round
  escape -- Got away --> explore
  next -- End fight --> summary["Summary: foes by outcome, XP waiting, loot"]
  summary --> loot[Players: Loot to share strip]
  loot --> explore
```

Hidden means hidden throughout: foe HP, morale scores, GM-only foe notes and GM-only results never reach players' devices. The one exception: a Down or dead character's pack and purse open to the other players.
