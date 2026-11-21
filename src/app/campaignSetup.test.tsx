// @vitest-environment jsdom
// A new campaign's steps 2 and 3 on the creation step shell (docs/05 "Creating a campaign"; ruling lr-5, lr-6,
// 2026-11-02; plan m5b-0d build order 3). Invented packs only. What it checks:
//   * step 2 groups the library's packs by kind with chips; the ✓ slot picks; one kind only shows no chips;
//   * a row opens the pack's Browse with Pick at its foot, and Pick there picks it;
//   * an adventure whose base isn't picked stops Next with the words; picking the base says "needs <pack> ✓" and goes on;
//   * step 3 has one folded group per source with its count line; a pack with no optional rules says "none" and opens nothing;
//   * open, every rule shows (no Show all), changed first; toggling one leaves every row in place and says "changed"
//     at once, the order re-sorts when folded and opened again (tf-2, tf-5); a long multi-choice rule is a ▾ button
//     with "1 of N" opening a sheet (tf-3);
//   * two packs with the same ruleKey give one card with every pack's choices under its name, and no second row
//     ("Decided above"); one tap there is the campaign's answer, stored on Create, and Reset clears it (tf-1);
//   * the step opens with the App section, folded, with the Rules tab's rows; a change there is stored on Create (tf-7);
//   * Reset to the books' defaults, then Undo, puts the changes back;
//   * a pack option that moves the load method (with an overlay's choice joined to it, of-1) is the one switch for how
//     load is carried: no app Encumbrance row beside it, and its choice is the campaign's (gate check 4); a pack that
//     gives load data but no option moving it keeps the app's row;
//   * each step has one accent (Next, then Create campaign); the empty library says so.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let gm: string;

beforeEach(() => {
  world = createFakeDb();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  gm = world.addPerson('priya@lantern.example', 'Priya');
  world.signInAs(gm);
});

afterEach(() => cleanup());

type Kind = 'setting' | 'adventure' | 'homebrew';
let made = 0;
/** One pack in Priya's library with its options (and an item, so Browse has something). */
function addPack(name: string, kind: Kind, meta: Record<string, unknown>, options: Record<string, unknown>[] = []) {
  const id = `pack-${++made}`;
  world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '0.1', kind, format_version: 2, source: '', notes: '', extra_meta: meta, updated_at: '2026-10-20T12:00:00Z' });
  world.tables.library_entries.push({ id: `${id}-item`, pack_id: id, kind: 'item', pack_entry_id: 'reed-lamp', name: 'Reed lamp', data: { id: 'reed-lamp', name: 'Reed lamp' } });
  for (const option of options) {
    world.tables.library_entries.push({ id: `${id}-${String(option.id)}`, pack_id: id, kind: 'option', pack_entry_id: String(option.id), name: String(option.name), data: option });
  }
  return id;
}

const onOff = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  default: 'off',
  changeLater: 'allow',
  choices: [
    { id: 'on', name: 'On' },
    { id: 'off', name: 'Off' },
  ],
  ...extra,
});

function fenRules() {
  return addPack('Fen Rules, Advanced', 'setting', { id: 'fen-rules', shortName: 'Fen Rules', description: 'The complete rules for a fen campaign.' }, [
    onOff('reroll-hp', 'Re-roll low hit points', { notes: 'A very low first roll may be rolled again.', source: 'p. 14' }),
    onOff('weapon-skills', 'Weapon skills', { changeLater: 'warn', source: 'p. 31' }),
    {
      id: 'creation-path',
      name: 'Creation method',
      default: 'basic',
      changeLater: 'never',
      source: 'p. 12',
      choices: [
        { id: 'basic', name: 'Basic' },
        { id: 'advanced', name: 'Advanced' },
        { id: 'either', name: 'Each player chooses' },
      ],
    },
    {
      id: 'fen-load',
      name: 'Item load',
      default: 'weight',
      ruleKey: 'item-load',
      choices: [
        { id: 'weight', name: 'By weight' },
        { id: 'count', name: 'By count' },
      ],
    },
  ]);
}

