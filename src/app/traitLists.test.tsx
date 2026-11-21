// @vitest-environment jsdom
// Trait lists at creation (M5b-0b part B): the step in the guided flow, Decide later onto To finish, the saved pick,
// the To finish card on the sheet, and the sheet showing the entry's name. Invented content only (hard rule 2).
//   Purpose: a sheet field pointing at a trait list the setting has makes one step, titled after the list; Decide
//   later lands the list's id on To finish; a pick saves the entry's id in the field; the card opens the same step
//   and the sheet shows the entry's name, not its id; without the list in the setting there's no step and the field
//   is typed as text.
//   Help me choose (PR G of the second test; 07 traitLists[].help, ruled 2026-11-02): a list with its own help shows
//   it first, then the step's help; a list without shows the step's help (the pack's, else the app's) as before.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fenFixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { forgetFileLinks } from '../core/files.ts';
import { Root } from './App.tsx';
import { openFullSheetFromMenu } from '../testing/openFullSheet.ts';
import { figureSourceOf } from './CharacterSheet.tsx';

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

function traitWorld({ withList = true, require, listHelp, guideHelp }: { withList?: boolean; require?: string[]; listHelp?: string; guideHelp?: string } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', {
    abilities: [{ key: 'STR', short: 'Strength', name: 'Strength' }],
    abilityModifiers: { STR: [{ range: '3-8', melee: -1 }, { range: '9-18', melee: 0 }] },
    ...(require ? { creation: { require } } : {}),
    ...(guideHelp ? { creationGuide: { traits: { help: guideHelp } } } : {}),
  });
  entry('class', 'lantern-warden', 'Lantern Warden', { progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: {} }] });
  entry('fieldTemplate', 'fen-sheet', 'fen-sheet', { appliesTo: 'pc', fields: [{ key: 'STR', label: 'Strength', type: 'number' }, { key: 'background', label: 'Background', type: 'list', from: 'fen-backgrounds' }] });
  if (withList) {
    entry('traitList', 'fen-backgrounds', 'Fen backgrounds', {
      die: 'd6',
      notes: 'Where they come from.',
      ...(listHelp ? { help: listHelp } : {}),
      entries: [
        { id: 'eel-catcher', name: 'Eel catcher', min: 1, max: 3, blurb: 'Knows the channels.' },
        { id: 'reed-cutter', name: 'Reed cutter', min: 4, max: 6, blurb: 'Strong arms.' },
      ],
    });
  }
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.field_definitions.push({ id: 'field-STR', campaign_id: campaign, applies_to: 'pc', key: 'STR', label: 'Strength', type: 'number', choices: [], field_group: 'Abilities', sort_order: 0, show_on_card: false, hidden: false, fill: null, required: false, created_at: '2026-10-18T12:00:00Z' });
  world.tables.field_definitions.push({ id: 'field-background', campaign_id: campaign, applies_to: 'pc', key: 'background', label: 'Background', type: 'list', choices: [], field_group: 'Identity', sort_order: 1, show_on_card: true, hidden: false, fill: null, required: false, from_list: 'fen-backgrounds', created_at: '2026-10-18T12:00:00Z' });
  world.signInAs(me);
  return { gm, me, campaign };
}

type User = ReturnType<typeof userEvent.setup>;

