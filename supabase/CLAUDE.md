# supabase/ — database

Loads when you work in `supabase/`. The root `CLAUDE.md` rules still apply.

- Every migration goes to the test project first, in this order: `npm run db:push:test` → `npm run test:db` → backup (`npm run db:backup`, or confirm a recent one) → `npm run db:push` → `npm run db:types`.- Never edit an applied migration (anything in `migrations/` that's on `main`, or applied to either project); fix forward with a new one. A Claude Code hook blocks edits to migrations already on `main`.
- A migration that drops, renames or deletes data needs Francis's explicit OK first, with what it removes said in plain words.
- Hidden data is enforced here, with row-level security: other players' purses, monster HP and GM notes never reach a client that can't see them. After any change to policies, regenerate `docs/generated/visibility-matrix.md` with `npm run docs:gen` (`npm test` fails until you do).
- Never put a secret key (`sb_secret_…`) in code, docs or chat. `docs/testing.md` ("Which keys live where") says where the keys live.
- Security advisor: `npx supabase db advisors --linked`.
- Database commands: `npm run test:db` (test project only), `npm run db:push:test`, `npm run db:push`, `npm run db:types`, `npm run db:backup` (see `docs/testing.md`).
- A migration that redefines `private.undo_body`, `private.log_change`, `public.import_pack` or `public.undo_request` starts from that function's newest definition and carries `-- builds on: <function> from <previous migration file>` for each; `npm run check` fails without it (rvw-7, `docs/testing.md`).
