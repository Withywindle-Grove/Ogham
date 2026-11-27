// @vitest-environment jsdom
// The camp card (M5b step 4, build orders 1–4; docs/05 Camp), clicked through against a stand-in database whose camp
// functions are stubbed. Invented rules and items.
//   The camp's steps show in the pack's order, with the campfire, cooking, campfire talk and eating put in D13's place.
//   Add firewood from packs lists the player's own firewood and puts the bundles on with the light type's burning time.
//   Eat suggests a portion from the pot first; a character who ate reads what they ate.
//   The GM sees who hasn't eaten. Campfire talk is It worked / It didn't work.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import type { CampEntry } from '../modules/expedition/camp.ts';
import { whyNoCamp, type CampRow } from '../modules/expedition/campPlay.ts';
import { readExploration } from '../modules/expedition/modes.ts';
import { campaignUnits } from '../modules/expedition/play.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { CampCard } from './CampCard.tsx';
import { WatchesStep } from './CampNight.tsx';
import type { CampaignSetting } from './campaignSetting.ts';
import { campInfo, type CampInfo } from './campView.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

afterEach(() => cleanup());

const rules = {
  id: 'reed-rules',
  name: 'Reedwalk rules',
  time: { roundSeconds: 6, turnMinutes: 10, dayHours: 24 },
  exploration: {
    modes: [
      {
        id: 'roam',
        name: 'Roaming',
        step: { value: 1, unit: 'day' },
        procedure: [],
        camp: {
          procedure: [
            { id: 'setup', name: 'Pitch camp', icon: 'camp', kind: 'note', note: 'Find dry ground.' },
            { id: 'watches', name: 'Set watches', icon: 'watch', kind: 'watches' },
          ],
          fire: { lightTypeId: 'reed-fire' },
          cooking: { portions: 2, bonus: [{ heal: 1 }] },
          sleep: { difficulties: [{ id: 'easy', name: 'Easy', result: 'good' }], rows: [], modifiers: [{ when: 'campfire-talk', add: 1 }] },
        },
      },
    ],
  },
};
const exploration = readExploration([rules]);
const mode = exploration.modes[0]!;
const units = campaignUnits(null, [rules]);
const setting = {
  rulesSets: [rules],
  all: [{ kind: 'lightType', packEntryId: 'reed-fire', data: { id: 'reed-fire', name: 'Reed fire', duration: 2, unit: 'hour', fuelItemId: 'bog-wood' } }],
  items: [{ kind: 'item', packEntryId: 'eel', data: { id: 'eel', name: 'Eel', food: 'fresh' } }],
} as unknown as CampaignSetting;

const player: CurrentUser = { id: 'sam', roles: { camp: 'player' } };
const gmUser: CurrentUser = { id: 'gm', roles: { camp: 'gm' } };
const campaign = { id: 'camp', name: 'The Ash Barrows', role: 'player' as const, line: null };
const camp: CampRow = { id: 'camp-1', campaignId: 'camp', expeditionId: 'exp', group: 1, day: 0, quick: false, fireTypeId: 'reed-fire', fireName: 'Reed fire', fuelItem: 'bog-wood', appliedAt: null, createdBy: 'gm' };
const members = [
  { id: 'reed', name: 'Reed the Ferrywarden', ownerUserId: 'sam' },
  { id: 'moss', name: 'Moss of the Bog Lights', ownerUserId: 'kit' },
];
const line = (id: string, actor: string, entry: string, name: string, qty: number, food?: string) => ({
  id, campaign_id: 'camp', actor_id: actor, location_id: null, name, category: 'gear', stack: 1, qty, item_data: food ? { food } : {}, source_entry_id: entry, approval: 'approved', version: 1,
});
const lines = [line('wood', 'reed', 'bog-wood', 'Bog-wood bundle', 3), line('eel', 'reed', 'eel', 'Eel', 2, 'fresh')];
const entry = (kind: CampEntry['kind'], extra: Partial<CampEntry>): CampEntry => ({ id: `${kind}-${extra.actorId}`, campId: 'camp-1', kind, actorId: 'reed', qty: 0, seconds: 0, at: 0, lineId: null, foodName: null, foodKind: null, fromPot: false, outcome: null, detail: [], createdBy: null, createdAt: '', ...extra });

