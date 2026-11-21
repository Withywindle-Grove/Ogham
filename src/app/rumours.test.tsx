// @vitest-environment jsdom
// A rumour table's truth, the GM's alone, clicked through (dec-12 piece E; mc-65, tb-1, rm-1; pictures 03-04-rumours,
// 03-04b-who-hears-rumour and the rumours' row of 03-10 on the branch design-december-mockups). The stand-in database;
// invented content only.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { CallsLine } from './CallsToAdventure.tsx';

let world: FakeWorld;
let gmId: string;
let campaign: string;
let wren: string;
const gm = (): CurrentUser => ({ id: gmId, roles: { [campaign]: 'gm' } });

const SAID = [
  ['The cog went down with her captain still aboard.', 'true'],
  ['The customs men left because of what they saw on the bar.', 'false'],
  ['There is a light in the shed some nights.', 'true'],
  ['The Tidewife drowns anyone who rows at slack water.', 'partial'],
  ['A very long rumour that someone’s cousin swears to, about the bell under the water and the night the ferryman drowned, and every such night since, whatever the priest says.', 'false'],
  ['Eels in the well.', 'false'],
  ['The warden sold the sluice keys.', 'partial'],
  ['Nobody has crossed the bar since the storm.', 'true'],
] as const;

/** An invented adventure attached to the campaign: one rumours table of eight rows, and, if asked, one hook. */
function adventure(withHook = false) {
  world.tables.packs.push({ id: 'weirs', owner_user_id: gmId, campaign_id: null, name: 'The Reed Marches', kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
  world.tables.campaign_packs.push({ id: 'cp-weirs', campaign_id: campaign, pack_id: 'weirs', option_choices: {}, priority: 1 });
  world.tables.library_entries.push({
    id: 'entry-weirs-rumours',
    pack_id: 'weirs',
    kind: 'table',
    pack_entry_id: 'ew-quay-rumours',
    name: 'What they say in Reedmouth',
    data: { uses: ['world.rumours'], die: 'd8', rows: SAID.map(([result, truth], n) => ({ min: n + 1, max: n + 1, result, truth, note: 'The GM’s own note.' })) },
  });
  // Another table of the adventure, not rumours: never listed here.
  world.tables.library_entries.push({ id: 'entry-weirs-enc', pack_id: 'weirs', kind: 'table', pack_entry_id: 'ew-quay-encounters', name: 'Quay encounters', data: { uses: ['encounters'], die: 'd6', rows: [{ min: 1, max: 6, result: 'Bog lurker' }] } });
  if (withHook) {
    world.tables.library_entries.push({ id: 'entry-weirs-hook', pack_id: 'weirs', kind: 'adventureHook', pack_entry_id: 'lantern', name: 'The lost lantern', data: { text: 'A Lantern Warden never came back.', pays: '', giver: null, order: 0 } });
  }
}

beforeEach(() => {
  world = createFakeDb();
  gmId = world.addPerson('priya@weirs.example', 'Priya');
  const tamId = world.addPerson('tam@weirs.example', 'Tam');
  campaign = world.addCampaign('The Eel Weirs', gmId);
  world.addMember(campaign, tamId, 'player');
  wren = world.addCharacter(campaign, 'Wren', { ownerId: tamId });
  world.signInAs(gmId);
});
afterEach(cleanup);

const show = () =>
  render(
    <ToastHost>
      <CallsLine db={world.db} user={gm()} campaign={{ id: campaign, name: 'The Eel Weirs', role: 'gm', line: null }} placeName="Reedmouth" />
    </ToastHost>,
  );

const openTable = async () => {
  await userEvent.click(await screen.findByRole('button', { name: /Calls to adventure/ }));
  await userEvent.click(screen.getByRole('button', { name: /^What they say in Reedmouth/ }));
  return screen.getByRole('dialog', { name: 'Rumours' });
};

describe("an adventure's rumours (frame 2b)", () => {
  // Purpose: an adventure with a rumours table and no hook still has its line (with nothing to count) and lists the
  // table under Rumours with its die and how many rows were heard; another table of the adventure is not listed.
  it('lists the rumours table with its die and how many were heard, and draws the line with nothing to count', async () => {
    adventure();
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Calls to adventure' }));
    const sheet = screen.getByRole('dialog', { name: 'The Reed Marches' });
    expect(within(sheet).queryByRole('heading', { name: 'Hooks' })).toBeNull();
    expect(within(sheet).getByRole('heading', { name: 'Rumours' })).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'What they say in Reedmouth, d8. 0 of 8 heard so far.' })).toBeTruthy();
    expect(within(sheet).queryByText('Quay encounters')).toBeNull();
  });

  // Purpose: with hooks too, the hooks come first and the line still counts the hooks alone.
  it('follows the hooks, and the line counts the hooks alone', async () => {
    adventure(true);
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Calls to adventure, 0 of 1 sent' }));
    const headings = within(screen.getByRole('dialog', { name: 'The Reed Marches' })).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Hooks', 'Rumours']);
  });
});

