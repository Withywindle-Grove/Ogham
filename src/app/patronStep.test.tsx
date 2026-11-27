// @vitest-environment jsdom
// The cleric's Patron step (December step 1a; docs/plans/dec-1-creation.md 1a, docs/plans/m5b-patrons.md A–C; pt-1 …
// pt-8; the rework of 2026-11-12: pt-9, pt-10 and Francis's rulings), on a copy of the invented fixture pack
// (scripts/fixtures/m5b-creation.fixture.json) with three invented patrons behind an option, and a second attached
// pack that carries a same-named patron. Every name is invented.
//   The Patron step is its own step straight after Class, only for a class a patron in play names; it counts.
//   Next with none picked opens a pop-up; Decide later puts it on the To finish list; Send to the GM opens the step.
//   A change of class clears the patron, with Undo. The review names it in its first card, with its own Change.
//   The pick sets or narrows the alignment and fills Affiliation on Who they are; a patron marked for the GM is flagged.
//   Switched off by its option, a character's patron is hidden and kept, and back when switched on.
//   A class that casts nothing still takes the step: followers drive it, not spellcasting.
//   The garb lands in the pack on the Gear step; the sheet shows the patron's whole ladder, reached or to come.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { openFullSheetFromMenu } from '../testing/openFullSheet.ts';

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
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean };
const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
const template = pack.fieldTemplates![0]!;
const layoutFields = template.fields as LayoutField[];

const OPTION = { id: 'ex-opt-patrons', name: 'Patrons', default: 'off', changeLater: 'allow', choices: [{ id: 'on', name: 'On' }, { id: 'off', name: 'Off' }] };
const HERON = {
  id: 'ex-patron-heron',
  name: 'The Still Heron',
  option: 'ex-opt-patrons',
  blurb: 'Patience in the reeds.',
  followers: { classes: ['marsh-chaplain'], alignments: ['Reed'] },
  holySymbol: 'A heron feather bound in reed.',
  holyGarb: [
    { atSpellLevel: 0, text: 'A reed-grey stole', itemIds: ['ex-garb-heron-0'], costGp: 5 },
    { atSpellLevel: 1, text: 'A heron-bone clasp', itemIds: ['ex-garb-heron-1'], costGp: 20 },
  ],
  prayer: 'Prays standing in still water.',
  strictures: 'Must never startle a wading bird.',
  spells: { extends: 'marsh-chaplain', swap: [{ level: 1, replaces: 'lantern-blessing', with: 'glimmer' }] },
  marks: [{ atSpellLevel: 1, text: 'Stands on one leg without tiring.' }],
};
const WARDEN = {
  id: 'ex-patron-lantern-warden',
  name: 'The Lantern Warden',
  option: 'ex-opt-patrons',
  blurb: 'Keeper of the Last Light.',
  followers: { classes: ['marsh-chaplain'], alignments: ['Lantern', 'Reed'] },
  holySymbol: 'A lantern with an open shutter.',
  approval: 'gm',
  approvalNote: 'Ask your GM: the Warden takes few servants.',
};
const WITCH_ONLY = { id: 'ex-patron-moth', name: 'The Pale Moth', option: 'ex-opt-patrons', blurb: 'Drawn to every flame.', followers: { classes: ['reed-witch'] } };
// `novice`: a patron for the Lantern Warden class, which casts no spells (followers drive the step, not spellcasting).
const QUIET_LAMP = { id: 'ex-patron-quiet-lamp', name: 'The Quiet Lamp', option: 'ex-opt-patrons', blurb: 'A light kept low.', followers: { classes: ['lantern-warden'] } };
const GARB = [
  { id: 'ex-garb-heron-0', name: 'Reed-grey stole', category: 'clothing', value: { gp: 5 }, weightCoin: 10 },
  { id: 'ex-garb-heron-1', name: 'Heron-bone clasp', category: 'clothing', value: { gp: 20 }, weightCoin: 1 },
];

