// @vitest-environment jsdom
// Row C10 of plans/test-feedback-2026-11-19.md (tfr-4, tfr-5; mockup page M1, approved 2026-11-19 with fixes), on the
// invented fixture pack scripts/fixtures/m5b-creation.fixture.json. Purposes:
//   The Player tab has no "Full character sheet" heading and no Edit, on a tablet or a phone (tfr-4).
//   The rows that sat under that heading stay and still open; on a phone they stand where the one row "Full character
//   sheet" was, after Skills and Languages (tfr-5).
//   On Your characters, a character the GM has approved and one waiting for approval each carry Edit with the quill at
//   the card's top right; a sent-back, a not-sent and an archived one carry none (M1's second frame).
//   Edit opens the sheet's form straight from the card; Cancel and Save come back to Your characters, Save with its line.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ICON_SET } from '../ui/iconSet.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { openFullSheetFromMenu } from '../testing/openFullSheet.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
type User = ReturnType<typeof userEvent.setup>;

/** A window this many pixels wide (jsdom has no layout): matchMedia answers min-width and max-width queries. */
function windowOf(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = (!min || width >= Number(min[1])) && (!max || width <= Number(max[1])) && Boolean(min || max);
    return { matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
  }) as typeof window.matchMedia;
}

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  windowOf(375);
});

afterEach(() => {
  cleanup();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;

/** The fixture on a campaign; Wren (approved, active) for Sam, and the other cards a list can show. */
function fenWorld({ toFinish = false } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const o of pack.options ?? []) entry('option', o);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  for (const t of pack.traitLists!) entry('traitList', t);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const character = (name: string, approval: 'approved' | 'pending' | 'rejected' | 'draft', more: Record<string, unknown> = {}) => {
    const id = world.addCharacter(campaign, name, { ownerId: me, approval });
    Object.assign(world.tables.actors.find((a) => a.id === id)!, {
      level: 1,
      hp_current: 6,
      hp_max: 9,
      race_ref: 'bog-folk',
      fields: { MUS: 13, NIM: 12, GRT: 11, WIT: 14, LORE: 9, CHARM: 10 },
      classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }],
      ...more,
    });
    return id;
  };
  const wren = character('Wren', 'approved', toFinish ? { creation: { toFinish: ['languages'] } } : {});
  world.addMember(campaign, me, 'player', wren);
  character('Sedge Longreed of the Drowned Bell Causeway', 'approved');
  character('Odo', 'pending');
  character('Tam', 'rejected');
  character('Rush', 'draft');
  character('Old Harrow', 'approved', { status: 'archived' });
  world.signInAs(me);
  return { wren };
}

async function openPlayer(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await screen.findByRole('region', { name: 'Vitals' });
}

/** Your characters, from the campaign's menu (the drawer on a phone, ⋯ on a tablet). */
async function openYourCharacters(user: User) {
  await openPlayer(user);
  await user.click(screen.getByRole('button', { name: window.innerWidth < 600 ? 'Menu' : 'Character options' }));
  await user.click(screen.getByRole('button', { name: 'Your characters' }));
  await screen.findByText("Level 1, waiting for your GM's approval.");
}

/** The card a character's name sits on. */
const cardOf = (name: string) => screen.getByText(name, { selector: '.character-card__name' }).closest('.character-card') as HTMLElement;

