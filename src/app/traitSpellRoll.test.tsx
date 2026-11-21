// @vitest-environment jsdom
// A trait-list entry's spell roll (rc-2 `spells.roll`; ruled 2026-11-04, bq3-18 A: under the entry's pick, on its own
// step). Invented content only: a fen-folk background list and a "reed-songs" list of three little songs.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fieldEntries, type EntryContext } from '../modules/characters/listEntries.ts';
import type { FieldDefinition } from '../modules/characters/fields.ts';
import { redoRecord } from '../modules/characters/redo.ts';
import { traitHeadings, traitListsOf } from '../modules/characters/traitLists.ts';
import { entryRollPlan, rolledSpellOf, rolledSpellReview, rollTyped, spellRollHeading, spellRollOf, spellRollPlan, withRolledSpell, type RolledSpell } from '../modules/characters/traitSpellRoll.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { TraitListStep } from './TraitListStep.tsx';

afterEach(cleanup);

const spell = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ kind: 'spell', packEntryId: id, name, data: { lists: { 'reed-songs': 0 }, range: 'Touch', ...extra } });
const listEntry = {
  kind: 'traitList',
  packEntryId: 'fen-backgrounds',
  name: 'Fen backgrounds',
  data: {
    die: 'd6',
    entries: [
      { id: 'reed-apprentice', name: 'Reed apprentice', min: 1, max: 3, blurb: 'Learnt a little song.', spells: { roll: { listId: 'reed-songs', level: 0 } } },
      { id: 'eel-catcher', name: 'Eel catcher', min: 4, max: 6 },
    ],
  },
};
const all = [
  listEntry,
  spell('song-glow', 'Marsh glow', { blurb: 'A small light in the reeds.' }),
  spell('song-hush', 'Hush'),
  spell('song-ripple', 'Ripple'),
  // Switched off by an option: on no list level.
  { ...spell('song-gone', 'Gone song'), optionOff: 'old-songs' },
  // Another level: not on the cantrip roll.
  { kind: 'spell', packEntryId: 'song-big', name: 'Big song', data: { lists: { 'reed-songs': 1 } } },
];
const [list] = traitListsOf(all);
const apprentice = list!.entries[0]!;
const plan = entryRollPlan(apprentice.spellRoll, all)!;

describe('the roll, read (bq3-18)', () => {
  // Purpose: an entry's `spells.roll { listId, level }` is read; another shape is no roll at all.
  it('reads spells.roll and leaves out a bad shape', () => {
    expect(apprentice.spellRoll).toEqual({ listId: 'reed-songs', level: 0 });
    expect(spellRollOf({ roll: { listId: 'reed-songs' } })).toBeNull();
    expect(spellRollOf({ roll: { listId: '', level: 0 } })).toBeNull();
    expect(spellRollOf({ add: ['x'] })).toBeNull();
  });

  // Purpose: the roll's rows are the list level's spells in play, numbered for the die in the setting's order.
  it("numbers the level's spells in play for the die, leaving out one switched off and other levels", () => {
    expect(plan.die).toBe('d3');
    expect(plan.rows.map((r) => `${r.n}, ${r.spell.name}`)).toEqual(['1, Marsh glow', '2, Hush', '3, Ripple']);
    expect(spellRollHeading(apprentice.name, plan)).toBe('From Reed apprentice: roll d3 for one level 0 spell');
    expect(spellRollPlan({ listId: 'reed-songs', level: 1 }, { spells: all.filter((e) => e.kind === 'spell'), lists: [] }).what).toBe('level 1 spell');
  });

  // Purpose: a typed number picks the row it lands on, and says why when none does.
  it('turns a typed number into its row, or says why not', () => {
    expect(rollTyped(plan, '2').line).toBe('2: Hush');
    expect(rollTyped(plan, '2').row?.spell.id).toBe('song-hush');
    expect(rollTyped(plan, '7')).toEqual({ row: null, line: 'No row has 7.' });
    expect(rollTyped(plan, 'x').row).toBeNull();
    expect(rollTyped(plan, '').line).toBe('A number from 1 to 3.');
  });

  // Purpose: the entry's pop-up says it brings a rolled cantrip.
  it("says so in the entry's pop-up", () => {
    expect(traitHeadings(list!, apprentice, () => undefined)).toContainEqual({ label: 'Spell', text: 'One level 0 spell, rolled at the table when you pick it' });
  });
});

