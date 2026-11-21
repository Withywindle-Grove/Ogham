// A check's modifier behind an option (of-4, G-100; design/rulings/m5b-options-format-2026-11-03.md): while the
// option is off, the modifier doesn't apply. Invented rules only.
import { describe, expect, it } from 'vitest';
import { checkPrompt } from './checks.ts';
import { timeUnits } from './clock.ts';
import { modeById, readCheck, readExploration } from './modes.ts';
import { nextStep, type Expedition, type Prompt } from './procedure.ts';

/** An invented lost check: fog adds a face only with the fog-effects option on; a mire adds one always. */
const astray = {
  id: 'wade-astray',
  name: 'Going astray',
  every: { value: 1, unit: 'day' },
  chance: { die: 'd6', on: [1] },
  modifiers: [
    { weatherTag: 'fog', add: 1, onlyWithOption: 'fen-fog-effects' },
    { weatherTag: 'mire', add: 1 },
    { routeType: 'causeway', never: true, option: 'fen-fog-effects=on' },
  ],
  onHit: { note: 'The reeds close in.' },
};

const rules = {
  exploration: {
    modes: [{ id: 'wade', name: 'Wading', step: { value: 1, unit: 'day' }, procedure: [{ id: 'astray', name: 'Going astray?', icon: 'travel', kind: 'check', checkId: 'wade-astray' }], checks: [astray] }],
  },
};

const on = { 'fen-fog-effects': 'on' };
const off = { 'fen-fog-effects': 'off' };

describe('a modifier behind an option (of-4)', () => {
  // Purpose: the modifier keeps its option, written `onlyWithOption` or `option` (the shared reader's spec).
  it('reads onlyWithOption and option on a modifier', () => {
    const check = readCheck(astray)!;
    expect(check.modifiers.map((m) => m.onlyWithOption ?? null)).toEqual(['fen-fog-effects', null, 'fen-fog-effects:on']);
  });

  // Purpose: with the option on, fog adds its face; off, it doesn't, and the prompt doesn't list it.
  it('applies only while the option is on', () => {
    const check = readCheck(astray)!;
    const foggyOn = checkPrompt(check, 'travel', null, { weatherTags: ['fog'], choices: on });
    expect(foggyOn.chance).toEqual({ die: 'd6', on: [1, 2] });
    expect(foggyOn.modifiers.map((m) => m.label)).toEqual(['fog']);
    const foggyOff = checkPrompt(check, 'travel', null, { weatherTags: ['fog'], choices: off });
    expect(foggyOff.chance).toEqual({ die: 'd6', on: [1] });
    expect(foggyOff.modifiers).toEqual([]);
  });

  // Purpose: a modifier with no option always applies, whatever the choices (and with none given).
  it('leaves a modifier without an option alone', () => {
    const check = readCheck(astray)!;
    expect(checkPrompt(check, 'travel', null, { weatherTags: ['mire'], choices: off }).chance).toEqual({ die: 'd6', on: [1, 2] });
    expect(checkPrompt(check, 'travel', null, { weatherTags: ['mire'] }).chance).toEqual({ die: 'd6', on: [1, 2] });
  });

  // Purpose: any modifier kind may sit behind an option: a route that rules the check out does so only while it's on.
  it('gates a route modifier the same way', () => {
    const check = readCheck(astray)!;
    expect(checkPrompt(check, 'travel', null, { routeType: 'causeway', choices: on }).ruledOut).toBe(true);
    expect(checkPrompt(check, 'travel', null, { routeType: 'causeway', choices: off }).ruledOut).toBe(false);
  });

  // Purpose: an option the campaign doesn't have (no choices given) counts as off, as for any gate.
  it('treats a missing choice as off', () => {
    const check = readCheck(astray)!;
    expect(checkPrompt(check, 'travel', null, { weatherTags: ['fog'] }).chance).toEqual({ die: 'd6', on: [1] });
  });

  // Purpose: the procedure's prompts (Next day) read the campaign's choices, so the step's check follows the option.
  it('the procedure passes the campaign choices to the check', () => {
    const exploration = readExploration([rules]);
    const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24, turnsPerHour: 6 });
    const wade = (choices: Record<string, string>): Expedition => ({ rules: exploration, mode: modeById(exploration.modes, 'wade')!, units, startedAt: 0, now: 0, situation: { weatherTags: ['fog'], choices } });
    const chanceOf = (e: Expedition) => (nextStep(e)!.prompts.find((p) => p.kind === 'check' && p.checkId === 'wade-astray') as Extract<Prompt, { kind: 'check' }>).chance;
    expect(chanceOf(wade(on))).toEqual({ die: 'd6', on: [1, 2] });
    expect(chanceOf(wade(off))).toEqual({ die: 'd6', on: [1] });
  });
});
