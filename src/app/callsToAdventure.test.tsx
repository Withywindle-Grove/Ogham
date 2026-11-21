// @vitest-environment jsdom
// Calls to adventure for the GM, clicked through (dec-12 piece B; mc-61 to mc-64; pictures 03-01 … 03-15 on the
// branch design-december-mockups). The stand-in database; invented content only.
// Where the line shows (plan scene-point-to-point B19; p2p-15, ⚑ 8): in a settlement; never at a Location of an
// adventure, except where one of its calls comes from a person there; never at a place typed by hand.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { createAppRegistry } from './commandRegistry.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { sendHook, type Adventure } from '../modules/library/callsToAdventure.ts';
import type { StoredHook } from '../modules/library/adventureHooks.ts';
import { forgetPackPlaces, loadGroupPlaces, setPlace } from '../modules/expedition/placePlay.ts';
import { CallsLine, callsLineShows, type CallsAt } from './CallsToAdventure.tsx';
import { GmPlacePage } from './GmPlacePage.tsx';
import { SceneWaitingProvider } from './sceneWaiting.tsx';

let world: FakeWorld;
let gmId: string;
let campaign: string;
let wren: string;
const gm = (): CurrentUser => ({ id: gmId, roles: { [campaign]: 'gm' } });

/** An invented adventure attached to the campaign, with hooks in the book's order. */
function adventure(packId: string, name: string, priority: number, hooks: { id: string; name: string; text: string; pays: string; giver?: { name: string; role: string; place: string } | null }[]) {
  world.tables.packs.push({ id: packId, owner_user_id: gmId, campaign_id: null, name, kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
  world.tables.campaign_packs.push({ id: `cp-${packId}`, campaign_id: campaign, pack_id: packId, option_choices: {}, priority });
  hooks.forEach((h, order) =>
    world.tables.library_entries.push({ id: `entry-${packId}-${h.id}`, pack_id: packId, kind: 'adventureHook', pack_entry_id: h.id, name: h.name, data: { text: h.text, pays: h.pays, giver: h.giver ?? null, order } }),
  );
}

const WEIRS = [
  { id: 'lantern', name: 'The lost lantern', text: 'A Lantern Warden never came back from the weirs.\nMarda keeps his boat.', pays: 'A boat of your own', giver: { name: 'Marda', role: 'eel-wife', place: '4 The Sluice House' } },
  { id: 'bounty', name: 'Bounty on the Bog lurker', text: 'Nailed to the quay post: a bounty, in a shaky hand.', pays: 'Ten silver a head' },
];

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
      <CallsLine db={world.db} user={gm()} campaign={{ id: campaign, name: 'The Eel Weirs', role: 'gm', line: null }} placeName="Saltreach" />
    </ToastHost>,
  );

describe('the line on the place card (mc-61)', () => {
  // Purpose: with no adventure that has a hook, there is no line at all (frame 11).
  it('is not drawn while no attached adventure has a hook', async () => {
    world.tables.packs.push({ id: 'empty', owner_user_id: gmId, campaign_id: null, name: 'The empty barrow', kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
    world.tables.campaign_packs.push({ id: 'cp-empty', campaign_id: campaign, pack_id: 'empty', option_choices: {}, priority: 1 });
    show();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('button', { name: /Calls to adventure/ })).toBeNull();
  });

  // Purpose: the line says what is left to give across every adventure, on a line of its own.
  it('says how many of all the hooks were sent', async () => {
    adventure('weirs', 'The eel weirs', 1, WEIRS);
    adventure('barrow', 'The Lantern Barrow', 2, [{ id: 'bell', name: 'The drowned bell', text: 'It rings at low tide.', pays: '' }]);
    show();
    expect(await screen.findByRole('button', { name: 'Calls to adventure, 0 of 3 sent' })).toBeTruthy();
  });
});

describe('one adventure (mc-62: straight to its hooks) and one hook (mc-63, mc-64)', () => {
  // Purpose: with one adventure the sheet opens on its hooks, the place in its small line and no Back; each row says
  // what it pays and who gives it, where.
  it('opens straight on the hooks, each row with what it pays and who gives it', async () => {
    adventure('weirs', 'The eel weirs', 1, WEIRS);
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Calls to adventure/ }));
    const sheet = screen.getByRole('dialog', { name: 'The eel weirs' });
    expect(within(sheet).getByText('Saltreach')).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'Back' })).toBeNull();
    expect(within(sheet).getByRole('button', { name: 'The lost lantern, Pays a boat of your own., From Marda, at 4 The Sluice House.' })).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'Bounty on the Bog lurker, Pays ten silver a head.' })).toBeTruthy();
  });

  // Purpose: a hook's sheet shows its words as the book's paragraphs, Pays and Given by, the source line, the quill
  // beside the ✕ and the two answers; Party sends at once with Undo, the row then says so, and Undo takes it back.
  it('sends to the party at once with Undo; the row and the line say so; Undo takes it back', async () => {
    adventure('weirs', 'The eel weirs', 1, WEIRS);
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Calls to adventure/ }));
    await userEvent.click(screen.getByRole('button', { name: /^The lost lantern/ }));
    const sheet = screen.getByRole('dialog', { name: 'The lost lantern' });
    expect(within(sheet).getByText('A Lantern Warden never came back from the weirs.')).toBeTruthy();
    expect(within(sheet).getByText('Marda keeps his boat.')).toBeTruthy();
    expect(within(sheet).getByText('Pays')).toBeTruthy();
    expect(within(sheet).getByText('Marda, eel-wife, at 4 The Sluice House.')).toBeTruthy();
    expect(within(sheet).getByText('From your adventure: The eel weirs.')).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'Edit before sending' })).toBeTruthy();
    expect(within(sheet).getByRole('heading', { name: 'Who hears it?' })).toBeTruthy();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Party' }));
    expect(await screen.findByText('Sent to the party: The lost lantern')).toBeTruthy();
    expect(world.tables.hook_sends).toHaveLength(1);
    expect(await screen.findByText('Sent to the party, day 1')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Calls to adventure, 1 of 2 sent' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.hook_sends[0]!.undone).toBe(true));
    expect(await screen.findByRole('button', { name: 'Calls to adventure, 0 of 2 sent' })).toBeTruthy();
  });

  // Purpose: a toast's Undo undoes the send it names, never a later one (a send made meanwhile from the GM's other
  // device here): the review of #741 found it undid whatever send was newest.
  it("Undo on a send's toast undoes that send, not a newer one", async () => {
    adventure('weirs', 'The eel weirs', 1, WEIRS);
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Calls to adventure/ }));
    await userEvent.click(screen.getByRole('button', { name: /^The lost lantern/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Party' }));
    await screen.findByText('Sent to the party: The lost lantern');
    // The GM's other device sends the second hook while the first toast is still up.
    expect(await runCommand(createAppRegistry(), world.db, gm(), sendHook, { campaignId: campaign, packId: 'weirs', hookId: 'bounty', actorId: wren, body: 'A bounty.', pays: '' })).toMatchObject({ ok: true });
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.hook_sends.find((s) => s.hook_key === 'lantern')!.undone).toBe(true));
    expect(world.tables.hook_sends.find((s) => s.hook_key === 'bounty')!.undone).toBe(false);
  });

  // Purpose: a second send to the same hearer is refused in words and nothing changes.
  it('refuses a second send to the party in words', async () => {
    adventure('weirs', 'The eel weirs', 1, WEIRS);
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Calls to adventure/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Bounty on the Bog lurker/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Party' }));
    await screen.findByText('Sent to the party, day 1');
    await userEvent.click(screen.getByRole('button', { name: /^Bounty on the Bog lurker/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Party' }));
    expect(await screen.findByText("It wasn't sent again: the party already has it. Nothing changed.")).toBeTruthy();
    expect(world.tables.hook_sends).toHaveLength(1);
  });

  // Purpose: the quill changes the words for this send only: the sheet shows them, the send keeps them, the pack
  // keeps the book's; "Back to the book's words" puts the book's back in the fields.
  it("edits the words for this send only, and can go back to the book's words", async () => {
    adventure('weirs', 'The eel weirs', 1, WEIRS);
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Calls to adventure/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Bounty on the Bog lurker/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit before sending' }));
    const edit = screen.getByRole('dialog', { name: 'Edit before sending' });
    const words = within(edit).getByRole('textbox', { name: 'The words to send' });
    await userEvent.clear(words);
    await userEvent.type(words, 'The bounty is doubled for Tam.');
    await userEvent.click(within(edit).getByRole('button', { name: "Back to the book's words" }));
    expect((words as HTMLTextAreaElement).value).toBe('Nailed to the quay post: a bounty, in a shaky hand.');
    await userEvent.clear(words);
    await userEvent.type(words, 'The bounty is doubled for Tam.');
    await userEvent.click(within(edit).getByRole('button', { name: 'Use these words' }));
    expect(await screen.findByText('The bounty is doubled for Tam.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Party' }));
    await screen.findByText('Sent to the party: Bounty on the Bog lurker');
    expect(world.tables.hook_sends[0]!.body).toBe('The bounty is doubled for Tam.');
    expect(world.tables.library_entries.find((e) => e.pack_entry_id === 'bounty')!.data).toMatchObject({ text: 'Nailed to the quay post: a bounty, in a shaky hand.' });
  });

  // Purpose: after Character, each character in play is the app's option row with its name and, in the muted line,
  // its player's name or "you" for the GM's own; there is no second rule above Back (SC-1, approved 2026-11-13).
  it("lists the characters as option rows with their player's name, the GM's own as you", async () => {
    adventure('weirs', 'The eel weirs', 1, WEIRS);
    world.addCharacter(campaign, 'Ash', { ownerId: gmId });
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Calls to adventure/ }));
    await userEvent.click(screen.getByRole('button', { name: /^The lost lantern/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Character' }));
    const sheet = await screen.findByRole('dialog', { name: 'Who hears it?' });
    const rows = within(within(sheet).getByRole('radiogroup', { name: 'Characters' })).getAllByRole('radio');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual(['Send to Ash, you', 'Send to Wren, Tam']);
    expect(rows.every((r) => r.classList.contains('option-row'))).toBe(true);
    expect(within(rows[1]!).getByText('Tam')).toBeTruthy();
    // The way back is the link under the title (wh-1; page 19's TW9b, ap-12), with no Back in the foot.
    expect(within(sheet).getByRole('button', { name: 'Back to The lost lantern' }).textContent).toBe('‹ The lost lantern');
    expect(sheet.querySelector('.calls__foot')).toBeNull();
    expect(sheet.querySelector('.row-list')).toBeNull();
  });

  // Purpose: Character asks which character (SC-1), and sends to that one.
  it('sends to one character picked from the characters in play', async () => {
    adventure('weirs', 'The eel weirs', 1, WEIRS);
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Calls to adventure/ }));
    await userEvent.click(screen.getByRole('button', { name: /^The lost lantern/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Character' }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Send to Wren, Tam' }));
    expect(await screen.findByText('Sent to Wren: The lost lantern')).toBeTruthy();
    expect(world.tables.hook_sends[0]).toMatchObject({ actor_id: wren });
  });
});

