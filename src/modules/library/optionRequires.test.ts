// Options-gates build order 5 (bq3-13): the pure parts of `requires` (A1) and presets (A8). Invented options only.
import { describe, expect, it } from 'vitest';
import { requiresOf, requiresOn, withRequires } from './optionGate.ts';
import { readOptions, readPresets } from './options.ts';
import type { PackEntry } from './packFile.ts';
import { changesWith, movesOf, offeredSources, presetChanges, settleRequires, withExtends, type RuleSource } from './ruleGroups.ts';

const onOff = [
  { id: 'off', name: 'Off' },
  { id: 'on', name: 'On' },
];
const option = (data: Record<string, unknown>): PackEntry => ({ kind: 'option', packEntryId: String(data.id), name: String(data.name ?? data.id), data });

const fen = (choices: Record<string, string> = {}): RuleSource => ({
  packId: 'fen',
  name: 'Fen Rules',
  shortName: 'Fen',
  kind: 'setting',
  rules: readOptions([
    option({ id: 'songs', name: 'Lantern songs', default: 'off', choices: onOff, presets: { first: 'on' } }),
    option({ id: 'carry', name: 'Carrying', default: 'none', choices: [{ id: 'none', name: 'Not counted' }, { id: 'coin', name: 'By weight' }], presets: { first: 'coin' } }),
    option({ id: 'oaths', name: 'Bog oaths', default: 'off', changeLater: 'lock', choices: onOff, presets: { first: 'on' } }),
  ]),
  choices,
  presets: [{ id: 'first', name: 'First night', notes: '' }],
});
const reed = (choices: Record<string, string> = {}): RuleSource => ({
  packId: 'reed',
  name: 'Reed Zine',
  shortName: 'Reed',
  kind: 'homebrew',
  rules: readOptions([
    option({ id: 'chorus', name: 'Reed chorus', default: 'off', choices: onOff, requires: { songs: 'on' } }),
    option({ id: 'echo', name: 'Echo verse', default: 'off', choices: onOff, requires: { chorus: ['on'] } }),
  ]),
  choices,
});

