// @vitest-environment jsdom
// Guided creation walks one list of steps both ways (fix-adjust-scores-skipped; seen by Francis on the live app,
// 2026-11-13). Next leaves Adjust scores out when the class and scores leave no trade to make (cr-3, as
// creationGateBugs.test.tsx holds), but Back from "Who they are" landed on Adjust scores whenever the setting had a
// trade rule: so the step looked skipped on the way forward and was there on the way back. On the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json (rule: lower a non-prime by 2, raise the prime by 1, floor 7, cap 15),
// with an invented patron for the Lantern Warden behind an invented option. Every name and number is invented.
//   For each character, Next from Scores to "Who they are", then Back to Scores, visits the same steps in reverse.
//   Characters: a trade to make and none (the prime typed at the cap), the patron option off and on, a class no
//   patron names and one a patron names (with its Patron step).
// Added on guard-adjust-scores-both-ways (cs-39; the cases the fix's branch could not carry):
//   The reported case: every score 10 under a rule whose floor is 9, so nothing can be lowered and there is no trade.
//   A class that reaches the character through a second pack (the kindred from the first), with a trade and without.
//   To the review and back to the first step: every Back lands where the matching Next left from.
//   Back is found by its exact name ("Back", the step's bar), never the first button whose name has "Back" in it.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

