// npm run pack:check on a rules set's `rolls` (pf-20). Invented packs: the Reed rules with "Save vs river".
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rollsCheck } from './pack-rolls.mjs';
import { formatNotes } from './pack-format.mjs';

/** An invented pack with one rules set, its saves and its rolls as given. */
const pack = (rules) => ({
  format: 'tabletop-pack',
  formatVersion: 2,
  meta: { id: 'reed-rules-pack', name: 'Reed rules', kind: 'setting' },
  rulesSets: [{ id: 'reed-rules', name: 'Reed rules', saveCategories: [{ key: 'river', name: 'Save vs river' }], ...rules }],
});

/** Runs npm run pack:check on a pack; its output and exit code; the file removed. */
const run = (file) => {
  const dir = mkdtempSync(join(tmpdir(), 'pack-rolls-'));
  const path = join(dir, 'rolls.pack.json');
  writeFileSync(path, JSON.stringify(file));
  const out = spawnSync('node', ['scripts/check-pack.mjs', path], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  return { out: out.stdout, code: out.status };
};

describe('pack:check on rolls (pf-20)', () => {
  // Purpose: a rules set with saves and well-written rolls passes with nothing said.
  it('says nothing about well-written rolls', () => {
    expect(rollsCheck(pack({ rolls: { save: { die: 'd20', pass: 'atOrOver' }, abilityCheck: { die: 'd20', pass: 'atOrUnder' } } }))).toEqual({ errors: [], notes: [] });
  });

  // Purpose: a die the app can't draw is refused, naming the rules set and the roll type.
  it('refuses an unknown die, naming where', () => {
    expect(rollsCheck(pack({ rolls: { save: { die: 'd7', pass: 'atOrOver' } } })).errors).toEqual([
      'rulesSets: "reed-rules": rolls.save: die "d7" isn\'t a die the app can draw (d4, d6, d8, d10, d12, d20, d100).',
    ]);
  });

  // Purpose: a pass that is neither value is refused, naming the rules set and the roll type.
  it('refuses an unknown pass, naming where', () => {
    expect(rollsCheck(pack({ rolls: { abilityCheck: { die: 'd20', pass: 'under' } }, saveCategories: undefined })).errors).toEqual([
      'rulesSets: "reed-rules": rolls.abilityCheck: pass "under" should be "atOrOver" or "atOrUnder".',
    ]);
  });

  // Purpose: rolls that isn't keyed by roll type, or a roll type's entry that isn't a roll, is refused; a roll type the
  // app doesn't know yet is left alone.
  it('refuses a rolls or an entry that is not a roll; leaves a new roll type alone', () => {
    expect(rollsCheck(pack({ rolls: 'd20' })).errors).toEqual(['rulesSets: "reed-rules": rolls should be keyed by roll type, like { "save": { "die": "d20", "pass": "atOrOver" } }.']);
    expect(rollsCheck(pack({ rolls: { save: 'd20' } })).errors).toEqual(['rulesSets: "reed-rules": rolls.save should be { "die": "d20", "pass": "atOrOver" } (or "atOrUnder").']);
    expect(rollsCheck(pack({ rolls: { save: { die: 'd20', pass: 'atOrOver' }, attack: { die: 'd30', pass: 'sideways' } } })).errors).toEqual([]);
  });

  // Purpose: a rules set with saves and no rolls.save is only noted, never refused; one without saves isn't noted.
  it('notes a rules set with saves and no rolls.save, without refusing', () => {
    const noted = 'rulesSets: "reed-rules" has saves and no rolls.save, so the Saves section shows no line saying what passes (fine if another attached pack\'s rules set carries it).';
    expect(rollsCheck(pack({}))).toEqual({ errors: [], notes: [noted] });
    expect(formatNotes(pack({}))).toContain(noted);
    expect(rollsCheck(pack({ saveCategories: undefined }))).toEqual({ errors: [], notes: [] });
  });

  // Purpose: from the command line, a refusal is an error (exit 1) and the note leaves the exit code at 0.
  it('exits 1 on a refusal and 0 on the note alone', () => {
    const refused = run(pack({ rolls: { save: { die: 'd7', pass: 'atOrOver' } } }));
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('rolls.save: die "d7" isn\'t a die the app can draw');
    const noted = run(pack({}));
    expect(noted.code).toBe(0);
    expect(noted.out).toContain('has saves and no rolls.save');
  });

  // Purpose: a pack without the key reads as before: the existing fixtures say nothing about rolls and exit as they did.
  it('leaves the existing fixtures as they were', () => {
    for (const name of ['g07-format', 'm5b-creation', 'options-gates-4']) {
      const file = JSON.parse(readFileSync(`scripts/fixtures/${name}.fixture.json`, 'utf8'));
      expect(rollsCheck(file)).toEqual({ errors: [], notes: [] });
      const out = spawnSync('node', ['scripts/check-pack.mjs', `scripts/fixtures/${name}.fixture.json`], { encoding: 'utf8' });
      expect(out.status).toBe(0);
      expect(out.stdout).not.toContain('rolls');
    }
  });
});

// The third roll type, `skill` (tfs-2, 2026-11-19; plan test-feedback-2026-11-19 row C13a). An invented rules set: no
// pack carries it yet (E6).
describe('pack:check on rolls.skill (tfs-2)', () => {
  // Purpose: pack:check accepts a well-written rolls.skill beside the others, from the command line too (exit 0, nothing said).
  it('accepts rolls.skill', () => {
    const file = pack({ rolls: { save: { die: 'd20', pass: 'atOrOver' }, skill: { die: 'd6', pass: 'atOrOver' } } });
    expect(rollsCheck(file)).toEqual({ errors: [], notes: [] });
    const out = run(file);
    expect(out.code).toBe(0);
    expect(out.out).not.toContain('rolls.skill');
  });

  // Purpose: rolls.skill is checked as the others are: a die the app can't draw or an unknown pass is refused, naming it.
  it('refuses a rolls.skill it cannot read, naming where', () => {
    expect(rollsCheck(pack({ rolls: { save: { die: 'd20', pass: 'atOrOver' }, skill: { die: 'd7', pass: 'over' } } })).errors).toEqual([
      'rulesSets: "reed-rules": rolls.skill: die "d7" isn\'t a die the app can draw (d4, d6, d8, d10, d12, d20, d100).',
      'rulesSets: "reed-rules": rolls.skill: pass "over" should be "atOrOver" or "atOrUnder".',
    ]);
  });
});
