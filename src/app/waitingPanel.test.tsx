// @vitest-environment jsdom
// "Waiting for you" as the one working panel (S8a of docs/plans/dec-9-the-whole-scene.md; st-1, wy-1; page 16, frames
// T2, T6b, T8b). Invented items only. In plain words:
//   * the panel lists what waits in the model's order: the first a whole card, the rest one-line rows (the mark, the
//     title, one button), with the count "1 of 4" naming which one is open of how many; with one waiting, no count;
//   * past four, three are drawn and the fourth place is "N more" ("1 of 7"); a tap on it opens what it holds;
//   * a tap on a row's title opens it whole and the count takes its number ("3 of 4"); the open one answered, the next
//     opens and the total drops;
//   * a row's one button answers through its source (an encounter's Start starts it);
//   * "Nothing waits." when nothing does; where the page keeps the panel quiet, it is out of sight instead;
//   * the open item's first action is the page's one accent (an encounter's Start), never a row's button and never two;
//     with the panel there, no other part claims it;
//   * one panel a provider: a split party's second place page draws none;
//   * without a panel (a town), the strip's encounter cards stand where the strip draws them, all of them, as before.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EncounterCard } from '../modules/expedition/encounterPlay.ts';
import { EncounterWaitingSource } from './EncounterWaiting.tsx';
import { WaitingPanel } from './WaitingForYou.tsx';
import { SceneWaitingProvider, useExpectPanel, useWaitingPanel, WaitingSource, type WaitingSourceItem } from './sceneWaiting.tsx';

afterEach(cleanup);

/** One item of a kind, its card a region named by its title, its answers as given. */
const item = (id: string, kind: WaitingSourceItem['kind'], title: string, ...answers: string[]): WaitingSourceItem => ({
  id,
  kind,
  title,
  actions: answers.map((label) => ({ id: label, label })),
  card: (
    <section aria-label={title}>
      <p>{title}</p>
    </section>
  ),
});

/** The panel as WaitingForYou hosts it. */
function Panel({ quiet = false }: { quiet?: boolean }) {
  const hosting = useWaitingPanel()?.hosting;
  return hosting ? <WaitingPanel quiet={quiet} /> : null;
}

function show(sources: Record<string, WaitingSourceItem[]>, opts: { quiet?: boolean; panels?: number } = {}) {
  return render(
    <SceneWaitingProvider>
      {Object.entries(sources).map(([key, items]) => (
        <WaitingSource key={key} sourceKey={key} items={items} />
      ))}
      {Array.from({ length: opts.panels ?? 1 }, (_, i) => (
        <Panel key={i} quiet={opts.quiet} />
      ))}
    </SceneWaitingProvider>,
  );
}

const panel = () => within(screen.getByRole('region', { name: 'Waiting for you' }));
/** What the panel draws, top to bottom: "card:<title>", "row:<title>" or "more:<words>". */
const drawn = () =>
  [...document.querySelectorAll('.waiting-card > .waiting-open, .waiting-card > .waiting-row')].map((el) =>
    el.classList.contains('waiting-open')
      ? `card:${el.querySelector('section')?.getAttribute('aria-label') ?? ''}`
      : el.classList.contains('waiting-row--more')
        ? `more:${el.textContent}`
        : `row:${el.querySelector('.waiting-row__title')?.textContent ?? ''}`,
  );
const count = () => document.querySelector('.waiting-card__count')?.textContent ?? null;

// T2's four, from two sources and in the wrong order: the model's order wins.
const T2 = () => ({
  later: [item('reminder:1', 'reminder', 'The tide turns', 'Done'), item('weather:1', 'weather', 'Weather: to roll', 'Enter…'), item('rest:1', 'rest', 'Rest is due', 'Answer…')],
  strip: [item('encounter:1', 'encounter', 'An encounter waits', 'Start', 'Dismiss')],
});

