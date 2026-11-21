# dec-pf16: a trait list rolled more than once

Ruled by Francis ("A", 2026-11-13, via the lead): pack format ruling pf-16. Size about half a turn; no migration.
Mockup: none. The step reuses the trait-list step's approved parts (the fold's count line, the foot hint, the pop-up);
a list without `rolls` looks exactly as today.

## What

- A trait list may carry `rolls: N` (how many times a character rolls or picks on it at creation; absent or anything
  but a whole number of 1 or more = 1) and `distinct: true` (no result twice).
- The trait-list step asks for N picks: the fold's line reads "1 of 2 picked", the foot "1 of 2 picked. Pick 1 more,
  or Decide later", Next says "Pick 1 more, or Decide later." until N are picked, a tap past N says "2 of 2 picked:
  unpick one first." With `distinct`, a second take of a picked entry says "Already yours: roll again." ("Already
  yours: pick another." on a list without a die; the lead's wording, 2026-11-13). Without it, the same entry may be taken twice: its row reads
  "×2" after its name.
- The field keeps the N picks joined by "; " (each as a single pick is kept today: the entry's id, its name, or
  "Name — note"). A saved single pick still reads as one.
- Decide later with some picked keeps them and puts the step on To finish; the review lists every pick.
- `pack:check` names a `rolls` that isn't a whole number of 1 or more (`distinct` was already checked, of-7).
- 07: one line under `traitLists`.

## Tests (purpose first)

- N = 2 asks for two; Next waits (unit and on the creation shell).
- `distinct` refuses a repeat; without it a repeat is allowed (row "×2").
- Decide later with one of two picked keeps it and lists the step to finish.
- The review lists both picks.
- An old saved single pick still reads as one.
- A semicolon in a typed Other… on a list rolled more than once is refused.
- `pack:check` accepts 2 and names 0 and "two".

## Departures

- **Storage: text joined by "; ", not a list-valued field.** A field's value is `number | string | boolean` everywhere
  (the edit command, the form inputs, the sheet); a list value would have touched all of them. Joined text changes no
  type and reads old values unchanged. Guarded (the lead, 2026-11-13): on a list rolled more than once, a typed
  Other… whose name or note holds a semicolon is refused ("A name or note can't contain a semicolon here."), so it can
  never split into two picks. Refusing was smaller than escaping on save and unescaping on read.
- **Gear and coins of all N picks** are granted together (the picked entries' `items` and `money` summed), and every
  pick's powers join the sheet. The ruling did not say; leaving them out would have dropped real gear.
- **A spell roll** (`entries[].spells.roll`) opens under the first picked entry that has one; a second picked entry
  with a spell roll gets none. No known pack has that yet.
- **Unpicking on a `distinct` list** before it is full is through the entry's pop-up (Unpick), since the ✓ on a picked
  row is the refused repeat.
- **The twice-picked mark replaces "×2"** (the lead's ruling of 2026-11-13, acting as Design; branch
  `dec-pf16-twice-picked-mark`): an entry taken twice keeps its bare name and its Pick button reads "Picked ✓✓", the
  shape of Weapon skills' "Specialised ✓✓", heard as "Pick <name>, picked twice" (a small `pickedSpoken` prop on
  `PickButton` and `PickRow`, one part). No count in words on the row; the review and the sheet still list every pick.
  Approval of the look: pictures of the built row (`docs/design/pictures-for-approval/twice-picked-as-built/`), Francis.
- **One tick for each take, and the pop-up the same** (the lead's rulings of 2026-11-13, on this branch's two ⚑): an
  entry taken three times reads "Picked ✓✓✓", heard as "picked 3 times"; no cap, and the ticks never turn into a
  number. When the button no longer fits beside the name it drops under it, at the right (`pick-row--takes`, wrapping
  once the name would be narrower than its usual room). The entry's pop-up button says exactly what its row's button
  says ("Picked ✓✓", the same spoken words): one state, one mark, wherever the button is drawn.
- **The foot line names each entry once** (the lead's ruling of 2026-11-13, on this branch's third ⚑): beside Decide
  later, "Heron at dawn over the drowned causeway ✓✓, Frog in frost picked"; an entry taken once has no tick, as
  before. Read aloud, the ticks are skipped and the count said ("…, picked twice, Frog in frost picked"; "picked" not
  said twice when the last entry carries the count). The review and the sheet keep one line per pick. The creation
  shell's `hint` now takes a node rather than only text.
- **From the local review of #671:** the entry's pop-up is heard "Pick <name>, picked" at one take too, so its spoken
  form is the same at every count (the row at one take stays "Pick <name>", checked); the button and the foot line
  share one `takesTicks`. The gallery's specimen shows the mixed case (Heron twice, Frog once). As-built pictures approved
  by Francis on 2026-11-13, as shown, no fixes (tp-1 to tp-5, `design/rulings/dec-night-and-morning-2026-11-13.md`).
- **From the second local review:** the pop-up's spoken form applies to every trait list's entry, not only to a list
  rolled more than once (`panelMark`); docs/06 says so. Nothing visible changes.
- **The semicolon words** (approved 2026-11-13): "A name or note can't hold a semicolon on this list. Use a comma
  instead." replaces "A name or note can't contain a semicolon here."
