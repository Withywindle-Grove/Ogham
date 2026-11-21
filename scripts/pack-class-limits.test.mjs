// npm run pack:check on class limits (cs-3, cs-5, ruled 2026-11-03): the three old places (a class's kindreds, a
// race's forbiddenClasses, a rules set's creationRestrictions) are warnings, since the app reads only the race's
// classMaxLevels. A race byOption may change any field (bq2-1). The ruled shapes pass. Warnings, exit 0. Invented names.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const check = (pack) => {
  const file = join(mkdtempSync(join(tmpdir(), 'pack-limits-')), 'limits.pack.json');
  writeFileSync(file, JSON.stringify(pack));
  return execFileSync('node', ['scripts/check-pack.mjs', file], { encoding: 'utf8' });
};
const pack = (extra) => ({
  format: 'tabletop-pack',
  formatVersion: 2,
  meta: { id: 'fixture-kin-limits', name: 'Invented kin limits', version: '0.1', kind: 'setting' },
  options: [{ id: 'kin-limits', name: 'Kin limits', default: 'kept', choices: [{ id: 'kept', name: 'Kept' }, { id: 'lifted', name: 'Lifted' }] }],
  ...extra,
});

describe('pack:check and class limits', () => {
  it('warns on the three old places, and still exits 0', () => {
    const out = check(
      pack({
        rulesSets: [{ id: 'kin-rules', name: 'Kin rules', creationRestrictions: { note: 'Only marshfolk ring bells.' } }],
        races: [{ id: 'marshfolk', name: 'Marshfolk', classMaxLevels: { 'bell-ringer': 6 }, forbiddenClasses: ['ash-tender'] }],
        classes: [{ id: 'bell-ringer', name: 'Bell Ringer', kindreds: ['marshfolk'] }],
      }),
    );
    expect(out).toMatch(/races: "marshfolk": forbiddenClasses isn't read/);
    expect(out).toMatch(/classes: "bell-ringer": kindreds isn't read/);
    expect(out).toMatch(/rulesSets: "kin-rules": creationRestrictions isn't read/);
  });

  it('passes a soft entry, a class’s alignments and a race byOption on the read fields; names a field it doesn’t read', () => {
    const out = check(
      pack({
        races: [
          {
            id: 'marshfolk',
            name: 'Marshfolk',
            classMaxLevels: { 'bell-ringer': { maxLevel: 6, soft: true } },
            byOption: { 'kin-limits=lifted': { classMaxLevels: {}, hitDie: 'd4' } },
          },
        ],
        classes: [{ id: 'bell-ringer', name: 'Bell Ringer', alignments: { ids: ['Reed'], soft: true } }],
      }),
    );
    expect(out).not.toMatch(/classMaxLevels gives "bell-ringer"/);
    expect(out).not.toMatch(/alignments should be/);
    // Any race field may change under a choice (bq2-1): no note for hitDie.
    expect(out).not.toMatch(/byOption "kin-limits=lifted" changes hitDie/);
  });
});
