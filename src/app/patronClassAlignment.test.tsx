// @vitest-environment jsdom
// A patron whose followers' alignments a class can't have (the Tester's walk, 2026-11-12; fix-patron-class-alignment):
// the Patron step crosses the patron's `followers.alignments` with the class's alignment limit (cs-3, rc-5). On a copy
// of the invented fixture pack (scripts/fixtures/m5b-creation.fixture.json), where the Marsh Chaplain may only be
// Lantern or Reed (a hard limit), the Mire Stalker is usually Reed or Mire (a soft one) and the Lantern Warden has
// none, with three invented patrons behind an option. Every name is invented.
//   A hard limit the patron's followers don't meet: a not-allowed row ("Not open to marsh chaplain"), no Pick.
//   A soft one: the patron folds with the GM's approval, and picking it flags the draft (special approval "patron").
//   A class whose patrons are all closed isn't stuck on the Patron step, nor held at Send to the GM.
//   A class with no alignment limit sees every patron with its Pick, as before.
// Helpers sit inside the describe block: on a fix- branch new tests come in alone (bq-6, scripts/guard-tests.mjs).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

// The campaign's field list can fail to load (review of #665, nit 4): a flag makes it fail for one test.
const fields = vi.hoisted(() => ({ fail: false }));
vi.mock('../modules/characters/fields.ts', async (original) => {
  const real = await original<typeof import('../modules/characters/fields.ts')>();
  return { ...real, loadFieldDefinitions: (...args: Parameters<typeof real.loadFieldDefinitions>) => (fields.fail ? Promise.resolve(null) : real.loadFieldDefinitions(...args)) };
});

