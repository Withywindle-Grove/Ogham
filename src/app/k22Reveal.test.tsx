// @vitest-environment jsdom
// K22's screens (batch K2: rows K22c, K22d, K22e of docs/plans/k22-reveal.md; page 33, approved 2026-11-21), on the
// stand-in database. Invented names and figures: Wren's Bronze ring is the Ring of the Drowned Bell, unidentified.
//   Purpose:
//   1. "Edit what players see…" shows on the unidentified ring under "Reveal…", in the GM's view and outside it, and
//      not on a wand that is named with hidden charges; Sam's own sheet has neither row (K22c, pick 1).
//   2. The form opens with the line's two words; both emptied and saved, the toast says so with Undo, the ring reads as
//      its category's singular name, and Undo puts the old words back (K22c, k22-3).
//   3. Save with nothing changed closes, with no toast and no log line (K22c).
//   4. A tap on "That it's cursed" tells it at once: its row and "That it's magic" read "Told" and are no longer buttons,
//      the pop-up stays open, the toast says "Told Wren: the Bronze ring is cursed." with Undo, and Undo shows both rows
//      hidden again (K22d, k22-5, k22-6, pick 6).
//   5. "Tell them everything" tells every row, the foot reads "Nothing is left hidden." with no accent; closed, the
//      sheet has no GM line, no "Reveal…" and no edit row (K22d, pick 7).
//   6. Opened again after the curse was told, only what is still hidden is listed (K22e, 5).
//   7. A list of one keeps "Tell them everything"; in the Party stash the pop-up's line and the toast name "the party".
//   8. A failed tell says "Couldn't tell Wren. Try again." above the foot, and the row stays a button (K22j).
//   9. No "Reveal the count" and no "Reveal <field>" button is left on the GM's own sheet (k22-8).
//  10. Sam's sheet of the untold ring shows its face, its look and "What you notice", and none of the truth; then each
//      told fact as K22h draws it: "Magic." alone; "Magic, cursed." and the bonus row with "What you notice" still
//      there; the true name as its heading with "What you notice" gone; everything: the description in place of the
//      look, and the source line (K22e, pick 11, his fix). An emptied "What you notice" leaves no line.
//  11. In the GM's view the GM's line lists only what is still hidden (K22g 1 to 3).
//  12. Outside the view the GM's own Pack reads the true name, row and sheet, with "Players see: Bronze ring" (K22g 4, ⚑ 10).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand } from '../core/commands.ts';
import { forgetFileLinks } from '../core/files.ts';
import { tellItem } from '../modules/inventory/inventory.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
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

const RING = {
  id: 'drowned-bell',
  name: 'Ring of the Drowned Bell',
  category: 'ring',
  slot: 'ring',
  looks: 'A plain band of old bronze.',
  appearsAs: 'Bronze ring',
  noticed: 'Cold to the touch, even by the fire.',
  bonus: '+1 to saves',
  cursed: true,
  description: 'Cast from the bronze of a sunken bell. Its wearer is steadier against harm.',
  source: 'p. 14',
  gmOnly: ['bonus'],
};

/** An inventory line, with the stand-in database's defaults. */
function line(id: string, name: string, extra: Record<string, unknown> = {}) {
  world.tables.inventory_lines.push({
    id,
    campaign_id: campaign,
    actor_id: wren,
    location_id: null,
    library_entry_id: null,
    name,
    category: 'gear',
    weight_coin: null,
    slots: null,
    stack: 1,
    qty: 1,
    container_line_id: null,
    equipped: false,
    how_got: 'found',
    cost: '',
    notes: '',
    item_data: {},
    source_pack_id: null,
    source_entry_id: null,
    charges_left: null,
    charges_hidden: false,
    charges_used: 0,
    spent_shown: false,
    last_roll: null,
    pinned: false,
    at_hand_hidden: false,
    approval: 'approved',
    per_units: 1,
    version: 1,
    identified: true,
    appears_as: '',
    noticed: '',
    revealed_fields: [],
    created_at: `2026-10-23T10:00:0${world.tables.inventory_lines.length}Z`,
    ...extra,
  });
}

