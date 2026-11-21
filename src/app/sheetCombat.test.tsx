// @vitest-environment jsdom
// The full sheet's Combat, Movement and Skills (plan m5b-sheet build order 1; ruling sr-1, sr-2, sr-8; A4 from
// bq3-13), on the invented fixture pack scripts/fixtures/m5b-creation.fixture.json with an AC-style option and a
// stalker's own skills added here. Every name and number is invented.
//   No full sheet shows a raw "Movement: <mode>" box or a bare Attack number.
//   A stalker's skills appear in the Skills list after everyone's (plan m5b-sheet-revised: no groups, no fold).
//   With descending AC, Attack's breakdown has the to-hit row; with ascending, it doesn't (and the figure is the bonus).
//   The Player screen names everyone's skills as the pack does ("Hark", not "hark").
import { cleanup, render, screen, within } from '@testing-library/react';
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
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; from?: string };
const layoutFields = pack.fieldTemplates![0]!.fields as LayoutField[];

/** An invented AC-style option, as a pack writes it: the style's name starts each choice's id (07). */
const acStyle = { id: 'fen-armour-style', name: 'Armour and attacks', ruleKey: 'ac-style', default: 'descending-sum', choices: [{ id: 'descending-sum', name: 'Going down' }, { id: 'ascending', name: 'Going up' }] };
/** The stalker's own skills: six, rolled at or over a target on a d6. */
const stalkerSkills = {
  names: { 'slip-reeds': 'Slip through reeds', 'pick-lock': 'Pick a lock', 'read-tracks': 'Read tracks', 'climb-willow': 'Climb a willow', 'still-water': 'Walk still water', 'mimic-heron': 'Mimic a heron' },
  die: 'd6',
  rollMode: 'equal-or-over',
  byLevel: [{ level: 1, 'slip-reeds': 4, 'pick-lock': 5, 'read-tracks': 5, 'climb-willow': 4, 'still-water': 6, 'mimic-heron': 6 }],
};

function fenWorld(style: string) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', { ...r, attack: { unarmouredAC: { descending: 9, ascending: 10 } } });
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) {
    // The stalker gives both figures: the target number and the bonus (A4 picks one by the style).
    const progression = c.id === 'mire-stalker' ? [{ level: 1, hitDice: '1d6', thac0: 19, attackBonus: 1, saves: { mire: 13 } }] : c.progression;
    entry('class', c.id === 'mire-stalker' ? { ...c, progression, skills: stalkerSkills } : c);
  }
  // The level fill reaches the class's skills too, as the real packs' do.
  for (const h of pack.hooks!) entry('hook', h.id === 'fen-fill-level' ? { ...h, target: [...(h.target as string[]), 'skills'] } : h);
  for (const i of pack.items!) entry('item', i);
  for (const t of pack.traitLists!) entry('traitList', t);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  entry('option', acStyle);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: { 'fen-armour-style': style }, overrides: {}, priority: 1 });
  layoutFields
    .filter((f) => f.key !== 'hp')
    .forEach((f, order) => {
      const fromList = f.from && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.from) ? f.from : null;
      const type = f.type === 'list' && !f.choices?.length && !fromList ? 'text' : f.type;
      world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: fromList, created_at: '2026-10-18T12:00:00Z' });
    });
  world.signInAs(me);
  const tam = world.addCharacter(campaign, 'Tam', { ownerId: me, approval: 'approved' });
  Object.assign(world.tables.actors.find((a) => a.id === tam)!, {
    level: 1,
    race_ref: 'stone-kin',
    hp_current: 5,
    hp_max: 6,
    fields: { MUS: 9, NIM: 13, GRT: 9, WIT: 9, LORE: 9, CHARM: 9 },
    creation: { scores: { MUS: 9, NIM: 13, GRT: 9, WIT: 9, LORE: 9, CHARM: 9 } },
    classes: [{ classRef: 'mire-stalker', level: 1, xp: 0 }],
  });
  world.tables.members.find((m) => m.user_id === me && m.campaign_id === campaign)!.active_actor_id = tam;
}

async function openSheet(): Promise<User> {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Character options' }));
  await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Full character sheet' }));
  // The Combat block is gone (plan m5b-sheet-revised A1): the sheet is open once its Level row is there.
  await screen.findByRole('region', { name: 'Level' });
  return user;
}

