// @vitest-environment jsdom
// Weapon skills (M5b-0b part A): the creation step, Decide later, the To finish card and the sheet's row.
// Invented content only (hard rule 2).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { forgetFileLinks } from '../core/files.ts';
import { Root } from './App.tsx';
import { weaponSkillsWhy } from './WeaponSkillsStep.tsx';
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

interface Options {
  start?: number;
  gainEvery?: number;
  /** Which optional rules are on (the campaign's choices). */
  specialise?: boolean;
  restricted?: boolean;
  /** The weapon proficiency option itself. */
  skillsOn?: boolean;
  /** The class's category; null: the class names none. */
  category?: string | null;
  require?: string[];
  /** The sheet layout's weaponProficiencies text field, held by the campaign under its lower-case key ("Use this sheet layout"). */
  proficiencyField?: boolean;
  /** A weapon gated on an option that's off (optionOff). */
  offWeapon?: boolean;
}

function weaponWorld({ start = 2, gainEvery = 3, specialise = false, restricted = false, skillsOn = true, category = 'martial', require, proficiencyField = false, offWeapon = false }: Options = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  const choices = [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }];
  entry('option', 'weapon-skills', 'Weapon skills', { default: skillsOn ? 'on' : 'off', changeLater: 'allow', choices });
  entry('option', 'specialise', 'Specialising', { default: specialise ? 'on' : 'off', changeLater: 'allow', choices });
  entry('option', 'restricted', 'Other weapons', { default: restricted ? 'on' : 'off', changeLater: 'allow', choices });
  entry('rulesSet', 'fen-rules', 'Fen rules', {
    abilities: [{ key: 'STR', short: 'Strength', name: 'Strength' }],
    abilityModifiers: { STR: [{ range: '3-8', melee: -1 }, { range: '9-18', melee: 0 }] },
    itemCategories: [{ id: 'polearms', name: 'Polearms', order: 1 }, { id: 'blades', name: 'Blades', order: 2 }, { id: 'missiles', name: 'Missiles', order: 3 }],
    weaponProficiency: {
      option: 'weapon-skills',
      byCategory: { martial: { start, gainEvery, penalty: -2 } },
      specialisation: { option: 'specialise', categories: ['martial'], cost: 2, bonus: { attack: 1, damage: 1 } },
      restrictedWeapons: { option: 'restricted', note: 'Any other weapon is used at -2 to hit.' },
    },
    ...(require ? { creation: { require } } : {}),
  });
  entry('class', 'lantern-warden', 'Lantern Warden', {
    progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: {} }],
    weaponsAllowed: { mode: 'tags', allowTags: ['Melee'] },
    ...(category ? { weaponProficiencyCategory: category } : {}),
  });
  entry('fieldTemplate', 'fen-sheet', 'fen-sheet', {
    appliesTo: 'pc',
    fields: [{ key: 'STR', label: 'Strength', type: 'number' }, ...(proficiencyField ? [{ key: 'weaponProficiencies', label: 'Weapon proficiencies', type: 'text', option: 'weapon-skills' }] : [])],
  });
  if (offWeapon) {
    entry('option', 'thunder-arms', 'Thunder arms', { default: 'off', changeLater: 'allow', choices });
    entry('item', 'thunder-tube', 'Thunder tube', { category: 'polearms', weapon: { damage: 'd8' }, weaponTags: ['Melee'], hands: 2, option: 'thunder-arms' });
  }
  entry('item', 'reed-spear', 'Reed spear', { category: 'polearms', weapon: { damage: 'd6' }, weaponTags: ['Melee'], hands: 2 });
  entry('item', 'eel-knife', 'Eel knife', { category: 'blades', weapon: { damage: 'd4' }, weaponTags: ['Melee'], hands: 1 });
  entry('item', 'marsh-club', 'Marsh club', { category: 'blades', weapon: { damage: 'd4' }, weaponTags: ['Melee'], hands: 1 });
  entry('item', 'bog-sling', 'Bog sling', { category: 'missiles', weapon: { damage: 'd4' }, weaponTags: ['Missile'] });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.field_definitions.push({ id: 'field-STR', campaign_id: campaign, applies_to: 'pc', key: 'STR', label: 'Strength', type: 'number', choices: [], field_group: 'Abilities', sort_order: 0, show_on_card: false, hidden: false, fill: null, required: false, created_at: '2026-10-18T12:00:00Z' });
  if (proficiencyField)
    world.tables.field_definitions.push({ id: 'field-wp', campaign_id: campaign, applies_to: 'pc', key: 'weaponproficiencies', label: 'Weapon proficiencies', type: 'text', choices: [], field_group: 'Combat', sort_order: 1, show_on_card: false, hidden: false, fill: null, required: false, created_at: '2026-10-18T12:00:00Z' });
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

