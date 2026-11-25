// @vitest-environment jsdom
// The GM's view as the player shows the player's numbers and words, his acts there run as his, and the player-only
// buttons explain (page 32, M3c, M3e, M3f, M3f2, M3h, M3j; approved 2026-11-21; rows C15c and C15d of
// plans/test-feedback-2026-11-19.md). Against P1's Brannoch (Sam's), on the stand-in database. Invented names only.
//   Purpose:
//   1. With an invented cursed spear that reads one figure to its player and a worse one in truth, the GM's view of the
//      Player tab shows the player's figure and nothing else of it, as the player's own tab does (pg32-3, M3e).
//   2. For a character with a hidden field and a status with a secret timer, the Player tab's words in the GM's view
//      equal the player's own: no hidden field, no secret time left, no "+ Status" (pg32-3, M3c).
//   3. The GM's act in the view (hit points) happens at once with the player's toast and Undo, logged as the GM's.
//   4. The GM pins, moves a pin and unpins in the view, each logged as his and each undone by Undo (pg32-9).
//   5. "Take back" in the notices opens "Only Sam can take back this change" with M3f's line, writes no event, and
//      "Go to Waiting for approval" (before "Got it"; the place its words name, audit fix 1) leaves the view for Players
//      at the change waiting (pg32-6).
//   6. The pure words: M3f2's eight pop-ups, word for word; the three that point somewhere, and only those, each naming
//      the place its words name.
//   7. Inside the view of a player's character a player-only button opens its pop-up; on the GM's own character, or
//      outside the view, none opens and the button acts (pg32-7c).
//   8. Cancel on a request, and the answers to the GM's offer, open their pop-ups and write nothing; Cancel's "Go to
//      Waiting for you" names the request.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { addP1Character, P1_CAMPAIGN, P1_CHARACTER } from '../testing/layoutP1Character.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { BookPopUpScope } from '../ui/Dialog.tsx';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { playerOnlyWords, usePlayerOnly, type PlayerOnlyAct } from './playerOnly.tsx';
import { PlayerViewContext, type PlayerView } from './playerView.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let gm: string;
let sam: string;
let brannoch: string;

const fenPack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type User = ReturnType<typeof userEvent.setup>;
const campaignId = () => world.tables.campaigns[0]!.id as string;

/** Brannoch as `head` makes him; `change` adjusts the world before anyone signs in. */
async function setUp(head: Parameters<typeof addP1Character>[1]['head'] = 'four', change: () => void = () => undefined) {
  brannoch = await addP1Character(world, { gm, sam, fenPack, head });
  change();
}

/** Sam's own Player tab. */
async function asSam(): Promise<User> {
  world.signInAs(sam);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
  await screen.findByRole('region', { name: 'Vitals' });
  return user;
}

/** The GM's view of Brannoch's Player tab, from the Players row's View sheet. */
async function inGmView(): Promise<User> {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
  await user.click(await screen.findByRole('button', { name: `View ${P1_CHARACTER}'s sheet` }));
  await screen.findByRole('region', { name: 'Vitals' });
  await waitFor(() => expect(screen.getByRole('note').getAttribute('aria-label')).toMatch(/^Sam’s view of /));
  return user;
}

/** The to-hit line of the weapon in hand. */
async function toHit(): Promise<string> {
  const block = await screen.findByRole('region', { name: 'Weapon in hand' });
  const hit = await waitFor(() => {
    const line = [...block.querySelectorAll('.weapon-in-hand__roll')].map((li) => li.textContent ?? '')[0];
    expect(line).toMatch(/to hit$/);
    return line!;
  });
  return hit;
}

/** A region's words, settled. */
const wordsOf = async (name: string) => {
  const region = await screen.findByRole('region', { name });
  await new Promise((r) => setTimeout(r, 30));
  return region.textContent ?? '';
};

