// @vitest-environment jsdom
// Expertise points in the app (G-208; ruling g208-expertise-points-2026-11-20, ex-3 to ex-9; mockup december/29): the
// creation step present only while the option is on (ct-10), Decide later, the review's card, the To finish line after
// a level and its Done with Undo. Every class, skill and number is invented (hard rule 2).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { forgetCampaignSetting, type CampaignSetting } from './campaignSetting.ts';
import { forgetFileLinks } from '../core/files.ts';
import { Root } from './App.tsx';
import { FinishCreation } from './FinishCreation.tsx';
import { ToastHost } from '../ui/ToastHost.tsx';
import type { CharacterRef } from '../modules/characters/commands.ts';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';

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

afterEach(() => cleanup());

const points = { atStart: 3, perLevel: 1, base: 1, best: 4, name: 'Expertise' };
const prowlerSkills = { die: 'd6', names: { SW: 'Scale walls', SS: 'Spot snares', WL: 'Work locks' }, byLevel: [{ level: 1, SW: 2, SS: 2, WL: 1 }] };

/** A campaign whose Fen Prowler takes expertise points while the "Prowler knacks" option is on. */
function prowlerWorld({ on = true }: { on?: boolean } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('option', 'prowler-knacks', 'Prowler knacks', { default: on ? 'on' : 'off', changeLater: 'warn', choices: [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }] });
  entry('rulesSet', 'fen-rules', 'Fen rules', { abilities: [{ key: 'STR', short: 'Strength', name: 'Strength' }], abilityModifiers: { STR: [{ range: '3-18', melee: 0 }] } });
  entry('class', 'fen-prowler', 'Fen Prowler', {
    progression: [{ level: 1, hitDice: '1d4', thac0: 19, saves: {} }],
    skills: prowlerSkills,
    byOption: { 'prowler-knacks=on': { skills: { points } } },
  });
  entry('fieldTemplate', 'fen-sheet', 'fen-sheet', { appliesTo: 'pc', fields: [{ key: 'STR', label: 'Strength', type: 'number' }] });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.field_definitions.push({ id: 'field-STR', campaign_id: campaign, applies_to: 'pc', key: 'STR', label: 'Strength', type: 'number', choices: [], field_group: 'Abilities', sort_order: 0, show_on_card: false, hidden: false, fill: null, required: false, created_at: '2026-10-18T12:00:00Z' });
  world.signInAs(me);
  return { gm, me, campaign };
}

type User = ReturnType<typeof userEvent.setup>;

