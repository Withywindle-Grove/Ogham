# Manual checks: dec-6-k28-log-lines

None needed beyond the tests: no screen changes (logic and words only). Once the Pack tab's Take button exists (a later row), as a player:

1. Take a single thing from the party stash. **You should see** the toast "<your character> took <thing>. Load N of M coins’ weight." with Undo (K12 took PK4b's words for the toast), and in the log "<your character> took <thing> from the party stash."
2. Take two of a stack whose item names its pieces (an invented "torch"/"torches"). **You should see** "<character> took 2 torches. Load …" and the log line "<character> took 2 torches from the party stash."
3. Tap Undo. **You should see** the thing back in the party stash, its count whole again.

A find's lines wait for its command (K16b).
