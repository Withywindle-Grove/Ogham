// Tests for the CHANGELOG draft's insert step (scripts/changelog-insert.mjs).
import { describe, expect, it } from 'vitest';
import { insertEntry } from './changelog-insert.mjs';

const changelog = [
  '# Changelog',
  '',
  'What is new, newest first.',
  '',
  '## M4b — every class (October 28, 2026)',
  '',
  '- Older news.',
  '',
].join('\n');

describe('the CHANGELOG draft insert', () => {
  it('puts the new entry above the newest milestone, keeping the intro and the older entries', () => {
    const out = insertEntry(changelog, '## M5 — expeditions (November 1, 2026)\n\n- New news.\n');
    expect(out.indexOf('What is new')).toBeLessThan(out.indexOf('## M5'));
    expect(out.indexOf('## M5')).toBeLessThan(out.indexOf('## M4b'));
    expect(out).toContain('- New news.\n\n## M4b');
    expect(out).toContain('- Older news.');
  });

  it('adds the entry at the end when the changelog has no entries yet', () => {
    expect(insertEntry('# Changelog\n', '## M1 — first (Oct 1)\n- One.')).toBe('# Changelog\n\n## M1 — first (Oct 1)\n- One.\n');
  });

  it('refuses a draft that does not start with a milestone heading', () => {
    expect(() => insertEntry(changelog, 'Here is your entry:\n## M5')).toThrow(/must start with a "## " heading/);
  });
});