async function toWeaponStep(user: User) {
  await toWho(user);
  await user.type(screen.getByLabelText('Name'), 'Reed');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('heading', { name: 'Weapon skills' });
}

// The ✓ slot of a weapon's pick row (on the creation step shell, m5b-0c slice 6).
const row = (name: string) => screen.getByRole('checkbox', { name: `Pick ${name}` });
const hint = () => screen.getByRole('status', { name: 'Step status' }).textContent ?? '';
const reedRecord = () => world.tables.actors.find((a) => a.name === 'Reed')!;

describe('the weapon skills step in creation', () => {
  // Hotfix 2026-11-06: the layout's Weapon proficiencies field showed again on Who they are while its step was in play.
  it('while the weapon skills step is in play, Who they are does not ask the Weapon proficiencies field again', async () => {
    weaponWorld({ proficiencyField: true });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user);
    expect(screen.queryByRole('textbox', { name: 'Weapon proficiencies' })).toBeNull();
    await user.type(screen.getByLabelText('Name'), 'Reed');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('heading', { name: 'Weapon skills' })).toBeTruthy();
  });

  // Hotfix 2026-11-06: the step offered weapons an option switches off.
  it('a weapon gated on an option that is off is not offered on the step', async () => {
    weaponWorld({ offWeapon: true });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWeaponStep(user);
    expect(row('Reed spear')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Pick Thunder tube' })).toBeNull();
    expect(screen.queryByText('Thunder tube')).toBeNull();
  });

  // Purpose (R3-10): a weapon's row opens its full entry: damage and use, cost and weight as the item sheet's kv lines,
  // the source, and Pick at the foot.
  it('a weapon’s row opens its full entry with Pick at the foot', async () => {
    weaponWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWeaponStep(user);
    // An ⓘ at every row's start marks that it opens its entry, as on every pick step (cs-3; the shop alone has none, cs-37).
    const names = [...document.querySelectorAll('.pick-row__body')].filter((b) => !b.hasAttribute('aria-hidden'));
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((b) => !b.querySelector('.pick-row__name .icon')).map((b) => b.textContent)).toEqual([]);
    await user.click(screen.getByRole('button', { name: /^Reed spear/ }));
    const entry = await screen.findByRole('dialog', { name: 'Reed spear' });
    expect(within(entry).getByText('Damage and use')).toBeTruthy();
    expect(within(entry).getByText('d6, melee, two-handed')).toBeTruthy();
    expect(entry.querySelector('.rules-browser__lines--kv')).not.toBeNull();
    await user.click(within(entry).getByRole('button', { name: 'Pick Reed spear' }));
    expect(row('Reed spear').getAttribute('aria-checked')).toBe('true');
  });

  it('a class with no category, or the option off, has no weapon skills step', async () => {
    for (const opts of [{ category: null }, { skillsOn: false }] as Options[]) {
      world = createFakeDb();
      forgetCampaignSetting();
      weaponWorld(opts);
      const user = userEvent.setup();
      const { unmount } = render(<Root db={world.db} />);
      await toWho(user);
      await user.type(screen.getByLabelText('Name'), 'Reed');
      await user.click(screen.getByRole('button', { name: 'Next' }));
      // Straight to the review: the character is made and nothing asks about weapons.
      await waitFor(() => expect(screen.queryByLabelText('Name')).toBeNull());
      expect(screen.queryByRole('heading', { name: 'Weapon skills' })).toBeNull();
      expect(reedRecord()).toBeTruthy();
      unmount();
      cleanup();
    }
  });

  it('the count stops picks at the start: the next pick toasts and is not added', async () => {
    weaponWorld({ start: 2 });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWeaponStep(user);
    expect(hint()).toBe('0 of 2 picked');
    await user.click(row('Reed spear'));
    await user.click(row('Eel knife'));
    expect(hint()).toBe('2 of 2 picked');
    await user.click(row('Marsh club'));
    expect(await screen.findByText('2 of 2 picked: take one off to pick another.')).toBeTruthy();
    expect(row('Marsh club').getAttribute('aria-checked')).not.toBe('true');
    expect(hint()).toBe('2 of 2 picked');
  });

  it('a second Pick specialises (Specialised ✓✓, the cost in picks); a third gives the picks back (ct-8)', async () => {
    weaponWorld({ start: 3, specialise: true });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWeaponStep(user);
    await user.click(row('Reed spear'));
    expect(hint()).toBe('1 of 3 picked');
    expect(row('Reed spear').textContent).toBe('Picked ✓');
    await user.click(row('Reed spear'));
    expect(row('Reed spear').textContent).toBe('Specialised ✓✓');
    expect(hint()).toBe('2 of 3 picked, Reed spear spends 2');
    await user.click(row('Reed spear'));
    expect(row('Reed spear').textContent).toBe('Pick');
    expect(hint()).toBe('0 of 3 picked');
  });

  it('the line over the list reads "Pick N" (the count is in the footer only, final drafts D), and names specialisation only when it is on (ct-8)', async () => {
    weaponWorld({ start: 2, specialise: false });
    const user = userEvent.setup();
    const { unmount } = render(<Root db={world.db} />);
    await toWeaponStep(user);
    const line = () => screen.getByRole('heading', { name: /^Pick 2/ }).textContent;
    expect(line()).toBe('Pick 2');
    await user.click(row('Reed spear'));
    expect(line()).toBe('Pick 2');
    // Without specialisation a second Pick unpicks.
    await user.click(row('Reed spear'));
    expect(row('Reed spear').textContent).toBe('Pick');
    unmount();
    cleanup();
    world = createFakeDb();
    forgetCampaignSetting();
    weaponWorld({ start: 2, specialise: true });
    render(<Root db={world.db} />);
    await toWeaponStep(user);
    expect(line()).toBe('Pick 2, Specialisation is on: pick one again to specialise');
    // The rule is in the why-line (the app's words when the pack has no note).
    expect(screen.getByText(/Picking a weapon twice specialises it: it spends 2 picks for \+1 to hit, \+1 damage\./)).toBeTruthy();
  });

  it('the pack’s own specialisation rule reads after "Specialisation is on: ", once (after-test A2)', () => {
    const p = { note: '', start: 2, gainEvery: null, penalty: 0, restricted: null, specialisation: { cost: 2, attack: 1, damage: 1, note: 'Pick one weapon twice to master it.' } };
    expect(weaponSkillsWhy('Pick the weapons you trained with.', p)).toBe('Pick the weapons you trained with. Specialisation is on: Pick one weapon twice to master it.');
    // A why-line that already says the rule doesn't say it twice.
    expect(weaponSkillsWhy('Pick 2. Pick one weapon twice to master it.', p)).toBe('Pick 2. Pick one weapon twice to master it.');
  });

  it('a second Pick the picks left can’t pay for unpicks and says why (ct-8)', async () => {
    weaponWorld({ start: 2, specialise: true });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWeaponStep(user);
    await user.click(row('Reed spear'));
    await user.click(row('Eel knife'));
    await user.click(row('Reed spear'));
    expect(await screen.findByText('Reed spear unpicked. Specialising spends 2 of your 2 picks, so unpick another first.')).toBeTruthy();
    expect(hint()).toBe('1 of 2 picked');
  });

  it('Other… adds a typed weapon as one pick and saves it as typed (ct-8)', async () => {
    weaponWorld({ start: 2 });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWeaponStep(user);
    await user.click(row('Reed spear'));
    await user.click(screen.getByRole('button', { name: /Other…/ }));
    await user.type(screen.getByLabelText("A weapon the list doesn't have"), 'Eel hook');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(row('Eel hook').getAttribute('aria-checked')).toBe('true');
    expect(hint()).toBe('2 of 2 picked');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(reedRecord().weapon_skills).toEqual([{ itemId: 'reed-spear' }, { itemId: 'Eel hook', other: true }]));
  });

  // Purpose (R3-5, the closed class's path): a weapon not the class's sits in its collapsed fold, the pack's rule as the
  // fold's line; it can be picked, carries the sign and "Needs the GM's special approval", counts as a pick, and is
  // flagged on the record for the GM with the pack's rule as the why; the review names it.
  it('a non-class weapon is folded, can be picked with the sign, and is flagged for the GM with the pack’s rule', async () => {
    weaponWorld({ restricted: true });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWeaponStep(user);
    const fold = screen.getByText("Not your class's weapons: 1").closest('details')!;
    expect(fold.open).toBe(false);
    expect(within(fold).getByText('Any other weapon is used at -2 to hit.')).toBeTruthy();
    expect(within(fold).getByText("Needs the GM's special approval").closest('.fit-line, .pick-row')?.querySelector('svg, .warning-line, [class*="warn"]')).toBeTruthy();
    await user.click(screen.getByText("Not your class's weapons: 1"));
    await user.click(row('Bog sling'));
    await user.click(row('Reed spear'));
    expect(hint()).toContain('2 of 2 picked');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect((reedRecord().creation as { specialApprovals?: unknown[] }).specialApprovals).toEqual([{ step: 'weaponSkills', entryId: 'bog-sling', name: 'Bog sling', requirement: 'Any other weapon is used at -2 to hit.' }]),
    );
    expect(await screen.findByText("1 thing needs the GM's special approval")).toBeTruthy();
  });

  it('a non-class weapon unpicked takes its flag off; the fold starts open when one is picked', async () => {
    weaponWorld({ restricted: true });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWeaponStep(user);
    await user.click(row('Bog sling'));
    await user.click(row('Reed spear'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect((reedRecord().creation as { specialApprovals?: unknown[] }).specialApprovals).toHaveLength(1));
    await user.click(await screen.findByRole('button', { name: /^Change Weapon skills/ }));
    await screen.findByRole('heading', { name: 'Weapon skills' });
    expect(screen.getByText("Not your class's weapons: 1").closest('details')!.open).toBe(true);
    await user.click(row('Bog sling'));
    await user.click(row('Eel knife'));
    await user.click(screen.getAllByRole('button', { name: /^(Next|Back to review)$/ }).at(-1)!);
    await waitFor(() => expect((reedRecord().creation as { specialApprovals?: unknown[] }).specialApprovals).toBeUndefined());
  });

  it('without the restricted option the other weapons are not listed at all', async () => {
    weaponWorld({ restricted: false });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWeaponStep(user);
    expect(screen.queryByText(/Not your class's weapons/)).toBeNull();
    expect(screen.queryByText('Bog sling', { exact: false })).toBeNull();
  });

  it('Decide later puts exactly one To finish line on the character', async () => {
    weaponWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWeaponStep(user);
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    // The review's To finish box (cr-18).
    expect((await screen.findAllByRole('button', { name: 'Weapon skills, Do it now' })).length).toBe(1);
    expect((reedRecord().creation as { toFinish: string[] }).toFinish).toEqual(['weaponSkills']);
  });

  it('Next with picks short stays tappable and says how many are missing', async () => {
    weaponWorld({ start: 2 });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWeaponStep(user);
    await user.click(row('Reed spear'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect((await screen.findAllByText('Pick 1 more, or Decide later.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Weapon skills' })).toBeTruthy();
  });

  it('when the pack requires weapon skills there is no Decide later', async () => {
    weaponWorld({ require: ['weaponSkills'] });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWeaponStep(user);
    expect(screen.queryByRole('button', { name: 'Decide later' })).toBeNull();
  });

  it('full picks are saved on the character', async () => {
    weaponWorld({ start: 2 });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWeaponStep(user);
    await user.click(row('Reed spear'));
    await user.click(row('Eel knife'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(reedRecord().weapon_skills).toEqual([{ itemId: 'reed-spear' }, { itemId: 'eel-knife' }]));
  });
});

describe('weapon skills on the sheet', () => {
  async function openSheet(user: User) {
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Open Reed' }));
    await openFullSheetFromMenu(user);
  }

  function approvedReed(campaign: string, me: string, skills: unknown[]) {
    const id = world.addCharacter(campaign, 'Reed', { ownerId: me });
    // Level 4 with one pick every 3 levels from a start of 1: two picks allowed.
    Object.assign(world.tables.actors.find((a) => a.id === id)!, { level: 4, classes: [{ classRef: 'lantern-warden', level: 4, xp: 0 }], weapon_skills: skills });
  }

  it('an approved character at a level that grants another pick shows "to pick"; the owner can add one but not change an old one', async () => {
    const { me, campaign } = weaponWorld({ start: 1, gainEvery: 3 });
    approvedReed(campaign, me, [{ itemId: 'reed-spear' }]);
    const user = userEvent.setup();
    await openSheet(user);
    const card = await screen.findByRole('region', { name: 'To finish' });
    await user.click(within(card).getByRole('button', { name: /Weapon skills: 1 to pick/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Weapon skills' }));
    // The earlier pick is locked for the owner: tapping it explains instead of removing it.
    await user.click(dialog.getByRole('checkbox', { name: 'Pick Reed spear' }));
    expect(await screen.findByText('Only the GM can change a weapon skill once the character is approved.')).toBeTruthy();
    expect(dialog.getByRole('status', { name: 'Step status' }).textContent).toBe('1 of 2 picked');
    await user.click(dialog.getByRole('checkbox', { name: 'Pick Eel knife' }));
    expect(dialog.getByRole('status', { name: 'Step status' }).textContent).toBe('2 of 2 picked');
    await user.click(dialog.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(world.tables.actors.find((a) => a.name === 'Reed')!.weapon_skills).toEqual([{ itemId: 'reed-spear' }, { itemId: 'eel-knife' }]));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'To finish' })).toBeNull());
  });

  it('the sheet\'s weapon skills row lists the picks, marking a specialised one', async () => {
    const { me, campaign } = weaponWorld({ start: 2, gainEvery: 6, specialise: true });
    approvedReed(campaign, me, [{ itemId: 'reed-spear', specialised: true }]);
    const user = userEvent.setup();
    await openSheet(user);
    const line = await screen.findByRole('region', { name: 'Weapon skills' });
    expect(line.textContent).toContain('Weapon skills: Reed spear, specialised');
    expect(within(line).getByRole('button', { name: /weapon skills/i })).toBeTruthy();
  });

  // Purpose (as-8, ruled 2026-11-10): a weapon outside the class, picked as a GM-approved exception (here specialised,
  // as-7), says its cost on the sheet's Weapon skills line itself, not only behind ⓘ; a class weapon says nothing more.
  it('the sheet\'s weapon skills row says the penalty beside a pick outside the class', async () => {
    const { me, campaign } = weaponWorld({ start: 3, gainEvery: 6, specialise: true, restricted: true });
    approvedReed(campaign, me, [{ itemId: 'reed-spear' }, { itemId: 'bog-sling', specialised: true }]);
    const user = userEvent.setup();
    await openSheet(user);
    const line = await screen.findByRole('region', { name: 'Weapon skills' });
    expect(line.textContent).toContain('Weapon skills: Reed spear, Bog sling, specialised (not your class’s weapon, usable at −2 to hit)');
  });

  // Purpose (as-8, ruled 2026-11-10): the GM's exception card for a weapon outside the class says what allowing it costs,
  // the setting's penalty, under the pack's reason, so the GM sees it when approving.
  it('the GM’s exception card for a weapon outside the class says it is usable at the penalty', async () => {
    const { gm, me, campaign } = weaponWorld({ start: 2, gainEvery: 6, restricted: true });
    const id = world.addCharacter(campaign, 'Reed', { ownerId: me, approval: 'pending' });
    Object.assign(world.tables.actors.find((a) => a.id === id)!, {
      level: 1,
      classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }],
      weapon_skills: [{ itemId: 'reed-spear' }, { itemId: 'bog-sling' }],
      creation: { specialApprovals: [{ step: 'weaponSkills', entryId: 'bog-sling', name: 'Bog sling', requirement: 'Any other weapon is used at -2 to hit.' }] },
    });
    world.signInAs(gm);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
    const card = within(await screen.findByRole('group', { name: 'Needs your special approval: Bog sling' }));
    expect(card.getByText('Bog sling: Any other weapon is used at -2 to hit.')).toBeTruthy();
    expect(await card.findByText('If you allow it: usable at −2 to hit.')).toBeTruthy();
  });

  // Purpose (Design, 2026-11-10, #618's ⚑ 2): when the out-of-class pick is a specialisation, the GM's card says so after
  // the weapon's name, so the GM sees they are approving a specialisation, with the penalty line under it.
  it('the GM’s exception card says when the weapon outside the class is to be specialised in', async () => {
    const { gm, me, campaign } = weaponWorld({ start: 3, gainEvery: 6, specialise: true, restricted: true });
    const id = world.addCharacter(campaign, 'Reed', { ownerId: me, approval: 'pending' });
    Object.assign(world.tables.actors.find((a) => a.id === id)!, {
      level: 1,
      classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }],
      weapon_skills: [{ itemId: 'reed-spear' }, { itemId: 'bog-sling', specialised: true }],
      creation: { specialApprovals: [{ step: 'weaponSkills', entryId: 'bog-sling', name: 'Bog sling', requirement: 'Any other weapon is used at -2 to hit.' }] },
    });
    world.signInAs(gm);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
    const card = within(await screen.findByRole('group', { name: 'Needs your special approval: Bog sling' }));
    expect(card.getByText('Bog sling, to specialise in: Any other weapon is used at -2 to hit.')).toBeTruthy();
    expect(await card.findByText('If you allow it: usable at −2 to hit.')).toBeTruthy();
  });

  // After-test A13: the sheet showed both the Weapon skills line and an empty Weapon proficiencies tile.
  it('the sheet shows the weapon skills line, not the layout’s Weapon proficiencies field, while the setup applies', async () => {
    const { me, campaign } = weaponWorld({ start: 2, gainEvery: 6, proficiencyField: true });
    approvedReed(campaign, me, [{ itemId: 'reed-spear' }]);
    const user = userEvent.setup();
    await openSheet(user);
    expect((await screen.findByRole('region', { name: 'Weapon skills' })).textContent).toContain('Weapon skills: Reed spear');
    expect(screen.queryByText('Weapon proficiencies')).toBeNull();
  });

  it('a class the weapon setup doesn’t apply to keeps the Weapon proficiencies field on its sheet', async () => {
    const { me, campaign } = weaponWorld({ start: 2, gainEvery: 6, proficiencyField: true, category: null });
    approvedReed(campaign, me, []);
    const user = userEvent.setup();
    await openSheet(user);
    expect(await screen.findByText('Weapon proficiencies')).toBeTruthy();
  });

  it('with every pick spent there is no weapon skills line on To finish', async () => {
    const { me, campaign } = weaponWorld({ start: 1, gainEvery: 6 });
    approvedReed(campaign, me, [{ itemId: 'reed-spear' }]);
    const user = userEvent.setup();
    await openSheet(user);
    await screen.findByRole('region', { name: 'Weapon skills' });
    expect(screen.queryByRole('region', { name: 'To finish' })).toBeNull();
  });
});

