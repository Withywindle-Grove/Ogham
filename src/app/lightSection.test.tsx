// @vitest-environment jsdom
// The Player screen's light in At hand (M5 step 7; lt-1 to lt-6, page 35), clicked through against the stand-in
// database. Purposes:
//   The light's ring is the tap (lt-1, lt-2): lit, it is one button "Put out <light>"; a tap puts the light out at once,
//   no pop-up, keeping its time, with the toast "Put out <light>" and Undo; Undo brings the lit row back in its place.
//   No switch for lit or out anywhere.
//   One light not lit: the ring "Light <light>" lights it at once (key journey 5), toast "Lit <light>" with Undo.
//   Several: the ring "Light: choose which" opens today's "Which light?", its "Refill and light" rows included.
//   Keep lit's row (lt-6): its name, ⓘ, a holder's Refill, the switch, in that order; off by default; only while lit.
//   Refill is a stacked button with the jug (ic-3); its count of refills is in the light's line.
//   When the clock burns the light out, the burnout toast says so with "Light another" (no Undo), which lights the
//   next one; with none left, the words alone ("Burnt out. No rushlights left") and no button, the ring a picture.
//   A burnt-out lamp: the ring struck through, a picture; Refill uses one flask; Light another lights the next.
//   A burnt-out lamp stays empty when another light is lit in between: switching back offers only Refill and light.
//   The lit light's ring: the flame in the light tone, its arc the burn's time left (6 of 6, then 1 of 6), and a dashed
//   ring with no arc for a light with no burn time. It stays a light.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import type { CampaignSetting } from './campaignSetting.ts';
import { LightInAtHand, useCharacterLight } from './LightSection.tsx';

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

