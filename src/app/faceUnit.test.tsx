// @vitest-environment jsdom
// An unidentified item hides its count's unit (piece D of docs/specs/dec5-gaps.md, #191; dg-7, hard rule 5), on the
// holder's Player screen through the real app on the stand-in database. The face the database gives an unidentified
// line carries no unit (…_dec5_d_face_unit.sql; seam 4 tests that part); a tell brings it back. Invented names only
// (hard rule 2). Purposes:
//   The holder's At hand row says "2 of 3 charges" on an unidentified flask whose pack names its unit "dose".
//   After the GM tells its true name, the holder's row says "2 of 3 doses".
//   An unidentified flask whose count is hidden reads "Charges: ?"; after the GM tells its charges, "2 of 3 doses".
//   The GM's own screens read the GM's copy's unit on that flask (#197's review P3; piece C): the Reveal row "Its doses",
//   its toast "…has 2 of 3 doses left.", the GM's line "…, 2 doses left.", and the roll prompts "Doses".
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand } from '../core/commands.ts';
import { tellItem } from '../modules/inventory/inventory.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import type { ResolvedEntry } from '../modules/library/stack.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { ChargesDialog } from './ChargesDialog.tsx';
import { registry } from './services.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let gm: string;
let sam: string;
let campaign: string;
let wren: string;

const FLASK = {
  id: 'salt-sleep',
  name: 'Draught of Salt Sleep',
  category: 'draught',
  appearsAs: 'Grey flask',
  charges: { initial: 3, unit: 'dose' },
};

beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
  campaign = world.addCampaign('The Ash Barrows', gm);
  wren = world.addCharacter(campaign, 'Wren', { ownerId: sam, approval: 'approved' });
  world.addMember(campaign, sam, 'player', wren);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push(
    { id: 'entry-fen-rules', pack_id: 'pack-fen', kind: 'rulesSet', pack_entry_id: 'fen-rules', name: 'Fen rules', data: { id: 'fen-rules', name: 'Fen rules', itemCategories: [{ id: 'draught', name: 'Draughts', singular: 'Draught', unidentified: true }] } },
    { id: 'entry-salt-sleep', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'salt-sleep', name: FLASK.name, data: FLASK },
  );
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The flask as the database stores it unidentified: its face, whose charges carry no unit. */
function flaskLine(extra: Record<string, unknown> = {}) {
  world.tables.inventory_lines.push({
    id: 'line-flask', campaign_id: campaign, actor_id: wren, location_id: null, library_entry_id: 'entry-salt-sleep', name: 'Grey flask',
    category: 'draught', weight_coin: 10, slots: null, stack: 1, qty: 1, container_line_id: null, equipped: false, how_got: 'found', cost: '', notes: '',
    item_data: { id: 'salt-sleep', category: 'draught', charges: { initial: 3 } }, source_pack_id: 'pack-fen', source_entry_id: 'salt-sleep',
    charges_left: 2, charges_hidden: false, charges_used: 1, spent_shown: false, last_roll: null, pinned: true, at_hand_hidden: false,
    approval: 'approved', per_units: 1, version: 1, identified: false, appears_as: 'Grey flask', noticed: '', revealed_fields: [],
    created_at: '2026-11-18T10:00:00Z', ...extra,
  });
}

/** The GM tells a fact of the flask straight through the command, as the Reveal pop-up does. */
async function tell(fact: string) {
  world.signInAs(gm);
  const line = world.tables.inventory_lines.find((l) => l.id === 'line-flask')!;
  const told = await runCommand(registry, world.db, { id: gm, roles: { [campaign]: 'gm' } }, tellItem, {
    line: { id: 'line-flask', carrier: { campaignId: campaign, actorId: wren, locationId: null, ownerUserId: sam, archived: false }, version: Number(line.version) },
    fact: fact as never,
  });
  expect(told.ok).toBe(true);
}

/** Sam opens the Player screen; its At hand region. */
async function atHandAsSam() {
  world.signInAs(sam);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  return within(await screen.findByRole('region', { name: 'At hand' }));
}

describe('an unidentified item hides its unit (dec5-gaps D, dg-7)', () => {
  it('the holder reads "charges" until the true name is told, then the unit', async () => {
    flaskLine();
    let atHand = await atHandAsSam();
    expect(await atHand.findByText('2 of 3 charges')).toBeTruthy();
    expect(screen.queryByText(/dose/)).toBeNull();
    cleanup();
    await tell('name');
    atHand = await atHandAsSam();
    expect(await atHand.findByText('2 of 3 doses')).toBeTruthy();
  });

  it('a hidden count reads "Charges: ?" until its charges are told, then "2 of 3 doses"', async () => {
    flaskLine({ charges_hidden: true, charges_left: null });
    world.tables.inventory_line_secrets.push({ id: 'line-flask', campaign_id: campaign, charges_total: 3, spent: false });
    let atHand = await atHandAsSam();
    expect(await atHand.findByText('Charges: ?')).toBeTruthy();
    cleanup();
    await tell('charges');
    atHand = await atHandAsSam();
    expect(await atHand.findByText('2 of 3 doses')).toBeTruthy();
  });
});