describe('the player’s numbers in the GM’s view (C15c; pg32-3)', () => {
  it('shows the cursed spear as its player reads it, with nothing of its truth', async () => {
    await setUp('four', () => {
      // An invented curse on the spear in hand: a worse bonus its player never sees (bonusHidden: cursed).
      // A one-off line (no pack to follow, fp-1), so its own weapon data counts.
      const spear = world.tables.inventory_lines.find((l) => l.id === 'line-p1-spear')!;
      const data = spear.item_data as Record<string, unknown>;
      Object.assign(spear, { source_pack_id: null, source_entry_id: null, item_data: { ...data, cursed: true, weapon: { ...(data.weapon as Record<string, unknown>), magicBonus: -4 } } });
    });
    await asSam();
    const sams = await toHit();
    // Sam's figure leaves the curse out (as built: bonusHidden), so it reads 4 better than the truth.
    const [, sign, n] = /^d20 ([+−])(\d+) to hit$/.exec(sams)!;
    const truth = (sign === '−' ? -Number(n) : Number(n)) - 4;
    cleanup();
    await inGmView();
    expect(await toHit()).toBe(sams);
    expect(await toHit()).not.toBe(`d20 ${truth < 0 ? '−' : '+'}${Math.abs(truth)} to hit`);
    expect(document.body.textContent).not.toMatch(/hidden from the player/);
  });

  it('shows the Player tab’s words as the player’s: no hidden field, no secret time left, no + Status', async () => {
    await setUp('four', () => {
      // A field only the GM sees, with a value, and a secret timer on one status.
      world.tables.field_definitions.push({ id: 'field-p1-curse', campaign_id: campaignId(), applies_to: 'pc', key: 'curse', label: 'Drowned oath', type: 'text', choices: [], field_group: '', sort_order: 99, show_on_card: false, hidden: true, fill: null, required: false, from_list: null, created_at: '2026-11-15T12:00:00Z' });
      const actor = world.tables.actors.find((a) => a.id === brannoch)!;
      actor.fields = { ...(actor.fields as Record<string, unknown>), curse: 'Sworn to the bog' };
      Object.assign(world.tables.character_statuses.find((s) => s.id === 'status-p1-chilled')!, { secret: true });
    });
    await asSam();
    const vitals = await wordsOf('Vitals');
    const head = document.querySelector('.char-statuses')?.textContent ?? '';
    cleanup();
    await inGmView();
    expect(await wordsOf('Vitals')).toBe(vitals);
    await waitFor(() => expect(document.querySelector('.char-statuses')?.textContent ?? '').toBe(head));
    expect(screen.queryByText('Drowned oath')).toBeNull();
    expect(screen.queryByText('Sworn to the bog')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add a status to/ })).toBeNull();
  });

  it('runs the GM’s act at once with the player’s toast and Undo, logged as his', async () => {
    await setUp();
    const user = await inGmView();
    const before = world.tables.events.length;
    await user.click(screen.getByRole('button', { name: 'Take 1 damage' }));
    const toast = await screen.findByRole('button', { name: 'Undo' });
    await waitFor(() => expect(world.tables.actors.find((a) => a.id === brannoch)!.hp_current).toBe(10));
    const written = world.tables.events.slice(before);
    expect(written.length).toBeGreaterThan(0);
    expect(written.every((e) => e.actor_user_id === gm)).toBe(true);
    await user.click(toast);
    await waitFor(() => expect(world.tables.actors.find((a) => a.id === brannoch)!.hp_current).toBe(11));
  });

  // A move has no Undo toast on the player's own screen either (pg32-9: "as on Sam's screen"); pin and unpin do.
  it('lets the GM move, unpin and pin in the view, each logged as his; unpin and pin undone by Undo', async () => {
    await setUp('pins');
    const user = await inGmView();
    const pins = () => world.tables.character_play.find((p) => p.actor_id === brannoch)!.pins;
    const list = await screen.findByRole('region', { name: 'Abilities and traits' });
    const entryOf = async (name: RegExp, title: string) => {
      await user.click(await within(list).findByRole('button', { name }));
      return screen.findByRole('dialog', { name: title });
    };
    // Move: Steady flame up, above Oath of light.
    let before = world.tables.events.length;
    await user.click(within(await entryOf(/^Steady flame, pinned/, 'Steady flame')).getByRole('button', { name: 'Move up' }));
    await waitFor(() => expect(pins()).toEqual([{ kind: 'trait', key: 'Steady flame' }, { kind: 'trait', key: 'Oath of light' }]));
    expect(world.tables.events.slice(before).map((e) => e.actor_user_id)).toEqual([gm]);
    // Unpin from the entry's star, then Undo.
    await user.click(within(screen.getByRole('dialog', { name: 'Steady flame' })).getByRole('button', { name: 'Close' }));
    before = world.tables.events.length;
    await user.click(within(await entryOf(/^Oath of light, pinned/, 'Oath of light')).getByRole('button', { name: 'Unpin' }));
    await waitFor(() => expect(pins()).toEqual([{ kind: 'trait', key: 'Steady flame' }]));
    expect(world.tables.events.slice(before).map((e) => e.actor_user_id)).toEqual([gm]);
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(pins()).toHaveLength(2));
    // Unpinned again, then pinned from the same star, then Undo.
    await user.click(within(screen.getByRole('dialog', { name: 'Oath of light' })).getByRole('button', { name: 'Unpin' }));
    await waitFor(() => expect(pins()).toHaveLength(1));
    before = world.tables.events.length;
    await user.click(await within(screen.getByRole('dialog', { name: 'Oath of light' })).findByRole('button', { name: 'Pin to top' }));
    await waitFor(() => expect(pins()).toHaveLength(2));
    expect(world.tables.events.slice(before).map((e) => e.actor_user_id)).toEqual([gm]);
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(pins()).toHaveLength(1));
  });
});

