// @vitest-environment jsdom
// The card after an expedition ends, its screen half (S19 of docs/plans/dec-9-the-whole-scene.md; ap-11; page 16,
// frames 16-T11 to 16-T11d). Invented names and rules only. In plain words:
//   1. The head holds the flag, "Expedition ended" and the app's Undo (its arrow and word) at the right; Undo undoes the
//      end, and the card answers with Done, never a ✕.
//   2. Just ended: "In a safe place?" is the two-sided switch with neither side lit; Full rest is the accent and Done is
//      plain; no rest's line and no rows yet.
//   3. After the rest: the rest's line is a labelled line ("Full rest." then who was left out), the healing rule with
//      its source, a row a character (name, "6 of 8", the bar, Heal with its own name), and Done the accent.
//   4. When nobody is hurt the rows give way to one line, "Everyone is at full hit points."; there is no "Heal all".
//   5. Every character has a row (eight here, no "N more"); unset hit points read "—" with no bar.
//   6. As an item of "Waiting for you" the card is the first item, open, above the others, and its Done answers it.
//   7. Without the accent (another part holds it), neither Full rest nor Done is the accent.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { endCardRows, restLine } from '../modules/expedition/endCard.ts';
import { EndCard, RestLines } from './EndCard.tsx';
import { SafePlaceQuestion } from './EndSafety.tsx';
import { WaitingPanel } from './WaitingForYou.tsx';
import { SceneWaitingProvider, useWaitingPanel, WaitingSource, type WaitingSourceItem } from './sceneWaiting.tsx';

afterEach(cleanup);

type Who = [string, number | null, number | null];
const rowsOf = (who: Who[]) => endCardRows(who.map(([name, hpCurrent, hpMax]) => ({ ref: { id: name }, name, hpCurrent, hpMax })));

function Card({ rested, who = [['Ash', 6, 8], ['Tam', 4, 4]], accent = true, onUndo = () => {}, onDone = () => {}, onHeal = () => {} }: { rested: boolean; who?: Who[]; accent?: boolean; onUndo?: () => void; onDone?: () => void; onHeal?: (id: string) => void }) {
  const card = rowsOf(who);
  return (
    <EndCard took="Took 3 hours." accent={accent} rested={rested} onRest={() => {}} onUndo={onUndo} onDone={onDone} safePlace={<SafePlaceQuestion answer={null} onAnswer={() => {}} />}>
      {rested && <RestLines line={restLine(['Tam'])} healing={{ rule: 'A night by the fire heals a little.', source: 'From your setting: Reed Rules' }} rows={card.rows} everyoneFull={card.everyoneFull} none="No characters went." onHeal={onHeal} />}
    </EndCard>
  );
}

const card = () => screen.getByRole('region', { name: 'Expedition ended' });