describe('the panel (S8a; T2, T6b)', () => {
  // Purpose: what waits is listed in the model's order; the first is a whole card, the rest one-line rows; the count
  // says which one is open of how many.
  it('draws the first whole and the rest as rows, in the ruled order, with "1 of 4"', async () => {
    show(T2());
    await waitFor(() => expect(drawn()).toEqual(['card:An encounter waits', 'row:Rest is due', 'row:Weather: to roll', 'row:The tide turns']));
    expect(count()).toBe('1 of 4');
    // A row is the mark, the title and its one button (the first answer).
    expect(panel().getByRole('button', { name: 'Answer…, Rest is due' })).toBeTruthy();
    expect(panel().queryByText('Nothing waits.')).toBeNull();
  });

  // Purpose: with one thing waiting there is no count (wy-1).
  it('shows no count with one waiting', async () => {
    show({ strip: [item('encounter:1', 'encounter', 'An encounter waits', 'Start')] });
    await waitFor(() => expect(drawn()).toEqual(['card:An encounter waits']));
    expect(count()).toBeNull();
  });

  // Purpose: past four, the first is whole, two rows, then "N more" in the fourth place, counted "1 of 7" (T6b); a tap
  // on "N more" opens the first it holds, drawn in the last place before it.
  it('holds the rest in "N more" past four, and opens what it holds', async () => {
    const user = userEvent.setup();
    show({ strip: [item('encounter:1', 'encounter', 'An encounter waits', 'Start')], later: [item('rest:1', 'rest', 'Rest is due', 'Answer…'), item('weather:1', 'weather', 'Weather: to roll', 'Enter…'), ...['The tide turns', 'Count the eels', 'Light the beacon', 'Bail the boat'].map((t, i) => item(`reminder:${i}`, 'reminder', t, 'Done'))] });
    await waitFor(() => expect(drawn()).toEqual(['card:An encounter waits', 'row:Rest is due', 'row:Weather: to roll', 'more:4 more']));
    expect(count()).toBe('1 of 7');
    await user.click(panel().getByRole('button', { name: '4 more' }));
    expect(drawn()).toEqual(['row:An encounter waits', 'row:Rest is due', 'card:The tide turns', 'more:4 more']);
    expect(count()).toBe('4 of 7');
  });

  // Purpose: a tap on a row opens it whole, in its own place, and the count takes its number; the open one answered
  // (gone from what waits), the next opens and the total drops.
  it('opens a row whole on a tap, and the next when the open one is answered', async () => {
    const user = userEvent.setup();
    function Answerable() {
      const [left, setLeft] = useState(T2().later);
      const answer = (id: string) => setLeft((was) => was.filter((x) => x.id !== id));
      const answered = left.map((i) => ({
        ...i,
        onAction: () => answer(i.id),
        card: (
          <section aria-label={i.title}>
            <button type="button" onClick={() => answer(i.id)}>{`Answer ${i.title}`}</button>
          </section>
        ),
      }));
      return <WaitingSource sourceKey="later" items={answered} />;
    }
    render(
      <SceneWaitingProvider>
        <WaitingSource sourceKey="strip" items={T2().strip} />
        <Answerable />
        <Panel />
      </SceneWaitingProvider>,
    );
    await waitFor(() => expect(count()).toBe('1 of 4'));
    await user.click(panel().getByRole('button', { name: 'Open: Weather: to roll' }));
    expect(drawn()).toEqual(['row:An encounter waits', 'row:Rest is due', 'card:Weather: to roll', 'row:The tide turns']);
    expect(count()).toBe('3 of 4');
    expect(panel().getByRole('region', { name: 'Weather: to roll' })).toBeTruthy();
    // Another answered (from its row): the open one stays open, and the total drops.
    await user.click(panel().getByRole('button', { name: 'Answer…, Rest is due' }));
    await waitFor(() => expect(count()).toBe('2 of 3'));
    expect(drawn()).toEqual(['row:An encounter waits', 'card:Weather: to roll', 'row:The tide turns']);
    // The open one answered (in its card): the next opens, and the total drops.
    await user.click(panel().getByRole('button', { name: 'Answer Weather: to roll' }));
    await waitFor(() => expect(count()).toBe('2 of 2'));
    expect(drawn()).toEqual(['row:An encounter waits', 'card:The tide turns']);
  });

  // Purpose: "Nothing waits." when nothing does; a quiet panel (spots here, a phone) is out of sight instead.
  it('says "Nothing waits." when empty, and is out of sight where the page keeps it quiet', () => {
    show({});
    expect(panel().getByText('Nothing waits.')).toBeTruthy();
    expect(count()).toBeNull();
    cleanup();
    const { container } = show({}, { quiet: true });
    expect(container.querySelector('section.waiting-card')?.hasAttribute('hidden')).toBe(true);
  });

  // Purpose (split party): one panel a provider; a second place page's draws nothing, so nothing shows twice.
  it('draws one panel even where two pages ask', async () => {
    show(T2(), { panels: 2 });
    await waitFor(() => expect(screen.getAllByRole('region', { name: 'Waiting for you' })).toHaveLength(1));
  });

  // Purpose (#857's review): when the page holding the panel goes (its group walks into town), the other group's page
  // takes it over at once, with no remount.
  it('hands the panel to the second page when the first goes', async () => {
    const view = (pages: string[]) => (
      <SceneWaitingProvider>
        <WaitingSource sourceKey="strip" items={T2().strip} />
        {pages.map((p) => (
          <section key={p} aria-label={p}>
            <Panel />
          </section>
        ))}
      </SceneWaitingProvider>
    );
    const { rerender } = render(view(['Group 1', 'Group 2']));
    expect(within(screen.getByRole('region', { name: 'Group 1' })).getByRole('region', { name: 'Waiting for you' })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Group 2' })).queryByRole('region', { name: 'Waiting for you' })).toBeNull();
    rerender(view(['Group 2']));
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Group 2' })).getByRole('region', { name: 'Waiting for you' })).toBeTruthy());
    expect(within(screen.getByRole('region', { name: 'Group 2' })).getByRole('region', { name: 'An encounter waits' })).toBeTruthy();
  });

  // Purpose (S8b): taps on "N more" go through everything it holds, each the next after the open one, wrapping round
  // to the first held (in S8a two taps could swap the same pair for ever).
  it('goes through what "N more" holds, tap by tap, wrapping round', async () => {
    const user = userEvent.setup();
    show({ strip: [item('encounter:1', 'encounter', 'An encounter waits', 'Start')], later: [item('rest:1', 'rest', 'Rest is due', 'Answer…'), item('weather:1', 'weather', 'Weather: to roll', 'Enter…'), ...['The tide turns', 'Count the eels', 'Light the beacon', 'Bail the boat'].map((t, i) => item(`reminder:${i}`, 'reminder', t, 'Done'))] });
    await waitFor(() => expect(count()).toBe('1 of 7'));
    const seen: (string | null)[] = [];
    for (let i = 0; i < 5; i++) {
      await user.click(panel().getByRole('button', { name: /^\d+ more$/ }));
      seen.push(count());
    }
    expect(seen).toEqual(['4 of 7', '5 of 7', '6 of 7', '7 of 7', '3 of 7']);
  });

  // Purpose (S8b, the fault found in S8a's pictures): while the place page, and with it the panel, is still loading,
  // the strip keeps what waits out of sight instead of drawing it for a moment; the panel then takes it.
  it('keeps the cards out of the strip while a panel is coming, and the panel then takes them', async () => {
    function Coming({ page }: { page: boolean }) {
      useExpectPanel(true);
      return page ? <Panel /> : null;
    }
    const view = (page: boolean) => (
      <SceneWaitingProvider>
        <section aria-label="The strip">
          <WaitingSource sourceKey="strip" items={T2().strip} />
        </section>
        <Coming page={page} />
      </SceneWaitingProvider>
    );
    const { rerender } = render(view(false));
    expect(within(screen.getByRole('region', { name: 'The strip' })).queryByRole('region', { name: 'An encounter waits' })).toBeNull();
    rerender(view(true));
    expect(await panel().findByRole('region', { name: 'An encounter waits' })).toBeTruthy();
  });

  // Purpose (#857's review): a row opened by a tap gives its card the focus, so a keyboard user keeps their place.
  it('moves the focus into a row’s card when it is opened', async () => {
    const user = userEvent.setup();
    const answerable = T2().later.map((i) => ({ ...i, card: <section aria-label={i.title}><button type="button">{`Answer ${i.title}`}</button></section> }));
    show({ strip: T2().strip, later: answerable });
    await user.click(await panel().findByRole('button', { name: 'Open: Weather: to roll' }));
    expect(document.activeElement).toBe(panel().getByRole('button', { name: 'Answer Weather: to roll' }));
  });

  // Purpose (#857's review): while the encounters can't be read, the panel says so and never "Nothing waits.".
  it('never says "Nothing waits." while the encounters could not be read', async () => {
    render(
      <SceneWaitingProvider>
        <EncounterWaitingSource cards={null} tables={new Map()} statBlock={() => null} when={() => null} onStart={async () => false} onDismiss={() => undefined} />
        <Panel />
      </SceneWaitingProvider>,
    );
    expect(await panel().findByText(/Couldn't load the waiting encounters/)).toBeTruthy();
    expect(panel().queryByText('Nothing waits.')).toBeNull();
  });
});

describe('the encounters as a source, and the one accent (st-2, mc-27)', () => {
  const hit = (id: string, name: string): EncounterCard['hit'] => ({
    id, campaignId: 'c', expeditionId: 'e', checkKey: `mode:${id}`, name, source: 'mode', outcome: 'hit', atSeconds: 0, modifiers: [], note: null, tableId: null, roll: null, rowText: name, revealed: false, secret: true, version: 1,
  });
  const card = (id: string, name: string): EncounterCard => ({
    encounter: { id, campaignId: 'c', expeditionId: 'e', checkResultId: id, watch: null, state: 'waiting', createdAt: '2026-11-03T20:00:00Z', version: 1 },
    hit: hit(id, name),
  });
  const source = (onStart = vi.fn(async () => false)) => (
    <EncounterWaitingSource cards={[card('a', 'Night prowlers'), card('b', 'Reed wraiths')]} tables={new Map()} statBlock={() => null} when={() => null} onStart={onStart} onDismiss={() => undefined} accent />
  );

  // Purpose: the open item's first action is the page's one accent; a row's button never is; tapping another row moves
  // the accent with it.
  it('gives the accent to the open encounter’s Start alone, and moves it with the open one', async () => {
    const user = userEvent.setup();
    render(
      <SceneWaitingProvider>
        {source()}
        <Panel />
      </SceneWaitingProvider>,
    );
    const open = within(await screen.findByRole('region', { name: /^Encounter waiting, Night prowlers/ }));
    expect(open.getByRole('button', { name: 'Start' }).className).toBe('button-primary stacked-button');
    expect(panel().getByRole('button', { name: 'Start, Reed wraiths' }).className).toBe('button-secondary stacked-button');
    expect(document.querySelectorAll('.button-primary')).toHaveLength(1);
    await user.click(panel().getByRole('button', { name: 'Open: Reed wraiths' }));
    const second = within(await screen.findByRole('region', { name: /^Encounter waiting, Reed wraiths/ }));
    expect(second.getByRole('button', { name: 'Start' }).className).toBe('button-primary stacked-button');
    expect(document.querySelectorAll('.button-primary')).toHaveLength(1);
    // The first is a row now: its card is not on the page.
    expect(screen.queryByRole('region', { name: /^Encounter waiting, Night prowlers/ })).toBeNull();
  });

  // Purpose: a row's one button answers through its source: an encounter's Start on its row starts that encounter.
  it('starts an encounter from its row', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn(async () => false);
    render(
      <SceneWaitingProvider>
        {source(onStart)}
        <Panel />
      </SceneWaitingProvider>,
    );
    await user.click(await panel().findByRole('button', { name: 'Start, Reed wraiths' }));
    expect(onStart).toHaveBeenCalledOnce();
    expect((onStart.mock.calls[0] as unknown as [EncounterCard])[0].hit.name).toBe('Reed wraiths');
  });

  // Purpose: with no panel (a town keeps today's screen), every waiting card stands where the strip draws them, the
  // first's Start the accent, as before.
  it('stands where the strip draws it while no panel shows', async () => {
    render(
      <SceneWaitingProvider>
        <section aria-label="The strip">{source()}</section>
      </SceneWaitingProvider>,
    );
    const strip = within(screen.getByRole('region', { name: 'The strip' }));
    await waitFor(() => expect(strip.getAllByRole('region', { name: /^Encounter waiting, / })).toHaveLength(2));
    expect(strip.getAllByRole('button', { name: 'Start' }).map((b) => b.className)).toEqual(['button-primary stacked-button', 'button-secondary stacked-button']);
  });
});