/** The GM opens Wren's Pack from the Players row: the view as the player, on its Pack tab. */
async function inViewAsGm() {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
  await user.click(await screen.findByRole('button', { name: 'Open Wren’s pack' }));
  await screen.findByRole('note');
  return user;
}

/** The GM's own Pack screen for Wren, outside the view (Players › Inventory › Whose pack). */
async function outsideAsGm() {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
  await user.click(await screen.findByRole('button', { name: 'Inventory' }));
  await user.click(within(await screen.findByRole('group', { name: 'Whose pack' })).getByRole('button', { name: 'Wren' }));
  return user;
}

describe('the GM reads the unit from the GM’s copy (dec5-gaps C; #197’s review P3)', () => {
  // Purpose: on an unidentified flask whose line's copy has no unit, the GM's Reveal row says "Its doses" and the toast
  // after telling the count says "doses", from the GM's copy of the entry (the holder's "Charges: ?" is the test above).
  it('the Reveal row and its toast say "doses"', async () => {
    flaskLine({ charges_hidden: true, charges_left: null });
    world.tables.inventory_line_secrets.push({ id: 'line-flask', campaign_id: campaign, charges_total: 3, spent: false });
    const user = await inViewAsGm();
    await user.click(await screen.findByRole('button', { name: /^Grey flask/ }));
    await user.click(screen.getByRole('button', { name: 'Reveal…' }));
    const popup = within(await screen.findByRole('dialog', { name: 'Reveal' }));
    await user.click(popup.getByRole('button', { name: 'Tell Its doses: 2 of 3 left' }));
    expect(await screen.findByText('Told Wren: the Grey flask has 2 of 3 doses left.')).toBeTruthy();
  });

  // Purpose: in the view as the player, the GM's own line on that flask counts in the GM's copy's unit ("2 doses left"),
  // while the player's own count label beside it stays the line's ("Charges").
  it('the GM’s line says "2 doses left"', async () => {
    flaskLine({ charges_hidden: true, charges_left: null });
    world.tables.inventory_line_secrets.push({ id: 'line-flask', campaign_id: campaign, charges_total: 3, spent: false });
    const user = await inViewAsGm();
    await user.click(await screen.findByRole('button', { name: /^Grey flask/ }));
    expect(await screen.findByText('Only you see this: Draught of Salt Sleep, 2 doses left.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Doses' })).toBeNull();
  });

  // Purpose: the GM's roll prompt for a hidden count never set, on the GM's own sheet, is named "Doses", and the count's
  // label there is "Doses" too.
  it('the roll prompt on the GM’s own sheet says "Doses"', async () => {
    flaskLine({ charges_hidden: true, charges_left: null, charges_used: 0 });
    world.tables.inventory_line_secrets.push({ id: 'line-flask', campaign_id: campaign, charges_total: null, spent: false });
    const user = await outsideAsGm();
    await user.click(await screen.findByRole('button', { name: /^Draught of Salt Sleep/ }));
    expect(await screen.findByText('Doses (3): enter the roll')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Doses' })).toBeTruthy();
  });

  // Purpose: the charges prompt when the GM hands the flask out is named in the GM's copy's unit ("Doses of Grey flask"),
  // and with no entry, in the line's ("Charges").
  it('the charges prompt on handing out says "Doses"', async () => {
    const line = { id: 'line-flask', name: 'Grey flask', category: 'draught', details: { charges: { initial: 3 } }, chargesHidden: true } as unknown as InventoryLine;
    const entry = { packId: 'pack-fen', packEntryId: 'salt-sleep', kind: 'item', name: FLASK.name, data: FLASK } as unknown as ResolvedEntry;
    const props = { db: world.db, user: { id: gm, roles: { [campaign]: 'gm' } }, line, rules: { dice: {}, hidden: true }, campaignId: campaign, carrier: { campaignId: campaign, actorId: wren, locationId: null, ownerUserId: sam, archived: false, name: 'Wren' }, busy: false, run: async () => null, onDone: () => undefined } as const;
    render(<ChargesDialog {...(props as unknown as Parameters<typeof ChargesDialog>[0])} entry={entry} />);
    expect(await screen.findByRole('dialog', { name: 'Doses of Grey flask' })).toBeTruthy();
    cleanup();
    render(<ChargesDialog {...(props as unknown as Parameters<typeof ChargesDialog>[0])} />);
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Charges of Grey flask' })).toBeTruthy());
  });
});
