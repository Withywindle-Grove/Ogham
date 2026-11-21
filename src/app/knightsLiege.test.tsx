// @vitest-environment jsdom
// The knight's liege (creation survey PR 6; cs-3, G-86, G-89; design/rulings/m5b-0c-creation-survey-2026-11-03.md), on a
// copy of the invented fixture pack (scripts/fixtures/m5b-creation.fixture.json) with a warden's oath sworn to a lodge
// (a field `from` a shared table whose rows carry an alignment, `forClasses: ["lantern-warden"]`) and a stone-kin-only
// field (`forRaces`). Every name and number is invented.
//   A field for some classes only is asked of those classes only; one for some kindreds only, of those kindreds.
//   A field fed by a table opens the table on Who they are; the row tapped is saved as the field's words.
//   A row carrying an alignment sets the character's: the alignment group then offers only it, with a line saying why,
//   and the toast's Undo puts both back.
//   A class change hides the field but keeps its value saved.
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
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; forClasses?: string[]; forRaces?: string[]; from?: string; help?: string; alsoFills?: string };
const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
const template = pack.fieldTemplates![0]!;
// The patched copy: the oath (wardens only, from the lodges' table) and the reed mark (stone kin only).
const OATH: LayoutField = { key: 'oath', label: 'Oath', type: 'text', group: 'Who they are', forClasses: ['lantern-warden'], from: 'fen-lodges', help: 'The lodge your warden is sworn to: roll or choose. Your leaning is the lodge’s.' };
const MARK: LayoutField = { key: 'reedMark', label: 'Reed mark', type: 'text', group: 'Who they are', forRaces: ['stone-kin'] };
const layoutFieldsOld = [...(template.fields as LayoutField[]), OATH, MARK];
const LODGES = {
  id: 'fen-lodges',
  name: 'Warden lodges',
  die: 'd4',
  gmOnly: false,
  description: 'The lodge a warden is sworn to; roll or choose.',
  rows: [
    { min: 1, max: 1, result: 'The Lantern Court (Lantern)', alignment: 'Lantern' },
    { min: 2, max: 2, result: 'The Reed Moot (Reed)', alignment: 'Reed' },
    { min: 3, max: 4, result: 'The Drowned Hall (Mire)', alignment: 'Mire' },
  ],
};

/**
 * The rework's copy (cw-5, cw-12): each lodge row carries its plain `name`, the oath `alsoFills` an Allegiance field
 * (as the knight's liege fills the affiliation).
 */
const ALLEGIANCE: LayoutField = { key: 'allegiance', label: 'Allegiance', type: 'text', group: 'Who they are' };
const reworkLayout = [...(template.fields as LayoutField[]), { ...OATH, alsoFills: 'allegiance' }, MARK, ALLEGIANCE];
const NAMED_LODGES = { ...LODGES, rows: LODGES.rows.map((r) => ({ ...r, name: r.result.replace(/ \(.*\)$/, ''), note: `Sworn to the ${r.alignment.toLowerCase()} since the first flood.` })) };

/** The patched setting attached to a campaign whose fields came from its sheet layout; `rework` uses the rework's copy. */
function fenWorld({ rework = false }: { rework?: boolean } = {}) {
  const layoutFields = rework ? reworkLayout : layoutFieldsOld;
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  for (const h of pack.hooks!) entry('hook', h);
  entry('fieldTemplate', { ...template, fields: layoutFields });
  entry('table', rework ? NAMED_LODGES : LODGES);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const asked = layoutFields.filter((f) => !['background', 'languages', 'hp', 'omen'].includes(f.key));
  asked.forEach((f, order) =>
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type: f.type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, created_at: '2026-10-18T12:00:00Z' }),
  );
  world.signInAs(me);
  return { campaign, me };
}

function openApp(): User {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  return user;
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const leaningGroup = () => screen.getByRole('group', { name: 'Leaning' });

/** Scores, Kindred, Class and Adjust scores, to "Who they are". */
async function toWho(user: User, { race = 'Bog folk', klass = 'Lantern Warden' } = {}) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  await next(user);
  await pick(user, race);
  await next(user);
  await pick(user, klass);
  await next(user);
  if (heading() === 'Adjust scores') await next(user);
  await screen.findByRole('heading', { name: 'Who they are' });
}

