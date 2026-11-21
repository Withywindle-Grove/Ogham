// @vitest-environment jsdom
// The creation step shell (M5b step 0c, slice 2; cr-1 … cr-11; docs/plans/m5b-0c-creation-rebuild.md, build order 2):
// on the invented fixture pack scripts/fixtures/m5b-creation.fixture.json. Every name and number is invented.
//   Next explains an empty score and an unmet requirement; Back to Class resets trades with Undo; a prose rule gives
//   no Adjust step; Method shows only with a player-chosen path; every step shows its title and counter; the ✓ slot
//   picks and the row opens the entry with Pick / Unpick; the scores strip shows a racial change live.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { forgetAllKept } from './keptCreation.ts';

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

/** The invented setting from the fixture pack, attached to a campaign; `rules` changes the rules set; `method` keeps or drops the player-chosen path. */
function fenWorld({ rules = {}, method = true }: { rules?: Record<string, unknown>; method?: boolean } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name), data });
  for (const r of pack.rulesSets!) entry('rulesSet', { ...r, ...rules });
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  if (method) for (const o of pack.options!) entry('option', o);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  let order = 0;
  for (const key of ['MUS', 'NIM', 'GRT', 'WIT', 'LORE', 'CHARM']) {
    world.tables.field_definitions.push({ id: `field-${key}`, campaign_id: campaign, applies_to: 'pc', key, label: key, type: 'number', choices: [], field_group: 'Abilities', sort_order: order++, show_on_card: false, hidden: false, fill: null, required: false, created_at: '2026-10-18T12:00:00Z' });
  }
  world.signInAs(me);
  return { gm, me, campaign };
}

function openApp(): User {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  return user;
}

async function toGuided(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
const hint = () => screen.getByRole('status', { name: 'Step status' }).textContent?.replace(/^▲ /, '') ?? '';
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
// No total before the class is picked (ruled B 2026-11-05): "Step 2", then "Step 4 of 7".
const counter = () => screen.getByText(/^Step \d+( of \d+)?$/).textContent ?? '';

// The Scores step shows each ability's full name (cw-11).
const FULL_NAMES: Record<string, string> = { MUS: 'Muscle', NIM: 'Nimbleness', GRT: 'Grit', WIT: 'Wit', LORE: 'Lore', CHARM: 'Charm' };

async function typeScore(user: User, key: string, value: string) {
  const field = screen.getByLabelText(FULL_NAMES[key] ?? key);
  await user.clear(field);
  if (value) await user.type(field, value);
}

describe('the step shell: titles, counters and which steps exist (cr-1, cr-3, cr-8)', () => {
  it('Method shows only with a player-chosen path, and its hint says how many steps the pick gives', async () => {
    fenWorld();
    const user = openApp();
    await toGuided(user);
    expect(heading()).toBe('How do you want to build?');
    expect(counter()).toBe('Step 1');
    // A method that leaves classes out says so on its row before it is picked (dec-10 B, cs-6); one that leaves none, nothing.
    const rowOf = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) }).closest('.pick-row') as HTMLElement;
    expect(rowOf('Calling as kindred').querySelector('.warning-line')?.textContent).toBe('3 classes then need the GM’s special approval');
    expect(rowOf('Kindred, then calling').querySelector('.warning-line')).toBeNull();
    await next(user);
    expect((await screen.findAllByText('Pick one first.')).length).toBeGreaterThan(1);
    await pick(user, 'Calling as kindred');
    expect(hint()).toBe('Calling as kindred picked: about 7 steps');
    await pick(user, 'Kindred, then calling');
    expect(hint()).toBe('Kindred, then calling picked: about 8 steps');
    await next(user);
    expect(heading()).toBe('Scores');
    expect(counter()).toBe('Step 2');
  });

  // Purpose (R3-9, 2026-11-08, replacing final drafts A8's accent on the default Pick): only one accent button on any
  // creation screen, and it is Next; no option row's Pick is ever the accent, before a pick or after.
  it('Next is the one accent on every screen; no row’s Pick carries it', async () => {
    fenWorld();
    const user = openApp();
    await toGuided(user);
    const accents = () => [...document.querySelectorAll('.button-primary')].map((b) => b.textContent);
    const rowAccents = () => document.querySelectorAll('.pick-row .button-primary').length;
    expect(accents()).toEqual(['Next']);
    expect(rowAccents()).toBe(0);
    expect(screen.getByRole('checkbox', { name: 'Pick Kindred, then calling' }).classList.contains('button-primary')).toBe(false);
    await pick(user, 'Kindred, then calling');
    expect(accents()).toEqual(['Next']);
    await next(user);
    expect(accents()).toEqual(['Next']);
    await next(user);
    await screen.findByRole('heading', { name: 'Kindred' });
    expect(accents()).toEqual(['Next']);
    expect(rowAccents()).toBe(0);
    await pick(user, 'Stone kin');
    await screen.findByRole('heading', { name: 'Class' });
    expect(accents()).toEqual(['Next']);
    expect(rowAccents()).toBe(0);
  });

  it('with one path there is no Method step: creation opens on the scores', async () => {
    fenWorld({ method: false });
    const user = openApp();
    await toGuided(user);
    expect(heading()).toBe('Scores');
    expect(counter()).toBe('Step 1');
  });
});

