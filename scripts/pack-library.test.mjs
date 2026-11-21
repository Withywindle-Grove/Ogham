// The library check of npm run pack:check (scripts/pack-library.mjs; M5b step 0d.5, ruling
// design/rulings/m5b-0d-library-and-campaign-rules-2026-11-02.md, "Pack checker"): two packs that carry a
// same-named option, one of them without a ruleKey, get a warning. Every name is invented.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { itemClashNotes, sameNameOptionNotes, sameNamePairLines } from './pack-library.mjs';

const option = (name, ruleKey) => ({ kind: 'option', name, data: ruleKey ? { name, ruleKey } : { name } });
const pack = (name, ...entries) => ({ name, entries });
const fixture = (which) => `scripts/fixtures/m5b-0d-${which}.fixture.json`;

describe('same-named options across packs without a ruleKey', () => {
  it('two packs with a same-named option and no ruleKey get one note naming the option and both packs', () => {
    const notes = sameNameOptionNotes([pack('Fen rules', option('Lantern reckoning')), pack('Mire overlay', option('Lantern reckoning'))]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/"Lantern reckoning" is in "Fen rules" and "Mire overlay", with no ruleKey in "Fen rules" and "Mire overlay"/);
  });

  it('the same pair with one shared ruleKey gets no note: they already form one choice', () => {
    expect(sameNameOptionNotes([pack('Fen rules', option('Lantern reckoning', 'lamp-oil')), pack('Mire overlay', option('Lantern reckoning', 'lamp-oil'))])).toEqual([]);
  });

  it('when only one of the pair has a ruleKey, the note names the pack without one', () => {
    const notes = sameNameOptionNotes([pack('Fen rules', option('Lantern reckoning', 'lamp-oil')), pack('Mire overlay', option('Lantern reckoning'))]);
    expect(notes).toEqual([expect.stringMatching(/with no ruleKey in "Mire overlay":/)]);
  });

  it('names that differ only in capitals or spaces count as the same name', () => {
    expect(sameNameOptionNotes([pack('Fen rules', option('Lantern reckoning')), pack('Mire overlay', option('  lantern  Reckoning '))])).toHaveLength(1);
  });

  it('a name used twice inside one pack, different names, and entries that are not options give no note', () => {
    const notes = sameNameOptionNotes([
      pack('Fen rules', option('Reed boats'), option('Reed boats')),
      pack('Mire overlay', option('Mire boats'), { kind: 'item', name: 'Reed boats', data: {} }),
    ]);
    expect(notes).toEqual([]);
  });

  it('the invented fixture packs: the clash pair is the same name without keys, the keyed pair the same name with one key', () => {
    const read = (which) => JSON.parse(readFileSync(fixture(which), 'utf8')).options.find((o) => o.name === 'Lantern reckoning');
    expect([read('clash-a').ruleKey, read('clash-b').ruleKey]).toEqual([undefined, undefined]);
    expect([read('keyed-a').ruleKey, read('keyed-b').ruleKey]).toEqual(['lamp-oil', 'lamp-oil']);
  });

  it('npm run pack:check on the clash pair prints the library note, and still exits 0 (a warning, not a refusal)', () => {
    const out = execFileSync('node', ['scripts/check-pack.mjs', fixture('clash-a'), fixture('clash-b')], { encoding: 'utf8' });
    expect(out).toMatch(/=== The 2 packs together/);
    expect(out).toMatch(/Library notes \(1\):\n {2}- option "Lantern reckoning"/);
    expect(out).not.toMatch(/Reed boats/);
  });

  it('npm run pack:check on the keyed pair says no library notes', () => {
    const out = execFileSync('node', ['scripts/check-pack.mjs', fixture('keyed-a'), fixture('keyed-b')], { encoding: 'utf8' });
    expect(out).toMatch(/No library notes\./);
  });

  it('npm run pack:check on one file prints no library section, as before', () => {
    const out = execFileSync('node', ['scripts/check-pack.mjs', fixture('clash-a')], { encoding: 'utf8' });
    expect(out).not.toMatch(/===|Library notes|No library notes/);
  });
});

