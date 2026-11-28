// @vitest-environment jsdom
// Encounter waiting on the GM console (M5b step 2; docs/05 "Encounter waiting", ruled 2026-10-30, D11 and S2-4), now
// one encounter, one card (sf-4; page 44, EN1 B to D), clicked through against the stand-in database. Invented rules.
//   A hit of the wandering check queues exactly one card, with no extra tap; it reads the row once the GM taps it:
//   "An encounter", the row's words, its creature as a detail row, the picked line, then Reveal…, Message… and Done.
//   No Start, no View, no link: Done closes the card and Undo brings it back (⚑ 2).
//   A creature's detail row opens its one pop-up; closing gives the focus back to the row.
//   A miss queues nothing; undoing the hit takes its card away.
//   A player never receives a waiting encounter.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { EncounterWaitingSource, watchChipWords } from './EncounterWaiting.tsx';
import { BookDetailPopUp } from './BookDetail.tsx';
import type { EncounterCard } from '../modules/expedition/encounterPlay.ts';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { typePlace } from '../testing/pickPlace.ts';
import { openWaiting } from '../testing/openWaiting.ts';
import { ICON_SET } from '../ui/iconSet.ts';
import { layOutStatBlock } from '../modules/library/statBlockLayout.ts';
import { openDepart, startExpedition } from '../testing/depart.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.removeItem('grimoire.lastPlace');
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  return { gm, sam, campaign };
}

/** Invented setting rules: a creeping mode whose wandering check (every turn) rolls one table naming a stat block. */
function withSetting(campaign: string, gm: string) {
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', {
    exploration: {
      modes: [
        {
          id: 'creep',
          name: 'Creeping',
          step: { value: 1, unit: 'turn' },
          procedure: [{ id: 'wander', name: 'Wandering things', icon: 'monster', kind: 'check', checkId: 'wander' }],
          checks: [{ id: 'wander', name: 'Wandering things', every: { value: 1, unit: 'turn' }, chance: { die: 'd6', on: [1] }, onHit: { tableId: 'shallows' } }],
        },
      ],
    },
  });
  entry('table', 'shallows', 'Shallow things', {
    die: 'd6',
    rows: [
      { min: 1, max: 3, result: 'Bog lurkers', count: '1d4', statBlockId: 'bog-lurker', note: 'They wait under the reeds.' },
      { min: 4, max: 6, result: 'Reed wraith' },
    ],
  });
  entry('statBlock', 'bog-lurker', 'Bog lurker', { description: 'A slow grey thing that smells of peat.', hitDice: '3', fields: { Armour: '7', Attacks: 'Bite (1d6)' }, source: 'p. 12' });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
}

/**
 * Next turn and the turn count show only while a session runs (st-1, st-2): the GM starts one, unless one runs already
 * (Depart shows only while a session runs, p2p-4, so opening the Depart sheet first started it).
 */
async function startSession(user: ReturnType<typeof userEvent.setup>) {
  const start = screen.queryByRole('button', { name: 'Start session' });
  if (start) await user.click(start);
  await screen.findByText('Session 1.');
}

async function openScene(who: string, gm: boolean, heading: string | RegExp = /^(No session yet|Downtime)$/) {
  world.signInAs(who);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: gm ? 'Campaign sections' : 'Main' })).getByRole('button', { name: 'Scene' }));
  await screen.findByRole('heading', { name: heading });
  return user;
}

