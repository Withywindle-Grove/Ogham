# src/ — UI and code

Loads when you work in `src/`. The root `CLAUDE.md` rules still apply.

- Build screens from the components inventory in `docs/06` (Components). Build a component once and change it in one place: a screen combines listed parts and never rebuilds one, and a variant gets a name in the inventory rather than a copy. Keep the inventory's Code column current in the same PR as the change.
- Use only the tokens in `docs/06` for spacing, type and colour. Body text is 16 px and nothing is under 14. Tap targets are at least 44 px with 8 px between them. Each screen has one accent button. Colour carries a distinction by itself only where the approved mockup does (relaxed 2026-11-12 from "never colour alone"); elsewhere pair it with text or a shape. Support light and dark.
- Never add a disabled button: a blocked action stays tappable and explains why in a pop-up. Undo over confirm: reversible actions happen at once with an Undo toast; dialogs only for irreversible or high-cost actions.
- Words follow the words and voice guide in `docs/06`.
- Before showing any UI change, run the `uiux` self-review: Nielsen's 10 heuristics; every state (empty, loading, partial, overflow, error, offline); contrast; 44 px targets; a 375 px width; and messy data (long names, 0, 999).
- Every UI change keeps the gallery screenshots and key-journey tests passing. Commit CI's new baselines only for picture changes the pull request announced; an unannounced one waits for Design (`docs/testing.md`, The component gallery).
- For a new command: register it in its module and add allowed and not-allowed cases to `src/testing/permissionCases.ts`. If it's logged, add its row to `public.logged_commands` in a new migration (`supabase/tests/m3-health.test.ts` checks they match). Then `npm run docs:gen` refreshes `docs/generated/commands.md`.
