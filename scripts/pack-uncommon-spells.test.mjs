// npm run pack:check's notes on spells found in play (us-1, ruled 2026-11-05; scripts/pack-uncommon-spells.mjs).
// Warnings only; the ruled shape passes. Every name is invented.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { uncommonReferenceNotes, uncommonSpellNotes } from './pack-uncommon-spells.mjs';

const setting = {
  classes: [{ id: 'lantern-warden', name: 'Lantern Warden' }],
  spellLists: [{ id: 'list-lantern-warden', name: 'Warden spells', levels: [{ level: 1, spells: ['glimmer'] }] }],
};
const region = { locations: [{ id: 'drowned-chapel', name: 'The drowned chapel' }] };
const hush = (uncommon, more = {}) => ({ spells: [{ id: 'lanterns-hush', name: "Lantern's Hush", uncommon, ...more }] });

const run = (...files) => {
  try {
    return execFileSync(process.execPath, ['scripts/check-pack.mjs', ...files], { encoding: 'utf8' });
  } catch (error) {
    return String(error.stdout);
  }
};

describe('an uncommon spell (us-1)', () => {
  // Purpose: the ruled shape passes: no lists, the list and rank it joins, and where it's found (a place id, a hex or
  // words); a list may be named by a spell list's id or a class's, as a spell's lists may.
  it('passes the ruled shape', () => {
    const file = { ...setting, ...region, ...hush({ lists: { 'list-lantern-warden': 3, 'lantern-warden': 3 }, foundAt: [{ placeId: 'drowned-chapel' }, { hex: '0412' }, { note: 'Under the heron stone' }] }) };
    expect(uncommonSpellNotes(file)).toEqual([]);
    expect(uncommonReferenceNotes([file])).toEqual([]);
  });

  // Purpose: an uncommon spell that also has lists is warned (the lists would offer it before it's found).
  it('warns on an uncommon spell with lists', () => {
    const file = { ...setting, ...hush({ lists: { 'list-lantern-warden': 3 } }, { lists: { 'list-lantern-warden': 3 } }) };
    expect(uncommonSpellNotes(file)).toEqual([
      `spells: "lanterns-hush" is uncommon but also has lists, so the lists would offer it before anyone finds it; drop lists (uncommon.lists says where it joins once found; us-1).`,
    ]);
  });

  // Purpose: an uncommon block the checker can't read says the shape: not an object, no lists, a rank that isn't
  // whole, a foundAt that isn't a list of objects.
  it('notes a malformed block', () => {
    expect(uncommonSpellNotes(hush(true))).toEqual(['spells: "lanterns-hush": uncommon should be { lists: { <list id>: <rank> }, foundAt: [{ placeId?, hex?, note? }] } (us-1).']);
    expect(uncommonSpellNotes(hush({ foundAt: 'the chapel' }))).toEqual([
      'spells: "lanterns-hush": uncommon.lists should name the list and rank it joins once found, such as { "<list id>": 3 } (us-1).',
      'spells: "lanterns-hush": uncommon.foundAt should be a list of { placeId?, hex?, note? } (us-1).',
    ]);
    expect(uncommonSpellNotes(hush({ lists: { 'list-lantern-warden': 'third' } }))).toEqual(['spells: "lanterns-hush": uncommon.lists "list-lantern-warden" should be a whole-number rank, not "third".']);
  });

  // Purpose: checked alone, a list id or place id the file lacks asks for the pack that has it; checked together, a
  // place another pack holds is found, and an id no pack has is warned as such.
  it('warns on an unknown list id or placeId, alone and together', () => {
    const spells = hush({ lists: { 'list-bog-singer': 2 }, foundAt: [{ placeId: 'drowned-chapel' }, { placeId: 'sunken-bell' }] });
    const file = { ...setting, ...spells };
    expect(uncommonReferenceNotes([file])).toEqual([
      `spells: "lanterns-hush": uncommon.lists names "list-bog-singer", a spell list or class that isn't in this pack; check it together with the pack that has it (npm run pack:check -- <this file> <that file>).`,
      `spells: "lanterns-hush": uncommon.foundAt names the place "drowned-chapel", a location that isn't in this pack; check it together with the pack that has it (npm run pack:check -- <this file> <that file>).`,
      `spells: "lanterns-hush": uncommon.foundAt names the place "sunken-bell", a location that isn't in this pack; check it together with the pack that has it (npm run pack:check -- <this file> <that file>).`,
    ]);
    expect(uncommonReferenceNotes([file, region], true)).toEqual([
      `spells: "lanterns-hush": uncommon.lists names "list-bog-singer", a spell list or class that isn't in any of these packs.`,
      `spells: "lanterns-hush": uncommon.foundAt names the place "sunken-bell", a location that isn't in any of these packs.`,
    ]);
  });

  // Purpose: ordinary spells and odd input get no note and never throw.
  it('leaves ordinary spells alone', () => {
    const file = { ...setting, spells: [{ id: 'glimmer', lists: { 'list-lantern-warden': 1 } }, 'nope'] };
    expect(uncommonSpellNotes(file)).toEqual([]);
    expect(uncommonReferenceNotes([file, null])).toEqual([]);
  });
});

describe('npm run pack:check on the Gleam fen fixture and its region', () => {
  // Purpose: alone, the setting's uncommon spells get the lists note and ask for the region's file; with the region,
  // the chapel is found and only the made-up list and the missing place are library notes.
  it('warns alone and together', () => {
    const alone = run('scripts/fixtures/pack-check-after-gate.fixture.json');
    expect(alone).toMatch(/"reed-whisper" is uncommon but also has lists/);
    expect(alone).toMatch(/"lanterns-hush": uncommon\.foundAt names the place "drowned-chapel", a location that isn't in this pack/);
    const stack = run('scripts/fixtures/pack-check-after-gate.fixture.json', 'scripts/fixtures/pack-check-after-gate-region.fixture.json');
    const library = stack.slice(stack.indexOf('=== The 2 packs together'));
    expect(library).toMatch(/Library notes \(2\):/);
    expect(library).toMatch(/"mire-song": uncommon\.lists names "list-bog-singer", a spell list or class that isn't in any of these packs/);
    expect(library).toMatch(/"mire-song": uncommon\.foundAt names the place "sunken-bell"/);
    expect(library).not.toMatch(/drowned-chapel/);
  });
});
