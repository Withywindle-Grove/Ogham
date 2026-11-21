// @vitest-environment jsdom
// The Player screen's Light section (M5 step 7), clicked through against the stand-in database.
//   Light lights the character's one light in one tap (key journey 5), its time left in the light type's unit; Undo
//   puts it out again.
//   With more than one light, Light asks which, and the one tapped is lit.
//   Lit or out is one toggle on the light's row (tg-1, frame P1 of december/14): no Put out button. Switching it off
//   puts the light out at once, keeping its time left, with Undo; Undo brings the lit row back in place, toggle on.
//   Keep lit is a toggle with its name and ⓘ under the light's row (tg-1, replacing B10's pressed button), off by
//   default. Refill is a stacked button with the jug (ic-3); its count of refills is in the light's line.
//   When the clock burns the light out, the burnout toast says so with "Light another" (no Undo), which lights the
//   next one; with none left it says "No rushlights left".
//   A burnt-out lamp offers Refill (N left), which uses one flask.
//   A burnt-out lamp stays empty when another light is lit in between: switching back offers only Refill and light.
//   The lit light's glyph is the Status ring (option B on #560): the flame in the light tone, its arc the burn's time
//   left (6 of 6, then 1 of 6), and a dashed ring with no arc for a light with no burn time. It stays a light.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import type { CampaignSetting } from './campaignSetting.ts';
import { LightSection, useCharacterLight } from './LightSection.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
beforeEach(() => {
  world = createFakeDb();
});
afterEach(() => cleanup());

const TURN = 600;

/** Invented lights: rushlights (used up, 6 turns) and a reed lamp that burns fen oil (4 turns). */
const setting = {
  packs: [],
  rulesSets: [],
  items: [{ kind: 'item', packEntryId: 'fen-oil', name: 'Fen oil', data: { id: 'fen-oil', name: 'Fen oil' } }],
  all: [
    { kind: 'lightType', packEntryId: 'rushlight', name: 'Rushlight', data: { id: 'rushlight', name: 'Rushlight', duration: 6, unit: 'turn', radius: '30 ft', warnAt: 1, consumed: true } },
    { kind: 'lightType', packEntryId: 'reed-lamp', name: 'Reed lamp', data: { id: 'reed-lamp', name: 'Reed lamp', duration: 4, unit: 'turn', fuel: 'fen-oil' } },
    { kind: 'lightType', packEntryId: 'glow-moss', name: 'Glow moss', data: { id: 'glow-moss', name: 'Glow moss', duration: 'permanent', radius: '10 ft' } },
  ],
} as unknown as CampaignSetting;

function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  const carry = (id: string, name: string, qty: number, extra: Record<string, unknown>) =>
    world.tables.inventory_lines.push({ id, campaign_id: campaign, actor_id: wren, location_id: null, name, category: 'light', qty, stack: 10, approval: 'approved', item_data: {}, source_entry_id: null, version: 1, ...extra });
  const clock = () => world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!;
  return { gm, sam, campaign, wren, carry, clock };
}

/** The Light section as the Player screen shows it, with a way to read everything again (the log's live update). */
function Host({ user, carrier, refresh }: { user: CurrentUser; carrier: { id: string; campaignId: string; ownerUserId: string }; refresh: number }) {
  const view = useCharacterLight({ db: world.db, user, carrier: { ...carrier, archived: false, level: 1 }, setting, refresh });
  return <LightSection view={view} />;
}

function show(t: ReturnType<typeof table>) {
  world.signInAs(t.sam);
  const user: CurrentUser = { id: t.sam, roles: { [t.campaign]: 'player' } };
  const carrier = { id: t.wren, campaignId: t.campaign, ownerUserId: t.sam };
  const page = (refresh: number) => (
    <ToastHost>
      <Host user={user} carrier={carrier} refresh={refresh} />
    </ToastHost>
  );
  let refresh = 0;
  const { rerender } = render(page(refresh));
  return {
    reread: () =>
      act(() => {
        refresh += 1;
        rerender(page(refresh));
      }),
  };
}