describe('the Player tab without "Full character sheet" and its Edit (tfr-4, tfr-5)', () => {
  it('on a tablet the tab has no "Full character sheet" heading and no Edit, and its rows still open', async () => {
    // Purpose: tfr-4 takes the heading and Edit off the tab; tfr-5 keeps the rows under it, each still opening.
    windowOf(1024);
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const notes = await screen.findByRole('button', { name: 'Notes' });
    expect(screen.queryByRole('heading', { name: 'Full character sheet' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Full character sheet' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Full character sheet' })).toBeNull();
    for (const name of [/^Abilities/, /^Traits/]) expect(screen.getByRole('button', { name }).querySelector('.list-row__chevron')).not.toBeNull();
    await user.click(notes);
    expect(await screen.findByRole('dialog', { name: /Notes/ })).toBeTruthy();
  });

  it('on a phone the rows stand where the one "Full character sheet" row was, after Skills, and open', async () => {
    // Purpose: tfr-5 on a phone: no row "Full character sheet", no Edit; the rows themselves, last, each opening.
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const notes = await screen.findByRole('button', { name: 'Notes' });
    expect(screen.queryByRole('button', { name: 'Full character sheet' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Full character sheet' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
    const skills = screen.getByRole('region', { name: 'Skills' });
    expect(skills.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const name of [/^Abilities/, /^Traits/]) expect(screen.getByRole('button', { name }).querySelector('.list-row__chevron')).not.toBeNull();
    // One "Opening…" at most while the sheet is read: the rows' section never repeats it.
    expect(screen.queryAllByText('Opening…').length).toBeLessThanOrEqual(1);
    await user.click(notes);
    expect(await screen.findByRole('dialog', { name: /Notes/ })).toBeTruthy();
  });
});

describe('"To finish" is off the Player tab’s columns: it is a notice in the notices box (row C1, tfn-2)', () => {
  it('on a phone the card is not among the rows; the Full sheet page from the menu shows it', async () => {
    // Purpose: M1f draws no "To finish" among the phone's rows; it is in the notices box, and the Full sheet page keeps it.
    fenWorld({ toFinish: true });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    await screen.findByRole('button', { name: 'Notes' });
    expect(screen.queryByRole('region', { name: 'To finish' })).toBeNull();
    await openFullSheetFromMenu(user);
    expect(await screen.findByRole('region', { name: 'To finish' })).toBeTruthy();
  });

  it('on a tablet held sideways the box reads "1 notice" and its sheet shows "To finish" with its step', async () => {
    // Purpose: beside, "To finish" leaves the right column for the notices box (row C1, tfn-2; frame M1e), its steps as rows.
    windowOf(1024);
    fenWorld({ toFinish: true });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openPlayer(user);
    const box = await screen.findByRole('button', { name: '1 notice, open them' });
    expect(box.textContent).toBe('1 notice');
    expect(screen.queryByRole('region', { name: 'To finish' })).toBeNull();
    await user.click(box);
    const sheet = within(await screen.findByRole('dialog', { name: 'Notices' }));
    expect(within(sheet.getByRole('region', { name: 'To finish' })).getByRole('button', { name: /Languages/ })).toBeTruthy();
  });
});

describe('Edit, with the quill, on the cards of Your characters (tfr-4; M1, second frame)', () => {
  for (const width of [375, 1024]) {
    it(`an approved card and a waiting card carry Edit with the quill; sent-back, not-sent and archived ones none (${width} px)`, async () => {
      // Purpose: the approved frame: Edit on approved and waiting characters' cards only, the stacked button with the quill.
      windowOf(width);
      fenWorld();
      const user = userEvent.setup();
      render(<Root db={world.db} />);
      await openYourCharacters(user);
      for (const name of ['Wren', 'Sedge Longreed of the Drowned Bell Causeway', 'Odo']) {
        const edit = within(cardOf(name)).getByRole('button', { name: `Edit ${name}` });
        expect(edit.textContent).toBe('Edit');
        expect(edit.classList.contains('stacked-button')).toBe(true);
        expect(edit.querySelector('path')!.getAttribute('d')).toBe(ICON_SET['quill-ink'].d);
      }
      for (const name of ['Tam', 'Rush']) expect(within(cardOf(name)).queryByRole('button', { name: /^Edit/ })).toBeNull();
      await user.click(screen.getByText(/^Archived characters/));
      expect(within(cardOf('Old Harrow')).queryByRole('button', { name: /^Edit/ })).toBeNull();
    });
  }

  it('Edit opens the sheet’s form straight from the card; Cancel comes back to Your characters', async () => {
    // Purpose: a card's Edit is the form it opened on the Player tab, and leaving it lands where it was opened.
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openYourCharacters(user);
    await user.click(screen.getByRole('button', { name: 'Edit Odo' }));
    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    expect(screen.getByRole('heading', { name: 'Odo', level: 1 })).toBeTruthy();
    await user.click(cancel);
    await screen.findByText("Level 1, waiting for your GM's approval.");
    expect(screen.getByRole('button', { name: 'Edit Odo' })).toBeTruthy();
  });

  it('Save comes back to Your characters with its line, and the change is kept', async () => {
    // Purpose: the line shown after an Edit is saved (it sat on the sheet) shows on the list the player came back to.
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openYourCharacters(user);
    await user.click(screen.getByRole('button', { name: 'Edit Odo' }));
    await user.click(await screen.findByRole('button', { name: 'Name: Odo. Change it' }));
    const sheet = await screen.findByRole('dialog', { name: 'Name' });
    const name = within(sheet).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Odo Fenwick');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Name' })).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Saved.')).toBeTruthy();
    await waitFor(() => expect(cardOf('Odo Fenwick')).toBeTruthy());
    expect(within(cardOf('Odo Fenwick')).getByRole('button', { name: 'Edit Odo Fenwick' })).toBeTruthy();
  });

  it('Edit on an approved character sends a max HP change to the GM and comes back with "Sent to your GM."', async () => {
    // Purpose: an approved character's max HP change is a request, as from the Player tab's Edit; the list says it was sent.
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openYourCharacters(user);
    const name = 'Sedge Longreed of the Drowned Bell Causeway';
    await user.click(screen.getByRole('button', { name: `Edit ${name}` }));
    const form = within(await screen.findByRole('form', { name: `Edit ${name}` }));
    await user.click(form.getByRole('button', { name: 'More Max HP' }));
    await user.click(form.getByRole('button', { name: 'Send to the GM' }));
    await screen.findByText("Level 1, waiting for your GM's approval.");
    expect(await screen.findByText('Sent to your GM.')).toBeTruthy();
    await waitFor(() => expect(world.tables.sheet_changes).toHaveLength(1));
    expect(world.tables.sheet_changes[0]).toMatchObject({ from_value: 9, to_value: 10, status: 'waiting' });
    expect(within(cardOf(name)).getByRole('button', { name: `Edit ${name}` })).toBeTruthy();
  });
});