describe('weapon skills in the Player screen’s foot (dec-13 C12)', () => {
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it('on a tablet the picks are a Weapon skills row with a chevron and the picks in its line; it opens the pack’s rule', async () => {
    // Purpose: P1 draws the weapon skills as a summary row under "Full character sheet"; the rule behind ⓘ is one tap away.
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    window.matchMedia = ((query: string) => {
      const min = /min-width:\s*(\d+)px/.exec(query);
      const max = /max-width:\s*(\d+)px/.exec(query);
      const matches = (!min || 1024 >= Number(min[1])) && (!max || 1024 <= Number(max[1])) && Boolean(min || max);
      return { matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
    }) as typeof window.matchMedia;
    const { me, campaign } = weaponWorld({ start: 2, gainEvery: 6, specialise: true });
    const id = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === id)!, { level: 4, classes: [{ classRef: 'lantern-warden', level: 4, xp: 0 }], weapon_skills: [{ itemId: 'reed-spear', specialised: true }, { itemId: 'eel-knife' }] });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Open Reed' }));
    const row = await screen.findByRole('button', { name: 'Weapon skills, Reed spear, specialised, Eel knife' });
    expect(row.querySelector('.list-row__chevron')).not.toBeNull();
    expect(row.textContent).toContain('Reed spear, specialised, Eel knife');
    await user.click(row);
    expect(await screen.findByRole('dialog', { name: 'Weapon skills' })).toBeTruthy();
  });

  it('on a tablet a pick outside the class says its cost in the row’s line and in its pop-up (as-8)', async () => {
    // Purpose: the as-8 ruling has a weapon outside the class say its −2 in place; the Player screen's row must not drop it.
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    window.matchMedia = ((query: string) => {
      const min = /min-width:\s*(\d+)px/.exec(query);
      const max = /max-width:\s*(\d+)px/.exec(query);
      const matches = (!min || 1024 >= Number(min[1])) && (!max || 1024 <= Number(max[1])) && Boolean(min || max);
      return { matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
    }) as typeof window.matchMedia;
    const { me, campaign } = weaponWorld({ start: 3, gainEvery: 6, specialise: true, restricted: true });
    const id = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === id)!, { level: 4, classes: [{ classRef: 'lantern-warden', level: 4, xp: 0 }], weapon_skills: [{ itemId: 'reed-spear' }, { itemId: 'bog-sling', specialised: true }] });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Open Reed' }));
    const row = await screen.findByRole('button', { name: /^Weapon skills, Reed spear, Bog sling/ });
    expect(row.textContent).toContain('Reed spear, Bog sling, specialised (not your class’s weapon, usable at −2 to hit)');
    await user.click(row);
    const popUp = await screen.findByRole('dialog', { name: 'Weapon skills' });
    expect(popUp.textContent).toContain('Bog sling (not your class’s weapon, usable at −2 to hit).');
    expect(popUp.textContent).not.toContain('Reed spear (not your class');
  });
});
