// @vitest-environment jsdom
// The rule lines in the headings' rows (plan dec-13 row C5; sv-3, ps-7, pf-20; frames P1 and P2 of december/14,
// approved ps-9 2026-11-14). Invented saves, scores and rules sets only.
//   The Saves heading's row carries the saves' line: the d20's glyph and "Roll d20: your save's number or higher
//   succeeds.", built from the rules set's `rolls.save`.
//   The Scores heading's row carries the scores' line, "Roll d20: your score or lower succeeds.", from `rolls.abilityCheck`.
//   A rules set without the roll shows the heading alone (no empty row, no glyph).
//   The save tiles, hosted under a heading that carries the line, don't draw it a second time under the tiles.
//   The full sheet's Saves and Scores sections (SheetSection) can carry the line in their heading's row too.
//   Per roll type (rl-1, Francis 2026-11-15): a set above with only `save` doesn't hide a lower set's check, so the Scores
//   heading still carries the lower set's line; a set alone with only `save` leaves the Scores heading alone. (The
//   December stack itself: rolls.realPacks.test.ts.)
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import type { Save } from '../modules/characters/play.ts';
import { savesLine, scoresLine } from '../modules/library/rolls.ts';
import { RuleHeading } from '../ui/RuleHeading.tsx';
import { rollWordsOutsideRollRows } from '../testing/rollRowGuard.ts';
import { SaveTiles } from './FigureSheets.tsx';
import { SheetSection } from './SheetSection.tsx';
import { openFullSheetFromMenu } from '../testing/openFullSheet.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

afterEach(cleanup);

const MIRE: Save = { key: 'M', name: 'Save vs mire', short: 'Mire', value: '12', note: '' };
const BOTH = [{ rolls: { save: { die: 'd20', pass: 'atOrOver' }, abilityCheck: { die: 'd20', pass: 'atOrUnder' } } }];
const SAVE_ONLY_ON_TOP = [...BOTH, { rolls: { save: { die: 'd20', pass: 'atOrOver' } } }];
const NONE = [{ naturals: {} }];

const heading = (id: string, words: string) => (
  <h2 id={id} className="play-block__title">
    {words}
  </h2>
);

describe("the rule line in a heading's row (sv-3)", () => {
  it("puts the saves' line with its d20 in the Saves heading's own row", () => {
    render(<RuleHeading heading={heading('h-saves', 'Saves')} line={savesLine(BOTH)} />);
    const row = screen.getByRole('heading', { name: 'Saves' }).parentElement!;
    expect(row.classList.contains('rule-heading')).toBe(true);
    const line = row.querySelector('.roll-row--heading')!;
    expect(line.textContent).toBe("Roll d20: your save's number or higher succeeds.");
    expect(line.querySelector('.die-glyph')?.getAttribute('data-die')).toBe('20');
    // It is the Roll row's heading variant, so the Roll row guard counts it as a Roll row.
    expect(line.classList.contains('roll-row')).toBe(true);
    expect(rollWordsOutsideRollRows(document.body)).toEqual([]);
  });

  it("puts the scores' line, at or under, in the Scores heading's row", () => {
    render(<RuleHeading heading={heading('h-scores', 'Scores')} line={scoresLine(BOTH)} />);
    const row = screen.getByRole('heading', { name: 'Scores' }).parentElement!;
    expect(row.querySelector('.roll-row--heading')!.textContent).toBe('Roll d20: your score or lower succeeds.');
  });

  it('shows the heading alone where the rules carry no such roll', () => {
    const { container } = render(<RuleHeading heading={heading('h-scores', 'Scores')} line={scoresLine(NONE)} />);
    expect(screen.getByRole('heading', { name: 'Scores' })).toBeTruthy();
    expect(container.querySelector('.rule-heading')).toBeNull();
    expect(container.querySelector('.die-glyph')).toBeNull();
  });

  it("per roll type (rl-1): a set on top with only the save roll keeps the lower set's check; alone, it gives none", () => {
    expect(savesLine(SAVE_ONLY_ON_TOP)?.words).toBe("Roll d20: your save's number or higher succeeds.");
    expect(scoresLine(SAVE_ONLY_ON_TOP)?.words).toBe('Roll d20: your score or lower succeeds.');
    expect(scoresLine([{ rolls: { save: { die: 'd20', pass: 'atOrOver' } } }])).toBeNull();
  });
});

