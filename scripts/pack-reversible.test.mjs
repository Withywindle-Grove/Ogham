// npm run pack:check on a spell's reversible keyed by list (a5-1, ruled 2026-11-05; scripts/pack-reversible.mjs).
// The keyed form passes; a malformed one is still flagged. Every name is invented.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { keyedReversibleFinding, reversibleNotes } from './pack-reversible.mjs';

const FINDING = 'Can be cast reversed must be yes or no.';
const spell = (reversible) => ({ id: 'fen-breath', name: 'Fen breath', lists: { 'list-lantern-warden': 3, 'bog-singer': 3 }, reversible });

describe('reversible keyed by list (a5-1)', () => {
  // Purpose: a keyed form naming the spell's own lists with yes or no each passes: no note, and the editor's
  // "must be yes or no" finding is set aside for it.
  it('accepts the keyed form', () => {
    const keyed = spell({ 'list-lantern-warden': true, 'bog-singer': false });
    expect(reversibleNotes({ spells: [keyed] })).toEqual([]);
    expect(keyedReversibleFinding(keyed, FINDING)).toBe(true);
  });

  // Purpose: a keyed form with a value that isn't yes or no, a key the spell's lists don't have, or no key at all is
  // still flagged, and the editor's finding stays.
  it('flags a malformed keyed form', () => {
    const bad = spell({ 'list-lantern-warden': 'yes', 'list-reed-witch': true });
    expect(reversibleNotes({ spells: [bad, { ...spell({}), id: 'empty-ward' }] })).toEqual([
      'spells: "fen-breath": reversible by list "list-lantern-warden" should be true or false, not "yes"; "list-reed-witch" isn\'t one of the spell\'s lists (list-lantern-warden, bog-singer); write { "<list id>": true | false } for each of its lists, or plain true or false (a5-1).',
      'spells: "empty-ward": reversible by list names no list; write { "<list id>": true | false } for each of its lists, or plain true or false (a5-1).',
    ]);
    expect(keyedReversibleFinding(bad, FINDING)).toBe(false);
  });

  // Purpose: plain yes or no gets no note, a plain wrong value ("yes") keeps the editor's finding, and other
  // findings are never set aside.
  it('leaves the plain form to the editor', () => {
    expect(reversibleNotes({ spells: [spell(true), spell(false)] })).toEqual([]);
    expect(keyedReversibleFinding(spell('yes'), FINDING)).toBe(false);
    expect(keyedReversibleFinding(spell({ 'bog-singer': true }), 'Name is needed.')).toBe(false);
  });

  // Purpose: on the Gleam fen fixture, pack:check says nothing about Fen breath's keyed form and flags Mud ward's.
  it('pack:check accepts the keyed fixture spell and flags the malformed one', () => {
    let out;
    try {
      out = execFileSync(process.execPath, ['scripts/check-pack.mjs', 'scripts/fixtures/pack-check-after-gate.fixture.json'], { encoding: 'utf8' });
    } catch (error) {
      out = String(error.stdout);
    }
    expect(out).not.toMatch(/Fen breath|fen-breath/);
    expect(out).toMatch(/spells: "mud-ward": reversible by list/);
    expect(out).toMatch(/spell "Mud ward": Can be cast reversed must be yes or no\./);
  });
});