async function toWho(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(await screen.findByRole('checkbox', { name: 'Pick Lantern Warden' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('heading', { name: 'Who they are' });
}

async function toTraitStep(user: User) {
  await toWho(user);
  // The background has its own step: it isn't asked on "Who are they?".
  expect(screen.queryByLabelText('Background')).toBeNull();
  await user.type(screen.getByLabelText('Name'), 'Reed');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('heading', { name: 'Fen backgrounds' });
}

const reedRecord = () => world.tables.actors.find((a) => a.name === 'Reed')!;

describe('the trait-list step in creation', () => {
  // Help me choose explains only this step's list (the third test, ct3-8): the step's help speaks of every list.
  it('Help me choose shows only the list\'s own help when it has one', async () => {
    traitWorld({ listHelp: 'Fen folk name their trade before their name.', guideHelp: 'Pick what gives you a story.' });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toTraitStep(user);
    await user.click(screen.getByRole('button', { name: 'Help me choose' }));
    const texts = [...document.querySelectorAll('.help-choose__text')].map((p) => p.textContent);
    expect(texts).toEqual(['Fen folk name their trade before their name.']);
  });

  // Purpose (retest 4 T5): help is keyed by the step and its list. A list without its own help gets the app's
  // trait-list help naming the list, never the step's `creationGuide.traits.help`, which spoke of another list.
  it('a list without its own help gets the app\'s trait-list help naming it, not the step\'s guide help', async () => {
    traitWorld({ guideHelp: 'A trade from before adventuring: farmer, smith, sailor.' });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toTraitStep(user);
    await user.click(screen.getByRole('button', { name: 'Help me choose' }));
    const texts = [...document.querySelectorAll('.help-choose__text')].map((p) => p.textContent);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toMatch(/^Fen backgrounds: roll 1d6 at the table/);
    expect(texts[0]).not.toContain('farmer, smith, sailor');
  });

  it('is titled after the list, shows its notes and the roll line, and a pick saves the entry\'s id', async () => {
    traitWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toTraitStep(user);
    // On the creation step shell (m5b-0c slice 6): roll, then tap — or pick, in the step's Roll row (S1).
    expect(screen.getByText('Where they come from.')).toBeTruthy();
    expect(screen.getByText('Roll 1d6 at the table, then tap the row, or pick one.').closest('.roll-row')).not.toBeNull();
    await user.click(screen.getByRole('checkbox', { name: /^Pick 4–6: Reed cutter/ }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect((reedRecord().fields as { background?: string }).background).toBe('reed-cutter'));
    expect((reedRecord().creation as { toFinish?: string[] }).toFinish ?? []).toEqual([]);
  });

  it('Decide later lands the list\'s id on To finish, and the review says so by the list\'s name', async () => {
    traitWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toTraitStep(user);
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    // The review's To finish box (cr-18), by the list's name.
    expect((await screen.findAllByRole('button', { name: 'Fen backgrounds, Do it now' })).length).toBe(1);
    expect((reedRecord().creation as { toFinish: string[] }).toFinish).toEqual(['fen-backgrounds']);
  });

  it('when the pack requires traits there is no Decide later', async () => {
    traitWorld({ require: ['traits'] });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toTraitStep(user);
    expect(screen.queryByRole('button', { name: 'Decide later' })).toBeNull();
  });

  it('without the list in the setting there is no step: the field is typed on "Who are they?" as text', async () => {
    traitWorld({ withList: false });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user);
    const background = screen.getByLabelText('Background');
    expect(background.tagName).toBe('INPUT');
    await user.type(screen.getByLabelText('Name'), 'Reed');
    await user.type(background, 'Eel catcher');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.queryByLabelText('Name')).toBeNull());
    expect(screen.queryByRole('heading', { name: 'Fen backgrounds' })).toBeNull();
    expect((reedRecord().fields as { background?: string }).background).toBe('Eel catcher');
  });
});

describe('trait lists on the sheet', () => {
  async function openSheet(user: User) {
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Open Reed' }));
    await openFullSheetFromMenu(user);
  }

  it('the To finish card opens the list; the pick takes the line off and the sheet shows the entry\'s name', async () => {
    const { me, campaign } = traitWorld();
    const id = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === id)!, { classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }], creation: { toFinish: ['fen-backgrounds'] } });
    const user = userEvent.setup();
    await openSheet(user);
    const card = await screen.findByRole('region', { name: 'To finish' });
    await user.click(within(card).getByRole('button', { name: /Fen backgrounds/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Fen backgrounds' }));
    await user.click(dialog.getByRole('checkbox', { name: /Eel catcher/ }));
    await user.click(dialog.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'To finish' })).toBeNull());
    expect((reedRecord().fields as { background: string }).background).toBe('eel-catcher');
    expect((reedRecord().creation as { toFinish?: string[] }).toFinish ?? []).toEqual([]);
    // The sheet shows the name, never the id.
    expect(await screen.findByText('Eel catcher')).toBeTruthy();
    expect(screen.queryByText('eel-catcher')).toBeNull();
  });

  it('editing the sheet offers the list\'s entries, and the owner\'s change is saved', async () => {
    const { me, campaign } = traitWorld();
    const id = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === id)!, { classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }], fields: { background: 'eel-catcher' }, backstory: '', notes: '' });
    const user = userEvent.setup();
    await openSheet(user);
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    // Plan m5b-sheet-revised B5/B6: a field is a Details row in Edit; its tap opens a sheet with the field, and Save
    // there saves at once.
    const edit = within(await screen.findByRole('form', { name: 'Edit Reed' }));
    await user.click(edit.getByRole('button', { name: /^Background:/ }));
    const select = within(await screen.findByRole('dialog', { name: 'Background' })).getByLabelText('Background') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Choose…', '1–3: Eel catcher', '4–6: Reed cutter']);
    await user.selectOptions(select, 'reed-cutter');
    await user.click(within(screen.getByRole('dialog', { name: 'Background' })).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect((reedRecord().fields as { background: string }).background).toBe('reed-cutter'));
  });
});