describe('the full sheet: Combat, Movement, Skills (sr-1, sr-2, sr-8)', () => {
  it('no raw "Movement: <mode>" box and no bare Attack number; one Movement section in words', async () => {
    // Purpose: the left column has the AC and Attack tiles and no movement boxes; Movement is its own section.
    // Plan m5b-sheet-revised A1/A3: the Combat block, its HP tile and the hit dice tile are gone (HP is the Player
    // screen's box; Level is a row).
    fenWorld('descending-sum');
    await openSheet();
    const combat = within(document.querySelector('.sheet__vitals') as HTMLElement);
    expect(combat.queryByText(/^Movement/)).toBeNull();
    const attack = combat.getByRole('button', { name: "Attack 19: how it's worked out" });
    // Commas, never a middle dot (plan m5b-players-screens-standard D); the pack's word with a capital (tfw-7).
    expect(attack.textContent).toContain('Melee 19, Missile 18');
    expect(within(screen.getByRole('region', { name: 'Level' })).getByRole('button', { name: /^Level/ }).textContent).toContain('0 experience');
    const movement = screen.getByRole('region', { name: 'Movement' });
    expect(within(movement).getByRole('button', { name: /: how it's worked out$/ }).getAttribute('aria-label')).toMatch(/^Movement [0-9]+/);
    expect(movement.textContent).toContain('In a fight 10 ft per round');
    expect(within(movement).queryByText(/Movement: /)).toBeNull();
  });

  it("a stalker's skills are under Skills in one list, everyone's first, none folded", async () => {
    // Purpose: class skills are in the Skills list, not in the left column; everyone's skills come before the class's own.
    // Plan m5b-sheet-revised A2: Skills is one dotted column of rows, so the group headings and the "2 more" fold are gone.
    fenWorld('descending-sum');
    const user = await openSheet();
    expect(within(document.querySelector('.sheet__vitals') as HTMLElement).queryByText('Slip through reeds')).toBeNull();
    const skills = screen.getByRole('region', { name: 'Skills' });
    expect(within(skills).queryByRole('heading', { name: 'Everyone' })).toBeNull();
    // The kindred's Hark is the one that counts: tagged with the kindred word.
    // Each a row as on the Player screen (plan D): the name, the tag under it, the value.
    const rows = within(skills).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(rows[0]).toMatch(/^Hark, .+ 5\+ on d6: where it comes from$/);
    expect(rows.indexOf('Slip through reeds 4+ on d6: where it comes from')).toBeGreaterThan(0);
    expect(rows).toContain('Mimic a heron 6+ on d6: where it comes from');
    expect(within(skills).queryByRole('button', { name: '2 more' })).toBeNull();
    await user.click(within(skills).getByRole('button', { name: 'Pick a lock 5+ on d6: where it comes from' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Pick a lock' }));
    expect(dialog.getByText('Succeeds on a 5+,')).toBeTruthy();
  });

  it("with descending AC, Attack's breakdown has the to-hit row by AC", async () => {
    // Purpose: the printed sheet's matrix is one tap from the Attack tile when AC goes down (sr-8).
    fenWorld('descending-sum');
    const user = await openSheet();
    await user.click(screen.getByRole('button', { name: "Attack 19: how it's worked out" }));
    // The sheet is named "Attack", its number large in the head beside the name (the Figure head, P7).
    const dialog = within(await screen.findByRole('dialog', { name: 'Attack' }));
    expect(dialog.getByText('19', { selector: '.dialog__figure' })).toBeTruthy();
    expect(dialog.getByText('Mire Stalker at level 1')).toBeTruthy();
    expect(dialog.getByText('Missile, NIM +1')).toBeTruthy();
    // Five ACs to a table, each with its own Roll line (#410's pictures: every column in sight on a phone).
    const [high, low] = dialog.getAllByRole('table') as [HTMLElement, HTMLElement];
    expect(within(high).getByRole('rowheader', { name: 'Roll' })).toBeTruthy();
    expect(high.textContent).toContain('AC98765');
    expect(within(low).getByRole('rowheader', { name: 'Roll' })).toBeTruthy();
    expect(low.textContent).toContain('AC43210');
    expect(dialog.getByText('From the rules: descending AC, the option “Armour and attacks”')).toBeTruthy();
  });

  it('with ascending AC, the figure is the bonus and the breakdown has no to-hit row', async () => {
    // Purpose: A4: the attack field follows the AC style; sr-8: no matrix going up.
    fenWorld('ascending');
    const user = await openSheet();
    await user.click(screen.getByRole('button', { name: "Attack +1: how it's worked out" }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Attack' }));
    expect(dialog.getByText('+1', { selector: '.dialog__figure' })).toBeTruthy();
    expect(dialog.queryByRole('table')).toBeNull();
    expect(dialog.getByText('+1 to the d20 against AC')).toBeTruthy();
  });
});

describe("the Player tab's Attack box (test feedback of 19 Nov 2026, A3 and B3)", () => {
  it("reads the pop-up's totals in its small line, and a typed figure that is the class's own is listed once", async () => {
    // Purpose (A3, tfw-7): with an AC style, the Attack box's small line reads each kind's total, the same figure as the
    // pop-up's row, with a capital ("Melee +1, Missile +2"), never the score's modifier alone.
    // Purpose (B3, tfw-6): creation's copy of the class's figure on the sheet is not a second row; no "Written on the sheet".
    fenWorld('ascending');
    const tam = world.tables.actors.find((a) => a.name === 'Tam')!;
    // Creation saves a copy of the class's figure (the bonus +1, going up) in the sheet's attack field.
    tam.fields = { ...(tam.fields as Record<string, unknown>), attack: 1 };
    render(<Root db={world.db} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    const vitals = within(await screen.findByRole('region', { name: 'Vitals' }));
    const attack = vitals.getByRole('button', { name: /^Attack / });
    const line = attack.querySelector('.stat-tile__caption')!.textContent!;
    await user.click(attack);
    const sheet = await screen.findByRole('dialog', { name: 'Attack' });
    const rows = [...sheet.querySelectorAll('.breakdown__row')].map((r) => [r.querySelector('dt')!.textContent!, r.querySelector('dd')!.textContent!]);
    const kinds = rows.filter(([label]) => /^(Melee|Missile),/.test(label!)).map(([label, value]) => `${label!.split(',')[0]} ${value}`);
    expect(kinds.length).toBe(2);
    expect(line).toBe(kinds.join(', '));
    expect(line).toMatch(/^Melee [+−]\d+, Missile [+−]\d+$/);
    expect(rows.map(([label]) => label)).not.toContain('Written on the sheet');
    expect(rows.map(([label]) => label)).not.toContain('Set by hand');
  });

  it('follows a figure set by hand, on the Player tab and on the full sheet\'s tile (H1)', async () => {
    // Purpose (H1, "Follow hand-set", 2026-11-19): for the class's bonus of +1, a typed +3 and a missile modifier of +1
    // (NIM 13), the box's small line reads the totals from the typed figure, "Missile +4", not the class's "Missile +2";
    // the same line on the Player tab's box and the full sheet's tile, and the pop-up's rows agree (⚑ 22).
    fenWorld('ascending');
    const tam = world.tables.actors.find((a) => a.name === 'Tam')!;
    tam.fields = { ...(tam.fields as Record<string, unknown>), attack: '+3' };
    render(<Root db={world.db} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    const vitals = within(await screen.findByRole('region', { name: 'Vitals' }));
    const box = vitals.getByRole('button', { name: /^Attack \+3/ });
    const line = box.querySelector('.stat-tile__caption')!.textContent!;
    expect(line).toMatch(/^Melee [+−]\d+, Missile \+4$/);
    await user.click(box);
    const sheet = await screen.findByRole('dialog', { name: 'Attack' });
    const labels = [...sheet.querySelectorAll('.breakdown__row dt')].map((dt) => dt.textContent);
    expect(labels.slice(0, 2)).toEqual(['Set by hand', 'Mire Stalker at level 1']);
    expect(sheet.textContent).toContain('Missile, NIM +1+4');
    await user.click(within(sheet).getByRole('button', { name: /close/i }));
    await user.click(screen.getByRole('button', { name: 'Character options' }));
    await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Full character sheet' }));
    await screen.findByRole('region', { name: 'Level' });
    const tile = within(document.querySelector('.sheet__vitals') as HTMLElement).getByRole('button', { name: /^Attack \+3: how it's worked out$/ });
    expect(tile.textContent).toContain(line);
  });
});

describe("the Player screen's skills (sr-2)", () => {
  it('names everyone\'s skills as the pack does, then the class\'s own', async () => {
    // Purpose: the Player screen never shows a raw id ("hark").
    fenWorld('descending-sum');
    render(<Root db={world.db} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    const skills = await screen.findByRole('region', { name: 'Skills' });
    const names = within(skills).getAllByRole('button').map((b) => b.querySelector('.list-row__title')?.textContent);
    expect(names.slice(0, 2)).toEqual(['Hark', 'Slip through reeds']);
    expect(names).not.toContain('hark');
  });
});