/** The GM's clock moves on (as the database does it: lights burn out in the same move). */
async function gmMoves(t: ReturnType<typeof table>, turns: number) {
  world.signInAs(t.gm);
  const moved = await world.db.rpc('advance_clock', { campaign: t.campaign, by_seconds: turns * TURN });
  world.signInAs(t.sam);
  expect(moved.error).toBeNull();
}

const ringShare = (el: Element) => {
  const [drawn, length] = (el.querySelector('.status-ring__arc')?.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number);
  return drawn! / length!;
};

describe("the light's ring (option B on #560)", () => {
  it('is the flame in the light tone, its arc the time left of the burn', async () => {
    const t = table();
    t.carry('line-rush', 'Rushlights', 4, { item_data: { lightTypeId: 'rushlight' } });
    const { reread } = show(t);
    const user = userEvent.setup();
    await user.click(within(await screen.findByRole('region', { name: 'Light' })).getByRole('button', { name: 'Light' }));
    const ring = await screen.findByRole('img', { name: 'Rushlight, lit, 6 turns left' });
    const mark = ring.querySelector<HTMLElement>('.status-ring__mark')!;
    expect(mark.style.getPropertyValue('--ring-tone')).toBe('var(--light-glow)');
    expect(ring.querySelector('.status-ring__symbol svg')).not.toBeNull();
    expect(ringShare(ring)).toBeCloseTo(1, 3);
    await gmMoves(t, 5);
    reread();
    const low = await screen.findByRole('img', { name: 'Rushlight, lit, 1 turn left, running low' });
    expect(ringShare(low)).toBeCloseTo(1 / 6, 3);
    // Running low: the warning sign with the words, not colour alone.
    expect(screen.getByText(/Lit, 1 turn left/).querySelector('.warning-sign')).not.toBeNull();
  });

  it('is dashed with no arc for a light with no burn time', async () => {
    const t = table();
    t.carry('line-moss', 'Glow moss', 1, { item_data: { lightTypeId: 'glow-moss' } });
    show(t);
    const user = userEvent.setup();
    await user.click(within(await screen.findByRole('region', { name: 'Light' })).getByRole('button', { name: 'Light' }));
    const ring = await screen.findByRole('img', { name: /^Glow moss, lit/ });
    expect(ring.querySelector('.status-ring__track--endless')).not.toBeNull();
    expect(ring.querySelector('.status-ring__arc')).toBeNull();
  });
});

