// @vitest-environment jsdom
// The optional rules' rows (06 Components: Optional rules list; ruling tf-2, tf-3, tf-5, 2026-11-03). Invented rules.
//   * up to 3 short choices are a segmented control, the description behind ⓘ; 4, or a long label, the ▾ button
//     showing the current choice and "1 of N", opening the choices' pop-up;
//   * "changed (the book: …)" shows at once when a rule isn't at its default;
//   * a source group shows every rule (no Show all), the changed first; rows hold their place while it stays open and
//     re-sort when it is folded and opened again;
//   * a rule card folds to one line while a choice counts and starts open while none does or a new one waits (rc-fold).
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { heldOrder, RuleClashCallout, RuleKeyCard, RuleRow, RuleSourceGroup, segmentLabels, type RuleChoice } from './ruleRows.tsx';

afterEach(cleanup);

const TIES: RuleChoice[] = [
  { id: 'again', name: 'Roll again until someone wins', short: 'Roll again', notes: 'Both sides roll once more.' },
  { id: 'same', name: 'Both sides act at the same time', short: 'Same time' },
  { id: 'party', name: 'The party acts first', short: 'Party wins' },
];

describe('segment labels (tf-3)', () => {
  it('2 or 3 choices with short labels (or short names) are segments; 4, or a long label without short, are not', () => {
    expect(segmentLabels(TIES)).toEqual(['Roll again', 'Same time', 'Party wins']);
    expect(segmentLabels([{ id: 'on', name: 'On' }, { id: 'off', name: 'Off' }])).toEqual(['On', 'Off']);
    expect(segmentLabels([...TIES, { id: 'gm', name: 'GM', short: 'GM' }])).toBeNull();
    expect(segmentLabels([{ id: 'a', name: 'Ascending armour class' }, { id: 'd', name: 'Descending' }])).toBeNull();
    expect(segmentLabels([{ id: 'only', name: 'Only' }])).toBeNull();
  });
});