describe('several adventures (mc-62, frame 2)', () => {
  // Purpose: the sheet opens on the adventures, each with what is left ("All sent" when none is), and an adventure's
  // hooks have Back to the list.
  it('lists the adventures with what is left, and Back returns from one', async () => {
    adventure('weirs', 'The eel weirs', 1, WEIRS);
    adventure('barrow', 'The Lantern Barrow', 2, [{ id: 'bell', name: 'The drowned bell', text: 'It rings at low tide.', pays: '' }]);
    world.tables.hook_sends.push({ id: 'old', campaign_id: campaign, pack_id: 'barrow', hook_key: 'bell', actor_id: null, player_user_id: null, name: 'The drowned bell', body: 'It rings.', pays: '', clock_seconds: 0, undone: false, version: 1, created_at: '2026-12-05T19:00:00Z' });
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Calls to adventure, 1 of 3 sent' }));
    const sheet = screen.getByRole('dialog', { name: 'Calls to adventure' });
    expect(within(sheet).getByRole('button', { name: 'The eel weirs, 0 of 2 sent' })).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'The Lantern Barrow, All sent' })).toBeTruthy();
    await userEvent.click(within(sheet).getByRole('button', { name: 'The Lantern Barrow, All sent' }));
    expect(screen.getByRole('button', { name: /The drowned bell, Sent to the party/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: 'Calls to adventure' })).toBeTruthy();
  });
});