describe('requires (A1)', () => {
  // Purpose: both of 07's shapes ({ id: choice } and { id: [choices] }) read as one; nothing else is kept.
  it('reads requires in either shape', () => {
    expect(requiresOf({ requires: { a: 'on', b: ['x', 'y'], c: 3, '': 'z' } })).toEqual({ a: ['on'], b: ['x', 'y'] });
    expect(requiresOf({ requires: null })).toEqual({});
    expect(readOptions([option({ id: 'x', choices: onOff, requires: { songs: 'on' } })])[0]!.requires).toEqual({ songs: ['on'] });
  });

  // Purpose: an add-on is on offer only while every option it names has one of its choices; a parent nobody has hides it.
  it('is met only by one of the choices it needs', () => {
    expect(requiresOn({ songs: ['on'] }, { songs: 'on' })).toBe(true);
    expect(requiresOn({ songs: ['on'] }, { songs: 'off' })).toBe(false);
    expect(requiresOn({ songs: ['on'] }, {})).toBe(false);
    expect(requiresOn(undefined, {})).toBe(true);
  });

  // Purpose: the reader puts a hidden add-on (and an add-on to it) at its default, whatever is stored.
  it('reads a hidden add-on at its default, following chains', () => {
    const options: { id: string; requires: Record<string, string[]>; defaultChoice: string }[] = [
      { id: 'chorus', requires: { songs: ['on'] }, defaultChoice: 'off' },
      { id: 'echo', requires: { chorus: ['on'] }, defaultChoice: 'off' },
    ];
    expect(withRequires(options, { songs: 'off', chorus: 'on', echo: 'on' })).toEqual({ songs: 'off', chorus: 'off', echo: 'off' });
    const kept = { songs: 'on', chorus: 'on', echo: 'on' };
    expect(withRequires(options, kept)).toBe(kept);
  });

  // Purpose: the rows leave out an add-on whose parent (in another pack) is off, and show it once the parent is on.
  it('offers an add-on from another pack only once its parent is on', () => {
    expect(offeredSources([reed(), fen()])[0]!.rules).toHaveLength(0);
    expect(offeredSources([reed({ chorus: 'on' }), fen({ songs: 'on' })])[0]!.rules.map((r) => r.id)).toEqual(['chorus', 'echo']);
    expect(offeredSources([reed(), fen({ songs: 'on' })])[0]!.rules.map((r) => r.id)).toEqual(['chorus']);
  });

  // Purpose: switching the parent off moves every add-on it hides back to its default in the same change, with what each had before.
  it('switching the parent off sets its add-ons back in the same change', () => {
    const sources = [reed({ chorus: 'on', echo: 'on' }), fen({ songs: 'on' })];
    const changes = changesWith(sources, { fen: { songs: 'off' } });
    expect(changes).toEqual([
      { packId: 'reed', previous: { chorus: 'on', echo: 'on' }, next: { chorus: 'off', echo: 'off' } },
      { packId: 'fen', previous: { songs: 'on' }, next: { songs: 'off' } },
    ]);
    expect(movesOf(sources, changes).map((m) => `${m.name}: ${m.from} → ${m.to}`)).toEqual(['Reed chorus: On → Off', 'Echo verse: On → Off', 'Lantern songs: On → Off']);
    // A change that hides nothing moves only its own pack.
    expect(changesWith(sources, { fen: { songs: 'on', carry: 'coin' } }).map((c) => c.packId)).toEqual(['fen']);
  });

  // Purpose: a parent choice an overlay brought (extends, of-1) counts: the add-on shows while the base option has it.
  it("reads a parent's choice an overlay joined to the base option", () => {
    const base: RuleSource = { ...fen(), presets: [], rules: readOptions([option({ id: 'carry', name: 'Carrying', default: 'none', choices: [{ id: 'none', name: 'Not counted' }] })]) };
    const zine: RuleSource = {
      ...reed(),
      rules: readOptions([
        option({ id: 'reed-bundles', extends: 'carry', choices: [{ id: 'bundles', name: 'Reed bundles' }] }),
        option({ id: 'reed-strength', name: 'Strong backs', default: 'off', choices: onOff, requires: { carry: 'bundles' } }),
      ]),
    };
    expect(offeredSources(withExtends([zine, base]))[0]!.rules).toHaveLength(0);
    expect(offeredSources(withExtends([zine, { ...base, choices: { carry: 'bundles' } }]))[0]!.rules.map((r) => r.id)).toEqual(['reed-strength']);
  });

  // Purpose: a source whose add-ons are all where they should be is left as the same object.
  it('leaves settled sources alone', () => {
    const sources = [reed(), fen()];
    expect(settleRequires(sources)[0]).toBe(sources[0]);
  });
});

describe('presets (A8)', () => {
  // Purpose: a pack's preset names come from its rules sets' optionPresets, once each; one without an id is left out.
  it('reads the presets a pack names', () => {
    const set = (optionPresets: unknown): PackEntry => ({ kind: 'rulesSet', packEntryId: 's', name: 'S', data: { optionPresets } });
    expect(readPresets([set([{ id: 'first', name: 'First night', notes: ' Gentle. ' }, { id: 'first', name: 'Again' }, { name: 'No id' }, { id: 'bare' }])])).toEqual([
      { id: 'first', name: 'First night', notes: 'Gentle.' },
      { id: 'bare', name: 'bare', notes: '' },
    ]);
    // An option's preset choice that it doesn't have is left out.
    expect(readOptions([option({ id: 'x', choices: onOff, presets: { first: 'on', other: 'nope' } })])[0]!.presets).toEqual({ first: 'on' });
  });

  // Purpose: a preset sets only the rules that name it; once the campaign has started a locked one stays, named.
  it('plans a preset: what it changes and what it leaves', () => {
    const later = presetChanges([fen()], 'fen', 'first', { attaching: false })!;
    expect(later.changes).toEqual([{ packId: 'fen', previous: {}, next: { songs: 'on', carry: 'coin' } }]);
    expect(later.kept).toEqual([{ name: 'Bog oaths', why: "can't change once the campaign starts" }]);
    const atSetUp = presetChanges([fen()], 'fen', 'first', { attaching: true })!;
    expect(atSetUp.changes[0]!.next).toEqual({ songs: 'on', carry: 'coin', oaths: 'on' });
    expect(atSetUp.kept).toEqual([]);
    expect(presetChanges([fen()], 'fen', 'unknown', { attaching: true })).toBeNull();
    // Nothing to change: no changes, no moves.
    expect(presetChanges([fen({ songs: 'on', carry: 'coin', oaths: 'on' })], 'fen', 'first', { attaching: false })!.moves).toEqual([]);
  });
});
