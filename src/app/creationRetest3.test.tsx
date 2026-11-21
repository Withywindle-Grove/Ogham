// @vitest-environment jsdom
// Creation retest 3 (Francis's iPad walk, 2026-11-08; design/rulings/m5b-creation-retest-3-2026-11-08.md), the parts
// on their own. Every name and number is invented. Purposes:
//   R3-7: the prime experience table is the pack's rows, range and experience; the band the character's prime falls in
//   is marked "you" (with two primes, the lower one when the rules set says so); a pack without the data draws none.
//   R3-6: the review's derived values are Score tiles (the name, the figure, the parts under), no separators between;
//   the saves are their own group under "Saves"; a word figure draws in the word size; a tile opens its breakdown.
//   Design on #564: a long Score or Save tile label wraps to two lines, never clamped to one with "…".
//   R3-9: no option row's button carries the accent, picked or not, in any variant.
//   R3-10: an item's entry shows the pack's full text in order: description, qualities, damage and use, cost, weight,
//   source, then Pick at the foot.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { primeXpBands } from '../modules/characters/creationSteps.ts';
import { PickRow, PrimeXpTable, ReviewSections } from '../ui/creation.tsx';
import { ItemEntry } from './ItemEntry.tsx';
import { isWordFigure } from '../ui/parts.tsx';

afterEach(cleanup);

// The stylesheet as written (as the design-system test reads it): vitest doesn't load CSS.
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
const partsCss = fs.readFileSync('./src/ui/parts.css', 'utf8');

const rules = [
  {
    primeRequisiteXp: [
      { range: '3-5', xp: -20 },
      { range: '6-8', xp: -10 },
      { range: '9-12', xp: 0 },
      { range: '13-15', xp: 5 },
      { range: '16-18', xp: 10 },
    ],
    primeRequisiteRule: 'lowest',
  },
];
const warden = { packEntryId: 'lantern-warden', name: 'Lantern Warden', data: { primeRequisites: ['CHA', 'MUS'], primeXp: { type: 'standard' } } };