let rpc: Mock<(name: string, args?: unknown) => Promise<unknown>>;
beforeEach(() => {
  rpc = vi.fn(async () => ({ data: { id: 'entry-1', camp_id: 'camp-1', kind: 'meal', actor_id: 'reed' }, error: null }));
});

function table() {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'in']) chain[m] = () => chain;
  chain.maybeSingle = async () => ({ data: null, error: null });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: lines, error: null });
  return chain;
}

function show(entries: CampEntry[] = [], user: CurrentUser = player) {
  const db = { rpc, from: () => table() } as unknown as Db;
  const info = campInfo({ setting, mode, modes: exploration.modes, units, choices: {}, gm: user === gmUser })!;
  return render(
    <ToastHost>
      <CampCard db={db} user={user} campaign={campaign} groupLabel={null} info={info} camp={camp} entries={entries} members={members} now={0} hour={3600} onChanged={() => undefined} />
    </ToastHost>,
  );
}

describe('the camp card (M5b step 4)', () => {
  it("shows the camp's steps in the pack's order, with the campfire, cooking, talk and eating in their place", () => {
    const { container } = show();
    expect([...container.querySelectorAll('.camp__step > .camp__name')].map((s) => s.textContent)).toEqual(['Pitch camp', 'Campfire', 'Cooking', 'Campfire talk', 'Eat', 'Set watches']);
    expect(screen.getByText('Reed fire, Not lit yet')).toBeTruthy();
    expect(screen.getByText('A portion also gives: Heal 1')).toBeTruthy();
  });

  it("puts the player's own firewood on the fire with the light type's burning time", async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Add firewood from packs' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add firewood from packs' });
    await waitFor(() => expect(within(sheet).getByText('Bog-wood bundle ×3, Reed the Ferrywarden')).toBeTruthy());
    await userEvent.click(within(sheet).getByRole('button', { name: 'More bundles of Bog-wood bundle' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Put on the fire' }));
    expect(rpc).toHaveBeenCalledWith('add_camp_fuel', { camp: 'camp-1', actor: 'reed', line: 'wood', qty: 2, seconds_each: 7200 });
    expect(await screen.findByText('2 bundles on the fire, from Reed the Ferrywarden’s pack')).toBeTruthy();
  });

  it('suggests a portion from the pot first; a character who ate reads what they ate', async () => {
    show([entry('cook', { qty: 2 })]);
    expect(screen.getByText('The pot: 2 of 2 portions left')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Eat' }));
    const sheet = await screen.findByRole('dialog', { name: 'What does Reed the Ferrywarden eat?' });
    await within(sheet).findByText('Eel ×2 (fresh)');
    const choices = within(sheet).getAllByRole('button').filter((b) => b.classList.contains('camp__food'));
    expect(choices.map((b) => b.firstChild?.textContent)).toEqual(['A portion from the pot (cooked)', 'Eel ×2 (fresh)']);
    expect(within(choices[0]!).getByText('Suggested')).toBeTruthy();
    await userEvent.click(choices[0]!);
    expect(rpc).toHaveBeenCalledWith('eat_at_camp', { camp: 'camp-1', actor: 'reed', from_pot: true, line: undefined });
    cleanup();
    show([entry('cook', { qty: 2 }), entry('meal', { actorId: 'reed', fromPot: true, foodKind: 'cooked' })]);
    expect(screen.getByText('✓ Ate a portion')).toBeTruthy();
  });

  it("the GM sees who hasn't eaten; campfire talk is It worked or It didn't work", async () => {
    show([entry('meal', { actorId: 'reed', foodName: 'Eel', foodKind: 'fresh', lineId: 'eel' })], gmUser);
    expect(screen.getByText('Not eaten yet: Moss of the Bog Lights')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Eat' }).length).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'It worked' }));
    expect(rpc).toHaveBeenCalledWith('camp_talk', { camp: 'camp-1', actor: 'reed', outcome: 'worked' });
  });
});

// Part 2 (watches and sleep): a camp whose procedure has the watches and a sleep step with a good rest's heal.
const nightRules = {
  ...rules,
  exploration: {
    modes: [
      {
        ...rules.exploration.modes[0]!,
        camp: {
          procedure: [
            { id: 'watches', name: 'Set watches', icon: 'watch', kind: 'watches', watchLength: { value: 2, unit: 'hour' } },
            { id: 'sleep', name: 'Sleep', icon: 'rest', kind: 'roll', onGoodRest: [{ heal: 1 }] },
          ],
          sleep: { difficulties: [{ id: 'easy', name: 'Easy', result: 'good' }, { id: 'hard', name: 'Hard', result: 'check', add: -1 }], rows: [{ fire: true, difficulty: 'easy' }, { difficulty: 'hard' }], checkAbility: 'WIS' },
        },
      },
    ],
  },
};
const nightExploration = readExploration([nightRules]);

function showNight(entries: CampEntry[] = [], user: CurrentUser = player, forcedMarch = false) {
  const db = { rpc, from: () => table() } as unknown as Db;
  const info = campInfo({ setting: { ...setting, rulesSets: [nightRules] } as CampaignSetting, mode: nightExploration.modes[0]!, modes: nightExploration.modes, units, choices: {}, gm: user === gmUser })!;
  const hurt = members.map((m) => ({ ...m, hpCurrent: 3, hpMax: 8 }));
  return render(
    <ToastHost>
      <CampCard db={db} user={user} campaign={campaign} groupLabel={null} info={info} camp={camp} entries={entries} members={hurt} now={0} hour={3600} forcedMarch={forcedMarch} onChanged={() => undefined} />
    </ToastHost>,
  );
}

describe('the camp card at night (M5b step 4, part 2)', () => {
  // Purpose: + Add on a watch's box lists only who's free, and one tap puts them on that watch (the order is sent whole).
  it("puts a character on a watch from its box's + Add, listing who's free; the order is sent whole", async () => {
    showNight();
    expect(screen.getByText("Each watch: 2 hours, the night's length is the GM's call")).toBeTruthy();
    expect(screen.getByText('Reed the Ferrywarden, not on watch')).toBeTruthy();
    expect(screen.getByText('Not on watch: Reed the Ferrywarden, Moss of the Bog Lights')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Add to the 1st watch' }));
    const sheet = within(screen.getByRole('dialog', { name: 'Add to the 1st watch' }));
    expect(sheet.getByRole('button', { name: 'Reed the Ferrywarden' })).toBeTruthy();
    expect(sheet.getByRole('button', { name: 'Moss of the Bog Lights' })).toBeTruthy();
    await userEvent.click(sheet.getByRole('button', { name: 'Reed the Ferrywarden' }));
    expect(rpc).toHaveBeenCalledWith('set_camp_watches', { camp: 'camp-1', actor: 'reed', watches: [['reed']] });
  });

  // Purpose: a name's ✕ on a watch takes only that one off, and the rest of the order is sent whole.
  it("takes someone off a watch with the ✕ on their name; the box shows the others and who's off watch", async () => {
    showNight([entry('watches', { actorId: 'reed', watches: [['reed', 'moss']] })]);
    const first = within(screen.getByRole('listitem', { name: '1st watch' }));
    expect(first.getByText('Reed the Ferrywarden')).toBeTruthy();
    expect(screen.getByText('Reed the Ferrywarden, your watch: 1st')).toBeTruthy();
    expect(screen.getByText('Everyone is on a watch')).toBeTruthy();
    await userEvent.click(first.getByRole('button', { name: 'Take Moss of the Bog Lights off the 1st watch' }));
    expect(rpc).toHaveBeenCalledWith('set_camp_watches', { camp: 'camp-1', actor: 'reed', watches: [['reed']] });
  });

  it('shows the sleep difficulty and the check, and records Slept well with the roll', async () => {
    showNight();
    expect(screen.getByText('Reed the Ferrywarden, Hard')).toBeTruthy();
    expect(screen.getByText('Roll WIS, −1 Hard')).toBeTruthy();
    await userEvent.type(screen.getByRole('textbox', { name: "Reed the Ferrywarden’s roll" }), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Slept well' }));
    expect(rpc).toHaveBeenCalledWith('camp_sleep', { camp: 'camp-1', actor: 'reed', difficulty: undefined, roll: '5', outcome: 'good' });
  });

  // Purpose: a force-marched group's Sleep step says its rest is due (SC-4-3 A); a group that didn't march sees no such line.
  it('says "Rest due (forced march)" in the Sleep step only after a forced march', () => {
    showNight([], player, true);
    expect(screen.getByText('Rest due (forced march)')).toBeTruthy();
    cleanup();
    showNight();
    expect(screen.queryByText('Rest due (forced march)')).toBeNull();
  });

  it('after a good rest offers the heal, never applying it by itself; the GM can change the difficulty', async () => {
    showNight([entry('sleep', { actorId: 'reed', outcome: 'good' })]);
    expect(screen.getByText('✓ Slept well')).toBeTruthy();
    expect(screen.getByText('A good rest: heal 1 HP to:')).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
    cleanup();
    showNight([], gmUser);
    await userEvent.click(within(screen.getByRole('group', { name: "How hard is Moss of the Bog Lights’ sleep?" })).getByRole('button', { name: 'Easy' }));
    expect(rpc).toHaveBeenCalledWith('camp_sleep', { camp: 'camp-1', actor: 'moss', difficulty: 'easy', roll: undefined, outcome: undefined });
  });
});

// The Watches step on its own (fl-3): four watches of 2 hours from 18:00, five characters, Fern a caster.
describe('the Watches step by watch (fl-3)', () => {
  const five = ['Ash', 'Bram', 'Fern', 'Moss', 'Reed'].map((name) => ({ id: name.toLowerCase(), name, ownerUserId: 'sam' }));
  const fourWatches = { night: { watchMinutes: 120, minutes: 480, watches: 4, startsAt: 18 * 60, dayMinutes: 1440 } } as unknown as CampInfo;
  const step = (watches: string[][], onSet: (next: string[][] | 'full') => void, order?: string[]) =>
    render(<WatchesStep info={fourWatches} members={five} mine={five} watches={watches} casters={new Set(['fern'])} order={order} onSet={onSet} />);

  // Purpose: a full watch (3) hides its + Add; a watch with room keeps it; only the first empty watch takes names.
  it('hides + Add on a full watch; an empty watch after the first empty one waits for it', () => {
    step([['ash', 'bram', 'fern'], ['moss']], () => undefined);
    expect(screen.queryByRole('button', { name: 'Add to the 1st watch' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add to the 2nd watch' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add to the 3rd watch' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to the 4th watch' })).toBeNull();
    expect(within(screen.getByRole('listitem', { name: '4th watch' })).getByText('No one yet, fill the 3rd first')).toBeTruthy();
    expect(within(screen.getByRole('listitem', { name: '1st watch' })).getByText('18:00–20:00')).toBeTruthy();
    expect(screen.getByText('Not on watch: Reed')).toBeTruthy();
    expect(screen.getByText('Casters on watch: Fern')).toBeTruthy();
  });

  // Purpose: + Add lists only the characters on no watch, in marching order.
  it("+ Add lists only who's free, in marching order", async () => {
    step([['ash']], () => undefined, ['reed', 'ash', 'moss', 'bram', 'fern']);
    await userEvent.click(screen.getByRole('button', { name: 'Add to the 1st watch' }));
    const sheet = within(screen.getByRole('dialog', { name: 'Add to the 1st watch' }));
    expect(sheet.queryByRole('button', { name: 'Ash' })).toBeNull();
    const names = sheet.getAllByRole('button').map((b) => b.textContent ?? '').filter((t) => ['Reed', 'Moss', 'Bram', 'Fern'].includes(t));
    expect(names).toEqual(['Reed', 'Moss', 'Bram', 'Fern']);
  });

  // Purpose: Split evenly fills every watch in marching order and keeps the caster off the last watch.
  it('Split evenly fills the watches in marching order, the caster off the last', async () => {
    const onSet = vi.fn();
    step([], onSet, ['reed', 'ash', 'moss', 'bram', 'fern']);
    expect(screen.getByText('5 characters → 4 watches, in marching order')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Split evenly' }));
    expect(onSet).toHaveBeenCalledWith([['reed', 'ash'], ['moss'], ['fern'], ['bram']]);
  });

  // Purpose: with the pack's watches known, Split evenly doesn't ask how many (bq3-4 asks only when the pack doesn't say).
  it("doesn't ask how many watches when the pack gives the night's watches", () => {
    step([], () => undefined);
    expect(screen.queryByRole('group', { name: 'How many watches tonight?' })).toBeNull();
  });
});

// The Watches step with no night's length (bq3-4 C, 2026-11-04), as on the fixture pack's Fen trek (no daylight table).
describe("the Watches step with no night's length (bq3-4)", () => {
  const five = ['Ash', 'Bram', 'Fern', 'Moss', 'Reed'].map((name) => ({ id: name.toLowerCase(), name, ownerUserId: 'sam' }));
  const unknownNight = { night: { watchMinutes: 120, minutes: null, watches: null, startsAt: null, dayMinutes: 1440 } } as unknown as CampInfo;
  const step = (watches: string[][], onSet: (next: string[][] | 'full') => void) =>
    render(<WatchesStep info={unknownNight} members={five} mine={five} watches={watches} casters={new Set()} order={['ash', 'bram', 'fern', 'moss', 'reed']} onSet={onSet} />);

  // Purpose: Split evenly isn't hidden: it asks "How many watches tonight?" (starting at 3), then splits into that many.
  it('asks how many watches tonight, then splits the characters across that many', async () => {
    const onSet = vi.fn();
    step([], onSet);
    const count = within(screen.getByRole('group', { name: 'How many watches tonight?' }));
    expect(count.getByText('3')).toBeTruthy();
    expect(screen.getByText('5 characters → 3 watches, in marching order')).toBeTruthy();
    await userEvent.click(count.getByRole('button', { name: 'More watches tonight' }));
    expect(screen.getByText('5 characters → 4 watches, in marching order')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Split evenly' }));
    expect(onSet).toHaveBeenCalledWith([['ash', 'bram'], ['fern'], ['moss'], ['reed']]);
  });

  // Purpose: the count starts at the watches already set, so a second split keeps the group's number.
  it('starts at the number of watches already set', () => {
    step([['ash'], ['bram']], () => undefined);
    expect(within(screen.getByRole('group', { name: 'How many watches tonight?' })).getByText('2')).toBeTruthy();
  });

  // Purpose: a count that would leave a watch empty or hold more than 3 can't be picked, but the step stays tappable
  // and a pop-up says why (never a disabled button).
  it('explains why past the limits: no more watches than characters, none over 3', async () => {
    step([], () => undefined);
    const count = within(screen.getByRole('group', { name: 'How many watches tonight?' }));
    const more = count.getByRole('button', { name: 'More watches tonight' });
    await userEvent.click(more);
    await userEvent.click(more);
    expect(count.getByText('5')).toBeTruthy();
    expect((more as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(more);
    expect(within(screen.getByRole('dialog', { name: 'How many watches tonight?' })).getByText('At most 5 watches: each watch needs someone on it, and there are 5 characters.')).toBeTruthy();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    const less = count.getByRole('button', { name: 'Less watches tonight' });
    for (let i = 0; i < 3; i++) await userEvent.click(less);
    expect(count.getByText('2')).toBeTruthy();
    await userEvent.click(less);
    expect(within(screen.getByRole('dialog', { name: 'How many watches tonight?' })).getByText('At least 2 watches: up to 3 on each, for 5 characters.')).toBeTruthy();
  });
});

// Make camp, blocked (plan scene-point-to-point B18; p2p-23; its ⚑ 7 ruled 2026-11-18: the pop-up is the rule, the
// database refuses nothing). The words of the pop-up; the tent's own tap is clicked through in sceneTools.test.tsx.
describe('why Make camp is blocked (B18)', () => {
  // Purpose: with nothing waiting, at a place the pack doesn't mark, nothing blocks a camp.
  it('nothing blocks a camp with no encounter waiting and no mark', () => {
    expect(whyNoCamp({ encountersWaiting: 0, noCampAt: null })).toBeNull();
  });

  // Purpose: while an encounter waits the pop-up is titled as the button and says so, and where to deal with it.
  it('one encounter waiting: says so and where to answer it', () => {
    expect(whyNoCamp({ encountersWaiting: 1, noCampAt: null })).toEqual({ title: 'Make camp', words: 'An encounter is waiting. Start it or dismiss it under Waiting for you, then make camp.' });
  });

  // Purpose: with several waiting, the count is given and the words agree with it.
  it('several waiting: the count, in the plural', () => {
    expect(whyNoCamp({ encountersWaiting: 3, noCampAt: null })?.words).toBe('3 encounters are waiting. Start or dismiss them under Waiting for you, then make camp.');
  });

  // Purpose: at a Location the pack marks "no camp here" the pop-up has its own words, naming the place and what to do.
  it('a Location marked "no camp here": its own words, naming the place', () => {
    expect(whyNoCamp({ encountersWaiting: 0, noCampAt: 'The Wreck' })).toEqual({ title: 'Make camp', words: 'The adventure pack says there is no camp at The Wreck. Move on, then make camp.' });
  });

  // Purpose: with both, the waiting encounter is said first: it is the one thing the GM can clear where they stand.
  it('both at once: the waiting encounter is said', () => {
    expect(whyNoCamp({ encountersWaiting: 1, noCampAt: 'The Wreck' })?.words).toMatch(/^An encounter is waiting\./);
  });

  // Purpose (the review of #1020): what the app has not read yet is not "nothing". While either read is still coming,
  // the pop-up says it is still reading and to try again in a moment.
  it('still reading: says so, and to try again in a moment', () => {
    expect(whyNoCamp({ encountersWaiting: 0, noCampAt: null, unread: 'reading' })).toEqual({ title: 'Make camp', words: 'Still reading what is waiting here. Try again in a moment.' });
  });

  // Purpose (the review of #1020): a read that failed is not "nothing" either: the pop-up says it couldn't read, in
  // the app's usual words for a lost connection.
  it('a read that failed: says it could not read, and to check the connection', () => {
    expect(whyNoCamp({ encountersWaiting: 0, noCampAt: null, unread: 'failed' })).toEqual({ title: 'Make camp', words: "Couldn't read what is waiting here. Check your connection and try again." });
  });

  // Purpose: what is known for sure is said before what is not: an encounter known to wait, or a mark that was read,
  // is the reason given even while the other read is missing.
  it('a known reason is said before a missing read', () => {
    expect(whyNoCamp({ encountersWaiting: 2, noCampAt: null, unread: 'failed' })?.words).toMatch(/^2 encounters are waiting\./);
    expect(whyNoCamp({ encountersWaiting: 0, noCampAt: 'The Wreck', unread: 'reading' })?.words).toMatch(/no camp at The Wreck/);
  });

  // Purpose: a very long place name is given whole, never cut, so the GM reads which place it is.
  it('a long name is given whole', () => {
    const long = 'The Long Stair of the Drowned Customs House below the Old Lantern, seaward side';
    expect(whyNoCamp({ encountersWaiting: 0, noCampAt: long })?.words).toContain(long);
  });
});