describe('a hidden charge count in the view (C15c)', () => {
  // Purpose: with a wand whose charges are hidden from Sam pinned to At hand, no part of the view's Player tab that is
  // this batch's shows its count. At hand's own row is C15e's (ItemRow.tsx), fixed when #34 lands, so it is left out.
  it('shows the hidden count nowhere outside At hand', async () => {
    await setUp('modes', () => Object.assign(world.tables.inventory_lines.find((l) => l.id === 'line-p1-wand')!, { charges_hidden: true, charges_left: 7 }));
    await inGmView();
    await screen.findByRole('region', { name: 'At hand' });
    await new Promise((r) => setTimeout(r, 30));
    const main = document.querySelector('.player') as HTMLElement;
    const outside = [...main.querySelectorAll('section, [role="region"]')]
      .filter((el) => el.getAttribute('aria-label') !== 'At hand' && !el.closest('[aria-label="At hand"]') && !el.querySelector('[aria-label="At hand"]'))
      .map((el) => el.textContent ?? '')
      .join(' ');
    expect(outside).not.toMatch(/\b7 (left|charges)/);
  });
});

describe('Set max in the view (⚑ 42, ruled 2026-11-21)', () => {
  // Purpose: in the view the GM's Set max writes at once, as his own change does outside it, logged as his: no request
  // for Sam's approval, no "Only Sam can …" pop-up.
  it('writes the most hit points at once, logged as the GM’s, with no request', async () => {
    await setUp('four', () => Object.assign(world.tables.actors.find((a) => a.id === brannoch)!, { hp_max: null }));
    const user = await inGmView();
    await user.click(await screen.findByRole('button', { name: 'Set max' }));
    const pop = await screen.findByRole('dialog', { name: 'Max hit points' });
    await user.type(within(pop).getByLabelText('Max HP'), '18');
    const before = world.tables.events.length;
    await user.click(within(pop).getByRole('button', { name: 'Set' }));
    await waitFor(() => expect(world.tables.actors.find((a) => a.id === brannoch)!.hp_max).toBe(18));
    expect(world.tables.events.slice(before).map((e) => e.actor_user_id)).toEqual([gm]);
    expect(world.tables.sheet_changes).toEqual([]);
    expect(screen.queryByRole('dialog', { name: /^Only Sam can/ })).toBeNull();
  });
});