describe('a rule row', () => {
  it('3 short choices: a segmented control; the description waits behind ⓘ with each choice in words', async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    render(<RuleRow name="Initiative ties" about="What happens when initiative rolls tie." source="Fen Rules, can change at any time" choices={TIES} current="again" defaultChoice="again" onChoose={onChoose} />);
    const segments = within(screen.getByRole('group', { name: 'Choose Initiative ties' }));
    expect(segments.getAllByRole('button').map((b) => b.textContent)).toEqual(['Roll again', 'Same time', 'Party wins']);
    expect(segments.getByRole('button', { name: 'Roll again' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('What happens when initiative rolls tie.')).toBeNull();
    await user.click(segments.getByRole('button', { name: 'Same time' }));
    expect(onChoose).toHaveBeenCalledWith('same');
    await user.click(screen.getByRole('button', { name: 'About Initiative ties' }));
    const about = within(screen.getByRole('dialog', { name: 'Initiative ties' }));
    expect(about.getByText('What happens when initiative rolls tie.')).toBeTruthy();
    expect(about.getByText('Both sides act at the same time')).toBeTruthy();
  });

  it('4 choices: the ▾ button with the current choice and "1 of 4", opening the pop-up; the description stays on the row', async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    const four = [...TIES, { id: 'gm', name: 'The GM decides', short: 'GM decides' }];
    render(<RuleRow name="Initiative ties" about="What happens when initiative rolls tie." source="Fen Rules" choices={four} current="party" defaultChoice="again" onChoose={onChoose} />);
    expect(screen.getByText('What happens when initiative rolls tie.')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Initiative ties: The party acts first, 1 of 4. Change' });
    expect(button.textContent).toBe('The party acts first1 of 4▾');
    await user.click(button);
    await user.click(within(screen.getByRole('dialog', { name: 'Initiative ties' })).getByRole('button', { name: /^The GM decides/ }));
    expect(onChoose).toHaveBeenCalledWith('gm');
  });

  it('a long label without short: the ▾ button with "1 of 2"', () => {
    render(<RuleRow name="Armour class" source="Fen Rules" choices={[{ id: 'asc', name: 'Ascending armour class' }, { id: 'desc', name: 'Descending' }]} current="asc" defaultChoice="asc" onChoose={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Armour class: Ascending armour class, 1 of 2. Change' })).toBeTruthy();
  });

  it('says "changed (the book: …)" when the rule is not at its default, and nothing when it is', () => {
    const { rerender } = render(<RuleRow name="Initiative ties" source="Fen Rules" choices={TIES} current="same" defaultChoice="again" onChoose={() => undefined} />);
    expect(screen.getByRole('group', { name: 'Initiative ties' }).textContent).toContain('Fen Rules, changed (the book: Roll again until someone wins)');
    rerender(<RuleRow name="Initiative ties" source="Fen Rules" choices={TIES} current="again" defaultChoice="again" onChoose={() => undefined} />);
    expect(screen.queryByText('changed')).toBeNull();
  });
});

/** Three on/off rules in one group, the GM toggling them. */
function Group() {
  const [values, setValues] = useState<Record<string, string>>({ oil: 'off', heal: 'on', reroll: 'off' });
  const [open, setOpen] = useState(true);
  const names: Record<string, string> = { oil: 'Lanterns need oil', heal: 'Slow healing', reroll: 'Re-roll hit points' };
  const rows = Object.keys(names).map((id) => ({
    id,
    changed: values[id] !== 'off',
    row: (
      <RuleRow
        key={id}
        name={names[id]!}
        source="Fen Rules"
        choices={[{ id: 'on', name: 'On' }, { id: 'off', name: 'Off' }]}
        current={values[id]!}
        defaultChoice="off"
        onChoose={(choice) => setValues((v) => ({ ...v, [id]: choice }))}
      />
    ),
  }));
  return <RuleSourceGroup title="Fen Rules" count="3 rules" open={open} onToggle={() => setOpen((o) => !o)} rows={rows} />;
}

describe('a source group (tf-2, tf-5)', () => {
  const order = () => [...document.querySelectorAll('.rule-row')].map((r) => r.getAttribute('aria-label'));

  it('toggling a rule leaves every row where it was until the group is folded and opened again', async () => {
    const user = userEvent.setup();
    render(<Group />);
    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull();
    expect(order()).toEqual(['Slow healing', 'Lanterns need oil', 'Re-roll hit points']);
    await user.click(within(screen.getByRole('group', { name: 'Choose Re-roll hit points' })).getByRole('button', { name: 'On' }));
    await user.click(within(screen.getByRole('group', { name: 'Choose Slow healing' })).getByRole('button', { name: 'Off' }));
    expect(order()).toEqual(['Slow healing', 'Lanterns need oil', 'Re-roll hit points']);
    expect(within(screen.getByRole('group', { name: 'Re-roll hit points' })).getByText('changed')).toBeTruthy();
    const head = screen.getByRole('button', { name: /^Fen Rules/ });
    await user.click(head);
    await user.click(head);
    expect(order()).toEqual(['Re-roll hit points', 'Lanterns need oil', 'Slow healing']);
  });

  it('held order: kept ids in place, gone ones dropped, new ones at the end', () => {
    const rows = [
      { id: 'a', changed: false, row: null },
      { id: 'b', changed: true, row: null },
      { id: 'c', changed: false, row: null },
    ];
    expect(heldOrder(rows, null)).toEqual(['b', 'a', 'c']);
    expect(heldOrder(rows, ['c', 'x', 'a'])).toEqual(['c', 'a', 'b']);
  });
});

// of-1: an overlay's option that extends a base option is one row, its choices labelled with each pack.
describe('a rule another pack extends (of-1)', () => {
  const CARRY: RuleChoice[] = [
    { id: 'none', name: 'Not tracked', short: 'Not tracked', pack: 'Fen Rules' },
    { id: 'coin', name: 'By coin weight', short: 'Coin weight', pack: 'Fen Rules' },
    { id: 'slot', name: 'Reed slots', short: 'Reed slots', pack: 'Reed zine', notes: 'Count reed bundles.' },
  ];

  // Purpose: three short choices from two packs aren't segments (the pack labels would be lost): the row is the ▾
  // button, and the current choice from the overlay names its pack.
  it('is never a segmented control, and names the pack of an overlay choice in use', () => {
    expect(segmentLabels(CARRY)).toBeNull();
    render(<RuleRow name="Carrying" source="Fen Rules" choices={CARRY} current="slot" defaultChoice="none" onChoose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Carrying: Reed slots, Reed zine, 1 of 3. Change' })).toBeTruthy();
  });

  // Purpose: the choices pop-up shows each pack's name with its choices under it, and one tap on the overlay's
  // choice chooses it for the base option.
  it("lists each pack's choices under its name; a tap chooses", async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    render(<RuleRow name="Carrying" source="Fen Rules" choices={CARRY} current="none" defaultChoice="none" onChoose={onChoose} />);
    await user.click(screen.getByRole('button', { name: 'Carrying: Not tracked, 1 of 3. Change' }));
    const sheet = within(screen.getByRole('dialog', { name: 'Carrying' }));
    expect(within(sheet.getByRole('group', { name: 'Fen Rules' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Fen Rules, Not tracked', 'Fen Rules, By coin weight']);
    await user.click(within(sheet.getByRole('group', { name: 'Reed zine' })).getByRole('button', { name: 'Reed zine, Reed slots' }));
    expect(onChoose).toHaveBeenCalledWith('slot');
  });

  // Purpose: a rule whose choices all come from one pack shows no pack names (as before).
  it('shows no pack names for a rule no other pack extends', async () => {
    const user = userEvent.setup();
    const four = [...TIES, { id: 'gm', name: 'The GM decides', short: 'GM decides' }];
    render(<RuleRow name="Initiative ties" source="Fen Rules" choices={four} current="again" defaultChoice="again" onChoose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^Initiative ties: / }));
    expect(within(screen.getByRole('dialog', { name: 'Initiative ties' })).queryByRole('group', { name: 'Fen Rules' })).toBeNull();
  });
});

// rc-fold (Francis, 2026-11-20: "it takes up too much screen real estate and never closes"): a rule card folds as the
// groups around it do, to one line naming the topic and the choice that counts with its pack.
describe('a rule card folds (rc-fold)', () => {
  const packs = (ticked: string | null, onPick = vi.fn()) => [
    { label: 'Fen Rules', choices: TIES.slice(0, 2), ticked, onPick },
    { label: 'Reed Zine', choices: [{ id: 'gm', name: 'The GM decides' }], ticked: null, onPick },
  ];

  // Purpose: with a choice in force the card shows one folded line, naming the topic, the choice and its pack, and
  // none of the choices, and no box (Francis's fix 1, 2026-11-20: a plain row like the groups above).
  it('is folded to one line while a choice counts, without its box', () => {
    const { container } = render(<RuleKeyCard topic="initiative ties" packs={packs('again')} />);
    const line = screen.getByRole('button', { name: 'Initiative ties, Roll again until someone wins (Fen Rules)' });
    expect(line.getAttribute('aria-expanded')).toBe('false');
    expect(line.textContent).toBe('▸Initiative ties, Roll again until someone wins (Fen Rules)');
    expect(screen.queryByRole('group', { name: 'Choice for initiative ties' })).toBeNull();
    expect(screen.queryByText(/packs offer it/i)).toBeNull();
    expect(container.querySelector('.creation-callout')).toBeNull();
  });

  // Purpose: a tap on the folded line opens the card's box, "Two packs offer it; one choice counts." first without the
  // topic again (fix 2), then every pack's every choice; a pick inside doesn't fold it; a second tap closes it.
  it('opens on a tap, showing every choice, and closes again', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<RuleKeyCard topic="initiative ties" packs={packs('again', onPick)} />);
    await user.click(screen.getByRole('button', { name: /^Initiative ties, / }));
    const box = screen.getByRole('group', { name: 'Choice for initiative ties' });
    const card = within(box);
    expect(box.querySelector('.creation-callout__text')?.textContent).toBe('Two packs offer it; one choice counts.');
    expect(box.textContent).not.toMatch(/initiative ties/i);
    expect(card.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Fen Rules, Roll again until someone wins',
      'Fen Rules, Both sides act at the same time',
      'Reed Zine, The GM decides',
    ]);
    await user.click(card.getByRole('button', { name: 'Reed Zine, The GM decides' }));
    expect(onPick).toHaveBeenCalledWith('gm');
    expect(screen.getByRole('group', { name: 'Choice for initiative ties' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Initiative ties, / }));
    expect(screen.queryByRole('group', { name: 'Choice for initiative ties' })).toBeNull();
  });

  // Purpose: with no choice in force the card starts open (the GM has something to pick), its line saying so, and
  // the GM can still fold it.
  it('is open while no choice counts', async () => {
    const user = userEvent.setup();
    render(<RuleKeyCard topic="initiative ties" packs={packs(null)} />);
    const line = screen.getByRole('button', { name: 'Initiative ties, nothing picked yet' });
    expect(line.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('group', { name: 'Choice for initiative ties' })).toBeTruthy();
    await user.click(line);
    expect(screen.queryByRole('group', { name: 'Choice for initiative ties' })).toBeNull();
  });

  // Purpose: where the GM is meant to pick (the new campaign's step, fix 3) the card starts open even with a choice in
  // force, and still folds.
  it('starts open where the GM is meant to pick', async () => {
    const user = userEvent.setup();
    render(<RuleKeyCard topic="initiative ties" packs={packs('again')} startOpen />);
    const line = screen.getByRole('button', { name: 'Initiative ties, Roll again until someone wins (Fen Rules)' });
    expect(line.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('group', { name: 'Choice for initiative ties' })).toBeTruthy();
    await user.click(line);
    expect(screen.queryByRole('group', { name: 'Choice for initiative ties' })).toBeNull();
  });

  // Purpose: a "New choice for <topic>" waiting for the GM's confirm starts open with every offer; its line names the
  // choice that counts now with its pack, and folds it.
  it('the New choice card is open while it waits, and folds', async () => {
    const user = userEvent.setup();
    const offers = [
      { label: 'Reed Zine, The GM decides', onOpen: vi.fn() },
      { label: 'Fen Rules, Roll again until someone wins', onOpen: vi.fn() },
    ];
    render(<RuleClashCallout title="New choice for initiative ties" topic="initiative ties" now={{ pack: 'Fen Rules', choice: 'Roll again until someone wins' }} offers={offers} />);
    const line = screen.getByRole('button', { name: 'New choice for initiative ties, Roll again until someone wins (Fen Rules)' });
    expect(line.getAttribute('aria-expanded')).toBe('true');
    const box = screen.getByRole('group', { name: 'New choice for initiative ties' });
    const card = within(box);
    expect(box.querySelector('.creation-callout__text')?.textContent).toBe('Two packs offer it; one choice counts for the campaign:');
    expect(card.getAllByRole('button').map((b) => b.textContent)).toEqual(['Reed Zine, The GM decides', 'Fen Rules, Roll again until someone wins']);
    expect(card.getByText('Now: Fen Rules, Roll again until someone wins (on top).')).toBeTruthy();
    await user.click(line);
    expect(screen.queryByRole('group', { name: 'New choice for initiative ties' })).toBeNull();
  });
});
