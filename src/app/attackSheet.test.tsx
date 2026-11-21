// @vitest-environment jsdom
// The Attack sheet made clear (ruling m5b-attack-sheet-clarity-2026-11-10, as-1 … as-3, layout B). Invented weapons only.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { weaponRolls } from '../modules/characters/play.ts';
import { attackRange, attackRules } from '../modules/inventory/weaponModes.ts';
import { rollWordsOutsideRollRows } from '../testing/rollRowGuard.ts';
import { AttackSheet } from './AtHandSheets.tsx';

afterEach(cleanup);

const REED_BOW = {
  name: 'Reed bow',
  hands: 2,
  weapon: {
    damage: '1d6',
    qualities: ['Missile', 'Two-handed'],
    range: { unit: 'feet', wildernessUnit: 'yards', from: 5, bands: [{ name: 'Short', upTo: 160, toHit: 1 }, { name: 'Medium', upTo: 320, toHit: 0 }, { name: 'Long', upTo: 480, toHit: -1 }] },
  },
};
const WARDEN = { progression: [{ level: 2, attackBonus: 1 }] };
const rolls = weaponRolls(REED_BOW, { 'abilityModifiers.NIM': { missile: 0 } }, WARDEN, 2, [], { klassName: 'Fen warden', longName: () => 'Nimbleness', scoreOf: () => 10 });

function sheet(name = 'Reed bow') {
  render(<AttackSheet preview name={name} figure="+1, 1d6" rolls={rolls} range={attackRange(REED_BOW, null)} rules={attackRules(REED_BOW, null)} spend={null} onClose={() => undefined} />);
  return screen.getByRole('group', { name: `${name} (preview)` });
}

describe('the Attack sheet (as-1 … as-3)', () => {
  it('opens with the two rolls, to hit then damage, each its die, its line and its parts with their own figures', () => {
    // Purpose: as-1, layout B: two Roll cards first; the line carries the sum; a row carries only its own figure.
    const dialog = sheet();
    const cards = [...dialog.querySelectorAll('.roll-card')];
    expect(cards.map((c) => c.querySelector('.roll-row')!.textContent)).toEqual(['Roll 1d20 + 1 to hit', 'Roll 1d6 for damage']);
    expect(cards.map((c) => c.querySelector('.die-glyph')!.getAttribute('data-die'))).toEqual(['20', '6']);
    const rows = [...cards[0]!.querySelectorAll('.breakdown__row')].map((r) => [r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent]);
    expect(rows).toEqual([
      ['Fen warden, level 2', '+1'],
      ['Nimbleness 10', '+0'],
    ]);
    // The cards come before the range, the rules and the fight-rules line.
    const heading = within(dialog).getByRole('heading', { name: /^Range/ });
    expect(cards[1]!.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the range under its own heading with its unit, each band with its reach and its effect', () => {
    // Purpose: as-2: "Range, in feet (yards outdoors)" and three bands, "Short 5 to 160 +1 to hit" first.
    const dialog = sheet();
    const range = within(dialog).getByRole('heading', { name: 'Range, in feet (yards outdoors)' }).closest('section')!;
    expect([...range.querySelectorAll('li')].map((b) => b.textContent)).toEqual(['Short5 to 160+1 to hit', 'Mediumup to 320+0 to hit', 'Longup to 480−1 to hit']);
  });

  it('says "two-handed" once, keeps every roll in a Roll row and has no disabled button', () => {
    // Purpose: as-3 on the sheet, and the Roll row guard (S1): no loose "Roll" words.
    const dialog = sheet();
    expect(within(dialog).getByText(/Qualities:/).closest('p')!.textContent).toBe('Qualities: Missile, Two-handed');
    expect(rollWordsOutsideRollRows(document.body)).toEqual([]);
    expect(document.querySelectorAll('button[disabled]')).toHaveLength(0);
  });

  it('keeps a long weapon name in the head and the lines whole', () => {
    // Purpose: messy data: a 50-character name is the sheet's title; the roll lines don't change with it (the 375 px
    // wrap itself is checked in the gallery's phone pictures).
    const name = 'The long iron-shod reed spear of the causeway wardens';
    const dialog = sheet(name);
    expect(dialog.querySelector('.roll-row')!.textContent).toBe('Roll 1d20 + 1 to hit');
  });

  it('shows the figure as a line when the setting gives no rolls', () => {
    // Purpose: the empty state stays as before: no cards, the figure or the plain sentence.
    render(<AttackSheet preview name="Odd stick" figure={null} rolls={[]} rules={[]} spend={null} onClose={() => undefined} />);
    expect(screen.getByText('This weapon has no figures in the setting rules.')).toBeTruthy();
    expect(document.querySelector('.roll-card')).toBeNull();
  });
});