describe('the GM’s Cast in the view (C15c; M3h)', () => {
  // Purpose: the GM's Cast on the Magic tab of his view acts at once, with the player's toast and Undo, logged as his.
  it('casts at once with Undo, logged as the GM’s', async () => {
    const campaign = world.addCampaign('The Reed Marches', gm);
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push(
      { id: 'entry-rules', pack_id: 'pack-fen', kind: 'rulesSet', pack_entry_id: 'fen-rules', name: 'Fen rules', data: { id: 'fen-rules', name: 'Fen rules' } },
      { id: 'entry-witch', pack_id: 'pack-fen', kind: 'class', pack_entry_id: 'reed-witch', name: 'Reed witch', data: { id: 'reed-witch', name: 'Reed witch', spellcasting: { listId: 'witch-list', type: 'arcane', castingType: 'arcane' }, progression: [{ level: 1, hitDice: '1d4', spellSlots: [2] }] } },
      { id: 'entry-lamp', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'mire-lamp', name: 'Mire lamp', data: { id: 'mire-lamp', name: 'Mire lamp', range: '30 paces' } },
      { id: 'entry-list', pack_id: 'pack-fen', kind: 'spellList', pack_entry_id: 'witch-list', name: 'Witch spells', data: { id: 'witch-list', name: 'Witch spells', levels: [{ level: 1, spells: ['mire-lamp'] }] } },
    );
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 1, hp_current: 4, hp_max: 4, classes: [{ classRef: 'reed-witch', level: 1, xp: 0 }] });
    world.addMember(campaign, sam, 'player', wren);
    world.tables.character_play.push({ actor_id: wren, campaign_id: campaign, prepared: [{ spell: 'mire-lamp', level: 1 }], uses_spent: {}, ac_override: null, form_id: null, version: 1 });
    world.signInAs(gm);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Reed Marches/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
    await user.click(await screen.findByRole('button', { name: "Open Wren's magic" }));
    const before = world.tables.events.length;
    await user.click(await screen.findByRole('button', { name: 'Cast Mire lamp' }));
    await waitFor(() => expect(world.tables.character_play[0]!.spells_cast).toEqual({ '1:mire-lamp': 1 }));
    expect(world.tables.events.slice(before).map((e) => [e.type, e.actor_user_id])).toEqual([['character.castSpell', gm]]);
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.character_play[0]!.spells_cast).toEqual({}));
  });
});

describe('the player-only actions in the GM’s view (C15d; pg32-6)', () => {
  it('Take back opens “Only Sam can take back this change”, writes nothing, and goes to Waiting for approval, the place its words name', async () => {
    await setUp('finish');
    const user = await inGmView();
    await user.click(await screen.findByRole('button', { name: /notice/ }));
    const before = world.tables.events.length;
    await user.click(await screen.findByRole('button', { name: /^Take back / }));
    const pop = await screen.findByRole('dialog', { name: 'Only Sam can take back this change' });
    expect(within(pop).getByText('Sam asked you for it. You can answer it instead: Approve or Refuse it in Waiting for approval.')).toBeTruthy();
    const foot = [...pop.querySelectorAll('.dialog__got-it button')].map((b) => b.textContent);
    expect(foot).toEqual(['Go to Waiting for approval', 'Got it']);
    expect(world.tables.events.length).toBe(before);
    expect(world.tables.sheet_changes[0]).toMatchObject({ status: 'waiting' });
    await user.click(within(pop).getByRole('button', { name: 'Go to Waiting for approval' }));
    // Out of the view, on Players, the change waiting where the GM answers it.
    await screen.findByRole('button', { name: 'Invite a player' });
    expect(screen.queryByRole('note')).toBeNull();
    const approval = screen.getByRole('heading', { name: 'Waiting for approval' }).parentElement as HTMLElement;
    expect(approval.id).toBe('gm-waiting-approval');
    expect(within(approval).getByText(/Muscle/)).toBeTruthy();
  });
});