describe('the save tiles under a heading that carries the line', () => {
  it("don't draw the saves' line a second time under the tiles", () => {
    render(
      <section>
        <RuleHeading heading={heading('h-saves', 'Saves')} line={savesLine(BOTH)} />
        <SaveTiles saves={[MIRE]} rules={[]} rulesSets={BOTH} source={null} lineInHeading />
      </section>,
    );
    expect(screen.getAllByText("Roll d20: your save's number or higher succeeds.")).toHaveLength(1);
  });

  it('still draw it under the tiles when no heading carries it (the default)', () => {
    const { container } = render(<SaveTiles saves={[MIRE]} rules={[]} rulesSets={BOTH} source={null} />);
    expect(container.querySelector('.roll-row')?.textContent).toBe("Roll d20: your save's number or higher succeeds.");
  });
});

describe("the full sheet's section heading", () => {
  it("carries the rule line in its heading's row, and its heading alone without one", () => {
    render(
      <>
        <SheetSection label="Saves" labelLine={savesLine(BOTH)}>
          <p>tiles</p>
        </SheetSection>
        <SheetSection label="Scores" labelLine={scoresLine(NONE)}>
          <p>tiles</p>
        </SheetSection>
      </>,
    );
    const saves = screen.getByRole('heading', { name: 'Saves' }).parentElement!;
    expect(saves.classList.contains('rule-heading')).toBe(true);
    expect(saves.textContent).toContain('Roll d20: your save');
    expect(screen.getByRole('heading', { name: 'Scores' }).parentElement!.classList.contains('rule-heading')).toBe(false);
  });
});

// The class's note on its skills (plan test-feedback-2026-11-19 row A8; ps-7, plan dec-13 row C5; frames P1 and P2 of
// december/14, approved ps-9 2026-11-14: the Skills heading with no line under it). On the invented fixture pack.
//   Purpose: on the Player tab a class with a skills note shows no line under "Skills"; the full sheet's own page still
//   shows it (06, Skills block).
describe("the class's skills note under the Skills heading", () => {
  const fenPack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
  const NOTE = 'Wardens hark best at night, when the reeds are still.';

  beforeEach(() => {
    world = createFakeDb();
    forgetFileLinks();
    forgetCampaignSetting();
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  /** The fixture on a campaign; Wren, an approved bog folk Lantern Warden whose class carries a skills note, for Sam. */
  function noteWorld() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
    const entry = (kind: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
    const lists: [string, string][] = [['rulesSets', 'rulesSet'], ['races', 'race'], ['classes', 'class'], ['hooks', 'hook'], ['items', 'item'], ['traitLists', 'traitList'], ['fieldTemplates', 'fieldTemplate']];
    for (const [list, kind] of lists)
      for (const data of fenPack[list] ?? []) entry(kind, data.id === 'lantern-warden' ? { ...data, skills: { note: NOTE } } : data);
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
    const layout = (fenPack.fieldTemplates![0]!.fields as { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; from?: string }[]).filter((f) => f.key !== 'omen' && f.key !== 'hp' && !f.from);
    layout.forEach((f, order) =>
      world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type: f.type === 'list' && !f.choices?.length ? 'text' : f.type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: false, from_list: null, created_at: '2026-10-18T12:00:00Z' }),
    );
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam, approval: 'approved' });
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, {
      level: 1,
      hp_current: 6,
      hp_max: 9,
      race_ref: 'bog-folk',
      fields: { MUS: 13, NIM: 12, GRT: 11, WIT: 14, LORE: 9, CHARM: 10 },
      classes: [{ classRef: 'lantern-warden', level: 1, xp: 120 }],
    });
    world.addMember(campaign, sam, 'player', wren);
    world.signInAs(sam);
  }

  it('shows no line under "Skills" on the Player tab, and keeps it on the full sheet’s own page', async () => {
    noteWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await screen.findByRole('region', { name: 'Vitals' });
    // The Player tab: the Skills heading and its rows, with no note under the heading.
    expect(screen.getByRole('heading', { name: 'Skills' })).toBeTruthy();
    const onTab = screen.getByRole('region', { name: 'Skills' });
    expect(within(onTab).getByRole('button', { name: /^Hark/ })).toBeTruthy();
    expect(within(onTab).queryByText(NOTE)).toBeNull();
    expect(onTab.querySelector('p')).toBeNull();
    expect(screen.queryByText(NOTE)).toBeNull();
    // The full sheet's own page: the note under the heading, as 06's Skills block has it.
    await openFullSheetFromMenu(user);
    await screen.findByRole('region', { name: 'Level' });
    const skills = screen.getByRole('region', { name: 'Skills' });
    expect(within(skills).getByText(NOTE)).toBeTruthy();
  });
});
