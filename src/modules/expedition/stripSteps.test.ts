// The strip's steps (plan dec-9-the-whole-scene S7; mc-54, mc-54b, mc-60a, pf-14, pf-14a; invented packs only).
//   Purpose: the strip shows the procedure in force: the place's own (the nearest place in its chain that has one), else
//   the expedition's mode's, else the rules set's default, else the app's own five, in their order, each with its icon;
//   a pack's step names are kept as written; a step's text is read by the one rule-text reader, and a step without text
//   has none (so it is no tap); a step with no name is left out; nothing a pack writes makes the reading fail.
import { describe, expect, it } from 'vitest';
import { POINT_TO_POINT_ID } from './modes.ts';
import { APP_STEPS, procedureInForce, readStripSteps } from './stripSteps.ts';

const rulesSet = {
  procedure: [
    { id: 'look', name: 'Look about', icon: 'crystal-ball' },
    { id: 'bargain', name: 'Bargain with the fen', text: 'Offer something small.' },
  ],
  exploration: {
    modes: [
      { id: 'creep', name: 'Creeping', step: { value: 1, unit: 'turn' }, procedure: [{ id: 'listen', name: 'Listen at the reeds', icon: 'listen', kind: 'note' }] },
      { id: 'roam', name: 'Roaming', step: { value: 1, unit: 'day' }, procedure: [] },
    ],
  },
};

const jetty = { data: { procedure: [{ id: 'moor', name: 'Moor the boat', icon: 'water-splash', text: { blocks: [{ p: 'Tie off at the posts.' }] } }] } };
const harbour = { data: { procedure: [{ id: 'tide', name: 'Mind the tide' }] } };
const plain = { data: {} };

describe('the procedure in force (mc-54)', () => {
  it("takes the party's place's own procedure first", () => {
    const found = procedureInForce({ chain: [jetty, harbour], modeId: 'creep', rulesSets: [rulesSet] });
    expect(found.source).toBe('place');
    expect(found.steps.map((s) => s.name)).toEqual(['Moor the boat']);
  });

  it('else the nearest place it sits in that has one', () => {
    const found = procedureInForce({ chain: [plain, harbour], modeId: 'creep', rulesSets: [rulesSet] });
    expect(found.source).toBe('place');
    expect(found.steps.map((s) => s.name)).toEqual(['Mind the tide']);
  });

  it("else the expedition's mode's, with the icon name the pack writes", () => {
    const found = procedureInForce({ chain: [plain], modeId: 'creep', rulesSets: [rulesSet] });
    expect(found).toEqual({ source: 'mode', steps: [{ id: 'listen', name: 'Listen at the reeds', icon: 'listen', text: null }] });
  });

  it("else the rules set's default, its names as written (mc-60a); a mode with no steps is passed over", () => {
    for (const modeId of ['roam', null]) {
      const found = procedureInForce({ chain: [], modeId, rulesSets: [rulesSet] });
      expect(found.source).toBe('rules');
      expect(found.steps.map((s) => s.name)).toEqual(['Look about', 'Bargain with the fen']);
    }
  });

  it("else the app's own five, in order, with the set's icons (mc-54b)", () => {
    const found = procedureInForce({ chain: [], modeId: null, rulesSets: [] });
    expect(found.source).toBe('app');
    expect(found.steps.map((s) => [s.name, s.icon])).toEqual([
      ['Describe', 'trumpet-flag'],
      ['Question', 'crystal-ball'],
      ['Act', 'sword-brandish'],
      ['Test', 'pointy-hat'],
      ['Resolve', 'locked-chest'],
    ]);
    expect(found.steps).toBe(APP_STEPS);
    expect(APP_STEPS.every((s) => s.text === null)).toBe(true);
  });

  it('reads the top rules set first, as the modes are picked', () => {
    const lower = { procedure: [{ id: 'a', name: 'Older step' }] };
    expect(procedureInForce({ chain: [], modeId: null, rulesSets: [lower, rulesSet] }).steps[0]!.name).toBe('Look about');
  });
});

// Point to point (plan scene-point-to-point, piece B8; p2p-7, ruled 2026-11-18).
describe('the strip in point to point (p2p-7)', () => {
  // Purpose: in point to point the strip is the app's own five steps, even where the rules set has a default procedure
  // that any other mode would show.
  it("is the app's own five, passing over the rules set's default", () => {
    const found = procedureInForce({ chain: [plain], modeId: POINT_TO_POINT_ID, rulesSets: [rulesSet] });
    expect(found.source).toBe('app');
    expect(found.steps).toBe(APP_STEPS);
    expect(found.steps.map((s) => s.name)).toEqual(['Describe', 'Question', 'Act', 'Test', 'Resolve']);
  });

  // Purpose: a place that carries steps of its own shows them in point to point too: the party's place first, else the
  // nearest place it sits in.
  it('is the place’s own steps where the place carries some', () => {
    expect(procedureInForce({ chain: [jetty, harbour], modeId: POINT_TO_POINT_ID, rulesSets: [rulesSet] })).toMatchObject({ source: 'place', steps: [{ name: 'Moor the boat' }] });
    expect(procedureInForce({ chain: [plain, harbour], modeId: POINT_TO_POINT_ID, rulesSets: [rulesSet] })).toMatchObject({ source: 'place', steps: [{ name: 'Mind the tide' }] });
  });

  // Purpose: steps a rules set writes under the app's own id are not point to point's strip: nothing a rules set
  // writes for a mode replaces the app's five.
  it("never takes a rules set's steps written under the app's id", () => {
    const cuckoo = { exploration: { modes: [{ id: POINT_TO_POINT_ID, name: 'Cuckoo', step: { value: 1, unit: 'turn' }, procedure: [{ id: 'peck', name: 'Peck about' }] }] } };
    expect(procedureInForce({ chain: [], modeId: POINT_TO_POINT_ID, rulesSets: [cuckoo] }).steps).toBe(APP_STEPS);
  });
});

describe("a step's text (mc-55, pf-14a)", () => {
  it('keeps the words or the blocks, and gives none where the pack writes none', () => {
    const [look, bargain] = readStripSteps(rulesSet.procedure);
    expect(look!.text).toBeNull();
    expect(bargain!.text).toBe('Offer something small.');
    expect(readStripSteps(jetty.data.procedure)[0]!.text).toEqual({ blocks: [{ kind: 'p', text: 'Tie off at the posts.' }] });
  });

  it('gives none for blank words', () => {
    expect(readStripSteps([{ id: 'x', name: 'Wait', text: '   ' }])[0]!.text).toBeNull();
  });
});

describe('reading is forgiving', () => {
  it('leaves out a step with no name, numbers a step with no id, and reads anything else as no steps', () => {
    expect(readStripSteps([{ id: 'nameless' }, 'odd', null, { name: 'Wade in' }])).toEqual([{ id: 'step-2', name: 'Wade in', icon: null, text: null }]);
    for (const raw of [undefined, null, 'steps', { steps: [] }, 4]) expect(readStripSteps(raw)).toEqual([]);
  });

  it('passes over a place whose procedure has no step it can read', () => {
    expect(procedureInForce({ chain: [{ data: { procedure: [{ id: 'x' }] } }], modeId: null, rulesSets: [] }).source).toBe('app');
  });
});
