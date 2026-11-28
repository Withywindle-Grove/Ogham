// @vitest-environment jsdom
// The gallery's At hand weapon pictures (ruling m5b-at-hand-actions-2026-11-08). Purpose: the specimens draw (Wield and
// Attack rows with their mode buttons, the spent line, the Attack sheet, the mode sheets, the blocked Attack's sheet) with
// no middle dot, angle quote or plain ▲, no disabled button, and the accent only on the blocked sheet's way forward.
// Purpose (dec-13 C6): the last specimen draws the Player screen's rows with stacked buttons (Quiver and Grip beside
// Wield, Use, Drink), and the weapon in hand as its block (C14) with Quiver and Attack stacked too.
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { AtHandSpecimens } from './AtHandSpecimens.tsx';

afterEach(cleanup);

function Specimen({ name, children }: { name: string; children: ReactNode }) {
  return (
    <figure>
      <figcaption>{name}</figcaption>
      <div className="stage">{children}</div>
    </figure>
  );
}

describe('the gallery’s At hand weapon actions', () => {
  it('draws every piece, with no middle dot, angle quote or ▲, and no disabled button', () => {
    render(<AtHandSpecimens Specimen={Specimen} />);
    const stages = [...document.querySelectorAll('.stage')];
    expect(stages).toHaveLength(22);
    for (const stage of stages) expect(stage.textContent).not.toMatch(/·|[‹›▲]/);
    expect(document.querySelectorAll('button[disabled]')).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Attack with Reed bow' })).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: 'Quiver of Reed bow' })).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: 'Grip of Eel spear' })).toHaveLength(2);
    const player = stages[16]!;
    expect([...player.querySelectorAll('.stacked-button')].map((b) => b.textContent)).toEqual(['Quiver', 'Attack', 'Quiver', 'Wield', 'Grip', 'Wield', 'Wield', 'Use', 'Drink']);
    // The weapon in hand is C14's block, its Attack a stacked button, its roll lines under it.
    const block = player.querySelector('.weapon-in-hand') as HTMLElement;
    expect(within(block).getByRole('button', { name: 'Attack with Reed bow' }).classList.contains('stacked-button')).toBe(true);
    expect([...block.querySelectorAll('.weapon-in-hand__roll')].map((r) => r.textContent)).toEqual(['d20 +1 to hit', 'd6 damage']);
    expect(screen.getByRole('button', { name: 'Wield Hand axe' })).toBeTruthy();
    expect(stages[0]!.textContent).toContain('Quiver: Reed arrows ×18');
    expect(stages[0]!.textContent).toContain('Quiver: nothing chosen');
    expect(stages[0]!.textContent).toContain('Quiver: no reed arrows in the pack');
    // tfw-3 and tfw-2 (2026-11-19): no Attack sheet carries the line about the fight rules or a line on who reads the
    // hit; the sheet with a target figure keeps no "to hit" on its line, and a sheet with nothing to spend ends with its
    // rows (the spear's last line is its Qualities).
    for (const stage of stages) expect(stage.textContent).not.toMatch(/fight rules|reads the hit/);
    expect([...stages[4]!.querySelectorAll('.roll-row')].map((r) => r.textContent).join(' ')).not.toContain('to hit');
    expect(stages[2]!.querySelector('.at-hand-sheet')!.lastElementChild!.textContent).toBe('Qualities: Melee');
    expect(screen.getByRole('button', { name: 'Fire one, 3 left after' })).toBeTruthy();
    // tfh-6 (2026-11-19): the Quiver lists the kinds carried ("4 in the pack"), not the ember arrows Dorn has none of,
    // with no line over or under its rows; with none carried, its one line.
    expect(stages[13]!.textContent).toContain('4 in the pack');
    expect(stages[13]!.textContent).not.toMatch(/Ember arrows|None in the pack|Each shot uses one|Out of a kind/);
    expect(stages[17]!.textContent).toContain('Nothing to fire in your pack.');
    // as-4 and mw-5: the four new sheets carry their rows and their sums.
    expect(stages[7]!.textContent).toContain('Roll 1d20 + 2 to hit');
    expect(stages[7]!.textContent).toContain('Ember arrows, magic');
    expect(stages[7]!.textContent).not.toContain('Not added');
    expect(stages[8]!.textContent).toContain('Roll 1d6 + 3 for damage');
    expect(stages[8]!.textContent).toContain('Specialised');
    expect(stages[9]!.textContent).toContain('Not a weapon skill of yours');
    expect(stages[9]!.textContent).toContain('Roll 1d20 to hit');
    expect(stages[10]!.textContent).toContain('Not your class’s weapon');
    expect(stages[10]!.textContent).toContain('Roll 1d20 − 1 to hit');
    // as-7 and as-6 (2026-11-10): specialised outside the class shows both rows, netted; the arrows' bonus against a
    // kind of foe shows to the player under mw-4, never added.
    expect(stages[11]!.textContent).toContain('Specialised');
    expect(stages[11]!.textContent).toContain('Not your class’s weapon');
    expect(stages[11]!.textContent).toContain('Roll 1d20 to hit');
    expect(stages[11]!.textContent).toContain('Roll 1d6 + 2 for damage');
    expect(stages[12]!.textContent).toContain('Ember arrows, +3 vs bog lurkers');
    expect(stages[12]!.textContent).toContain('Roll 1d20 + 3 to hit');
    expect(stages[12]!.textContent).not.toContain('Not added');
    expect([...document.querySelectorAll('.button-primary')].map((b) => b.textContent)).toEqual(['Quiver']);
  });

  // Purpose (tfh-1 to tfh-4; page M2, frames M2l to M2n): the At hand pop-up shows no slot, hands, value or weight; its
  // star shows on everything; its rows are Give to…, Put in…, Hide from At hand (only on a thing not pinned) and Drop,
  // each with its icon; a weapon's pop-up holds the Attack view, a thing's its facts, its own words and its source.
  it('draws the At hand pop-up in its four cases', () => {
    render(<AtHandSpecimens Specimen={Specimen} />);
    const stages = [...document.querySelectorAll('.stage')] as HTMLElement[];
    const rows = (stage: HTMLElement) => [...stage.querySelectorAll('.list-row--icon .list-row__title')].map((t) => t.textContent);
    const [spear, bow, wand, lantern] = stages.slice(18, 22) as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    for (const stage of [spear, bow, wand, lantern]) {
      expect(stage.textContent).not.toMatch(/Slot|Hands|Value|Weight|Takes/);
      expect(within(stage).getByRole('button', { name: /^(Pin to top|Unpin)$/ })).toBeTruthy();
      expect(stage.querySelectorAll('.list-row--icon .list-row__icon svg').length).toBe(rows(stage).length);
    }
    expect(rows(spear)).toEqual(['Give to…', 'Put in…', 'Hide from At hand', 'Drop']);
    expect(within(spear).getByRole('button', { name: 'Pin to top' }).getAttribute('aria-pressed')).toBe('false');
    expect(spear.textContent).toContain('Roll 1d20 + 2 to hit');
    expect(rows(bow)).toEqual(['Give to…', 'Put in…', 'Drop']);
    expect(within(bow).getByRole('button', { name: 'Fire one, 17 left after' })).toBeTruthy();
    expect(rows(wand)).toEqual(['Give to…', 'Put in…', 'Hide from At hand', 'Drop']);
    expect(wand.textContent).toContain('Charges 5 left');
    expect(wand.textContent).toContain('bright enough to read by at ten paces');
    expect(wand.textContent).toContain('River rules');
    expect(lantern.textContent).toContain('Light Lit, 4 turns left');
    expect(lantern.textContent).toContain('Refills 3 left');
  });
});
