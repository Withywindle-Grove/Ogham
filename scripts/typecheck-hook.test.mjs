// Tests for the typecheck hook (scripts/typecheck-hook.mjs): which edits trigger it, and what it shows.
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { firstLines, touchesSrc } from './typecheck-hook.mjs';

describe('the typecheck hook', () => {
  const project = resolve('/repo');
  const edit = (filePath) => ({ tool_name: 'Edit', tool_input: { file_path: filePath } });

  it('runs only for files under src/, in the repo or a helper worktree', () => {
    expect(touchesSrc(edit(join(project, 'src', 'core', 'a.ts')), project)).toBe(true);
    expect(touchesSrc(edit(join(project, '.claude', 'worktrees', 'agent-1', 'src', 'a.ts')), project)).toBe(true);
    expect(touchesSrc(edit(join(project, 'docs', 'a.md')), project)).toBe(false);
    expect(touchesSrc(edit(join(project, 'scripts', 'src', 'a.mjs')), project)).toBe(false);
    expect(touchesSrc(edit(resolve('/elsewhere/src/a.ts')), project)).toBe(false);
    expect(touchesSrc({}, project)).toBe(false);
  });

  it("keeps the first 20 lines that matter and drops npm's banner", () => {
    const output = ['', '> grimoire@0.0.0 typecheck', '> tsc --noEmit', ...Array.from({ length: 30 }, (_, i) => `error ${i}`)].join('\n');
    const shown = firstLines(output).split('\n');
    expect(shown).toHaveLength(20);
    expect(shown[0]).toBe('error 0');
  });
});