describe('a patron crossed with the class alignment limit', () => {
  type User = ReturnType<typeof userEvent.setup>;
  type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean };
  const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
  const template = pack.fieldTemplates![0]!;
  const layoutFields = template.fields as LayoutField[];
  const OPTION = { id: 'ex-opt-patrons', name: 'Patrons', default: 'off', changeLater: 'allow', choices: [{ id: 'on', name: 'On' }, { id: 'off', name: 'Off' }] };
  // Reed followers: open to the chaplain (Lantern or Reed) and the stalker (Reed or Mire).
  const HERON = { id: 'ex-patron-heron', name: 'The Still Heron', option: 'ex-opt-patrons', blurb: 'Patience in the reeds.', followers: { classes: ['marsh-chaplain', 'mire-stalker'], alignments: ['Reed'] } };
  // Mire followers only: closed to the chaplain (a hard limit), open to the warden (no limit).
  const BELL = { id: 'ex-patron-sunken-bell', name: 'The Sunken Bell', option: 'ex-opt-patrons', blurb: 'Rings under the water.', followers: { classes: ['marsh-chaplain', 'lantern-warden'], alignments: ['Mire'] } };
  // Lantern followers only: outside the stalker's soft limit (Reed or Mire), so the GM's special approval.
  const BRASS_LAMP = { id: 'ex-patron-brass-lamp', name: 'The Brass Lamp', option: 'ex-opt-patrons', blurb: 'Bright and loud.', followers: { classes: ['mire-stalker'], alignments: ['Lantern'] } };

  let world: FakeWorld;
  let ids: { campaign: string; me: string; gm: string };

  /** A fresh world: the fixture's setting with the patrons' option on; `onlyClosed`: the chaplain's only patron is the Bell. */
  function fenWorld({ onlyClosed = false }: { onlyClosed?: boolean } = {}) {
    cleanup();
    world = createFakeDb();
    forgetFileLinks();
    forgetCampaignSetting();
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, me, 'player');
    ids = { campaign, me, gm };
    fields.fail = false;
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
    world.tables.campaign_packs.push({ id: 'link-pack-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: { 'ex-opt-patrons': 'on' }, overrides: {}, priority: 1 });
    const entry = (kind: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-pack-fen-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
    // The fixture's own options are left out (its creation-method option would add a step); the patrons' option is added below.
    for (const part of ['rulesSets', 'races', 'classes', 'hooks', 'spells', 'spellLists', 'items', 'startingKits', 'tables'] as const) {
      const kind = { rulesSets: 'rulesSet', races: 'race', classes: 'class', hooks: 'hook', spells: 'spell', spellLists: 'spellList', items: 'item', startingKits: 'startingKit', tables: 'table' }[part];
      for (const e of pack[part] ?? []) entry(kind, e);
    }
    entry('fieldTemplate', template);
    entry('option', OPTION);
    for (const p of onlyClosed ? [BELL] : [HERON, BELL, BRASS_LAMP]) entry('patron', p);
    const asked = layoutFields.filter((f) => !['background', 'languages', 'hp', 'omen'].includes(f.key));
    asked.forEach((f, order) =>
      world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type: f.type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, created_at: '2026-10-18T12:00:00Z' }),
    );
    world.signInAs(me);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    return user;
  }

  const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
  const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
  const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
  const patronList = () => screen.getByRole('group', { name: 'Patrons' });
  const leaningGroup = () => screen.getByRole('group', { name: 'Leaning' });
  const creationOf = (name: string) => world.tables.actors.find((a) => a.name === name)!.creation as Record<string, unknown>;

  /** Scores and Kindred, then the class picked: its Pick moves on (ct-1). */
  async function pickClass(user: User, klass: string) {
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await screen.findByRole('heading', { name: /^Scores/ });
    await next(user);
    await pick(user, 'Bog folk');
    await screen.findByRole('heading', { name: 'Class' });
    await pick(user, klass);
    await waitFor(() => expect(heading()).not.toBe('Class'));
  }

  /** On from the Patron step (or the step after Class) to "Who they are". */
  async function onToWho(user: User) {
    for (let n = 0; n < 3 && heading() !== 'Who they are'; n++) await next(user);
    await screen.findByRole('heading', { name: 'Who they are' });
  }

  /** Through the steps after Who they are to the review, putting each off where it can be. */
  async function toReview(user: User) {
    await waitFor(() => expect(heading()).not.toBe('Who they are'));
    for (let n = 0; n < 12; n++) {
      await screen.findAllByRole('button', { name: /^(Next|Decide later|Send to the GM)$/ });
      if (screen.queryByRole('button', { name: 'Send to the GM' })) break;
      const later = screen.queryByRole('button', { name: 'Decide later' });
      await user.click(later ?? screen.getByRole('button', { name: 'Next' }));
    }
    return screen.findByRole('button', { name: 'Send to the GM' });
  }

  // Purpose: a class with a hard alignment limit sees a patron whose followers' alignments it can't have as a
  // not-allowed row saying why in the build's closed-row words ("Not open to marsh chaplain"), with no Pick; a class
  // with no alignment limit still sees that patron with its Pick, as before (folded in here: on its own it passes today).
  it('a hard limit shows the patron as a closed row with its reason and no Pick; no limit, no change', async () => {
    const user = fenWorld();
    await pickClass(user, 'Marsh Chaplain');
    await screen.findByRole('heading', { name: 'Patron' });
    const bell = within(patronList()).getByRole('button', { name: /^The Sunken Bell/ });
    expect(bell.closest('.pick-row')?.querySelector('.warning-line')?.textContent).toBe('Not open to marsh chaplain');
    expect(within(patronList()).queryByRole('checkbox', { name: 'Pick The Sunken Bell' })).toBeNull();
    // The patron the chaplain may follow keeps its Pick.
    expect(within(patronList()).getByRole('checkbox', { name: 'Pick The Still Heron' })).toBeTruthy();
    // The Lantern Warden has no alignment limit: the Bell is pickable, with nothing marking it.
    const again = fenWorld();
    await pickClass(again, 'Lantern Warden');
    await screen.findByRole('heading', { name: 'Patron' });
    expect(within(patronList()).getByRole('checkbox', { name: 'Pick The Sunken Bell' })).toBeTruthy();
    expect(within(patronList()).queryByText(/Not open to/)).toBeNull();
  });

  // Purpose: a class with a soft alignment limit gets a patron whose followers are outside it in the GM's-approval
  // fold, marked as needing the GM's special approval; picking it flags the draft with a special approval on the
  // patron step, and Who they are then offers the patron's followers' alignment (never an empty list; folded in here:
  // a soft limit never closes a row, so on its own it passes today).
  it("a soft limit folds the patron with the GM's approval, and picking it adds a special approval", async () => {
    const user = fenWorld();
    await pickClass(user, 'Mire Stalker');
    await screen.findByRole('heading', { name: 'Patron' });
    const fold = within(patronList()).getByText("1 more needs the GM's approval").closest('details') as HTMLElement;
    expect(fold).not.toBeNull();
    await user.click(within(patronList()).getByText("1 more needs the GM's approval"));
    expect(within(fold).getByRole('button', { name: /^The Brass Lamp/ }).closest('.pick-row')?.querySelector('.warning-line')?.textContent).toBe("Needs the GM's special approval");
    // The Heron's followers meet the limit: free, outside the fold.
    expect(within(fold).queryByRole('checkbox', { name: 'Pick The Still Heron' })).toBeNull();
    await user.click(within(fold).getByRole('checkbox', { name: 'Pick The Brass Lamp' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Pick The Brass Lamp' }).getAttribute('aria-checked')).toBe('true'));
    await onToWho(user);
    // Who they are offers the patron's followers' alignment, pickable (flagged for the GM), not a list of closed rows.
    expect(within(leaningGroup()).getByRole('checkbox', { name: /Lantern/ })).toBeTruthy();
    await user.type(screen.getByLabelText('Name'), 'Odo');
    await next(user);
    await waitFor(() => expect(heading()).not.toBe('Who they are'));
    expect(creationOf('Odo').patron).toEqual({ id: 'ex-patron-brass-lamp', name: 'The Brass Lamp' });
    expect(creationOf('Odo').specialApprovals).toEqual(expect.arrayContaining([expect.objectContaining({ step: 'patron', entryId: 'ex-patron-brass-lamp' })]));
  });

  // Purpose: a class whose every patron is closed to it isn't stuck: no Patron step asks for a pick it can't make (or
  // Next goes on without the "Pick a patron first" pop-up), and Send to the GM isn't held for a patron.
  it('a class whose patrons are all closed is neither stuck on the Patron step nor held at Send', async () => {
    const user = fenWorld({ onlyClosed: true });
    await pickClass(user, 'Marsh Chaplain');
    if (heading() === 'Patron') {
      await next(user);
      expect(screen.queryByRole('dialog', { name: 'Pick a patron first' })).toBeNull();
    }
    await onToWho(user);
    await user.type(screen.getByLabelText('Name'), 'Ash');
    const hp = screen.queryByRole('textbox', { name: 'Hit points' });
    if (hp) await user.type(hp, '5');
    await pick(user, 'Reed');
    await next(user);
    const send = await toReview(user);
    expect(creationOf('Ash').toFinish ?? []).not.toContain('patron');
    await user.click(send);
    await waitFor(() => expect(world.tables.actors.find((a) => a.name === 'Ash')!.approval).toBe('pending'));
    expect(screen.queryByText(/Choose a patron first/)).toBeNull();
  });

  /** Saves the draft at the review and leaves (Save and leave); the test then edits the saved record, as another device might. */
  async function saveAndLeave(user: User) {
    await user.click(screen.getByRole('button', { name: 'Save and leave' }));
    await waitFor(() => expect(world.tables.actors.find((a) => a.approval === 'draft')).toBeTruthy());
  }

  /** The GM's Players tab with a waiting character: Approve tapped. */
  async function gmApproves(name: string, creation: Record<string, unknown>) {
    const id = world.addCharacter(ids.campaign, name, { ownerId: ids.me, approval: 'pending' });
    Object.assign(world.tables.actors.find((a) => a.id === id)!, { level: 1, hp_current: 6, hp_max: 6, notes: '', race_ref: 'bog-folk', fields: { MUS: 10 }, classes: [{ classRef: 'marsh-chaplain', level: 1, xp: 0 }], creation });
    world.signInAs(ids.gm);
    cleanup();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    return id;
  }

  // Purpose (cp-1 a, b, e): a closed patron's opened entry has no small-capitals heading for it, one ▲ line saying the
  // row's words ("Not open to marsh chaplain") and under it the why as a plain sentence, not in the warning line; it
  // closes by its ✕ only, with no Close button and no Pick. An open patron's entry also has only the ✕ and its Pick.
  it("a closed patron's entry says the row's words once, the why plain under it, and closes by its X only", async () => {
    const user = fenWorld();
    await pickClass(user, 'Marsh Chaplain');
    await screen.findByRole('heading', { name: 'Patron' });
    await user.click(within(patronList()).getByRole('button', { name: /^The Sunken Bell/ }));
    const entry = await screen.findByRole('dialog', { name: 'The Sunken Bell' });
    expect([...entry.querySelectorAll('dt')].map((dt) => dt.textContent)).not.toContain('Not open to marsh chaplain');
    expect([...entry.querySelectorAll('.warning-line')].map((w) => w.textContent)).toEqual(['Not open to marsh chaplain']);
    const why = within(entry).getByText('Mire followers. A marsh chaplain may only be Lantern or Reed.');
    expect(why.closest('.warning-line, b, strong')).toBeNull();
    expect(within(entry).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close']);
    await user.click(within(entry).getByRole('button', { name: 'Close' }));
    await user.click(within(patronList()).getByRole('button', { name: /^The Still Heron/ }));
    const open = await screen.findByRole('dialog', { name: 'The Still Heron' });
    expect(within(open).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close', 'Pick The Still Heron']);
  });

  // Purpose (nit 1): a closed patron kept from before (picked before the class's limit closed it) keeps Picked ✓ so it
  // can be taken off, shows the ▲ "Not open to marsh chaplain" line, and is held with a clear line at Send to the GM
  // and at the step's Next, as a kept closed alignment is; another patron picked, the draft goes on.
  it('a kept closed patron is flagged on its row and held at Send and at Next', async () => {
    const user = fenWorld();
    await pickClass(user, 'Marsh Chaplain');
    await screen.findByRole('heading', { name: 'Patron' });
    await pick(user, 'The Still Heron');
    await onToWho(user);
    await user.type(screen.getByLabelText('Name'), 'Odo');
    await next(user);
    await toReview(user);
    await saveAndLeave(user);
    // Kept from before: the Bell, which the chaplain's limit now closes.
    creationOf('Odo').patron = { id: 'ex-patron-sunken-bell', name: 'The Sunken Bell' };
    await user.click(await screen.findByRole('button', { name: 'Open Odo' }));
    await user.click(await screen.findByRole('button', { name: 'Send to the GM' }));
    const line = "A marsh chaplain can't follow The Sunken Bell. Pick another patron.";
    expect((await screen.findAllByText(line)).length).toBeGreaterThan(0);
    expect(world.tables.actors.find((a) => a.name === 'Odo')!.approval).toBe('draft');
    await screen.findByRole('heading', { name: 'Patron' });
    const bell = within(patronList()).getByRole('checkbox', { name: 'Pick The Sunken Bell' });
    expect(bell.getAttribute('aria-checked')).toBe('true');
    expect(bell.closest('.pick-row')?.querySelector('.warning-line')?.textContent).toBe('Not open to marsh chaplain');
    // The foot says it (▲, the hint); Next holds and says it again in a toast.
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe(line);
    await next(user);
    expect([...document.querySelectorAll('.toast__text')].map((t) => t.textContent)).toContain(line);
    expect(heading()).toBe('Patron');
    await pick(user, 'The Still Heron');
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    await waitFor(() => expect(creationOf('Odo').patron).toEqual({ id: 'ex-patron-heron', name: 'The Still Heron' }));
  });

  // Purpose (review of #709, item 5): with no patron open to the class, a closed patron kept from before holds Send with
  // the line ending "Take it off.", and the Patron step still opens so it can be taken off; taken off, Next goes on
  // with no pop-up asking for a patron, and Send goes.
  it('a kept closed patron with none open says Take it off, and its step still opens to do it', async () => {
    const user = fenWorld({ onlyClosed: true });
    await pickClass(user, 'Marsh Chaplain');
    if (heading() === 'Patron') await next(user);
    await onToWho(user);
    await user.type(screen.getByLabelText('Name'), 'Ash');
    await pick(user, 'Reed');
    await next(user);
    await toReview(user);
    await saveAndLeave(user);
    creationOf('Ash').patron = { id: 'ex-patron-sunken-bell', name: 'The Sunken Bell' };
    await user.click(await screen.findByRole('button', { name: 'Open Ash' }));
    await user.click(await screen.findByRole('button', { name: 'Send to the GM' }));
    const line = "A marsh chaplain can't follow The Sunken Bell. Take it off.";
    expect((await screen.findAllByText(line)).length).toBeGreaterThan(0);
    expect(world.tables.actors.find((a) => a.name === 'Ash')!.approval).toBe('draft');
    await screen.findByRole('heading', { name: 'Patron' });
    await user.click(within(patronList()).getByRole('checkbox', { name: 'Pick The Sunken Bell' }));
    await waitFor(() => expect(within(patronList()).queryByRole('checkbox', { name: 'Pick The Sunken Bell' })).toBeNull());
    await next(user);
    expect(screen.queryByRole('dialog', { name: 'Pick a patron first' })).toBeNull();
    const send = await screen.findByRole('button', { name: 'Send to the GM' });
    await waitFor(() => expect(creationOf('Ash').patron).toBeUndefined());
    await user.click(send);
    await waitFor(() => expect(world.tables.actors.find((a) => a.name === 'Ash')!.approval).toBe('pending'));
  });

  // Purpose (nit 2): a class whose every patron is closed is never asked for one on the review, even when the record
  // says the patron was put off: no "Patron: Not picked yet" line.
  it('the review never asks for a patron the class can only find closed', async () => {
    const user = fenWorld({ onlyClosed: true });
    await pickClass(user, 'Marsh Chaplain');
    if (heading() === 'Patron') await next(user);
    await onToWho(user);
    await user.type(screen.getByLabelText('Name'), 'Ash');
    await pick(user, 'Reed');
    await next(user);
    await toReview(user);
    await saveAndLeave(user);
    creationOf('Ash').toFinish = ['patron'];
    await user.click(await screen.findByRole('button', { name: 'Open Ash' }));
    await screen.findByRole('button', { name: 'Send to the GM' });
    expect(screen.queryByText('Patron: Not picked yet')).toBeNull();
  });

  // Purpose (nit 3): a class with one open patron and one closed still needs one: put off, Send to the GM is held with
  // "Choose a patron first" (folded in here: it passes today).
  it('some patrons open, one closed: Send still asks for one', async () => {
    const user = fenWorld();
    await pickClass(user, 'Marsh Chaplain');
    await screen.findByRole('heading', { name: 'Patron' });
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    await onToWho(user);
    await user.type(screen.getByLabelText('Name'), 'Later');
    await pick(user, 'Reed');
    await next(user);
    await user.click(await toReview(user));
    expect(await screen.findByText('Choose a patron first: a marsh chaplain needs one before your GM can approve.')).toBeTruthy();
    expect(world.tables.actors.find((a) => a.name === 'Later')!.approval).toBe('draft');
  });

  // Purpose (nit 3): at the GM's Approve, a class whose only patron is closed needs none (approved), and one with an
  // open patron and none picked is refused (folded in here: both pass today).
  it("the GM's Approve: all closed approves; some open and none picked refuses", async () => {
    fenWorld({ onlyClosed: true });
    const ash = await gmApproves('Ash', {});
    await waitFor(() => expect(world.tables.actors.find((a) => a.id === ash)!.approval).toBe('approved'));
    expect(screen.queryByText(/has no patron yet/)).toBeNull();
    fenWorld();
    const tam = await gmApproves('Tam', { toFinish: ['patron'] });
    expect(await screen.findByText('Tam has no patron yet: a marsh chaplain needs one before you can approve. Send it back to choose one.')).toBeTruthy();
    expect(world.tables.actors.find((a) => a.id === tam)!.approval).toBe('pending');
  });

  // Purpose (nit 4, the Conductor's ruling of 2026-11-13: Approve never skips a check): while the campaign's field list
  // isn't loaded (here: its load failed, the only way the approval card shows without it), Approve approves nothing and
  // says "Still loading the rules. Try again in a moment.", the button still there to tap; once the list has loaded,
  // Approve goes through.
  it("the GM's Approve holds while the field list isn't loaded, and goes through once it is", async () => {
    fenWorld({ onlyClosed: true });
    fields.fail = true;
    const ash = await gmApproves('Ash', {});
    expect(await screen.findByText('Still loading the rules. Try again in a moment.')).toBeTruthy();
    expect(world.tables.actors.find((a) => a.id === ash)!.approval).toBe('pending');
    expect((screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(false);
    // Loaded (the screen opened again): Approve approves.
    fields.fail = false;
    cleanup();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(world.tables.actors.find((a) => a.id === ash)!.approval).toBe('approved'));
  });
});
