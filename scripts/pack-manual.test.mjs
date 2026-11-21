// npm run pack:check's list of options run by hand (ex-7, ruled 2026-11-03). Every name is invented.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { manualNotes, manualOptions } from './pack-manual.mjs';

const option = (id, name, extra = {}) => ({ kind: 'option', packEntryId: id, name, data: { choices: [{ id: 'off' }, { id: 'on' }], ...extra } });

describe('options run by hand (ex-7)', () => {
  // Purpose: every option with manual: true is listed by name and id, in the pack's order, and no other.
  it('lists every manual option and no other', () => {
    const entries = [option('reed-winds', 'Reed winds', { manual: true }), option('lantern-oil', 'Lantern oil'), option('mire', 'Mire sickness', { manual: true }), option('off', 'Not by hand', { manual: false })];
    expect(manualOptions(entries)).toEqual(['Reed winds (reed-winds)', 'Mire sickness (mire)']);
  });

  // Purpose: a manual that isn't true or false is noted (the app would treat it as applied); true and false aren't.
  it('notes a manual that is not true or false', () => {
    expect(manualNotes([option('a', 'A', { manual: 'yes' }), option('b', 'B', { manual: true }), option('c', 'C', { manual: false })])).toEqual([
      'options: "a": manual should be true or false; the app reads only true (run by hand), so this one counts as applied.',
    ]);
  });

  // Purpose: the manual check's pack (scripts/fixtures/m5b-area-2-manual.fixture.json) lists its two manual options
  // under "Run by hand", with no format notes and nothing left out.
  it('the checker lists the fixture pack\'s two', () => {
    const out = execFileSync(process.execPath, ['scripts/check-pack.mjs', 'scripts/fixtures/m5b-area-2-manual.fixture.json'], { encoding: 'utf8' });
    expect(out).toContain("Run by hand, the app doesn't apply these yet (2):\n  - Reed winds (fen-reed-winds)\n  - Mire sickness (fen-mire-sickness)");
    expect(out).not.toContain('Format notes');
    expect(out).not.toContain('Left out');
  });
});