describe('the rumour table (frame 5)', () => {
  // Purpose: the table in the book's style: the way back under its title ("‹ The Reed Marches", no Back in the foot;
  // TW9), its name in the bar, the die, "Rumour" and "Truth" in the head, each row its number, its words and its truth
  // as the word alone; five rows, then "3 more rows" and the link "Show all 8".
  it('shows each rumour with its truth as a word, five rows, then Show all', async () => {
    adventure();
    show();
    const sheet = await openTable();
    expect(within(sheet).getByRole('button', { name: 'Back to The Reed Marches' }).textContent).toBe('‹ The Reed Marches');
    expect(within(sheet).queryByRole('button', { name: 'Back' })).toBeNull();
    expect(within(sheet).getByText('What they say in Reedmouth')).toBeTruthy();
    expect(within(sheet).getByText('Truth')).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: '3: There is a light in the shed some nights.. Truth: True' })).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: '4: The Tidewife drowns anyone who rows at slack water.. Truth: Partly' })).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: /^6:/ })).toBeNull();
    expect(within(sheet).getByText('3 more rows.')).toBeTruthy();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Show all 8' }));
    expect(within(sheet).getByRole('button', { name: /^8: Nobody has crossed the bar/ })).toBeTruthy();
    // The GM's own note on a row is not shown here.
    expect(within(sheet).queryByText('The GM’s own note.')).toBeNull();
    // The way back goes to the adventure's hooks and rumours.
    await userEvent.click(within(sheet).getByRole('button', { name: 'Back to The Reed Marches' }));
    expect(screen.getByRole('dialog', { name: 'The Reed Marches' })).toBeTruthy();
  });

  // Purpose: "Show all" is kept by pack and table: two adventures whose tables share an id are shown whole apart.
  it('keeps Show all by pack as well as table', async () => {
    adventure();
    // A second adventure with a rumours table of the same id.
    world.tables.packs.push({ id: 'barrow', owner_user_id: gmId, campaign_id: null, name: 'The Lantern Barrow', kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
    world.tables.campaign_packs.push({ id: 'cp-barrow', campaign_id: campaign, pack_id: 'barrow', option_choices: {}, priority: 2 });
    world.tables.library_entries.push({ id: 'entry-barrow-rumours', pack_id: 'barrow', kind: 'table', pack_entry_id: 'ew-quay-rumours', name: 'What they say at the barrow', data: { uses: ['world.rumours'], die: 'd8', rows: SAID.map(([result], n) => ({ min: n + 1, max: n + 1, result })) } });
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Calls to adventure/ }));
    await userEvent.click(screen.getByRole('button', { name: /^The Reed Marches/ }));
    await userEvent.click(screen.getByRole('button', { name: /^What they say in Reedmouth/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Show all 8' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back to The Reed Marches' }));
    await userEvent.click(screen.getByRole('button', { name: /^Back$/ }));
    await userEvent.click(screen.getByRole('button', { name: /^The Lantern Barrow/ }));
    await userEvent.click(screen.getByRole('button', { name: /^What they say at the barrow/ }));
    expect(screen.getByRole('button', { name: 'Show all 8' })).toBeTruthy();
  });
});