describe('the end card (S19)', () => {
  it('has the flag, the title and Undo in its head, and answers with Done, never a ✕', async () => {
    const onUndo = vi.fn();
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<Card rested={false} onUndo={onUndo} onDone={onDone} />);
    const head = card().querySelector('.end-card__head') as HTMLElement;
    expect(within(head).getByRole('heading', { name: 'Expedition ended' })).toBeTruthy();
    const undo = within(head).getByRole('button', { name: 'Undo ending the expedition' });
    expect(undo.textContent).toBe('Undo');
    expect(undo.querySelector('svg')).not.toBeNull();
    expect(within(card()).queryByRole('button', { name: 'Close' })).toBeNull();
    await user.click(undo);
    expect(onUndo).toHaveBeenCalledTimes(1);
    await user.click(within(card()).getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(within(card()).getByText('Took 3 hours.')).toBeTruthy();
  });

  it('just ended: the switch with neither side lit, Full rest the accent, Done plain, no rows yet', () => {
    render(<Card rested={false} />);
    const question = within(card()).getByRole('group', { name: 'In a safe place?' });
    expect(question.className).toContain('button-row--switch');
    for (const side of within(question).getAllByRole('button')) expect(side.getAttribute('aria-pressed')).toBe('false');
    expect(within(card()).getByRole('button', { name: 'Full rest' }).className).toContain('button-primary');
    expect(within(card()).getByRole('button', { name: 'Done' }).className).not.toContain('button-primary');
    expect(within(card()).queryByText(/Rest and day abilities/)).toBeNull();
    expect(within(card()).queryByRole('button', { name: /^Heal / })).toBeNull();
  });

  it('after the rest: the labelled rest line, the rule and its source, a row a character with Heal, Done the accent', async () => {
    const onHeal = vi.fn();
    const user = userEvent.setup();
    render(<Card rested onHeal={onHeal} />);
    const line = within(card()).getByText('Rest and day abilities are back, except for Tam.');
    expect(line.querySelector('.book-label')?.textContent).toBe('Full rest.');
    expect(within(card()).getByText('A night by the fire heals a little.')).toBeTruthy();
    expect(within(card()).getByText('From your setting: Reed Rules')).toBeTruthy();
    expect(within(card()).queryByRole('button', { name: 'Full rest' })).toBeNull();
    const rows = card().querySelectorAll('.end-card__who');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.querySelector('.end-card__hp-words')?.textContent).toBe('6 of 8');
    expect(rows[0]!.querySelector('.hp-bar')).not.toBeNull();
    const heal = within(card()).getByRole('button', { name: 'Heal Ash' });
    expect(heal.textContent).toBe('Heal');
    expect(heal.className).toContain('stacked-button');
    await user.click(heal);
    expect(onHeal).toHaveBeenCalledWith('Ash');
    expect(within(card()).getByRole('button', { name: 'Done' }).className).toContain('button-primary');
    expect(within(card()).queryByRole('button', { name: /Heal all/ })).toBeNull();
  });

  it('says "Everyone is at full hit points." in place of the rows when nobody is hurt', () => {
    render(<Card rested who={[['Ash', 8, 8], ['Tam', 4, 4]]} />);
    expect(within(card()).getByText('Everyone is at full hit points.')).toBeTruthy();
    expect(within(card()).queryByRole('button', { name: /^Heal/ })).toBeNull();
  });

  it('gives every character a row, eight here, and reads unset hit points as "—" with no bar', () => {
    const eight: Who[] = [['Ash', 6, 8], ['Wren', 9, 14], ['Tam', 4, 4], ['Bram', 11, 11], ['Fenna of the Long Causeway', 0, 12], ['Moss', 31, 40], ['Old Sedge', 3, 21], ['Pip', null, null]];
    render(<Card rested who={eight} />);
    expect(card().querySelectorAll('.end-card__who')).toHaveLength(8);
    expect(within(card()).queryByText(/more$/)).toBeNull();
    const hp = [...card().querySelectorAll('.end-card__hp')];
    expect(hp.map((h) => h.querySelector('.end-card__hp-words')?.textContent)).toEqual(['6 of 8', '9 of 14', '4 of 4', '11 of 11', '0 of 12', '31 of 40', '3 of 21', '—']);
    expect(hp.at(-1)!.querySelector('.hp-bar')).toBeNull();
  });

  it('holds no accent when another part holds it', () => {
    render(<Card rested={false} accent={false} />);
    expect(within(card()).getByRole('button', { name: 'Full rest' }).className).not.toContain('button-primary');
    cleanup();
    render(<Card rested accent={false} />);
    expect(within(card()).getByRole('button', { name: 'Done' }).className).not.toContain('button-primary');
  });
});

/** The panel as the GM's place page hosts it. */
function Panel() {
  const panel = useWaitingPanel();
  return panel?.hosting ? <WaitingPanel /> : null;
}

describe('the end card as an item of "Waiting for you" (S19, S8)', () => {
  it('is the first item, open, above what else waits, and Done answers it', async () => {
    const user = userEvent.setup();
    const done = vi.fn();
    const end: WaitingSourceItem = { id: 'end:1', kind: 'expeditionEnd', title: 'Expedition ended', actions: [{ id: 'done', label: 'Done', icon: 'check-mark' }], onAction: done, card: <Card rested={false} onDone={done} /> };
    const weather: WaitingSourceItem = { id: 'card:weather:1', kind: 'weather', title: 'Weather: to roll', actions: [{ id: 'roll', label: 'Enter…' }], card: <p>Roll the weather</p> };
    render(
      <SceneWaitingProvider>
        <Panel />
        <WaitingSource sourceKey="strip" items={[weather]} />
        <WaitingSource sourceKey="end" items={[end]} />
      </SceneWaitingProvider>,
    );
    const panel = await screen.findByRole('region', { name: 'Waiting for you' });
    expect(within(panel).getByText('1 of 2')).toBeTruthy();
    const open = panel.querySelector('.waiting-open') as HTMLElement;
    expect(open.dataset.kind).toBe('expeditionEnd');
    expect(within(open).getByRole('region', { name: 'Expedition ended' })).toBeTruthy();
    expect(panel.querySelector('.waiting-row[data-kind="weather"]')).not.toBeNull();
    await user.click(within(open).getByRole('button', { name: 'Done' }));
    expect(done).toHaveBeenCalledTimes(1);
  });
});
