// @vitest-environment jsdom
// A figure's sheet in one tap (plan dec-player-figure-sheet; rulings sv-1, sv-2, sv-2a, sv-2b and the lead's rulings on
// its two ⚑; mockup 14 frames P7, P7b). Invented saves, scores, kindreds, classes and rules only.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { modifierEffects } from '../modules/characters/creationSteps.ts';
import { saveModifierLines, saveRules, type Save, type SaveModifierInput } from '../modules/characters/play.ts';
import { BreakdownSheet } from '../ui/BreakdownSheet.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { SaveTiles } from './FigureSheets.tsx';

afterEach(cleanup);

const MIRE: Save = { key: 'M', name: 'Save vs mire', short: 'Mire', value: '12', note: 'Sinking ground and sucking mud.' };
const HEX: Save = { key: 'H', name: 'Save vs hexes', short: 'Hexes', value: '14', note: '' };
const RULE = ['Equal or higher: the mire lets go.', 'Lower: the mire takes hold in full.'];
// An invented rules set that rolls a d20 for saves and passes at or over the number (pf-20).
const OVER = [{ rolls: { save: { die: 'd20', pass: 'atOrOver' } } }];

describe("a save's sheet (sv-2, sv-2a, sv-2b)", () => {
  it("a tap on a save opens one sheet that shows the rule's words; there is no row that opens a second sheet", async () => {
    // Purpose: the rule is seen after the first tap, never behind a "The rule" row and a second pop-up.
    const person = userEvent.setup();
    render(<SaveTiles saves={[MIRE, HEX]} rules={RULE} rulesSets={[]} source="Fen sample" />);
    await person.click(screen.getByRole('button', { name: /vs mire/ }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    const sheet = within(screen.getByRole('dialog', { name: 'Save vs mire' }));
    for (const line of RULE) expect(sheet.getByText(line)).toBeTruthy();
    expect(sheet.queryByRole('button', { name: /The rule/ })).toBeNull();
    expect(sheet.getByText('From your setting: Fen sample')).toBeTruthy();
  });

  it('the save\'s number sits in the head beside its name, not as a line under it', async () => {
    // Purpose: the Figure head (the lead's ruling on ⚑ 2, P7): name and number level, the number before ✕.
    const person = userEvent.setup();
    render(<SaveTiles saves={[MIRE]} rules={RULE} rulesSets={[]} source={null} />);
    await person.click(screen.getByRole('button', { name: /vs mire/ }));
    const sheet = screen.getByRole('dialog', { name: 'Save vs mire' });
    const head = sheet.querySelector('.dialog__head--figure')!;
    expect(head.querySelector('.dialog__figure')?.textContent).toBe('12');
    expect([...head.children].map((c) => c.className)).toEqual(['dialog__title book-heading', 'dialog__figure', expect.stringContaining('close')]);
    expect(sheet.querySelector('.breakdown-sheet__figure')).toBeNull();
  });

  it('the sheet has no heading "The rule" and no section about the character: no class-and-level line, no note about the save', async () => {
    // Purpose: sv-2a and the lead's ruling on ⚑ 1 (where the number comes from is not a modifier).
    const person = userEvent.setup();
    render(<SaveTiles saves={[MIRE]} rules={RULE} rulesSets={[]} source={null} />);
    await person.click(screen.getByRole('button', { name: /vs mire/ }));
    const sheet = within(screen.getByRole('dialog', { name: 'Save vs mire' }));
    expect(sheet.queryByText('The rule')).toBeNull();
    expect(sheet.queryByText(/^For /)).toBeNull();
    expect(sheet.queryByText(/at level/)).toBeNull();
    expect(sheet.queryByText('Sinking ground and sucking mud.')).toBeNull();
  });

  it('a save shows "Modifiers" with its own lines when something changes it, and no heading when nothing does', async () => {
    // Purpose: sv-2b; each save gets the lines that change it.
    const person = userEvent.setup();
    const modifiers = (s: Save) => (s.key === 'H' ? ['Spell ward: +1 from Wit.'] : []);
    render(<SaveTiles saves={[MIRE, HEX]} rules={RULE} rulesSets={[]} modifiers={modifiers} source={null} />);
    await person.click(screen.getByRole('button', { name: /vs hexes/ }));
    const region = within(screen.getByRole('region', { name: 'Modifiers' }));
    expect(region.getByRole('heading', { name: 'Modifiers' })).toBeTruthy();
    expect(region.getByText('Spell ward: +1 from Wit.')).toBeTruthy();
    await person.click(screen.getByRole('button', { name: 'Close' }));
    await person.click(screen.getByRole('button', { name: /vs mire/ }));
    expect(screen.queryByText('Modifiers')).toBeNull();
  });

  it("the save's own sheet carries its roll line with that save's number and the d20, and the setting-silent ending only when there is neither rule nor roll", async () => {
    // Purpose: sv-1 on a save's sheet ("Roll d20: 12 or higher succeeds."), built from `rolls.save` (pf-20), never typed in.
    const person = userEvent.setup();
    const { unmount } = render(<SaveTiles saves={[MIRE]} rules={[]} rulesSets={OVER} source={null} />);
    await person.click(screen.getByRole('button', { name: /vs mire/ }));
    const sheet = screen.getByRole('dialog', { name: 'Save vs mire' });
    expect(within(sheet).getByText('Roll d20: 12 or higher succeeds.')).toBeTruthy();
    expect(sheet.querySelector('[data-die="20"]')).not.toBeNull();
    expect(within(sheet).queryByText(/doesn't say how saves are rolled/)).toBeNull();
    unmount();
    render(<SaveTiles saves={[MIRE]} rules={[]} rulesSets={[]} source={null} />);
    await person.click(screen.getByRole('button', { name: /vs mire/ }));
    expect(screen.getByText("Your setting doesn't say how saves are rolled. Ask your GM.")).toBeTruthy();
  });
});

describe('the Saves line under the tiles (sv-1, piece 4)', () => {
  it('reads "or higher" for a rules set that passes at or over the number, with the d20 glyph', () => {
    // Purpose: the line is built from `rolls.save` and carries the standard die glyph.
    const { container } = render(<SaveTiles saves={[MIRE]} rules={RULE} rulesSets={OVER} source={null} />);
    expect(screen.getByText("Roll d20: your save's number or higher succeeds.")).toBeTruthy();
    expect(container.querySelector('.roll-row [data-die="20"]')).not.toBeNull();
  });

  it('reads "or lower" for a rules set that passes at or under it', () => {
    // Purpose: a setting that rolls under reads right.
    render(<SaveTiles saves={[MIRE]} rules={RULE} rulesSets={[{ rolls: { save: { die: 'd20', pass: 'atOrUnder' } } }]} source={null} />);
    expect(screen.getByText("Roll d20: your save's number or lower succeeds.")).toBeTruthy();
  });

  it('shows no line for a rules set with no roll for saves', () => {
    // Purpose: a rules set without the key (or with only a check against a score) shows no line, and no glyph.
    const { container } = render(<SaveTiles saves={[MIRE]} rules={RULE} rulesSets={[{ rolls: { abilityCheck: { die: 'd20', pass: 'atOrUnder' } } }]} source={null} />);
    expect(screen.queryByText(/^Roll d20/)).toBeNull();
    expect(container.querySelector('.roll-row')).toBeNull();
  });
});

describe("a save's Modifiers from the rules, the kindred and the class (play.ts saveModifierLines)", () => {
  const rulesSets = [{ saveRule: 'Roll a d20; meet the number to save.', saveModifiers: [{ id: 'ward', name: 'spell ward', value: { from: 'WIT', plusRaceField: 'spellWard' } }, { id: 'eel', name: 'Against eel venom', value: 2 }] }];
  const input = (over: Partial<SaveModifierInput>): SaveModifierInput => ({
    filled: { 'abilityModifiers.WIT': { saveBonus: 0 } },
    rulesSets,
    race: null,
    raceName: 'Stone kin',
    klass: null,
    className: 'Lantern Warden',
    scores: {},
    label: () => 'Wit',
    ...over,
  });

  it("splits a score-driven save modifier into the score's part and the kindred's part, each only when it gives something", () => {
    // Purpose (#784 review): with a kindred bonus of 2 and a score that gives 0, the sheet never says "+2 from Wit".
    expect(saveModifierLines('M', input({ race: { spellWard: 2 } }))).toEqual(['Spell ward: +2 from Stone kin.']);
    expect(saveModifierLines('M', input({ race: { spellWard: 2 }, filled: { 'abilityModifiers.WIT': { saveBonus: 1 } } }))).toEqual(['Spell ward: +1 from Wit.', 'Spell ward: +2 from Stone kin.']);
    expect(saveModifierLines('M', input({}))).toEqual([]);
  });

  it("names the kindred's and the class's own save bonuses, for the saves they name, as modifiers", () => {
    // Purpose: the lead's ruling on ⚑ 1, a kindred's or class's bonus that changes this save is a modifier.
    const race = { saveBonusByCon: { saves: ['M(poison)', 'H'], byCon: [{ con: '13-18', bonus: 3 }] } };
    const klass = { saveBonus: [{ bonus: 2, saves: ['M'] }, { bonus: 1, vs: 'hexes', saves: ['H'] }] };
    expect(saveModifierLines('M', input({ race, klass, scores: { CON: 14 } }))).toEqual(['Vs poison: +3 from Stone kin.', 'To the roll: +2 from Lantern Warden.']);
    expect(saveModifierLines('H', input({ race, klass, scores: { CON: 14 } }))).toEqual(['To the roll: +3 from Stone kin.', 'Vs hexes: +1 from Lantern Warden.']);
    expect(saveModifierLines('M', input({ race, klass, scores: { CON: 9 } }))).toEqual(['To the roll: +2 from Lantern Warden.']);
  });

  it("keeps the score-driven modifier out of the rule's lines, and the fixed one in", () => {
    // Purpose: no line said twice on the sheet.
    expect(saveRules(rulesSets, { scoresApart: true })).toEqual(['Roll a d20; meet the number to save.', 'Against eel venom +2']);
  });

  it('shows a save modifier given by a fill path into a score\'s row under Modifiers with its number, never as a bare line', () => {
    // Purpose (Francis's bug report, 24 Nov): a `{ fill: "abilityModifiers.<score>.<column>" }` modifier is score-driven,
    // like `{ from }`: its number from the character's row under Modifiers, nothing in the rule's lines, nothing at 0.
    const withFill = [{ saveRule: 'Roll a d20; meet the number to save.', saveModifiers: [{ id: 'grit-hexes', name: 'Grit vs hexes', value: { fill: 'abilityModifiers.GRT.hexSaves' }, appliesWhen: 'hexes' }] }];
    const grit = (hexSaves: number) => input({ rulesSets: withFill, filled: { 'abilityModifiers.GRT': { hexSaves, melee: 2 } }, label: () => 'Grit' });
    expect(saveModifierLines('M', grit(1))).toEqual(['Grit vs hexes: +1 from Grit.']);
    expect(saveModifierLines('M', grit(-2))).toEqual(['Grit vs hexes: −2 from Grit.']);
    expect(saveModifierLines('M', grit(0))).toEqual([]);
    expect(saveRules(withFill, { scoresApart: true })).toEqual(['Roll a d20; meet the number to save.']);
  });

  it("prints nothing for a save modifier whose value the app can't read", () => {
    // Purpose: an entry with neither a number, nor `{ from }`, nor a `fill` never leaves a bare name on the sheet.
    const odd = [{ saveRule: 'Roll a d20; meet the number to save.', saveModifiers: [{ id: 'odd', name: 'Grit vs hexes', value: 'Grit modifier' }, { id: 'blank', name: 'Against marsh fog' }] }];
    expect(saveRules(odd, { scoresApart: true })).toEqual(['Roll a d20; meet the number to save.']);
    expect(saveModifierLines('M', input({ rulesSets: odd }))).toEqual([]);
  });
});

describe("a score's sheet (sv-2a)", () => {
  const rules = [{ abilityModifierColumns: { loyalty: 'value' }, abilityModifiers: { MUS: [{ range: '3-8', melee: -1, openDoors: '1-in-6', loyalty: 6 }, { range: '9-12', melee: 0, openDoors: '2-in-6', loyalty: 7 }, { range: '13-18', melee: 1, openDoors: '2-in-6', loyalty: 7 }] } }];

  it('lists each effect once under "Modifiers", including one that gives nothing', () => {
    // Purpose: a middling score still says what the score is for ("Melee: no change."), each effect named once.
    expect(modifierEffects(rules, 'MUS', 10)).toEqual(['Melee: no change.', 'Open doors: 2-in-6.', 'Loyalty: 7.']);
    expect(modifierEffects(rules, 'MUS', 15)).toEqual(['Melee: +1.', 'Open doors: 2-in-6.', 'Loyalty: 7.']);
    expect(modifierEffects(rules, 'MUS', 4)).toEqual(['Melee: −1.', 'Open doors: 1-in-6.', 'Loyalty: 6.']);
  });

  it("gives nothing for a score outside the table's ranges, as the tile's words do, and never a bare number", () => {
    // Purpose (#784 review): agree with `modifierWords`; a line always names what it changes.
    expect(modifierEffects(rules, 'MUS', 25, { melee: 3 })).toEqual([]);
    expect(modifierEffects([], 'MUS', null, 2)).toEqual([]);
  });

  it("falls back to the character's filled row when the setting has no table, and gives nothing without one", () => {
    // Purpose: no new arithmetic; the sheet shows what the figure already counts.
    expect(modifierEffects([], 'MUS', null, { melee: 2, range: '18' })).toEqual(['Melee: +2.']);
    expect(modifierEffects([], 'MUS', null)).toEqual([]);
  });

  it('draws the number in the head, "Modifiers" over the effects, then the rule\'s words with no heading, then the source', () => {
    // Purpose: the score's sheet as frame P7b draws it.
    render(<BreakdownSheet title="Muscle" figure="13" figureHead modifiers={['Melee: +1.', 'Carrying: no change.']} rule={['Lifting, hitting and holding a line.']} source="Fen sample" onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Muscle' });
    const sheet = within(dialog);
    expect(dialog.querySelector('.dialog__head--figure .dialog__figure')?.textContent).toBe('13');
    expect(sheet.getByRole('heading', { name: 'Modifiers' })).toBeTruthy();
    expect(sheet.getByText('Carrying: no change.')).toBeTruthy();
    expect(sheet.getByText('Lifting, hitting and holding a line.')).toBeTruthy();
    expect(sheet.getByText('From your setting: Fen sample')).toBeTruthy();
    expect(sheet.queryByText('The rule')).toBeNull();
  });
});

describe('the Figure head is a variant: other sheets keep their head', () => {
  it('a sheet with no figure has the plain head and no number', () => {
    // Purpose: only figure sheets change (the lead's ruling on ⚑ 2); every other sheet's head stays as it was.
    render(
      <Dialog label="Fen common" onClose={() => {}}>
        <p>Spoken along the reeds.</p>
      </Dialog>,
    );
    const head = screen.getByRole('dialog', { name: 'Fen common' }).querySelector('.dialog__head')!;
    expect(head.className).toBe('dialog__head');
    expect(head.querySelector('.dialog__figure')).toBeNull();
  });
});