describe('who hears a rumour (frame 6) and giving it (rumour.give)', () => {
  // Purpose: a tap on a row asks who hears it, with its words and its truth's mark; Party gives it at once with Undo;
  // only the words are given (never the truth or the note); the row then says who heard it and the list counts it;
  // Undo takes it back.
  it('gives the words alone to the party with Undo; the row says who heard it; Undo takes it back', async () => {
    adventure();
    show();
    const table = await openTable();
    await userEvent.click(within(table).getByRole('button', { name: /^3: There is a light/ }));
    const who = screen.getByRole('dialog', { name: 'Who hears it?' });
    expect(within(who).getByRole('button', { name: 'Back to What they say in Reedmouth' }).textContent).toBe('‹ What they say in Reedmouth');
    expect(within(who).queryByRole('button', { name: 'Back' })).toBeNull();
    expect(within(who).getByText('“There is a light in the shed some nights.”')).toBeTruthy();
    expect(within(who).getByText('True')).toBeTruthy();
    await userEvent.click(within(who).getByRole('button', { name: 'Party' }));
    expect(await screen.findByText('Sent to the party: What they say in Reedmouth, 3')).toBeTruthy();
    expect(world.tables.hook_sends).toHaveLength(1);
    const given = world.tables.hook_sends[0]!;
    // rm-2: a give is named "A rumour", never the table's name.
    expect(given).toMatchObject({ kind: 'rumour', hook_key: 'ew-quay-rumours#3-3', name: 'A rumour', body: 'There is a light in the shed some nights.', pays: '', actor_id: null });
    expect(JSON.stringify(given)).not.toContain('What they say');
    expect(JSON.stringify(given)).not.toContain('true');
    expect(JSON.stringify(given)).not.toContain('own note');
    const back = screen.getByRole('dialog', { name: 'Rumours' });
    expect(await within(back).findByRole('button', { name: /^3: There is a light.*Heard by the party, day 1\.$/ })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.hook_sends[0]!.undone).toBe(true));
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Rumours' })).getByRole('button', { name: '3: There is a light in the shed some nights.. Truth: True' })).toBeTruthy());
  });

  // Purpose: Character asks which character on the same step as a hook's, and a tap gives it to that character.
  it('to one character: the same step as a hook, and a tap gives it', async () => {
    adventure();
    show();
    const table = await openTable();
    await userEvent.click(within(table).getByRole('button', { name: /^1: The cog/ }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Who hears it?' })).getByRole('button', { name: 'Character' }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Send to Wren, Tam' }));
    expect(await screen.findByText('Sent to Wren: What they say in Reedmouth, 1')).toBeTruthy();
    expect(world.tables.hook_sends[0]).toMatchObject({ kind: 'rumour', actor_id: wren });
  });

  // Purpose: a second give of a row to the same hearer is refused in words, and nothing is written.
  it('refuses a second give to the same hearer in words', async () => {
    adventure();
    show();
    const table = await openTable();
    await userEvent.click(within(table).getByRole('button', { name: /^2: The customs/ }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Who hears it?' })).getByRole('button', { name: 'Party' }));
    await screen.findByText('Sent to the party: What they say in Reedmouth, 2');
    await userEvent.click(await within(screen.getByRole('dialog', { name: 'Rumours' })).findByRole('button', { name: /^2: The customs.*Heard by the party/ }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Who hears it?' })).getByRole('button', { name: 'Party' }));
    expect(await screen.findByText("It wasn't sent again: the party already has it. Nothing changed.")).toBeTruthy();
    expect(world.tables.hook_sends).toHaveLength(1);
  });
});

describe('as a player, on the stand-in database (rm-2, rm-3)', () => {
  // Purpose: a player reads no rumours table, even one its pack marks open ("gmOnly": false), by either read; an
  // ordinary open table is still read; a rumour given to the party reaches the player as "A rumour" and its words only.
  it('reads no rumours table, even marked open; reads an open ordinary table; gets a given rumour as "A rumour"', async () => {
    adventure();
    const entry = world.tables.library_entries.find((e) => e.id === 'entry-weirs-rumours')!;
    entry.data = { ...(entry.data as Record<string, unknown>), gmOnly: false };
    world.tables.library_entries.push({ id: 'entry-weirs-names', pack_id: 'weirs', kind: 'table', pack_entry_id: 'ew-quay-names', name: 'Quay names', data: { uses: ['people.names'], gmOnly: false, die: 'd4', rows: [{ min: 1, max: 4, result: 'Marda' }] } });
    show();
    const table = await openTable();
    await userEvent.click(within(table).getByRole('button', { name: /^3: There is a light/ }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Who hears it?' })).getByRole('button', { name: 'Party' }));
    await screen.findByText('Sent to the party: What they say in Reedmouth, 3');
    cleanup();

    world.signInAs(world.tables.members.find((m) => m.campaign_id === campaign && m.user_id !== gmId)!.user_id as string);
    const direct = await world.db.from('library_entries').select('pack_entry_id, data').eq('pack_id', 'weirs');
    expect((direct.data ?? []).map((e) => e.pack_entry_id)).toEqual(['ew-quay-names']);
    const library = await world.db.rpc('campaign_library', { campaign });
    const ids = ((library.data ?? []) as { pack_entry_id: string }[]).map((e) => e.pack_entry_id);
    expect(ids).toContain('ew-quay-names');
    expect(ids).not.toContain('ew-quay-rumours');
    expect(JSON.stringify(library.data)).not.toContain('The GM’s own note.');
    const sends = await world.db.from('hook_sends').select('name, body, kind').eq('campaign_id', campaign);
    expect((sends.data ?? []).map((r) => ({ name: r.name, body: r.body, kind: r.kind }))).toEqual([{ name: 'A rumour', body: 'There is a light in the shed some nights.', kind: 'rumour' }]);
    expect(JSON.stringify(sends.data)).not.toContain('What they say');
  });
});
