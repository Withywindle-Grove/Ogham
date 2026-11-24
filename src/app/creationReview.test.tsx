// @vitest-environment jsdom
// The creation review (M5b step 0c, slice 7; cr-18; mockup creation/09), on the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json. Every name and number is invented.
//   The review shows one section per step in the order walked, Derived fields "from the rules", and is the last step.
//   Change › reopens a step, and its Next comes back to the review with the change shown.
//   Change › on Who they are edits the draft (never a second character) and comes back.
//   Change › on Scores re-walks the scores with the values kept; Next through to the review keeps gear, languages and
//   the book, and the record carries the new scores (cf-6).
//   Change › on Kindred and class with a new class clears the later picks with Undo, walks them again, and Undo puts
//   everything back (cf-7).
//   A redo with given gear keeps the Given gear in the pack while the kit goes.
//   Back from the first guided step during a redo returns to the review with nothing written.
//   Save and leave keeps the draft; it reopens on the review from Your characters.
//   Send to the GM re-runs every step's check and lands on the first failing step, with its message.
//   Do it now › on the To finish box opens the step, and finishing it takes the line off.
//   Back on the review opens the last step walked; its Next comes back.
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

/** The fixture on a campaign; the background field fed by the bog folk's list (as a GM could set it). */
function fenWorld({ hp = false } = {}) {
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
  for (const k of pack.startingKits!) entry('startingKit', k);
  for (const t of pack.traitLists!) entry('traitList', t);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => f.key !== 'hp' && f.key !== 'omen');
  if (hp) Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { hpRequired: true } });
  layout.forEach((f, order) => {
    const fromList = f.key === 'background' ? 'fen-backgrounds-bog-folk' : null;
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
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const tams = () => world.tables.actors.filter((a) => String(a.name).startsWith('Tam'));
const tam = () => tams()[0]!;
const toasts = async (text: string) => expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);

/** Scores, Kindred (bog folk), the warden, Who they are (Tam, leaning Reed), Gear (100), Languages (Reedspeak), backgrounds (later or picked): the review. */
async function toReview(user: User, { background = 'pick' as 'pick' | 'later', kit = false, money = true, hp = false } = {}) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  await next(user);
  await pick(user, 'Bog folk');
  await next(user);
  await pick(user, 'Lantern Warden');
  await next(user);
  if (heading() === 'Adjust scores') await next(user);
  await screen.findByRole('heading', { name: 'Who they are' });
  await user.type(screen.getByLabelText('Name'), 'Tam');
  if (hp) {
    // The box holds the die's average until a roll is entered (final drafts A5, C).
    await user.clear(screen.getByRole('textbox', { name: 'Hit points' }));
    await user.type(screen.getByRole('textbox', { name: 'Hit points' }), '5');
  }
  await pick(user, 'Reed');
  await next(user);
  await screen.findByRole('heading', { name: 'Gear' });
  if (money) {
    await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
    await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '100');
  }
  if (kit) await pick(user, "Warden's kit");
  await next(user);
  await screen.findByRole('heading', { name: 'Languages' });
  await pick(user, 'Reedspeak');
  await next(user);
  await screen.findByRole('heading', { name: 'Bog folk backgrounds' });
  if (background === 'later') await user.click(screen.getByRole('button', { name: 'Decide later' }));
  else {
    await pick(user, '4–5: Reed cutter');
    await next(user);
  }
  await screen.findByRole('button', { name: 'Send to the GM' });
}

/** The review's sections, by title, in order. */
const sections = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '');
const section = (title: string) => screen.getAllByRole('heading', { level: 2 }).find((h) => (h.textContent ?? '').startsWith(title))!.closest('section') as HTMLElement;
/** A section's lines as read (a pack-list value is a button inside its line, ct3-11). */
const lines = (title: string) => [...section(title).querySelectorAll('.creation-review__line')].map((p) => p.textContent ?? '');