/** Through Scores, Class and Who they are, naming the character Reed. */
async function pastWho(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(await screen.findByRole('checkbox', { name: 'Pick Fen Prowler' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('heading', { name: 'Who they are' });
  await user.type(screen.getByLabelText('Name'), 'Reed');
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

const reedRecord = () => world.tables.actors.find((a) => a.name === 'Reed')!;
const more = (name: string) => screen.getByRole('button', { name: `More points on ${name}` });
const less = (name: string) => screen.getByRole('button', { name: `Less points on ${name}` });

describe('the Expertise step in creation (ct-10)', () => {
  // Purpose: with the option on the step is there, after Who they are; with it off it isn't, and nothing asks for points.
  it('is there with the option on, and not with it off', async () => {
    prowlerWorld({ on: true });
    const user = userEvent.setup();
    const { unmount } = render(<Root db={world.db} />);
    await pastWho(user);
    expect(await screen.findByRole('heading', { name: 'Expertise' })).toBeTruthy();
    unmount();
    cleanup();
    world = createFakeDb();
    forgetCampaignSetting();
    prowlerWorld({ on: false });
    render(<Root db={world.db} />);
    await pastWho(user);
    await waitFor(() => expect(screen.queryByLabelText('Name')).toBeNull());
    expect(screen.queryByRole('heading', { name: 'Expertise' })).toBeNull();
    expect(screen.queryByText(/Spend 3 points/)).toBeNull();
  });

  // Purpose: Next saves the points on the character and the review's Expertise card lists them, then the rest (X7).
  it('Next saves the points and the review lists them', async () => {
    prowlerWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await pastWho(user);
    await screen.findByRole('heading', { name: 'Expertise' });
    await user.click(more('Work locks'));
    await user.click(more('Work locks'));
    await user.click(more('Spot snares'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Spot snares 2-in-6, Work locks 3-in-6. The rest 1-in-6.')).toBeTruthy();
    expect(reedRecord().expertise).toEqual({ WL: 2, SS: 1 });
  });

  // Purpose: Decide later puts the step on To finish, and the review's card says what waits (X7 right).
  it('Decide later puts it on To finish and the review says what waits', async () => {
    prowlerWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await pastWho(user);
    await screen.findByRole('heading', { name: 'Expertise' });
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    expect(await screen.findByText('Decided later: 3 points to spend, on the To finish list')).toBeTruthy();
    expect((reedRecord().creation as { toFinish: string[] }).toFinish).toEqual(['expertise']);
    expect((await screen.findAllByRole('button', { name: 'Expertise, Do it now' })).length).toBe(1);
  });

  // Purpose: a player who saved points, opens the step again from the review, takes every point back and taps Decide
  // later has nothing left on the record, and the review says all the points wait (#1093 review, 2).
  it('Decide later after taking every point back saves the take-back', async () => {
    prowlerWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await pastWho(user);
    await screen.findByRole('heading', { name: 'Expertise' });
    await user.click(more('Work locks'));
    await user.click(more('Work locks'));
    await user.click(more('Spot snares'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Spot snares 2-in-6, Work locks 3-in-6. The rest 1-in-6.');
    await user.click(screen.getByRole('button', { name: 'Change Expertise' }));
    await screen.findByRole('heading', { name: 'Expertise' });
    await user.click(less('Work locks'));
    await user.click(less('Work locks'));
    await user.click(less('Spot snares'));
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    expect(await screen.findByText('Decided later: 3 points to spend, on the To finish list')).toBeTruthy();
    expect(reedRecord().expertise ?? {}).toEqual({});
  });
});

describe('the sheet (ex-6, X6)', () => {
  const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
  type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; from?: string };

  /** Reed, a level 1 Mire Stalker on the invented Fen sample, whose class takes expertise points; one point on Keen ear. */
  function stalkerWorld() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
    const entry = (kind: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
    for (const r of pack.rulesSets!) entry('rulesSet', r);
    for (const r of pack.races!) entry('race', r);
    for (const c of pack.classes!) entry('class', c.id === 'mire-stalker' ? { ...c, skills: { names: { EAR: 'Keen ear', WL: 'Work locks' }, die: 'd6', byLevel: [{ level: 1, EAR: 2, WL: 1 }], points: { atStart: 2, perLevel: 1, base: 1, best: 4, name: 'Expertise' } } } : c);
    for (const h of pack.hooks!) entry('hook', h);
    for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
    (pack.fieldTemplates![0]!.fields as LayoutField[])
      .filter((f) => f.key !== 'hp' && !f.from)
      .forEach((f, order) => {
        const type = f.type === 'list' && !f.choices?.length ? 'text' : f.type;
        world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: null, created_at: '2026-10-18T12:00:00Z' });
      });
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me, approval: 'approved' });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 1, hp_current: 6, hp_max: 6, race_ref: 'bog-folk', fields: { MUS: 10, NIM: 10 }, classes: [{ classRef: 'mire-stalker', level: 1, xp: 0 }], expertise: { EAR: 1 } });
    world.addMember(campaign, me, 'player', reed);
    world.signInAs(me);
  }

  // Purpose: the skill's figure follows its points, its pop-up gains the Expertise line, and a player sees no Move
  // points (the GM's alone); the point still to spend is on To finish.
  it('shows the figure from the points, the Expertise line, no Move points for a player, and the point to spend', async () => {
    stalkerWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Full character sheet' }));
    const skills = await screen.findByRole('region', { name: 'Skills' });
    await user.click(within(skills).getByRole('button', { name: /^Keen ear/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Keen ear' });
    // One point on a 1-in-6 skill: 2-in-6, which the pop-up's top line reads as a 5+ on a d6 (tfs-1).
    expect(dialog.querySelector('.breakdown-sheet__figure')?.textContent).toBe('Succeeds on a 5+, roll 1d6');
    const line = dialog.querySelector('.skill-sheet__expertise');
    expect(line?.querySelector('.book-label')?.textContent).toBe('Expertise');
    expect(line?.textContent).toBe('Expertise 1 point. Every skill starts at 1-in-6; at best 4-in-6');
    expect(within(dialog).queryByRole('button', { name: 'Move points' })).toBeNull();
    expect(screen.getByText('Expertise, 1 to spend')).toBeTruthy();
  });
});

describe('To finish after a level (ex-5, X5)', () => {
  const setting = {
    all: [{ kind: 'class', packEntryId: 'fen-prowler', packId: 'pack-fen', name: 'Fen Prowler', data: { id: 'fen-prowler', name: 'Fen Prowler', skills: { ...prowlerSkills, points } } }],
    rulesSets: [],
    packs: [],
    items: [],
    ruleGroups: [],
  } as unknown as CampaignSetting;

  function finish(level: number, expertise: Record<string, number>) {
    const { me, campaign } = prowlerWorld();
    const id = world.addCharacter(campaign, 'Wren', { ownerId: me, approval: 'approved' });
    const row = world.tables.actors.find((a) => a.id === id)!;
    row.level = level;
    row.expertise = expertise;
    const ref: CharacterRef = { id, campaignId: campaign, ownerType: 'user', ownerUserId: me, approval: 'approved', archived: false };
    const user = { id: me, roles: { [campaign]: 'player' as const } };
    render(
      <ToastHost>
        <FinishCreation db={world.db} user={user} character={ref} fields={{}} creation={{}} classRef="fen-prowler" raceRef={null} fieldDefs={[]} setting={setting} level={level} approved gm={false} weaponSkills={[]} expertise={expertise} onSaved={() => {}} />
      </ToastHost>,
    );
    return row;
  }

  // Purpose: a level that gives a point puts "Expertise, 1 to spend" on To finish; with every point spent, no line.
  it('a level that gives points puts the line on To finish', () => {
    finish(2, { SW: 1, SS: 1, WL: 1 });
    expect(screen.getByText('Expertise, 1 to spend')).toBeTruthy();
    cleanup();
    world = createFakeDb();
    finish(1, { SW: 1, SS: 1, WL: 1 });
    expect(screen.queryByText(/to spend/)).toBeNull();
  });

  // Purpose: Done saves the visit once, as one logged change, and its Undo puts the points back (ex-5).
  it('Done saves once, with Undo', async () => {
    const row = finish(2, { SW: 1, SS: 1, WL: 1 });
    const user = userEvent.setup();
    const edits = () => world.tables.events.filter((e) => e.type === 'character.edit').length;
    const before = edits();
    await user.click(screen.getByText('Expertise, 1 to spend'));
    const step = await screen.findByRole('dialog', { name: 'Expertise' });
    expect(within(step).getByRole('heading', { name: /1 new point, for level 2/ })).toBeTruthy();
    await user.click(within(step).getByRole('button', { name: 'More points on Work locks' }));
    await user.click(within(step).getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Expertise: Work locks 3-in-6.')).toBeTruthy();
    expect(row.expertise).toEqual({ SW: 1, SS: 1, WL: 2 });
    expect(edits()).toBe(before + 1);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(row.expertise).toEqual({ SW: 1, SS: 1, WL: 1 }));
  });

  // Purpose: the Expertise To finish pop-up has a Back beside Done that closes it without saving (X5; flag 2, Francis
  // 2026-11-20).
  it('Back beside Done closes the pop-up without saving', async () => {
    const row = finish(2, { SW: 1, SS: 1, WL: 1 });
    const user = userEvent.setup();
    const edits = () => world.tables.events.filter((e) => e.type === 'character.edit').length;
    const before = edits();
    await user.click(screen.getByText('Expertise, 1 to spend'));
    const step = await screen.findByRole('dialog', { name: 'Expertise' });
    const foot = step.querySelector('.creation-step__foot') as HTMLElement;
    const back = within(foot).getByRole('button', { name: 'Back' });
    const done = within(foot).getByRole('button', { name: 'Done' });
    // Back first, then Done (X5), in the same foot.
    expect(back.compareDocumentPosition(done) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(within(step).getByRole('button', { name: 'More points on Work locks' }));
    await user.click(back);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Expertise' })).toBeNull());
    expect(row.expertise).toEqual({ SW: 1, SS: 1, WL: 1 });
    expect(edits()).toBe(before);
    expect(screen.getByText('Expertise, 1 to spend')).toBeTruthy();
  });
});
