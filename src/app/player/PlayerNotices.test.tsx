// @vitest-environment jsdom
// Row C1 of plans/test-feedback-2026-11-19.md (tfn-1, tfn-2; mockup page M1, frames M1a to M1e, approved 2026-11-19
// with fixes): the Player tab's notices box and its sheet. Invented names only. Purposes:
//   The box gives its count in words ("No notices", "1 notice", "3 notices", "99+ notices"), never a badge.
//   What asks for an act comes first; the rest keep their order.
//   "No light" with something to light carries its one-tap light as the sheet's accent; with nothing, its words alone.
//   The sheet shows one notice at a time: "1 of 3" over it, Next and Back at its foot; one notice has neither; the last
//   has no Next and the first no Back; a notice with no button of its own has only the ✕.
//   The box with nothing is quiet (no glow) and still opens, on "Nothing new."; with something it glows (and its words
//   say how many, so the glow is never the only sign).
//   With its open state held above it, the box drawn afresh (a turned tablet moves its place) keeps its sheet open.
//   When the last notice is dealt with, the sheet closes by itself and the box goes quiet.
//   On the Player tab: a change waiting for the GM is in the box, not in the columns; Take back takes it out.
//   Hidden data stays hidden: another player's waiting change never reaches this player's box.
//   "Opening…" and the offline line stay on the tab and are never in the box.
//   The To finish card's steps, read once for the card and the box (`finishSteps`): none, a put-off step, never a patron.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../scripts/fixtures/m5b-creation.fixture.json?raw';
import type { CurrentUser } from '../../core/commands.ts';
import { forgetFileLinks } from '../../core/files.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { addP1Character, P1_CAMPAIGN } from '../../testing/layoutP1Character.ts';
import { Root } from '../App.tsx';
import { forgetCampaignSetting } from '../campaignSetting.ts';
import { finishSteps } from '../FinishCreation.tsx';
import { NoticesSheet, type Notice } from './NoticesSheet.tsx';
import { noLightNotice, noticesWords, orderNotices, PlayerNotices, type NoticesHeld } from './PlayerNotices.tsx';

const offline = vi.hoisted(() => ({ asOf: null as string | null }));
vi.mock('../campaignSetting.ts', async () => {
  const actual = await vi.importActual<typeof import('../campaignSetting.ts')>('../campaignSetting.ts');
  return {
    ...actual,
    loadCampaignSetting: async (...args: Parameters<typeof actual.loadCampaignSetting>) => {
      const found = await actual.loadCampaignSetting(...args);
      return found && offline.asOf ? { ...found, asOf: offline.asOf } : found;
    },
  };
});