describe('where the line shows (B19; p2p-15, ⚑ 8)', () => {
  /** A hook as the library keeps it: given by a person at a place (their id and the place's words), or posted. */
  const hook = (id: string, giver: { npc: string; place: string } | null): StoredHook => ({
    id,
    name: id,
    text: 'Invented words.',
    pays: '',
    giverNpcId: giver?.npc ?? null,
    giver: giver ? { name: 'Oswy the ferryman', role: 'ferryman', place: giver.place } : null,
    order: 0,
  });
  const reed = (hooks: StoredHook[], packId = 'reed'): Adventure => ({ packId, name: 'The Reed Marches', hooks, rumours: [] });
  const jetty: CallsAt = { settlement: false, packId: 'reed', key: '1', name: 'The jetty' };

  // Purpose: in a settlement the line shows whenever an adventure has a call, whoever gives it and wherever; with no
  // adventure there is still no line.
  it('shows in a settlement for any call, and nowhere without one', () => {
    expect(callsLineShows([reed([hook('notice', null)])], { settlement: true })).toBe(true);
    expect(callsLineShows([reed([hook('debt', { npc: 'marda', place: '3 The Weir Market' })])], { settlement: true })).toBe(true);
    expect(callsLineShows([], { settlement: true })).toBe(false);
    expect(callsLineShows([], jetty)).toBe(false);
  });

  // Purpose: at a Location of an adventure there is no line for a call posted by no one, or given by a person who is
  // somewhere else.
  it('does not show at a Location for a posted call or a giver elsewhere', () => {
    expect(callsLineShows([reed([hook('notice', null)])], jetty)).toBe(false);
    expect(callsLineShows([reed([hook('debt', { npc: 'marda', place: '2 The wreck' })])], jetty)).toBe(false);
    // A giver's words with no npc id behind them are not a person there.
    expect(callsLineShows([reed([{ ...hook('odd', { npc: 'x', place: '1 The jetty' }), giverNpcId: null }])], jetty)).toBe(false);
  });

  // Purpose: at a Location the line shows where one of its adventure's calls is given by a person there, the place
  // named by its key and name as the importer writes them (spacing aside).
  it('shows at a Location where a person there gives a call', () => {
    expect(callsLineShows([reed([hook('notice', null), hook('ferry', { npc: 'oswy', place: '1 The jetty' })])], jetty)).toBe(true);
    expect(callsLineShows([reed([hook('ferry', { npc: 'oswy', place: '1  The jetty ' })])], jetty)).toBe(true);
    // A place with no map key: its name alone.
    expect(callsLineShows([reed([hook('ferry', { npc: 'oswy', place: 'The jetty' })])], { ...jetty, key: null })).toBe(true);
  });

  // Purpose: the same words in another adventure, or a place typed by hand, never bring the line outside a settlement.
  it('does not show for another adventure’s giver or at a place typed by hand', () => {
    expect(callsLineShows([reed([hook('ferry', { npc: 'oswy', place: '1 The jetty' })], 'barrow')], jetty)).toBe(false);
    expect(callsLineShows([reed([hook('ferry', { npc: 'oswy', place: 'Fenwick Hole' })])], { settlement: false, packId: null, key: null, name: 'Fenwick Hole' })).toBe(false);
  });

  /** An adventure whose hooks name their giver by id, as the importer keeps them. */
  function adventureWithGivers(packId: string, name: string, hooks: { id: string; giverNpcId?: string; place?: string }[]) {
    world.tables.packs.push({ id: packId, owner_user_id: gmId, campaign_id: null, name, kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
    world.tables.campaign_packs.push({ id: `cp-${packId}`, campaign_id: campaign, pack_id: packId, pack_name: name, option_choices: {}, priority: 1 });
    hooks.forEach((h, order) =>
      world.tables.library_entries.push({
        id: `entry-${packId}-${h.id}`,
        pack_id: packId,
        kind: 'adventureHook',
        pack_entry_id: h.id,
        name: h.id,
        data: { text: 'Invented words.', pays: '', ...(h.giverNpcId ? { giverNpcId: h.giverNpcId } : {}), giver: h.place ? { name: 'Oswy the ferryman', role: 'ferryman', place: h.place } : null, order },
      }),
    );
  }

  // Purpose: drawn at a Location with a person's call there, it is the same line: every adventure's count, and the same
  // sheet (only where the line shows changed); at a Location without one it isn't drawn.
  it('the line at a Location is the settlement’s line, or nothing', async () => {
    adventureWithGivers('reed', 'The Reed Marches', [{ id: 'ferry', giverNpcId: 'oswy', place: '1 The jetty' }, { id: 'notice' }]);
    adventure('barrow', 'The Lantern Barrow', 2, [{ id: 'bell', name: 'The drowned bell', text: 'It rings at low tide.', pays: '' }]);
    const line = (at: CallsAt) =>
      render(
        <ToastHost>
          <CallsLine db={world.db} user={gm()} campaign={{ id: campaign, name: 'The Eel Weirs', role: 'gm', line: null }} placeName="The jetty" at={at} />
        </ToastHost>,
      );
    line(jetty);
    await userEvent.click(await screen.findByRole('button', { name: 'Calls to adventure, 0 of 3 sent' }));
    expect(screen.getByRole('dialog', { name: 'Calls to adventure' })).toBeTruthy();
    cleanup();
    line({ settlement: false, packId: 'reed', key: '2', name: 'The wreck' });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('button', { name: /Calls to adventure/ })).toBeNull();
  });

  describe('on the GM’s place page', () => {
    const HARBOUR = { id: 'drowned-harbour', name: 'The Drowned Harbour', type: 'region' };
    const JETTY = { id: 'the-jetty', name: 'The jetty', key: '1', type: 'site', parentId: 'drowned-harbour' };
    const WRECK = { id: 'the-wreck', name: 'The wreck', key: '2', type: 'site', parentId: 'drowned-harbour' };
    const registry = createAppRegistry();

    beforeEach(() => {
      forgetPackPlaces();
      adventureWithGivers('pack-reed', 'The Reed Marches', [{ id: 'ferry', giverNpcId: 'oswy', place: '1 The jetty' }, { id: 'notice' }]);
      for (const data of [HARBOUR, JETTY, WRECK]) world.tables.library_entries.push({ id: `entry-${data.id}`, pack_id: 'pack-reed', kind: 'location', pack_entry_id: data.id, name: data.name, data });
    });

    /** The GM's place page with the party at one of the pack's places, or at one typed by hand. */
    async function pageAt(where: typeof JETTY | typeof WRECK | 'typed') {
      const started = (await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never)) as unknown as { data: { id: string } | null };
      const trip = started.data!.id;
      const moved =
        where === 'typed'
          ? await runCommand(registry, world.db, gm(), setPlace, { campaignId: campaign, group: 1, name: '1 The jetty', placeId: null, packEntry: null })
          : await runCommand(registry, world.db, gm(), setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: 'pack-reed', packEntryId: where.id, name: where.name, data: where } });
      if (!moved.ok) throw new Error(moved.message);
      const row = (await loadGroupPlaces(world.db, campaign, trip))!.get(1)!;
      render(
        <ToastHost>
          <SceneWaitingProvider>
            <GmPlacePage db={world.db} user={gm()} campaign={{ id: campaign, name: 'The Eel Weirs', role: 'gm', line: null }} expeditionId={trip} group={1} groupLabel={null} row={row} checks={[]} recent={[]} onChanged={() => {}} />
          </SceneWaitingProvider>
        </ToastHost>,
      );
    }

    // Purpose: at the Location where the ferryman gives his call, the page draws the line after Knowledge and Rules.
    it('shows the line at the Location where a person there gives a call', async () => {
      await pageAt(JETTY);
      const line = await screen.findByRole('button', { name: 'Calls to adventure, 0 of 2 sent' });
      const knowledge = screen.getByRole('button', { name: 'Knowledge' });
      expect(knowledge.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    // Purpose: at another Location of the same adventure there is no line.
    it('draws no line at a Location with no giver there', async () => {
      await pageAt(WRECK);
      expect(await screen.findByRole('button', { name: 'Knowledge' })).toBeTruthy();
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByRole('button', { name: /Calls to adventure/ })).toBeNull();
    });

    // Purpose: at a place typed by hand there is no line, even named as a giver's place is.
    it('draws no line at a place typed by hand', async () => {
      await pageAt('typed');
      expect(await screen.findByRole('button', { name: 'Move on' })).toBeTruthy();
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByRole('button', { name: /Calls to adventure/ })).toBeNull();
    });
  });
});