describe('the creation review (cr-18)', () => {
  it('shows one section per step in the order walked, Derived fields from the rules, and is the last step', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user);
    expect(heading()).toBe('Tam');
    expect(screen.getByText(/Step (\d+) of \1, Review/)).toBeTruthy();
    // No instruction line (22-G1, ruled): the cards and their Change say it.
    expect(screen.queryByText(/^Look it over/)).toBeNull();
    expect(sections().filter((t) => t !== 'To finish' && !t.startsWith('To finish'))).toEqual(['Kindred and class', 'Scores', 'Who they are', 'Gear', 'Languages', 'Bog folk backgrounds']);
    expect(lines('Kindred and class')).toEqual(['Kindred: Bog folk', 'Class: Lantern Warden, level 1']);
    // Purpose: the scores line names every ability in full, never its short form (Francis via Design, 2026-11-06).
    expect(lines('Scores').join(' ')).toMatch(/^Muscle \d+.*, Nimbleness \d+.*, Grit \d+.*, Wit \d+.*, Lore \d+.*, Charm \d+/);
    expect(lines('Who they are')).toContain('Leaning: Reed');
    // This campaign doesn't ask hit points: no line for them.
    expect(within(section('Who they are')).queryByText(/hp|Hit points/)).toBeNull();
    // The coin in words (cw-11): what was rolled and what's left; nothing spent says no "spent".
    expect(within(section('Gear')).getByText('100 rolled: 100 gp left')).toBeTruthy();
    expect(lines('Languages')).toContain('Fen common, Reed, Deep croak, Old lantern, Reedspeak');
    expect(within(section('Bog folk backgrounds')).getByText('Reed cutter')).toBeTruthy();
    // Every pack-list value opens its entry here too (ct3-11): the background, a language. The kindred, the class and
    // the alignment are plain text, no chips (R3-6, mockup creation/final/12).
    await user.click(within(section('Bog folk backgrounds')).getByRole('button', { name: 'Reed cutter: open its entry' }));
    expect(within(await screen.findByRole('dialog', { name: 'Reed cutter' })).getByText('Strong arms and a feel for the wind.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(within(section('Kindred and class')).queryByRole('button', { name: /open its entry/ })).toBeNull();
    expect(within(section('Kindred and class')).getByText('Kindred: Bog folk')).toBeTruthy();
    expect(section('Kindred and class').querySelector('.chip')).toBeNull();
    await user.click(within(section('Languages')).getByRole('button', { name: 'Reedspeak: open its entry' }));
    expect(within(await screen.findByRole('dialog', { name: 'Reedspeak' })).getByText('The whispering tongue of the reed cutters.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    // A language the list doesn't have (the alignment tongue) stays words.
    expect(within(section('Languages')).queryByRole('button', { name: /^Reed: / })).toBeNull();
    // Derived values (cw-7, cw-11) is read and folded: no Change there; every other card has one (44 px, by name).
    const worked = screen.getByRole('region', { name: 'Derived values' });
    expect(within(worked).queryByRole('button', { name: /^Change/ })).toBeNull();
    expect(worked.querySelector('details')?.open).toBe(false);
    await user.click(within(worked).getByText('Derived values'));
    // Purpose (R3-6): the derived values are Score tiles (the name, the figure), no commas between; the saves their own
    // group under "Saves".
    const tiles = [...worked.querySelectorAll('.creation-review__tiles .stat-tile')];
    expect(tiles.length).toBeGreaterThan(1);
    for (const tile of tiles) expect(tile.classList.contains('stat-tile--small')).toBe(true);
    expect(worked.querySelector('.creation-review__tiles')!.textContent).not.toMatch(/\d,\s*[A-Z]/);
    expect(worked.querySelector('.tap-value--pill')).toBeNull();
    // Purpose: each derived value opens its breakdown, the full sheet's words (bq-2).
    await user.click(within(worked).getByRole('button', { name: "Attack 19: how it's worked out" }));
    expect(within(await screen.findByRole('dialog', { name: 'Attack' })).getByText('Attack 19 for a Lantern Warden at level 1.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    // The Kindred and class card: a Change on each line (Design 2026-11-06), none on the card.
    for (const name of ['Change Kindred', 'Change Class']) expect(within(section('Kindred and class')).getByRole('button', { name })).toBeTruthy();
    for (const title of ['Scores', 'Who they are', 'Gear', 'Languages', 'Bog folk backgrounds']) expect(within(section(title)).getByRole('button', { name: `Change ${title}` })).toBeTruthy();
    // Purpose: one exit button (follow-up E, nit 4): once the draft exists the top button reads Save and leave, and the
    // foot has no second one; no plain Leave either.
    // Final drafts A1: it lives in the app bar's ⋯.
    // Final drafts D (mockup creation/final/07): the review's foot has Save and leave too, beside Start over.
    expect(screen.getByRole('button', { name: 'Save and leave' }).closest('[role="dialog"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Start over' })).toBeTruthy();
    // cs-36 (22-G1): the quiet pair first, Start over then Save and leave, and the accent Send to the GM outermost; no Back.
    const foot = [...document.querySelectorAll('.creation-step__foot button')].map((b) => b.textContent);
    expect(foot).toEqual(['Start over', 'Save and leave', 'Send to the GM']);
    expect(screen.getByRole('button', { name: 'Send to the GM' }).className).toContain('button-primary');
    expect(screen.getByRole('button', { name: 'Start over' }).className).not.toContain('button-primary');
    // "8 figures" (cs-23): the derived values' fold says how many, no "tap one to see why".
    expect(document.body.textContent).not.toMatch(/tap one to see why/);
    await user.click(screen.getByRole('button', { name: 'More' }));
    // Final draft 9: ⋯ opens a sheet whose last row is the one exit.
    expect(within(screen.getByRole('dialog', { name: 'More' })).getAllByRole('button', { name: /^Save and leave/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull();
    await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Goes to the GM for approval')).toBeTruthy();
  });

  it('Change › reopens a step, and its Next returns to the review with the change shown', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user);
    await user.click(screen.getByRole('button', { name: 'Change Languages' }));
    await screen.findByRole('heading', { name: 'Languages', level: 1 });
    // Opened from the review: no step counter.
    expect(screen.queryByText(/^Step \d+ of \d+/)).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Pick Reedspeak' }).getAttribute('aria-checked')).toBe('true');
    await pick(user, 'Reedspeak');
    await user.click(screen.getByRole('button', { name: /^Other…/ }));
    await user.type(screen.getByLabelText('Another language'), 'Heron-call');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    expect(lines('Languages')).toContain('Fen common, Reed, Deep croak, Old lantern, Heron-call');
    // Gear the same way: the money changed, Done, and the review says what's left.
    await user.click(screen.getByRole('button', { name: 'Change Gear' }));
    const money = await screen.findByRole('textbox', { name: 'Starting coin' });
    await user.clear(money);
    await user.type(money, '120');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await screen.findByRole('button', { name: 'Send to the GM' });
    await waitFor(() => expect(within(section('Gear')).getByText('120 rolled: 120 gp left')).toBeTruthy());
  });

  it('Change › on Who they are edits the draft, never a second character, and comes back', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user);
    await user.click(screen.getByRole('button', { name: 'Change Who they are' }));
    await screen.findByRole('heading', { name: 'Who they are', level: 1 });
    await user.type(screen.getByLabelText('Name'), ' of the Reeds');
    await user.type(screen.getByLabelText('Motto'), 'Keep the wick dry');
    await next(user);
    await screen.findByRole('heading', { name: 'Tam of the Reeds', level: 1 });
    expect(tams()).toHaveLength(1);
    expect(tam()).toMatchObject({ name: 'Tam of the Reeds', approval: 'draft' });
    expect(within(section('Who they are')).getByText('Motto: Keep the wick dry')).toBeTruthy();
    // The languages picked since aren't reset to the given ones.
    expect((tam().fields as { languages: string }).languages).toBe('Fen common, Reed, Deep croak, Old lantern, Reedspeak');
    // Back from Who they are, changed from the review, returns to it without saving.
    await user.click(screen.getByRole('button', { name: 'Change Who they are' }));
    await screen.findByRole('heading', { name: 'Who they are', level: 1 });
    await user.click(screen.getAllByRole('button', { name: 'Back to review' })[0]!);
    await screen.findByRole('button', { name: 'Send to the GM' });
  });

  // Purpose (final drafts A5, slice B): scores left at the average are kept on the record and named on the review as
  // "the average, not rolled"; one touched on a redo is rolled from then on, even stepped back to the average.
  it('scores left at the average are named on the review and the record; touching one on a redo takes it off', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user);
    const average = () => (tam().creation as { scoresAverage?: string[] }).scoresAverage;
    expect(average()).toEqual(['MUS', 'NIM', 'GRT', 'WIT', 'LORE', 'CHARM']);
    expect(lines('Scores')).toContain('All six: the average, not rolled');
    // caf-7: no score left at the average reads "(rolled N)", whatever the kindred did to it.
    expect(lines('Scores').some((l) => l.includes('(rolled'))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Change Scores' }));
    await screen.findByRole('heading', { name: /^Scores/ });
    expect(screen.getByRole('group', { name: 'Muscle score' }).querySelector('.score-tile__words')?.textContent).toBe('Average');
    const muscle = within(screen.getByRole('group', { name: 'Muscle score' }));
    await user.click(muscle.getByRole('button', { name: 'Raise Muscle' }));
    await user.click(muscle.getByRole('button', { name: 'Lower Muscle' }));
    expect((screen.getByLabelText('Muscle') as HTMLInputElement).value).toBe('9');
    expect(screen.getByRole('group', { name: 'Muscle score' }).querySelector('.score-tile__words')?.textContent).not.toBe('Average');
    await next(user);
    await screen.findByRole('heading', { name: 'Kindred' });
    await next(user);
    await screen.findByRole('heading', { name: /Class|Calling/ });
    await next(user);
    if (heading() === 'Adjust scores') await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    expect(average()).toEqual(['NIM', 'GRT', 'WIT', 'LORE', 'CHARM']);
    expect(lines('Scores')).toContain('Nimbleness, Grit, Wit, Lore, Charm: the average, not rolled');
  });

  it('Change › on Scores re-walks the scores with the values kept; Next through to the review keeps gear, languages and the book, and the record carries the new scores', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user);
    const before = JSON.stringify({ bought: (tam().creation as { bought?: unknown }).bought, lines: world.tables.inventory_lines, fields: tam().fields });
    await user.click(screen.getByRole('button', { name: 'Change Scores' }));
    await screen.findByRole('heading', { name: /^Scores/ });
    expect((screen.getByLabelText('Muscle') as HTMLInputElement).value).toBe('9');
    await user.click(within(screen.getByRole('group', { name: 'Muscle score' })).getByRole('button', { name: 'Raise Muscle' }));
    expect((screen.getByLabelText('Muscle') as HTMLInputElement).value).toBe('10');
    await next(user);
    await screen.findByRole('heading', { name: 'Kindred' });
    expect(screen.getByRole('checkbox', { name: 'Pick Bog folk' }).getAttribute('aria-checked')).toBe('true');
    await next(user);
    await screen.findByRole('heading', { name: /Class|Calling/ });
    expect(screen.getByRole('checkbox', { name: 'Pick Lantern Warden' }).getAttribute('aria-checked')).toBe('true');
    await next(user);
    if (heading() === 'Adjust scores') await next(user);
    await toasts('Scores saved.');
    await screen.findByRole('button', { name: 'Send to the GM' });
    expect(lines('Kindred and class')).toEqual(['Kindred: Bog folk', 'Class: Lantern Warden, level 1']);
    expect(lines('Languages')).toContain('Fen common, Reed, Deep croak, Old lantern, Reedspeak');
    expect(within(section('Gear')).getByText('100 rolled: 100 gp left')).toBeTruthy();
    expect(tams()).toHaveLength(1);
    expect((tam().creation as { scores?: Record<string, number> }).scores?.MUS).toBe(10);
    expect(JSON.stringify({ bought: (tam().creation as { bought?: unknown }).bought, lines: world.tables.inventory_lines, fields: tam().fields })).toContain('Reedspeak');
    expect((tam().creation as { bought?: unknown }).bought).toEqual(JSON.parse(before).bought);
    expect(JSON.stringify(world.tables.inventory_lines)).toBe(JSON.stringify(JSON.parse(before).lines));
  });

  it('Change › on Kindred and class with a new class clears the later picks with Undo, walks them again, and Undo puts everything back', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user, { kit: true });
    const mine = () => world.tables.inventory_lines.filter((l) => l.actor_id === tam().id);
    expect(mine().length).toBeGreaterThan(0);
    const kitLines = mine().map((l) => String(l.name));
    expect((tam().creation as { bought: unknown[] }).bought).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Change Class' }));
    // Opens on the Class step (the kindred kept ticked).
    await screen.findByRole('heading', { name: 'Class' });
    await pick(user, 'Reed Witch');
    await next(user);
    if (heading() === 'Adjust scores') await next(user);
    await toasts('Class changed: the hit points, spells, gear, languages, weapon skills and traits after it are cleared.');
    await waitFor(() => expect(mine()).toEqual([]));
    expect(tam().creation).toMatchObject({ bought: [], spentBase: 0, startingMoney: 100 });
    expect(tam().spell_book).toEqual([]);
    const fields = tam().fields as Record<string, string>;
    expect(fields.background ?? '').toBe('');
    expect(fields.languages).toContain('Reedspeak');
    expect(fields.languages).toContain('Fen common');
    expect(fields.languages).toContain('Deep croak');
    expect(fields.languages).not.toContain('Old lantern');
    // The later steps are walked again, the witch's spells first.
    await screen.findByRole('heading', { name: 'First spells' });
    // Undo on the toast puts the choice, the gear and the traits back.
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await toasts('Put back as it was.');
    await waitFor(() => expect(mine().map((l) => String(l.name))).toEqual(kitLines));
    expect((tam().creation as { bought: unknown[] }).bought).toHaveLength(1);
    expect((tam().fields as Record<string, string>).background).toBe('reed-cutter');
    expect((tam().fields as Record<string, string>).languages).toBe('Fen common, Reed, Deep croak, Old lantern, Reedspeak');
    await screen.findByRole('button', { name: 'Send to the GM' });
    expect(lines('Kindred and class')).toEqual(['Kindred: Bog folk', 'Class: Lantern Warden, level 1']);
    expect(within(section('Bog folk backgrounds')).getByText('Reed cutter')).toBeTruthy();
  });

  it('A class change clears the hit points and walks Who they are first for a new roll (name kept); a scores-only change keeps them (ruled B)', async () => {
    fenWorld({ hp: true });
    const user = openApp();
    await toReview(user, { hp: true });
    expect(tam().hp_max).toBe(5);
    // Scores only: the hit points stay.
    await user.click(screen.getByRole('button', { name: 'Change Scores' }));
    await screen.findByRole('heading', { name: /^Scores/ });
    await next(user);
    await next(user);
    await next(user);
    if (heading() === 'Adjust scores') await next(user);
    await toasts('Scores saved.');
    await screen.findByRole('button', { name: 'Send to the GM' });
    expect(tam().hp_max).toBe(5);
    // A new class: the hit points go, and Who they are asks for the roll before the cleared steps.
    await user.click(screen.getByRole('button', { name: 'Change Class' }));
    await screen.findByRole('heading', { name: 'Class' });
    await pick(user, 'Reed Witch');
    await next(user);
    if (heading() === 'Adjust scores') await next(user);
    await screen.findByRole('heading', { name: 'Who they are', level: 1 });
    await waitFor(() => expect(tam().hp_max).toBeNull());
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Tam');
    // The new class's die: its average again, untouched (final drafts A5, C).
    expect(screen.getByText(/^Average/)).toBeTruthy();
    await user.clear(screen.getByRole('textbox', { name: 'Hit points' }));
    await user.type(screen.getByRole('textbox', { name: 'Hit points' }), '4');
    await next(user);
    await screen.findByRole('heading', { name: 'First spells', level: 1 });
    expect(tam()).toMatchObject({ name: 'Tam', hp_max: 4 });
  });

  it('A redo with given gear keeps the Given gear in the pack while the kit goes', async () => {
    const { campaign } = fenWorld();
    world.tables.campaign_packs.find((l) => l.campaign_id === campaign)!.option_choices = { 'fen-market': 'off' };
    const user = openApp();
    await toReview(user, { money: true, kit: true });
    const mine = () => world.tables.inventory_lines.filter((l) => l.actor_id === tam().id).map((l) => String(l.name));
    expect(mine()).toContain('Reed rope');
    await user.click(screen.getByRole('button', { name: 'Change Class' }));
    // Opens on the Class step (the kindred kept ticked).
    await screen.findByRole('heading', { name: 'Class' });
    await pick(user, 'Reed Witch');
    await next(user);
    if (heading() === 'Adjust scores') await next(user);
    await toasts('Class changed: the hit points, spells, gear, languages, weapon skills and traits after it are cleared.');
    await waitFor(() => expect(mine().sort()).toEqual(['Reed rope', 'Storm lantern']));
    expect((tam().creation as { givenGear?: unknown[] }).givenGear).toHaveLength(2);
    expect((tam().creation as { bought: unknown[] }).bought).toEqual([]);
  });

  it('Back from the first guided step during a redo returns to the review with nothing written', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user);
    const before = JSON.stringify([tam(), world.tables.inventory_lines]);
    await user.click(screen.getByRole('button', { name: 'Change Scores' }));
    await screen.findByRole('heading', { name: /^Scores/ });
    await user.click(screen.getAllByRole('button', { name: 'Back to review' })[0]!);
    await screen.findByRole('button', { name: 'Send to the GM' });
    expect(JSON.stringify([tam(), world.tables.inventory_lines])).toBe(before);
  });

  // Purpose (cw-11): Change, then Back with nothing changed, lands on the review from every step Change opens, and
  // writes nothing; the Kindred and class card's Class goes to its Kindred first (the same card), whose Back returns.
  it('Back with nothing changed returns to the review from every step Change opens, writing nothing', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user);
    const before = JSON.stringify([tam(), world.tables.inventory_lines]);
    // P22 (2026-11-06): on a step Change opened, the foot's Back says where it goes, "Back to review".
    const backTo = async () => {
      // Both foot buttons read Back to review while nothing changed (final drafts D, P22): the first is the foot's Back.
      const back = screen.getAllByRole('button', { name: 'Back to review' })[0]!;
      expect(back.textContent).toBe('Back to review');
      await user.click(back);
      await screen.findByRole('button', { name: 'Send to the GM' });
    };
    for (const [card, step] of [
      ['Gear', 'Gear'],
      ['Languages', 'Languages'],
      ['Bog folk backgrounds', 'Bog folk backgrounds'],
      ['Who they are', 'Who they are'],
      ['Scores', /^Scores/],
    ] as const) {
      await user.click(screen.getByRole('button', { name: `Change ${card}` }));
      await screen.findByRole('heading', { name: step, level: 1 });
      await backTo();
    }
    // Kindred and Class each have their own Change; Back from either, nothing changed, is the review.
    await user.click(screen.getByRole('button', { name: 'Change Class' }));
    await screen.findByRole('heading', { name: 'Class', level: 1 });
    await backTo();
    await user.click(screen.getByRole('button', { name: 'Change Kindred' }));
    await screen.findByRole('heading', { name: 'Kindred', level: 1 });
    await backTo();
    expect(JSON.stringify([tam(), world.tables.inventory_lines])).toBe(before);
  });

  // Purpose (cw-11): a change made on the step Change opened keeps Back's usual way, to the step before, so it isn't lost.
  it('Back after a change on a redo step goes to the step before, not the review', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user);
    await user.click(screen.getByRole('button', { name: 'Change Kindred' }));
    await screen.findByRole('heading', { name: 'Kindred', level: 1 });
    await pick(user, 'Stone kin');
    // A changed kindred walks on through Class (ct-1, Design 2026-11-06); Back there goes to Kindred, and Back from
    // Kindred, changed, to Scores.
    await screen.findByRole('heading', { name: 'Class', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    await screen.findByRole('heading', { name: 'Kindred', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    await screen.findByRole('heading', { name: /^Scores/, level: 1 });
    expect(screen.queryByRole('button', { name: 'Send to the GM' })).toBeNull();
  });

  // Purpose (cw-11, mockup creation/12): the review's cards carry a small worded Change (no "›"), the To finish box's Do
  // it now has no "›", and the Gear card reads as lines: the kit with what it gave, the given gear folded, the count,
  // and the starting coin in words.
  it('cards with a worded Change, no "›", and gear as lines with the coin in words', async () => {
    const { campaign } = fenWorld();
    world.tables.campaign_packs.find((l) => l.campaign_id === campaign)!.option_choices = { 'fen-market': 'off' };
    const user = openApp();
    await toReview(user, { kit: true, background: 'later' });
    const change = within(section('Gear')).getByRole('button', { name: 'Change Gear' });
    expect(change.textContent).toBe('Change');
    expect(change.className).toContain('button-secondary--small');
    expect(screen.getByRole('button', { name: 'Bog folk backgrounds, Do it now' }).textContent).not.toContain('›');
    expect(screen.getByRole('heading', { level: 1 }).closest('section')!.textContent).not.toMatch(/[‹›]/);
    const gear = section('Gear');
    expect(within(gear).getByText("Warden's kit")).toBeTruthy();
    expect(within(gear).getByText('Reed basket, Reed spear, Waxed coat, Storm lantern, Dry rations ×3')).toBeTruthy();
    const given = within(gear).getByText('Given').closest('details')!;
    expect(given.open).toBe(false);
    expect(within(given).getByText('2 items')).toBeTruthy();
    expect(within(gear).getByText('9 items')).toBeTruthy();
    expect(within(gear).getByText('Starting coin')).toBeTruthy();
    expect(within(gear).getByText('100 rolled, 22 gp spent: 78 gp left')).toBeTruthy();
  });

  // Purpose (proposal mockup creation/13): the review's foot names what stops Send, with ▲, before it's tapped; a send
  // that doesn't go says so there (offline in the offline words), the draft kept, and Send tries again.
  it('the foot says what stops Send with ▲, and a failed send says so, offline in its own words', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user);
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('Goes to the GM for approval');
    // Another device took the extra language off: the review, opened again, says what Send will stop on.
    tam().fields = { ...(tam().fields as object), languages: 'Fen common, Reed, Deep croak, Old lantern' };
    await user.click(screen.getByRole('button', { name: 'Change Languages' }));
    await screen.findByRole('heading', { name: 'Languages', level: 1 });
    // The bar's arrow goes back without the step's own check (22-G4: the foot keeps one Back to review, Next's).
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('button', { name: 'Send to the GM' });
    await waitFor(() => expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('Languages: Pick 1 more.'));
    // The warning sign goes with the words (final drafts A4).
    expect(screen.getByRole('status', { name: 'Step status' }).querySelector('.warning-sign')).not.toBeNull();
    tam().fields = { ...(tam().fields as object), languages: 'Fen common, Reed, Deep croak, Old lantern, Reedspeak' };
    await user.click(screen.getByRole('button', { name: 'Change Languages' }));
    await screen.findByRole('heading', { name: 'Languages', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('button', { name: 'Send to the GM' });
    // The send's write fails (offline): the foot says so in the offline words, and nothing is sent.
    const from = world.db.from.bind(world.db);
    const failing = { eq: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) }) };
    const spy = vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as { update: (v: Record<string, unknown>) => unknown };
      if (table !== 'actors') return query;
      const update = query.update.bind(query);
      query.update = (v) => (v.approval === 'pending' ? failing : update(v));
      return query;
    }) as typeof world.db.from);
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: 'Send to the GM' }));
    await waitFor(() => expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe("You're offline. Nothing is saved until you're back: keep this screen open, then try again."));
    // The warning sign goes with the words (final drafts A4).
    expect(screen.getByRole('status', { name: 'Step status' }).querySelector('.warning-sign')).not.toBeNull();
    expect(tam().approval).toBe('draft');
    // Final drafts F: a sheet says what happened and the two ways out, Try again the accent.
    const notSent = within(screen.getByRole('dialog', { name: 'Not sent' }));
    expect(notSent.getByText('Your GM didn’t get it')).toBeTruthy();
    expect(notSent.getByRole('button', { name: 'Try again' }).className).toContain('button-primary');
    expect(notSent.getByRole('button', { name: 'Save and leave' })).toBeTruthy();
    await user.click(notSent.getByRole('button', { name: 'Close' }));
    online.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Send to the GM' }));
    await waitFor(() => expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe("Couldn't send it to your GM. Nothing is lost."));
    // The warning sign goes with the words (final drafts A4).
    expect(screen.getByRole('status', { name: 'Step status' }).querySelector('.warning-sign')).not.toBeNull();
    // Back online and working: Send goes.
    spy.mockRestore();
    online.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Send to the GM' }));
    await waitFor(() => expect(tam().approval).toBe('pending'));
  });


  // Purpose: a Who they are send that doesn't go says so on the foot's ▲ line, in the offline words when offline, and
  // Next tries again (follow-up E, mockup creation/13); nothing is lost.
  it('Who they are: an offline or failed save is on the foot\'s ▲ line, and Next tries again', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user);
    await user.click(screen.getByRole('button', { name: 'Change Who they are' }));
    await screen.findByRole('heading', { name: 'Who they are', level: 1 });
    await user.type(screen.getByLabelText('Name'), ' of the Reeds');
    const from = world.db.from.bind(world.db);
    const failing = { eq: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) }) };
    const spy = vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as { update: (v: Record<string, unknown>) => unknown };
      if (table === 'actors') query.update = () => failing;
      return query;
    }) as typeof world.db.from);
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await next(user);
    await waitFor(() => expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe("You're offline. Nothing is saved until you're back: keep this screen open, then try again."));
    // The warning sign goes with the words (final drafts A4).
    expect(screen.getByRole('status', { name: 'Step status' }).querySelector('.warning-sign')).not.toBeNull();
    expect(heading()).toBe('Who they are');
    expect(tam().name).toBe('Tam');
    online.mockReturnValue(true);
    await next(user);
    await waitFor(() => expect(screen.getByRole('status', { name: 'Step status' }).querySelector('.warning-sign')).not.toBeNull());
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).not.toContain('offline');
    spy.mockRestore();
    online.mockRestore();
    await next(user);
    await screen.findByRole('heading', { name: 'Tam of the Reeds', level: 1 });
    expect(tam().name).toBe('Tam of the Reeds');
  });

  // Purpose: a kit thing the class can't wear says so on the review's Gear card, end to end (Design, 2026-11-06): here
  // the warden may wear only heavy armour, so the Warden's kit's Waxed coat (light) is carried, not worn.
  it('the review names a kit thing the class can\'t wear: ▲ Waxed coat: a Lantern Warden can\'t wear it; carried', async () => {
    fenWorld();
    const warden = world.tables.library_entries.find((e) => e.kind === 'class' && e.pack_entry_id === 'lantern-warden')!;
    warden.data = { ...(warden.data as object), armourAllowed: { types: ['heavy'], shields: true } };
    const user = openApp();
    await toReview(user, { kit: true });
    // The ▲ line, and only for the coat (the spear and the lantern aren't named).
    expect(section('Gear').querySelector('.creation-review__warn .warning-sign')).not.toBeNull();
    expect([...section('Gear').querySelectorAll('.creation-review__warn')].map((p) => p.textContent)).toEqual(["Waxed coat: a Lantern Warden can't wear it; carried"]);
  });
  it('Save and leave keeps the draft; it reopens on the review from Your characters; Send then lands on a failing step with its message', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user);
    await user.click(screen.getByRole('button', { name: 'Save and leave' }));
    await toasts('Tam is saved. Carry on from Your characters.');
    expect(tam().approval).toBe('draft');
    // Something slipped while away (another device took the extra language off): Send finds it.
    tam().fields = { ...(tam().fields as object), languages: 'Fen common, Reed, Deep croak, Old lantern' };
    await user.click(await screen.findByRole('button', { name: 'Open Tam' }));
    await screen.findByRole('button', { name: 'Send to the GM' });
    expect(heading()).toBe('Tam');
    expect(within(section('Bog folk backgrounds')).getByText('Reed cutter')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Send to the GM' }));
    await screen.findByRole('heading', { name: 'Languages', level: 1 });
    await toasts('Pick 1 more.');
    expect(tam().approval).toBe('draft');
    // Fixed there, Next comes back; Send goes.
    await pick(user, 'Reedspeak');
    await next(user);
    await user.click(await screen.findByRole('button', { name: 'Send to the GM' }));
    await waitFor(() => expect(tam().approval).toBe('pending'));
    expect(tams()).toHaveLength(1);
  });

  it('Do it now › on the To finish box opens the step; finishing it takes the line off', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user, { background: 'later' });
    expect(within(section('Bog folk backgrounds')).getByText('Not picked yet')).toBeTruthy();
    expect(screen.getByText('To finish: 1. You can do it later, from your sheet')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Bog folk backgrounds, Do it now' }));
    await screen.findByRole('heading', { name: 'Bog folk backgrounds', level: 1 });
    await pick(user, '4–5: Reed cutter');
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'To finish' })).toBeNull());
    expect((tam().creation as { toFinish?: string[] }).toFinish ?? []).toEqual([]);
  });

  // Purpose (final drafts D, mockup creation/final/07): Start over is the one confirm in creation: it asks once in a
  // sheet naming the character; Keep going keeps everything; Start over deletes the never-sent draft (hard rule 4's
  // first exception) and opens creation at step 1.
  it('Start over asks once; Keep going keeps the draft; Start over deletes it and opens step 1', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user);
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Start over?' }));
    expect(sheet.getByText('Everything you chose for Tam goes, and creation begins again at step 1. Nothing has been sent to your GM yet.')).toBeTruthy();
    // cs-27: two answers, no ✕.
    expect(sheet.queryByRole('button', { name: 'Close' })).toBeNull();
    // cs-26: both buttons plain, Start over outermost (an act that destroys a draft doesn't take the accent).
    expect(sheet.getAllByRole('button').filter((b) => b.closest('.dialog__actions')).map((b) => [b.textContent, b.className.includes('button-primary')])).toEqual([
      ['Keep going', false],
      ['Start over', false],
    ]);
    await user.click(sheet.getByRole('button', { name: 'Keep going' }));
    expect(tams()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Start over?' })).getByRole('button', { name: 'Start over' }));
    await waitFor(() => expect(tams()).toHaveLength(0));
    await toasts('Started over: creation begins again at step 1.');
    expect(await screen.findByRole('heading', { name: 'How do you want to make them?' })).toBeTruthy();
  });

  it('Back on the review opens the last step walked; its Next comes back', async () => {
    fenWorld();
    const user = openApp();
    await toReview(user);
    // The review's foot has no Back (final drafts D): the bar's ← goes back.
    expect(screen.queryByRole('button', { name: 'Back to the step before' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Bog folk backgrounds', level: 1 });
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
  });
});