describe('guided creation walks the same steps forward and back (fix-adjust-scores-skipped)', () => {
  type Walker = {
    klass: string;
    prime: { label: string; value: string };
    patronOption: boolean;
    patronFor?: string;
    /** Every score typed on Scores, by its label, before `prime` (which is typed last). */
    scores?: Record<string, string>;
    /** The trade rule's floor, in place of the fixture's 7 (an invented rule like Francis's: nothing under 9). */
    floor?: number;
    /** The classes come from a second pack ("Mire conversion", on top), the kindreds and rules from the first. */
    classesElsewhere?: boolean;
    /** Walk on past "Who they are" to the review, then back from there. */
    toReview?: boolean;
    /** The kindred picked; Bog folk (Nimbleness +1) when not given. Stone kin changes no score. */
    kindred?: string;
  };
  const SIX = ['Muscle', 'Nimbleness', 'Grit', 'Wit', 'Lore', 'Charm'];
  const all = (value: string) => Object.fromEntries(SIX.map((label) => [label, value]));

  /** A campaign on the fixture's rules (and the patron option, on or off), Sam signed in; walks forward then back. */
  async function walkBothWays(w: Walker): Promise<{ forward: string[]; back: string[] }> {
    cleanup();
    forgetFileLinks();
    forgetCampaignSetting();
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    const world = createFakeDb();
    const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, me, 'player');
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
    const entry = (kind: string, data: Record<string, unknown>, packId = 'pack-fen') =>
      world.tables.library_entries.push({ id: `entry-${packId}-${kind}-${String(data.id)}`, pack_id: packId, kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
    const floored = (r: Record<string, unknown>) => (w.floor === undefined ? r : { ...r, abilityAdjustment: { ...(r.abilityAdjustment as Record<string, unknown>), floor: w.floor, note: `Lower a score that isn't your prime by 2 to raise your prime by 1. Nothing goes under ${w.floor}.` } });
    for (const r of pack.rulesSets!) entry('rulesSet', floored(r));
    for (const r of pack.races!) entry('race', r);
    // A second setting's classes brought in by a pack on top, as a conversion brings them (the kindreds stay in the first).
    if (w.classesElsewhere) {
      world.tables.packs.push({ id: 'pack-mire', owner_user_id: gm, campaign_id: null, name: 'Mire conversion', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { id: 'mire-conversion', shortName: 'Mire' } });
      world.tables.campaign_packs.push({ id: 'link-mire', campaign_id: campaign, pack_id: 'pack-mire', pack_name: 'Mire conversion', option_choices: {}, overrides: {}, priority: 2 });
    }
    for (const c of pack.classes!) entry('class', c, w.classesElsewhere ? 'pack-mire' : 'pack-fen');
    entry('option', { id: 'ex-opt-patrons', name: 'Patrons', default: 'off', changeLater: 'allow', choices: [{ id: 'on', name: 'On' }, { id: 'off', name: 'Off' }] });
    entry('patron', { id: 'ex-patron-quiet-lamp', name: 'The Quiet Lamp', option: 'ex-opt-patrons', blurb: 'A light kept low.', followers: { classes: [w.patronFor ?? 'marsh-chaplain'] } });
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: w.patronOption ? { 'ex-opt-patrons': 'on' } : {}, overrides: {}, priority: 1 });
    world.signInAs(me);

    const user = userEvent.setup();
    render(<Root db={world.db} />);
    const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
    const settle = () => new Promise((r) => setTimeout(r, 30));
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await screen.findByRole('heading', { name: /^Scores/ });
    for (const [label, value] of [...Object.entries(w.scores ?? {}), [w.prime.label, w.prime.value] as const]) {
      const field = screen.getByLabelText(label);
      await user.clear(field);
      await user.type(field, value);
    }

    // Forward: Next, a pick where the step asks for one (its Pick moves on), until "Who they are".
    const forward: string[] = [];
    for (let n = 0; n < 10 && heading() !== 'Who they are'; n++) {
      const here = heading();
      forward.push(here);
      if (here === 'Kindred') await user.click(screen.getByRole('checkbox', { name: `Pick ${w.kindred ?? 'Bog folk'}` }));
      else if (here === 'Class') await user.click(screen.getByRole('checkbox', { name: `Pick ${w.klass}` }));
      else if (here === 'Patron') await user.click(screen.getByRole('checkbox', { name: 'Pick The Quiet Lamp' }));
      await settle();
      if (heading() === here) await user.click(screen.getByRole('button', { name: 'Next' }));
      await settle();
    }
    expect(heading()).toBe('Who they are');

    // On to the review: name the character, then each later step put off where it can be (Decide later), else Next.
    if (w.toReview) {
      await user.type(screen.getByLabelText('Name'), 'Tam');
      for (let n = 0; n < 16 && !screen.queryByRole('button', { name: 'Send to the GM' }); n++) {
        forward.push(heading());
        const here = heading();
        await user.click(screen.queryByRole('button', { name: 'Decide later' }) ?? screen.getByRole('button', { name: 'Next' }));
        await settle();
        if (heading() === here && !screen.queryByRole('button', { name: 'Send to the GM' })) await settle();
      }
      expect(screen.getByRole('button', { name: 'Send to the GM' })).toBeTruthy();
    }

    // Back: from "Who they are" (or the review) to Scores, one Back at a time, by the step bar's Back, named exactly.
    const back: string[] = [];
    for (let n = 0; n < 20; n++) {
      await user.click(screen.getByRole('button', { name: 'Back' }));
      await settle();
      back.push(heading());
      if (heading() === forward[0]) break;
    }
    cleanup();
    return { forward, back };
  }

  // Purpose: with no patron step (the option off, or on for a class no patron names), Back retraces Next exactly,
  // with a trade to make and without one (the prime typed at the cap: no Adjust scores either way).
  it('no Patron step: forward and back visit the same steps, with a trade and without', async () => {
    for (const patronOption of [false, true]) {
      for (const value of ['10', '15']) {
        const { forward, back } = await walkBothWays({ klass: 'Lantern Warden', prime: { label: 'Muscle', value }, patronOption });
        expect({ patronOption, value, back }).toEqual({ patronOption, value, back: [...forward].reverse() });
        // With the prime at the cap there is no trade: Adjust scores is in neither walk.
        if (value === '15') expect(forward).not.toContain('Adjust scores');
        else expect(forward).toContain('Adjust scores');
      }
    }
  }, 60_000);

  // Purpose: a class a patron names (the Patron step after Class) and one with none, in a campaign with the option on:
  // Back retraces Next for each, with a trade and without.
  it('a class with a Patron step and one without: forward and back visit the same steps', async () => {
    for (const value of ['10', '15']) {
      const withPatron = await walkBothWays({ klass: 'Lantern Warden', prime: { label: 'Muscle', value }, patronOption: true, patronFor: 'lantern-warden' });
      expect(withPatron.forward).toContain('Patron');
      expect({ value, back: withPatron.back }).toEqual({ value, back: [...withPatron.forward].reverse() });
      const without = await walkBothWays({ klass: 'Mire Stalker', prime: { label: 'Nimbleness', value }, patronOption: true, patronFor: 'lantern-warden' });
      expect(without.forward).not.toContain('Patron');
      expect({ value, back: without.back }).toEqual({ value, back: [...without.forward].reverse() });
    }
  }, 60_000);

  // Purpose (the reported case, cs-39): every score 10 under a rule whose floor is 9, with a kindred that changes no
  // score (Stone kin): nothing can be lowered, so there is no trade; Next skips Adjust scores, and Back from "Who they
  // are" lands on Class, not on Adjust scores; with the patron option on and a patron for this class, on the Patron step.
  it('every score 10, nothing lowerable: Adjust scores is in neither walk, and Back retraces Next', async () => {
    for (const patronOption of [false, true]) {
      const { forward, back } = await walkBothWays({ klass: 'Lantern Warden', kindred: 'Stone kin', prime: { label: 'Muscle', value: '10' }, scores: all('10'), floor: 9, patronOption, ...(patronOption ? { patronFor: 'lantern-warden' } : {}) });
      expect(forward).not.toContain('Adjust scores');
      if (patronOption) expect(forward).toContain('Patron');
      expect(back[0]).toBe(patronOption ? 'Patron' : 'Class');
      expect({ patronOption, back }).toEqual({ patronOption, back: [...forward].reverse() });
    }
    // The same scores under the fixture's floor of 7 leave a trade (10 − 2 = 8): the step is there both ways.
    const tradeable = await walkBothWays({ klass: 'Lantern Warden', kindred: 'Stone kin', prime: { label: 'Muscle', value: '10' }, scores: all('10'), patronOption: false });
    expect(tradeable.forward).toContain('Adjust scores');
    expect(tradeable.back).toEqual([...tradeable.forward].reverse());
  }, 60_000);

  // Purpose: a class that reaches the character through a second pack (the kindred from the first) walks the same
  // steps both ways, with a trade and without (the prime at the cap; and every score 10 under a floor of 9).
  it('a class from a second pack: forward and back visit the same steps, with a trade and without', async () => {
    // Each walk, and whether it has a trade (so Adjust scores is in it).
    const cases: [Walker, boolean][] = [
      [{ klass: 'Lantern Warden', prime: { label: 'Muscle', value: '10' }, patronOption: false, classesElsewhere: true }, true],
      [{ klass: 'Lantern Warden', prime: { label: 'Muscle', value: '15' }, patronOption: false, classesElsewhere: true }, false],
      [{ klass: 'Lantern Warden', kindred: 'Stone kin', prime: { label: 'Muscle', value: '10' }, scores: all('10'), floor: 9, patronOption: true, classesElsewhere: true }, false],
    ];
    for (const [c, trade] of cases) {
      const { forward, back } = await walkBothWays(c);
      expect(forward).toContain('Class');
      if (trade) expect(forward).toContain('Adjust scores');
      else expect(forward).not.toContain('Adjust scores');
      expect({ klass: c.klass, back }).toEqual({ klass: c.klass, back: [...forward].reverse() });
    }
  }, 60_000);

  // Purpose: to the review and back to the first step: every Back lands on the step the matching Next left from; no
  // step appears going back that was skipped going forward, and none is missed. With a trade and without.
  // Found as a fault on guard-adjust-scores-both-ways (2026-11-13: Back on the review opened Gear, and Gear's Back
  // returned to the review, for ever); fixed by fix-review-back-loop (cs-39a, #750).
  it('to the review and back to the start: the same steps in reverse', async () => {
    for (const value of ['10', '15']) {
      const { forward, back } = await walkBothWays({ klass: 'Lantern Warden', prime: { label: 'Muscle', value }, patronOption: false, toReview: true });
      expect(forward).toContain('Who they are');
      expect({ value, back }).toEqual({ value, back: [...forward].reverse() });
    }
  }, 90_000);

  // Purpose (cs-39a, fix-review-back-loop): Back from the review opens the last step as an ordinary step of the walk:
  // its Next returns to the review, and Back from it, after the review's Back again, goes on to the step before it.
  it('after Back from the review, Next returns to the review, and a second Back walks on to the step before', async () => {
    cleanup();
    forgetFileLinks();
    forgetCampaignSetting();
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    const world = createFakeDb();
    const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, me, 'player');
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
    for (const [part, kind] of [['rulesSets', 'rulesSet'], ['races', 'race'], ['classes', 'class']] as const) {
      for (const data of pack[part]!) world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
    }
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
    world.signInAs(me);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
    const settle = () => new Promise((r) => setTimeout(r, 30));
    const onward = async () => {
      await user.click(screen.queryByRole('button', { name: 'Decide later' }) ?? screen.getByRole('button', { name: 'Next' }));
      await settle();
    };
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await screen.findByRole('heading', { name: /^Scores/ });
    // Forward to the review, keeping the steps walked.
    const forward: string[] = [];
    for (let n = 0; n < 24 && !screen.queryByRole('button', { name: 'Send to the GM' }); n++) {
      const here = heading();
      forward.push(here);
      if (here === 'Kindred') await user.click(screen.getByRole('checkbox', { name: 'Pick Bog folk' }));
      else if (here === 'Class') await user.click(screen.getByRole('checkbox', { name: 'Pick Lantern Warden' }));
      else if (here === 'Who they are') await user.type(screen.getByLabelText('Name'), 'Tam');
      await settle();
      if (heading() === here && !screen.queryByRole('button', { name: 'Send to the GM' })) await onward();
    }
    expect(screen.getByRole('button', { name: 'Send to the GM' })).toBeTruthy();
    const last = forward.at(-1)!;
    const beforeLast = forward.at(-2)!;
    // Back from the review: the last step; its Next: the review again.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await settle();
    expect(heading()).toBe(last);
    await onward();
    expect(screen.getByRole('button', { name: 'Send to the GM' })).toBeTruthy();
    // Back from the review, then Back again: the step before the last, never the review.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await settle();
    expect(heading()).toBe(last);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await settle();
    expect(screen.queryByRole('button', { name: 'Send to the GM' })).toBeNull();
    expect(heading()).toBe(beforeLast);
    cleanup();
  }, 60_000);

  // Purpose (cs-39a, #750 review round): in a setting with no steps after "Who they are", review › Back › Who they are ›
  // Next › the review leaves nothing behind: Change › Scores then Back returns to the review, and Change › Who they are
  // reads "From the review", not a step number, as before the walk back. (An invented setting: the fixture's rules
  // without starting money or equipment, no items and no campaign fields, so no Gear, Weapon skills, Languages or traits.)
  it('no steps after Who they are: after the review’s Back and Next, Change still returns to the review', async () => {
    cleanup();
    forgetFileLinks();
    forgetCampaignSetting();
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    const world = createFakeDb();
    const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Still Pool', gm);
    world.addMember(campaign, me, 'player');
    world.tables.packs.push({ id: 'pack-pool', owner_user_id: gm, campaign_id: null, name: 'Still pool rules', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Still pool' } });
    const GEAR_KEYS = ['startingMoney', 'startingEquipment', 'startingPicks'];
    const bare = (rules: Record<string, unknown>) => {
      const out: Record<string, unknown> = { ...rules };
      for (const key of GEAR_KEYS) delete out[key];
      if (out.creation && typeof out.creation === 'object') {
        const creation: Record<string, unknown> = { ...(out.creation as Record<string, unknown>) };
        for (const key of GEAR_KEYS) delete creation[key];
        out.creation = creation;
      }
      return out;
    };
    const add = (kind: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-pool', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
    for (const r of pack.rulesSets!) add('rulesSet', bare(r));
    for (const r of pack.races!) add('race', r);
    for (const c of pack.classes!) add('class', c);
    world.tables.campaign_packs.push({ id: 'link-pool', campaign_id: campaign, pack_id: 'pack-pool', pack_name: 'Still pool rules', option_choices: {}, overrides: {}, priority: 1 });
    world.signInAs(me);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
    const settle = () => new Promise((r) => setTimeout(r, 30));
    const onReview = () => !!screen.queryByRole('button', { name: 'Send to the GM' });
    await user.click(await screen.findByRole('button', { name: /The Still Pool/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await screen.findByRole('heading', { name: /^Scores/ });
    for (let n = 0; n < 12 && !onReview(); n++) {
      const here = heading();
      if (here === 'Kindred') await user.click(screen.getByRole('checkbox', { name: 'Pick Bog folk' }));
      else if (here === 'Class') await user.click(screen.getByRole('checkbox', { name: 'Pick Lantern Warden' }));
      else if (here === 'Who they are') await user.type(screen.getByLabelText('Name'), 'Tam');
      await settle();
      if (heading() === here && !onReview()) await user.click(screen.getByRole('button', { name: 'Next' }));
      await settle();
    }
    // Who they are is the last step: Next from it is the review.
    expect(onReview()).toBe(true);
    // The review's Back: Who they are; its Next: the review again.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await settle();
    expect(heading()).toBe('Who they are');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await settle();
    expect(onReview()).toBe(true);
    // Change › Scores, then Back: the review.
    await user.click(screen.getByRole('button', { name: 'Change Scores' }));
    await screen.findByRole('heading', { name: /^Scores/ });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await settle();
    expect(onReview()).toBe(true);
    // Change › Who they are: "From the review", not a step number, and Back is the review.
    await user.click(screen.getByRole('button', { name: 'Change Who they are' }));
    await screen.findByRole('heading', { name: 'Who they are', level: 1 });
    expect(document.querySelector('.step-counter')?.textContent).toBe('From the review');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await settle();
    expect(onReview()).toBe(true);
    cleanup();
  }, 60_000);

  // Purpose (cs-39a, #750 review round 2): however the review is reached, a step its Change opens returns to it:
  // Change › Scores then Back is the review, and Change › Who they are reads "From the review" (no step number) and
  // its Back is the review. The roads into the review, each checked:
  //   1. Next from the last step (the first walk);
  //   2. Back and forward again (the review's Back, Back to Who they are, then Next through to the review);
  //   3. Change and its finish (Change › Gear, then its own way on to the review);
  //   4. a changed kindred (Back to Kindred, another picked, walked on to the review);
  //   5. that change's Undo (the toast's Undo, after the walk);
  //   6. a setting with no steps after Who they are (the review's Back to Who they are, then its Next).
  it('every road into the review leaves Change returning to it', async () => {
    type Pack = Record<string, Record<string, unknown>[]>;
    const settle = () => new Promise((r) => setTimeout(r, 40));
    const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
    const onReview = () => !!screen.queryByRole('button', { name: 'Send to the GM' });
    /** A campaign on the fixture's rules, kindreds and classes (the rules set as `rules` makes it); Ash signed in. */
    const open = (name: string, rules: (r: Record<string, unknown>) => Record<string, unknown>) => {
      cleanup();
      forgetFileLinks();
      forgetCampaignSetting();
      sessionStorage.clear();
      localStorage.clear();
      window.history.replaceState(null, '', '/');
      const world = createFakeDb();
      const pack = JSON.parse(fixture) as Pack;
      const gm = world.addPerson('priya@lantern.example', 'Priya');
      const me = world.addPerson('ash@lantern.example', 'Ash');
      const campaign = world.addCampaign(name, gm);
      world.addMember(campaign, me, 'player');
      world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
      const add = (kind: string, data: Record<string, unknown>) =>
        world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
      for (const r of pack.rulesSets!) add('rulesSet', rules(r));
      for (const r of pack.races!) add('race', r);
      for (const c of pack.classes!) add('class', c);
      world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
      world.signInAs(me);
      render(<Root db={world.db} />);
      return userEvent.setup();
    };
    /** On, step by step, until the review: a pick where a step asks for one, the name, then Decide later or Next. */
    const onToReview = async (user: ReturnType<typeof userEvent.setup>, kindred = 'Bog folk') => {
      for (let n = 0; n < 24 && !onReview(); n++) {
        const here = heading();
        if (here === 'Kindred') await user.click(screen.getByRole('checkbox', { name: `Pick ${kindred}` }));
        else if (here === 'Class' && screen.queryByRole('checkbox', { name: 'Pick Lantern Warden' })) await user.click(screen.getByRole('checkbox', { name: 'Pick Lantern Warden' }));
        else if (here === 'Who they are' && !(screen.getByLabelText('Name') as HTMLInputElement).value) await user.type(screen.getByLabelText('Name'), 'Tam');
        await settle();
        if (heading() === here && !onReview()) await user.click(screen.queryByRole('button', { name: 'Decide later' }) ?? screen.getByRole('button', { name: 'Next' }));
        await settle();
      }
      expect(onReview()).toBe(true);
    };
    const back = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: 'Back' }));
      await settle();
    };
    /** The check after each road: Change › Scores then Back, and Change › Who they are, return to the review. */
    const changeReturns = async (user: ReturnType<typeof userEvent.setup>, road: string) => {
      expect({ road, review: onReview() }).toEqual({ road, review: true });
      await user.click(screen.getByRole('button', { name: 'Change Scores' }));
      await screen.findByRole('heading', { name: /^Scores/ });
      await back(user);
      expect({ road, after: 'Change › Scores › Back', review: onReview() }).toEqual({ road, after: 'Change › Scores › Back', review: true });
      await user.click(screen.getByRole('button', { name: 'Change Who they are' }));
      await screen.findByRole('heading', { name: 'Who they are', level: 1 });
      expect({ road, counter: document.querySelector('.step-counter')?.textContent }).toEqual({ road, counter: 'From the review' });
      await back(user);
      expect({ road, after: 'Change › Who they are › Back', review: onReview() }).toEqual({ road, after: 'Change › Who they are › Back', review: true });
    };

    const user = open('The Ash Barrows', (r) => r);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await screen.findByRole('heading', { name: /^Scores/ });
    // 1. Next from the last step.
    await onToReview(user);
    await changeReturns(user, '1. Next from the last step');
    // 2. Back and forward again: the review's Back, Back to Who they are, then on to the review.
    await back(user);
    await back(user);
    expect(heading()).toBe('Who they are');
    await onToReview(user);
    await changeReturns(user, '2. Back and forward again');
    // 3. Change and its finish: Change › Gear, then on to the review its own way.
    await user.click(screen.getByRole('button', { name: 'Change Gear' }));
    await screen.findByRole('heading', { name: 'Gear', level: 1 });
    await onToReview(user);
    await changeReturns(user, '3. Change and its finish');
    // 4. A changed kindred: Back to Kindred, Stone kin, on to the review.
    for (let n = 0; n < 8 && heading() !== 'Kindred'; n++) await back(user);
    expect(heading()).toBe('Kindred');
    await onToReview(user, 'Stone kin');
    await changeReturns(user, '4. a changed kindred');
    // 5. Its Undo: the toast's Undo, then on to the review wherever it lands.
    const undo = screen.queryAllByRole('button', { name: 'Undo' }).at(-1);
    expect(undo).toBeTruthy();
    await user.click(undo!);
    await settle();
    await onToReview(user);
    await changeReturns(user, '5. the changed kindred’s Undo');
    // 6. No steps after Who they are: the review's Back to Who they are, then its Next.
    const bare = (rules: Record<string, unknown>) => {
      const out: Record<string, unknown> = { ...rules };
      for (const key of ['startingMoney', 'startingEquipment', 'startingPicks']) delete out[key];
      return out;
    };
    const user6 = open('The Still Pool', bare);
    await user6.click(await screen.findByRole('button', { name: /The Still Pool/ }));
    await user6.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user6.click(await screen.findByRole('button', { name: /^Guided/ }));
    await screen.findByRole('heading', { name: /^Scores/ });
    await onToReview(user6);
    await back(user6);
    expect(heading()).toBe('Who they are');
    await onToReview(user6);
    await changeReturns(user6, '6. no steps after Who they are');
    cleanup();
  }, 120_000);

  // Purpose (cs-39a, after #750's review round 2): the roads into the review the first list missed, each followed by
  // the same check (Change › Scores then Back is the review; Change › Who they are reads "From the review", and its
  // Back is the review). Numbered on from "every road into the review…":
  //   7. Back off the first step of the redo (review › Back › Who they are › Back into the redo › Back to Scores ›
  //      Back off Scores: the redo is cancelled);
  //   8. Undo pressed while the walk back is still going (a changed kindred, then the toast's Undo on Gear, before
  //      the review is up);
  //   9. a changed kindred with nothing after it (a setting with no steps after Who they are);
  //  10. a class changed through Who they are (a campaign that asks for hit points: a new class walks Who they are
  //      first for the new roll).
  it('the other roads into the review leave Change returning to it', async () => {
    type Pack = Record<string, Record<string, unknown>[]>;
    type User = ReturnType<typeof userEvent.setup>;
    const settle = () => new Promise((r) => setTimeout(r, 40));
    const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
    const onReview = () => !!screen.queryByRole('button', { name: 'Send to the GM' });
    /** A campaign on the fixture's rules (as `rules` makes them), kindreds and classes; Ash signed in, creation open. */
    const start = async (name: string, rules: (r: Record<string, unknown>) => Record<string, unknown>, settings: Record<string, unknown> = {}): Promise<User> => {
      cleanup();
      forgetFileLinks();
      forgetCampaignSetting();
      sessionStorage.clear();
      localStorage.clear();
      window.history.replaceState(null, '', '/');
      const world = createFakeDb();
      const pack = JSON.parse(fixture) as Pack;
      const gm = world.addPerson('priya@lantern.example', 'Priya');
      const me = world.addPerson('ash@lantern.example', 'Ash');
      const campaign = world.addCampaign(name, gm);
      world.addMember(campaign, me, 'player');
      Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings });
      world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
      const add = (kind: string, data: Record<string, unknown>) =>
        world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
      for (const r of pack.rulesSets!) add('rulesSet', rules(r));
      for (const r of pack.races!) add('race', r);
      for (const c of pack.classes!) add('class', c);
      world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
      world.signInAs(me);
      render(<Root db={world.db} />);
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: new RegExp(name) }));
      await user.click(await screen.findByRole('button', { name: 'Create your character' }));
      await user.click(await screen.findByRole('button', { name: /^Guided/ }));
      await screen.findByRole('heading', { name: /^Scores/ });
      return user;
    };
    /** On, step by step, until `until` (the review when not given): a pick where a step asks, the name, Decide later or Next. */
    const onTo = async (user: User, { kindred = 'Bog folk', klass = 'Lantern Warden', until = onReview } = {}) => {
      for (let n = 0; n < 24 && !until(); n++) {
        const here = heading();
        if (here === 'Kindred') await user.click(screen.getByRole('checkbox', { name: `Pick ${kindred}` }));
        else if (here === 'Class' && screen.queryByRole('checkbox', { name: `Pick ${klass}` })) await user.click(screen.getByRole('checkbox', { name: `Pick ${klass}` }));
        else if (here === 'Who they are' && !(screen.getByLabelText('Name') as HTMLInputElement).value) await user.type(screen.getByLabelText('Name'), 'Tam');
        await settle();
        if (heading() === here && !until()) await user.click(screen.queryByRole('button', { name: 'Decide later' }) ?? screen.getByRole('button', { name: 'Next' }));
        await settle();
      }
      expect(until()).toBe(true);
    };
    const back = async (user: User) => {
      await user.click(screen.getByRole('button', { name: 'Back' }));
      await settle();
    };
    const backTo = async (user: User, step: string | RegExp) => {
      const at = () => (typeof step === 'string' ? heading() === step : step.test(heading()));
      for (let n = 0; n < 10 && !at(); n++) await back(user);
      expect(at()).toBe(true);
    };
    const changeReturns = async (user: User, road: string) => {
      expect({ road, review: onReview() }).toEqual({ road, review: true });
      await user.click(screen.getByRole('button', { name: 'Change Scores' }));
      await screen.findByRole('heading', { name: /^Scores/ });
      await back(user);
      expect({ road, after: 'Change › Scores › Back', review: onReview() }).toEqual({ road, after: 'Change › Scores › Back', review: true });
      await user.click(screen.getByRole('button', { name: 'Change Who they are' }));
      await screen.findByRole('heading', { name: 'Who they are', level: 1 });
      expect({ road, counter: document.querySelector('.step-counter')?.textContent }).toEqual({ road, counter: 'From the review' });
      await back(user);
      expect({ road, after: 'Change › Who they are › Back', review: onReview() }).toEqual({ road, after: 'Change › Who they are › Back', review: true });
    };
    const bare = (rules: Record<string, unknown>) => {
      const out: Record<string, unknown> = { ...rules };
      for (const key of ['startingMoney', 'startingEquipment', 'startingPicks']) delete out[key];
      return out;
    };

    // 7. Back off the first step of the redo.
    const user = await start('The Ash Barrows', (r) => r);
    await onTo(user);
    await backTo(user, 'Who they are');
    await back(user);
    await backTo(user, /^Scores/);
    await back(user);
    await changeReturns(user, '7. Back off the first step of the redo');
    // 8. Undo while the walk back is still going: a changed kindred, then Undo on Gear, before the review.
    await backTo(user, 'Kindred');
    await onTo(user, { kindred: 'Stone kin', until: () => heading() === 'Gear' });
    const toastOf = (words: RegExp) => [...document.querySelectorAll('.toast')].find((t) => words.test(t.textContent ?? ''));
    const changed = toastOf(/^Race changed/);
    expect(changed).toBeTruthy();
    await user.click(within(changed as HTMLElement).getByRole('button', { name: 'Undo' }));
    await settle();
    await settle();
    expect(toastOf(/Put back as it was/)).toBeTruthy();
    await changeReturns(user, '8. Undo while the walk back is still going');
    // 9. A changed kindred with nothing after it.
    const user9 = await start('The Still Pool', bare);
    await onTo(user9);
    await backTo(user9, 'Kindred');
    await onTo(user9, { kindred: 'Stone kin' });
    await changeReturns(user9, '9. a changed kindred with nothing after it');
    // 10. A class changed through Who they are (the campaign asks for hit points).
    const user10 = await start('The Reed Hall', (r) => r, { hpRequired: true });
    await onTo(user10);
    await backTo(user10, 'Class');
    await onTo(user10, { klass: 'Mire Stalker', until: () => heading() === 'Who they are' });
    // The class change walked Who they are first, for the new roll.
    expect([...document.querySelectorAll('.toast')].some((t) => /^Class changed/.test(t.textContent ?? ''))).toBe(true);
    await onTo(user10, { klass: 'Mire Stalker' });
    await changeReturns(user10, '10. a class changed through Who they are');
    cleanup();
  }, 180_000);
});