/** The ring as the database stores it unidentified (K22a): its face, its look, nothing told. */
function ringLine(extra: Record<string, unknown> = {}) {
  line('line-ring', 'Bronze ring', {
    category: 'ring',
    library_entry_id: 'entry-drowned-bell',
    source_pack_id: 'pack-fen',
    source_entry_id: 'drowned-bell',
    identified: false,
    appears_as: 'Bronze ring',
    noticed: RING.noticed,
    item_data: { id: 'drowned-bell', category: 'ring', slot: 'ring', looks: RING.looks },
    ...extra,
  });
}

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
  campaign = world.addCampaign('The Reed Marches', gm);
  wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { encumbrance: { mode: 'coin' } } });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown> = {}) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', {
    itemCategories: [{ id: 'ring', name: 'Rings', singular: 'Ring', unidentified: true }],
    magicItems: { charges: { wand: '2d10', hidden: true, rechargeable: false } },
  });
  entry('item', 'drowned-bell', RING.name, RING);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  ringLine();
  line('line-wand', 'Ash wand', { category: 'wand', charges_hidden: true, charges_used: 2 });
  world.tables.inventory_line_secrets.push({ id: 'line-wand', campaign_id: campaign, charges_total: 5, spent: false });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type User = ReturnType<typeof userEvent.setup>;
const ring = () => world.tables.inventory_lines.find((l) => l.id === 'line-ring')!;

/** The GM opens Wren's Pack from the Players row: the view, on its Pack tab. */
async function openInView(): Promise<User> {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Reed Marches/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
  await user.click(await screen.findByRole('button', { name: "Open Wren's pack" }));
  await screen.findByRole('note');
  return user;
}

/** The GM's own Pack screen for Wren, outside the view (Players › Inventory › Whose pack). */
async function openOutside(): Promise<User> {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Reed Marches/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
  await user.click(await screen.findByRole('button', { name: 'Inventory' }));
  await user.click(within(await screen.findByRole('group', { name: 'Whose pack' })).getByRole('button', { name: 'Wren' }));
  return user;
}

/** Sam opens his own Pack. */
async function openAsSam(): Promise<User> {
  world.signInAs(sam);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Reed Marches/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
  return user;
}

/** The GM tells facts of the ring straight through the command, as his pop-up does. */
async function tell(fact: string) {
  world.signInAs(gm);
  const told = await runCommand(registry, world.db, { id: gm, roles: { [campaign]: 'gm' } }, tellItem, {
    line: { id: 'line-ring', carrier: { campaignId: campaign, actorId: wren, locationId: null, ownerUserId: sam, archived: false }, version: Number(ring().version) },
    fact: fact as never,
  });
  expect(told.ok).toBe(true);
}

const rows = () => within(screen.getByRole('group', { name: 'Item actions' }));

describe('K22c: "Edit what players see…" and its form', () => {
  it('shows under Reveal… on the unidentified ring, in the view and out of it; not on the wand; never on Sam’s sheet', async () => {
    let user = await openInView();
    await user.click(await screen.findByRole('button', { name: /^Bronze ring/ }));
    let words = rows().getAllByRole('button').map((b) => b.textContent);
    expect(words.indexOf('Edit what players see…')).toBe(words.indexOf('Reveal…') + 1);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: /^Ash wand/ }));
    expect(rows().getByRole('button', { name: 'Reveal…' })).toBeTruthy();
    expect(rows().queryByRole('button', { name: 'Edit what players see…' })).toBeNull();
    cleanup();

    user = await openOutside();
    await user.click(await screen.findByRole('button', { name: /^Ring of the Drowned Bell/ }));
    words = rows().getAllByRole('button').map((b) => b.textContent);
    expect(words.indexOf('Edit what players see…')).toBe(words.indexOf('Reveal…') + 1);
    cleanup();

    user = await openAsSam();
    await user.click(await screen.findByRole('button', { name: /^Bronze ring/ }));
    expect(screen.queryByRole('button', { name: 'Reveal…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit what players see…' })).toBeNull();
  });

  it('opens with the line’s words; both emptied and saved, the toast has Undo, which puts the old words back', async () => {
    const user = await openInView();
    await user.click(await screen.findByRole('button', { name: /^Bronze ring/ }));
    await user.click(screen.getByRole('button', { name: 'Edit what players see…' }));
    const form = within(await screen.findByRole('dialog', { name: 'What players see' }));
    expect((form.getByLabelText('Appears as') as HTMLTextAreaElement).value).toBe('Bronze ring');
    expect((form.getByLabelText('What you notice') as HTMLTextAreaElement).value).toBe(RING.noticed);
    expect(form.getByText('Left empty, it reads as “Ring”.')).toBeTruthy();
    expect(form.getByText('Left empty, players see no such line.')).toBeTruthy();
    await user.clear(form.getByLabelText('Appears as'));
    await user.clear(form.getByLabelText('What you notice'));
    await user.click(form.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ring()).toMatchObject({ appears_as: '', noticed: '', name: 'Ring' }));
    expect(await screen.findByText('Changed what players see of the Bronze ring.')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'What players see' })).toBeNull();
    expect(world.tables.events.filter((e) => e.type === 'inventory.editLook').map((e) => e.actor_user_id)).toEqual([gm]);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(ring()).toMatchObject({ appears_as: 'Bronze ring', noticed: RING.noticed, name: 'Bronze ring' }));
  });

  it('Save with nothing changed closes, with no toast and no log line', async () => {
    const user = await openInView();
    await user.click(await screen.findByRole('button', { name: /^Bronze ring/ }));
    await user.click(screen.getByRole('button', { name: 'Edit what players see…' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'What players see' })).getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('dialog', { name: 'What players see' })).toBeNull();
    expect(screen.queryByText(/Changed what players see/)).toBeNull();
    expect(world.tables.events.filter((e) => e.type === 'inventory.editLook')).toHaveLength(0);
  });
});

