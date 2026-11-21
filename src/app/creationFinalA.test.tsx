// @vitest-environment jsdom
// No middle dot in creation (plan m5b-creation-final-drafts A9; ruled 2026-11-07: creation only, the rest of the app is
// a later pull request). On the invented fixture pack scripts/fixtures/m5b-creation.fixture.json. Purpose:
//   No creation screen draws "‹", "›" or " · ": the steps, their status lines, their sheets and toasts, the review,
//   and the GM's approval card. A count uses a colon ("9 items: leather, spear"), figures read as a sentence, and a
//   line's parts take commas or a second line.
//   On a tablet (A10) Class shows the entry beside the list at 820 px and as a sheet at 375; Scores has one column.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { readKept } from './keptCreation.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
type User = ReturnType<typeof userEvent.setup>;

// Everything creation draws: its steps (data-creation), any pop-up or toast while one is open, and the GM's card.
const CREATION = '[data-creation], [role="dialog"], .toast, .gm__approval';
const found = new Set<string>();
let watching: MutationObserver | null = null;

/** Every text in creation holding a middle dot or an angle quote, read after each change to the page. */
function scan() {
  const creationOpen = document.querySelector('[data-creation], .gm__approval') !== null;
  if (!creationOpen) return;
  for (const region of document.querySelectorAll(CREATION)) {
    const text = region.textContent ?? '';
    if (!/ · |[‹›]/.test(text)) continue;
    const walker = document.createTreeWalker(region, NodeFilter.SHOW_ELEMENT);
    // The innermost element whose own text has it: that's the string to fix.
    for (let el = walker.currentNode as Element | null; el; el = walker.nextNode() as Element | null) {
      const own = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('');
      const whole = el.textContent ?? '';
      if (/ · |[‹›]/.test(whole) && ![...el.children].some((c) => / · |[‹›]/.test(c.textContent ?? ''))) found.add(`${el.className}|${el.parentElement?.className}|${whole.trim()}`);
      else if (/ · |[‹›]/.test(own)) found.add(`${el.className}|${el.parentElement?.className}|${whole.trim()}`);
    }
  }
}

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  found.clear();
  watching = new MutationObserver(scan);
  watching.observe(document.body, { subtree: true, childList: true, characterData: true });
});

afterEach(() => {
  watching?.disconnect();
  cleanup();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; from?: string };

/** The fixture on a campaign (as creationReview.test.tsx sets it up). */
function fenWorld() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
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
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => f.key !== 'omen');
  layout.forEach((f, order) => {
    const fromList = f.key === 'background' ? 'fen-backgrounds-bog-folk' : null;
    const type = f.type === 'list' && !f.choices?.length && !fromList ? 'text' : f.type;
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: fromList, created_at: '2026-10-18T12:00:00Z' });
  });
  world.signInAs(me);
  return { gm, me, campaign };
}

const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';

/** Opens Help me choose where there is one, then folds it again. */
async function help(user: User) {
  const button = screen.queryByRole('button', { name: 'Help me choose' });
  if (!button) return;
  await user.click(button);
  await user.click(screen.getByRole('button', { name: 'Close help' }));
}

/** Opens the first entry on a pick step (its name) and closes it. */
async function anEntry(user: User) {
  const name = document.querySelector('.pick-row__body:not([tabindex="-1"])') as HTMLElement | null;
  if (!name) return;
  await user.click(name);
  const close = screen.queryAllByRole('button', { name: 'Close' }).at(-1);
  if (close) await user.click(close);
}