describe('the roll, kept (bq3-18)', () => {
  const rolled: RolledSpell = { entryId: 'reed-apprentice', spellId: 'song-hush', roll: 2 };
  const creation = withRolledSpell({ startingMoney: 10 }, 'fen-backgrounds', rolled);

  // Purpose: the spell rolled is kept with the pick on the creation record, and only for the entry it was rolled for.
  it('keeps the spell with the entry it was rolled for', () => {
    expect(creation.traitSpells).toEqual({ 'fen-backgrounds': rolled });
    expect(rolledSpellOf(creation, 'fen-backgrounds', 'reed-apprentice')).toEqual(rolled);
    expect(rolledSpellOf(creation, 'fen-backgrounds', 'eel-catcher')).toBeNull();
    expect(withRolledSpell(creation, 'fen-backgrounds', null).traitSpells).toBeUndefined();
  });

  // Purpose: the review shows the spell rolled, or, while it's due, says so in bold and makes it the step's check.
  it('gives the review its line and its check', () => {
    expect(rolledSpellReview(plan, rolled)).toEqual({ text: 'Hush: level 0 spell, rolled 2 on d3', problem: null });
    expect(rolledSpellReview(plan, null)).toEqual({ text: 'Level 0 spell not rolled yet', strong: true, problem: 'Roll d3 at the table for your level 0 spell, then tap it.' });
    // A level with no spells asks for nothing (of-2).
    expect(rolledSpellReview(spellRollPlan({ listId: 'reed-songs', level: 4 }, { spells: [], lists: [] }), null)).toBeNull();
  });

  // Purpose: the sheet's trait value opens its entry with the spell rolled, and shows it beside the value.
  it('shows the spell rolled on the sheet, in the entry and beside it', () => {
    const field = { key: 'background', label: 'Background', type: 'list', from: 'fen-backgrounds' } as FieldDefinition;
    const ctx: EntryContext = { all, rulesSets: [], packName: () => '', scores: {}, label: (k) => k, raceRef: null, classRef: null, creation };
    const [entry] = fieldEntries(ctx, field, 'reed-apprentice', [field]);
    expect(entry?.rolled).toBe('Hush: level 0 spell, rolled 2 on d3');
    expect(entry?.headings).toContainEqual({ label: 'Rolled', text: 'Hush: level 0 spell, rolled 2 on d3' });
    // Without the record (another screen), nothing is added.
    expect(fieldEntries({ ...ctx, creation: undefined }, field, 'reed-apprentice', [field])[0]?.rolled).toBeUndefined();
  });

  // Purpose: a race or class change clears the trait picks, and the spells rolled under them go too.
  it('goes with a race or class change', () => {
    const choice = { method: 'roll', rolled: {}, scores: {} } as unknown as Parameters<typeof redoRecord>[1];
    expect(redoRecord(creation, choice, true).creation.traitSpells).toBeUndefined();
    expect(redoRecord(creation, choice, false).creation.traitSpells).toEqual({ 'fen-backgrounds': rolled });
  });
});

function renderStep(extra: { rolled?: RolledSpell | null } = {}) {
  const onSave = vi.fn(async () => true);
  const onPicks = vi.fn();
  render(
    <ToastHost>
      <TraitListStep list={list!} chosen={extra.rolled ? [{ entryId: extra.rolled.entryId }] : []} why="" help={null} rollPlan={(e) => entryRollPlan(e.spellRoll, all)} rolled={extra.rolled ?? null} onPicks={onPicks} onSave={onSave} onBack={() => undefined} onLater={() => undefined} />
    </ToastHost>,
  );
  return { onSave, onPicks };
}