describe('the same item id across packs', () => {
  // Purpose: an overlay that requires the other pack carries the id on purpose (it replaces the base's entry), so no note.
  it("an overlay that requires the base pack and repeats an item id gets no note: that's how it replaces the entry", () => {
    const base = { ...pack('Fen rules', { kind: 'item', packEntryId: 'marsh-pearl', name: 'Marsh pearl' }), id: 'fen-rules' };
    const overlay = { ...pack('Mire overlay', { kind: 'item', packEntryId: 'marsh-pearl', name: 'Marsh pearl, polished' }), id: 'mire-overlay', requires: ['fen-rules'] };
    expect(itemClashNotes([base, overlay])).toEqual([]);
  });

  const gear = (id, name = 'Marsh pearl', kind = 'item') => ({ kind, packEntryId: id, name, data: {} });

  // Purpose: a shared item id gives one note that names both packs.
  it('gives one note for a shared id, naming both packs', () => {
    const notes = itemClashNotes([pack('Fen rules', gear('marsh-pearl')), pack('Fen gear extras', gear('marsh-pearl'))]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/"Marsh pearl" \(marsh-pearl\) is in "Fen rules" and "Fen gear extras"/);
  });

  // Purpose: different ids give no note.
  it('gives no note when the ids differ', () => {
    expect(itemClashNotes([pack('Fen rules', gear('marsh-pearl')), pack('Fen gear extras', gear('reed-lantern', 'Reed lantern'))])).toEqual([]);
  });

  // Purpose: only items clash; a shared id of another kind is no note.
  it('gives no note for a shared id that is not an item', () => {
    expect(itemClashNotes([pack('Fen rules', gear('lantern', 'Lantern', 'class')), pack('Mire overlay', gear('lantern', 'Lantern', 'class'))])).toEqual([]);
  });

  // Purpose: the checker run on two fixture packs prints the clash in its library notes.
  it('npm run pack:check on the two area 3 fixtures prints the marsh-pearl clash', () => {
    const out = execFileSync('node', ['scripts/check-pack.mjs', 'scripts/fixtures/m5b-review-area-3.fixture.json', 'scripts/fixtures/m5b-review-area-3-clash.fixture.json'], { encoding: 'utf8' });
    expect(out).toMatch(/item "Marsh pearl" \(marsh-pearl\) is in "Invented fen gear \(review area 3\)" and "Fen gear extras"/);
  });
});

describe('same-named entries of every kind, for information (sn-1, plan dec-1-creation 1d)', () => {
  const e = (kind, packEntryId, name) => ({ kind, packEntryId, name, data: {} });

  // Purpose: a same-named class and race with different ids in two packs each get one line naming both packs and ids.
  it('lists a same-named class and a same-named race, each with both packs and ids', () => {
    const lines = sameNamePairLines([
      pack('Fen rules', e('class', 'lantern-warden', 'Lantern Warden'), e('race', 'marsh-folk', 'Marsh folk')),
      pack('Mire zine', e('class', 'mire-warden', 'Lantern Warden'), e('race', 'mire-folk', 'Marsh folk')),
    ]);
    expect(lines).toEqual([
      'class "Lantern Warden": "Fen rules" (lantern-warden), "Mire zine" (mire-warden)',
      'race "Marsh folk": "Fen rules" (marsh-folk), "Mire zine" (mire-folk)',
    ]);
  });

  // Purpose: npm run pack:check on two packs with a same-named item prints it as information, adds no library note, and exits 0.
  it('npm run pack:check prints the pair under its own heading and still exits 0', () => {
    const out = execFileSync('node', ['scripts/check-pack.mjs', 'scripts/fixtures/dec-1d-twins-a.fixture.json', 'scripts/fixtures/dec-1d-twins-b.fixture.json'], { encoding: 'utf8' });
    expect(out).toMatch(/No library notes\./);
    expect(out).toMatch(/Same-named entries, for information \(1;[^\n]*\n {2}- item "Reed lamp": "Invented fen twins \(A\)" \(reed-lamp\), "Invented mire twins \(B\)" \(mire-reed-lamp\)/);
    expect(out).not.toMatch(/Eel knife|Bog candle/);
  });

  // Purpose: packs with no same-named entries print no such section.
  it('npm run pack:check on packs with no shared names prints no such section', () => {
    const out = execFileSync('node', ['scripts/check-pack.mjs', fixture('keyed-a'), fixture('keyed-b')], { encoding: 'utf8' });
    expect(out).not.toMatch(/Same-named entries/);
  });
});

describe('a pinned copy is listed with the pack it was pinned from (sn-1b)', () => {
  // Purpose: npm run pack:check on a rules pack and a conversion that holds its own class and race beside pinned copies
  // of the rules pack's lists each pair, the copy under the pack it was pinned from, saying where it sits; a pinned item
  // inside one pack is not listed (other kinds unchanged); the exit code stays 0.
  it('npm run pack:check lists the pinned class and race pairs, not the pinned item', () => {
    const out = execFileSync('node', ['scripts/check-pack.mjs', 'scripts/fixtures/sn-1b-pinned-rules.fixture.json', 'scripts/fixtures/sn-1b-pinned-conversion.fixture.json'], { encoding: 'utf8' });
    expect(out).toMatch(/Same-named entries, for information \(2;/);
    expect(out).toContain('- class "Lantern Warden": "Invented fen rules (sn-1b)" (lantern-warden, pinned copy in "Invented mire conversion (sn-1b)"), "Invented mire conversion (sn-1b)" (mire-warden)');
    expect(out).toContain('- race "Bog folk": "Invented fen rules (sn-1b)" (bog-folk, pinned copy in "Invented mire conversion (sn-1b)"), "Invented mire conversion (sn-1b)" (mire-bog-folk)');
    expect(out).not.toMatch(/"Reed lamp"/);
  });

  // Purpose: the conversion checked alone (the pack it names not given) lists nothing: both twins sit in one pack.
  it('the conversion alone lists no pair', () => {
    const out = execFileSync('node', ['scripts/check-pack.mjs', 'scripts/fixtures/sn-1b-pinned-conversion.fixture.json'], { encoding: 'utf8' });
    expect(out).not.toMatch(/Same-named entries/);
  });
});
