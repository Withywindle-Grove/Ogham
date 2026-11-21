// @vitest-environment jsdom
// The full sheet on creation's standard, slice D (plan m5b-players-screens-standard), on the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json. Purposes:
//   The full sheet draws no " · ", "›" or "▲": its bar, its identity line, its tiles, every row opened, every
//   sheet it opens and its foot. The watcher is A's shared one. (Plan m5b-sheet-revised: the fold rows and the Pack
//   load are gone from the sheet, so every Skills, Abilities and Traits row is opened instead.)
//   On a phone the sheet heads with the name and the identity line in the pack's words ("Lamplighter, Lantern Warden 1,
//   Bog folk": the title first, the alignment is a Traits row; plan A1), then AC and Attack as captioned tiles, then
//   Scores as six tiles (the full name, gate finding F8, the score, the modifier under it) and Saves as tiles, never folded;
//   Movement, Skills, Traits and Languages are plain open sections, no fold rows.
//   A score tile opens its breakdown sheet, which uses the ability's full name and says its modifiers in the pack's
//   words for what each modifies; the tile shows one modifier, never two bare (Design's answer 5).
//   (Hit points are the Player screen's box now; the tile with the die a level is gone.)
//   Offline, the foot reads "Offline. Saved on this device" with the warning sign (Design's answer 4).
//   Every pop-up on the sheet is a Sheet: the AC tile's breakdown too.
//   The foot reads "Up to date" with Back and Edit, neither the accent; Back goes back, Edit opens the form.
//   (The six tiles in two rows at 375 px and the landscape tablet's split, which need a real layout, are in
//   tests/layout/fullSheet.spec.ts.)
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { watchMarks } from '../testing/markScan.ts';
import { openFullSheetFromMenu } from '../testing/openFullSheet.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
type User = ReturnType<typeof userEvent.setup>;

let watching: ReturnType<typeof watchMarks> | null = null;

/** A window this many pixels wide (jsdom has no layout): matchMedia answers min-width and max-width queries. */
function windowOf(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = (!min || width >= Number(min[1])) && (!max || width <= Number(max[1])) && Boolean(min || max);
    return { matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
  }) as typeof window.matchMedia;
}

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  windowOf(375);
});

afterEach(() => {
  watching?.stop();
  watching = null;
  cleanup();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; from?: string };

/** The fixture on a campaign, and Wren (a bog folk Lantern Warden, level 1, leaning Lantern, two languages) for Sam. */
function fenWorld() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const o of pack.options ?? []) entry('option', o);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  for (const s of pack.spellLists ?? []) entry('spellList', s);
  for (const s of pack.spells ?? []) entry('spell', s);
  for (const t of pack.tables ?? []) entry('table', t);
  for (const h of pack.hooks!) entry('hook', h);
  for (const i of pack.items!) entry('item', i);
  for (const k of pack.startingKits!) entry('startingKit', k);
  for (const t of pack.traitLists!) entry('traitList', t);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  entry('xpTable', { id: 'warden-xp', name: 'Warden XP', levels: [{ level: 1, xp: 0 }, { level: 2, xp: 1500 }] });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => f.key !== 'omen' && f.key !== 'hp' && !f.from);
  layout.forEach((f, order) => {
    const type = f.type === 'list' && !f.choices?.length ? 'text' : f.type;
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: null, created_at: '2026-10-18T12:00:00Z' });
  });
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: me, approval: 'approved' });
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, {
    level: 1,
    hp_current: 6,
    hp_max: 9,
    race_ref: 'bog-folk',
    fields: { MUS: 13, NIM: 12, GRT: 11, WIT: 14, LORE: 9, CHARM: 10, languages: 'Fen common, Heron-tongue' },
    classes: [{ classRef: 'lantern-warden', level: 1, xp: 120 }],
  });
  world.tables.character_alignments.push({ actor_id: wren, campaign_id: campaign, owner_user_id: me, alignment: 'Lantern', created_at: '2026-10-18T12:00:00Z', updated_at: '2026-10-18T12:00:00Z' });
  world.addMember(campaign, me, 'player', wren);
  world.signInAs(me);
  return { gm, me, campaign, wren };
}