describe('the Scores step (cr-2, cr-9)', () => {
  // Purpose (cw-11): each score shows the ability's full name, marked ⓘ; a tap on the name says what the ability is
  // and what this number does, in a pop-up the ✕ closes.
  it('shows full names; a tap on one explains the ability and what its number does', async () => {
    fenWorld({ method: false });
    const user = openApp();
    await toGuided(user);
    const tile = screen.getByRole('group', { name: 'Muscle score' });
    const name = within(tile).getByRole('button', { name: 'Muscle: what it does' });
    expect(name.textContent).toBe('Muscle');
    expect(name.querySelector('svg')).not.toBeNull();
    await typeScore(user, 'MUS', '13');
    expect(tile.querySelector('.score-tile__words')?.textContent).toBe('+1 melee');
    await user.click(name);
    const dialog = await screen.findByRole('dialog', { name: 'Muscle' });
    expect(within(dialog).getByText('Lifting, hitting and holding a line.')).toBeTruthy();
    expect(within(dialog).getByText('At 13: +1 melee.')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Muscle' })).toBeNull();
    // At the average, nothing changes: the pop-up says so in words.
    await typeScore(user, 'MUS', '9');
    await user.click(name);
    expect(within(await screen.findByRole('dialog', { name: 'Muscle' })).getByText('At 9, nothing changes in play.')).toBeTruthy();
  });


  // Purpose: a score with nothing in the setting's table leaves its caption blank, on a tablet tile as on a phone row
  // (P4, 2026-11-06: the "No change" label is dropped; this overrides the earlier "No change" tile rule).
  it('a score the setting has no modifier table for leaves its caption blank', async () => {
    fenWorld({ method: false, rules: { abilityModifiers: {} } });
    const user = openApp();
    await toGuided(user);
    await typeScore(user, 'MUS', '13');
    expect(screen.getByRole('group', { name: 'Muscle score' }).querySelector('.score-tile__words')?.textContent ?? '').toBe('');
  });

  // Purpose: a step with nothing to ask is skipped, never shown empty (mockup creation/13): a setting with no ability
  // scores opens on the Kindred step as step 1, the first step (Leave at the top, no Back).
  it('a setting with no ability scores skips Scores', async () => {
    fenWorld({ method: false, rules: { abilities: [] } });
    const user = openApp();
    await toGuided(user);
    expect(heading()).toBe('Kindred');
    expect(counter()).toBe('Step 1');
    expect(screen.queryByRole('heading', { name: /^Scores/ })).toBeNull();
    // The first step: the foot's Back reads Leave (final drafts A1), as on Scores; no Back to a step before.
    expect(screen.queryByRole('button', { name: 'Back to the step before' })).toBeNull();
    expect(document.querySelector('.creation-step__foot')?.querySelector('.creation-step__foot-leave')?.textContent).toBe('Leave');
  });
  it('the tiles start at the dice average with the modifier words; Next explains an empty score and one outside the range', async () => {
    fenWorld({ method: false });
    const user = openApp();
    await toGuided(user);
    expect((screen.getByLabelText('Muscle') as HTMLInputElement).value).toBe('9');
    // Untouched (final drafts A5, slice B): the average's line, never "0 melee"; the foot counts what's rolled.
    expect(within(screen.getByRole('group', { name: 'Muscle score' })).queryByText('0 melee')).toBeNull();
    expect(screen.getByRole('group', { name: 'Muscle score' }).querySelector('.score-tile__words')?.textContent).toBe('Average');
    expect(hint()).toBe('0 of 6 rolled');
    await typeScore(user, 'CHARM', '');
    expect(hint()).toBe('Charm is missing');
    await next(user);
    // The hint and the toast both say it.
    expect((await screen.findAllByText(/^(▲ )?Charm is missing$/)).length).toBeGreaterThanOrEqual(2);
    expect(heading()).toBe('Scores');
    await typeScore(user, 'CHARM', '17');
    await next(user);
    expect(hint()).toBe('Charm must be 2–16');
    await typeScore(user, 'CHARM', '12');
    await user.click(within(screen.getByRole('group', { name: 'Muscle score' })).getByRole('button', { name: 'Raise Muscle' }));
    expect((screen.getByLabelText('Muscle') as HTMLInputElement).value).toBe('10');
    // Touched: the average's line gives way to the caption, blank where the number changes nothing (P4).
    expect(screen.getByRole('group', { name: 'Muscle score' }).querySelector('.score-tile__words')?.textContent ?? '').toBe('');
    expect(hint()).toBe('2 of 6 rolled');
    await next(user);
    expect(heading()).toBe('Kindred'); // The pack's word for the step (creationGuide.race.title, ruled 2026-11-02).
  });

  // A re-roll restarts at the average (the third test, ct3-1): Start over puts every tile back at the dice average,
  // as the step first opened, never empty.
  it('the setting\'s start-over rule is offered when it triggers, never forced; Start over puts the tiles back at the average, with Undo', async () => {
    fenWorld({ method: false });
    const user = openApp();
    await toGuided(user);
    const keys = ['MUS', 'NIM', 'GRT', 'WIT', 'LORE', 'CHARM'];
    const tile = (key: string) => (screen.getByLabelText(FULL_NAMES[key] ?? key) as HTMLInputElement).value;
    const average = tile('MUS');
    expect(average).toMatch(/^\d+$/);
    for (const key of keys) await typeScore(user, key, '5');
    const callout = within(screen.getByRole('group', { name: 'Weak roll' }));
    expect(callout.getByText(/you may start over/)).toBeTruthy();
    await user.click(callout.getByRole('button', { name: 'Start over' }));
    expect(keys.map(tile)).toEqual(keys.map(() => average));
    expect(screen.queryByRole('group', { name: 'Weak roll' })).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect((screen.getByLabelText('Muscle') as HTMLInputElement).value).toBe('5');
    await user.click(screen.getByRole('button', { name: 'Keep them' }));
    expect(screen.queryByRole('group', { name: 'Weak roll' })).toBeNull();
  });
});

describe('Race and Class (cr-5, cr-7, cr-10)', () => {
  async function toRace(user: User, grt = '8') {
    await toGuided(user);
    await typeScore(user, 'NIM', '8');
    await typeScore(user, 'GRT', grt);
    await next(user);
    expect(heading()).toBe('Kindred'); // The pack's word for the step (creationGuide.race.title, ruled 2026-11-02).
  }

  it('a row ends in a Pick button; the row opens the formatted entry (bullets, open classes as chips that open the class); Pick on Kindred lands on Class with a toast, and Undo returns with nothing picked (ct-1, ct-2)', async () => {
    fenWorld({ method: false });
    const user = openApp();
    await toRace(user);
    const bogFolk = screen.getByRole('checkbox', { name: 'Pick Bog folk' });
    expect(bogFolk.getAttribute('aria-checked')).toBe('false');
    expect(bogFolk.textContent).toBe('Pick');
    // No empty ✓ square on creation's rows any more (ct-1).
    expect(document.querySelector('.pick-row__tick')).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Bog folk/ }));
    let sheet = within(await screen.findByRole('dialog', { name: 'Bog folk' }));
    expect(sheet.getByText('Requirement')).toBeTruthy();
    // Advantages and disadvantages as the book's lists: a bold lead-in and a full stop (dec-10 S3; cs-4, A2).
    expect(sheet.getByText('Second wind.').closest('li')?.textContent).toBe('Second wind. Breathes under water for a turn.');
    expect(sheet.getByText('Small.').closest('li')?.textContent).toBe("Small. Can't use large weapons.");
    // Open classes as chips; a chip opens the class to read (no pick there), ✕ back to the kindred.
    expect(sheet.getByRole('button', { name: 'Lantern Warden (to 8)' })).toBeTruthy();
    await user.click(sheet.getByRole('button', { name: 'Reed Witch (to 6)' }));
    const witch = within(await screen.findByRole('dialog', { name: 'Reed Witch' }));
    expect(witch.getByText('Hit die')).toBeTruthy();
    expect(witch.queryByRole('button', { name: /^Pick/ })).toBeNull();
    // The class's level table in the book's style (dec-10 C, cs-16): its titles and hit dice by level, nothing invented
    // (the fixture has no experience table, so no Experience column; level 2's hit dice aren't given, so its cell is empty).
    const levels = witch.getByRole('table', { name: 'Reed Witch by level' });
    expect([...levels.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Level', 'Title', 'Hit dice']);
    expect([...levels.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent))).toEqual([
      ['1', 'Reed-reader', '1d4'],
      ['2', 'Hedge-singer', ''],
      ['3', 'Witch', '3d4'],
    ]);
    await user.click(witch.getByRole('button', { name: 'Back to Bog folk' }));
    sheet = within(await screen.findByRole('dialog', { name: 'Bog folk' }));
    await user.click(sheet.getByRole('button', { name: 'Pick Bog folk' }));
    // Pick → Next: the class step at once, with the toast.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(heading()).toBe('Class');
    expect(await screen.findByText('Bog folk picked')).toBeTruthy();
    // The strip: GRT 8 → 7 · bog folk −1, NIM 8 → 9.
    const strip = within(screen.getByRole('list', { name: 'Your scores' }));
    expect(strip.getByText('8 → 7')).toBeTruthy();
    expect(strip.getByText('bog folk −1')).toBeTruthy();
    // Undo: back on Kindred with nothing picked.
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(heading()).toBe('Kindred');
    expect(screen.getByRole('checkbox', { name: 'Pick Bog folk' }).getAttribute('aria-checked')).toBe('false');
    // The row's button picks too; Back shows it Picked ✓; tapping Picked ✓ unpicks and stays.
    await pick(user, 'Bog folk');
    expect(heading()).toBe('Class');
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    const picked = screen.getByRole('checkbox', { name: 'Pick Bog folk' });
    expect(picked.getAttribute('aria-checked')).toBe('true');
    expect(picked.textContent).toBe('Picked ✓');
    expect(picked.closest('.pick-row')?.className).toContain('pick-row--picked');
    await user.click(picked);
    expect(heading()).toBe('Kindred');
    expect(screen.getByRole('checkbox', { name: 'Pick Bog folk' }).getAttribute('aria-checked')).toBe('false');
  });

  // Moved here from the older pick list's test (M5b step 0; m5b-0c sweep): the rows on the shell keep the rule.
  it('a row shows only the pack\'s blurb, or the older summary, and never a sentence from the notes', async () => {
    fenWorld({ method: false });
    for (const row of world.tables.library_entries) {
      if (row.pack_entry_id === 'bog-folk') row.data = { ...(row.data as Record<string, unknown>), blurb: undefined, notes: 'Creeps along the reeds. Hates the sun.' };
      if (row.pack_entry_id === 'stone-kin') row.data = { ...(row.data as Record<string, unknown>), blurb: undefined, summary: 'Keeps the causeway.' };
    }
    const user = openApp();
    await toRace(user);
    const bogFolk = screen.getByRole('button', { name: /^Bog folk/ });
    expect(within(bogFolk).getByText('Bog folk')).toBeTruthy();
    expect(screen.queryByText(/Creeps along the reeds/)).toBeNull();
    expect(within(screen.getByRole('button', { name: /^Stone kin/ }).closest('.pick-row') as HTMLElement).getByText('Keeps the causeway.')).toBeTruthy();
  });

  it('an unmet requirement is picked with its note and Next goes on; the review and the record flag it for the GM (ruled 2026-11-02)', async () => {
    fenWorld({ method: false });
    const user = openApp();
    await toRace(user);
    const row = screen.getByRole('button', { name: /^Stone kin/ }).closest('.pick-row') as HTMLElement;
    // After-test A9: the needs line names the ability in full; the scores strip above stays short.
    expect(row.textContent).toContain('Needs Grit 9, you have 8');
    expect(screen.getByRole('list', { name: 'Your scores' }).textContent).toContain('GRT');
    expect(row.querySelector('strong')?.textContent).toBe('8');
    expect(row.textContent).toContain("Needs the GM's special approval");
    await pick(user, 'Stone kin');
    expect(heading()).toBe('Class');
    expect(await screen.findByText('Stone kin picked: needs the GM’s special approval')).toBeTruthy();
    await pick(user, 'Lantern Warden');
    expect(heading()).toBe('Adjust scores');
    await next(user);
    await screen.findByRole('heading', { name: 'Who they are' });
    await user.type(screen.getByLabelText('Name'), 'Reed');
    await next(user);
    // Gear (slice 5): the money typed, nothing taken.
    await screen.findByRole('heading', { name: 'Gear' });
    await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
    await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '90');
    await next(user);
    // Stone kin have a Details step (cs-1), optional: Next passes it, nothing filled (cs-11: no "Skip, leave blank").
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    // The review flags it in bold, with the requirement it misses (ca-3).
    // Final drafts D: every exception in the review's last card, under the sign, its name over the pack's reason.
    const exceptions = await screen.findByRole('region', { name: "1 thing needs the GM's special approval" });
    expect(within(exceptions).getByText('Stone kin')).toBeTruthy();
    expect(within(exceptions).getByText('Stone kin needs Grit 9, you have 8')).toBeTruthy();
    expect(world.tables.actors.find((a) => a.name === 'Reed')!.creation).toMatchObject({ specialApprovals: [{ step: 'race', entryId: 'stone-kin', name: 'Stone kin', requirement: 'Stone kin needs Grit 9, you have 8' }] });
  });

  // Purpose: a class the kindred rules out stays in the list after the open ones (final drafts C), with the sign and
  // why and no Pick; its entry says whose rule closes it and offers Ask the GM to allow it, which takes it, flagged.
  it('the class step lists the classes the race rules out after the open ones, never hidden, words the fit line, and a hard limit is taken only by asking the GM (cs-3, final drafts C)', async () => {
    fenWorld({ method: false });
    const user = openApp();
    await toRace(user, '9');
    // Stone kin (GRT 9): the witch isn't open to them.
    await pick(user, 'Stone kin');
    expect(heading()).toBe('Class');
    const open = within(screen.getByRole('group', { name: 'Classes' }));
    expect(open.getByRole('checkbox', { name: 'Pick Lantern Warden' })).toBeTruthy();
    expect(open.queryByRole('checkbox', { name: 'Pick Reed Witch' })).toBeNull();
    // No fold (final drafts C): the closed row is in the same list.
    expect(open.getByRole('button', { name: /^Reed Witch/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Lantern Warden/ }).closest('.pick-row')!.textContent).toContain('Muscle 9, d8, +0% experience, to level 12 as Stone kin');
    // A class the race's hard limit rules out (cs-3) is a not-allowed row (cw-8, cw-11): ▲ and why, no Pick; its
    // entry says why at its top and has no Pick either; the step stays.
    expect(screen.queryByRole('checkbox', { name: 'Pick Reed Witch' })).toBeNull();
    const witch = screen.getByRole('button', { name: /^Reed Witch/ }).closest('.pick-row') as HTMLElement;
    expect(witch.querySelector('.warning-line')?.textContent).toBe('Not open to stone kin');
    expect(witch.textContent).not.toContain("Needs the GM's special approval");
    await user.click(screen.getByRole('button', { name: /^Reed Witch/ }));
    expect(await screen.findByText(/^Stone kin’s list of classes leaves out Reed Witch/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pick Reed Witch' })).toBeNull();
    expect(heading()).toBe('Class');
    // Asked for: taken, flagged for the GM, and the walk moves on as a Pick does.
    await user.click(screen.getByRole('button', { name: 'Ask the GM to allow it' }));
    expect(await screen.findByText('Reed Witch picked: needs the GM’s special approval')).toBeTruthy();
    expect(heading()).not.toBe('Class');
  });

  it('a soft limit (bog folk’s Fen Cantor) is in the open list, flagged; picked, it goes on and is saved for the GM’s special approval (cs-3)', async () => {
    fenWorld({ method: false });
    const user = openApp();
    await toRace(user);
    await pick(user, 'Bog folk');
    const open = within(screen.getByRole('group', { name: 'Classes' }));
    expect(open.getByRole('checkbox', { name: 'Pick Fen Cantor' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Fen Cantor/ }).closest('.pick-row')!.textContent).toContain("Needs the GM's special approval");
    await pick(user, 'Fen Cantor');
    expect(heading()).not.toBe('Class');
    expect(await screen.findByText('Fen Cantor picked: needs the GM’s special approval')).toBeTruthy();
  });

  /** The fixture's kindred-limits option attached with this choice (the creation-path option left off: no method step). */
  function withKinLimits(choice: string) {
    const option = pack.options!.find((o) => o.id === 'fen-kin-limits')!;
    world.tables.library_entries.push({ id: 'entry-option-fen-kin-limits', pack_id: 'pack-fen', kind: 'option', pack_entry_id: 'fen-kin-limits', name: String(option.name), data: option });
    world.tables.campaign_packs.find((l) => l.id === 'link-fen')!.option_choices = { 'fen-kin-limits': choice };
  }

  it('the race read after the campaign’s choice (cs-5): with the default the Marsh Chaplain is open to bog folk; with “Chaplains are the GM’s” it is closed, not pickable', async () => {
    fenWorld({ method: false });
    withKinLimits('kept');
    let user = openApp();
    await toRace(user);
    await pick(user, 'Bog folk');
    expect(within(screen.getByRole('group', { name: 'Classes' })).getByRole('checkbox', { name: 'Pick Marsh Chaplain' })).toBeTruthy();
    cleanup();
    forgetCampaignSetting();
    // The first walk's picks are kept on the device as they were made (after-test A12): start afresh.
    forgetAllKept();
    world.tables.campaign_packs.find((l) => l.id === 'link-fen')!.option_choices = { 'fen-kin-limits': 'chaplains-npc' };
    window.history.replaceState(null, '', '/');
    user = openApp();
    await toRace(user);
    await pick(user, 'Bog folk');
    expect(within(screen.getByRole('group', { name: 'Classes' })).queryByRole('checkbox', { name: 'Pick Marsh Chaplain' })).toBeNull();
    // Closed (cw-8, cw-11): no Pick at all; its entry says why.
    expect(screen.queryByRole('checkbox', { name: 'Pick Marsh Chaplain' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Marsh Chaplain/ }));
    expect(heading()).toBe('Class');
    expect(await screen.findByText(/^Bog folk take Marsh Chaplain only as the GM’s characters/)).toBeTruthy();
  });
});

