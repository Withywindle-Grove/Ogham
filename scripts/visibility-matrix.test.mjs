// Tests for the generated visibility matrix (scripts/visibility-matrix.mjs). Table names here are invented.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildVisibilityMatrix, replayPolicies, visibilityMarkdown } from './visibility-matrix.mjs';

const FILE = 'docs/generated/visibility-matrix.md';

describe('the visibility matrix', () => {
  it('lists each rule under the actions it allows, and "all" under every action', () => {
    const page = visibilityMarkdown(
      replayPolicies([
        `alter table public.lanterns enable row level security;
         create policy "lanterns: members read" on public.lanterns for select to authenticated using (true);
         create policy "lanterns: GM does anything" on public.lanterns for all to authenticated using (true);`,
      ]),
    );
    expect(page).toContain('| `lanterns` | GM does anything; members read | GM does anything | GM does anything | GM does anything |');
  });

  it('replays later migrations: a dropped rule goes, a renamed rule takes its new name', () => {
    const page = visibilityMarkdown(
      replayPolicies([
        `create policy "oars: everyone reads" on public.oars for select using (true);
         create policy "oars: owner edits" on public.oars for update using (true);`,
        `drop policy if exists "oars: everyone reads" on public.oars;
         alter policy "oars: owner edits" on public.oars rename to "oars: owner changes";`,
      ]),
    );
    expect(page).toContain('| `oars` | — | — | owner changes | — |');
  });

  it('shows a locked table (row-level security on, no rules) with a dash in every column, and ignores comments', () => {
    const page = visibilityMarkdown(
      replayPolicies([`alter table public.vaults enable row level security; -- create policy "vaults: x" on public.vaults;`]),
    );
    expect(page).toContain('| `vaults` | — | — | — | — |');
  });

  // The M5b gate (plan m5b-5, "No hidden state reaches a player client in the trek"): the tables the 3-day trek
  // writes keep players to their own group's rows, keep the GM's secrets (Lost while it's secret, waiting
  // encounters, unrevealed checks, unshown pieces) from players, and let nobody write them but through the
  // database's own functions. A rule loosened by a later migration fails here.
  it("keeps the trek's tables as the M5b gate passed them", () => {
    const page = buildVisibilityMatrix();
    for (const row of [
      '| `activity_runs` | the GM, and players for their own group | — | — | — |',
      "| `camp_entries` | the GM, and players for their own group | — | undone by the GM or the group's players | — |",
      "| `camps` | the GM, and players for their own group | — | undone by the GM or the group's players | — |",
      '| `group_lost` | the GM, and players for their own group while Getting lost is Open | the GM marks it | the GM resolves it | — |',
      '| `travel_groups` | the GM, and players for their own group | the GM starts the day | the GM moves the group | — |',
      '| `waiting_encounters` | the GM reads | the GM queues one | the GM starts or dismisses one | — |',
      '| `weather_rolls` | members read | a member enters one | the GM changes one, the entrant undoes it | — |',
      '| `check_results` | the GM reads, members once revealed | the GM records one | the GM changes one | — |',
      '| `place_pieces` | the GM reads | the GM keeps them | the GM keeps them, again | — |',
      '| `piece_shows` | the GM reads | the GM keeps them | the GM keeps them, again | — |',
    ]) {
      expect(page).toContain(row);
    }
  });

  it('is up to date with the migrations (run npm run docs:gen if this fails)', () => {
    const page = buildVisibilityMatrix();
    if (process.env.DOCS_GEN === '1') {
      mkdirSync('docs/generated', { recursive: true });
      writeFileSync(FILE, page);
    }
    const committed = existsSync(FILE) ? readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n') : '';
    expect(committed, `${FILE} is out of date: run npm run docs:gen and commit the result.`).toBe(page);
  });
});
