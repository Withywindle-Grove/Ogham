# Command flow

How every change reaches the database and the log (hard rules: everything through commands, everything logged, hidden means hidden). Spec: `docs/02-architecture.md`; the command list: `docs/generated/commands.md`.

```mermaid
flowchart TD
  tap[Someone taps a button] --> run["runCommand(registry, command, input)"]
  run --> can{"can(user, command, target)?<br>the app's copy of the rule"}
  can -- no --> why[Pop-up says why; nothing changes]
  can -- yes --> retired{Campaign retired?}
  retired -- yes --> why
  retired -- no --> write[The command writes through Supabase]
  write --> rls{"Row-level security<br>(the real check)"}
  rls -- refused --> why
  rls -- allowed --> change[Row changes]
  change --> trigger["Database trigger writes the event<br>in the same transaction"]
  trigger --> named["Named from public.logged_commands<br>with its level: simple or verbose"]
  named --> audience["Event audience: everyone, the GM,<br>or the owner and the GM"]
  audience --> realtime[Realtime sends it to each screen that may see it]
  realtime --> log[Log and screens update]
  log --> undo{Undo from the toast or the log?}
  undo -- yes --> reverse["A reversing event<br>(nothing is erased)"]
  reverse --> trigger
```

Tests on the same path: `npm test` checks `can()` against every permission case; `npm run test:db` runs the same cases against the test project and checks the events written.