/** The light as At hand shows it, with a way to read everything again (the log's live update). */
function Host({ user, carrier, refresh }: { user: CurrentUser; carrier: { id: string; campaignId: string; ownerUserId: string }; refresh: number }) {
  const view = useCharacterLight({ db: world.db, user, carrier: { ...carrier, archived: false, level: 1 }, setting, refresh });
  return (
    <section aria-label="At hand">
      <LightInAtHand view={view} />
    </section>
  );
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

const toastOf = async (text: string) => (await screen.findByText(text)).closest('.toast') as HTMLElement;

describe("the light's ring (option B on #560)", () => {
  it('is the flame in the light tone, its arc the time left of the burn', async () => {
    const t = table();
    t.carry('line-rush', 'Rushlights', 4, { item_data: { lightTypeId: 'rushlight' } });
    const { reread } = show(t);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Light Rushlight' }));
    const ring = await screen.findByRole('button', { name: 'Put out Rushlight' });
    const mark = ring.querySelector<HTMLElement>('.status-ring__mark')!;
    expect(mark.style.getPropertyValue('--ring-tone')).toBe('var(--light-glow)');
    expect(ring.querySelector('.status-ring__symbol svg')).not.toBeNull();
    expect(ringShare(ring)).toBeCloseTo(1, 3);
    expect(screen.getByText('Lit, 6 turns left')).toBeTruthy();
    await gmMoves(t, 5);
    reread();
    // Running low: the warning sign with the words, not colour alone.
    const low = await screen.findByText(/Lit, 1 turn left/);
    expect(low.querySelector('.warning-sign')).not.toBeNull();
    expect(ringShare(screen.getByRole('button', { name: 'Put out Rushlight' }))).toBeCloseTo(1 / 6, 3);
  });

  it('is dashed with no arc for a light with no burn time', async () => {
    const t = table();
    t.carry('line-moss', 'Glow moss', 1, { item_data: { lightTypeId: 'glow-moss' } });
    show(t);
    const user = userEvent.setup();
    expect(await screen.findByText('Not lit. Burns on')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Light Glow moss' }));
    const ring = await screen.findByRole('button', { name: 'Put out Glow moss' });
    expect(ring.querySelector('.status-ring__track--endless')).not.toBeNull();
    expect(ring.querySelector('.status-ring__arc')).toBeNull();
  });
});

describe('the light in At hand (page 35)', () => {
  it('one light: the ring over "Light" lights it at once, toast "Lit Rushlight" with Undo, which puts it out again', async () => {
    const t = table();
    t.carry('line-rush', 'Rushlights', 4, { item_data: { lightTypeId: 'rushlight' } });
    show(t);
    const user = userEvent.setup();
    const ring = await screen.findByRole('button', { name: 'Light Rushlight' });
    // The ring empty (no arc) over its verb; the name and "Not lit. 6 turns each" beside it (35E1). No heading.
    expect(ring.textContent).toBe('Light');
    expect(ring.querySelector('.status-ring__arc')).toBeNull();
    expect(screen.getByText('Rushlights ×4')).toBeTruthy();
    expect(screen.getByText('Not lit. 6 turns each')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
    await user.click(ring);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByText('Lit, 6 turns left')).toBeTruthy();
    await user.click(within(await toastOf('Lit Rushlight')).getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('button', { name: 'Light Rushlight' })).toBeTruthy();
  });

  it('lit: the ring over "Put out" puts it out at once, keeping its time, toast "Put out Rushlight"; Undo brings the lit row back in place', async () => {
    const t = table();
    t.carry('line-rush', 'Rushlights', 4, { item_data: { lightTypeId: 'rushlight' } });
    show(t);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Light Rushlight' }));
    const lit = await screen.findByRole('button', { name: 'Put out Rushlight' });
    expect(lit.textContent).toBe('Put out');
    // No toggle for lit or out (lt-1).
    expect(screen.queryByRole('switch', { name: /: lit$/ })).toBeNull();
    const block = lit.closest('.light-block')!;
    const place = [...block.parentElement!.children].indexOf(block);
    await user.click(lit);
    expect(screen.queryByRole('dialog')).toBeNull();
    // Out at once, in its place, not lit: its time kept.
    expect(await screen.findByRole('button', { name: 'Light Rushlight' })).toBeTruthy();
    expect(screen.getByText('Not lit. 6 turns left')).toBeTruthy();
    expect(world.tables.character_lights.find((l) => l.actor_id === t.wren)).toMatchObject({ lit_at: null, left_seconds: 6 * TURN });
    // Keep lit shows only while a light burns.
    expect(screen.queryByRole('switch')).toBeNull();
    await user.click(within(await toastOf('Put out Rushlight')).getByRole('button', { name: 'Undo' }));
    const back = await screen.findByRole('button', { name: 'Put out Rushlight' });
    const backBlock = back.closest('.light-block')!;
    expect([...backBlock.parentElement!.children].indexOf(backBlock)).toBe(place);
    expect(screen.getByText('Lit, 6 turns left')).toBeTruthy();
  });

  it('several: the ring over "Light…" opens "Which light?", and the one tapped is lit', async () => {
    const t = table();
    t.carry('line-rush', 'Rushlights', 2, { item_data: { lightTypeId: 'rushlight' } });
    t.carry('line-lamp', 'Reed lamp', 1, { item_data: { lightTypeId: 'reed-lamp' } });
    show(t);
    const user = userEvent.setup();
    const ring = await screen.findByRole('button', { name: 'Light: choose which' });
    expect(ring.textContent).toBe('Light…');
    expect(screen.getByText('No light lit')).toBeTruthy();
    expect(screen.getByText('Rushlights ×2; Reed lamp')).toBeTruthy();
    await user.click(ring);
    const pick = await screen.findByRole('dialog', { name: 'Which light?' });
    await user.click(within(pick).getByRole('button', { name: 'Reed lamp, 4 turns' }));
    expect(await screen.findByRole('button', { name: 'Put out Reed lamp' })).toBeTruthy();
  });

  it("Keep lit's row: its name, ⓘ, Refill and the switch in that order, off until switched on", async () => {
    const t = table();
    t.carry('line-lamp', 'Reed lamp', 1, { item_data: { lightTypeId: 'reed-lamp' } });
    t.carry('line-oil', 'Fen oil', 2, { source_entry_id: 'fen-oil' });
    show(t);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Light Reed lamp' }));
    const keep = await screen.findByRole('switch', { name: 'Keep lit' });
    expect(keep.getAttribute('aria-checked')).toBe('false');
    const keepRow = keep.closest('.light-block__keep')!;
    expect([...keepRow.querySelectorAll('.keep-lit__name, button')].map((c) => c.getAttribute('aria-label') ?? c.textContent)).toEqual(['Keep lit', 'About Keep lit', 'Refill', 'Keep lit']);
    // Under the light's own row.
    expect(keepRow.previousElementSibling?.classList.contains('light-block__row')).toBe(true);
    await user.click(keep);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Keep lit' }).getAttribute('aria-checked')).toBe('true'));
    expect(await screen.findByText('Reed lamp will be kept lit')).toBeTruthy();
    // ⓘ says what it does.
    await user.click(screen.getByRole('button', { name: 'About Keep lit' }));
    expect(within(await screen.findByRole('dialog', { name: 'Keep lit' })).getByText(/another one from this character's own pack is lit/)).toBeTruthy();
  });

  it("a lit lamp's line counts its refills, and Refill is a stacked button with the jug that uses one", async () => {
    const t = table();
    t.carry('line-lamp', 'Reed lamp', 1, { item_data: { lightTypeId: 'reed-lamp' } });
    t.carry('line-oil', 'Fen oil', 2, { source_entry_id: 'fen-oil' });
    show(t);
    const user = userEvent.setup();
    expect(await screen.findByText('Not lit. 4 turns. 2 refills left')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Light Reed lamp' }));
    expect(await screen.findByText('Lit, 4 turns left. 2 refills left')).toBeTruthy();
    const refill = screen.getByRole('button', { name: 'Refill' });
    expect(refill.classList.contains('stacked-button')).toBe(true);
    expect(refill.querySelector('svg')).not.toBeNull();
    await user.click(refill);
    expect(await screen.findByText('Lit, 4 turns left. 1 refill left')).toBeTruthy();
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-oil')?.qty).toBe(1);
  });

  it('burnt out by the clock: the toast offers Light another (no Undo), which lights the next; then none are left, the words alone', async () => {
    const t = table();
    t.carry('line-rush', 'Rushlights', 2, { item_data: { lightTypeId: 'rushlight' } });
    const { reread } = show(t);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Light Rushlight' }));
    await screen.findByRole('button', { name: 'Put out Rushlight' });
    await gmMoves(t, 6);
    reread();
    const host = await toastOf('Rushlight burnt out');
    expect(within(host).queryByRole('button', { name: 'Undo' })).toBeNull();
    // One of the stack was used up.
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-rush')?.qty).toBe(1);
    await user.click(within(host).getByRole('button', { name: 'Light another' }));
    expect(await screen.findByRole('button', { name: 'Put out Rushlight' })).toBeTruthy();
    await gmMoves(t, 6);
    reread();
    expect(await screen.findAllByText('Rushlight burnt out, No rushlights left')).not.toHaveLength(0);
    expect(world.tables.inventory_lines.some((l) => l.id === 'line-rush')).toBe(false);
    // The block: the ring struck through, a picture, the words alone and no button.
    const block = screen.getByRole('region', { name: 'At hand' });
    expect(within(block).getByRole('img', { name: 'Rushlight, burnt out' })).toBeTruthy();
    expect(within(block).getByText('Burnt out. No rushlights left')).toBeTruthy();
    expect(within(block).queryByRole('button')).toBeNull();
  });

  it('a burnt-out lamp: the ring a picture; Refill uses one flask and lights it again', async () => {
    const t = table();
    t.carry('line-lamp', 'Reed lamp', 1, { item_data: { lightTypeId: 'reed-lamp' } });
    t.carry('line-oil', 'Fen oil', 2, { source_entry_id: 'fen-oil' });
    const { reread } = show(t);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Light Reed lamp' }));
    await screen.findByRole('button', { name: 'Put out Reed lamp' });
    await gmMoves(t, 4);
    reread();
    const block = screen.getByRole('region', { name: 'At hand' });
    expect(await within(block).findByText('Burnt out. 2 refills left')).toBeTruthy();
    expect(within(block).getByRole('img', { name: 'Reed lamp, burnt out' })).toBeTruthy();
    expect(within(block).queryByRole('button', { name: /^(Light|Put out) Reed lamp/ })).toBeNull();
    // Nothing else to light: Refill alone.
    expect(within(block).queryByRole('button', { name: 'Light another' })).toBeNull();
    await user.click(within(block).getByRole('button', { name: 'Refill' }));
    expect(await screen.findByRole('button', { name: 'Put out Reed lamp' })).toBeTruthy();
    expect(screen.getByText('Lit, 4 turns left. 1 refill left')).toBeTruthy();
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-oil')?.qty).toBe(1);
  });

  it("burnt out with fuel and another light: Refill and Light another, one width; switching back doesn't light the empty lamp, the pick offers Refill and light", async () => {
    const t = table();
    t.carry('line-lamp', 'Reed lamp', 1, { item_data: { lightTypeId: 'reed-lamp' } });
    t.carry('line-rush', 'Rushlights', 2, { item_data: { lightTypeId: 'rushlight' } });
    t.carry('line-oil', 'Fen oil', 2, { source_entry_id: 'fen-oil' });
    const { reread } = show(t);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Light: choose which' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Which light?' })).getByRole('button', { name: /^Reed lamp/ }));
    await screen.findByRole('button', { name: 'Put out Reed lamp' });
    await gmMoves(t, 4);
    reread();
    const block = screen.getByRole('region', { name: 'At hand' });
    const another = await within(block).findByRole('button', { name: 'Light another' });
    const refill = within(block).getByRole('button', { name: 'Refill' });
    // The two in one group (one width), Refill first.
    expect(another.parentElement).toBe(refill.parentElement);
    expect(another.parentElement!.classList.contains('stacked-group')).toBe(true);
    expect([...another.parentElement!.children]).toEqual([refill, another]);
    // Light another: the rushlight (the lamp is out of the running), then put it out.
    await user.click(another);
    await user.click(await screen.findByRole('button', { name: 'Put out Rushlight' }));
    await user.click(await screen.findByRole('button', { name: 'Light: choose which' }));
    const pick = await screen.findByRole('dialog', { name: 'Which light?' });
    expect(within(pick).getAllByRole('button').filter((b) => /^Reed lamp/.test(b.textContent ?? '')).map((b) => b.textContent)).toEqual(['Reed lamp, 4 turns, Refill and light (2 left)']);
    await user.click(within(pick).getByRole('button', { name: 'Reed lamp, 4 turns, Refill and light (2 left)' }));
    expect(await screen.findByRole('button', { name: 'Put out Reed lamp' })).toBeTruthy();
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
    const pickOne = async (name: RegExp | string) => {
      await user.click(await screen.findByRole('button', { name: 'Light: choose which' }));
      await user.click(within(await screen.findByRole('dialog', { name: 'Which light?' })).getByRole('button', { name }));
    };
    await pickOne(/^Reed lamp/);
    await screen.findByText('Lit, 4 turns left. 2 refills left');
    // One turn burns, then the lamp is put out and a rushlight lit instead.
    await gmMoves(t, 1);
    reread();
    await screen.findByText('Lit, 3 turns left. 2 refills left');
    await user.click(screen.getByRole('button', { name: 'Put out Reed lamp' }));
    // Put out with another light in the pack: "No light lit", what there is, the lamp with its fuel (⚑ 3).
    expect(await screen.findByText('Reed lamp, 3 turns left; Rushlights ×2')).toBeTruthy();
    await pickOne(/^Rushlights/);
    await screen.findByText('Lit, 6 turns left');
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-lamp')?.fuel_left_seconds).toBe(3 * TURN);
    await gmMoves(t, 2);
    reread();
    await screen.findByText('Lit, 4 turns left');
    // Back to the lamp: the pick says the fuel left in it, and it burns on from there (no flask used).
    await user.click(screen.getByRole('button', { name: 'Put out Rushlight' }));
    await pickOne('Reed lamp, 3 turns left');
    expect(await screen.findByText('Lit, 3 turns left. 2 refills left')).toBeTruthy();
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-oil')?.qty).toBe(2);
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-lamp')?.fuel_left_seconds).toBeNull();
    // The rushlight's leftover 4 turns are gone: lit again, it starts a fresh one (6 turns).
    await user.click(screen.getByRole('button', { name: 'Put out Reed lamp' }));
    await pickOne(/^Rushlights/);
    expect(await screen.findByText('Lit, 6 turns left')).toBeTruthy();
  });
});
