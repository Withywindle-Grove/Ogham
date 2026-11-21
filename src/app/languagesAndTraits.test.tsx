// @vitest-environment jsdom
// Languages and trait lists on the creation step shell (M5b step 0c, slice 6; cr-15, cr-17; mockups creation/07 and
// 08), on the invented fixture pack scripts/fixtures/m5b-creation.fixture.json. Every name and number is invented.
//   Languages: Yours already holds the common tongue, the alignment tongue (the leaning picked on Who they are), the
//   kindred's and the calling's; Pick 1 more comes from WIT 9; the count stops a second pick; Next writes them all;
//   the literacy line is derived from the same score.
//   A WIT giving 0 extra skips the Languages step, and the given languages still go on the sheet.
//   An entry that grants gear fills the pack when picked, with Undo (a background list field, as the GM would set it).
//   An option-gated list (birth omens) is absent while its option is off, and a step once it is on.
//   Back from a trait list returns to Languages with the pick kept.
//   A player's device reads the sheet layout (cf-5, 2026-11-02: a player-facing kind), so a per-race pattern
//   ("…-{race}") makes a step chosen by the kindred, and the GM-only kinds stay hidden.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; from?: string };

/**
 * The fixture on a campaign, its fields as the sheet layout makes them (a `{race}` pattern is kept as a text field).
 * `background`: the background field fed by the bog folk's list directly (as a GM could set it), instead of the pattern.
 */
function fenWorld({ omens = false, background = false, omenRolls }: { omens?: boolean; background?: boolean; omenRolls?: Record<string, unknown> } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  for (const h of pack.hooks!) entry('hook', h);
  for (const i of pack.items!) entry('item', i);
  // `omenRolls` (pf-16): the omens list rolled more than once, `{ rolls: 2 }`, with `distinct` or without.
  for (const t of pack.traitLists!) entry('traitList', t.id === 'fen-omens' && omenRolls ? { ...t, ...omenRolls } : t);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  // The omens option (off by default); the creation-path option is left out so there is no Method step.
  for (const o of pack.options!.filter((o) => o.id === 'fen-omens')) entry('option', o);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: omens ? { 'fen-omens': 'on' } : {}, overrides: {}, priority: 1 });
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => f.key !== 'hp');
  layout.forEach((f, order) => {
    // As the importer keeps them: a list fed by a list id keeps it; a pattern ("…-{race}") isn't an id, so text.
    const fromList = background && f.key === 'background' ? 'fen-backgrounds-bog-folk' : f.from && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.from) ? f.from : null;
    const type = f.type === 'list' && !f.choices?.length && !fromList ? 'text' : f.type;
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: fromList, created_at: '2026-10-18T12:00:00Z' });
  });
  world.signInAs(me);
  return { gm, me, campaign };
}

function openApp(): User {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  return user;
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
const hint = () => screen.getByRole('status', { name: 'Step status' }).textContent ?? '';
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const tam = () => world.tables.actors.find((a) => a.name === 'Tam')!;

/** Scores (WIT as given), the kindred, the warden, Adjust scores, Who they are (Tam, leaning Reed) and Gear (100, nothing bought). */
async function pastWho(user: User, { wit = '9', race = 'Bog folk', typedBackground = false } = {}) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  const witField = screen.getByLabelText('Wit');
  await user.clear(witField);
  await user.type(witField, wit);
  await next(user);
  await pick(user, race);
  await next(user);
  await pick(user, 'Lantern Warden');
  await next(user);
  if (heading() === 'Adjust scores') await next(user);
  await screen.findByRole('heading', { name: 'Who they are' });
  // Fields other steps own are never asked here.
  expect(screen.queryByLabelText('Languages')).toBeNull();
  if (typedBackground) await user.type(screen.getByLabelText('Background'), 'Peat cutter');
  else expect(screen.queryByLabelText('Background')).toBeNull();
  await user.type(screen.getByLabelText('Name'), 'Tam');
  await pick(user, 'Reed');
  await next(user);
  // Gear comes before Languages (cr-4; slice 5): the money typed, nothing bought.
  await screen.findByRole('heading', { name: 'Gear' });
  await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
  await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '100');
  await next(user);
}

