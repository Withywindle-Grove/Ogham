// Tests for the pack checker's encounter and fight checks (scripts/pack-encounters.mjs; docs/07, "Encounters and
// fights") and meta.replaces (scripts/pack-format.mjs; docs/07, meta.id), on an invented pack
// (scripts/fixtures/m6-encounters.fixture.json) and invented snippets. Every name and number here is made up.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatCounts, formatNotes, replacesNotes } from './pack-format.mjs';
import { encounterNotes } from './pack-encounters.mjs';

const fixture = 'scripts/fixtures/m6-encounters.fixture.json';
const sample = () => JSON.parse(readFileSync(fixture, 'utf8'));
const withRules = (rules) => ({ rulesSets: [{ id: 'r', ...rules }] });

describe('the encounter and fight checks', () => {
  it('finds nothing to say about a pack that writes every encounter field the way 07 says', () => {
    expect(formatNotes(sample())).toEqual([]);
  });

  it('counts pursuit rules, morale triggers, reaction tables and temporary-HP sources', () => {
    expect(formatCounts(sample())).toMatchObject({ 'rules sets with pursuit': 1, 'morale triggers': 4, 'reaction tables': 1, 'entries granting temporary HP': 1 });
  });

  it('checks pursuit is { note, evade?, drop?, source? }, all text', () => {
    expect(encounterNotes(withRules({ pursuit: 'Run!' }))).toEqual([
      'rulesSets: "r": pursuit is plain text; write { "note": "…" } (and evade, drop for the evasion and dropping rules).',
    ]);
    expect(encounterNotes(withRules({ pursuit: { evade: 3, chase: 'x' } }))).toEqual([
      'rulesSets: "r": pursuit has no note; the Escape step would show Got away and Caught with no rule.',
      'rulesSets: "r": pursuit.evade should be words.',
      'rulesSets: "r": pursuit.chase isn\'t read; pursuit takes note, evade, drop, source (all text).',
    ]);
  });

  it('accepts helped as text and checks its structured shapes, naming the new shape for abilityLoss.pick', () => {
    const dying = (helped) => withRules({ death: { at: 0, dying: { startAt: 0, helped } } });
    expect(encounterNotes(dying('Someone binds the wound.'))).toEqual([]);
    expect(encounterNotes(dying({ hp: 2, abilityLoss: { pick: true } }))).toEqual([
      'rulesSets: "r": death.dying.helped.abilityLoss.pick is the old way (the loss is rolled, not chosen); write { "roll": "<dice>", "enter": true }.',
      'rulesSets: "r": death.dying.helped.abilityLoss.roll should be dice like "1d3" (rolled at the table).',
      'rulesSets: "r": death.dying.helped.abilityLoss.enter should be true (the result is entered).',
    ]);
    expect(encounterNotes(dying({ wake: { roll: 'soon' } }))).toEqual([
      'rulesSets: "r": death.dying.helped.wake should be { "roll": "<dice>", "unit": "<unit>" } (a wake-up timer from a roll the GM enters).',
    ]);
    expect(encounterNotes(dying({ note: 'Nothing else' }))[0]).toMatch(/death.dying.helped should be text, or/);
  });

  it('checks the helps on a byOption change of the dying rule, healed and stabilised included', () => {
    const notes = encounterNotes(withRules({ death: { at: 0, byOption: { 'last-breath=on': { dying: { helped: { hp: -1 }, healed: 7 } } } } }));
    expect(notes).toEqual([
      'rulesSets: "r": death.byOption "last-breath=on" dying.helped.hp should be a whole number (the HP restored).',
      expect.stringMatching(/death.byOption "last-breath=on" dying.healed should be text, or/),
    ]);
  });

  it('accepts leaderDown and employerDown as morale events and warns about events the app never prompts for', () => {
    const triggers = [
      { id: 'a', event: 'leaderDown', scope: 'group', name: 'Chief drops' },
      { id: 'b', event: 'employerDown', scope: 'alone', name: 'Employer drops' },
      { id: 'c', event: 'sunset', scope: 'everyone', name: 'Dusk' },
      { id: 'd', event: 'hpAtOrBelow', scope: 'alone', name: 'Hurt' },
      { id: 'a', event: 'firstWound', name: 'Again' },
    ];
    expect(encounterNotes(withRules({ morale: { triggers } }))).toEqual([
      'rulesSets: "r": morale trigger "c": event "sunset" isn\'t one of firstDeath, halfDown, firstWound, hpAtOrBelow, leaderDown, employerDown; it would never prompt.',
      'rulesSets: "r": morale trigger "c": scope "everyone" isn\'t one of group, alone.',
      'rulesSets: "r": morale trigger "d": hpAtOrBelow needs a fraction from 0 to 1 (0.5 is half).',
      'rulesSets: "r": morale trigger "a" appears twice.',
    ]);
  });

  it('checks reaction rows\' meaning is one short line, and says when meaning sits on a table that isn\'t a reaction table', () => {
    const pack = { tables: [
      { id: 'mood', use: 'encounters.reaction', rows: [{ min: 1, max: 3, result: 'Cross', meaning: 4 }, { min: 4, max: 6, result: 'Calm', meaning: 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen' }] },
      { id: 'loot', uses: ['treasure'], rows: [{ min: 1, max: 6, result: 'Shells', meaning: 'Pretty' }] },
    ] };
    expect(encounterNotes(pack)).toEqual([
      'tables: "mood", row 1–3: meaning should be one line of words.',
      'tables: "mood", row 4–6: meaning has 15 words; one short line is the aim.',
      'tables: "loot": rows carry meaning, which is only read on a reaction table; add "encounters.reaction" to its uses if it is one.',
    ]);
  });

  it('checks grantsTempHp is { dice | formula, duration } on spells, items and class and race abilities', () => {
    const pack = {
      spells: [{ id: 's', grantsTempHp: { dice: 'lots', duration: '1 turn' } }],
      items: [{ id: 'i', grantsTempHp: { dice: '1d4', formula: 'level', duration: '1 turn' } }],
      classes: [{ id: 'c', abilities: [{ name: 'Rally', grantsTempHp: { formula: 'level' } }] }],
      races: [{ id: 'k', abilities: [{ name: 'Thick hide', grantsTempHp: 3 }] }],
    };
    expect(encounterNotes(pack)).toEqual([
      'spells: "s": grantsTempHp.dice should be dice like "1d6".',
      'items: "i": grantsTempHp needs dice or a formula (one of them).',
      'classes: "c", ability "Rally": grantsTempHp has no duration; the bonus HP would have no timer.',
      'races: "k", ability "Thick hide": grantsTempHp should be { "dice": "1d6", "duration": "…" } or { "formula": "…", "duration": "…" }.',
    ]);
  });

  it('never throws on odd input', () => {
    expect(encounterNotes(null)).toEqual([]);
    expect(encounterNotes({ rulesSets: [{ id: 'r', death: 'x', morale: { triggers: 'x' } }], tables: [5, { rows: 'x' }], spells: 'x' })).toEqual([
      'rulesSets: "r": morale.triggers should be a list like [{ "id": "…", "event": "firstDeath", "scope": "group", "name": "…" }].',
    ]);
  });
});

describe('the meta.replaces check', () => {
  it('accepts a list of old ids and says nothing when replaces is left out', () => {
    expect(replacesNotes({ meta: { id: 'fen-sample', replaces: ['fen-old', 'fen-older'] } })).toEqual([]);
    expect(replacesNotes({ meta: { id: 'fen-sample' } })).toEqual([]);
  });

  it('rejects a pack that lists its own id, a repeated id, a non-list and a pack with no id', () => {
    expect(replacesNotes({ meta: { id: 'fen-sample', replaces: ['fen-sample', 'fen-old', 'fen-old', 3] } })).toEqual([
      'meta.replaces lists "fen-sample", the pack\'s own meta.id; a pack can\'t replace itself.',
      'meta.replaces lists "fen-old" twice.',
      'meta.replaces: entry 4 should be an id.',
    ]);
    expect(replacesNotes({ meta: { id: 'fen-sample', replaces: 'fen-old' } })).toEqual(['meta.replaces should be a list of old ids, like ["<old id>"].']);
    expect(replacesNotes({ meta: { replaces: ['fen-old'] } })).toEqual(['meta.replaces is given but the pack has no meta.id; the new id is what the old ones point to.']);
  });

  it('says in npm run pack:check that one file alone can\'t show whether an id belongs to another pack in the library', () => {
    const out = execFileSync(process.execPath, ['scripts/check-pack.mjs', fixture], { encoding: 'utf8' });
    expect(out).toMatch(/meta.replaces: this checker reads one file, so it can't see your library/);
    expect(out).toMatch(/morale triggers: 4/);
  });
});