const toastUndo = async (text: string | RegExp) => within((await screen.findByText(text)).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' });
const waitingCards = () => screen.queryAllByRole('region', { name: /^Encounter waiting, / });

/** Starts the expedition, moves one turn and taps Hit on the wandering check; then taps the first row of the table. */
async function hitAndRoll(user: ReturnType<typeof userEvent.setup>, afterStart?: () => void) {
  await startSession(user);
  await startExpedition(user);
  // B7: the heading names where the expedition started (the test's own place, or the helper's).
  await screen.findByRole('heading', { name: /, turn 1$/ });
  afterStart?.();
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  const due = within(await screen.findByRole('region', { name: 'Due' }));
  await user.click(due.getByRole('button', { name: 'Hit, Wandering things' }));
  // The hit queues its card by itself; Which table? opens on top (the GM's 4 taps on a hit stay 4).
  await waitFor(() => expect(world.tables.waiting_encounters).toHaveLength(1));
  const which = within(await screen.findByRole('dialog', { name: 'Wandering things, Hit' }));
  await user.click(which.getByRole('button', { name: /^Shallow things/ }));
  await user.click(within(await screen.findByRole('dialog', { name: 'Shallow things' })).getByRole('radio', { name: /Bog lurkers/ }));
  await waitFor(() => expect(world.tables.check_results[0]).toMatchObject({ row_text: 'Shallow things: Bog lurkers, 1d4' }));
  await user.click(within(screen.getByRole('dialog', { name: 'Shallow things' })).getByRole('button', { name: 'Back' }));
  await user.click(within(await screen.findByRole('dialog', { name: 'Wandering things, Hit' })).getByRole('button', { name: 'Close' }));
}

describe('Encounter waiting (M5b step 2)', () => {
  // Purpose (sf-4; EN1 B, F5 a, F6 c, ⚑ 2): a hit queues exactly one card, the only item for it: the heading "An
  // encounter", the row's words (not the table's name), its count, its creature as a detail row, the picked line with
  // the table and the row's range and "Change…", then Reveal…, Message… and Done, Done the one accent; no Start, no
  // View, no link. Done closes it (logged as played) and Undo brings it back.
  it('a hit queues exactly one card that reads the rolled row; Done closes it and Undo brings it back', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await hitAndRoll(user);
    const card = within(await screen.findByRole('region', { name: 'Encounter waiting, Wandering things, Shallow things: Bog lurkers, 1d4' }));
    expect(waitingCards()).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'Wandering things: hit' })).toBeNull();
    expect(world.tables.waiting_encounters).toHaveLength(1);
    expect(card.getByRole('heading', { name: 'An encounter' })).toBeTruthy();
    expect(card.getByText('Bog lurkers, 1d4').className).toBe('waiting-encounter__line');
    expect(card.getByText('How many: 1d4')).toBeTruthy();
    expect(card.getByText('They wait under the reeds.')).toBeTruthy();
    expect(card.getByRole('button', { name: 'Bog lurker: read it' })).toBeTruthy();
    expect(card.getByText('Shallow things, 1–3.')).toBeTruthy();
    expect(card.getByRole('button', { name: 'Change…, Shallow things' })).toBeTruthy();
    for (const gone of ['Start', 'View', 'Dismiss']) expect(card.queryByRole('button', { name: gone })).toBeNull();
    expect(document.querySelector('.waiting-encounter__link')).toBeNull();
    // The answers on one row, with their icons; Done the page's one accent (fl-2; on the place page Move on and Next
    // turn go plain while a card waits).
    const answers = [...document.querySelectorAll('.waiting-encounter .stacked-group > button')];
    expect(answers.map((b) => b.textContent)).toEqual(['Reveal…', 'Message…', 'Done']);
    expect(card.getByRole('button', { name: 'Done' }).querySelector('path')!.getAttribute('d')).toBe(ICON_SET['check-mark'].d);
    expect(card.getByRole('button', { name: 'Done' }).className).toBe('button-primary stacked-button');
    expect(document.querySelectorAll('.button-primary')).toHaveLength(1);

    await user.click(card.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(waitingCards()).toHaveLength(0));
    expect(world.tables.waiting_encounters[0]).toMatchObject({ state: 'started' });
    await user.click(await toastUndo('Encounter closed.'));
    await waitFor(() => expect(waitingCards()).toHaveLength(1));
    expect(world.tables.waiting_encounters[0]).toMatchObject({ state: 'waiting', undone: false });
  });

  describe('Reveal to players (sf-4; page 44, EN6, EN1 C, EN7 C)', () => {
    const card = () => within(screen.getByRole('region', { name: /^Encounter waiting, Wandering things/ }));
    const answers = () => [...document.querySelectorAll('.waiting-encounter .stacked-group > button')].map((b) => b.textContent);
    async function openReveal(user: ReturnType<typeof userEvent.setup>) {
      await user.click(card().getByRole('button', { name: 'Reveal…' }));
      return within(await screen.findByRole('dialog', { name: 'An encounter: Reveal to players' }));
    }

    // Purpose (EN6 A; finding 1, "Preview, then send"): "Reveal…" opens the words as the row has them, in a box the GM
    // may change, under "An encounter", with the line saying what goes; nothing reaches the players on "Reveal…", and
    // while the pop-up is open its "Show players" is the screen's one accent (the card's Done drawn plain).
    it('Reveal… opens the row’s words and sends nothing; Show players is the one accent while it is open', async () => {
      const { gm, campaign } = table();
      withSetting(campaign, gm);
      const user = await openScene(gm, true);
      await hitAndRoll(user);
      const pop = await openReveal(user);
      expect(pop.getByText('An encounter')).toBeTruthy();
      expect(pop.getByRole('textbox', { name: 'What players will see' })).toHaveProperty('value', 'Bog lurkers, 1d4');
      expect(pop.getByText('Players get these words and nothing else.')).toBeTruthy();
      expect(world.tables.check_reveals).toHaveLength(0);
      expect(document.querySelectorAll('.button-primary')).toHaveLength(1);
      expect(pop.getByRole('button', { name: 'Show players' }).className).toContain('button-primary');
      // The X sends nothing, and Done is the accent again.
      await user.click(pop.getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'An encounter: Reveal to players' })).toBeNull());
      expect(world.tables.check_reveals).toHaveLength(0);
      expect(card().getByRole('button', { name: 'Done' }).className).toContain('button-primary');
    });

    // Purpose (EN6 B, C; EN1 C; sf-7a's hidden data): "Show players" sends only the words in the box, cut by the GM,
    // and nothing of the check (the result stays unrevealed); after it no button has moved: "Reveal…" is the pressed
    // "Revealed" and a line quotes what the players see. The toast's Undo takes the reveal back.
    it('Show players sends only the words in the box; Reveal… becomes the pressed Revealed in its place; Undo takes it back', async () => {
      const { gm, campaign } = table();
      withSetting(campaign, gm);
      const user = await openScene(gm, true);
      await hitAndRoll(user);
      const pop = await openReveal(user);
      const box = pop.getByRole('textbox', { name: 'What players will see' });
      await user.clear(box);
      await user.type(box, 'Grey shapes in the reeds');
      await user.click(pop.getByRole('button', { name: 'Show players' }));
      await screen.findByText('Shown to the players.');
      expect(world.tables.check_reveals).toHaveLength(1);
      expect(world.tables.check_reveals[0]).toMatchObject({ words: 'Grey shapes in the reeds', taken_back: false });
      expect(world.tables.check_results[0]).toMatchObject({ revealed: false });
      const revealed = await card().findByRole('button', { name: 'Revealed: take it back' });
      expect(revealed.getAttribute('aria-pressed')).toBe('true');
      expect(revealed.textContent).toBe('Revealed');
      expect(answers()).toEqual(['Revealed', 'Message…', 'Done']);
      expect(card().getByText('Players see: “Grey shapes in the reeds”')).toBeTruthy();
      expect(card().getByRole('button', { name: 'Done' }).className).toContain('button-primary');

      await user.click(await toastUndo('Shown to the players.'));
      await waitFor(() => expect(world.tables.check_reveals[0]).toMatchObject({ taken_back: true }));
      expect(await card().findByRole('button', { name: 'Reveal…' })).toBeTruthy();
      expect(card().queryByText(/^Players see:/)).toBeNull();
    });

    // Purpose (EN1 C): a tap on the pressed "Revealed" takes the reveal back at once (players stop reading the words),
    // and the toast's Undo shows the same words again.
    it('a tap on Revealed takes the reveal back; Undo shows the same words again', async () => {
      const { gm, campaign } = table();
      withSetting(campaign, gm);
      const user = await openScene(gm, true);
      await hitAndRoll(user);
      await user.click((await openReveal(user)).getByRole('button', { name: 'Show players' }));
      await user.click(await card().findByRole('button', { name: 'Revealed: take it back' }));
      await screen.findByText('Taken back from the players.');
      expect(world.tables.check_reveals[0]).toMatchObject({ taken_back: true });
      expect(await card().findByRole('button', { name: 'Reveal…' })).toBeTruthy();
      expect(answers()).toEqual(['Reveal…', 'Message…', 'Done']);

      await user.click(await toastUndo('Taken back from the players.'));
      await waitFor(() => expect(world.tables.check_reveals.filter((r) => !r.taken_back)).toHaveLength(1));
      expect(world.tables.check_reveals.find((r) => !r.taken_back)).toMatchObject({ words: 'Bog lurkers, 1d4' });
      expect(await card().findByRole('button', { name: 'Revealed: take it back' })).toBeTruthy();
    });

    // Purpose (EN6 E; hard rule 10, never a disabled button): with nothing written "Show players" stays a button; a tap
    // sends nothing and the line says why; the pop-up stays open.
    it('Show players with nothing written sends nothing and says why', async () => {
      const { gm, campaign } = table();
      withSetting(campaign, gm);
      const user = await openScene(gm, true);
      await hitAndRoll(user);
      const pop = await openReveal(user);
      const box = pop.getByRole('textbox', { name: 'What players will see' });
      await user.clear(box);
      await user.type(box, '   ');
      const go = pop.getByRole('button', { name: 'Show players' });
      expect(go.hasAttribute('disabled')).toBe(false);
      await user.click(go);
      expect(pop.getByRole('alert').textContent).toContain('Write what the players will see.');
      expect(world.tables.check_reveals).toHaveLength(0);
      expect(screen.getByRole('dialog', { name: 'An encounter: Reveal to players' })).toBeTruthy();
    });

    // Purpose (N5; EN7 C): a send the server refuses, or that drops mid-way, has sent nothing: N5's words in a toast
    // with no Undo, the card as before ("Reveal…", not pressed, no line); "Reveal…" opens the GM's words again.
    it('a send that fails says so with no Undo, leaves Reveal… unpressed, and keeps the words for the next try', async () => {
      const { gm, campaign } = table();
      withSetting(campaign, gm);
      const user = await openScene(gm, true);
      await hitAndRoll(user);
      const pop = await openReveal(user);
      const box = pop.getByRole('textbox', { name: 'What players will see' });
      await user.clear(box);
      await user.type(box, 'Grey shapes');
      const real = world.db.rpc.bind(world.db);
      const spy = vi.spyOn(world.db, 'rpc').mockImplementation(((name: string, args: Record<string, unknown>) =>
        name === 'show_check_words' ? Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) : real(name as never, args as never)) as never);
      await user.click(pop.getByRole('button', { name: 'Show players' }));
      const toast = (await screen.findByText("Couldn't show the players. Nothing was sent. Tap Reveal… to try again.")).closest('.toast') as HTMLElement;
      expect(within(toast).queryByRole('button', { name: 'Undo' })).toBeNull();
      expect(world.tables.check_reveals).toHaveLength(0);
      const reveal = card().getByRole('button', { name: 'Reveal…' });
      expect(reveal.hasAttribute('aria-pressed')).toBe(false);
      expect(card().queryByText(/^Players see:/)).toBeNull();
      spy.mockRestore();
      expect((await openReveal(user)).getByRole('textbox', { name: 'What players will see' })).toHaveProperty('value', 'Grey shapes');
    });

    // Purpose (finding 9 of #126's review): "Change…" on a revealed card leaves the players' words as they are (only the
    // GM's tap changes their screen), and the change's toast says the players still see the earlier words.
    it('Change… on a revealed card keeps the reveal and says the players still see the earlier words', async () => {
      const { gm, campaign } = table();
      withSetting(campaign, gm);
      const user = await openScene(gm, true);
      await hitAndRoll(user);
      await user.click((await openReveal(user)).getByRole('button', { name: 'Show players' }));
      await card().findByRole('button', { name: 'Revealed: take it back' });
      await user.click(card().getByRole('button', { name: 'Change…, Shallow things' }));
      await user.click(within(await screen.findByRole('dialog', { name: 'Shallow things' })).getByRole('radio', { name: /Reed wraith/ }));
      expect(await screen.findByText(/^4–6: .*Reed wraith.*\. Players still see the earlier words\.$/)).toBeTruthy();
      expect(world.tables.check_reveals).toHaveLength(1);
      expect(world.tables.check_reveals[0]).toMatchObject({ words: 'Bog lurkers, 1d4', taken_back: false });
    });

    // Purpose (finding 4 of #126's review): "Show players" tapped while another change is still saving sends nothing and
    // says so in a toast (the pop-up has closed, so the tap is never dropped silently); the GM's words wait for the next try.
    it('Show players while another change is saving says so, and keeps the words', async () => {
      const { gm, campaign } = table();
      withSetting(campaign, gm);
      const user = await openScene(gm, true);
      await hitAndRoll(user);
      const real = world.db.rpc.bind(world.db);
      let release: () => void = () => undefined;
      const held = new Promise<void>((done) => (release = done));
      const spy = vi.spyOn(world.db, 'rpc').mockImplementation(((name: string, args: Record<string, unknown>) =>
        name === 'show_check_words' ? held.then(() => real(name as never, args as never)) : real(name as never, args as never)) as never);
      await user.click((await openReveal(user)).getByRole('button', { name: 'Show players' }));
      const again = await openReveal(user);
      await user.clear(again.getByRole('textbox', { name: 'What players will see' }));
      await user.type(again.getByRole('textbox', { name: 'What players will see' }), 'Grey shapes');
      await user.click(again.getByRole('button', { name: 'Show players' }));
      expect(await screen.findByText('Another change was still saving. Tap Reveal… to try again.')).toBeTruthy();
      expect((await openReveal(user)).getByRole('textbox', { name: 'What players will see' })).toHaveProperty('value', 'Grey shapes');
      release();
      await screen.findByText('Shown to the players.');
      expect(world.tables.check_reveals).toHaveLength(1);
      spy.mockRestore();
    });
  });

  // Purpose (sf-4; ⚑ 2): Message… puts the row's words, and nothing of the check, into a new message.
  it('Message… opens a new message with the row’s words', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await hitAndRoll(user);
    const card = within(await screen.findByRole('region', { name: /^Encounter waiting, Wandering things/ }));
    await user.click(card.getByRole('button', { name: 'Message…' }));
    expect(await screen.findByDisplayValue('Bog lurkers, 1d4')).toBeTruthy();
  });

  // Purpose (st-2, page 16, superseding the #785 review's "Next turn keeps the accent"): without the GM's place page
  // (a town keeps today's card until 5t) a waiting card's first action holds the one accent, and Next turn is never it.
  it('in a town, with no place page, the waiting card\'s Done holds the accent and Next turn is never the accent', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await typePlace(user, 'Quay Gate', /^Where\?:/, await openDepart(user));
    // Marked Safe straight after the start (a town before the ruling), so the next reload shows the town's card.
    await hitAndRoll(user, () => {
      for (const p of world.tables.places) p.safety = 'safe';
    });
    const card = within(await screen.findByRole('region', { name: /^Encounter waiting, Wandering things/ }));
    await screen.findByRole('button', { name: 'Change place' });
    expect(document.querySelector('.place-page')).toBeNull();
    expect(screen.getByRole('button', { name: 'Next turn' }).className).not.toContain('button-primary');
    expect(card.getByRole('button', { name: 'Done' }).className).toBe('button-primary stacked-button');
    expect(document.querySelectorAll('.button-primary')).toHaveLength(1);
  });

  // Purpose (sf-6a; EN3, F5 c; sf-4: on the card itself): the creature's detail row on the card is one button, "<name>: read it"; its
  // tap opens one pop-up headed by the creature's name with the X on that line and no title line over it, showing the
  // stat block in full as the Rules browser lays it out, with its source; closing it gives the focus back to the row,
  // and nothing changes.
  it('opens a creature’s pop-up from its detail row, and closing returns focus to the row', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await hitAndRoll(user);
    const view = within(await screen.findByRole('region', { name: /^Encounter waiting, Wandering things/ }));
    const row = view.getByRole('button', { name: 'Bog lurker: read it' });
    // The whole row is the one button: its name and stat line are inside it.
    expect(row.textContent).toBe('Bog lurkerArmour 7 Attacks Bite (1d6)');
    await user.click(row);
    const popUp = await screen.findByRole('dialog', { name: 'Bog lurker' });
    const head = popUp.querySelector('.dialog__head')!;
    expect([...popUp.querySelectorAll('h2')].map((h) => h.textContent)).toEqual(['Bog lurker']);
    expect(within(head as HTMLElement).getByRole('heading', { name: 'Bog lurker' })).toBeTruthy();
    expect(within(head as HTMLElement).getByRole('button', { name: 'Close' })).toBeTruthy();
    const block = within(popUp);
    expect(block.getByText('A slow grey thing that smells of peat.')).toBeTruthy();
    expect(block.getByText('From your setting: Fen Rules, p. 12')).toBeTruthy();
    expect([...popUp.querySelectorAll('.stat-block__label')].map((l) => l.textContent)).toEqual(['Armour', 'Attacks']);
    expect(block.queryByRole('button', { name: /Back to the encounter/ })).toBeNull();
    await user.click(within(head as HTMLElement).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Bog lurker' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(view.getByRole('button', { name: 'Bog lurker: read it' })));
    // Escape closes the detail pop-up, and focus is back on the row.
    await user.click(view.getByRole('button', { name: 'Bog lurker: read it' }));
    await screen.findByRole('dialog', { name: 'Bog lurker' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Bog lurker' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(view.getByRole('button', { name: 'Bog lurker: read it' })));
    expect(world.tables.waiting_encounters[0]).toMatchObject({ state: 'waiting' });
  });

  // Purpose (#642 review): a stat block with no notes, no lines and no source still shows its name and how many in its
  // pop-up, with nothing drawn empty.
  it('a bare stat block shows its name and how many, and nothing empty', () => {
    render(<BookDetailPopUp detail={{ name: 'Reed wisp', count: '2', shown: layOutStatBlock({ name: 'Reed wisp' }, null), source: null }} onClose={() => undefined} />);
    const popUp = within(screen.getByRole('dialog', { name: 'Reed wisp' }));
    expect(popUp.getByRole('heading', { name: 'Reed wisp' })).toBeTruthy();
    expect(popUp.getByText('How many: 2')).toBeTruthy();
    expect(popUp.queryByRole('list')).toBeNull();
    expect(document.querySelector('.stat-block__descriptor, .stat-block__rule, .stat-block__ability, .stat-block__line')).toBeNull();
  });

  // Purpose (December 5c, frame 1): the block reads in the pack's order: description, the descriptor line, the figures
  // in the pack's groups with a rule between, then each ability with its name as a lead-in; a die it names carries its
  // glyph, and a die the app has no glyph for (d3) none.
  it('lays the block out by its pack: descriptor, groups with a rule between, abilities, dice glyphs', () => {
    const shown = layOutStatBlock(
      {
        name: 'Reed hag',
        description: 'Old, patient, and hungry.',
        hp: '5d8',
        hpAverage: 22,
        fields: { Size: 'Medium fey', Wits: 'cunning', Armour: '5', Attacks: '2 claws (1d4) or a hex (1d3)', Met: '1' },
        abilities: [{ name: 'Reed walk', note: 'Steps from one reed bed to another, once a day.' }],
      },
      { descriptor: ['Size', 'Wits'], groups: [[['Armour', 'hp'], ['Attacks']], [['Met']]], hide: [] },
    );
    render(<BookDetailPopUp detail={{ name: 'Reed hag', shown, source: 'From your setting: Fen Rules, p. 31' }} onClose={() => undefined} />);
    const block = screen.getByRole('dialog', { name: 'Reed hag' });
    expect(within(block).getByText('Medium fey, cunning')).toBeTruthy();
    expect([...block.querySelectorAll('.stat-block__line')].map((l) => l.textContent)).toEqual(['Armour 5 Hit points 5d8 (22)', 'Attacks 2 claws (1d4) or a hex (1d3)', 'Met 1']);
    expect(block.querySelectorAll('.stat-block__rule')).toHaveLength(1);
    expect([...block.querySelectorAll('.stat-block__ability')].map((p) => p.textContent)).toEqual(['Reed walk: Steps from one reed bed to another, once a day.']);
    expect([...block.querySelectorAll('[data-die]')].map((d) => d.getAttribute('data-die'))).toEqual(['8', '4']);
    expect(within(block).getByText('From your setting: Fen Rules, p. 31')).toBeTruthy();
  });

  it('a miss queues nothing; undoing the hit takes its card away', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await startSession(user);
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await user.click(within(await screen.findByRole('region', { name: 'Due' })).getByRole('button', { name: 'Miss, Wandering things' }));
    await screen.findByText(/Wandering things: a miss/);
    expect(world.tables.waiting_encounters).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 3' });
    await user.click(within(await screen.findByRole('region', { name: 'Due' })).getByRole('button', { name: 'Hit, Wandering things' }));
    await waitFor(() => expect(world.tables.waiting_encounters).toHaveLength(1));
    await user.click(within(await screen.findByRole('dialog', { name: 'Wandering things, Hit' })).getByRole('button', { name: 'Close' }));
    // S8b: the hit itself is open first in "Waiting for you"; the encounter it queued is opened from its row.
    await openWaiting(user, 'An encounter: Wandering things');
    await waitFor(() => expect(waitingCards()).toHaveLength(1));
    await user.click(await toastUndo(/^Wandering things: a hit/));
    await waitFor(() => expect(waitingCards()).toHaveLength(0));
  });

  it('a player never receives a waiting encounter', async () => {
    const { gm, sam, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await hitAndRoll(user);
    await screen.findByRole('region', { name: /^Encounter waiting, / });
    cleanup();
    world.signInAs(sam);
    expect((await world.db.from('waiting_encounters').select('*').eq('campaign_id', campaign)).data).toEqual([]);
    await openScene(sam, false, /^Creeping/);
    expect(waitingCards()).toHaveLength(0);
    expect(screen.queryByText('Encounter waiting')).toBeNull();
    // Stat blocks are the GM's (December 5c): a player's screen never shows a stat line or a stat block.
    expect(document.querySelector('.stat-line, .stat-block')).toBeNull();
    expect(screen.queryByText(/Bite \(1d6\)/)).toBeNull();
    expect((await world.db.from('library_entries').select('*').eq('kind', 'statBlock')).data ?? []).toEqual([]);
  });
});