/** The Player screen, then the full sheet from its row. */
async function openSheet(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await screen.findByRole('region', { name: 'Vitals' });
  await openFullSheetFromMenu(user);
  // The Combat block is gone (plan m5b-sheet-revised A1): the sheet is open once its Level row is there.
  await screen.findByRole('region', { name: 'Level' });
}

/** Opens a tile or row, checks a Sheet opened, and returns it. */
async function opensSheet(user: User, button: HTMLElement, name: string | RegExp) {
  await user.click(button);
  const sheet = await screen.findByRole('dialog', { name });
  expect(sheet.classList.contains('dialog--sheet')).toBe(true);
  return sheet;
}

const closeTop = async (user: User) => {
  const dialogs = screen.getAllByRole('dialog');
  const top = within(dialogs.at(-1)!);
  await user.click(top.queryAllByRole('button', { name: 'Close' })[0] ?? top.getByRole('button', { name: 'Got it' }));
};

describe('the full sheet on the standard (D)', () => {
  it('draws no middle dot, › or ▲ in its bar, identity line, tiles, fold rows, sheets and foot', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openSheet(user);
    // The Pack load (.pack-load) is the Pack's piece, slice C's to change.
    watching = watchMarks('.top-row, .sheet, [role="dialog"], .toast', '.pack-load');
    // Every tile's sheet.
    const tiles = [...document.querySelectorAll<HTMLElement>('.sheet .stat-tile--tap')];
    expect(tiles.length).toBeGreaterThanOrEqual(8);
    for (const tile of tiles) {
      await user.click(tile);
      await closeTop(user);
    }
    // Plan m5b-sheet-revised A2/A3: the fold rows are gone, so every row of Skills, Abilities and Traits is opened
    // instead (each opens its text), then the Movement card, a language box and the Notes sheet.
    for (const name of ['Skills', 'Abilities', 'Traits']) {
      const region = screen.getByRole('region', { name });
      for (const row of within(region).getAllByRole('button')) {
        await user.click(row);
        await closeTop(user);
      }
    }
    for (const box of [...document.querySelectorAll<HTMLElement>('.sheet__box')]) {
      if (box.tagName !== 'BUTTON') continue;
      await user.click(box);
      await closeTop(user);
    }
    await user.click(within(screen.getByRole('region', { name: 'Notes' })).getByRole('button', { name: 'Notes' }));
    await closeTop(user);
    expect([...watching.found]).toEqual([]);
  });

  it('heads with the identity line, then the tiles, Scores and Saves open, the rest as fold rows', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openSheet(user);
    // The identity line, in the pack's words; the name heads the page for a screen reader.
    expect(document.querySelector('.sheet__identity')?.textContent).toBe('Lamplighter, Lantern Warden 1, Bog folk');
    expect(screen.getByRole('heading', { level: 1, name: 'Wren' })).toBeTruthy();
    // Plan m5b-sheet-revised A1/A3: the Combat block and its figure tiles are gone. The left column holds the HP box,
    // then two captioned tiles, AC and Attack, each opening its breakdown; Level is a row with its experience.
    const vitals = within(document.querySelector('.sheet__vitals') as HTMLElement);
    const tiles = vitals.getAllByRole('button').filter((b) => b.classList.contains('stat-tile'));
    expect(tiles.map((t) => t.getAttribute('aria-label')?.split(' ')[0])).toEqual(['Armour', expect.any(String)]);
    for (const tile of tiles) expect(tile.getAttribute('aria-label')).toMatch(/: how it's worked out$/);
    await user.click(tiles[0]!);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(within(screen.getByRole('region', { name: 'Level' })).getByRole('button', { name: /^Level 1:/ }).textContent).toContain('120 of 1,500 experience');
    // Hit points are the Player screen's box, in the left column, not a tile (the die a level is gone).
    expect(vitals.getByRole('button', { name: /^Hit points 6 of 9/ })).toBeTruthy();
    // Scores: six tiles, the full name (gate finding F8, 2026-11-10; never the short name), the score, the modifier
    // under it; never folded.
    const scores = screen.getByRole('region', { name: 'Scores' });
    const scoreTiles = [...scores.querySelectorAll('.score-row > .stat-tile')];
    expect(scoreTiles.map((t) => t.querySelector('.stat-tile__label')?.textContent)).toEqual(['Muscle', 'Nimbleness', 'Grit', 'Wit', 'Lore', 'Charm']);
    // Under each score its modifier always shows, "+0" for a score that changes nothing (tfr-3, row C11, page M1;
    // changed on Francis's yes, 19 Nov 2026).
    expect(scoreTiles.every((t) => /^[+−]\d+$/.test(t.querySelector('.stat-tile__caption')?.textContent ?? ''))).toBe(true);
    expect(within(scores).queryByRole('button', { expanded: false })).toBeNull();
    // Saves: the Player screen's tiles, never folded.
    const saves = screen.getByRole('region', { name: 'Saves' });
    expect(saves.querySelectorAll('.save-tiles > .stat-tile').length).toBeGreaterThan(0);
    // Each save tile shows a word, the pack's short name or the name's first word, never a bare key like "D" (F8).
    for (const tile of saves.querySelectorAll('.save-tiles > .stat-tile')) expect(tile.querySelector('.stat-tile__label')?.textContent).not.toMatch(/^[A-Z]{1,2}$/);
    expect(within(saves).queryByRole('button', { expanded: false })).toBeNull();
    // The rest are plain open sections, never folds (plan m5b-sheet-revised A3: the fold rows are gone).
    for (const name of ['Movement', 'Skills', 'Traits', 'Languages']) {
      const region = screen.getByRole('region', { name });
      expect(region.querySelector('details'), name).toBeNull();
      expect(region.querySelector('.sheet__label')?.textContent, name).toBe(name);
    }
    expect(document.querySelector('.sheet details.creation-fold')).toBeNull();
    const languages = screen.getByRole('region', { name: 'Languages' });
    expect([...languages.querySelectorAll('.sheet__box')].map((b) => b.textContent)).toEqual(['Fen common', 'Heron-tongue']);
  });

  it('a score tile opens its breakdown sheet under the full name', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openSheet(user);
    const muscle = within(screen.getByRole('region', { name: 'Scores' })).getByRole('button', { name: /^Muscle 13, [+−]\d+ \S.*: where it comes from$/ });
    expect(muscle.querySelector('.stat-tile__caption')?.textContent).toMatch(/^[+−]\d+$/);
    const sheet = within(await opensSheet(user, muscle, 'Muscle'));
    expect(sheet.getByText('13', { selector: '.dialog__figure' })).toBeTruthy();
    expect(sheet.getByText('Lifting, hitting and holding a line.')).toBeTruthy();
    // Under "Modifiers" (sv-2a), each thing the score changes, one line each, with what it gives ("Melee: +1.").
    const modifiers = within(sheet.getByRole('region', { name: 'Modifiers' }));
    // Muscle 13 is in the fixture's 12–14 row: +1 to melee.
    expect(modifiers.getByText('Melee: +1.', { selector: 'p.reading' })).toBeTruthy();
    await closeTop(user);
    // The AC tile's breakdown is a Sheet too, in the book's format, ending with Got it (tfb-1, tfb-2).
    const ac = within(await opensSheet(user, screen.getByRole('button', { name: /^Armour class .*: how it's worked out$/ }), 'Armour class'));
    expect(ac.getByRole('button', { name: 'Got it' })).toBeTruthy();
  });

  it('the foot reads Up to date, with Back and Edit, neither the accent', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openSheet(user);
    const foot = document.querySelector('.sheet__foot') as HTMLElement;
    expect(within(foot).getByRole('status').textContent).toBe('Up to date');
    const edit = within(foot).getByRole('button', { name: 'Edit' });
    const back = within(foot).getByRole('button', { name: 'Back' });
    expect(foot.querySelector('.button-primary')).toBeNull();
    // Edit is the foot's alone, not also in the bar.
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
    await user.click(edit);
    expect(await screen.findByRole('form', { name: 'Edit Wren' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(within(document.querySelector('.sheet__foot') as HTMLElement).getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('region', { name: 'Vitals' })).toBeTruthy();
    expect(back).toBeTruthy();
  });

  it('offline, the foot reads "Offline. Saved on this device" with the sign', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openSheet(user);
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    try {
      window.dispatchEvent(new Event('offline'));
      const status = await within(document.querySelector('.sheet__foot') as HTMLElement).findByText('Offline. Saved on this device');
      expect(status.closest('.warning-line')).not.toBeNull();
      expect(status.closest('.warning-line')?.querySelector('.warning-sign')).not.toBeNull();
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
      window.dispatchEvent(new Event('online'));
    }
  });
});

describe("the class's line on its skills, at the top of Skills (R3-13, G-210)", () => {
  /** Wren as a Mire Stalker, the class's skills given these extra fields (a copy: the shared fixture stays as it is). */
  function stalker(extra: Record<string, unknown>) {
    const { wren } = fenWorld();
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { classes: [{ classRef: 'mire-stalker', level: 1, xp: 0 }] });
    const row = world.tables.library_entries.find((e) => e.kind === 'class' && e.pack_entry_id === 'mire-stalker')!;
    const data = structuredClone(row.data) as { skills: Record<string, unknown> };
    Object.assign(data.skills, extra);
    row.data = data;
  }

  it("the full sheet's Skills starts with the class's skills.note, muted", async () => {
    // Purpose: the class-wide line shows once, at the top of the list, in the muted style, on the full sheet too.
    stalker({ note: 'Mire stalkers learn these as children.' });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openSheet(user);
    const skills = screen.getByRole('region', { name: 'Skills' });
    const line = within(skills).getByText('Mire stalkers learn these as children.');
    expect(line.classList.contains('auth__meta')).toBe(true);
    const firstRow = within(skills).getAllByRole('button', { name: /: where it comes from$/ })[0]!;
    expect(line.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('with no class line, Skills has no muted line', async () => {
    // Purpose: nothing is drawn when the pack has no class-wide line (and a skills.notes map is not one).
    stalker({ notes: { EAR: 'Catching the faint splash of something wading.' } });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openSheet(user);
    const skills = screen.getByRole('region', { name: 'Skills' });
    expect(within(skills).getAllByRole('button', { name: /: where it comes from$/ }).length).toBeGreaterThan(0);
    expect(skills.querySelector('.auth__meta')).toBeNull();
  });
});

// Row C11 of the test feedback of 19 Nov 2026 (tfr-3; page M1, frame M1g), on the full sheet's own page. Purposes:
//   A setting with no modifier table shows no line under a score, and the tile is heard as its name and score alone.
//   A negative modifier reads with its minus sign under the score ("−3") and is heard with its column's words.
describe('a score’s modifier on the full sheet (C11)', () => {
  /** The fixture's rules sets, each changed by `change` (a copy: the shared fixture is left alone). */
  function rulesWith(change: (data: Record<string, unknown>) => Record<string, unknown>) {
    for (const e of world.tables.library_entries) if (e.kind === 'rulesSet') e.data = change(structuredClone(e.data as Record<string, unknown>));
  }

  it('shows no line under a score when the setting has no modifier table', async () => {
    fenWorld();
    rulesWith((data) => ({ ...data, abilityModifiers: {} }));
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openSheet(user);
    const scores = within(screen.getByRole('region', { name: 'Scores' }));
    const lore = scores.getByRole('button', { name: /^Lore 9/ });
    expect(lore.querySelector('.stat-tile__caption')).toBeNull();
    expect(lore.getAttribute('aria-label')).toBe('Lore 9: where it comes from');
  });

  it('shows a negative modifier with its minus sign, heard with its column’s words', async () => {
    const { wren } = fenWorld();
    rulesWith((data) => {
      const mods = data.abilityModifiers as Record<string, Record<string, unknown>[]>;
      return { ...data, abilityModifiers: { ...mods, MUS: [{ range: '2-4', melee: -3 }, ...mods.MUS!.slice(1)] } };
    });
    const actor = world.tables.actors.find((a) => a.id === wren)!;
    actor.fields = { ...(actor.fields as Record<string, unknown>), MUS: 3 };
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await openSheet(user);
    const muscle = within(screen.getByRole('region', { name: 'Scores' })).getByRole('button', { name: /^Muscle 3/ });
    expect(muscle.querySelector('.stat-tile__caption')?.textContent).toBe('−3');
    expect(muscle.getAttribute('aria-label')).toBe('Muscle 3, −3 melee: where it comes from');
  });
});
