// @vitest-environment jsdom
// Guided creation revisited (M5b step 0): Help me choose, the why-line and step
// counter on every step, the languages step with Decide later, no autofocus, the To finish card, and Undo in the shop.
// Invented content only (hard rule 2).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { forgetFileLinks } from '../core/files.ts';
import { Root } from './App.tsx';
import { HelpMeChoose } from '../ui/parts.tsx';
import { openFullSheetFromMenu } from '../testing/openFullSheet.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  sessionStorage.clear();
  localStorage.removeItem('grimoire.lastPlace');
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

const isField = (el: Element | null) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');

// ---------------------------------------------------------------------------------------------------------------
// Help me choose (on its own; the option rows' blurbs are tested on the shell, in creationShell.test.tsx)
// ---------------------------------------------------------------------------------------------------------------

/** What is left, as Gear's coin line says it (cs-22: "100 rolled, 22 gp spent: 78 gp left") and as the shop's top does ("78 gp to spend"). */
const coin = () => document.querySelector('.gear-coin .average-stepper__line')?.textContent ?? '';
const shopLeft = () => document.querySelector('.gear-tally__money')?.textContent ?? '';
describe('Help me choose', () => {
  it('with the pack\'s help, it expands that text', async () => {
    const user = userEvent.setup();
    render(<HelpMeChoose help="Pick the one you would like to play for a year." choices={[{ name: 'Bog lurker', blurb: 'Quiet.' }]} />);
    expect(screen.queryByText(/for a year/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Help me choose' }));
    expect(screen.getByText('Pick the one you would like to play for a year.')).toBeTruthy();
    expect(screen.queryByText('Quiet.')).toBeNull();
  });

  it('without help, it shows the choices\' blurbs side by side', async () => {
    const user = userEvent.setup();
    render(
      <HelpMeChoose
        help={null}
        choices={[
          { name: 'Bog lurker', blurb: 'Quiet.' },
          { name: 'Lantern Warden', blurb: 'Steady.' },
          { name: 'Mire singer', blurb: '' },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Help me choose' }));
    expect(screen.getByText('Bog lurker')).toBeTruthy();
    expect(screen.getByText('Quiet.')).toBeTruthy();
    expect(screen.getByText('Lantern Warden')).toBeTruthy();
    expect(screen.getByText('Steady.')).toBeTruthy();
    // A choice with no blurb has nothing to put beside the others.
    expect(screen.queryByText('Mire singer')).toBeNull();
  });

  it('with neither help nor blurbs, the link is not there', () => {
    render(<HelpMeChoose help={null} choices={[{ name: 'Bog lurker', blurb: '' }]} />);
    expect(screen.queryByRole('button', { name: 'Help me choose' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Whole flows through the real app
// ---------------------------------------------------------------------------------------------------------------

interface Options {
  rules?: Record<string, unknown>;
  languages?: boolean;
  money?: boolean;
}

function guidedWorld({ rules = {}, languages = true, money = false }: Options = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', {
    abilities: [{ key: 'STR', short: 'Strength', name: 'Strength' }],
    abilityModifiers: { STR: [{ range: '3-8', melee: -1 }, { range: '9-18', melee: 0, extraLanguages: 1 }] },
    // The setting's languages (07, m5b-0c slice 6): everyone's tongue given, one more to pick from STR's row.
    ...(languages
      ? { languages: { common: ['fen-common'], alignment: false, list: [{ id: 'fen-common', name: 'Fen common' }, { id: 'reedspeak', name: 'Reedspeak' }, { id: 'fenmoot', name: 'Fenmoot' }, { id: 'gull-sign', name: 'Gull-sign', blurb: 'Silent hand-talk.' }], extraFrom: 'STR' } }
      : {}),
    ...(money ? { startingMoney: '2d6 gp', currency: [{ key: 'gp', label: 'Gold', valueInBase: 10 }] } : {}),
    ...rules,
  });
  entry('class', 'lantern-warden', 'Lantern Warden', { progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: {} }], ...(languages ? { languages: ['Reedspeak', 'Fenmoot'] } : {}) });
  entry('fieldTemplate', 'fen-sheet', 'fen-sheet', { appliesTo: 'pc', fields: [{ key: 'STR', label: 'Strength', type: 'number' }] });
  if (money) {
    entry('item', 'reed-lamp', 'Reed lamp', { category: 'light', value: { gp: 2 } });
  }
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  const field = (key: string, label: string, type: string, order: number) =>
    world.tables.field_definitions.push({ id: `field-${key}`, campaign_id: campaign, applies_to: 'pc', key, label, type, choices: [], field_group: 'Abilities', sort_order: order, show_on_card: false, hidden: false, fill: null, required: false, created_at: '2026-10-18T12:00:00Z' });
  field('STR', 'Strength', 'number', 0);
  if (languages) field('languages', 'Languages', 'text', 1);
  world.signInAs(me);
  return { gm, me, campaign };
}

async function pickOption(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('checkbox', { name: `Pick ${name}` }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

/** From the campaign list to "Who are they?" through the scores and the class. */
async function toWho(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await pickOption(user, 'Lantern Warden');
  await screen.findByRole('heading', { name: 'Who they are' });
}

async function nameAndNext(user: ReturnType<typeof userEvent.setup>, extra?: () => Promise<void>) {
  await user.type(screen.getByLabelText('Name'), 'Reed');
  if (extra) await extra();
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

// No total before the class is picked (ruled B 2026-11-05).
const counterText = () => screen.getByText(/^Step \d+( of \d+)?$/).textContent ?? '';

describe('every guided step shows its why-line and a step counter', () => {
  it('the scores step shows the pack\'s own why-line when it gives one; the class step falls back to the app\'s', async () => {
    guidedWorld({ rules: { creationGuide: { scores: 'Roll as the fen folk do.' } } });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    expect(await screen.findByText('Roll as the fen folk do.')).toBeTruthy();
    expect(counterText()).toBe('Step 1');
    await user.type(screen.getByRole('textbox', { name: 'Strength' }), '12');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Your trade as an adventurer.')).toBeTruthy();
    expect(counterText()).toBe('Step 2');
  });

  it('"Who are they?" and the languages step each show a why-line and the counter moves on by one', async () => {
    guidedWorld({ rules: { creationGuide: { languages: { why: 'Who can they talk to?', help: 'Think of the fen folk.' } } } });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user);
    expect(screen.getByText('A name the table will remember.')).toBeTruthy();
    const total = counterText().replace(/^Step \d+ of /, '');
    // Rewritten for m5b-0c: no prose-only adjust step is counted any more, so "Who are they?" is step 3.
    expect(counterText()).toMatch(/^Step 3 of \d+$/);
    await nameAndNext(user);
    expect(await screen.findByRole('heading', { name: 'Languages' })).toBeTruthy();
    expect(screen.getByText('Who can they talk to?')).toBeTruthy();
    expect(counterText()).toBe(`Step 4 of ${total}`);
    await user.click(screen.getByRole('button', { name: 'Help me choose' }));
    expect(screen.getByText('Think of the fen folk.')).toBeTruthy();
  });
});

describe('the languages step', () => {
  it('Decide later puts exactly one To finish line on the character, and the review marks "To finish: Languages"', async () => {
    guidedWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user);
    await nameAndNext(user);
    await screen.findByRole('heading', { name: 'Languages' });
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    // The review's To finish box (cr-18): one line, with Do it now ›.
    expect((await screen.findAllByRole('button', { name: 'Languages, Do it now' })).length).toBe(1);
    const reed = world.tables.actors.find((a) => a.name === 'Reed')!;
    expect((reed.creation as { toFinish: string[] }).toFinish).toEqual(['languages']);
  });

  it('when the pack requires languages there is no Decide later', async () => {
    guidedWorld({ rules: { creation: { require: ['languages'] } } });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user);
    await nameAndNext(user);
    await screen.findByRole('heading', { name: 'Languages' });
    expect(screen.queryByRole('button', { name: 'Decide later' })).toBeNull();
  });

  // Rewritten for m5b-0c slice 6 (cr-15): the given languages can't be unticked; Next checks the count to pick.
  it('Next with a pick missing stays tappable and says what is missing; a given language stays ticked', async () => {
    guidedWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user);
    await nameAndNext(user);
    await screen.findByRole('heading', { name: 'Languages' });
    // The class's languages are You speak, marked Given with no Pick (final drafts D).
    expect(screen.queryByRole('checkbox', { name: 'Pick Reedspeak' })).toBeNull();
    expect(screen.getByRole('group', { name: /^You speak/ }).textContent).toContain('Reedspeak');
    const next = screen.getByRole('button', { name: 'Next' });
    expect((next as HTMLButtonElement).disabled).toBe(false);
    await user.click(next);
    expect((await screen.findAllByText('Pick 1 more, or Decide later.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Languages' })).toBeTruthy();
  });

  it('when the pack requires languages, the missing-language message does not offer Decide later', async () => {
    guidedWorld({ rules: { creation: { require: ['languages'] } } });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user);
    await nameAndNext(user);
    await screen.findByRole('heading', { name: 'Languages' });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect((await screen.findAllByText('Pick 1 more.')).length).toBeGreaterThan(0);
  });
});

describe('nothing takes focus by itself (A4)', () => {
  it('no input is focused on opening "Who are they?" or the languages step', async () => {
    guidedWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user);
    expect(isField(document.activeElement)).toBe(false);
    await nameAndNext(user);
    await screen.findByRole('heading', { name: 'Languages' });
    expect(isField(document.activeElement)).toBe(false);
  });
});

describe('the To finish card on the sheet', () => {
  it('shows for a character with languages left to finish, and goes away once they are done', async () => {
    const { me, campaign } = guidedWorld();
    // A character who put the languages off: approved, with the step on its To finish list.
    const id = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === id)!, { classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }], fields: { STR: 12 }, creation: { toFinish: ['languages'] } });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Open Reed' }));
    await openFullSheetFromMenu(user);
    const card = await screen.findByRole('region', { name: 'To finish' });
    expect(within(card).getByText('You can play now.')).toBeTruthy();
    expect(within(card).getAllByRole('button').length).toBe(1);
    await user.click(within(card).getByRole('button', { name: /Languages/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Languages' }));
    // A step opened from To finish is creation's step: the book's type and its fold mark (dec-10 A, cs-9; #747's review).
    expect(screen.getByRole('dialog', { name: 'Languages' }).closest('.book-type')).not.toBeNull();
    expect(within(card).getByRole('button', { name: /Languages/ }).closest('.book-type')).toBeNull();
    // The same step as at creation: the given ones ticked, one more to pick.
    await user.click(dialog.getByRole('checkbox', { name: 'Pick Gull-sign' }));
    await user.click(dialog.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'To finish' })).toBeNull());
    const reed = world.tables.actors.find((a) => a.name === 'Reed')!;
    expect((reed.creation as { toFinish?: string[] }).toFinish ?? []).toEqual([]);
    expect((reed.fields as { languages: string }).languages).toBe('Fen common, Reedspeak, Fenmoot, Gull-sign');
  });
});

describe('the shop', () => {
  it('after a buy, the toast\'s Undo takes the purchase back out and "Gold to spend" goes back up', async () => {
    guidedWorld({ money: true, languages: false });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user);
    await user.type(screen.getByLabelText('Name'), 'Reed');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // The money is typed on the Gear step (m5b-0c slice 5); the shop is the Add item sheet's creation variant.
    await user.clear(await screen.findByRole('textbox', { name: 'Starting coin' }));
    await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '10');
    await waitFor(() => expect(coin()).toBe('10 rolled'));
    await user.click(screen.getByRole('button', { name: 'Open The shop' }));
    await user.type(screen.getByLabelText('Search items'), 'lamp');
    await user.click(screen.getByRole('button', { name: 'Buy Reed lamp, 2 gp' }));
    await waitFor(() => expect(shopLeft()).toBe('8 gp to spend'));
    const toast = screen.getByText('Bought Reed lamp for 2 gp').closest('[role]') ?? screen.getByText('Bought Reed lamp for 2 gp').parentElement!;
    await user.click(within(toast as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(shopLeft()).toBe('10 gp to spend'));
    await user.click(screen.getByRole('button', { name: 'Done shopping' }));
    expect(screen.queryByRole('button', { name: /^Put back Reed lamp/ })).toBeNull();
    const reed = world.tables.actors.find((a) => a.name === 'Reed')!;
    expect(world.tables.inventory_lines.filter((l) => l.actor_id === reed.id)).toEqual([]);
  });
});

