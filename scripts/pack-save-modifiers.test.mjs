// pack:check on a save modifier read from a kindred's field alone (pf-21, docs/design/rulings/dec-player-screen-2026-11-14.md).
// Invented names and figures.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatNotes } from './pack-format.mjs';
import { saveModifierNotes } from './pack-save-modifiers.mjs';

const rules = (value) => ({ id: 'fen-rules', name: 'Fen rules', saveModifiers: [{ id: 'vs-hexes', name: 'vs hexes', value }] });
const marshBorn = { id: 'marsh-born', name: 'Marsh-born', hexWard: 2 };

describe('a save modifier from a kindred’s field (pf-21)', () => {
  // Purpose: pack:check accepts { raceField } when a kindred carries the field: no note at all about it.
  it('accepts the shape', () => {
    const file = { rulesSets: [rules({ raceField: 'hexWard' })], races: [marshBorn] };
    expect(saveModifierNotes([file])).toEqual([]);
    expect(formatNotes(file).filter((n) => n.includes('saveModifiers') || n.includes('raceField'))).toEqual([]);
  });

  // Purpose: pack:check notes a raceField that no kindred in the pack carries.
  it('notes a field no kindred carries', () => {
    const file = { rulesSets: [rules({ raceField: 'hexWrad' })], races: [marshBorn] };
    expect(saveModifierNotes([file])).toEqual(['rulesSets: "fen-rules": saveModifiers "vs-hexes": value.raceField "hexWrad" is a field no kindred in this pack carries with a whole number other than nought, so it shows for no one.']);
    expect(formatNotes(file)).toContain(saveModifierNotes([file])[0]);
  });

  // Purpose: a raceField that isn't a field name is noted.
  it('notes a raceField that isn’t a name', () => {
    expect(saveModifierNotes([{ rulesSets: [rules({ raceField: 3 })], races: [marshBorn] }])).toEqual(['rulesSets: "fen-rules": saveModifiers "vs-hexes": value.raceField should name a kindred\'s field, like "hexWard" (pf-21).']);
  });

  // Purpose: a pack with no kindreds of its own (an overlay) is silent alone; checked together, the stack's kindreds count.
  it('waits for the stack when the pack has no kindreds, then checks across it', () => {
    const overlay = { rulesSets: [rules({ raceField: 'hexWard' })] };
    expect(saveModifierNotes([overlay])).toEqual([]);
    expect(saveModifierNotes([overlay, { races: [marshBorn] }], true)).toEqual([]);
    expect(saveModifierNotes([overlay, { races: [{ id: 'bog-folk', name: 'Bog folk' }] }], true)).toEqual(['rulesSets: "fen-rules": saveModifiers "vs-hexes": value.raceField "hexWard" is a field no kindred in these packs carries with a whole number other than nought, so it shows for no one.']);
  });

  // Purpose: a field every kindred holds only as nought or words shows for no one, so it is noted too (VB1 nit 3).
  it('notes a field held only as nought or words', () => {
    const file = { rulesSets: [rules({ raceField: 'hexWard' })], races: [{ ...marshBorn, hexWard: 0 }, { id: 'bog-folk', name: 'Bog folk', hexWard: 'some' }] };
    expect(saveModifierNotes([file])).toEqual(['rulesSets: "fen-rules": saveModifiers "vs-hexes": value.raceField "hexWard" is a field no kindred in this pack carries with a whole number other than nought, so it shows for no one.']);
  });

  // Purpose: a raceField beside fill or from is noted, since the app reads only one shape (VB1 nit 2).
  it('notes a raceField beside fill or from', () => {
    const notesOf = (value) => saveModifierNotes([{ rulesSets: [rules(value)], races: [marshBorn] }]);
    expect(notesOf({ raceField: 'hexWard', from: 'LORE' })).toEqual(['rulesSets: "fen-rules": saveModifiers "vs-hexes": value has raceField beside from; the app reads only raceField. Keep one shape (pf-21).']);
    expect(notesOf({ raceField: 'hexWard', fill: 'abilityModifiers.LORE.saveBonus' })).toEqual(['rulesSets: "fen-rules": saveModifiers "vs-hexes": value has raceField beside fill; the app reads only fill. Keep one shape (pf-21).']);
  });

  // Purpose: the two older shapes give no new note.
  it('says nothing new of the older shapes', () => {
    expect(saveModifierNotes([{ rulesSets: [{ id: 'r', saveModifiers: [{ id: 'a', value: { fill: 'x' } }, { id: 'b', value: { from: 'LORE', plusRaceField: 'nowhere' } }] }], races: [marshBorn] }])).toEqual([]);
  });

  // Purpose: a kindred's magicResistance read through a raceField counts as named, so its "none names it" note isn't given.
  it('counts a raceField as naming magicResistance', () => {
    const file = { rulesSets: [rules({ raceField: 'magicResistance' })], races: [{ id: 'marsh-born', name: 'Marsh-born', magicResistance: 2 }] };
    expect(formatNotes(file).filter((n) => n.includes('magicResistance'))).toEqual([]);
  });
});

describe('the command, checking an overlay with its base', () => {
  // Purpose: checked together, a field the base's kindred carries gives no line at all, and one no kindred carries is
  // said once, under "Library notes".
  it('says a missing field once, under Library notes, and nothing for a carried one', () => {
    const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'g07-format.fixture.json'), 'utf8'));
    const pack = (name, extra) => ({ format: fixture.format, formatVersion: fixture.formatVersion, meta: { ...fixture.meta, name }, ...extra });
    const dir = mkdtempSync(join(tmpdir(), 'pf21-'));
    const write = (name, file) => {
      const path = join(dir, name);
      writeFileSync(path, JSON.stringify(file));
      return path;
    };
    const base = write('fen.pack.json', pack('Fen rules', { races: [marshBorn] }));
    const run = (field) => {
      const overlay = write('mire.pack.json', pack('Mire zine', { rulesSets: [rules({ raceField: field })] }));
      return spawnSync(process.execPath, [join(import.meta.dirname, 'check-pack.mjs'), base, overlay], { encoding: 'utf8' }).stdout;
    };
    try {
      expect(run('hexWard')).not.toContain('raceField');
      const out = run('hexWrad');
      expect(out.split('value.raceField "hexWrad"').length - 1).toBe(1);
      expect(out.slice(out.indexOf('Library notes'))).toContain('value.raceField "hexWrad" is a field no kindred in these packs carries');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);
});
