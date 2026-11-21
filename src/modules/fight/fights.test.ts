import { describe, expect, it } from 'vitest';
import { NO_FIGHTS, applyFightStep, pauseFight, resumeFight, startAndRun, type Fights } from './fights.ts';
import { INDIVIDUAL_RULES, SIDE_RULES, lurker, skirmish, warden } from './fixtures.ts';

function must<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error((r as { reason?: string }).reason);
  return r as Extract<T, { ok: true }>;
}

describe('several fights', () => {
  // A paused fight is unchanged by time passing in the other fight; a step sent to it is refused.
  it('a paused fight keeps everything while the other runs, and refuses steps', () => {
    let state: Fights = must(startAndRun(NO_FIGHTS, skirmish(SIDE_RULES, { id: 'fight-a' }))).fights;
    state = must(applyFightStep(state, 'fight-a', { kind: 'set-winner', winner: 'party' })).fights;
    state = must(applyFightStep(state, 'fight-a', { kind: 'end-side-turn', side: 'party' })).fights;
    const a = state.fights['fight-a']!;
    state = must(startAndRun(state, skirmish(INDIVIDUAL_RULES, { id: 'fight-b', partyGroupId: 'group-2', foes: [warden(1)] }))).fights;
    expect(state.running).toBe('fight-b');
    expect(state.fights['fight-a']).toEqual({ ...a, paused: true });
    for (let i = 0; i < 3; i++) state = must(applyFightStep(state, 'fight-b', { kind: 'next-round' })).fights;
    expect(state.fights['fight-b']!.round).toBe(4);
    expect(state.fights['fight-a']).toEqual({ ...a, paused: true });
    expect(applyFightStep(state, 'fight-a', { kind: 'end-side-turn', side: 'foes' })).toEqual({ ok: false, reason: 'This fight is paused: resume it first.' });
    expect(applyFightStep(state, 'nowhere', { kind: 'next-round' })).toMatchObject({ ok: false });
  });

  // Resuming a fight pauses the one being run, and the resumed fight goes on exactly where it was.
  it('resuming one pauses the other and goes on where it left off', () => {
    let state: Fights = must(startAndRun(NO_FIGHTS, skirmish(SIDE_RULES, { id: 'fight-a' }))).fights;
    state = must(applyFightStep(state, 'fight-a', { kind: 'set-winner', winner: 'foes' })).fights;
    state = must(applyFightStep(state, 'fight-a', { kind: 'end-side-turn', side: 'foes' })).fights;
    state = must(startAndRun(state, skirmish(SIDE_RULES, { id: 'fight-b', partyGroupId: 'group-2', foes: [lurker(1)] }))).fights;
    expect(resumeFight(state, 'fight-b')).toMatchObject({ ok: false });
    state = must(resumeFight(state, 'fight-a')).fights;
    expect(state.running).toBe('fight-a');
    expect(state.fights['fight-b']!.paused).toBe(true);
    expect(state.fights['fight-a']).toMatchObject({ paused: false, round: 1, turnsDone: ['foes'], sideOrder: ['foes', 'party'] });
    state = must(applyFightStep(state, 'fight-a', { kind: 'end-side-turn', side: 'party' })).fights;
    expect(state.fights['fight-a']!.round).toBe(2);
    expect(resumeFight(state, 'nowhere')).toMatchObject({ ok: false });
  });

  // Pausing the fight being run leaves nothing running; an ended fight can't be resumed.
  it('pausing leaves nothing running; an ended fight stays ended', () => {
    let state: Fights = must(startAndRun(NO_FIGHTS, skirmish(SIDE_RULES, { id: 'fight-a' }))).fights;
    state = must(pauseFight(state, 'fight-a')).fights;
    expect(state.running).toBeNull();
    expect(pauseFight(state, 'fight-a')).toMatchObject({ ok: false });
    state = must(resumeFight(state, 'fight-a')).fights;
    state = must(applyFightStep(state, 'fight-a', { kind: 'end-fight' })).fights;
    expect(resumeFight(state, 'fight-a')).toMatchObject({ ok: false, reason: 'That fight has ended.' });
    expect(startAndRun(state, skirmish(SIDE_RULES, { id: 'fight-a' }))).toMatchObject({ ok: false });
  });
});
