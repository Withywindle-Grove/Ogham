// rq-1 (docs/design/rulings/dec-required-packs-and-pack-choices-2026-11-13.md): a campaign that lacks a pack another
// needs says so. The pure part: which attached packs need one not attached, the ▲ line's words, and the attach step's
// line naming only what is missing. Invented packs only.
import { describe, expect, it } from 'vitest';
import { missingBases, missingFromCampaign, needsPicked, notAttachedWords } from './ruleGroups.ts';

/** A library pack: its library id, name, meta.id and meta.requires. */
const pack = (id: string, name: string, metaId: string, requires: string[] = []) => ({ id, name, metaId, requires });
const idOf = (p: { metaId: string }) => p.metaId;
const library = [
  pack('lib-fen', 'Fen Rules', 'fen-rules'),
  pack('lib-moss', 'Moss Rules', 'moss-rules'),
  pack('lib-conv', 'Fen to Moss conversion', 'fen-moss', ['fen-rules', 'moss-rules']),
  pack('lib-abbey', 'The Drowned Abbey', 'drowned-abbey', ['fen-rules']),
  pack('lib-hollow', 'Moth Hollow', 'moth-hollow', ['moth-rules']),
];

describe('missingFromCampaign (rq-1)', () => {
  // Purpose: an attached pack whose required pack isn't attached is named, with the needed pack's library id.
  it('names an attached pack whose required pack is not attached, with the needed pack found in the library', () => {
    expect(missingFromCampaign(['lib-abbey'], library, idOf)).toEqual([
      { name: 'The Drowned Abbey', packId: 'lib-abbey', needs: [{ name: 'Fen Rules', inLibrary: true, packId: 'lib-fen' }] },
    ]);
  });

  // Purpose: only the required packs not attached are named; once every one is attached, nothing is missing.
  it('names only what is not attached, and nothing once all are', () => {
    expect(missingFromCampaign(['lib-conv', 'lib-fen'], library, idOf)).toEqual([
      { name: 'Fen to Moss conversion', packId: 'lib-conv', needs: [{ name: 'Moss Rules', inLibrary: true, packId: 'lib-moss' }] },
    ]);
    expect(missingFromCampaign(['lib-conv', 'lib-fen', 'lib-moss'], library, idOf)).toEqual([]);
  });

  // Purpose: a required pack the library hasn't got is named by its id, with no library pack to attach.
  it('names a required pack the library has not got by its id, with nothing to attach', () => {
    expect(missingFromCampaign(['lib-hollow'], library, idOf)).toEqual([
      { name: 'Moth Hollow', packId: 'lib-hollow', needs: [{ name: 'moth-rules', inLibrary: false, packId: null }] },
    ]);
  });

  // Purpose: an attached pack not in the library (the campaign's own homebrew) needs nothing here; no packs, nothing.
  it('reads nothing for an attached pack outside the library', () => {
    expect(missingFromCampaign(['campaign-homebrew'], library, idOf)).toEqual([]);
    expect(missingFromCampaign([], library, idOf)).toEqual([]);
  });

  // Purpose: New campaign's reading is unchanged by the shared core (the same facts, the same shape as before).
  it('leaves missingBases as it was', () => {
    expect(missingBases([library[3]!], library, idOf)).toEqual([{ name: 'The Drowned Abbey', needs: [{ name: 'Fen Rules', inLibrary: true }] }]);
  });
});

describe('the ▲ line (rq-1, in the voice of missingWords)', () => {
  const missing = (ids: string[]) => missingFromCampaign(ids, library, idOf)[0]!;

  // Purpose: one needed pack in the library: "<Pack> needs <Other>, which isn't attached to this campaign."
  it('says one needed pack', () => {
    expect(notAttachedWords(missing(['lib-abbey']))).toBe("The Drowned Abbey needs Fen Rules, which isn't attached to this campaign.");
  });

  // Purpose: two needed packs: "…needs <A> and <B>, which aren't attached to this campaign."
  it('says two needed packs', () => {
    expect(notAttachedWords(missing(['lib-conv']))).toBe("Fen to Moss conversion needs Fen Rules and Moss Rules, which aren't attached to this campaign.");
  });

  // Purpose: a needed pack the library hasn't got ends the line "Import it into your library first."
  it('ends with the import when the library has not got it', () => {
    expect(notAttachedWords(missing(['lib-hollow']))).toBe("Moth Hollow needs moth-rules, which isn't attached to this campaign. Import it into your library first.");
  });

  // Purpose: two the library hasn't got say "them"; when only some are missing from the library, those are named.
  it('says "them" for two not in the library, and names the one when only some are', () => {
    const both = { name: 'Moth Hollow', needs: [{ name: 'moth-rules', inLibrary: false }, { name: 'wing-rules', inLibrary: false }] };
    expect(notAttachedWords(both)).toBe("Moth Hollow needs moth-rules and wing-rules, which aren't attached to this campaign. Import them into your library first.");
    const one = { name: 'Moth Hollow', needs: [{ name: 'Fen Rules', inLibrary: true }, { name: 'moth-rules', inLibrary: false }] };
    expect(notAttachedWords(one)).toBe("Moth Hollow needs Fen Rules and moth-rules, which aren't attached to this campaign. Import moth-rules into your library first.");
  });
});

describe("the attach step's line (rq-1)", () => {
  const names = new Map([['fen-rules', 'Fen Rules'], ['moss-rules', 'Moss Rules']]);

  // Purpose: the line names only the required packs not picked, not the whole list.
  it('names only the required packs not picked', () => {
    expect(needsPicked(['fen-rules', 'moss-rules'], new Set(['fen-rules']), names)).toBe('Needs: Moss Rules.');
    expect(needsPicked(['fen-rules', 'moss-rules'], new Set(), names)).toBe('Needs: Fen Rules, Moss Rules.');
  });

  // Purpose: with none missing it reads as today.
  it('reads as today when none is missing', () => {
    expect(needsPicked(['fen-rules', 'moss-rules'], new Set(['fen-rules', 'moss-rules']), names)).toBe('needs Fen Rules, Moss Rules ✓');
    expect(needsPicked([], new Set(), names)).toBe('');
  });
});