// Look-back review of #663 (Important 1): Decide later from the To finish card on a list rolled twice.
describe('Decide later from To finish keeps the spell rolled (fix of #663)', () => {
  const rolled = { entryId: 'reed-apprentice', spellId: 'song-hush', roll: 2 };

  /** Reed with one of two picked (the reed apprentice, its spell rolled: Hush), the list on To finish; the card open. */
  async function openCard(user: User) {
    const { me, campaign } = traitWorld({ withList: false });
    const spell = (id: string, name: string) => ({ id: `entry-${id}`, pack_id: 'pack-fen', kind: 'spell', pack_entry_id: id, name, data: { id, name, lists: { 'reed-songs': 0 }, range: 'Touch' } });
    world.tables.library_entries.push(
      {
        id: 'entry-fen-backgrounds',
        pack_id: 'pack-fen',
        kind: 'traitList',
        pack_entry_id: 'fen-backgrounds',
        name: 'Fen backgrounds',
        data: {
          id: 'fen-backgrounds',
          name: 'Fen backgrounds',
          die: 'd6',
          rolls: 2,
          entries: [
            { id: 'reed-apprentice', name: 'Reed apprentice', min: 1, max: 3, blurb: 'Learnt a little song.', spells: { roll: { listId: 'reed-songs', level: 0 } } },
            { id: 'eel-catcher', name: 'Eel catcher', min: 4, max: 6, blurb: 'Knows the channels.', items: [{ name: 'Eel knife' }] },
          ],
        },
      },
      spell('song-glow', 'Marsh glow'),
      spell('song-hush', 'Hush'),
    );
    const id = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === id)!, {
      classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }],
      fields: { background: 'reed-apprentice' },
      creation: { toFinish: ['fen-backgrounds'], traitSpells: { 'fen-backgrounds': rolled } },
    });
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Open Reed' }));
    await openFullSheetFromMenu(user);
    const card = await screen.findByRole('region', { name: 'To finish' });
    await user.click(within(card).getByRole('button', { name: /Fen backgrounds/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Fen backgrounds' }));
    expect(dialog.getByRole('checkbox', { name: 'Pick 2: Hush' }).getAttribute('aria-checked')).toBe('true');
    return dialog;
  }

  // Purpose: with one of two picked and its spell rolled and saved, Decide later again from the To finish card leaves
  // the spell on the creation record and writes nothing (nothing changed).
  it('keeps the saved spell and writes nothing when nothing changed', async () => {
    const user = userEvent.setup();
    const dialog = await openCard(user);
    const eventsBefore = world.tables.events.length;
    await user.click(dialog.getByRole('button', { name: 'Decide later' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Fen backgrounds' })).toBeNull());
    expect((reedRecord().creation as { traitSpells?: unknown }).traitSpells).toEqual({ 'fen-backgrounds': rolled });
    expect(world.tables.events.length).toBe(eventsBefore);
  });

  // Purpose (#668's review, nit 1): a real change on the To finish card is saved by Decide later: a second pick and
  // another spell rolled are kept on the field and the creation record, the step stays on To finish, and the gear
  // the new pick grants comes with a toast offering Undo.
  it('saves a changed pick and spell on Decide later, with the gear toast and its Undo', async () => {
    const user = userEvent.setup();
    const dialog = await openCard(user);
    await user.click(dialog.getByRole('checkbox', { name: 'Pick 1: Marsh glow' }));
    await user.click(dialog.getByRole('checkbox', { name: /^Pick 4–6: Eel catcher/ }));
    await user.click(dialog.getByRole('button', { name: 'Decide later' }));
    await waitFor(() => expect((reedRecord().fields as { background?: string }).background).toBe('reed-apprentice; eel-catcher'));
    await waitFor(() => expect((reedRecord().creation as { traitSpells?: unknown }).traitSpells).toEqual({ 'fen-backgrounds': { entryId: 'reed-apprentice', spellId: 'song-glow', roll: 1 } }));
    expect((reedRecord().creation as { toFinish?: string[] }).toFinish).toContain('fen-backgrounds');
    const toast = (await screen.findAllByText('Eel knife added to your pack.'))[0]!.closest('.toast')!;
    expect(within(toast as HTMLElement).getByRole('button', { name: 'Undo' })).toBeTruthy();
  });
});

// A save's modifier and the figures' source line (plan test-feedback-2026-11-19 row A7; 09, 2026-11-08: no "<score> vs
// magic" on the sheet; plan dec-player-figure-sheet piece 1: every figure's sheet ends with its source). On the
// invented fixture pack, whose rules set gives "Spell ward" (the LORE modifier plus the kindred's bonus), with no sheet
// field that claims it, so nothing but the Abilities list could show it.
//   Purpose: a save-modifier fill is not a row of Abilities, on the Player tab or the full sheet.
//   Purpose: every figure's sheet the character sheet opens ends with its source line: on the Player tab (level,
//   movement) and on the full sheet (title, armour class, attack, level, movement, experience bonus). The Player tab's
//   own Armour class and Attack sheets (PlayerVitals.tsx) gained theirs with row H2, tested below.
describe("a save's modifier, and a figure's source line", () => {
  const fenPack = JSON.parse(fenFixture) as Record<string, Record<string, unknown>[]>;
  const SOURCE = 'From your setting: Fen sample';

  /**
   * The fixture on a campaign; Wren, an approved stone-kin Lantern Warden with LORE 13 (Spell ward 3), for Sam. With
   * `split`, the classes come from a second pack, "Fen callings", so the class and the rules set name two packs (H2).
   */
  function wardWorld({ split = false }: { split?: boolean } = {}) {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
    if (split) world.tables.packs.push({ id: 'pack-callings', owner_user_id: gm, campaign_id: null, name: 'Fen callings', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen callings' } });
    const entry = (kind: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: split && kind === 'class' ? 'pack-callings' : 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
    const lists: [string, string][] = [['rulesSets', 'rulesSet'], ['races', 'race'], ['classes', 'class'], ['hooks', 'hook'], ['items', 'item'], ['traitLists', 'traitList'], ['fieldTemplates', 'fieldTemplate']];
    for (const [list, kind] of lists) for (const data of fenPack[list] ?? []) entry(kind, data);
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
    if (split) world.tables.campaign_packs.push({ id: 'link-callings', campaign_id: campaign, pack_id: 'pack-callings', pack_name: 'Fen callings', option_choices: {}, overrides: {}, priority: 2 });
    // The fixture's sheet layout without its "Spell ward" field, as a pack whose layout gives the modifier no field.
    const layout = (fenPack.fieldTemplates![0]!.fields as { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; from?: string }[]).filter(
      (f) => f.key !== 'omen' && f.key !== 'hp' && f.key !== 'spellWard' && !f.from,
    );
    layout.forEach((f, order) =>
      world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type: f.type === 'list' && !f.choices?.length ? 'text' : f.type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: false, from_list: null, created_at: '2026-10-18T12:00:00Z' }),
    );
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam, approval: 'approved' });
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, {
      level: 1,
      hp_current: 6,
      hp_max: 9,
      race_ref: 'stone-kin',
      fields: { MUS: 13, NIM: 12, GRT: 11, WIT: 14, LORE: 13, CHARM: 10 },
      classes: [{ classRef: 'lantern-warden', level: 1, xp: 120 }],
    });
    world.addMember(campaign, sam, 'player', wren);
    world.signInAs(sam);
  }

  it('is not a row of Abilities, on the Player tab or the full sheet', async () => {
    wardWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await screen.findByRole('region', { name: 'Vitals' });
    expect(screen.queryByText(/Spell ward/)).toBeNull();
    await openFullSheetFromMenu(user);
    await screen.findByRole('region', { name: 'Level' });
    expect(screen.queryByText(/Spell ward/)).toBeNull();
    // The Abilities list keeps its other rows (the experience bonus), so it is the modifier alone that left.
    expect(screen.getByRole('button', { name: /^Experience bonus / })).toBeTruthy();
  });

  /** Taps the figure, reads its sheet's last line, and closes the sheet. */
  async function lastLineOf(user: ReturnType<typeof userEvent.setup>, figure: RegExp) {
    await user.click(screen.getByRole('button', { name: figure }));
    const dialog = (await screen.findAllByRole('dialog')).at(-1)!;
    const last = dialog.querySelector('.breakdown-sheet')?.lastElementChild?.textContent ?? '';
    await user.click(within(dialog).getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    return last;
  }

  it("ends every figure's sheet the character sheet opens with its source line", async () => {
    wardWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await screen.findByRole('region', { name: 'Vitals' });
    // The Player tab's figures that open a figure's sheet: the level, and the movement (a mode of the rules set's).
    expect(await lastLineOf(user, /^Lantern Warden, level 1, 120 experience: how it's worked out/)).toBe(SOURCE);
    expect(await lastLineOf(user, /^Movement 30.*: how it's worked out/)).toBe(SOURCE);
    // The full sheet's own: the title, armour class, attack, level, movement and the experience bonus.
    await openFullSheetFromMenu(user);
    await screen.findByRole('region', { name: 'Level' });
    for (const figure of [/^Title Lamplighter: /, /^Armour class 11: /, /^Attack 19: /, /^Level 1: /, /^Movement 30.*: how/, /^Experience bonus \+5%: /])
      expect(await lastLineOf(user, figure)).toBe(SOURCE);
  });

  // H2 ("Class's pack", Francis, 2026-11-19; plan test-feedback-2026-11-19 section H).
  //   Purpose: in a campaign whose class and rules set come from two packs, the Attack sheet's source line names the
  //   class's pack, on the full sheet and on the Player tab; a figure the rules set alone gives (a movement mode, a
  //   save's modifier) still names the rules set's pack; the Player tab's Armour class sheet ends with its source line,
  //   the same pack as the full sheet's.
  it("names the class's pack under Attack when the class and the rules set come from two packs (H2)", async () => {
    wardWorld({ split: true });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    const vitals = within(await screen.findByRole('region', { name: 'Vitals' }));
    // The Player tab's own sheets (PlayerVitals): Attack names the class's pack; Armour class ends with its source line.
    await user.click(vitals.getByRole('button', { name: /^Attack \+?19: / }));
    const attackSheet = (await screen.findAllByRole('dialog')).at(-1)!;
    expect(attackSheet.querySelector('.breakdown-sheet')?.lastElementChild?.textContent).toBe('From your setting: Fen callings');
    await user.click(within(attackSheet).getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const playerAc = await lastLineOf(user, /^Armour class 11: /);
    // No rules set names "ac", so A7's rule gives the class's pack, as on the full sheet (see the pull request's ⚑ 32).
    expect(playerAc).toBe('From your setting: Fen callings');
    // A movement mode is the rules set's alone.
    expect(await lastLineOf(user, /^Movement 30.*: how it's worked out/)).toBe(SOURCE);
    await openFullSheetFromMenu(user);
    await screen.findByRole('region', { name: 'Level' });
    expect(await lastLineOf(user, /^Attack 19: /)).toBe('From your setting: Fen callings');
    expect(await lastLineOf(user, /^Armour class 11: /)).toBe(playerAc);
    expect(await lastLineOf(user, /^Movement 30.*: how/)).toBe(SOURCE);
  });

  it("a save's modifier names the rules set's pack; Attack the class's (H2's rule, figureSourceOf)", () => {
    // Purpose: the one rule both screens use, on a save's modifier, which no sheet shows as a figure since A7.
    const setting = {
      packs: [
        { packId: 'pack-fen', shortName: 'Fen sample' },
        { packId: 'pack-callings', shortName: 'Fen callings' },
      ],
      all: [
        { kind: 'rulesSet', packId: 'pack-fen', packEntryId: 'fen-rules', data: { attack: { unarmouredAC: 10 }, saveModifiers: [], movement: { default: 30 } } },
        { kind: 'class', packId: 'pack-callings', packEntryId: 'lantern-warden', data: {} },
      ],
    } as unknown as Parameters<typeof figureSourceOf>[0];
    expect(figureSourceOf(setting, 'saveModifiers.spell-ward', 'lantern-warden')).toBe('Fen sample');
    expect(figureSourceOf(setting, 'movement.walk', 'lantern-warden')).toBe('Fen sample');
    expect(figureSourceOf(setting, 'attack', 'lantern-warden')).toBe('Fen callings');
    // Without a class, Attack falls back to the rules set's pack; without a setting, no line.
    expect(figureSourceOf(setting, 'attack', null)).toBe('Fen sample');
    expect(figureSourceOf(null, 'attack', 'lantern-warden')).toBeNull();
  });
});

// A later ability's words in the lists (plan test-feedback-2026-11-19 row B6; tfw-5, 2026-11-19, replacing sr-3's
// "from level 3"). On the invented fixture pack, with one class ability and one kindred trait that start at level 3,
// for a level-1 character.
//   Purpose: a later ability's row reads "at level 3" in the Abilities and Traits lists, and its spoken name (the
//   chip's, creation's words) is unchanged.
describe('a later ability in the Abilities and Traits lists', () => {
  const fenPack = JSON.parse(fenFixture) as Record<string, Record<string, unknown>[]>;
  const later = (owner: Record<string, unknown>, name: string) => ({
    ...owner,
    abilities: [...((owner.abilities as unknown[] | undefined) ?? []), { name, note: 'Comes with time.', fromLevel: 3 }],
  });

  /** Wren, an approved level-1 stone-kin Lantern Warden, for Sam; "Far sight" (class) and "Deep roots" (kindred) start at level 3. */
  function laterWorld() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    const entry = (kind: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
    for (const data of fenPack.rulesSets ?? []) entry('rulesSet', data);
    for (const data of fenPack.races ?? []) entry('race', data.id === 'stone-kin' ? later(data, 'Deep roots') : data);
    for (const data of fenPack.classes ?? []) entry('class', data.id === 'lantern-warden' ? later(data, 'Far sight') : data);
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam, approval: 'approved' });
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, {
      level: 1,
      race_ref: 'stone-kin',
      classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }],
    });
    world.addMember(campaign, sam, 'player', wren);
    world.signInAs(sam);
  }

  it('reads "at level 3" on the row, and the row is still heard "from level 3"', async () => {
    laterWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await openFullSheetFromMenu(user);
    for (const [list, name] of [['Abilities', 'Far sight'], ['Traits', 'Deep roots']] as const) {
      const section = within(await screen.findByRole('region', { name: list }));
      const row = section.getByRole('button', { name: `${name}, from level 3` });
      expect(row.textContent).toContain('at level 3');
      expect(row.textContent).not.toContain('from level');
    }
  });
});
