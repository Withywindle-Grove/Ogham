// @vitest-environment jsdom
// "Who they are" on the creation step shell (M5b step 0c, slice 3; cr-12, cr-23; mockup creation/04), on the invented
// fixture pack scripts/fixtures/m5b-creation.fixture.json. Every name and number is invented.
//   A layout field with `fill` is never asked: it shows under Derived fields, read-only, live with the picks.
//   Hit points outside the die's range are explained; the roll gives the hit points with the modifier and the minimum.
//   The alignment is option rows with the pack's notes, and the setting's visibility is said.
//   The re-roll callout (follow-up A, cf-1) shows only when the pack's option is on and the die shows 2 or less:
//   Roll again clears the number (with Undo), Keep it hides the callout for that roll; never forced.
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
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; fromList?: string };

/** The fixture's setting attached to a campaign whose fields came from its sheet layout; `hp` makes the campaign ask hit points. */
function fenWorld({ hp = false, options = {} }: { hp?: boolean; options?: Record<string, string> } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  if (hp) Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { hpRequired: true } });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  for (const h of pack.hooks!) entry('hook', h);
  // Only the options a test names are attached (the fixture's creation-path option would add a method step).
  for (const o of pack.options!.filter((o) => String(o.id) in options)) entry('option', o);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: options, overrides: {}, priority: 1 });
  // The campaign's fields as the sheet layout made them, with its fill marks (only the ones this step reads).
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => !['background', 'languages', 'hp'].includes(f.key));
  layout.forEach((f, order) =>
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type: f.type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, created_at: '2026-10-18T12:00:00Z' }),
  );
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
const derived = (label: string) => (screen.getByRole('button', { name: label }).closest('.derived-fields__row') as HTMLElement).querySelector('dd')!.textContent;

async function typeIn(user: User, label: string, value: string) {
  const field = screen.getByRole('textbox', { name: label });
  await user.clear(field);
  if (value) await user.type(field, value);
}

/** Scores (GRT as given), Kindred, Class and Adjust scores, to "Who they are". */
async function toWho(user: User, { grt = '9', race = 'Bog folk', klass = 'Lantern Warden' } = {}) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  await typeIn(user, 'Grit', grt);
  await next(user);
  await pick(user, race);
  await next(user);
  await pick(user, klass);
  await next(user);
  if (heading() === 'Adjust scores') await next(user);
  await screen.findByRole('heading', { name: 'Who they are' });
}

