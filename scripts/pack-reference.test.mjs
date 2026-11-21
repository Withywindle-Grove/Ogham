// Tests for the pack checker's GM reference checks (scripts/pack-reference.mjs; docs/07 `gmReference`, M5 gate B4),
// on invented snippets.
import { describe, expect, it } from 'vitest';
import { formatNotes } from './pack-format.mjs';
import { gmReferenceNotes } from './pack-reference.mjs';

const rules = (gmReference) => ({ rulesSets: [{ id: 'fen-rules', name: 'Fen rules', gmReference }] });

describe('the gmReference checks', () => {
  it('finds nothing wrong with panels whose entries all have text, and nothing at all without the field', () => {
    expect(gmReferenceNotes(rules([{ id: 'saints', title: "Saints' days", entries: [{ heading: 'Feast of the Heron', text: 'Markets close.', tableId: 'heron', source: 'p. 9' }] }]))).toEqual([]);
    expect(gmReferenceNotes({ rulesSets: [{ id: 'fen-rules' }] })).toEqual([]);
    expect(gmReferenceNotes(null)).toEqual([]);
  });

  it('warns when a panel has no entries, and when an entry has no text', () => {
    const notes = gmReferenceNotes(rules([
      { id: 'empty', title: 'Nothing yet', entries: [] },
      { id: 'tides', title: 'Tides', entries: [{ heading: 'High water' }, { heading: 'Low water', text: '  ' }] },
    ]));
    expect(notes).toEqual([
      'rulesSets: "fen-rules": gmReference, panel "Nothing yet" has no entries; it won\'t show.',
      'rulesSets: "fen-rules": gmReference, panel "Tides", entry "High water" has no text.',
      'rulesSets: "fen-rules": gmReference, panel "Tides", entry "Low water" has no text.',
    ]);
  });

  it('says when the field is not a list, or a panel has no title', () => {
    expect(gmReferenceNotes(rules({ title: 'One panel' }))).toEqual(['rulesSets: "fen-rules": gmReference should be a list of panels, each { id, title, entries }.']);
    expect(gmReferenceNotes(rules([{ id: 'untitled', entries: [{ text: 'Words.' }] }]))).toEqual(['rulesSets: "fen-rules": gmReference, panel "untitled" has no title; it won\'t show.']);
  });

  it('accepts gmOnly true or false on a panel, and warns when it is anything else', () => {
    // Purpose: a panel meant for the players (gmOnly: false, ruled 2026-11-07) isn't silently kept the GM's by a typo.
    const panel = (gmOnly) => ({ id: 'tides', title: 'Tides', gmOnly, entries: [{ heading: 'High water', text: 'The causeway floods.' }] });
    expect(gmReferenceNotes(rules([panel(false), panel(true), panel(undefined)]))).toEqual([]);
    expect(gmReferenceNotes(rules([panel('false')]))).toEqual([`rulesSets: "fen-rules": gmReference, panel "Tides": gmOnly should be true or false; it stays the GM's.`]);
  });

  it('runs as part of the format checks', () => {
    expect(formatNotes(rules([{ id: 'empty', title: 'Nothing yet', entries: [] }]))).toContain('rulesSets: "fen-rules": gmReference, panel "Nothing yet" has no entries; it won\'t show.');
  });
});