describe('the Light section', () => {
  it('Light lights the one light in one tap, with its time left; Undo puts it out', async () => {
    const t = table();
    t.carry('line-rush', 'Rushlights', 4, { item_data: { lightTypeId: 'rushlight' } });
    show(t);
    const user = userEvent.setup();
    const section = await screen.findByRole('region', { name: 'Light' });
    expect(within(section).getByText('Rushlights ×4, 6 turns, 30 ft')).toBeTruthy();
    await user.click(within(section).getByRole('button', { name: 'Light' }));
    expect(await within(section).findByText('Lit, 6 turns left')).toBeTruthy();
    expect(within(section).getByText('Rushlight')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Rushlight, lit, 6 turns left' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await within(section).findByRole('button', { name: 'Light' })).toBeTruthy();
  });

  it('with more than one light, Light asks which, and lights the one tapped', async () => {
    const t = table();
    t.carry('line-rush', 'Rushlights', 2, { item_data: { lightTypeId: 'rushlight' } });
    t.carry('line-lamp', 'Reed lamp', 1, { item_data: { lightTypeId: 'reed-lamp' } });
    show(t);
    const user = userEvent.setup();
    await user.click(within(await screen.findByRole('region', { name: 'Light' })).getByRole('button', { name: 'Light' }));
    const pick = await screen.findByRole('dialog', { name: 'Which light?' });
    await user.click(within(pick).getByRole('button', { name: 'Reed lamp, 4 turns' }));
    expect(await screen.findByRole('img', { name: 'Reed lamp, lit, 4 turns left' })).toBeTruthy();
  });

  it("lit or out is the toggle on the light's row; Keep lit is a toggle with its name and ⓘ, off until switched on; the warning shows near the end", async () => {
    const t = table();
    t.carry('line-rush', 'Rushlights', 4, { item_data: { lightTypeId: 'rushlight' } });
    const { reread } = show(t);
    const user = userEvent.setup();
    const section = await screen.findByRole('region', { name: 'Light' });
    await user.click(within(section).getByRole('button', { name: 'Light' }));
    const lit = await within(section).findByRole('switch', { name: 'Rushlight: lit' });
    expect(lit.getAttribute('aria-checked')).toBe('true');
    // Never two buttons, never one that stays pressed (tg-1).
    expect(within(section).queryByRole('button', { name: 'Put out' })).toBeNull();
    expect(section.querySelector('[aria-pressed]')).toBeNull();
    // The toggle sits at the right of the light's own row, beside its name.
    expect(lit.closest('.light-block__row')?.textContent).toContain('Rushlight');
    const keep = within(section).getByRole('switch', { name: 'Keep lit' });
    expect(keep.getAttribute('aria-checked')).toBe('false');
    // Its name beside it, and ⓘ between them, as frame P1 draws it.
    const keepRow = keep.closest('.keep-lit')!;
    expect([...keepRow.children].map((c) => c.getAttribute('aria-label') ?? c.textContent)).toEqual(['Keep lit', 'About Keep lit', 'Keep lit']);
    await user.click(keep);
    await waitFor(() => expect(within(section).getByRole('switch', { name: 'Keep lit' }).getAttribute('aria-checked')).toBe('true'));
    expect(await screen.findByText('Rushlight will be kept lit')).toBeTruthy();
    // ⓘ says what it does.
    await user.click(screen.getByRole('button', { name: 'About Keep lit' }));
    expect(within(await screen.findByRole('dialog', { name: 'Keep lit' })).getByText(/another one from this character's own pack is lit/)).toBeTruthy();
    await user.click(within(screen.getByRole('dialog', { name: 'Keep lit' })).getByRole('button', { name: 'Close' }));
    await gmMoves(t, 5);
    reread();
    // The last turn: the warning colour, the ▲ shape and the words (never colour alone).
    expect(await screen.findByRole('img', { name: 'Rushlight, lit, 1 turn left, running low' })).toBeTruthy();
    await user.click(screen.getByRole('switch', { name: 'Rushlight: lit' }));
    await waitFor(() => expect(world.tables.character_lights.find((l) => l.actor_id === t.wren)).toMatchObject({ lit_at: null, left_seconds: TURN }));
  });

  it('switching the toggle off puts the light out at once; Undo brings the lit row back in place, its toggle on', async () => {
    const t = table();
    t.carry('line-rush', 'Rushlights', 4, { item_data: { lightTypeId: 'rushlight' } });
    show(t);
    const user = userEvent.setup();
    const section = await screen.findByRole('region', { name: 'Light' });
    await user.click(within(section).getByRole('button', { name: 'Light' }));
    const lit = await within(section).findByRole('switch', { name: 'Rushlight: lit' });
    const rowIndex = [...section.children].indexOf(lit.closest('.light-block__row')!);
    await user.click(lit);
    // Out at once: the unlit state is today's (the Light button), no toggle on an unlit row.
    expect(await within(section).findByRole('button', { name: 'Light' })).toBeTruthy();
    expect(within(section).queryByRole('switch')).toBeNull();
    const toast = (await screen.findByText('Put out Rushlight')).closest('.toast') as HTMLElement;
    await user.click(within(toast).getByRole('button', { name: 'Undo' }));
    const back = await within(section).findByRole('switch', { name: 'Rushlight: lit' });
    expect(back.getAttribute('aria-checked')).toBe('true');
    expect([...section.children].indexOf(back.closest('.light-block__row')!)).toBe(rowIndex);
    expect(within(section).getByText('Lit, 6 turns left')).toBeTruthy();
  });

  it("a lit lamp's line counts its refills, and Refill is a stacked button with the jug that uses one", async () => {
    const t = table();
    t.carry('line-lamp', 'Reed lamp', 1, { item_data: { lightTypeId: 'reed-lamp' } });
    t.carry('line-oil', 'Fen oil', 2, { source_entry_id: 'fen-oil' });
    show(t);
    const user = userEvent.setup();
    const section = await screen.findByRole('region', { name: 'Light' });
    await user.click(within(section).getByRole('button', { name: 'Light' }));
    expect(await within(section).findByText('Lit, 4 turns left. 2 refills left')).toBeTruthy();
    const refill = within(section).getByRole('button', { name: 'Refill' });
    expect(refill.classList.contains('stacked-button')).toBe(true);
    expect(refill.querySelector('svg')).not.toBeNull();
    await user.click(refill);
    expect(await within(section).findByText('Lit, 4 turns left. 1 refill left')).toBeTruthy();
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-oil')?.qty).toBe(1);
  });

  it('burnt out by the clock: the toast offers Light another (no Undo), which lights the next; then none are left', async () => {
    const t = table();
    t.carry('line-rush', 'Rushlights', 2, { item_data: { lightTypeId: 'rushlight' } });
    const { reread } = show(t);
    const user = userEvent.setup();
    await user.click(within(await screen.findByRole('region', { name: 'Light' })).getByRole('button', { name: 'Light' }));
    await screen.findByRole('img', { name: 'Rushlight, lit, 6 turns left' });
    await gmMoves(t, 6);
    reread();
    const host = await waitFor(() => {
      const found = screen.getAllByText('Rushlight burnt out').map((e) => e.closest('.toast')).find(Boolean);
      expect(found).toBeTruthy();
      return found as HTMLElement;
    });
    expect(within(host).queryByRole('button', { name: 'Undo' })).toBeNull();
    // One of the stack was used up.
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-rush')?.qty).toBe(1);
    await user.click(within(host).getByRole('button', { name: 'Light another' }));
    expect(await screen.findByRole('img', { name: 'Rushlight, lit, 6 turns left' })).toBeTruthy();
    await gmMoves(t, 6);
    reread();
    expect(await screen.findAllByText('Rushlight burnt out, No rushlights left')).not.toHaveLength(0);
    expect(world.tables.inventory_lines.some((l) => l.id === 'line-rush')).toBe(false);
  });

  it('a burnt-out lamp offers Refill (N left), which uses one flask and lights it again', async () => {
    const t = table();
    t.carry('line-lamp', 'Reed lamp', 1, { item_data: { lightTypeId: 'reed-lamp' } });
    t.carry('line-oil', 'Fen oil', 2, { source_entry_id: 'fen-oil' });
    const { reread } = show(t);
    const user = userEvent.setup();
    await user.click(within(await screen.findByRole('region', { name: 'Light' })).getByRole('button', { name: 'Light' }));
    await screen.findByRole('img', { name: 'Reed lamp, lit, 4 turns left' });
    await gmMoves(t, 4);
    reread();
    const section = screen.getByRole('region', { name: 'Light' });
    expect(await within(section).findByText('Reed lamp burnt out')).toBeTruthy();
    await user.click(within(section).getByRole('button', { name: 'Refill (2 left)' }));
    expect(await screen.findByRole('img', { name: 'Reed lamp, lit, 4 turns left' })).toBeTruthy();
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-oil')?.qty).toBe(1);
  });

  it("switching to a rushlight and back doesn't light the empty lamp: the pick offers Refill and light, which uses a flask", async () => {
    const t = table();
    t.carry('line-lamp', 'Reed lamp', 1, { item_data: { lightTypeId: 'reed-lamp' } });
    t.carry('line-rush', 'Rushlights', 2, { item_data: { lightTypeId: 'rushlight' } });
    t.carry('line-oil', 'Fen oil', 2, { source_entry_id: 'fen-oil' });
    const { reread } = show(t);
    const user = userEvent.setup();
    await user.click(within(await screen.findByRole('region', { name: 'Light' })).getByRole('button', { name: 'Light' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Which light?' })).getByRole('button', { name: /^Reed lamp/ }));
    await screen.findByRole('img', { name: 'Reed lamp, lit, 4 turns left' });
    await gmMoves(t, 4);
    reread();
    const section = screen.getByRole('region', { name: 'Light' });
    // Light another: the rushlight (the lamp is out of the running), then put it out.
    await user.click(await within(section).findByRole('button', { name: 'Light another' }));
    await screen.findByRole('img', { name: 'Rushlight, lit, 6 turns left' });
    await user.click(within(section).getByRole('switch', { name: /: lit$/ }));
    await user.click(await within(section).findByRole('button', { name: 'Light' }));
    const pick = await screen.findByRole('dialog', { name: 'Which light?' });
    expect(within(pick).queryByRole('button', { name: /^Reed lamp, 4 turns, Refill/ })).toBeTruthy();
    expect(within(pick).getAllByRole('button').filter((b) => /^Reed lamp/.test(b.textContent ?? '')).map((b) => b.textContent)).toEqual(['Reed lamp, 4 turns, Refill and light (2 left)']);
    await user.click(within(pick).getByRole('button', { name: 'Reed lamp, 4 turns, Refill and light (2 left)' }));
    expect(await screen.findByRole('img', { name: 'Reed lamp, lit, 4 turns left' })).toBeTruthy();
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-oil')?.qty).toBe(1);
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-lamp')?.needs_fuel).toBe(false);
  });

  it('a lamp swapped for a rushlight keeps its fuel and burns on from it; the rushlight swapped back loses its leftover (ruled 2026-10-30)', async () => {
    const t = table();
    t.carry('line-lamp', 'Reed lamp', 1, { item_data: { lightTypeId: 'reed-lamp' } });
    t.carry('line-rush', 'Rushlights', 2, { item_data: { lightTypeId: 'rushlight' } });
    t.carry('line-oil', 'Fen oil', 2, { source_entry_id: 'fen-oil' });
    const { reread } = show(t);
    const user = userEvent.setup();
    const section = await screen.findByRole('region', { name: 'Light' });
    await user.click(within(section).getByRole('button', { name: 'Light' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Which light?' })).getByRole('button', { name: /^Reed lamp/ }));
    await screen.findByRole('img', { name: 'Reed lamp, lit, 4 turns left' });
    // One turn burns, then the lamp is put out and a rushlight lit instead.
    await gmMoves(t, 1);
    reread();
    await screen.findByRole('img', { name: 'Reed lamp, lit, 3 turns left' });
    await user.click(within(section).getByRole('switch', { name: /: lit$/ }));
    await user.click(await within(section).findByRole('button', { name: 'Light' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Which light?' })).getByRole('button', { name: /^Rushlights/ }));
    await screen.findByRole('img', { name: 'Rushlight, lit, 6 turns left' });
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-lamp')?.fuel_left_seconds).toBe(3 * TURN);
    await gmMoves(t, 2);
    reread();
    await screen.findByRole('img', { name: 'Rushlight, lit, 4 turns left' });
    // Back to the lamp: the pick says the fuel left in it, and it burns on from there (no flask used).
    await user.click(within(section).getByRole('switch', { name: /: lit$/ }));
    await user.click(await within(section).findByRole('button', { name: 'Light' }));
    const pick = await screen.findByRole('dialog', { name: 'Which light?' });
    await user.click(within(pick).getByRole('button', { name: 'Reed lamp, 3 turns left' }));
    expect(await screen.findByRole('img', { name: 'Reed lamp, lit, 3 turns left' })).toBeTruthy();
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-oil')?.qty).toBe(2);
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-lamp')?.fuel_left_seconds).toBeNull();
    // The rushlight's leftover 4 turns are gone: lit again, it starts a fresh one (6 turns).
    await user.click(within(section).getByRole('switch', { name: /: lit$/ }));
    await user.click(await within(section).findByRole('button', { name: 'Light' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Which light?' })).getByRole('button', { name: /^Rushlights/ }));
    expect(await screen.findByRole('img', { name: 'Rushlight, lit, 6 turns left' })).toBeTruthy();
  });
});