// The card on its own (fl-2): Start the accent only when the console has none; Which watch? as chips.
describe('the Encounter waiting card (fl-2)', () => {
  const hit = (id: string): EncounterCard['hit'] => ({
    id, campaignId: 'c', expeditionId: 'e', checkKey: `mode:${id}`, name: 'Night prowlers', source: 'mode', outcome: 'hit', atSeconds: 0, modifiers: [], note: null, tableId: null, roll: null, rowText: 'Bog lurkers', revealed: false, secret: true, version: 1,
  });
  const card = (id: string, watch: string | null = null): EncounterCard => ({
    encounter: { id, campaignId: 'c', expeditionId: 'e', checkResultId: id, watch, state: 'waiting', createdAt: '2026-11-03T20:00:00Z', version: 1 },
    hit: hit(id),
  });
  const cards = (list: EncounterCard[], extra: Partial<Parameters<typeof EncounterWaitingSource>[0]> = {}) =>
    render(<EncounterWaitingSource cards={list} tables={new Map()} statBlock={() => null} onDone={() => undefined} {...extra} />);

  // Purpose: with no other accent on the console, Done is the accent, and only on the first card (one per screen).
  it("makes the first card's Done the accent only when asked, never two", () => {
    cards([card('a'), card('b')], { accent: true });
    const starts = screen.getAllByRole('button', { name: 'Done' });
    // S8b (T2): stacked buttons, the accent the primary one.
    expect(starts.map((b) => b.className)).toEqual(['button-primary stacked-button', 'button-secondary stacked-button']);
    cleanup();
    cards([card('a')]);
    expect(screen.getByRole('button', { name: 'Done' }).className).toBe('button-secondary stacked-button');
  });

  // Purpose (sf-4): with no row picked yet the card says so in plain words; given the check's own words for its hit,
  // those stand in their place; nothing on the card is a link.
  it('says "No row picked yet." in plain words, or the check’s own words', () => {
    const unrolled: EncounterCard = { ...card('a'), hit: { ...hit('a'), rowText: null } };
    cards([unrolled]);
    expect(screen.getByText('No row picked yet.').className).toBe('waiting-encounter__line');
    expect(screen.queryByRole('button', { name: /No row picked yet/ })).toBeNull();
    cleanup();
    cards([unrolled], { noteFor: () => 'Something stirs in the reeds.' });
    expect(screen.getByText('Something stirs in the reeds.').className).toBe('waiting-encounter__line');
    expect(screen.queryByText('No row picked yet.')).toBeNull();
    cleanup();
    cards([card('b')]);
    expect(screen.getByText('Bog lurkers').tagName).toBe('P');
  });

  // Purpose: Which watch? offers each watch as a chip ("1st · Reed, Moss") and answers with the watch's full words.
  it('asks Which watch? with chips that read "1st: Reed, Moss"', async () => {
    const onWatch = vi.fn();
    cards([card('a')], { watchChoices: () => ['1st watch: Reed, Moss', '2nd watch: Fern'], onWatch });
    // S8b (T2): "Who is awake…", a stacked button, opens the watches' chips.
    await userEvent.click(screen.getByRole('button', { name: 'Who is awake…' }));
    const which = within(screen.getByRole('group', { name: 'Which watch?' }));
    expect(which.getAllByRole('button').map((b) => [b.textContent, b.className])).toEqual([
      ['1st: Reed, Moss', 'chip'],
      ['2nd: Fern', 'chip'],
    ]);
    await userEvent.click(which.getByRole('button', { name: '2nd: Fern' }));
    expect(onWatch).toHaveBeenCalledWith(expect.objectContaining({ encounter: expect.objectContaining({ id: 'a' }) }), '2nd watch: Fern');
    expect(watchChipWords('12th watch')).toBe('12th');
  });

  // Purpose (bug: the details read "2nd watch · Moss watch"): the card says who was awake in its own words.
  it('says who was awake without a doubled "watch"', () => {
    cards([card('a', '2nd watch · Moss')]);
    expect(screen.getByText('Awake: 2nd watch: Moss')).toBeTruthy();
  });
});