describe('the roll on the step (bq3-18)', () => {
  // Purpose: picking the entry opens its roll under the pick; Next asks for the roll; a tap records it and Next saves both.
  it('opens under the pick, asks for the roll, and saves it with the pick', async () => {
    const user = userEvent.setup();
    const { onSave, onPicks } = renderStep();
    expect(screen.queryByText(/From Reed apprentice/)).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Pick 1–3: Reed apprentice' }));
    const group = screen.getByRole('group', { name: /From Reed apprentice: roll d3 for one level 0 spell/ });
    expect(within(group).getByText('at the table, then tap what it shows')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByText('Roll d3 at the table for your level 0 spell, then tap it.')).toBeTruthy();
    await user.click(within(group).getByRole('checkbox', { name: 'Pick 3: Ripple' }));
    // One count per step (P26a): the foot counts; the group says no "1 of 1 tapped" once tapped.
    expect(within(group).queryByText(/tapped/)).toBeNull();
    expect(onPicks).toHaveBeenLastCalledWith([{ entryId: 'reed-apprentice' }], { entryId: 'reed-apprentice', spellId: 'song-ripple', roll: 3 });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSave).toHaveBeenCalledWith([{ entryId: 'reed-apprentice' }], { entryId: 'reed-apprentice', spellId: 'song-ripple', roll: 3 });
  });

  // Purpose: the player may type the number rolled instead of tapping; the line says what it lands on.
  it('takes the number typed in What you rolled', async () => {
    const user = userEvent.setup();
    const { onSave } = renderStep();
    await user.click(screen.getByRole('checkbox', { name: 'Pick 1–3: Reed apprentice' }));
    await user.type(screen.getByLabelText('What you rolled'), '9');
    expect(screen.getByText('No row has 9.')).toBeTruthy();
    await user.clear(screen.getByLabelText('What you rolled'));
    await user.type(screen.getByLabelText('What you rolled'), '1');
    expect(screen.getByText('1: Marsh glow', { selector: '.auth__meta' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Pick 1: Marsh glow' }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSave).toHaveBeenCalledWith([{ entryId: 'reed-apprentice' }], { entryId: 'reed-apprentice', spellId: 'song-glow', roll: 1 });
  });

  // Purpose: another pick drops the roll (it was for the old entry); an entry without a roll saves with none.
  it('drops the roll with another pick', async () => {
    const user = userEvent.setup();
    const { onSave } = renderStep({ rolled: { entryId: 'reed-apprentice', spellId: 'song-hush', roll: 2 } });
    expect(screen.getByRole('checkbox', { name: 'Pick 2: Hush' }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('checkbox', { name: 'Pick 4–6: Eel catcher' }));
    expect(screen.queryByText(/From Reed apprentice/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSave).toHaveBeenCalledWith([{ entryId: 'eel-catcher' }], null);
  });
});

describe('the foot line with a roll due (pf-16; #671 review)', () => {
  // Purpose: on a list rolled three times, with the entry that brings a roll taken twice and another once and its
  // spell not yet rolled, the foot line names each entry once with its ticks and then asks for the roll; a screen
  // reader hears the count instead of the ticks.
  it('names each entry once with its ticks, then asks for the roll', async () => {
    const user = userEvent.setup();
    render(
      <ToastHost>
        <TraitListStep list={{ ...list!, rolls: 3 }} chosen={[]} why="" help={null} rollPlan={(e) => entryRollPlan(e.spellRoll, all)} onSave={async () => true} onBack={() => undefined} onLater={() => undefined} />
      </ToastHost>,
    );
    await user.click(screen.getByRole('checkbox', { name: /^Pick 1–3: Reed apprentice/ }));
    await user.click(screen.getByRole('checkbox', { name: /^Pick 1–3: Reed apprentice/ }));
    await user.click(screen.getByRole('checkbox', { name: /^Pick 4–6: Eel catcher/ }));
    const status = screen.getByRole('status', { name: 'Step status' });
    const without = (selector: string) => {
      const copy = status.cloneNode(true) as HTMLElement;
      copy.querySelectorAll(selector).forEach((n) => n.remove());
      return copy.textContent;
    };
    expect(without('.visually-hidden')).toBe('Reed apprentice ✓✓, Eel catcher picked. Roll for your level 0 spell');
    expect(without('[aria-hidden="true"]')).toBe('Reed apprentice, picked twice, Eel catcher picked. Roll for your level 0 spell');
  });
});