// M5b gate finding F22 (Design, 2026-11-10): with nothing to pick, the Languages step is skipped and the given
// languages (the setting's common tongue, then the kindred's and class's) are the character's from the draft on. A
// later step that saves the sheet's fields (here a trait list) must keep them: the review lists them as the Languages
// step does, the common tongue included and once.
describe('the review lists the given languages as the Languages step does (F22)', () => {
  /** A setting whose common tongue everyone speaks, no extra language to pick, a trait list, and one class. */
  function reedWorld(classLanguages: string[]) {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, me, 'player');
    world.tables.packs.push({ id: 'pack-reed', owner_user_id: gm, campaign_id: null, name: 'Reed Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-reed', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('rulesSet', 'reed-rules', 'Reed rules', {
      abilities: [{ key: 'STR', short: 'Strength', name: 'Strength' }],
      abilityModifiers: { STR: [{ range: '3-18', melee: 0, extraLanguages: 0 }] },
      languages: { common: ['reed-common'], alignment: false, list: [{ id: 'reed-common', name: 'Common reed-speech' }, { id: 'marsh-whistle', name: 'Marsh whistle' }], extraFrom: 'STR' },
    });
    entry('class', 'reed-hunter', 'Reed hunter', { progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: {} }], ...(classLanguages.length > 0 ? { languages: classLanguages } : {}) });
    entry('fieldTemplate', 'reed-sheet', 'reed-sheet', { appliesTo: 'pc', fields: [{ key: 'STR', label: 'Strength', type: 'number' }] });
    entry('traitList', 'reed-callings', 'Reed callings', { entries: [{ id: 'eel-catcher', name: 'Eel catcher', blurb: 'Knows the channels.' }, { id: 'reed-cutter', name: 'Reed cutter', blurb: 'Strong arms.' }] });
    world.tables.campaign_packs.push({ id: 'link-reed', campaign_id: campaign, pack_id: 'pack-reed', pack_name: 'Reed Rules', option_choices: {}, overrides: {}, priority: 1 });
    const field = (key: string, label: string, type: string, order: number, fromList: string | null) =>
      world.tables.field_definitions.push({ id: `field-${key}`, campaign_id: campaign, applies_to: 'pc', key, label, type, choices: [], field_group: 'Who they are', sort_order: order, show_on_card: false, hidden: false, fill: null, required: false, from_list: fromList, created_at: '2026-10-18T12:00:00Z' });
    field('STR', 'Strength', 'number', 0, null);
    field('languages', 'Languages', 'text', 1, null);
    field('calling', 'Calling', 'list', 2, 'reed-callings');
    world.signInAs(me);
  }

  /** Scores, the Reed hunter, Who they are (Wren), a calling picked: the review (no Languages step: nothing to pick). */
  async function toReview(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await pickOption(user, 'Reed hunter');
    await screen.findByRole('heading', { name: 'Who they are' });
    await user.type(screen.getByLabelText('Name'), 'Wren');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Reed callings' });
    await user.click(screen.getByRole('checkbox', { name: 'Pick Eel catcher' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('button', { name: 'Send to the GM' });
  }

  /** The review's Languages section as read, or '' when there is none. */
  const languagesOnReview = () => {
    const heading = screen.getAllByRole('heading', { level: 2 }).find((h) => (h.textContent ?? '').startsWith('Languages'));
    return heading?.closest('section')?.textContent ?? '';
  };

  it('a character whose kindred and class give no languages shows the setting\'s common tongue on the review, as the Languages step does', async () => {
    reedWorld([]);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toReview(user);
    expect(languagesOnReview()).toContain('Common reed-speech');
    expect((world.tables.actors.find((a) => a.name === 'Wren')!.fields as { languages?: string }).languages).toBe('Common reed-speech');
  });

  it('a character whose class gives a language shows it and the common tongue on the review, the common tongue once', async () => {
    reedWorld(['Marsh whistle']);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toReview(user);
    const shown = languagesOnReview();
    expect(shown).toContain('Marsh whistle');
    expect(shown.match(/Common reed-speech/g)?.length).toBe(1);
    expect((world.tables.actors.find((a) => a.name === 'Wren')!.fields as { languages?: string }).languages).toBe('Common reed-speech, Marsh whistle');
  });
});