describe('K22d: the Reveal pop-up', () => {
  async function openReveal(user: User, row = /^Bronze ring/) {
    await user.click(await screen.findByRole('button', { name: row }));
    await user.click(screen.getByRole('button', { name: 'Reveal…' }));
    return within(await screen.findByRole('dialog', { name: 'Reveal' }));
  }

  it('a tap tells at once: the row and "That it’s magic" read Told, the pop-up stays, the toast has Undo, Undo hides both again', async () => {
    const user = await openInView();
    const popup = await openReveal(user);
    expect(popup.getByText('Bronze ring, in Wren’s pack')).toBeTruthy();
    // The ring's facts in the pop-up's order (k22-4), what each is under it.
    expect(popup.getAllByRole('button', { name: /^Tell (?!them)/ }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Tell That it’s magic',
      'Tell Its true name: Ring of the Drowned Bell',
      'Tell Its bonus: +1 to saves',
      'Tell That it’s cursed',
    ]);
    await user.click(popup.getByRole('button', { name: 'Tell That it’s cursed' }));
    await waitFor(() => expect(ring().revealed_fields).toEqual(['magic', 'cursed']));
    expect(await screen.findByText('Told Wren: the Bronze ring is cursed.')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Reveal' })).toBeTruthy();
    expect(popup.queryByRole('button', { name: 'Tell That it’s cursed' })).toBeNull();
    expect(popup.queryByRole('button', { name: 'Tell That it’s magic' })).toBeNull();
    expect(popup.getAllByText('Told')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(ring().revealed_fields ?? []).toEqual([]));
    expect(await popup.findByRole('button', { name: 'Tell That it’s cursed' })).toBeTruthy();
    expect(popup.getByRole('button', { name: 'Tell That it’s magic' })).toBeTruthy();
    expect(popup.queryByText('Told')).toBeNull();
  });

  it('"Tell them everything" tells every row and the foot reads "Nothing is left hidden."; closed, no GM line and no rows', async () => {
    const user = await openInView();
    const popup = await openReveal(user);
    await user.click(popup.getByRole('button', { name: 'Tell them everything' }));
    expect(await popup.findByText('Nothing is left hidden.')).toBeTruthy();
    expect(popup.queryByRole('button', { name: 'Tell them everything' })).toBeNull();
    expect(popup.getAllByText('Told')).toHaveLength(4);
    expect(screen.getByText('Told Wren everything about the Ring of the Drowned Bell.')).toBeTruthy();
    expect(ring()).toMatchObject({ name: 'Ring of the Drowned Bell', identified: true });
    await user.click(within(screen.getByRole('dialog', { name: 'Reveal' })).getByRole('button', { name: 'Close' }));
    const sheet = within(screen.getByRole('region', { name: 'Ring of the Drowned Bell' }));
    expect(sheet.queryByText(/Only you see this/)).toBeNull();
    expect(sheet.queryByRole('button', { name: 'Reveal…' })).toBeNull();
    expect(sheet.queryByRole('button', { name: 'Edit what players see…' })).toBeNull();
  });

  // Purpose: charges hidden but never rolled (no count in the secret) can't be told yet, so the pop-up offers no tap that
  // would fail: "Its charges" is a quiet row reading "Not set yet", and "Tell them everything" tells every other fact.
  it.fails('with hidden charges never set, "Its charges" is no button and "Tell them everything" tells the rest', async () => {
    Object.assign(ring(), { charges_hidden: true });
    const user = await openInView();
    const popup = await openReveal(user);
    expect(popup.queryByRole('button', { name: /^Tell Its charges/ })).toBeNull();
    expect(popup.getByText('Not set yet')).toBeTruthy();
    await user.click(popup.getByRole('button', { name: 'Tell them everything' }));
    await waitFor(() => expect(ring().revealed_fields).toEqual(['magic', 'name', 'bonus', 'cursed']));
    expect(ring()).toMatchObject({ name: 'Ring of the Drowned Bell', identified: true, charges_hidden: true });
    expect(await screen.findByText('Told Wren everything about the Ring of the Drowned Bell but its charges.')).toBeTruthy();
    expect(popup.queryByText(/Couldn’t tell/)).toBeNull();
    expect(popup.getAllByText('Told')).toHaveLength(4);
    expect(popup.queryByRole('button', { name: 'Tell them everything' })).toBeNull();
    expect(popup.getByText('Set its charges first, then tell them.')).toBeTruthy();
  });

  // Purpose: when the database refuses a tell, the pop-up says why in the database's own words, not "Try again".
  it.fails('a tell the database refuses shows its own words', async () => {
    const user = await openInView();
    const popup = await openReveal(user);
    const real = world.db.rpc.bind(world.db);
    vi.spyOn(world.db, 'rpc').mockImplementation(((name: string, args: Record<string, unknown>) =>
      name === 'tell_item' ? Promise.resolve({ data: null, error: { message: "Its setting rules are gone, so its name can't be told.", code: 'P0001' } }) : real(name as never, args as never)) as never);
    await user.click(popup.getByRole('button', { name: 'Tell Its true name: Ring of the Drowned Bell' }));
    expect(await popup.findByText(/Its setting rules are gone, so its name can't be told\./)).toBeTruthy();
    expect(popup.queryByText(/Try again/)).toBeNull();
  });

  it('opened again after the curse was told, only what is still hidden is listed', async () => {
    await tell('cursed');
    const user = await openInView();
    const popup = await openReveal(user);
    expect(popup.getAllByRole('button', { name: /^Tell (?!them)/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['Tell Its true name: Ring of the Drowned Bell', 'Tell Its bonus: +1 to saves']);
    expect(popup.queryByText('Told')).toBeNull();
  });

  it('a list of one keeps "Tell them everything"; in the Party stash the line and the toast name "the party"', async () => {
    Object.assign(world.tables.inventory_lines.find((l) => l.id === 'line-wand')!, { actor_id: null, location_id: `location-stash-${campaign}` });
    const user = await openOutside();
    await user.click(within(screen.getByRole('group', { name: 'Whose pack' })).getByRole('button', { name: 'Party stash' }));
    const popup = await openReveal(user, /^Ash wand/);
    expect(popup.getByText('Ash wand, in the Party stash')).toBeTruthy();
    expect(popup.getAllByRole('button', { name: /^Tell (?!them)/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['Tell Its charges: 3 of 5 left']);
    expect(popup.getByRole('button', { name: 'Tell them everything' })).toBeTruthy();
    await user.click(popup.getByRole('button', { name: 'Tell Its charges: 3 of 5 left' }));
    expect(await screen.findByText('Told the party: the Ash wand has 3 of 5 charges left.')).toBeTruthy();
  });

  it('a failed tell says so above the foot, and the row stays a button', async () => {
    const user = await openInView();
    const popup = await openReveal(user);
    const real = world.db.rpc.bind(world.db);
    vi.spyOn(world.db, 'rpc').mockImplementation(((name: string, args: Record<string, unknown>) =>
      name === 'tell_item' ? Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) : real(name as never, args as never)) as never);
    await user.click(popup.getByRole('button', { name: 'Tell That it’s cursed' }));
    expect(await popup.findByText(/Couldn’t tell Wren\. Try again\./)).toBeTruthy();
    expect(popup.getByRole('button', { name: 'Tell That it’s cursed' })).toBeTruthy();
    expect(screen.queryByText(/^Told Wren/)).toBeNull();
  });

  it('no "Reveal the count" and no "Reveal <field>" button is left on the GM’s own sheet', async () => {
    const user = await openOutside();
    for (const row of [/^Ring of the Drowned Bell/, /^Ash wand/]) {
      await user.click(await screen.findByRole('button', { name: row }));
      const sheet = screen.getAllByRole('region').at(-1)!;
      expect(within(sheet).queryAllByRole('button', { name: /^Reveal(?!…)/ })).toEqual([]);
      await user.click(screen.getByRole('button', { name: 'Close' }));
    }
  });
});

describe("K22e: the player's side, and the GM's line as facts are told", () => {
  /** Sam's sheet of the ring, its words without the actions. */
  async function samsSheet() {
    const user = await openAsSam();
    await user.click(await screen.findByRole('button', { name: /^(Bronze ring|Ring of the Drowned Bell)/ }));
    return screen.getAllByRole('region').at(-1)!;
  }

  it('the untold ring shows its face, look and "What you notice", and none of the truth', async () => {
    const sheet = await samsSheet();
    expect(sheet.getAttribute('aria-label')).toBe('Bronze ring');
    expect(within(sheet).getByText(RING.looks)).toBeTruthy();
    expect(sheet.textContent).toContain(`What you notice. ${RING.noticed}`);
    expect(sheet.textContent).not.toMatch(/Drowned|\+1|ursed|sunken|Magic|From your setting|Looks/);
  });

  it('"That it’s magic" alone: "Magic." and nothing more', async () => {
    await tell('magic');
    const sheet = await samsSheet();
    expect(within(sheet).getByText('Magic.')).toBeTruthy();
    expect(sheet.textContent).not.toMatch(/Drowned|\+1|ursed|sunken/);
  });

  it('the curse and the bonus: "Magic, cursed." and the bonus row; "What you notice" stays', async () => {
    await tell('cursed');
    await tell('bonus');
    const sheet = await samsSheet();
    expect(within(sheet).getByText('Magic, cursed.')).toBeTruthy();
    expect(sheet.textContent).toContain('+1 to saves');
    expect(sheet.textContent).toContain('What you notice.');
    expect(sheet.textContent).not.toMatch(/Cursed\s*Yes|Drowned/);
  });

  it('the true name: its heading, and "What you notice" gone', async () => {
    await tell('name');
    const sheet = await samsSheet();
    expect(sheet.getAttribute('aria-label')).toBe('Ring of the Drowned Bell');
    expect(sheet.textContent).not.toContain('What you notice');
    expect(within(sheet).getByText(RING.looks)).toBeTruthy();
  });

  it('everything: the description in place of the look, and the source line', async () => {
    await tell('everything');
    const sheet = await samsSheet();
    expect(within(sheet).getByText(RING.description)).toBeTruthy();
    expect(within(sheet).queryByText(RING.looks)).toBeNull();
    expect(sheet.textContent).toMatch(/From your setting: .*p\. 14/);
  });

  it('an emptied "What you notice" leaves no line and no hint', async () => {
    Object.assign(ring(), { noticed: '' });
    const sheet = await samsSheet();
    expect(sheet.textContent).not.toMatch(/notice/i);
  });

  it("in the GM's view the GM's line lists only what is still hidden; with nothing hidden, neither line nor Reveal…", async () => {
    let user = await openInView();
    await user.click(await screen.findByRole('button', { name: /^Bronze ring/ }));
    expect(screen.getByText('Only you see this: Ring of the Drowned Bell, +1 to saves, cursed.')).toBeTruthy();
    cleanup();
    await tell('cursed');
    user = await openInView();
    await user.click(await screen.findByRole('button', { name: /^Bronze ring/ }));
    expect(screen.getByText('Only you see this: Ring of the Drowned Bell, +1 to saves.')).toBeTruthy();
    cleanup();
    await tell('everything');
    user = await openInView();
    await user.click(await screen.findByRole('button', { name: /^Ring of the Drowned Bell/ }));
    expect(screen.queryByText(/Only you see this/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reveal…' })).toBeNull();
  });

  it('outside the view the GM’s own Pack reads the true name, with "Players see: Bronze ring" on the sheet', async () => {
    const user = await openOutside();
    await user.click(await screen.findByRole('button', { name: /^Ring of the Drowned Bell/ }));
    const sheet = screen.getByRole('region', { name: 'Ring of the Drowned Bell' });
    expect(within(sheet).getByText('Players see: Bronze ring')).toBeTruthy();
    expect(sheet.textContent).not.toContain('What you notice');
  });
});
