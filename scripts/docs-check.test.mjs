// Tests for the docs drift check (scripts/docs-check.mjs), on invented snippets, plus a sanity check that it
// really finds the repo's links, pictures and inventory files (so a broken parser can't pass silently).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gapRowProblems, inventoryCodeFiles, mockupRows, relativeLinks, rulingHeaderProblems } from './docs-check.mjs';

describe('the docs check', () => {
  it('finds relative links and skips web links, anchors and code', () => {
    const md = 'See [a](../a.md#part), [web](https://x.y), [top](#top), ![pic](m6/p.png) and `[not](b.md)`.';
    expect(relativeLinks(md)).toEqual(['../a.md', 'm6/p.png']);
  });

  it('accepts a valid ruling header and names what is wrong with a bad one', () => {
    const good = '---\nstatus: absorbed\nmilestone: m6\nabsorbed-into: docs/05 (Fights)\nsupersedes: —\n---\n\n# Rulings';
    expect(rulingHeaderProblems(good)).toEqual([]);
    expect(rulingHeaderProblems('# No header')).toHaveLength(1);
    const bad = '---\nstatus: done\nmilestone: m6\nabsorbed-into: —\nsupersedes: —\n---\n';
    expect(rulingHeaderProblems(bad)[0]).toMatch(/status "done"/);
    const absorbedNowhere = '---\nstatus: absorbed\nmilestone: m6\nabsorbed-into: —\nsupersedes: —\n---\n';
    expect(rulingHeaderProblems(absorbedNowhere)[0]).toMatch(/doesn't say where/);
  });

  it('checks each gap row has a known kind and status', () => {
    const md = '| ID | M | Kind | Seen | Today | Release | Status |\n|---|---|---|---|---|---|---|\n| G-01 | Chase | 🔴 | x | y | R2 | ruled (09) |\n| G-02 | Parts | ? | x | y | R2 | maybe |';
    expect(gapRowProblems(md)).toEqual([
      'G-02: the kind "?" isn\'t one of 🟡 🔴',
      'G-02: the status "maybe" isn\'t one of open, verify, ruled, done, wontfix',
    ]);
  });

  it('reads the inventory Code column, including bare file names', () => {
    const md = '| Part | Job | Code |\n|---|---|---|\n| Stat | x | `StatTile` (`parts.tsx`) |\n| Top row | y | `TopRow` (`src/app/TopRow.tsx`) |';
    expect(inventoryCodeFiles(md)).toEqual(['parts.tsx', 'src/app/TopRow.tsx']);
  });

  it('really finds what it checks in this repo', () => {
    expect(mockupRows(readFileSync('docs/design/mockups/index.md', 'utf8')).length).toBeGreaterThan(10);
    expect(inventoryCodeFiles(readFileSync('docs/06-screens-and-design.md', 'utf8')).length).toBeGreaterThan(10);
    expect(relativeLinks(readFileSync('docs/02-architecture.md', 'utf8')).length).toBeGreaterThan(0);
  });
});