describe('the prime experience table (R3-7)', () => {
  it('is the pack’s rows; the lower prime’s band is marked; no data, no table', () => {
    const bands = primeXpBands(rules, warden, { CHA: 11, MUS: 13 })!;
    expect(bands.map((b) => [b.range, b.xp, b.you])).toEqual([
      ['3–5', '−20 %', false],
      ['6–8', '−10 %', false],
      ['9–12', '+0 %', true],
      ['13–15', '+5 %', false],
      ['16–18', '+10 %', false],
    ]);
    // One prime, at the top band.
    expect(primeXpBands(rules, { ...warden, data: { ...warden.data, primeRequisites: ['MUS'] } }, { MUS: 17 })!.find((b) => b.you)?.range).toBe('16–18');
    // No class picked yet (the Class step before a pick): the rows, nothing marked.
    expect(primeXpBands(rules, null, {})!.some((b) => b.you)).toBe(false);
    expect(primeXpBands([{}], warden, { CHA: 11, MUS: 13 })).toBeNull();
  });

  it('draws the rows with a caption and the "you" band in words; nothing without rows', () => {
    render(<PrimeXpTable bands={primeXpBands(rules, warden, { CHA: 11, MUS: 13 })} />);
    const table = screen.getByRole('table', { name: 'Prime score and experience' });
    const you = table.querySelector('.prime-xp__you')!;
    expect(you.textContent).toBe('9–12, you+0 %');
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    cleanup();
    render(<PrimeXpTable bands={null} />);
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('the review’s derived values as tiles (R3-6)', () => {
  it('draws Score tiles with no separators, the saves under "Saves", a word figure in the word size; a tile opens its breakdown', async () => {
    const onBreakdown = vi.fn();
    const user = userEvent.setup();
    const tile = (key: string, label: string, value: string, caption?: string) => ({ key, label, value, ...(caption ? { caption } : {}), breakdown: { title: label, lines: [`${label} ${value}.`] } });
    render(
      <ReviewSections
        onBreakdown={onBreakdown}
        parts={[
          {
            id: 'derived',
            title: 'Derived values',
            lines: [
              { text: '', tiles: { items: [tile('ac', 'Armour', '10', 'unarmoured, Nimbleness +0'), tile('title', 'Title', 'Medium'), tile('speed', 'Speed', '999')] } },
              { text: '', tiles: { label: 'Saves', saves: true, items: [tile('mire', 'Mire', '13'), tile('ash', 'Ash', '14')] } },
            ],
          },
        ]}
      />,
    );
    const groups = document.querySelectorAll('.creation-review__tiles');
    expect(groups).toHaveLength(2);
    expect([...groups[0]!.children].every((c) => c.classList.contains('stat-tile--small'))).toBe(true);
    // No text between the tiles: each child is a tile.
    expect([...groups[0]!.childNodes].every((n) => n.nodeType === Node.ELEMENT_NODE)).toBe(true);
    expect(screen.getByRole('group', { name: 'Saves' }).querySelector('.creation-review__tiles--saves')).not.toBeNull();
    expect(within(screen.getByRole('group', { name: 'Saves' })).getByText('Saves')).toBeTruthy();
    expect(screen.getByText('Medium').classList.contains('stat-tile__value--word')).toBe(true);
    expect(screen.getByText('999').classList.contains('stat-tile__value--word')).toBe(false);
    await user.click(screen.getByRole('button', { name: "Armour 10, unarmoured, Nimbleness +0: how it's worked out" }));
    expect(onBreakdown).toHaveBeenCalledWith({ title: 'Armour', lines: ['Armour 10.'] });
  });

  it('tells a word figure from a number', () => {
    for (const n of ['13', '+1', '−2', '1,500', '—', '50%', '12d']) expect(isWordFigure(n)).toBe(false);
    for (const w of ['Medium', 'Literate', 'Veteran of the Nine Drowned Bells']) expect(isWordFigure(w)).toBe(true);
  });
});

describe('the Score and Save tile label (Design on #564; gate finding F8, 2026-11-10)', () => {
  // Purpose: a long label on a Score or Save tile wraps onto as many lines as it needs: never one line, never "…",
  // never clipped after two lines (F8 replaced #564's two-line clamp), and never under 14 px.
  it('wraps the whole label: no nowrap, ellipsis, line clamp or hidden overflow', () => {
    const rule = /\.stat-tile--small \.stat-tile__label \{([^}]*)\}/.exec(partsCss)?.[1] ?? '';
    expect(rule).not.toBe('');
    expect(rule).not.toMatch(/white-space:\s*nowrap/);
    expect(rule).not.toMatch(/text-overflow:\s*ellipsis/);
    expect(rule).not.toMatch(/line-clamp/);
    expect(rule).not.toMatch(/overflow:\s*(hidden|clip)/);
    expect(rule).not.toMatch(/font-size/);
    expect(/\.stat-tile__label \{([^}]*)\}/.exec(partsCss)?.[1]).toMatch(/font-size:\s*var\(--text-14\)/);
  });

  // Purpose: in the Score and Save rows a label breaks only between words (Design on F8): no letter-spacing, and
  // overflow-wrap is never `anywhere` or `break-word`; the rule comes after the general one, so it wins.
  it('in the Score and Save rows breaks only between words, with no letter-spacing', () => {
    const at = partsCss.search(/\.score-row \.stat-tile__label,\s*\.save-tiles \.stat-tile__label \{/);
    expect(at).toBeGreaterThan(partsCss.search(/\.stat-tile--small \.stat-tile__label \{/));
    const rule = partsCss.slice(at, partsCss.indexOf('}', at));
    expect(rule).toMatch(/letter-spacing:\s*0/);
    expect(rule).toMatch(/overflow-wrap:\s*normal/);
    expect(rule).not.toMatch(/anywhere|break-word/);
  });
});

describe('the word figure rule (Design on #564)', () => {
  it('outranks the value size and clamps at three lines', () => {
    const at = (re: RegExp) => partsCss.search(re);
    const word = at(/\.stat-tile--small \.stat-tile__value\.stat-tile__value--word \{/);
    expect(word).toBeGreaterThan(at(/\.stat-tile--small \.stat-tile__value \{/));
    const rule = partsCss.slice(word, partsCss.indexOf('}', word));
    expect(rule).toMatch(/font-size:\s*var\(--text-16\)/);
    expect(rule).toMatch(/-webkit-line-clamp:\s*3/);
  });
});

describe('no option row is the accent (R3-9)', () => {
  it('a pick row’s buttons are never the accent class, picked or not, counted or given', () => {
    render(
      <>
        <PickRow name="Bog folk" picked={false} onPick={() => {}} onOpen={() => {}} />
        <PickRow name="Stone kin" picked onPick={() => {}} />
        <PickRow name="Bog eel ×2" picked times={2} onPick={() => {}} onPutBack={() => {}} />
        <PickRow name="Reed spear" picked={false} given onPick={() => {}} />
      </>,
    );
    expect(document.querySelectorAll('.pick-row .button-primary')).toHaveLength(0);
    expect(document.querySelectorAll('.pick-row button').length).toBeGreaterThan(3);
  });
});

describe('an item’s full entry (R3-10)', () => {
  it('shows description, qualities, damage and use, cost, weight and source in that order, then Pick', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    const hook = {
      packEntryId: 'eel-hook',
      name: 'Eel hook',
      data: {
        blurb: 'A barbed bone on a line.',
        description: 'Bent from an eel’s jaw and bound with reed.',
        notes: 'Snags on anything with a fin.',
        qualities: ['barbed', 'returns'],
        weapon: { damage: 'd4' },
        weaponTags: ['Thrown'],
        hands: 1,
        value: { sp: 3 },
        weightCoin: 5,
        source: 'Fen rules, p. 31',
      },
    };
    render(<ItemEntry item={hook} onPick={onPick} onClose={() => {}} />);
    const sheet = screen.getByRole('dialog', { name: 'Eel hook' });
    const order = ['Bent from an eel’s jaw', 'Snags on anything', 'Qualities', 'barbed, returns', 'Damage and use', 'd4, thrown, one-handed', 'Cost', '3 sp', 'Weight', '5 coins', 'Fen rules, p. 31', 'Pick Eel hook'];
    const all = sheet.textContent ?? '';
    const at = order.map((t) => all.indexOf(t));
    expect(at.every((n) => n >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    // The kv lines are the item sheet's (#552).
    expect(sheet.querySelector('.rules-browser__lines--kv')).not.toBeNull();
    await user.click(within(sheet).getByRole('button', { name: 'Pick Eel hook' }));
    expect(onPick).toHaveBeenCalled();
  });

  it('leaves out what the pack doesn’t give, the blurb standing in for a missing description', () => {
    render(<ItemEntry item={{ packEntryId: 'reed-mat', name: 'Reed mat', data: { blurb: 'Keeps you off the mud.' } }} onClose={() => {}} />);
    const sheet = screen.getByRole('dialog', { name: 'Reed mat' });
    expect(within(sheet).getByText('Keeps you off the mud.')).toBeTruthy();
    expect(sheet.querySelector('.rules-browser__lines')).toBeNull();
    expect(within(sheet).queryByText('Cost')).toBeNull();
  });
});