describe("The knight's liege: a field for some classes, fed by a table (cs-3, G-86, G-89)", () => {
  it('a warden is asked the oath from its table; a reed witch is not; neither bog folk is asked the stone kin’s field', async () => {
    fenWorld();
    const user = openApp();
    await toWho(user);
    const group = screen.getByRole('group', { name: /^Oath\b/ });
    // Purpose (Design's gallery review of #555): a table row that sets the alignment is a Roll row with the table's die
    // (and its glyph), the field and the alignment's word from the pack; the heading is the field's name alone, and the
    // pack's help line comes under the Roll row.
    // The pack gives its own line for the pick, so the Roll row is cut to the act and its consequence (cs-8, dec-10 D).
    const roll = within(group).getByText('Roll d4, then tap the row. It sets your leaning.').closest('.roll-row');
    expect(roll).not.toBeNull();
    expect(roll!.querySelector('svg')).not.toBeNull();
    expect(group.querySelector('h2')?.textContent).toBe('Oath');
    const help = within(group).getByText(OATH.help!);
    expect(roll!.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Asked from the table, not as a free text box; the kindred-only field isn't asked of bog folk.
    expect(screen.queryByRole('textbox', { name: 'Oath' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Reed mark' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    if (heading() === 'Adjust scores') await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    await pick(user, 'Reed Witch');
    await next(user);
    if (heading() === 'Adjust scores') await next(user);
    await screen.findByRole('heading', { name: 'Who they are' });
    expect(screen.queryByRole('group', { name: /^Oath\b/ })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Oath' })).toBeNull();
  });

  // Purpose (R3-4, 2026-11-08): every describing table starts collapsed; the short table's rows sit under one fold row,
  // "3 to choose from", which opens them; back on the step with a lodge picked, the fold starts open and names it.
  it('the oath’s rows start folded under one row; the row opens them; with a pick the fold starts open', async () => {
    fenWorld();
    const user = openApp();
    await toWho(user);
    const oath = screen.getByRole('group', { name: /^Oath\b/ });
    const fold = within(oath).getByText('3 to choose from').closest('details')!;
    expect(fold.open).toBe(false);
    expect(within(fold).getByText('Nothing picked yet')).toBeTruthy();
    await user.click(within(oath).getByText('3 to choose from'));
    expect(fold.open).toBe(true);
    await user.click(within(oath).getByRole('checkbox', { name: 'Pick The Reed Moot (Reed)' }));
    expect(within(fold).getByText('Picked: The Reed Moot (Reed)')).toBeTruthy();
    await user.type(screen.getByLabelText('Name'), 'Tam');
    await next(user);
    await user.click(await screen.findByRole('button', { name: 'Back to the step before' }));
    await screen.findByRole('heading', { name: 'Who they are' });
    const again = within(screen.getByRole('group', { name: /^Oath\b/ })).getByText('3 to choose from').closest('details')!;
    expect(again.open).toBe(true);
  });

  it('picking a lodge sets the leaning, offers only it with a line saying why, and Undo puts both back', async () => {
    fenWorld();
    const user = openApp();
    await toWho(user);
    await pick(user, 'Mire');
    // A short table is pick rows (cw-5): the row's words, the alignment and the roll on its second line.
    const oath = screen.getByRole('group', { name: /^Oath\b/ });
    expect(within(oath).getByText('Reed, 2 on the d4')).toBeTruthy();
    await user.click(within(oath).getByRole('checkbox', { name: 'Pick The Reed Moot (Reed)' }));
    expect(within(oath).getByRole('checkbox', { name: 'Pick The Reed Moot (Reed)' }).getAttribute('aria-checked')).toBe('true');
    // The toast says what the pick changed (cw-12's words; no alsoFills here).
    expect(await screen.findByText('Oath: The Reed Moot (Reed). Your leaning is now Reed, as theirs is.')).toBeTruthy();
    expect(within(leaningGroup()).getByText("A lantern warden's leaning is their oath's: The Reed Moot (Reed).")).toBeTruthy();
    expect(within(leaningGroup()).queryByRole('checkbox', { name: 'Pick Mire' })).toBeNull();
    expect((within(leaningGroup()).getByRole('checkbox', { name: 'Pick Reed' })).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(oath).getByRole('checkbox', { name: 'Pick The Reed Moot (Reed)' }).getAttribute('aria-checked')).toBe('false');
    expect((within(leaningGroup()).getByRole('checkbox', { name: 'Pick Mire' })).getAttribute('aria-checked')).toBe('true');
  });

  it('the oath is saved with the character; changed to a reed witch it is hidden but stays saved', async () => {
    fenWorld();
    const user = openApp();
    await toWho(user);
    await pick(user, 'The Drowned Hall (Mire)');
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    if (heading() === 'Adjust scores') await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    await pick(user, 'Reed Witch');
    await next(user);
    if (heading() === 'Adjust scores') await next(user);
    await screen.findByRole('heading', { name: 'Who they are' });
    expect(screen.queryByRole('group', { name: /^Oath\b/ })).toBeNull();
    await user.type(screen.getByLabelText('Name'), 'Tam of the Reeds');
    await next(user);
    await waitFor(() => expect(heading()).not.toBe('Who they are'));
    const made = world.tables.actors.find((a) => a.name === 'Tam of the Reeds');
    expect((made?.fields as Record<string, unknown>).oath).toBe('The Drowned Hall (Mire)');
  });
});

describe('the full sheet shows a class field only when it applies (cs-3; plans/m5b-sheet.md, "Liege shows only when it applies")', () => {
  /** An approved bog folk of this class, sworn to the Reed Moot, open on the full sheet. */
  async function openSheet(classRef: string) {
    const { campaign, me } = fenWorld();
    const tam = world.addCharacter(campaign, 'Tam', { ownerId: me, approval: 'approved' });
    Object.assign(world.tables.actors.find((a) => a.id === tam)!, { level: 1, hp_current: 6, hp_max: 6, notes: '', race_ref: 'bog-folk', fields: { MUS: 10, oath: 'The Reed Moot (Reed)', motto: 'Lights first' }, classes: [{ classRef, level: 1, xp: 0 }] });
    world.tables.members.find((m) => m.campaign_id === campaign && m.user_id === me)!.active_actor_id = tam;
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await openFullSheetFromMenu(user);
    await screen.findByText('Lights first');
    return { user, tam: () => world.tables.actors.find((a) => a.id === tam)! };
  }

  // Purpose: a warden's sheet shows the oath.
  it("shows the oath on a warden's sheet", async () => {
    await openSheet('lantern-warden');
    expect(screen.getAllByText('The Reed Moot (Reed)').length).toBeGreaterThan(0);
  });

  // Purpose: a reed witch's sheet doesn't show it, not even in Edit, and saving the sheet keeps it saved.
  it("hides it on a reed witch's sheet and keeps it through a save", async () => {
    const { user, tam } = await openSheet('reed-witch');
    expect(screen.queryByText('The Reed Moot (Reed)')).toBeNull();
    expect(screen.queryByText('Oath')).toBeNull();
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]!);
    // Plan m5b-sheet-revised B5/B6: Edit's Details rows save at once (there is no Save for them any more), so a real
    // save is a detail changed: the Motto. Oath is not a row in Edit for this class.
    const edit = within(await screen.findByRole('form', { name: 'Edit Tam' }));
    expect(edit.queryByRole('button', { name: /^Oath:/ })).toBeNull();
    await user.click(edit.getByRole('button', { name: /^Motto:/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Motto' }));
    await user.clear(sheet.getByLabelText('Motto'));
    await user.type(sheet.getByLabelText('Motto'), 'Reeds first');
    await user.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect((tam().fields as Record<string, unknown>).motto).toBe('Reeds first'));
    expect((tam().fields as Record<string, unknown>).oath).toBe('The Reed Moot (Reed)');
  });
});

// The liege as pick rows (cw-5) and what a pick also fills (cw-12; Design's answers, 2026-11-06).
//   The row shows the house's plain name, its alignment and roll under it; the name opens its entry with Pick.
//   Pick writes the plain name, sets the alignment and the empty Allegiance, says all three, and Undo puts all back.
//   An allegiance the player typed is never overwritten; one the last pick wrote follows the next pick.
describe("the liege as pick rows, and the field it also fills (cw-5, cw-12)", () => {
  // Purpose: the house's name opens its entry (its note), and Pick there picks it.
  it("opens a house's entry from its name and picks it there", async () => {
    fenWorld({ rework: true });
    const user = openApp();
    await toWho(user);
    const oath = screen.getByRole('group', { name: /^Oath\b/ });
    await user.click(within(oath).getByRole('button', { name: /^The Drowned Hall/ }));
    const entry = await screen.findByRole('dialog', { name: 'The Drowned Hall' });
    expect(within(entry).getByText('Sworn to the mire since the first flood.')).toBeTruthy();
    // In the book format (dec-10 S3, #738's review): the alignment is a labelled line under the pack's word for it, and
    // the last line names only the book, never the alignment.
    const line = within(entry).getByText('Leaning', { selector: '.book-label' }).parentElement!;
    expect(line.textContent).toBe('Leaning Mire');
    expect(entry.querySelector('.book-source')?.textContent ?? '').not.toContain('Mire');
    await user.click(within(entry).getByRole('button', { name: 'Pick The Drowned Hall' }));
    expect(within(oath).getByRole('checkbox', { name: 'Pick The Drowned Hall' }).getAttribute('aria-checked')).toBe('true');
  });

  // Purpose: one Pick sets the oath's plain name, the leaning and the empty allegiance, the toast says so, and Undo restores all three.
  it('Pick sets the oath, the leaning and the allegiance, says so, and Undo puts all three back', async () => {
    fenWorld({ rework: true });
    const user = openApp();
    await toWho(user);
    await pick(user, 'Mire');
    await pick(user, 'The Reed Moot');
    expect(await screen.findByText('Oath: The Reed Moot. Your leaning is now Reed, as theirs is, and your allegiance is The Reed Moot.')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Allegiance' }) as HTMLInputElement).value).toBe('The Reed Moot');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect((screen.getByRole('textbox', { name: 'Allegiance' }) as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('checkbox', { name: 'Pick The Reed Moot' }).getAttribute('aria-checked')).toBe('false');
    expect(within(leaningGroup()).getByRole('checkbox', { name: 'Pick Mire' }).getAttribute('aria-checked')).toBe('true');
  });

  // Purpose: a pick's allegiance follows the next pick, but one the player typed is kept, and the toast leaves it out.
  it('follows a change of house, and never overwrites an allegiance the player typed', async () => {
    fenWorld({ rework: true });
    const user = openApp();
    await toWho(user);
    await pick(user, 'The Reed Moot');
    await pick(user, 'The Drowned Hall');
    expect((screen.getByRole('textbox', { name: 'Allegiance' }) as HTMLInputElement).value).toBe('The Drowned Hall');
    await user.clear(screen.getByRole('textbox', { name: 'Allegiance' }));
    await user.type(screen.getByRole('textbox', { name: 'Allegiance' }), 'The Eel Guild');
    await pick(user, 'The Lantern Court');
    expect(await screen.findByText('Oath: The Lantern Court. Your leaning is now Lantern, as theirs is.')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Allegiance' }) as HTMLInputElement).value).toBe('The Eel Guild');
    await user.type(screen.getByLabelText('Name'), 'Tam of the Reeds');
    await next(user);
    await waitFor(() => expect(heading()).not.toBe('Who they are'));
    const made = world.tables.actors.find((a) => a.name === 'Tam of the Reeds');
    expect(made?.fields as Record<string, unknown>).toMatchObject({ oath: 'The Lantern Court', allegiance: 'The Eel Guild' });
  });
});
