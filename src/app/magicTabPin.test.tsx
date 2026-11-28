// @vitest-environment jsdom
// The Pin star on a spell's sheet on the Magic tab (ticket #164; spec docs/specs/player-sitting.md, piece 3; pss-6,
// psb-4, psb-7). Invented names only (hard rule 2). Purposes:
//   A spell's sheet on the Magic tab carries the Pin star beside ✕, empty and not pressed while the spell isn't pinned.
//   A tap pins the spell through `character.pin` (kind spell, keyed by the spell's id), says "<name> pinned to the top"
//   with Undo, and the star fills; the Magic tab keeps listing the spell.
//   Undo in that toast unpins it again.
//   Tapped again, the star unpins the spell and says "<name> unpinned", with Undo that pins it back.
//   A spell with no casting left still opens its sheet with the star (any spell in the book takes it, psb-4).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Reed, a level 1 Lantern Warden with Marsh light ready once and Hush spent, on the Magic tab. */
async function reedOnTheMagicTab() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', { abilities: [{ key: 'STR', short: 'Strength', name: 'Strength' }], saveCategories: [{ key: 'R', name: 'Save vs river' }] });
  entry('class', 'lantern-warden', 'Lantern Warden', {
    spellcasting: { listId: 'warden-list', type: 'divine', castingType: 'divine' },
    progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: { R: 12 }, spellSlots: [2] }],
  });
  entry('hook', 'fill-level', 'fill-level', { kind: 'fill', when: 'levelUp', from: 'classProgression', target: ['hitDice', 'attack', 'saves', 'spellSlots'] });
  entry('spell', 'marsh-light', 'Marsh light', { range: '30 ft', notes: 'A pale light over still water.' });
  entry('spell', 'hush', 'Hush', { range: 'Self' });
  entry('spellList', 'warden-list', 'Warden spells', { levels: [{ level: 1, spells: ['marsh-light', 'hush'] }] });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  const reed = world.addCharacter(campaign, 'Reed', { ownerId: me });
  Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 1, hp_current: 6, hp_max: 6, fields: { STR: 10 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
  world.tables.character_play.push({
    actor_id: reed,
    campaign_id: campaign,
    prepared: [{ spell: 'marsh-light', level: 1 }, { spell: 'hush', level: 1 }],
    spells_cast: { '1:hush': 1 },
    uses_spent: {},
    ac_override: null,
    form_id: null,
    version: 1,
  });
  world.addMember(campaign, me, 'player', reed);
  world.signInAs(me);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Magic' }));
  const level = within(await screen.findByRole('region', { name: 'Level 1, 2 a day' }));
  return { user, level };
}

const pins = () => world.tables.character_play[0]!.pins;
const pinEvents = () => world.tables.events.filter((e) => e.type === 'character.pin').length;

describe('the Pin star on a spell’s sheet (Magic tab; #164, pss-6)', () => {
  it('shows the star beside ✕, pins with Undo, and the tab keeps listing the spell', async () => {
    const { user, level } = await reedOnTheMagicTab();
    await user.click(await level.findByRole('button', { name: /^Marsh light, / }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Marsh light' }));
    const star = sheet.getByRole('button', { name: 'Pin to top' });
    expect(star.getAttribute('aria-pressed')).toBe('false');
    expect(sheet.getByRole('button', { name: 'Close' })).toBeTruthy();

    await user.click(star);
    expect(await screen.findByText('Marsh light pinned to the top')).toBeTruthy();
    await waitFor(() => expect(pins()).toEqual([{ kind: 'spell', key: 'marsh-light' }]));
    expect(pinEvents()).toBe(1);
    expect((await sheet.findByRole('button', { name: 'Unpin' })).getAttribute('aria-pressed')).toBe('true');
    // psb-7: the Magic tab keeps listing the pinned spell.
    expect(level.getByRole('button', { name: /^Marsh light, / })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(pins()).toEqual([]));
    expect(await sheet.findByRole('button', { name: 'Pin to top' })).toBeTruthy();
  });

  it('unpins when tapped again, with Undo that pins it back', async () => {
    const { user, level } = await reedOnTheMagicTab();
    await user.click(await level.findByRole('button', { name: /^Marsh light, / }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Marsh light' }));
    await user.click(sheet.getByRole('button', { name: 'Pin to top' }));
    await user.click(await sheet.findByRole('button', { name: 'Unpin' }));
    expect(await screen.findByText('Marsh light unpinned')).toBeTruthy();
    await waitFor(() => expect(pins()).toEqual([]));
    const undos = screen.getAllByRole('button', { name: 'Undo' });
    await user.click(undos[undos.length - 1]!);
    await waitFor(() => expect(pins()).toEqual([{ kind: 'spell', key: 'marsh-light' }]));
  });

  it('a spell with no casting left still opens its sheet with the star (psb-4)', async () => {
    const { user, level } = await reedOnTheMagicTab();
    await user.click(await level.findByRole('button', { name: 'Hush, cast' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Hush' }));
    await user.click(sheet.getByRole('button', { name: 'Pin to top' }));
    await waitFor(() => expect(pins()).toEqual([{ kind: 'spell', key: 'hush' }]));
    expect(await screen.findByText('Hush pinned to the top')).toBeTruthy();
  });
});