describe('Adjust scores (cr-11)', () => {
  async function toAdjust(user: User) {
    await toGuided(user);
    await typeScore(user, 'WIT', '16');
    await next(user);
    await pick(user, 'Bog folk');
    await pick(user, 'Lantern Warden');
    expect(heading()).toBe('Adjust scores');
  }

  // Purpose: the Adjust tiles name each ability in full, marked ⓘ, and a tap says what it does, as on Scores (Design, 2026-11-06).
  it('Adjust tiles show full names; a tap on one explains the ability', async () => {
    fenWorld({ method: false });
    const user = openApp();
    await toAdjust(user);
    const name = within(screen.getByRole('group', { name: 'Muscle score' })).getByRole('button', { name: 'Muscle, prime: what it does' });
    expect(name.querySelector('svg')).not.toBeNull();
    await user.click(name);
    expect(within(await screen.findByRole('dialog', { name: 'Muscle' })).getByText('Lifting, hitting and holding a line.')).toBeTruthy();
  });

  // Purpose (final draft 1): only the tradeable scores have tiles, each with only the control the rule allows; a trade
  // shows a toast naming both scores with Undo; each trade's chip ✕ undoes only it; Next explains unspent points; Back
  // to Class resets with Undo.
  it('only the tradeable scores have tiles with the rule\'s button; the rest are named as kept; a trade toasts with Undo and each chip ✕ undoes only it; Next explains unspent points; Back to Class resets with Undo (ct-3)', async () => {
    fenWorld({ method: false });
    const user = openApp();
    await toAdjust(user);
    expect(counter()).toBe('Step 4 of 7');
    const mus = within(screen.getByRole('group', { name: 'Muscle score' }));
    expect(mus.getByText('Prime')).toBeTruthy();
    // The prime has only its raise; a lowerable score only its lowering; no Undo on tiles.
    expect(mus.queryByRole('button', { name: /^Lower Muscle/ })).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Wit score' })).queryByRole('button', { name: /^Raise Wit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Undo the trade on/ })).toBeNull();
    // GRT can't be lowered as a Lantern Warden (the fixture's class exception): no tile, one line says so.
    expect(screen.queryByRole('group', { name: 'Grit score' })).toBeNull();
    expect(screen.getByText('Grit stays as rolled in these rules, so it isn’t shown here')).toBeTruthy();
    // Nothing banked yet: the raise answers instead.
    await user.click(mus.getByRole('button', { name: 'Raise Muscle by 1' }));
    expect(await screen.findByText('Nothing banked. Lower a score by 2 first, then raise Muscle.')).toBeTruthy();
    await user.click(within(screen.getByRole('group', { name: 'Wit score' })).getByRole('button', { name: 'Lower Wit by 2' }));
    expect(hint()).toMatch(/1 to spend: raise a prime, or undo the lowering$/);
    expect(screen.getByRole('button', { name: 'Undo the trade WIT −2' })).toBeTruthy();
    await next(user);
    expect((await screen.findAllByText(/^(▲ )?1 to spend: raise a prime, or undo the lowering$/)).length).toBeGreaterThanOrEqual(2);
    expect(heading()).toBe('Adjust scores');
    await user.click(mus.getByRole('button', { name: 'Raise Muscle by 1' }));
    // The trade's toast names both scores, with Undo; Undo takes the whole trade back (final draft 1).
    expect(await screen.findByText('Wit 16 → 14, Muscle 9 → 10')).toBeTruthy();
    expect(hint()).toBe('1 trade made');
    expect(mus.getByText('10')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(mus.getByText('9')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Wit score' })).getByText('16')).toBeTruthy();
    expect(hint()).toBe('No trades yet');
    await user.click(within(screen.getByRole('group', { name: 'Wit score' })).getByRole('button', { name: 'Lower Wit by 2' }));
    await user.click(mus.getByRole('button', { name: 'Raise Muscle by 1' }));
    expect(mus.getByText('10')).toBeTruthy();
    // A second trade, then the first chip's ✕: only that trade goes.
    await user.click(within(screen.getByRole('group', { name: 'Charm score' })).getByRole('button', { name: 'Lower Charm by 2' }));
    await user.click(mus.getByRole('button', { name: 'Raise Muscle by 1' }));
    expect(mus.getByText('11')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo the trade WIT −2 → MUS +1' }));
    expect(screen.queryByRole('button', { name: 'Undo the trade WIT −2 → MUS +1' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo the trade CHARM −2 → MUS +1' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Wit score' })).getByText('16')).toBeTruthy();
    expect(mus.getByText('10')).toBeTruthy();
    expect(hint()).toBe('1 trade made');
    // Back to the one trade the rest of the test reads.
    await user.click(screen.getByRole('button', { name: 'Undo the trade CHARM −2 → MUS +1' }));
    await user.click(within(screen.getByRole('group', { name: 'Wit score' })).getByRole('button', { name: 'Lower Wit by 2' }));
    await user.click(mus.getByRole('button', { name: 'Raise Muscle by 1' }));
    // Back to Class resets every trade, with Undo.
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    expect(heading()).toBe('Class');
    expect(await screen.findByText('Trades reset.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await next(user);
    expect(heading()).toBe('Adjust scores');
    expect(hint()).toBe('1 trade made');
    await next(user);
    expect(await screen.findByRole('heading', { name: 'Who they are' })).toBeTruthy();
  });

  it('a prose rule gives no Adjust step: the class goes straight to "Who are they?", and the counter never counts it', async () => {
    fenWorld({ method: false, rules: { abilityAdjustment: 'Lower one score by 2 to raise your prime by 1.' } });
    const user = openApp();
    await toGuided(user);
    expect(counter()).toBe('Step 1');
    await next(user);
    await pick(user, 'Bog folk');
    // Pick on the last of these steps (ct-1): straight to Who they are, with the toast; Undo returns with nothing picked.
    await pick(user, 'Lantern Warden');
    expect(await screen.findByRole('heading', { name: 'Who they are' })).toBeTruthy();
    expect(await screen.findByText('Lantern Warden picked')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('heading', { name: 'Class' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Pick Lantern Warden' }).getAttribute('aria-checked')).toBe('false');
    await pick(user, 'Lantern Warden');
    expect(await screen.findByRole('heading', { name: 'Who they are' })).toBeTruthy();
    // Scores, Kindred, Class, then Who they are: step 4, no Adjust counted.
    expect(counter()).toMatch(/^Step 4 of \d+$/);
  });
});