/** Every step from Guided to the review: each step's help and an entry opened, the dull answer picked, Next. */
async function walk(user: User, klass: string): Promise<string[]> {
  const titles: string[] = [];
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { level: 1 });
  for (let guard = 0; guard < 30; guard += 1) {
    if (screen.queryByRole('button', { name: 'Send to the GM' })) return titles;
    const title = heading();
    titles.push(title);
    await help(user);
    if (title.startsWith('How do you want')) await user.click(screen.getAllByRole('checkbox', { name: /^Pick / })[0]!);
    else if (title === 'Kindred') {
      await anEntry(user);
      await user.click(screen.getByRole('checkbox', { name: 'Pick Bog folk' }));
      await screen.findByRole('heading', { name: 'Class' });
      continue;
    } else if (title === 'Class') {
      await anEntry(user);
      await user.click(screen.getByRole('checkbox', { name: `Pick ${klass}` }));
    } else if (title === 'Who they are') {
      await user.type(screen.getByLabelText('Name'), 'Tam');
      const hp = screen.queryByRole('textbox', { name: 'Hit points' });
      if (hp) await user.type(hp, '5');
      const reed = screen.queryByRole('checkbox', { name: 'Pick Reed' });
      if (reed) await user.click(reed);
      const open = screen.queryAllByRole('button', { name: /^Open / })[0];
      if (open) {
        await user.click(open);
        const row = within(screen.getByRole('dialog')).queryAllByRole('checkbox')[0];
        if (row) await user.click(row);
        await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Done' }));
      }
    } else if (title === 'Gear') {
      const kit = screen.queryAllByRole('checkbox', { name: /^Pick .*kit/ })[0];
      if (kit) await user.click(kit);
      // A kit with rolls opens its Roll sequence: tap the first row of each step.
      for (let n = 0; n < 8 && screen.queryByRole('dialog'); n += 1) {
        const dialog = within(screen.getByRole('dialog'));
        const first = dialog.queryAllByRole('radio')[0] ?? dialog.queryAllByRole('checkbox')[0];
        if (first) await user.click(first);
        await user.click(dialog.getByRole('button', { name: /^(Next|Done)$/ }));
      }
    } else {
      // Any other step: the first open pick, if it asks one.
      const first = screen.queryAllByRole('checkbox', { name: /^Pick / }).find((b) => b.getAttribute('aria-checked') === 'false');
      if (first) await user.click(first);
    }
    const was = title;
    await user.click(screen.getByRole('button', { name: /^(Next|Done)$/ }));
    // On, or Next said what it needs (the status line, or a toast).
    await waitFor(() => expect(heading() !== was || !!screen.queryByRole('button', { name: 'Send to the GM' }) || !!document.querySelector('[role="status"][aria-label="Step status"] .warning-sign') || !!document.querySelector('.toast')).toBe(true)).catch(() => {
      throw new Error(`Stuck on ${was}: ${screen.queryByRole('status', { name: 'Step status' })?.textContent ?? ''}`);
    });
    if (heading() === was) {
      // Next said what it needs: Decide later where it's offered, else this walk can't go on.
      const later = screen.queryByRole('button', { name: /Decide later|Skip/ });
      if (!later) throw new Error(`Stuck on ${was}: ${screen.getByRole('status', { name: 'Step status' }).textContent}`);
      await user.click(later);
    }
  }
  throw new Error(`Never reached the review: ${titles.join(', ')}`);
}