async function toPacksStep() {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: '+ Start a new campaign (as GM)' }));
  await user.type(screen.getByLabelText('Campaign name'), 'The Lantern Road');
  await user.click(screen.getByRole('button', { name: 'Next: setting rules' }));
  await screen.findByRole('heading', { name: 'Setting rules' });
  return user;
}

const accents = () => document.querySelectorAll('.button-primary').length;

describe('set-up step 2: setting rules on the shell', () => {
  it('groups the packs by kind with chips, the ✓ slot picks, and Next is the one accent', async () => {
    fenRules();
    addPack('The Drowned Abbey', 'adventure', { id: 'abbey', requires: [{ packId: 'fen-rules' }] });
    const user = await toPacksStep();
    expect(screen.getByRole('heading', { name: 'Setting rules: 1, pick one; a second one adds to it' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Adventures: 1, any number' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All: 2' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Adventures: 1' }));
    expect(screen.queryByRole('heading', { name: /^Setting rules: 1/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'All: 2' }));

    const tick = screen.getByRole('checkbox', { name: 'Pick Fen Rules, Advanced' });
    await user.click(tick);
    expect(tick.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('1 picked');
    expect(accents()).toBe(1);
    expect(screen.getByRole('button', { name: 'Next' }).className).toContain('button-primary');
  });

  it('with one kind only there are no chips; an empty library says so', async () => {
    fenRules();
    await toPacksStep();
    expect(screen.queryByRole('button', { name: /^All ·/ })).toBeNull();
    cleanup();
    world.tables.packs.length = 0;
    await toPacksStep();
    expect(screen.getByText(/Nothing in your library yet/)).toBeTruthy();
  });

  it("a row opens the pack's Browse, and Pick at its foot picks it", async () => {
    fenRules();
    const user = await toPacksStep();
    await user.click(screen.getByRole('button', { name: /^Fen Rules, Advanced/ }));
    const browse = within(await screen.findByRole('dialog', { name: 'Fen Rules, Advanced' }));
    expect(await browse.findByText('Reed lamp')).toBeTruthy();
    await user.click(browse.getByRole('button', { name: 'Pick Fen Rules, Advanced' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Pick Fen Rules, Advanced' }).getAttribute('aria-checked')).toBe('true');
  });

  it("an adventure whose base isn't picked stops Next with the words; picking the base goes on", async () => {
    fenRules();
    addPack('The Drowned Abbey', 'adventure', { id: 'abbey', requires: [{ packId: 'fen-rules' }] });
    const user = await toPacksStep();
    await user.click(screen.getByRole('checkbox', { name: 'Pick The Drowned Abbey' }));
    const words = 'The Drowned Abbey needs Fen Rules, Advanced, pick it, or leave it out.';
    expect(screen.getByText('Needs: Fen Rules, Advanced.')).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe(words);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findAllByText(words)).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Setting rules' })).toBeTruthy();

    await user.click(screen.getByRole('checkbox', { name: 'Pick Fen Rules, Advanced' }));
    expect(screen.getByText('needs Fen Rules, Advanced ✓')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('heading', { name: 'Optional rules' })).toBeTruthy();
  });
});

describe('set-up step 3: optional rules by source', () => {
  async function toRulesStep(...names: string[]) {
    const user = await toPacksStep();
    for (const name of names) await user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Optional rules' });
    return user;
  }

  it('one folded group per source with its count; a pack without rules says "none"; Create campaign is the one accent', async () => {
    fenRules();
    addPack('Valley Town', 'adventure', { id: 'valley' });
    const user = await toRulesStep('Fen Rules, Advanced', 'Valley Town');
    expect(screen.getByRole('button', { name: /Fen Rules, Advanced, 4 rules, none changed/, expanded: true })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Valley Town, none' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Valley Town/ })).toBeNull();
    expect(accents()).toBe(1);
    expect(screen.getByRole('button', { name: 'Create campaign' }).className).toContain('button-primary');
    await user.click(screen.getByRole('button', { name: /Fen Rules, Advanced, 4 rules/ }));
    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull();
  });

  // Rules keep their place while you work (tf-2) and every rule shows when open (tf-5); "changed" shows at once.
  it('every rule shows, no Show all; toggling one moves no row and says changed at once; folded and reopened, changed come first', async () => {
    fenRules();
    const user = await toRulesStep('Fen Rules, Advanced');
    const order = () => [...document.querySelectorAll('.rule-group .rule-row')].map((row) => row.getAttribute('aria-label'));
    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull();
    expect(order()).toEqual(['Creation method', 'Item load', 'Re-roll low hit points', 'Weapon skills']);
    const skills = within(screen.getByRole('group', { name: 'Weapon skills' }));
    expect(skills.getByText('Fen Rules, p. 31, can change, asks first')).toBeTruthy();
    await user.click(skills.getByRole('button', { name: 'On' }));
    expect(screen.getByRole('button', { name: /4 rules, 1 changed/ })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('1 rule changed');
    expect(order()).toEqual(['Creation method', 'Item load', 'Re-roll low hit points', 'Weapon skills']);
    expect(within(screen.getByRole('group', { name: 'Weapon skills' })).getByText('changed')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Weapon skills' }).textContent).toContain('changed (the book: Off)');

    // A long multi-choice rule is the current choice with "1 of 3" and ▾, opening a sheet (tf-3).
    const method = within(screen.getByRole('group', { name: 'Creation method' }));
    expect(method.getByText("Fen Rules, p. 12, can't change once the campaign starts")).toBeTruthy();
    const button = method.getByRole('button', { name: 'Creation method: Basic, 1 of 3. Change' });
    expect(button.textContent).toBe('Basic1 of 3▾');
    await user.click(button);
    await user.click(within(screen.getByRole('dialog', { name: 'Creation method' })).getByRole('button', { name: 'Each player chooses' }));
    expect(screen.getByRole('button', { name: 'Creation method: Each player chooses, 1 of 3. Change' })).toBeTruthy();
    expect(order()).toEqual(['Creation method', 'Item load', 'Re-roll low hit points', 'Weapon skills']);
    // Folded and opened again, the changed rules come first.
    const head = screen.getByRole('button', { name: /4 rules, 2 changed/ });
    await user.click(head);
    await user.click(head);
    expect(order()).toEqual(['Creation method', 'Weapon skills', 'Item load', 'Re-roll low hit points']);
  });

  it('two packs with the same ruleKey give one callout and no second row', async () => {
    fenRules();
    addPack('Zine Compendium', 'homebrew', { id: 'zine', shortName: 'Zine', requires: [{ packId: 'fen-rules' }] }, [
      { id: 'zine-load', name: 'Item counts', default: 'counts', ruleKey: 'item-load', choices: [{ id: 'counts', name: 'Item counts' }, { id: 'weight', name: 'Weight' }] },
    ]);
    const user = await toRulesStep('Fen Rules, Advanced', 'Zine Compendium');
    const callouts = screen.getAllByRole('group', { name: 'Choice for item load' });
    expect(callouts).toHaveLength(1);
    const callout = within(callouts[0]!);
    expect(callout.getByText(/Two packs offer it; one choice counts/)).toBeTruthy();
    // Every pack's choices under its name; the homebrew sits on top, so its choice is the one ticked.
    expect(within(callout.getByRole('group', { name: 'Zine' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Zine, Item counts', 'Zine, Weight']);
    expect(within(callout.getByRole('group', { name: 'Fen Rules' })).getAllByRole('button')).toHaveLength(2);
    expect(callout.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('aria-label'))).toEqual(['Zine, Item counts']);

    const fenLoad = within(screen.getByRole('group', { name: 'Item load' }));
    expect(fenLoad.getByText('Decided above: Zine, Item counts')).toBeTruthy();
    expect(fenLoad.queryByRole('button')).toBeNull();

    // One tap on another pack's choice picks that choice and that pack.
    await user.click(callout.getByRole('button', { name: 'Fen Rules, By count' }));
    expect(callout.getByRole('button', { name: 'Fen Rules, By count' }).getAttribute('aria-pressed')).toBe('true');
    expect(callout.getByRole('button', { name: 'Zine, Item counts' }).getAttribute('aria-pressed')).toBe('false');
  });

  it("one tap in the card picks that pack for the campaign; Create stores the pick; Reset clears it", async () => {
    const fen = fenRules();
    addPack('Zine Compendium', 'homebrew', { id: 'zine', shortName: 'Zine', requires: [{ packId: 'fen-rules' }] }, [
      { id: 'zine-load', name: 'Item counts', default: 'counts', ruleKey: 'item-load', choices: [{ id: 'counts', name: 'Item counts' }, { id: 'weight', name: 'Weight' }] },
    ]);
    const user = await toRulesStep('Fen Rules, Advanced', 'Zine Compendium');
    const callout = () => within(screen.getByRole('group', { name: 'Choice for item load' }));

    await user.click(callout().getByRole('button', { name: 'Fen Rules, By count' }));
    expect(callout().getByRole('button', { name: 'Fen Rules, By count' }).getAttribute('aria-pressed')).toBe('true');
    // The Zine group waits folded; open it to see its rule.
    await user.click(screen.getByRole('button', { name: /^Zine Compendium, 1 rule/ }));
    const zineLoad = within(screen.getByRole('group', { name: 'Item counts' }));
    expect(zineLoad.getByText('Decided above: Fen Rules, By count')).toBeTruthy();

    // Reset to the books' defaults: the pick goes, the pack on top decides again.
    await user.click(screen.getByRole('button', { name: "Reset to the books' defaults" }));
    expect(await screen.findByText("Back to the books' defaults")).toBeTruthy();
    expect(callout().getByRole('button', { name: 'Zine, Item counts' }).getAttribute('aria-pressed')).toBe('true');

    // Pick again and create: the campaign keeps the pick, by pack id.
    await user.click(callout().getByRole('button', { name: 'Fen Rules, By count' }));
    await user.click(screen.getByRole('button', { name: 'Create campaign' }));
    expect(await screen.findByRole('heading', { name: 'The Lantern Road' })).toBeTruthy();
    expect((world.tables.campaigns[0]?.settings as { ruleGroups?: unknown } | undefined)?.ruleGroups).toEqual({ 'item-load': fen });
  });

  it("Reset to the books' defaults, then Undo, puts the changes back", async () => {
    fenRules();
    const user = await toRulesStep('Fen Rules, Advanced');
    await user.click(within(screen.getByRole('group', { name: 'Re-roll low hit points' })).getByRole('button', { name: 'On' }));
    await user.click(within(screen.getByRole('group', { name: 'Weapon skills' })).getByRole('button', { name: 'On' }));
    expect(screen.getByRole('button', { name: /2 changed/ })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: "Reset to the books' defaults" }));
    expect(await screen.findByText("Back to the books' defaults")).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Fen Rules, Advanced, .*none changed/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('button', { name: /2 changed/ })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Create campaign' }));
    expect(await screen.findByRole('heading', { name: 'The Lantern Road' })).toBeTruthy();
    expect(world.tables.campaign_packs[0]?.option_choices).toMatchObject({ 'reroll-hp': 'on', 'weapon-skills': 'on' });
  });

  // tf-7: the app's own rules in campaign creation, the same rows as the Rules tab, folded like a pack.
  it('opens with the App section, folded; its rows are the Rules tab\'s; a change there is stored on Create', async () => {
    fenRules();
    const user = await toRulesStep('Fen Rules, Advanced');
    const app = screen.getByRole('region', { name: "The app's rules" });
    const head = within(app).getByRole('button', { name: /^App, \d+ settings, none changed$/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    // It comes before the packs' rules.
    expect(app.compareDocumentPosition(screen.getByRole('button', { name: /^Fen Rules, Advanced/ })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(head);
    expect(within(app).getByText('New characters need approval')).toBeTruthy();
    await user.click(within(within(app).getByRole('group', { name: 'Companies' })).getByRole('button', { name: 'No' }));
    expect(within(app).getByRole('button', { name: /^App, \d+ settings, 1 changed$/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Create campaign' }));
    expect(await screen.findByRole('heading', { name: 'The Lantern Road' })).toBeTruthy();
    expect((world.tables.campaigns[0]?.settings as { companies?: unknown }).companies).toBe(false);
  });

  // Purpose (cw-3): a new campaign starts characters at level 1 unless the GM says otherwise, and "Player proposes" stays a choice.
  it('a new campaign starts characters at level 1 by default; Player proposes is still one tap away', async () => {
    fenRules();
    const user = await toRulesStep('Fen Rules, Advanced');
    const app = screen.getByRole('region', { name: "The app's rules" });
    await user.click(within(app).getByRole('button', { name: /^App, \d+ settings/ }));
    const start = within(within(app).getByRole('radiogroup', { name: 'New characters start at' }));
    expect(start.getByRole('radio', { name: /^Level 1/ }).getAttribute('aria-checked')).toBe('true');
    expect(start.getByRole('radio', { name: /^Player proposes/ }).getAttribute('aria-checked')).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Create campaign' }));
    expect(await screen.findByRole('heading', { name: 'The Lantern Road' })).toBeTruthy();
    expect((world.tables.campaigns[0]?.settings as { startLevel?: unknown }).startLevel).toBe('one');
  });

  // A1 and A8 at set-up (options-gates build order 5): an add-on shows once its parent is on and goes back with it; a
  // preset previews, applies with Undo, and is stored on Create.
  it('an add-on waits for its parent; a preset previews, applies, and Undo puts the choices back', async () => {
    const id = addPack('Fen Rules, Advanced', 'setting', { id: 'fen-rules', shortName: 'Fen Rules' }, [
      onOff('lantern-songs', 'Lantern songs', { presets: { first: 'on' } }),
      onOff('reed-chorus', 'Reed chorus', { requires: { 'lantern-songs': 'on' } }),
    ]);
    world.tables.library_entries.push({ id: `${id}-rules`, pack_id: id, kind: 'rulesSet', pack_entry_id: 'fen', name: 'Fen', data: { id: 'fen', name: 'Fen', optionPresets: [{ id: 'first', name: 'First night' }] } });
    const user = await toRulesStep('Fen Rules, Advanced');
    expect(screen.getByRole('button', { name: /Fen Rules, Advanced, 1 rule, none changed/ })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Reed chorus' })).toBeNull();

    await user.click(within(screen.getByRole('group', { name: 'Lantern songs' })).getByRole('button', { name: 'On' }));
    await user.click(within(await screen.findByRole('group', { name: 'Reed chorus' })).getByRole('button', { name: 'On' }));
    await user.click(within(screen.getByRole('group', { name: 'Lantern songs' })).getByRole('button', { name: 'Off' }));
    expect(screen.queryByRole('group', { name: 'Reed chorus' })).toBeNull();

    await user.click(within(screen.getByRole('group', { name: 'Presets' })).getByRole('button', { name: 'First night' }));
    const preview = within(await screen.findByRole('dialog', { name: 'Use First night?' }));
    expect(preview.getByText(/Off → On/)).toBeTruthy();
    await user.click(preview.getByRole('button', { name: 'Use First night' }));
    expect(await screen.findByText('First night: 1 rule changed')).toBeTruthy();
    // The add-on went back to Off with its parent, so it comes back off.
    expect(within(await screen.findByRole('group', { name: 'Reed chorus' })).getByRole('button', { name: 'Off', pressed: true })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('group', { name: 'Reed chorus' })).toBeNull();

    await user.click(within(screen.getByRole('group', { name: 'Presets' })).getByRole('button', { name: 'First night' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Use First night?' })).getByRole('button', { name: 'Use First night' }));
    await user.click(screen.getByRole('button', { name: 'Create campaign' }));
    expect(await screen.findByRole('heading', { name: 'The Lantern Road' })).toBeTruthy();
    expect(world.tables.campaign_packs[0]?.option_choices).toMatchObject({ 'lantern-songs': 'on', 'reed-chorus': 'off' });
  });
});

describe('set-up step 3: one switch for how load is carried (2026-10-24; gate check 4)', () => {
  /** Bramble Rules (a setting) with its Carrying option and coin-weight data, and the Thorn zine overlay's choice joined to it. */
  function brambleWithZine() {
    const base = addPack('Bramble Rules', 'setting', { id: 'bramble-rules', shortName: 'Bramble' }, [
      {
        id: 'carrying',
        name: 'Carrying',
        default: 'none',
        changeLater: 'warn',
        choices: [
          { id: 'none', name: 'Not tracked' },
          { id: 'coin', name: 'By coin weight' },
        ],
      },
    ]);
    world.tables.library_entries.push({
      id: `${base}-rules`,
      pack_id: base,
      kind: 'rulesSet',
      pack_entry_id: 'bramble',
      name: 'Bramble',
      data: { id: 'bramble', name: 'Bramble', encumbrance: { mode: 'none', coin: { maxLoadCoin: 700 } }, byOption: { 'carrying=coin': { encumbrance: { mode: 'coin' } } } },
    });
    addPack('Thorn Zine', 'homebrew', { id: 'thorn-zine', shortName: 'Thorn zine', requires: [{ packId: 'bramble-rules' }] }, [
      { id: 'thorn-bundles', name: 'Bundle counts', extends: 'carrying', choices: [{ id: 'bundles', name: 'Thorn bundles' }] },
    ]);
  }

  async function toRulesStep(...names: string[]) {
    const user = await toPacksStep();
    for (const name of names) await user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Optional rules' });
    return user;
  }

  // Purpose: with a base pack's Carrying option (which sets the load method) and an overlay's choice joined to it, the
  // GM sees one Carrying row with all three choices and no app Encumbrance row; the choice made is the campaign's.
  it("a pack option that moves the load method is the one switch: no app row, and its choice is the campaign's", async () => {
    brambleWithZine();
    const user = await toRulesStep('Bramble Rules', 'Thorn Zine');
    expect(screen.queryByRole('group', { name: 'Encumbrance' })).toBeNull();
    expect(screen.queryByText(/^The app, /)).toBeNull();
    const carrying = within(screen.getByRole('group', { name: 'Carrying' }));
    await user.click(carrying.getByRole('button', { name: 'Carrying: Not tracked, 1 of 3. Change' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Carrying' }));
    expect(sheet.getByRole('group', { name: 'Thorn zine' })).toBeTruthy();
    await user.click(within(sheet.getByRole('group', { name: 'Bramble' })).getByRole('button', { name: /By coin weight/ }));
    await user.click(screen.getByRole('button', { name: 'Create campaign' }));
    expect(await screen.findByRole('heading', { name: 'The Lantern Road' })).toBeTruthy();
    expect((world.tables.campaigns[0]?.settings as { encumbrance?: unknown }).encumbrance).toEqual({ mode: 'coin' });
  });

  // Purpose: a pack that gives load data but has no option moving the method keeps the app's own Encumbrance row.
  it('a pack with load data and no option moving it keeps the app row', async () => {
    const id = addPack('Moss Rules', 'setting', { id: 'moss-rules' }, [onOff('moss-songs', 'Moss songs')]);
    world.tables.library_entries.push({ id: `${id}-rules`, pack_id: id, kind: 'rulesSet', pack_entry_id: 'moss', name: 'Moss', data: { id: 'moss', name: 'Moss', encumbrance: { coin: { maxLoadCoin: 700 } } } });
    await toRulesStep('Moss Rules');
    const row = within(screen.getByRole('group', { name: 'Encumbrance' }));
    expect(row.getByText(/^The app, /)).toBeTruthy();
    expect(row.getByRole('button', { name: /Coin weight/ })).toBeTruthy();
  });
});