describe('Who they are: Derived fields (cr-12, cr-23)', () => {
  it('a layout field with fill is never asked: it shows under Derived fields, read-only, with its value from the picks', async () => {
    fenWorld();
    const user = openApp();
    await toWho(user);
    expect(screen.getByText('Step 5 of 7')).toBeTruthy();
    for (const label of ['Armour', 'Movement', 'Attack', 'Save vs mire', 'Title', 'Literacy']) expect(screen.queryByRole('textbox', { name: label })).toBeNull();
    // The fixture's Hark and Spell ward (the third test) are derived too.
    expect(screen.getByText('Derived values')).toBeTruthy();
    expect(screen.getByText(/^8 figures the rules work out/)).toBeTruthy();
    // Bog folk: NIM 9 → 10 (NIM +0), WIT 9 (reads); the warden at level 1. Armour is AC with nothing worn: the
    // setting's unarmoured 10 and NIM +0 (the second test, 2026-11-02: the fill was left blank at creation).
    expect(derived('Attack')).toBe('19');
    expect(derived('Save vs mire')).toBe('12');
    expect(derived('Title')).toBe('Lamplighter');
    expect(derived('Literacy')).toBe('Reads');
    expect(derived('Movement')).toBe('125');
    expect(derived('Armour')).toBe('10, unarmoured, Nimbleness +0');
    // A free field the layout leaves is asked; one the rules work out never is.
    expect(screen.getByRole('textbox', { name: 'Motto' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Attack' }));
    // Purpose: a derived field opens the full sheet's breakdown (bq-2), not a general line.
    expect(within(await screen.findByRole('dialog', { name: 'Attack' })).getByText('Attack 19 for a Lantern Warden at level 1.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Armour' }));
    // AC worked out at creation reads as the AC tile's pop-up, nothing worn yet.
    expect(within(await screen.findByRole('dialog', { name: 'Armour' })).getByText('Unarmoured: 10')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Save vs mire' }));
    expect(within(await screen.findByRole('dialog', { name: 'Save vs mire' })).getByText('Save mire 12 for a Lantern Warden at level 1.')).toBeTruthy();
  });

  it('the Derived fields follow a change of class made with Back', async () => {
    fenWorld();
    const user = openApp();
    await toWho(user);
    await user.type(screen.getByLabelText('Name'), 'Tam of the Reeds');
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    expect(heading()).toBe('Adjust scores');
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    expect(heading()).toBe('Class');
    await pick(user, 'Reed Witch');
    await next(user);
    if (heading() === 'Adjust scores') await next(user);
    await screen.findByRole('heading', { name: 'Who they are' });
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Tam of the Reeds');
    expect(derived('Attack')).toBe('20');
    expect(derived('Title')).toBe('Reed-reader');
  });
});

describe('Who they are: hit points (cr-12)', () => {
  it("hp outside the die's range is explained; the roll gives the hit points, and the record keeps the roll", async () => {
    fenWorld({ hp: true });
    const user = openApp();
    await toWho(user);
    // The Roll row with the class's die (final drafts C); the average prefilled, its line until touched.
    expect(screen.getByText('Roll 1d8 for hit points and enter it.').closest('.roll-row')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Hit points' }) as HTMLInputElement).value).toBe('4');
    expect(screen.getByText('Average')).toBeTruthy();
    // Named once, by the group's heading (Design, 2026-11-07): no second label over the stepper.
    expect(screen.queryByText('Hit points', { selector: 'label' })).toBeNull();
    // No prompt beside the box (ct-4): the arithmetic only, once the die is in.
    expect(screen.queryByText('type what the dice showed')).toBeNull();
    expect(hint()).toBe('Name and leaning missing');
    await next(user);
    expect((await screen.findAllByText('Name and leaning missing.')).length).toBeGreaterThan(0);
    expect(heading()).toBe('Who they are');
    await user.type(screen.getByLabelText('Name'), 'Tam');
    await typeIn(user, 'Hit points', '9');
    expect(hint()).toBe('1d8 gives 1–8: type what the dice showed.');
    await next(user);
    expect((await screen.findAllByText('1d8 gives 1–8: type what the dice showed.')).length).toBeGreaterThanOrEqual(2);
    expect(heading()).toBe('Who they are');
    await typeIn(user, 'Hit points', '5');
    expect(screen.getByText('5 rolled: 5 hit points')).toBeTruthy();
    await pick(user, 'Reed');
    expect(hint()).toBe('Name, hp and leaning set');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' }); // the step after (slice 5)
    expect(world.tables.actors.find((a) => a.name === 'Tam')).toMatchObject({ hp_max: 5, approval: 'draft' });
    expect(world.tables.rolls.map((r) => [r.expression, r.result, r.purpose])).toContainEqual(['1d8', 5, 'hp']);
  });

  // Purpose: hit points are an average stepper (final drafts A5, C): + from the average steps on from it, steps within
  // the die, and at its end says the range instead of going on.
  it('steps the roll within the die and says the range at its end', async () => {
    fenWorld({ hp: true });
    const user = openApp();
    await toWho(user);
    const box = () => (screen.getByRole('textbox', { name: 'Hit points' }) as HTMLInputElement).value;
    await user.click(screen.getByRole('button', { name: 'Raise Hit points' }));
    expect(box()).toBe('5');
    expect(screen.queryByText('Average')).toBeNull();
    await typeIn(user, 'Hit points', '1');
    await user.click(screen.getByRole('button', { name: 'Lower Hit points' }));
    expect(box()).toBe('1');
    expect(await screen.findByText('1d8 gives 1–8.')).toBeTruthy();
    await typeIn(user, 'Hit points', '8');
    await user.click(screen.getByRole('button', { name: 'Raise Hit points' }));
    expect(box()).toBe('8');
    await user.click(screen.getByRole('button', { name: 'Lower Hit points' }));
    expect(box()).toBe('7');
    expect(screen.getByText('7 rolled: 7 hit points')).toBeTruthy();
  });

  it("a low roll with a negative modifier never goes under the pack's minimum", async () => {
    fenWorld({ hp: true });
    const user = openApp();
    // GRT 6, bog folk −1 → 5: the hp modifier is −1.
    await toWho(user, { grt: '6' });
    // The Roll row says only the roll; the modifier is said once, in the sum (cs-8, dec-10 D).
    expect(screen.getByText('Roll 1d8 for hit points and enter it.')).toBeTruthy();
    // Untouched, the line says what the average gives.
    expect(screen.getByText('Average. −1 for Grit 5: 3 hit points')).toBeTruthy();
    await typeIn(user, 'Hit points', '1');
    expect(screen.getByText('1 rolled, −1 for Grit 5: 1 hit point, never below 1')).toBeTruthy();
  });
});

describe('Who they are: the average left as it is (final drafts A5, C)', () => {
  // Purpose: hit points left at the prefilled average count, log no roll, and the draft says "the average, not
  // rolled" so the review and the GM's card can call it out.
  it('keeps the average as the hit points, logs no roll, and flags the draft', async () => {
    fenWorld({ hp: true });
    const user = openApp();
    await toWho(user);
    await user.type(screen.getByLabelText('Name'), 'Tam');
    await pick(user, 'Reed');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' });
    const tam = world.tables.actors.find((a) => a.name === 'Tam')!;
    expect(tam).toMatchObject({ hp_max: 4 });
    expect(world.tables.rolls.filter((r) => r.purpose === 'hp')).toEqual([]);
    expect(tam.creation).toMatchObject({ hpAverage: true });
  });
});

describe('Who they are: the hit-points re-roll (follow-up A, cf-1)', () => {
  it('with the option on, a die of 2 or less offers Roll again / Keep it; 3 or more offers nothing', async () => {
    fenWorld({ hp: true, options: { 'fen-second-wind': 'on' } });
    const user = openApp();
    await toWho(user);
    await user.type(screen.getByLabelText('Name'), 'Tam');
    expect(screen.queryByRole('group', { name: 'Weak roll' })).toBeNull();
    await typeIn(user, 'Hit points', '3');
    expect(screen.queryByRole('group', { name: 'Weak roll' })).toBeNull();
    await typeIn(user, 'Hit points', '2');
    const callout = within(screen.getByRole('group', { name: 'Weak roll' }));
    expect(callout.getByText('A 1 or 2 on the die: you may roll your hit points again.')).toBeTruthy();
    // Roll again puts the average back, untouched; Undo brings the roll back.
    await user.click(callout.getByRole('button', { name: 'Roll again' }));
    expect((screen.getByRole('textbox', { name: 'Hit points' }) as HTMLInputElement).value).toBe('4');
    expect(screen.getByText('Average')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Weak roll' })).toBeNull();
    await user.click((await screen.findAllByRole('button', { name: 'Undo' }))[0]!);
    expect((screen.getByRole('textbox', { name: 'Hit points' }) as HTMLInputElement).value).toBe('2');
    // Keep it hides the callout for that roll, and Next goes on with it (never forced).
    await user.click(within(screen.getByRole('group', { name: 'Weak roll' })).getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByRole('group', { name: 'Weak roll' })).toBeNull();
    await pick(user, 'Reed');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' });
    expect(world.tables.actors.find((a) => a.name === 'Tam')).toMatchObject({ hp_max: 2 });
  });

  it('with the option off, a low die offers nothing', async () => {
    fenWorld({ hp: true, options: { 'fen-second-wind': 'off' } });
    const user = openApp();
    await toWho(user);
    await typeIn(user, 'Hit points', '1');
    expect(screen.getByText('1 rolled: 1 hit point')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Weak roll' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Roll again' })).toBeNull();
  });
});

describe('Who they are: alignment (cr-12, cr-22)', () => {
  // Design, 2026-11-05 (the gate walk: a paragraph per row was heavy on a phone): the row shows alignmentBlurbs' one
  // line; the full alignmentNotes text is in the entry; with no blurb the row is the name alone.
  it('a row shows the pack’s one-line blurb, never the full note, which its entry opens to; no blurb, the name alone', async () => {
    fenWorld();
    const long = 'Keeps the lights lit for everyone, through every night of the long fen winter, whatever the cost to the keeper.';
    for (const e of world.tables.library_entries.filter((x) => x.kind === 'rulesSet')) {
      const data = e.data as Record<string, Record<string, string>>;
      e.data = { ...data, alignmentNotes: { ...data.alignmentNotes, Lantern: long }, alignmentBlurbs: { Lantern: 'Keeps the lights lit.' } };
    }
    const user = openApp();
    await toWho(user);
    const group = within(screen.getByRole('group', { name: 'Leaning' }));
    const lantern = group.getByText('Lantern', { selector: '.pick-row__name' }).closest('.pick-row') as HTMLElement;
    expect(lantern.textContent).toContain('Keeps the lights lit.');
    expect(lantern.textContent).not.toContain('long fen winter');
    // Reed has a note but no blurb: the row is its name alone.
    expect((group.getByText('Reed', { selector: '.pick-row__name' }).closest('.pick-row') as HTMLElement).textContent).not.toContain('Bends with the wind.');
    await user.click(group.getByText('Lantern', { selector: '.pick-row__name' }));
    expect(within(await screen.findByRole('dialog', { name: 'Lantern' })).getByText(long)).toBeTruthy();
  });

  it("the alignment is option rows with the pack's notes; the owner-only setting is said; a required one is checked by Next", async () => {
    fenWorld();
    const user = openApp();
    await toWho(user);
    const group = within(screen.getByRole('group', { name: 'Leaning' }));
    expect(group.getByText('Which way your character leans when the lights go out.')).toBeTruthy();
    expect(group.getByText('Only you and your GM see it.')).toBeTruthy();
    expect(group.getByText('Keeps the lights lit for everyone.').closest('.pick-row')?.textContent).toContain('Lantern');
    // The alignment is asked as rows, not again as a list field.
    expect(screen.queryByRole('combobox', { name: 'Leaning' })).toBeNull();
    await user.type(screen.getByLabelText('Name'), 'Tam');
    expect(hint()).toBe('Leaning missing');
    await next(user);
    expect((await screen.findAllByText('Pick your leaning.')).length).toBeGreaterThan(0);
    // The row's text opens its entry (ct3-11, 2026-11-03): its note and the setting's word, with Pick at the foot.
    await user.click(group.getByText('Mire', { selector: '.pick-row__name' }));
    const entry = within(await screen.findByRole('dialog', { name: 'Mire' }));
    expect(entry.getByText('Lets the dark in.')).toBeTruthy();
    expect(entry.getByText('Which way your character leans when the lights go out.')).toBeTruthy();
    await user.click(entry.getByRole('button', { name: 'Pick Mire' }));
    expect(group.getByRole('checkbox', { name: 'Pick Mire' }).getAttribute('aria-checked')).toBe('true');
    expect(hint()).toBe('Name and leaning set');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' }); // the step after (slice 5)
    // The derived values are saved on the character too, including one reached inside a row (WIT's literacy): before
    // slice 3 a fill name like abilityModifiers.WIT.literacy was saved blank.
    expect(world.tables.actors.find((a) => a.name === 'Tam')!.fields).toMatchObject({ literacy: 'Reads', title: 'Lamplighter', attack: 19 });
    // The alignment lives in its own table (slice 1), read only by whoever the setting lets see it.
    expect(JSON.stringify(world.tables.character_alignments)).toContain('Mire');
  });
});

describe('Who they are: the class’s alignment limits (cs-3, rc-5)', () => {
  // Purpose (cw-8): the closed alignment is a not-allowed row, full contrast with a ▲ and the reason, no Pick; a tap explains in a pop-up.
  // Purpose (final drafts C, ⚑3): a closed alignment row explains itself and can be taken by asking the GM; it's then
  // picked, flagged on the draft for the GM's approval, and Next goes on.
  it('a hard limit (the fixture’s Marsh Chaplain: Lantern or Reed) shows Mire as a not-allowed row with no Pick; a tap says why and offers to ask the GM', async () => {
    fenWorld();
    const user = openApp();
    await toWho(user, { klass: 'Marsh Chaplain' });
    const group = within(screen.getByRole('group', { name: 'Leaning' }));
    expect(group.getByText('A marsh chaplain may only be Lantern or Reed.')).toBeTruthy();
    expect(group.getByRole('checkbox', { name: 'Pick Lantern' })).toBeTruthy();
    expect(group.getByRole('checkbox', { name: 'Pick Reed' })).toBeTruthy();
    expect(group.queryByRole('checkbox', { name: 'Pick Mire' })).toBeNull();
    const closed = group.getByText('Mire', { selector: '.pick-row__name' }).closest('.pick-row') as HTMLElement;
    expect(closed.className).toContain('pick-row--closed');
    expect(within(closed).getByText('Not open to marsh chaplain').closest('.warning-line')?.querySelector('.warning-sign')).not.toBeNull();
    expect(within(closed).queryByRole('checkbox')).toBeNull();
    await user.click(within(closed).getByText('Mire'));
    const popup = within(await screen.findByRole('dialog', { name: 'Mire' }));
    expect(popup.getByText('Not open to marsh chaplain')).toBeTruthy();
    expect(popup.getByText(/^A marsh chaplain can't be Mire\. Your GM can allow it as a special approval/)).toBeTruthy();
    expect(popup.queryByRole('button', { name: 'Pick Mire' })).toBeNull();
    await user.click(popup.getByRole('button', { name: 'Ask the GM to allow it' }));
    expect(screen.queryByRole('dialog', { name: 'Mire' })).toBeNull();
    expect(await screen.findByText('Mire picked: needs the GM’s special approval')).toBeTruthy();
    const asked = group.getByRole('checkbox', { name: 'Pick Mire' });
    expect(asked.getAttribute('aria-checked')).toBe('true');
    expect((asked.closest('.pick-row') as HTMLElement).textContent).toContain("Needs the GM's special approval");
    await user.type(screen.getByLabelText('Name'), 'Tam');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' });
    expect(world.tables.actors.find((a) => a.name === 'Tam')!.creation).toMatchObject({ specialApprovals: [{ step: 'alignment', name: 'Mire', requirement: "A marsh chaplain can't be Mire" }] });
  });

  it('a soft limit (the fixture’s Mire Stalker: usually Reed or Mire) offers every row; another is flagged and saved for the GM', async () => {
    fenWorld();
    const user = openApp();
    await toWho(user, { klass: 'Mire Stalker' });
    const group = within(screen.getByRole('group', { name: 'Leaning' }));
    expect(group.getByText("A mire stalker is usually Reed or Mire; another needs the GM's special approval.")).toBeTruthy();
    const lantern = group.getByText('Keeps the lights lit for everyone.').closest('.pick-row') as HTMLElement;
    expect(lantern.textContent).toContain("Needs the GM's special approval");
    expect((group.getByText('Lets the dark in.').closest('.pick-row') as HTMLElement).textContent).not.toContain('special approval');
    await user.type(screen.getByLabelText('Name'), 'Tam');
    await user.click(group.getByRole('checkbox', { name: 'Pick Lantern' }));
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' });
    expect(world.tables.actors.find((a) => a.name === 'Tam')!.creation).toMatchObject({
      specialApprovals: [{ step: 'alignment', entryId: 'Lantern', name: 'Lantern', requirement: 'A mire stalker is usually Reed or Mire' }],
    });
  });
});

describe('Who they are: Derived fields start folded and the device remembers (cw-7)', () => {
  /** A window this wide, for matchMedia. */
  const windowOf = (width: number) => {
    window.matchMedia = ((query: string) => {
      const min = /min-width:\s*(\d+)px/.exec(query);
      const max = /max-width:\s*(\d+)px/.exec(query);
      const matches = (!min || width >= Number(min[1])) && (!max || width <= Number(max[1])) && Boolean(min || max);
      return { matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
    }) as typeof window.matchMedia;
  };
  const folded = () => (screen.getByText('Derived values').closest('details') as HTMLDetailsElement).open;

  // Purpose: the group starts folded even on a wide tablet; opening it is remembered on this device for the next time.
  it('starts folded on a landscape tablet, stays open once opened, and is still open the next time', async () => {
    localStorage.removeItem('grimoire.packOpen');
    windowOf(1180);
    try {
      fenWorld();
      const user = openApp();
      await toWho(user);
      expect(folded()).toBe(false);
      await user.click(screen.getByText('Derived values'));
      await waitFor(() => expect(folded()).toBe(true));
      expect(JSON.parse(localStorage.getItem('grimoire.packOpen') ?? '{}')).toMatchObject({ derived: true });
      cleanup();
      const again = openApp();
      await toWho(again);
      expect(folded()).toBe(true);
    } finally {
      localStorage.removeItem('grimoire.packOpen');
      // @ts-expect-error: put back "no matchMedia", as the other tests expect
      delete window.matchMedia;
    }
  });
});