vi.mock('../services.ts', async () => {
  const { createAppRegistry } = await import('../commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  offline.asOf = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fenPack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
const note = (key: string, more: Partial<Notice> = {}): Notice => ({ key, title: `Notice ${key}`, ...more });

describe("the notices box's words and order", () => {
  it('says the count in words, past 99 as "99+ notices"', () => {
    expect([0, 1, 3, 99, 100, 999].map(noticesWords)).toEqual(['No notices', '1 notice', '3 notices', '99 notices', '99+ notices', '99+ notices']);
  });

  it('puts what asks for an act first and keeps the rest in their order', () => {
    const order = orderNotices([note('a'), note('b', { act: true }), note('c'), note('d', { act: true })]).map((n) => n.key);
    expect(order).toEqual(['b', 'd', 'a', 'c']);
  });

  it('"No light" carries its light as the accent; with nothing to light, its words alone', () => {
    const lit = noLightNotice({ option: { id: 'rush' } as never, words: 'Light a rushlight (4 left)', lightIt: () => undefined });
    expect(lit).toMatchObject({ title: 'No light', act: true, sign: 'warning' });
    render(<>{lit.action}</>);
    expect(screen.getByRole('button', { name: 'Light a rushlight (4 left)' }).className).toBe('button-primary');
    expect(noLightNotice({ option: null, words: null, lightIt: () => undefined })).toEqual({ key: 'no-light', sign: 'warning', title: 'No light', body: 'Nothing to light in your pack.' });
  });
});

describe('the notices sheet, one at a time', () => {
  it('with one notice: no count line, no Back and no Next; a notice with no button has only the ✕', () => {
    render(<NoticesSheet notices={[note('a', { body: 'Under it.' })]} onClose={() => undefined} />);
    const sheet = within(screen.getByRole('dialog', { name: 'Notices' }));
    expect(sheet.getByText('Notice a')).toBeTruthy();
    expect(sheet.getByText('Under it.')).toBeTruthy();
    expect(sheet.queryByText(/of 1/)).toBeNull();
    expect(sheet.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close']);
  });

  it('with three: "1 of 3", Next to the second and third, Back again; the first has no Back, the last no Next', async () => {
    const user = userEvent.setup();
    render(<NoticesSheet notices={[note('a'), note('b'), note('c')]} onClose={() => undefined} />);
    const sheet = within(screen.getByRole('dialog', { name: 'Notices' }));
    expect(sheet.getByText('1 of 3')).toBeTruthy();
    expect(sheet.queryByRole('button', { name: 'Back' })).toBeNull();
    await user.click(sheet.getByRole('button', { name: 'Next' }));
    expect(sheet.getByText('2 of 3')).toBeTruthy();
    expect(sheet.getByText('Notice b')).toBeTruthy();
    await user.click(sheet.getByRole('button', { name: 'Next' }));
    expect(sheet.getByText('Notice c')).toBeTruthy();
    expect(sheet.queryByRole('button', { name: 'Next' })).toBeNull();
    await user.click(sheet.getByRole('button', { name: 'Back' }));
    expect(sheet.getByText('2 of 3')).toBeTruthy();
  });

  it('with nothing: "Nothing new."', () => {
    render(<NoticesSheet notices={[]} onClose={() => undefined} />);
    expect(within(screen.getByRole('dialog', { name: 'Notices' })).getByText('Nothing new.')).toBeTruthy();
  });

  it('closes by itself when the last notice is dealt with', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    function Holder() {
      const [notices, setNotices] = useState<Notice[]>([note('a', { action: <button onClick={() => setNotices([])}>Deal with it</button> })]);
      return <NoticesSheet notices={notices} onClose={onClose} />;
    }
    render(<Holder />);
    await user.click(screen.getByRole('button', { name: 'Deal with it' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('the box', () => {
  const user: CurrentUser = { id: 'person-1', roles: {} };

  it('with nothing: quiet, "No notices", and a tap opens "Nothing new."', async () => {
    const tap = userEvent.setup();
    render(<PlayerNotices db={world.db} user={user} notices={[]} sheetNotices={[]} characterId="actor-1" campaignId="campaign-1" />);
    const box = screen.getByRole('button', { name: 'No notices, nothing new' });
    expect(box.textContent).toBe('No notices');
    expect(box.className).not.toMatch(/notices-box--lit/);
    await tap.click(box);
    expect(within(screen.getByRole('dialog', { name: 'Notices' })).getByText('Nothing new.')).toBeTruthy();
  });

  it('drawn afresh with its open state held above (a turned tablet), keeps its sheet open', async () => {
    const tap = userEvent.setup();
    let turn: () => void = () => undefined;
    function Holder() {
      const [open, setOpen] = useState(false);
      const [turned, setTurned] = useState(false);
      turn = () => setTurned(true);
      const held: NoticesHeld = { open, setOpen, roll: null, setRoll: () => undefined };
      return <PlayerNotices key={turned ? 'upright' : 'sideways'} db={world.db} user={user} notices={[note('a')]} sheetNotices={[]} characterId="actor-1" campaignId="campaign-1" held={held} />;
    }
    render(<Holder />);
    await tap.click(screen.getByRole('button', { name: '1 notice, open them' }));
    expect(screen.getByRole('dialog', { name: 'Notices' })).toBeTruthy();
    act(() => turn());
    expect(within(screen.getByRole('dialog', { name: 'Notices' })).getByText('Notice a')).toBeTruthy();
  });

  it('with something: it glows, and its words say how many', () => {
    render(<PlayerNotices db={world.db} user={user} notices={[note('a')]} sheetNotices={[note('b'), note('c')]} characterId="actor-1" campaignId="campaign-1" />);
    const box = screen.getByRole('button', { name: '3 notices, open them' });
    expect(box.textContent).toBe('3 notices');
    expect(box.className).toMatch(/notices-box--lit/);
  });
});

/** Brannoch with a change to Muscle waiting for the GM (the layout page's ?p1=bare). */
async function brannoch({ another = false, whileOpening }: { another?: boolean; whileOpening?: () => void } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  await addP1Character(world, { gm, sam, fenPack, head: 'bare' });
  if (another) {
    // Another player's character in the same campaign, with a change of its own waiting and one refused.
    const ida = world.addPerson('ida@lantern.example', 'Ida');
    const campaign = world.tables.campaigns.find((c) => c.name === P1_CAMPAIGN)!.id as string;
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: ida, approval: 'approved' });
    world.addMember(campaign, ida, 'player', reed);
    for (const [id, status] of [['change-reed-wits', 'waiting'], ['change-reed-lore', 'refused']] as const) {
      world.tables.sheet_changes.push({
        id, campaign_id: campaign, actor_id: reed, requester_id: ida, field: 'WIT', label: 'Wit', from_value: 10, to_value: 11,
        status, reason: status === 'refused' ? 'Not yet.' : null, answered_at: null, created_at: '2026-11-15T09:00:00Z', version: 1, undone: false,
      } as never);
    }
  }
  world.signInAs(sam);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  // Watches the screen from the campaign's tap to the opened tab (the first open's "Opening…" comes and goes in it).
  const watch = whileOpening && new MutationObserver(whileOpening);
  watch?.observe(document.body, { childList: true, subtree: true, characterData: true });
  await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
  await screen.findByRole('region', { name: 'Vitals' });
  watch?.disconnect();
  return { user };
}

describe('the box on the Player tab', () => {
  it('holds a change waiting for the GM, not the columns; Take back takes it out and the box goes quiet', async () => {
    const { user } = await brannoch();
    const box = await screen.findByRole('button', { name: '1 notice, open them' });
    // Not in the columns (tfn-1).
    expect(screen.queryByText(/Waiting for your GM/)).toBeNull();
    await user.click(box);
    const sheet = within(await screen.findByRole('dialog', { name: 'Notices' }));
    expect(sheet.getByText('Waiting for your GM: Muscle 15 → 16')).toBeTruthy();
    expect(sheet.getByText(/The sheet shows the old figure until it is approved\.$/)).toBeTruthy();
    await user.click(sheet.getByRole('button', { name: 'Take back Muscle 15 → 16' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Notices' })).toBeNull());
    expect(await screen.findByRole('button', { name: 'No notices, nothing new' })).toBeTruthy();
  });

  it("never shows another player's changes", async () => {
    const { user } = await brannoch({ another: true });
    // Reed's waiting and refused changes would make three: the box counts Brannoch's one alone.
    await user.click(await screen.findByRole('button', { name: '1 notice, open them' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Notices' }));
    expect(sheet.getByText('Waiting for your GM: Muscle 15 → 16')).toBeTruthy();
    // One notice, so no "1 of" line and no Next to step to another's.
    expect(sheet.queryByText(/^1 of/)).toBeNull();
    expect(sheet.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(sheet.queryByText(/Wit 10 → 11/)).toBeNull();
    expect(sheet.queryByText(/Not yet\./)).toBeNull();
  });

  it('leaves "Opening…" and the offline line on the tab, never in the box', async () => {
    offline.asOf = '2026-11-16T10:00:00Z';
    // During the first open: every "Opening…" drawn, and any drawn inside the box.
    let opening = 0;
    let openingInBox = 0;
    const { user } = await brannoch({
      whileOpening: () => {
        const lines = screen.queryAllByText('Opening…');
        opening += lines.length;
        openingInBox += lines.filter((el) => el.closest('.notices-box')).length;
      },
    });
    expect(opening).toBeGreaterThan(0);
    expect(openingInBox).toBe(0);
    const words = `Setting rules as of ${new Date(offline.asOf).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, offline`;
    const line = screen.getByText(words);
    expect(line.closest('.notices-box, [role="dialog"]')).toBeNull();
    await user.click(await screen.findByRole('button', { name: '1 notice, open them' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Notices' }));
    expect(sheet.queryByText(words)).toBeNull();
  });
});

describe("the To finish card's steps (finishSteps)", () => {
  const base = { classRef: null, raceRef: null, fieldDefs: [], setting: null, level: 1, weaponSkills: null };

  it('lists nothing when nothing is put off', () => {
    expect(finishSteps({ ...base, creation: null })).toEqual([]);
    expect(finishSteps({ ...base, creation: { toFinish: [] } })).toEqual([]);
  });

  it('lists a put-off step by its name, and never a patron', () => {
    expect(finishSteps({ ...base, creation: { toFinish: ['languages', 'patron'] } })).toEqual([{ id: 'languages', name: 'Languages' }]);
  });
});