describe('no middle dot in creation (A9)', () => {
  it('a whole walk to the review, the warden, draws none', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await walk(user, 'Lantern Warden');
    await user.click(screen.getByRole('button', { name: 'Send to the GM' }));
    await waitFor(() => expect(world.tables.actors.find((a) => a.name === 'Tam')?.approval).toBe('pending'));
    expect([...found]).toEqual([]);
  });

  it('a whole walk to the review, the witch (magic), draws none', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    const titles = await walk(user, 'Reed Witch');
    // The magic step is walked too.
    expect(titles).toContain('First spells');
    expect([...found]).toEqual([]);
  });

  it('the GM’s approval card draws none', async () => {
    const { gm } = fenWorld();
    let user = userEvent.setup();
    render(<Root db={world.db} />);
    await walk(user, 'Lantern Warden');
    await user.click(screen.getByRole('button', { name: 'Send to the GM' }));
    await waitFor(() => expect(world.tables.actors.find((a) => a.name === 'Tam')?.approval).toBe('pending'));
    cleanup();
    found.clear();
    world.signInAs(gm);
    user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
    await screen.findByText('New character waiting: Tam');
    expect([...found]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Tablets (final drafts A10): two columns only where the second has a job.

/** A window `width` px wide: min-width and max-width queries answered for it (jsdom has no layout). */
function windowOf(width: number) {
  const matches = (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
  };
  window.matchMedia = ((query: string) => ({ matches: matches(query), media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
}

/** Guided creation to the Class step, the Kindred picked. */
async function toClass(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await user.click(await screen.findByRole('checkbox', { name: 'Pick Kindred, then calling' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('heading', { name: 'Scores' });
  // Scores: one column, no side column.
  expect(document.querySelector('.creation-step--split')).toBeNull();
  expect(document.querySelector('.creation-step__side')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(await screen.findByRole('checkbox', { name: 'Pick Bog folk' }));
  await screen.findByRole('heading', { name: 'Class' });
}

describe('creation on a tablet (A10)', () => {
  const had = window.matchMedia;
  afterEach(() => {
    window.matchMedia = had;
  });

  // Purpose: at 820 px Class shows the entry beside the list (no sheet); Scores has no side column.
  it('at 820, Class opens the entry beside the list and Scores has one column', async () => {
    windowOf(820);
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toClass(user);
    await user.click(screen.getByRole('button', { name: /^Lantern Warden/ }));
    const side = document.querySelector('.creation-step__side') as HTMLElement;
    expect(side).not.toBeNull();
    expect(side.textContent).toContain('Lantern Warden');
    expect(screen.queryByRole('dialog')).toBeNull();
    // Beside the list the entry's Pick is plain: Next is the screen's one accent (R3-9).
    expect([...document.querySelectorAll('.button-primary')].map((b) => b.textContent)).toEqual(['Next']);
  });

  // Purpose: at 375 px the same tap opens the entry as a sheet.
  it('at 375, Class opens the entry as a sheet', async () => {
    windowOf(375);
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toClass(user);
    await user.click(screen.getByRole('button', { name: /^Lantern Warden/ }));
    expect(document.querySelector('.creation-step__side')).toBeNull();
    expect(screen.getByRole('dialog').classList.contains('dialog--sheet')).toBe(true);
  });

  // Purpose: the stylesheet's tablet rules (retest 2, 2026-11-07): only a split step (Race, Class) has two columns
  // from 700 px; the review's cards are one under another at every width; one column filling the screen.
  it('the stylesheet splits only Race and Class at 700 px and keeps the review one column', async () => {
    const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
    const css = fs.readFileSync('./src/ui/creation.css', 'utf8');
    expect(css).toMatch(/@media \(min-width: 700px\) \{\s*\.creation-step--split \.creation-step__main \{\s*grid-template-columns: 2fr 3fr;/);
    expect(css).not.toMatch(/\.creation-review \{\s*grid-template-columns: repeat\(2/);
    // The column grows with the screen (Design on #555): no cap on the step, four tiles across past 1000 px, and only
    // running text keeps the reading measure.
    expect(css).not.toMatch(/\.creation-step \{[^}]*max-width/);
    expect(css).toMatch(/@media \(min-width: 1000px\) \{\s*\.score-tiles \{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
    expect(css).toMatch(/\.creation-step \.guided-instruction,[^{]*\{\s*max-inline-size: var\(--reading-width\);/);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// One bar in creation (final draft 9, 2026-11-07).

/** Guided creation opened, on its first step (How to build). */
async function toGuided(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { level: 1 });
}

const moreSheet = () => within(screen.getByRole('dialog', { name: 'More' }));

describe('one bar in creation (final draft 9)', () => {
  // Purpose (creation follow-up, 2026-11-07): the app's top row hides while a creation step is on screen at every
  // width where it shows, not only on a phone (an iPad upright showed both bars).
  it('the stylesheet hides the app’s row at every width while creation is open', async () => {
    const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
    const css = fs.readFileSync('./src/ui/creation.css', 'utf8');
    expect(css).toMatch(/^body:has\(\.creation-step__bar--app\) \.top-row \{\s*display: none;/m);
    expect(css).not.toMatch(/@media \(max-width: 699px\) \{\s*body:has\(\.creation-step__bar--app\) \.top-row/);
  });

  // Purpose: creation's ⋯ opens as a sheet with the app's menu first (the campaign's items, This device, the
  // account's), then the one exit last; Leave before anything is kept, Save and leave once something is, never both.
  it('⋯ is a sheet: the app’s menu, then Leave, which becomes Save and leave once a pick is kept', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toGuided(user);
    await user.click(within(document.querySelector('.creation-step__bar--app') as HTMLElement).getByRole('button', { name: 'More' }));
    const items = moreSheet()
      .getAllByRole('button')
      .filter((b) => b.classList.contains('more-menu__item'))
      .map((b) => b.textContent);
    expect(items.slice(0, 2)).toEqual(['Your characters', 'Setting rules']);
    expect(items.at(-1)).toBe('Leave');
    expect(items.filter((t) => /leave/i.test(t ?? ''))).toEqual(['Leave']);
    // This device's settings are in it, between the campaign's items and the exit.
    expect(moreSheet().getByText('This device')).toBeTruthy();
    await user.click(moreSheet().getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('checkbox', { name: 'Pick Kindred, then calling' }));
    await user.click(screen.getByRole('button', { name: 'More' }));
    const exits = moreSheet()
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((t) => /leave/i.test(t));
    expect(exits).toEqual(['Save and leaveYour picks are kept on this device']);
  });

  // Purpose: leaving creation through an item of the app's menu (Setting rules) keeps the picks first, through the
  // same path as Save and leave, and opens that screen.
  it('Setting rules from ⋯ keeps the picks, then opens Setting rules', async () => {
    const { me, campaign } = fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toGuided(user);
    await user.click(screen.getByRole('checkbox', { name: 'Pick Kindred, then calling' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Scores' });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Pick Bog folk' }));
    await screen.findByRole('heading', { name: 'Class' });
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(moreSheet().getByRole('button', { name: 'Setting rules' }));
    expect(await screen.findByRole('heading', { name: 'Setting rules' })).toBeTruthy();
    expect(document.querySelector('[data-creation]')).toBeNull();
    expect(readKept(me, campaign)).toMatchObject({ step: 'class', race: { name: 'Bog folk' } });
    expect((await screen.findAllByText('Kept on this device. Pick it up again from Create.')).length).toBeGreaterThan(0);
  });

  // Purpose: Theme and text size change on the spot: the sheet stays open and creation stays on screen.
  it('a device setting leaves the sheet and creation open', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toGuided(user);
    await user.click(screen.getByRole('button', { name: 'More' }));
    const pressed = moreSheet()
      .getAllByRole('button')
      .find((b) => b.hasAttribute('aria-pressed') && b.getAttribute('aria-pressed') === 'false')!;
    await user.click(pressed);
    expect(screen.getByRole('dialog', { name: 'More' })).toBeTruthy();
    expect(document.querySelector('[data-creation]')).not.toBeNull();
  });
});