describe('the view’s bar on a phone (M3j; pg32-match)', () => {
  // Purpose: on a phone the view's top row carries only ⋯ at the right; ✉ and Reference are its first rows, and each
  // opens what its icon opened. On a tablet the bar keeps them (M3c).
  it('carries only ⋯ at the right, with Messages and Reference first inside it', async () => {
    const wide = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    window.matchMedia = ((query: string) => {
      const max = /max-width:\s*(\d+)px/.exec(query);
      const min = /min-width:\s*(\d+)px/.exec(query);
      const matches = (!min || 375 >= Number(min[1])) && (!max || 375 <= Number(max[1])) && Boolean(min || max);
      return { matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
    }) as typeof window.matchMedia;
    try {
      await setUp();
      const user = await inGmView();
      const end = document.querySelector('.top-row__end') as HTMLElement;
      expect(within(end).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Character options']);
      await user.click(within(end).getByRole('button', { name: 'Character options' }));
      const more = await screen.findByRole('dialog', { name: 'More' });
      expect(within(more).getAllByRole('button').map((b) => b.textContent).slice(1, 3)).toEqual(['Messages', 'Reference']);
      await user.click(within(more).getByRole('button', { name: 'Reference' }));
      expect(await screen.findByRole('dialog', { name: 'Reference' })).toBeTruthy();
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: wide });
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });
});

describe('“Go to Waiting for you” lands once (the review of #36)', () => {
  // Purpose: once "Go to Waiting for you" has brought Players to the change, a later return to Players (from the view
  // again) neither scrolls back to it nor reopens anything.
  it('scrolls to Waiting for approval once, and not again on a later return', async () => {
    const scrolled: Element[] = [];
    const was = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    try {
      await setUp('finish');
      const user = await inGmView();
      await user.click(await screen.findByRole('button', { name: /notice/ }));
      await user.click(await screen.findByRole('button', { name: /^Take back / }));
      await user.click(within(await screen.findByRole('dialog', { name: 'Only Sam can take back this change' })).getByRole('button', { name: 'Go to Waiting for approval' }));
      await screen.findByRole('button', { name: 'Invite a player' });
      await waitFor(() => expect(scrolled.filter((el) => el.id === 'gm-waiting-approval')).toHaveLength(1));
      // Into the view again and back: no second scroll.
      await user.click(screen.getByRole('button', { name: `View ${P1_CHARACTER}'s sheet` }));
      await screen.findByRole('region', { name: 'Vitals' });
      await user.click(screen.getByRole('button', { name: '‹ Players' }));
      await screen.findByRole('button', { name: 'Invite a player' });
      await new Promise((r) => setTimeout(r, 50));
      expect(scrolled.filter((el) => el.id === 'gm-waiting-approval')).toHaveLength(1);
    } finally {
      Element.prototype.scrollIntoView = was;
    }
  });
});

describe('the pop-ups’ words (M3f2)', () => {
  // Purpose (audit fix 1, ⚑ 51): the three that point somewhere name in their button the place their words name:
  // Waiting for you for the two requests, Waiting for approval for a sheet change.
  it('reads M3f2’s eight pop-ups word for word, three pointing where their words say', () => {
    const all: PlayerOnlyAct[] = ['askChange', 'sendRequest', 'takeBackRequest', 'chooseCharacter', 'takeBackChange', 'answerOffer', 'stayHere', 'undoPurchase'];
    expect(Object.fromEntries(all.map((act) => [act, playerOnlyWords(act, 'Sam', 'Wren')]))).toEqual({
      askChange: { title: 'Only Sam can ask for a change', why: 'A change Sam asks for comes to you to approve. To change Wren’s sheet yourself, use Edit in ⋯ on Players.', goTo: null },
      sendRequest: { title: 'Only Sam can send this request', why: 'A request goes from Sam to you. When Sam sends it, it waits for you in Waiting for you.', goTo: 'Waiting for you' },
      takeBackRequest: { title: 'Only Sam can take back this request', why: 'You can answer it instead: it waits for you in Waiting for you.', goTo: 'Waiting for you' },
      chooseCharacter: { title: 'Only Sam can choose who they play', why: 'Sam picks from Your characters on their own screen.', goTo: null },
      takeBackChange: { title: 'Only Sam can take back this change', why: 'Sam asked you for it. You can answer it instead: Approve or Refuse it in Waiting for approval.', goTo: 'Waiting for approval' },
      answerOffer: { title: 'Only Sam can answer your offer', why: 'Sam accepts or declines it on their own screen.', goTo: null },
      stayHere: { title: 'Only Sam can choose where Wren stays', why: 'Sam picks a lodging on their own screen.', goTo: null },
      undoPurchase: { title: 'Only Sam can undo this purchase', why: 'The purchase was Sam’s, so its Undo is too.', goTo: null },
    });
  });
});

/** A button that is player-only: `acted` counts the taps that went through. */
function Button({ act, acted }: { act: PlayerOnlyAct; acted: () => void }) {
  const only = usePlayerOnly();
  return (
    <>
      <button type="button" onClick={() => only.blocked(act, { request: 'req-1' }) || acted()}>
        Tap
      </button>
      {only.sheet}
    </>
  );
}

describe('where a player-only pop-up opens (pg32-7c)', () => {
  const tap = async (view: PlayerView | null, act: PlayerOnlyAct) => {
    const acted = vi.fn();
    const user = userEvent.setup();
    render(
      <ToastHost>
        <PlayerViewContext.Provider value={view}>
          <Button act={act} acted={acted} />
        </PlayerViewContext.Provider>
      </ToastHost>,
    );
    await user.click(screen.getByRole('button', { name: 'Tap' }));
    return { acted, user };
  };

  it('opens in the view of a player’s character, the go-there button naming the request', async () => {
    const goToWaiting = vi.fn();
    const { acted, user } = await tap({ player: 'Sam', character: 'Wren', goToWaiting }, 'takeBackRequest');
    expect(acted).not.toHaveBeenCalled();
    const pop = await screen.findByRole('dialog', { name: 'Only Sam can take back this request' });
    await user.click(within(pop).getByRole('button', { name: 'Go to Waiting for you' }));
    expect(goToWaiting).toHaveBeenCalledWith({ request: 'req-1' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ends with Got it alone where the way forward is not Waiting for you', async () => {
    await tap({ player: 'Sam', character: 'Wren', goToWaiting: vi.fn() }, 'answerOffer');
    const pop = await screen.findByRole('dialog', { name: 'Only Sam can answer your offer' });
    expect([...pop.querySelectorAll('.dialog__got-it button')].map((b) => b.textContent)).toEqual(['Got it']);
  });

  // Purpose (audit fix 3a): after Got it, keyboard focus is back on the button that opened the pop-up.
  it('puts focus back on the button that opened it after Got it', async () => {
    const { user } = await tap({ player: 'Sam', character: 'Wren', goToWaiting: vi.fn() }, 'answerOffer');
    const pop = await screen.findByRole('dialog', { name: 'Only Sam can answer your offer' });
    await user.click(within(pop).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tap' }));
  });

  // Purpose (audit fix 4): the pop-up's title is drawn as M3f draws it, in ink and sentence case at the Sheet's title
  // size, not the book's red heading in capitals, even on the Player tab (inside the book's pop-up scope).
  it('titles the pop-up in ink, not the book’s red heading, even inside the book’s pop-up scope', async () => {
    const user = userEvent.setup();
    render(
      <ToastHost>
        <BookPopUpScope.Provider value>
          <PlayerViewContext.Provider value={{ player: 'Sam', character: 'Wren', goToWaiting: vi.fn() }}>
            <Button act="takeBackChange" acted={vi.fn()} />
          </PlayerViewContext.Provider>
        </BookPopUpScope.Provider>
      </ToastHost>,
    );
    await user.click(screen.getByRole('button', { name: 'Tap' }));
    const pop = await screen.findByRole('dialog', { name: 'Only Sam can take back this change' });
    const title = within(pop).getByRole('heading', { name: 'Only Sam can take back this change' });
    expect(title.className).not.toContain('book-heading');
    expect(title.className).toContain('dialog__title--plain');
  });

  it('opens none on the GM’s own character, nor outside the view: the button acts', async () => {
    const own = await tap({ player: null, character: 'Ash' }, 'takeBackRequest');
    expect(own.acted).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();
    const outside = await tap(null, 'takeBackRequest');
    expect(outside.acted).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