describe('Languages on the shell (cr-15)', () => {
  it('shows Yours already and Pick 1 more from WIT; the count stops a second pick; Next writes them all', async () => {
    fenWorld({ background: true });
    const user = openApp();
    await pastWho(user);
    await screen.findByRole('heading', { name: 'Languages' });
    expect(screen.getByText('Words you can speak and read in the fens.')).toBeTruthy();
    const given = screen.getByRole('group', { name: /^You speak/ });
    expect([...given.querySelectorAll('.pick-row__name')].map((n) => n.textContent)).toEqual(['Fen common', 'Reed', 'Deep croak', 'Old lantern']);
    expect(screen.getByRole('group', { name: /^Pick 1 more/ })).toBeTruthy();
    // The pack requires the step: no Decide later. Next says what's missing.
    expect(screen.queryByRole('button', { name: 'Decide later' })).toBeNull();
    await next(user);
    expect((await screen.findAllByText('Pick 1 more.')).length).toBeGreaterThan(0);
    // A given one is marked Given, with no Pick (final drafts D).
    expect(within(given).queryByRole('checkbox', { name: 'Pick Deep croak' })).toBeNull();
    expect(within(given).getAllByText('Given')).toHaveLength(4);
    await pick(user, 'Reedspeak');
    expect(hint()).toBe('1 of 1 picked');
    // Other… counts as a pick: the count stops it.
    await user.click(screen.getByRole('button', { name: /^Other…/ }));
    await user.type(screen.getByLabelText('Another language'), 'Heron-call');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect((await screen.findAllByText('1 of 1 picked: take one off to pick another.')).length).toBeGreaterThan(0);
    // Literacy comes from the same score, as a derived line.
    expect(screen.getByText('Reads')).toBeTruthy();
    await next(user);
    await screen.findByRole('heading', { name: 'Bog folk backgrounds' });
    expect((tam().fields as { languages: string }).languages).toBe('Fen common, Reed, Deep croak, Old lantern, Reedspeak');
  });

  it('a WIT giving 0 extra skips the step; the given languages still go on the sheet', async () => {
    fenWorld({ background: true });
    const user = openApp();
    await pastWho(user, { wit: '6' });
    await screen.findByRole('heading', { name: 'Bog folk backgrounds' });
    expect(screen.queryByRole('heading', { name: 'Languages' })).toBeNull();
    expect((tam().fields as { languages: string }).languages).toBe('Fen common, Reed, Deep croak, Old lantern');
  });

  it('Back from the next step returns to Languages with the pick kept', async () => {
    fenWorld({ background: true });
    const user = openApp();
    await pastWho(user);
    await screen.findByRole('heading', { name: 'Languages' });
    await pick(user, 'Reedspeak');
    await next(user);
    await screen.findByRole('heading', { name: 'Bog folk backgrounds' });
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    await screen.findByRole('heading', { name: 'Languages' });
    expect(screen.getByRole('checkbox', { name: 'Pick Reedspeak' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('Trait lists on the shell (cr-17)', () => {
  it('an entry with gear fills the pack when picked, with Undo; the list field keeps the entry\'s id', async () => {
    fenWorld({ background: true });
    const user = openApp();
    await pastWho(user, { wit: '6' });
    await screen.findByRole('heading', { name: 'Bog folk backgrounds' });
    // The die in the step's Roll row, the list's notes the line (retest 4 S1).
    expect(screen.getByText('Roll 1d6 at the table, then tap the row, or pick one.').closest('.roll-row')).not.toBeNull();
    expect(screen.getByText('Roll at the table, or pick one with the GM’s nod.'.replace('’', "'"))).toBeTruthy();
    expect(screen.getByText('starts with Eel knife')).toBeTruthy();
    await pick(user, '1–3: Eel catcher');
    expect(hint()).toBe('Eel catcher picked');
    await next(user);
    expect((await screen.findAllByText('Eel knife added to your pack.')).length).toBeGreaterThan(0);
    await waitFor(() => expect((tam().fields as { background?: string }).background).toBe('eel-catcher'));
    const knives = () => world.tables.inventory_lines.filter((l) => l.actor_id === tam().id && l.name === 'Eel knife');
    await waitFor(() => expect(knives()).toHaveLength(1));
    await user.click(screen.getAllByRole('button', { name: 'Undo' })[0]!);
    await waitFor(() => expect(knives()).toHaveLength(0));
  });

  it("on a player's device the per-race background (the layout's `{race}` pattern) is a step chosen by the kindred, never typed on Who they are (cf-5)", async () => {
    fenWorld();
    const user = openApp();
    // pastWho checks that Who they are doesn't ask for the Background.
    await pastWho(user, { wit: '6' });
    await screen.findByRole('heading', { name: 'Bog folk backgrounds' });
    expect(screen.queryByRole('heading', { name: 'Stone kin backgrounds' })).toBeNull();
    await pick(user, '4–5: Reed cutter');
    await next(user);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    // The campaign keeps the field as text (a pattern isn't a list id), so it keeps the entry's name.
    expect((tam().fields as { background?: string }).background).toBe('Reed cutter');
  });

  it("another kindred gets its own list from the same pattern, on a player's device", async () => {
    fenWorld();
    const user = openApp();
    await pastWho(user, { wit: '6', race: 'Stone kin' });
    await screen.findByRole('heading', { name: 'Stone kin backgrounds' });
    await pick(user, '1–2: Causeway mason');
    await next(user);
    // Stone kin have a Details step (cs-1), optional: Next passes it, nothing filled (cs-11: no "Skip, leave blank").
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect((tam().fields as { background?: string }).background).toBe('Causeway mason');
  });

  it("a player's device reads the sheet layout and still none of the GM-only kinds (the fake database agrees with the read rule)", async () => {
    fenWorld();
    world.tables.library_entries.push({ id: 'entry-statBlock-bog-lurker', pack_id: 'pack-fen', kind: 'statBlock', pack_entry_id: 'bog-lurker', name: 'Bog lurker', data: { id: 'bog-lurker', name: 'Bog lurker' } });
    const seen = ((await world.db.from('library_entries').select('kind')).data ?? []).map((e) => (e as { kind: string }).kind);
    expect(seen).toContain('fieldTemplate');
    expect(seen).not.toContain('statBlock');
  });

  it('an option-gated list is absent while its option is off, and a step once it is on', async () => {
    fenWorld({ background: true });
    let user = openApp();
    await pastWho(user, { wit: '6' });
    await screen.findByRole('heading', { name: 'Bog folk backgrounds' });
    await pick(user, '4–5: Reed cutter');
    await next(user);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect(screen.queryByRole('heading', { name: 'Birth omens' })).toBeNull();
    cleanup();
    world = createFakeDb();
    forgetCampaignSetting();
    fenWorld({ omens: true, background: true });
    user = openApp();
    await pastWho(user, { wit: '6' });
    await screen.findByRole('heading', { name: 'Bog folk backgrounds' });
    await pick(user, '4–5: Reed cutter');
    await next(user);
    await screen.findByRole('heading', { name: 'Birth omens' });
    await pick(user, '1–2: Heron at dawn');
    await next(user);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    // A list field fed by the list keeps the entry's id.
    expect((tam().fields as { omen?: string }).omen).toBe('heron-at-dawn');
  });
});

// A trait list rolled more than once (07 `rolls`, pf-16, ruled 2026-11-13), the omens list with `rolls: 2`.
describe('a trait list rolled twice (pf-16)', () => {
  /** Kindred, calling, Who they are, Gear, Languages skipped (WIT 6), the background picked: on Birth omens. */
  async function toOmens(user: User) {
    await pastWho(user, { wit: '6' });
    await screen.findByRole('heading', { name: 'Bog folk backgrounds' });
    await pick(user, '4–5: Reed cutter');
    await next(user);
    await screen.findByRole('heading', { name: 'Birth omens' });
  }
  const fold = () => screen.getByText(/of 2 picked$/).textContent;

  // Purpose: N = 2 asks for two: the count line reads "1 of 2 picked", the foot says how many are left, Next waits
  // until two are picked; the field then keeps both, and the review lists both.
  it('asks for two; Next waits; the field keeps both and the review lists both', async () => {
    fenWorld({ omens: true, background: true, omenRolls: { rolls: 2 } });
    const user = openApp();
    await toOmens(user);
    expect(hint()).toBe('0 of 2 picked. Pick 2 more, or Decide later');
    await pick(user, '1–2: Heron at dawn');
    expect(fold()).toBe('1 of 2 picked');
    expect(hint()).toBe('1 of 2 picked. Pick 1 more, or Decide later');
    await next(user);
    expect((await screen.findAllByText('Pick 1 more, or Decide later.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Birth omens' })).toBeTruthy();
    // A third tap is refused in a pop-up.
    await pick(user, '3–4: Frog in frost');
    expect(hint()).toBe('Heron at dawn, Frog in frost picked');
    await user.click(screen.getByRole('button', { name: /^Other…/ }));
    await user.type(screen.getByRole('textbox', { name: /^Your own birth omens/ }), 'Owl at noon');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect((await screen.findAllByText('2 of 2 picked: take one off to pick another.')).length).toBeGreaterThan(0);
    await next(user);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect((tam().fields as { omen?: string }).omen).toBe('heron-at-dawn; frog-in-frost');
    const omens = screen.getByRole('region', { name: 'Birth omens' });
    expect(within(omens).getByText('Heron at dawn')).toBeTruthy();
    expect(within(omens).getByText('Frog in frost')).toBeTruthy();
  });

  // Purpose: without distinct the same omen may be taken twice: its Pick button reads "Picked ✓✓" and is heard as
  // "picked twice" (the lead's ruling of 2026-11-13), while the name carries no "×2" and the row no count in words.
  it('without distinct the same entry is taken twice, its Pick reading Picked ✓✓', async () => {
    fenWorld({ omens: true, background: true, omenRolls: { rolls: 2 } });
    const user = openApp();
    await toOmens(user);
    await pick(user, '1–2: Heron at dawn');
    expect(screen.getByRole('checkbox', { name: 'Pick 1–2: Heron at dawn' }).textContent).toBe('Picked ✓');
    await pick(user, '1–2: Heron at dawn');
    const twice = screen.getByRole('checkbox', { name: 'Pick 1–2: Heron at dawn, picked twice' });
    expect(twice.textContent).toBe('Picked ✓✓');
    expect(twice.closest('.pick-row')!.textContent).not.toMatch(/×|twice|times/);
    expect(fold()).toBe('2 of 2 picked');
  });

  // Purpose: with distinct a second take of a picked omen is refused with the "Already yours" words.
  it('with distinct a repeat is refused', async () => {
    fenWorld({ omens: true, background: true, omenRolls: { rolls: 2, distinct: true } });
    const user = openApp();
    await toOmens(user);
    await pick(user, '1–2: Heron at dawn');
    await pick(user, '1–2: Heron at dawn');
    expect((await screen.findAllByText('Already yours: roll again.')).length).toBeGreaterThan(0);
    expect(fold()).toBe('1 of 2 picked');
  });

  // Purpose: Decide later with one of two picked keeps it on the field and puts the step on To finish.
  it('Decide later with one of two picked keeps it and lists the step to finish', async () => {
    fenWorld({ omens: true, background: true, omenRolls: { rolls: 2 } });
    const user = openApp();
    await toOmens(user);
    await pick(user, '3–4: Frog in frost');
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    await waitFor(() => expect((tam().fields as { omen?: string }).omen).toBe('frog-in-frost'));
    expect((tam().creation as { toFinish?: string[] }).toFinish).toContain('fen-omens');
    expect(within(screen.getByRole('region', { name: 'Birth omens' })).getByText('Frog in frost')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Birth omens, Do it now' })).toBeTruthy();
  });
});

// Look-back review of #663 (Important 1): Decide later on a list rolled twice, after some picks.
describe('Decide later on a list rolled twice keeps what was saved (fix of #663)', () => {
  // The omens list rolled twice, Heron at dawn bringing a cantrip rolled from the witch's list.
  const omensWithRoll = {
    rolls: 2,
    entries: [
      { id: 'heron-at-dawn', name: 'Heron at dawn', min: 1, max: 2, blurb: 'Patient; waits out any ambush.', spells: { roll: { listId: 'witch-list', level: 0 } } },
      { id: 'frog-in-frost', name: 'Frog in frost', min: 3, max: 4, blurb: 'Hardy in the cold months.', items: [{ itemId: 'dry-rations', qty: 1 }] },
    ],
  };
  /** The fixture's spells in the setting too, so the cantrip roll has its rows. */
  function withSpells() {
    for (const s of pack.spells!) world.tables.library_entries.push({ id: `entry-spell-${String(s.id)}`, pack_id: 'pack-fen', kind: 'spell', pack_entry_id: String(s.id), name: String(s.name), data: s });
  }
  async function toOmensStep(user: User) {
    await pastWho(user, { wit: '6' });
    await screen.findByRole('heading', { name: 'Bog folk backgrounds' });
    await pick(user, '4–5: Reed cutter');
    await next(user);
    await screen.findByRole('heading', { name: 'Birth omens' });
  }

  // Purpose: a spell rolled under a picked entry stays on the creation record when the player taps Decide later with
  // one of two picked (it was taken off, as if no spell had been rolled).
  it('keeps the spell rolled under a pick on Decide later', async () => {
    fenWorld({ omens: true, background: true, omenRolls: omensWithRoll });
    withSpells();
    const user = openApp();
    await toOmensStep(user);
    await pick(user, '1–2: Heron at dawn');
    await user.click(screen.getByRole('checkbox', { name: /^Pick \d: Frog chorus$/ }));
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    await waitFor(() => expect((tam().fields as { omen?: string }).omen).toBe('heron-at-dawn'));
    const spells = (tam().creation as { traitSpells?: Record<string, { entryId: string; spellId: string }> }).traitSpells;
    expect(spells?.['fen-omens']).toMatchObject({ entryId: 'heron-at-dawn', spellId: 'frog-chorus' });
  });

  // Purpose: Decide later again with the picks unchanged saves nothing new: the gear the pick gave is not taken back and
  // given again (same line, no new inventory log lines), and the pick's field is not written again.
  it('Decide later again with nothing changed gives no new gear and writes no new lines', async () => {
    fenWorld({ omens: true, background: true, omenRolls: omensWithRoll });
    const user = openApp();
    await toOmensStep(user);
    await pick(user, '3–4: Frog in frost');
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    const rations = () => world.tables.inventory_lines.filter((l) => l.actor_id === tam().id && l.name === 'Dry rations').map((l) => l.id);
    await waitFor(() => expect(rations()).toHaveLength(1));
    const lineBefore = rations();
    const eventsBefore = world.tables.events.length;
    const gearEventsBefore = world.tables.events.filter((e) => e.target_table === 'inventory_lines').length;
    await user.click(screen.getByRole('button', { name: 'Birth omens, Do it now' }));
    await screen.findByRole('heading', { name: 'Birth omens' });
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect(rations()).toEqual(lineBefore);
    expect(world.tables.events.filter((e) => e.target_table === 'inventory_lines').length).toBe(gearEventsBefore);
    expect(world.tables.events.length).toBe(eventsBefore);
    expect((tam().fields as { omen?: string }).omen).toBe('frog-in-frost');
  });
});

// Creation survey PR 4 (cs-6, rc-2, rc-5). Purposes:
//   A rolled language shows its range first and the group says to roll or choose; one learnt with the GM's leave is
//   picked all the same and flagged on the creation record for the GM; a language the kindred can't learn is left out
//   with a line.
//   A background giving coins adds them to starting money: the toast says so and the record keeps them by list.
describe('rolled and limited languages, and a background that gives coins', () => {
  const was = JSON.stringify(pack);
  afterEach(() => {
    Object.assign(pack, JSON.parse(was));
  });
  function patch() {
    const list = (pack.rulesSets![0]!.languages as { list: Record<string, unknown>[] }).list;
    Object.assign(list.find((l) => l.id === 'reedspeak')!, { roll: { die: 'd6', min: 1, max: 3 }, learnableBy: { types: ['stone'], soft: true } });
    Object.assign(list.find((l) => l.id === 'old-lantern')!, { roll: { die: 'd6', min: 4, max: 6 } });
    list.push({ id: 'stone-hum', name: 'Stone hum', learnableBy: ['stone'] });
    pack.races!.find((r) => r.id === 'bog-folk')!.creatureType = 'mortal';
    const entries = (pack.traitLists!.find((t) => t.id === 'fen-backgrounds-bog-folk')!.entries as Record<string, unknown>[])!;
    entries.find((e) => e.id === 'eel-catcher')!.money = 50;
  }

  it('the range first, the GM’s leave flagged, the closed one left out; the coins added and kept', async () => {
    patch();
    fenWorld({ background: true });
    const user = openApp();
    await pastWho(user);
    await screen.findByRole('heading', { name: 'Languages' });
    expect(screen.getByRole('group', { name: /^Pick 1 more/ })).toBeTruthy();
    expect(screen.getByText('Roll d6, or tap any row.')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Others you may choose' })).toBeTruthy();
    expect(screen.getByText('1 language your kind can’t learn is left out.')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Stone hum/ })).toBeNull();
    // The rolled ones are the book's tapped table (dec-10 E, picture 20-E3): a row needing the GM's leave keeps its place
    // in the die's order, its range in its own column, the sign its ▲ line, and is picked all the same.
    const row = within(screen.getByRole('group', { name: 'Rolled on d6' })).getByRole('radio', { name: /^1 to 3 Reedspeak/ });
    expect(row.closest('details.creation-fold')).toBeNull();
    expect(row.querySelector('.option-row__not-allowed')?.textContent).toContain("Needs the GM's special approval");
    await user.click(row);
    expect(row.getAttribute('aria-checked')).toBe('true');
    await next(user);
    await screen.findByRole('heading', { name: 'Bog folk backgrounds' });
    await waitFor(() => expect((tam().creation as { specialApprovals?: unknown[] }).specialApprovals).toContainEqual({ step: 'languages', entryId: 'reedspeak', name: 'Reedspeak', requirement: 'Usually learnt only by stone kinds' }));
    await pick(user, '1–3: Eel catcher');
    await next(user);
    expect((await screen.findAllByText('Eel knife added to your pack. 50 added to your starting money.')).length).toBeGreaterThan(0);
    await waitFor(() => expect((tam().creation as { traitMoney?: unknown }).traitMoney).toEqual({ 'fen-backgrounds-bog-folk': 50 }));
  });
});

/** A window `width` px wide for the test inside (jsdom has no layout): min-width and max-width queries answered. */
async function atWidth(width: number, run: () => Promise<void>) {
  const had = window.matchMedia;
  const matches = (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
  };
  window.matchMedia = ((query: string) => ({ matches: matches(query), media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  try {
    await run();
  } finally {
    window.matchMedia = had;
  }
}

const side = () => document.querySelector('.creation-step__side') as HTMLElement | null;

describe('Languages on a tablet (final draft 4, creation follow-up)', () => {
  // Purpose (retest 2, 2026-11-07): Languages is one column at every width: "You speak" heads the list at 820 as at
  // 375, and an opened entry is a sheet, never a second column.
  it('at 820 and 375, You speak heads the list in the one column; an opened entry is a sheet', async () => {
    for (const width of [820, 375]) {
      await atWidth(width, async () => {
        fenWorld({ background: true });
        const user = openApp();
        await pastWho(user);
        await screen.findByRole('heading', { name: 'Languages' });
        expect(side()).toBeNull();
        expect(document.querySelector('.creation-step__content')?.textContent).toContain('You speak');
        await user.click(screen.getByRole('button', { name: /^Reedspeak/ }));
        expect(screen.getByRole('dialog', { name: 'Reedspeak' }).classList.contains('dialog--sheet')).toBe(true);
      });
      cleanup();
      world = createFakeDb();
      forgetCampaignSetting();
    }
  });
});