/** The fixture's setting with the patrons' pack parts, attached to a campaign; `on`: the patrons' option is switched on. */
function fenWorld({ on = true, twin = false, missing = false, novice = false }: { on?: boolean; twin?: boolean; missing?: boolean; novice?: boolean } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  const addPack = (id: string, name: string, priority: number, choices: Record<string, string>) => {
    world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: name } });
    world.tables.campaign_packs.push({ id: `link-${id}`, campaign_id: campaign, pack_id: id, pack_name: name, option_choices: choices, overrides: {}, priority });
  };
  const entry = (packId: string, kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${packId}-${kind}-${String(data.id)}`, pack_id: packId, kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  addPack('pack-fen', 'Fen sample', 1, on ? { 'ex-opt-patrons': 'on' } : {});
  // The fixture's own options are left out (its creation-method option would add a step); the patrons' option is added below.
  for (const part of ['rulesSets', 'races', 'classes', 'hooks', 'spells', 'spellLists', 'items', 'startingKits', 'tables'] as const) {
    const kind = { rulesSets: 'rulesSet', races: 'race', classes: 'class', hooks: 'hook', spells: 'spell', spellLists: 'spellList', items: 'item', startingKits: 'startingKit', tables: 'table' }[part];
    for (const e of pack[part] ?? []) entry('pack-fen', kind, e);
  }
  entry('pack-fen', 'fieldTemplate', template);
  entry('pack-fen', 'option', OPTION);
  // `missing`: the heron's tier-0 garb also names an item no attached pack has.
  const heron = missing ? { ...HERON, holyGarb: [{ ...HERON.holyGarb[0]!, itemIds: ['ex-garb-heron-0', 'ex-garb-elsewhere'] }, HERON.holyGarb[1]!] } : HERON;
  for (const p of [heron, WARDEN, WITCH_ONLY, ...(novice ? [QUIET_LAMP] : [])]) entry('pack-fen', 'patron', p);
  for (const item of GARB) entry('pack-fen', 'item', item);
  if (twin) {
    addPack('pack-road', 'Road pack', 2, {});
    entry('pack-road', 'patron', { id: 'ex-patron-heron-road', name: 'The Still Heron', blurb: 'The road’s own heron.', followers: { classes: ['marsh-chaplain'] } });
  }
  const asked = layoutFields.filter((f) => !['background', 'languages', 'hp', 'omen'].includes(f.key));
  asked.forEach((f, order) =>
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type: f.type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, created_at: '2026-10-18T12:00:00Z' }),
  );
  world.signInAs(me);
  return { campaign, me, gm };
}

function openApp(): User {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  return user;
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const counter = () => document.querySelector('.step-counter')?.textContent ?? '';
const leaningGroup = () => screen.getByRole('group', { name: 'Leaning' });
const patronList = () => screen.getByRole('group', { name: 'Patrons' });
const creationOf = (name: string) => world.tables.actors.find((a) => a.name === name)!.creation as Record<string, unknown>;

/** Scores and Kindred, then the class picked: its Pick moves on (ct-1). */
async function pickClass(user: User, klass = 'Marsh Chaplain') {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  await next(user);
  await pick(user, 'Bog folk');
  await screen.findByRole('heading', { name: 'Class' });
  await pick(user, klass);
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

describe('the Patron step (pt-10: its own step straight after Class)', () => {
  // Purpose: with the patrons' option off there is no Patron step: the class goes straight on, for the cleric or anyone.
  it('has no Patron step while the option is off', async () => {
    fenWorld({ on: false });
    const user = openApp();
    await pickClass(user);
    await onToWho(user);
    expect(screen.queryByRole('heading', { name: 'Patron' })).toBeNull();
  });

  // Purpose (14-01, 14-08): with the option on, a class a patron names gets the step straight after Class, with only
  // its patrons, the sentence under the count, the GM's patron folded, "No patron yet"; and the step counts: Who they
  // are is one step later, of one more, than with the option off.
  it('opens after Class for a class a patron names, and counts in the total', async () => {
    fenWorld({ on: false });
    const off = openApp();
    await pickClass(off);
    await onToWho(off);
    const without = counter().match(/Step (\d+) of (\d+)/)!.map(Number);
    cleanup();
    world = createFakeDb();
    forgetCampaignSetting();
    fenWorld();
    const user = openApp();
    await pickClass(user);
    await screen.findByRole('heading', { name: 'Patron' });
    expect(screen.getByText('Your patron sets or narrows your alignment.')).toBeTruthy();
    expect(within(patronList()).getByRole('checkbox', { name: 'Pick The Still Heron' })).toBeTruthy();
    expect(within(patronList()).queryByRole('checkbox', { name: 'Pick The Pale Moth' })).toBeNull();
    expect(within(patronList()).getByText("1 more needs the GM's approval")).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('No patron yet');
    const at = counter().match(/Step (\d+) of (\d+)/)!.map(Number);
    await pick(user, 'The Still Heron');
    await onToWho(user);
    const withIt = counter().match(/Step (\d+) of (\d+)/)!.map(Number);
    expect(withIt[1]).toBe(without[1]! + 1);
    expect(withIt[2]).toBe(without[2]! + 1);
    expect(at[2]).toBe(withIt[2]);
  });

  // Purpose: a class no patron names has no Patron step and nothing marking its absence.
  it('does not ask a class no patron names', async () => {
    fenWorld();
    const user = openApp();
    await pickClass(user, 'Lantern Warden');
    await onToWho(user);
    expect(screen.queryByText(/patron/i)).toBeNull();
  });

  // Purpose (14-03): a pick stays on the step, reads Picked ✓, says so in a toast with Undo, and the foot names it.
  it('a pick reads Picked, with a toast and Undo', async () => {
    fenWorld();
    const user = openApp();
    await pickClass(user);
    await screen.findByRole('heading', { name: 'Patron' });
    await pick(user, 'The Still Heron');
    expect(screen.getByRole('checkbox', { name: 'Pick The Still Heron' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('The Still Heron picked');
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Pick The Still Heron' }).getAttribute('aria-checked')).toBe('false'));
    expect(heading()).toBe('Patron');
  });

  // Purpose (14-05): Next with none picked is never disabled: a pop-up says why, "Choose a patron" closes it and stays,
  // "Back to Class" goes back to the class.
  it('Next with none picked opens a pop-up with both ways out', async () => {
    fenWorld();
    const user = openApp();
    await pickClass(user);
    await screen.findByRole('heading', { name: 'Patron' });
    await next(user);
    const popup = within(await screen.findByRole('dialog', { name: 'Pick a patron first' }));
    // One sentence (cs-50, 23-H5); the buttons say the two ways out, the class step named as the pack names it.
    expect(popup.getByText('A Marsh Chaplain follows a patron.')).toBeTruthy();
    // Its buttons are the ways out, so no ✕ (cs-27: an X or buttons, never both).
    expect(popup.queryByRole('button', { name: 'Close' })).toBeNull();
    await user.click(popup.getByRole('button', { name: 'Choose a patron' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(heading()).toBe('Patron');
    await next(user);
    await user.click(within(await screen.findByRole('dialog', { name: 'Pick a patron first' })).getByRole('button', { name: 'Back to Class' }));
    await screen.findByRole('heading', { name: 'Class' });
  });

  // Purpose (14-07): a change of class clears the patron picked under the old one, said in a toast; its Undo puts the
  // class and the patron back.
  it('a change of class clears the patron, with Undo', async () => {
    fenWorld();
    const user = openApp();
    await pickClass(user);
    await screen.findByRole('heading', { name: 'Patron' });
    await pick(user, 'The Still Heron');
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    await screen.findByRole('heading', { name: 'Class' });
    await pick(user, 'Lantern Warden');
    expect(await screen.findByText('Class changed. Your patron was cleared.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Pick Marsh Chaplain' }).getAttribute('aria-checked')).toBe('true'));
    await next(user);
    await screen.findByRole('heading', { name: 'Patron' });
    expect(screen.getByRole('checkbox', { name: 'Pick The Still Heron' }).getAttribute('aria-checked')).toBe('true');
  });

  // Purpose (sn-1): two patrons with the same name, from two attached packs, each show their pack.
  it('same-named patrons show their pack after the name', async () => {
    fenWorld({ twin: true });
    const user = openApp();
    await pickClass(user);
    await screen.findByRole('heading', { name: 'Patron' });
    expect(within(patronList()).getByRole('checkbox', { name: 'Pick The Still Heron, Fen sample' })).toBeTruthy();
    expect(within(patronList()).getByRole('checkbox', { name: 'Pick The Still Heron, Road pack' })).toBeTruthy();
  });

  // Purpose: a class that casts no spells at level 1 still takes the step when a patron's followers name it, and the
  // review names its patron: followers drive the step, not spellcasting.
  it('a class that casts nothing yet takes the step and the review line', async () => {
    fenWorld({ novice: true });
    const user = openApp();
    await pickClass(user, 'Lantern Warden');
    await screen.findByRole('heading', { name: 'Patron' });
    await pick(user, 'The Quiet Lamp');
    await onToWho(user);
    await user.type(screen.getByLabelText('Name'), 'Ash');
    await pick(user, 'Reed');
    await next(user);
    await toReview(user);
    expect(screen.getByText('Patron: The Quiet Lamp')).toBeTruthy();
    expect(creationOf('Ash').patron).toEqual({ id: 'ex-patron-quiet-lamp', name: 'The Quiet Lamp' });
  });
});

describe('Decide later and the review (the lead\'s rulings A and of 2026-11-11; 14-09b, ruling B)', () => {
  // Purpose (ruling A): Decide later on the step puts "patron" on the To finish list; at the review Send to the GM
  // stays tappable, says why, opens the Patron step, and sends nothing; the review's first card says it's to finish.
  it('Decide later goes on the To finish list; Send to the GM opens the Patron step and sends nothing', async () => {
    fenWorld();
    const user = openApp();
    await pickClass(user);
    await screen.findByRole('heading', { name: 'Patron' });
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    await onToWho(user);
    await user.type(screen.getByLabelText('Name'), 'Later');
    await pick(user, 'Reed');
    await next(user);
    const send = await toReview(user);
    expect(creationOf('Later').toFinish).toEqual(expect.arrayContaining(['patron']));
    expect(creationOf('Later').patron).toBeUndefined();
    expect(screen.getByText('Patron: Not picked yet')).toBeTruthy();
    expect((send as HTMLButtonElement).disabled).toBe(false);
    await user.click(send);
    expect(await screen.findByText('Choose a patron first: a marsh chaplain needs one before your GM can approve.')).toBeTruthy();
    await screen.findByRole('heading', { name: 'Patron' });
    expect(world.tables.actors.find((a) => a.name === 'Later')!.approval).toBe('draft');
    // Picking it there takes it off the list; Next comes back to the review.
    await pick(user, 'The Still Heron');
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    await waitFor(() => expect(creationOf('Later').patron).toEqual({ id: 'ex-patron-heron', name: 'The Still Heron' }));
    expect(creationOf('Later').toFinish ?? []).not.toContain('patron');
  });

  // Purpose (14-09b): the patron is a third line in the review's first card, "Kindred, class and patron", with its own
  // Change that opens the Patron step and comes back to the review.
  it('the review names the patron in its first card, with its own Change', async () => {
    fenWorld();
    const user = openApp();
    await pickClass(user);
    await screen.findByRole('heading', { name: 'Patron' });
    await pick(user, 'The Still Heron');
    await onToWho(user);
    await user.type(screen.getByLabelText('Name'), 'Tam');
    await next(user);
    await toReview(user);
    expect(screen.getByText('Kindred, class and patron')).toBeTruthy();
    expect(screen.getByText('Patron: The Still Heron')).toBeTruthy();
    // The Who they are card no longer carries the patron.
    expect(screen.getAllByText(/^Patron:/)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Change patron' }));
    await screen.findByRole('heading', { name: 'Patron' });
    await user.click(screen.getByRole('button', { name: 'Back to review' }));
    expect(await screen.findByText('Patron: The Still Heron')).toBeTruthy();
  });

  // Purpose: with no patron (a class none names), there is no line and the heading is as before.
  it('the review has no patron line, and the heading as before, without a patron', async () => {
    fenWorld();
    const user = openApp();
    await pickClass(user, 'Lantern Warden');
    await onToWho(user);
    await user.type(screen.getByLabelText('Name'), 'Odo');
    await pick(user, 'Reed');
    await next(user);
    await toReview(user);
    expect(screen.getByText('Kindred and class')).toBeTruthy();
    expect(screen.queryByText(/^Patron:/)).toBeNull();
  });

  // Purpose (the same ruling): a character that somehow arrives without the patron its class needs is not approved:
  // the GM's Approve says why and approves nothing.
  it("the GM's Approve refuses a character whose class needs a patron and has none", async () => {
    const { campaign, me, gm } = fenWorld();
    const tam = world.addCharacter(campaign, 'Tam', { ownerId: me, approval: 'pending' });
    Object.assign(world.tables.actors.find((a) => a.id === tam)!, { level: 1, hp_current: 6, hp_max: 6, notes: '', race_ref: 'bog-folk', fields: { MUS: 10 }, classes: [{ classRef: 'marsh-chaplain', level: 1, xp: 0 }], creation: { toFinish: ['patron'] } });
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Tam has no patron yet: a marsh chaplain needs one before you can approve. Send it back to choose one.')).toBeTruthy();
    expect(world.tables.actors.find((a) => a.id === tam)!.approval).toBe('pending');
  });
});

describe('what the pick does on Who they are (pt-3, pt-7)', () => {
  // Purpose: a patron whose followers have one alignment sets it as Who they are opens, and fills the empty
  // Affiliation; the alignment group offers only it, with a line saying why; the draft keeps all of it.
  it('sets the alignment and the affiliation, and the draft keeps the patron', async () => {
    fenWorld();
    const user = openApp();
    await pickClass(user);
    await screen.findByRole('heading', { name: 'Patron' });
    await pick(user, 'The Still Heron');
    await onToWho(user);
    expect(within(leaningGroup()).getByText('A follower of The Still Heron is Reed: their leaning follows their patron.')).toBeTruthy();
    expect(within(leaningGroup()).queryByRole('checkbox', { name: /Lantern/ })).toBeNull();
    expect(within(leaningGroup()).getByRole('checkbox', { name: /Reed/ }).getAttribute('aria-checked')).toBe('true');
    await user.type(screen.getByLabelText('Name'), 'Tam of the Reeds');
    await next(user);
    await waitFor(() => expect(heading()).not.toBe('Who they are'));
    const made = world.tables.actors.find((a) => a.name === 'Tam of the Reeds')!;
    expect(creationOf('Tam of the Reeds').patron).toEqual({ id: 'ex-patron-heron', name: 'The Still Heron' });
    expect(creationOf('Tam of the Reeds').specialApprovals ?? []).toEqual([]);
    expect((made.fields as Record<string, unknown>).affiliation).toBe('The Still Heron');
  });

  // Purpose (the lead's addition): a patron marked approval "gm" is folded with the approval sign, its entry carries
  // the note, and picking it flags the character for the GM with the note as the reason (special approval "patron");
  // the foot says the GM decides; its followers' alignments both stay open on Who they are.
  it('a patron the GM must approve shows its note and flags the draft', async () => {
    fenWorld();
    const user = openApp();
    await pickClass(user);
    await screen.findByRole('heading', { name: 'Patron' });
    await user.click(within(patronList()).getByText("1 more needs the GM's approval"));
    expect(within(patronList()).getByText("Needs the GM's special approval")).toBeTruthy();
    await user.click(within(patronList()).getByRole('button', { name: /The Lantern Warden/ }));
    const sheet = within(await screen.findByRole('dialog'));
    expect(sheet.getByText('Ask your GM: the Warden takes few servants.')).toBeTruthy();
    await user.click(sheet.getByRole('button', { name: /^Pick/ }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Pick The Lantern Warden' }).getAttribute('aria-checked')).toBe('true'));
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('The Lantern Warden picked. Your GM decides on the review');
    await onToWho(user);
    expect(within(leaningGroup()).getByRole('checkbox', { name: /Lantern/ })).toBeTruthy();
    expect(within(leaningGroup()).getByRole('checkbox', { name: /Reed/ })).toBeTruthy();
    await pick(user, 'Lantern');
    await user.type(screen.getByLabelText('Name'), 'Odo');
    await next(user);
    await waitFor(() => expect(heading()).not.toBe('Who they are'));
    expect(creationOf('Odo').patron).toEqual({ id: 'ex-patron-lantern-warden', name: 'The Lantern Warden' });
    expect(creationOf('Odo').specialApprovals).toEqual([{ step: 'patron', entryId: 'ex-patron-lantern-warden', name: 'The Lantern Warden', requirement: 'Ask your GM: the Warden takes few servants.' }]);
  });
});

describe('what the patron applies (pt-6, "done properly")', () => {
  /** The Patron step with the heron picked, Who they are named, on to the Gear step. */
  async function toGear(user: User) {
    await pickClass(user);
    await screen.findByRole('heading', { name: 'Patron' });
    await pick(user, 'The Still Heron');
    await onToWho(user);
    await user.type(screen.getByLabelText('Name'), 'Tam of the Reeds');
    await next(user);
    await waitFor(() => expect(heading()).not.toBe('Who they are'));
    for (let n = 0; n < 6 && heading() !== 'Gear'; n++) await next(user);
    expect(heading()).toBe('Gear');
  }

  // Purpose: on the Gear step the tier-0 garb is in the pack free, marked as the patron's; the tier-1 garb (from the
  // first level-1 spells, which a level-1 chaplain doesn't cast) is not.
  it('gives the tier-0 garb free on the Gear step, and no higher tier', async () => {
    fenWorld();
    const user = openApp();
    await toGear(user);
    const made = world.tables.actors.find((a) => a.name === 'Tam of the Reeds')!;
    await waitFor(() => expect(world.tables.inventory_lines.filter((l) => l.actor_id === made.id).map((l) => l.name)).toContain('Reed-grey stole'));
    expect(world.tables.inventory_lines.filter((l) => l.actor_id === made.id).map((l) => l.name)).not.toContain('Heron-bone clasp');
    expect(await screen.findByText('From The Still Heron')).toBeTruthy();
    // Kept on the record, so it is never given twice.
    await waitFor(() => expect(((made.creation as Record<string, unknown>).patronGarb as { patron: string; lines: unknown[] })?.patron).toBe('ex-patron-heron'));
    expect(((made.creation as Record<string, unknown>).patronGarb as { lines: unknown[] }).lines).toHaveLength(1);
  });

  // Purpose (the review of #636): a garb item this device can't find is named on the Gear step, never dropped
  // silently; the rest of the garb still goes in, and the record keeps which items were given.
  it('names a garb item it cannot find instead of dropping it silently', async () => {
    fenWorld({ missing: true });
    const user = openApp();
    await toGear(user);
    expect(await screen.findByText('The Still Heron’s garb “A reed-grey stole” isn\'t in the setting rules this device can read, so it isn\'t in your pack. Ask your GM to add it.')).toBeTruthy();
    const made = world.tables.actors.find((a) => a.name === 'Tam of the Reeds')!;
    await waitFor(() => expect(((made.creation as Record<string, unknown>).patronGarb as { items: string[] })?.items).toEqual(['ex-garb-heron-0']));
    expect(world.tables.inventory_lines.filter((l) => l.actor_id === made.id).map((l) => l.name)).toContain('Reed-grey stole');
  });
});

describe('the sheet (Francis, 2026-11-12) and hide and keep (pt-9)', () => {
  /** An approved level-1 marsh chaplain following the heron, the player's active character. */
  function tamWithHeron(campaign: string, me: string) {
    const tam = world.addCharacter(campaign, 'Tam', { ownerId: me, approval: 'approved' });
    Object.assign(world.tables.actors.find((a) => a.id === tam)!, { level: 1, hp_current: 6, hp_max: 6, notes: '', race_ref: 'bog-folk', fields: { MUS: 10, motto: 'Lights first' }, classes: [{ classRef: 'marsh-chaplain', level: 1, xp: 0 }], creation: { patron: { id: 'ex-patron-heron', name: 'The Still Heron' } } });
    world.tables.members.find((m) => m.campaign_id === campaign && m.user_id === me)!.active_actor_id = tam;
    return tam;
  }
  async function openSheet(user: User) {
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await openFullSheetFromMenu(user);
    await screen.findByText('Lights first');
  }

  // Purpose (the review of #636): a patron whose pack is detached is still named on the sheet, from the character's
  // own record, with "pack not attached".
  it('the sheet names a patron whose pack is no longer attached', async () => {
    const { campaign, me } = fenWorld();
    const tam = world.addCharacter(campaign, 'Tam', { ownerId: me, approval: 'approved' });
    Object.assign(world.tables.actors.find((a) => a.id === tam)!, { level: 1, hp_current: 6, hp_max: 6, notes: '', race_ref: 'bog-folk', fields: { MUS: 10, motto: 'Lights first' }, classes: [{ classRef: 'marsh-chaplain', level: 1, xp: 0 }], creation: { patron: { id: 'ex-patron-gone', name: 'The Drowned Bell' } } });
    world.tables.members.find((m) => m.campaign_id === campaign && m.user_id === me)!.active_actor_id = tam;
    const user = openApp();
    await openSheet(user);
    expect(screen.getByText('The Drowned Bell (pack not attached)')).toBeTruthy();
  });

  // Purpose (Francis, 2026-11-12): the patron's name sits beside the section's heading and opens its entry; under it
  // the book's whole ladder in its layout: each field with a bold lead-in, every garb tier and every mark, each said
  // reached or to come, and no row labelled "Patron".
  it('the sheet shows the patron beside its heading and the whole ladder, reached or to come', async () => {
    const { campaign, me } = fenWorld();
    tamWithHeron(campaign, me);
    const user = openApp();
    await openSheet(user);
    const section = within(screen.getByRole('region', { name: 'Patron' }));
    expect(section.getByText('A heron feather bound in reed.')).toBeTruthy();
    // The garb as a list by tier, like the marks (Francis, 2026-11-12): one line each, the tier in bold.
    const garb = within(section.getByText('Holy garb').nextElementSibling as HTMLElement).getAllByRole('listitem').map((li) => li.textContent);
    expect(garb).toEqual(['At creation: A reed-grey stole (reached)', 'From level-1 spells: A heron-bone clasp (to come)']);
    expect(section.getByText('Prays standing in still water.')).toBeTruthy();
    expect(section.getByText('Must never startle a wading bird.')).toBeTruthy();
    expect(section.getByText('Marks')).toBeTruthy();
    expect(section.getByText('Stands on one leg without tiring. (to come)')).toBeTruthy();
    await user.click(section.getByRole('button', { name: 'Patron The Still Heron: open its entry' }));
    const sheet = within(await screen.findByRole('dialog'));
    expect(sheet.getByText(/A heron-bone clasp \(worth 20 gp, given free\)/)).toBeTruthy();
  });

  // Purpose (pt-9, hide and keep): with the patrons' option off, the character's patron is hidden on the sheet (no
  // section, no "pack not attached") and kept on its record; switched on again, it is back.
  it('hides the patron while its option is off, keeps it on the record, and shows it again when on', async () => {
    const { campaign, me } = fenWorld({ on: false });
    const tam = tamWithHeron(campaign, me);
    const user = openApp();
    await openSheet(user);
    expect(screen.queryByRole('region', { name: 'Patron' })).toBeNull();
    expect(screen.queryByText(/The Still Heron/)).toBeNull();
    expect((world.tables.actors.find((a) => a.id === tam)!.creation as Record<string, unknown>).patron).toEqual({ id: 'ex-patron-heron', name: 'The Still Heron' });
    cleanup();
    forgetCampaignSetting();
    world.tables.campaign_packs.find((l) => l.pack_id === 'pack-fen')!.option_choices = { 'ex-opt-patrons': 'on' };
    const again = openApp();
    await openSheet(again);
    expect(within(screen.getByRole('region', { name: 'Patron' })).getByRole('button', { name: 'Patron The Still Heron: open its entry' })).toBeTruthy();
  });
});

describe("a change of patron before Create (Francis's report, 2026-11-12: the garb did not follow the patron)", () => {
  // A second patron for the marsh chaplain, with garb of its own and one leaning; both invented.
  const MOTHER = {
    id: 'ex-patron-reed-mother',
    name: 'The Reed Mother',
    option: 'ex-opt-patrons',
    blurb: 'Mother of the rushes.',
    followers: { classes: ['marsh-chaplain'], alignments: ['Lantern'] },
    holyGarb: [{ atSpellLevel: 0, text: 'A rush cloak', itemIds: ['ex-garb-mother-0'], costGp: 3 }],
  };
  const CLOAK = { id: 'ex-garb-mother-0', name: 'Rush cloak', category: 'clothing', value: { gp: 3 }, weightCoin: 10 };

  /** The fen world with the Reed Mother and her cloak in its pack. */
  function withMother() {
    const ids = fenWorld();
    for (const [kind, data] of [['patron', MOTHER], ['item', CLOAK]] as const)
      world.tables.library_entries.push({ id: `entry-pack-fen-${kind}-${data.id}`, pack_id: 'pack-fen', kind, pack_entry_id: data.id, name: data.name, data });
    return ids;
  }
  const tam = () => world.tables.actors.find((a) => a.name === 'Tam')!;
  const packOf = () => world.tables.inventory_lines.filter((l) => l.actor_id === tam().id).map((l) => String(l.name));
  // The leaning is kept in its own table (like the database's split_alignment trigger).
  const leaningOf = () => world.tables.character_alignments.find((a) => a.actor_id === tam().id)?.alignment;

  /** The heron picked, on to the Gear step: the stole lands; a spear the player bought goes in beside it. */
  async function heronToGear(user: User) {
    await pickClass(user);
    await screen.findByRole('heading', { name: 'Patron' });
    await pick(user, 'The Still Heron');
    await onToWho(user);
    await user.type(screen.getByLabelText('Name'), 'Tam');
    await next(user);
    await waitFor(() => expect(heading()).not.toBe('Who they are'));
    for (let n = 0; n < 6 && heading() !== 'Gear'; n++) await next(user);
    expect(heading()).toBe('Gear');
    await waitFor(() => expect((creationOf('Tam').patronGarb as { patron: string } | undefined)?.patron).toBe('ex-patron-heron'));
    const stole = world.tables.inventory_lines.find((l) => l.actor_id === tam().id && l.name === 'Reed-grey stole')!;
    world.tables.inventory_lines.push({ ...stole, id: 'line-bought-spear', name: 'Reed spear', source_entry_id: null, how_got: 'bought', equipped: false });
  }

  /** Change patron on the review, then the patron tapped on the Patron step. */
  async function changeFromReview(user: User, name: string) {
    await user.click(screen.getByRole('button', { name: 'Change patron' }));
    await screen.findByRole('heading', { name: 'Patron' });
    await pick(user, name);
  }

  // Purpose (his report): the heron's stole is in the pack; Change patron on the review to the Reed Mother takes the
  // stole out and puts her cloak in, leaves the spear the player bought, and the record names her garb; the leaning
  // follows her. Then a change back to the heron undone on the Patron step leaves the Reed Mother's garb as it is.
  it("Change patron on the review swaps the old patron's garb for the new one's, and Undo keeps it", async () => {
    withMother();
    const user = openApp();
    await heronToGear(user);
    await toReview(user);
    expect(packOf()).toContain('Reed-grey stole');
    expect(leaningOf()).toBe('Reed');
    await changeFromReview(user, 'The Reed Mother');
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    await waitFor(() => expect(packOf()).toContain('Rush cloak'));
    expect(packOf()).not.toContain('Reed-grey stole');
    expect(packOf()).toContain('Reed spear');
    expect(packOf().filter((n) => n === 'Rush cloak')).toHaveLength(1);
    expect((creationOf('Tam').patronGarb as { patron: string }).patron).toBe('ex-patron-reed-mother');
    expect(leaningOf()).toBe('Lantern');
    // Undo on the Patron step: the Reed Mother stays, and so does her garb.
    await changeFromReview(user, 'The Still Heron');
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Pick The Reed Mother' }).getAttribute('aria-checked')).toBe('true'));
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    expect(creationOf('Tam').patron).toEqual({ id: 'ex-patron-reed-mother', name: 'The Reed Mother' });
    expect(packOf().filter((n) => n === 'Rush cloak')).toHaveLength(1);
    expect(packOf()).not.toContain('Reed-grey stole');
    expect(packOf()).toContain('Reed spear');
  });

  // Purpose: the patron taken off on the review's Change (put off with Decide later) takes the old garb out with it;
  // the bought spear stays and the record keeps no garb.
  it('a patron taken off from the review takes its garb out', async () => {
    withMother();
    const user = openApp();
    await heronToGear(user);
    await toReview(user);
    await changeFromReview(user, 'The Still Heron');
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    await screen.findByRole('button', { name: 'Send to the GM' });
    await waitFor(() => expect(packOf()).not.toContain('Reed-grey stole'));
    expect(packOf()).toContain('Reed spear');
    expect(creationOf('Tam').patronGarb).toBeUndefined();
    expect(creationOf('Tam').patron).toBeUndefined();
  });

  // Purpose (the review of the fix, Important 1; gs-1): a patron put off with Decide later, the Gear step walked with
  // no garb (this setting gives no gear of its own), then the Reed Mother picked from the review's Change patron: her
  // cloak arrives in the pack at once, and the record names her garb.
  it('a patron first picked from the review, after Gear was walked with none, brings its garb', async () => {
    withMother();
    const user = openApp();
    await pickClass(user);
    await screen.findByRole('heading', { name: 'Patron' });
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    await onToWho(user);
    await user.type(screen.getByLabelText('Name'), 'Tam');
    await pick(user, 'Reed');
    await next(user);
    await toReview(user);
    expect(creationOf('Tam').patronGarb).toBeUndefined();
    await changeFromReview(user, 'The Reed Mother');
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    await waitFor(() => expect(packOf()).toContain('Rush cloak'));
    expect(packOf().filter((n) => n === 'Rush cloak')).toHaveLength(1);
    expect((creationOf('Tam').patronGarb as { patron: string }).patron).toBe('ex-patron-reed-mother');
  });

  // Purpose (the review of the fix, Important 2; gs-2, gs-5; hard rule 4): the player raised the stole's count to 3;
  // Change patron to the Reed Mother with her cloak's add failing (no connection). One error toast says the patron
  // line, then that the garb couldn't be swapped; the stole given (one) has left and the two the player added stay;
  // the record lists no garb given, since none of the heron's is left and none of hers arrived. Trying again (Change
  // patron, Next, connection back) brings her cloak once, and the player's two stoles are never taken; reopening Gear
  // afterwards gives nothing twice and takes nothing more.
  it("a failed garb swap says so with the patron's line, keeps the record true, and tries again without taking the player's own", async () => {
    withMother();
    const user = openApp();
    await heronToGear(user);
    const stole = () => world.tables.inventory_lines.find((l) => l.actor_id === tam().id && l.name === 'Reed-grey stole');
    stole()!.qty = 3;
    await toReview(user);
    const from = world.db.from.bind(world.db);
    const failing = { select: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) };
    const spy = vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as { insert: (v: Record<string, unknown>) => unknown };
      if (table !== 'inventory_lines') return query;
      const insert = query.insert.bind(query);
      query.insert = (v) => (v.name === 'Rush cloak' ? failing : insert(v));
      return query;
    }) as typeof world.db.from);
    await changeFromReview(user, 'The Reed Mother');
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    expect(await screen.findByText("Couldn't swap your patron's garb. Check your connection and try again. Patron: The Reed Mother. Your leaning is now Lantern, as their followers are, and your affiliation is The Reed Mother.")).toBeTruthy();
    expect(stole()?.qty).toBe(2);
    expect(packOf()).not.toContain('Rush cloak');
    expect(packOf()).toContain('Reed spear');
    expect(creationOf('Tam').patronGarb).toBeUndefined();
    expect(leaningOf()).toBe('Lantern');
    // Trying again: the connection back, Change patron and Next with her still picked.
    spy.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Change patron' }));
    await screen.findByRole('heading', { name: 'Patron' });
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    await waitFor(() => expect(packOf()).toContain('Rush cloak'));
    expect(packOf().filter((n) => n === 'Rush cloak')).toHaveLength(1);
    expect(stole()?.qty).toBe(2);
    expect((creationOf('Tam').patronGarb as { patron: string }).patron).toBe('ex-patron-reed-mother');
    // Gear reopened from the review: nothing given twice, nothing more taken.
    await user.click(screen.getByRole('button', { name: 'Change Gear' }));
    await screen.findByRole('heading', { name: 'Gear' });
    await user.click(screen.getAllByRole('button', { name: 'Back to review' })[0]!);
    await screen.findByRole('button', { name: 'Send to the GM' });
    expect(packOf().filter((n) => n === 'Rush cloak')).toHaveLength(1);
    expect(stole()?.qty).toBe(2);
    expect(packOf()).toContain('Reed spear');
  });

  // Purpose (#727 review, Important 1; hard rule 4): the player raised the stole's count to 3, then walked back from
  // Gear to the Patron step and picked the Reed Mother while her cloak's add fails. The swap takes the one given stole
  // out; walking on to Gear must not take a second one (Gear must start from the record the swap saved).
  it('after a walk back, a failed garb swap never has Gear take the old garb out twice', async () => {
    withMother();
    const user = openApp();
    await heronToGear(user);
    const stole = () => world.tables.inventory_lines.find((l) => l.actor_id === tam().id && l.name === 'Reed-grey stole');
    stole()!.qty = 3;
    for (let n = 0; n < 10 && heading() !== 'Patron'; n++) {
      const was = heading();
      await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
      await waitFor(() => expect(heading()).not.toBe(was));
    }
    expect(heading()).toBe('Patron');
    const from = world.db.from.bind(world.db);
    const failing = { select: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) };
    vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as { insert: (v: Record<string, unknown>) => unknown };
      if (table !== 'inventory_lines') return query;
      const insert = query.insert.bind(query);
      query.insert = (v) => (v.name === 'Rush cloak' ? failing : insert(v));
      return query;
    }) as typeof world.db.from);
    await pick(user, 'The Reed Mother');
    for (let n = 0; n < 4 && heading() !== 'Who they are'; n++) {
      const was = heading();
      await next(user);
      await waitFor(() => expect(heading()).not.toBe(was));
    }
    expect(heading()).toBe('Who they are');
    for (let n = 0; n < 8 && heading() !== 'Gear'; n++) {
      const was = heading();
      await next(user);
      await waitFor(() => expect(heading()).not.toBe(was));
    }
    expect(heading()).toBe('Gear');
    // Long enough for Gear's own swap to have landed, were there one.
    await new Promise((r) => setTimeout(r, 50));
    expect(stole()?.qty).toBe(2);
    expect(packOf()).toContain('Reed spear');
    expect(packOf()).not.toContain('Rush cloak');
  });

  // Purpose (#727 review, Important 3; the lead's ruling: the record is written before anything is taken out): the
  // player raised the stole's count to 3; the first change to the Reed Mother fails at the record's save. Whatever
  // that failure left, trying again (Change patron, Next) takes only the one stole that was given, never one of the
  // player's two, and brings her cloak once.
  it("a swap whose record save fails, then tried again, never takes one of the player's own", async () => {
    withMother();
    const user = openApp();
    await heronToGear(user);
    const stole = () => world.tables.inventory_lines.find((l) => l.actor_id === tam().id && l.name === 'Reed-grey stole');
    stole()!.qty = 3;
    await toReview(user);
    // The swap's own save of the record (an edit of the creation record alone) fails; the redo's write goes through.
    const from = world.db.from.bind(world.db);
    const failing = { eq: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) }) };
    const spy = vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as { update: (v: Record<string, unknown>) => unknown };
      if (table !== 'actors') return query;
      const update = query.update.bind(query);
      query.update = (v) => (Object.keys(v).length === 1 && 'creation' in v ? failing : update(v));
      return query;
    }) as typeof world.db.from);
    await user.click(screen.getByRole('button', { name: 'Change patron' }));
    await screen.findByRole('heading', { name: 'Patron' });
    await pick(user, 'The Reed Mother');
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    await screen.findByText(/Couldn't swap your patron's garb\./);
    spy.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Change patron' }));
    await screen.findByRole('heading', { name: 'Patron' });
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    await waitFor(() => expect(packOf()).toContain('Rush cloak'));
    expect(packOf().filter((n) => n === 'Rush cloak')).toHaveLength(1);
    expect(stole()?.qty).toBe(2);
    expect(packOf()).toContain('Reed spear');
  });

  // Purpose (#727 review, the retry's words): trying the garb again (Change patron, Next, the patron unchanged) never
  // says "Scores saved.", which nothing saved: failing again, the failure, then the patron's name (gs-5a's order);
  // working, it names the patron.
  it('trying the garb again names the patron, never "Scores saved."', async () => {
    withMother();
    const user = openApp();
    await heronToGear(user);
    await toReview(user);
    const from = world.db.from.bind(world.db);
    const failing = { select: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) };
    const spy = vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as { insert: (v: Record<string, unknown>) => unknown };
      if (table !== 'inventory_lines') return query;
      const insert = query.insert.bind(query);
      query.insert = (v) => (v.name === 'Rush cloak' ? failing : insert(v));
      return query;
    }) as typeof world.db.from);
    await user.click(screen.getByRole('button', { name: 'Change patron' }));
    await screen.findByRole('heading', { name: 'Patron' });
    await pick(user, 'The Reed Mother');
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    await screen.findByText(/Couldn't swap your patron's garb\./);
    // Again, still failing.
    await user.click(screen.getByRole('button', { name: 'Change patron' }));
    await screen.findByRole('heading', { name: 'Patron' });
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    expect(await screen.findByText("Couldn't swap your patron's garb. Check your connection and try again. Patron: The Reed Mother.")).toBeTruthy();
    expect(screen.queryByText(/Scores saved/)).toBeNull();
    // Again, working.
    spy.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Change patron' }));
    await screen.findByRole('heading', { name: 'Patron' });
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    expect(await screen.findByText('Patron: The Reed Mother.')).toBeTruthy();
    expect(screen.queryByText(/Scores saved/)).toBeNull();
    await waitFor(() => expect(packOf()).toContain('Rush cloak'));
  });

  // Purpose (the status file's second way to try again, #727 review nit): after a failed swap, opening Gear from the
  // review (Change Gear) with the connection back finishes it: her cloak arrives once, and the player's two raised
  // stoles stay.
  it('Change Gear after a failed swap brings the new garb, once, and takes nothing of the player\'s', async () => {
    withMother();
    const user = openApp();
    await heronToGear(user);
    const stole = () => world.tables.inventory_lines.find((l) => l.actor_id === tam().id && l.name === 'Reed-grey stole');
    stole()!.qty = 3;
    await toReview(user);
    const from = world.db.from.bind(world.db);
    const failing = { select: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) };
    const spy = vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as { insert: (v: Record<string, unknown>) => unknown };
      if (table !== 'inventory_lines') return query;
      const insert = query.insert.bind(query);
      query.insert = (v) => (v.name === 'Rush cloak' ? failing : insert(v));
      return query;
    }) as typeof world.db.from);
    await user.click(screen.getByRole('button', { name: 'Change patron' }));
    await screen.findByRole('heading', { name: 'Patron' });
    await pick(user, 'The Reed Mother');
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    await screen.findByText(/Couldn't swap your patron's garb\./);
    expect(packOf()).not.toContain('Rush cloak');
    spy.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Change Gear' }));
    await screen.findByRole('heading', { name: 'Gear' });
    await waitFor(() => expect(packOf()).toContain('Rush cloak'));
    expect(packOf().filter((n) => n === 'Rush cloak')).toHaveLength(1);
    expect(stole()?.qty).toBe(2);
    expect((creationOf('Tam').patronGarb as { patron: string }).patron).toBe('ex-patron-reed-mother');
  });

  // Purpose (the Gear step's own swap, record first like #727's; hard rule 4): the player raised the stole's count to
  // 3, and the review's swap to the Reed Mother failed, so the record still lists the heron's stole. Gear then opens
  // on the changed patron and the record's save fails once; opened again with the connection back, Gear takes only
  // the one stole that was given, never one of the player's two, and brings her cloak once.
  it("the Gear step's garb swap whose record save fails once never takes one of the player's own when Gear opens again", async () => {
    withMother();
    const user = openApp();
    await heronToGear(user);
    const stole = () => world.tables.inventory_lines.find((l) => l.actor_id === tam().id && l.name === 'Reed-grey stole');
    stole()!.qty = 3;
    await toReview(user);
    // An edit of the creation record alone fails: always while the patron changes, then once more on Gear.
    let failing: 'always' | 'once' | 'never' = 'always';
    const from = world.db.from.bind(world.db);
    const refused = { eq: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) }) };
    vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as { update: (v: Record<string, unknown>) => unknown };
      if (table !== 'actors') return query;
      const update = query.update.bind(query);
      query.update = (v) => {
        if (failing === 'never' || Object.keys(v).length !== 1 || !('creation' in v)) return update(v);
        if (failing === 'once') failing = 'never';
        return refused;
      };
      return query;
    }) as typeof world.db.from);
    await user.click(screen.getByRole('button', { name: 'Change patron' }));
    await screen.findByRole('heading', { name: 'Patron' });
    await pick(user, 'The Reed Mother');
    await next(user);
    await screen.findByRole('button', { name: 'Send to the GM' });
    await screen.findByText(/Couldn't swap your patron's garb\./);
    expect(stole()?.qty).toBe(3);
    expect((creationOf('Tam').patronGarb as { patron: string }).patron).toBe('ex-patron-heron');
    // Gear opens on the changed patron; its record save fails once.
    failing = 'once';
    await user.click(screen.getByRole('button', { name: 'Change Gear' }));
    await screen.findByRole('heading', { name: 'Gear' });
    await waitFor(() => expect(failing).toBe('never'));
    // Long enough for Gear's swap to have finished, whatever it did.
    await new Promise((r) => setTimeout(r, 50));
    expect(packOf()).not.toContain('Rush cloak');
    // Gear opened again, the connection back.
    await user.click(screen.getAllByRole('button', { name: 'Back to review' })[0]!);
    await screen.findByRole('button', { name: 'Send to the GM' });
    await user.click(screen.getByRole('button', { name: 'Change Gear' }));
    await screen.findByRole('heading', { name: 'Gear' });
    await waitFor(() => expect(packOf()).toContain('Rush cloak'));
    await waitFor(() => expect((creationOf('Tam').patronGarb as { patron: string }).patron).toBe('ex-patron-reed-mother'));
    expect(packOf().filter((n) => n === 'Rush cloak')).toHaveLength(1);
    expect(stole()?.qty).toBe(2);
    expect(packOf()).toContain('Reed spear');
  });

  // Purpose (fix-gear-record-first-2; hard rule 4): the player raised the Reed-grey stole to 3; the Still Heron was
  // taken off on the review and that garb swap failed, so the record still lists her stole. Gear then opens with no
  // patron and the connection back: it takes the one stole that was given out, once, and never a second one from the
  // line the player raised, however often it draws again.
  it('a patron taken off in Gear after a failed swap never takes a raised line twice', async () => {
    withMother();
    const user = openApp();
    await heronToGear(user);
    const stole = () => world.tables.inventory_lines.find((l) => l.actor_id === tam().id && l.name === 'Reed-grey stole');
    stole()!.qty = 3;
    await toReview(user);
    // An edit of the creation record alone fails while the patron is taken off, then goes through.
    let failing = true;
    const from = world.db.from.bind(world.db);
    const refused = { eq: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) }) };
    vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as { update: (v: Record<string, unknown>) => unknown };
      if (table !== 'actors') return query;
      const update = query.update.bind(query);
      query.update = (v) => (!failing || Object.keys(v).length !== 1 || !('creation' in v) ? update(v) : refused);
      return query;
    }) as typeof world.db.from);
    await changeFromReview(user, 'The Still Heron');
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    await screen.findByRole('button', { name: 'Send to the GM' });
    await waitFor(() => expect(creationOf('Tam').patron).toBeUndefined());
    expect(stole()?.qty).toBe(3);
    expect((creationOf('Tam').patronGarb as { patron: string }).patron).toBe('ex-patron-heron');
    // Gear opens with no patron, the connection back: the given stole comes out once.
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Change Gear' }));
    await screen.findByRole('heading', { name: 'Gear' });
    await waitFor(() => expect(creationOf('Tam').patronGarb).toBeUndefined());
    // Long enough for any second pass of the garb to have run, whatever it did.
    await new Promise((r) => setTimeout(r, 100));
    expect(stole()?.qty).toBe(2);
    expect(packOf()).toContain('Reed spear');
  });
});
