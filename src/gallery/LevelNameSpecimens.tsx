// A spell level's words (lv-1, Francis 2026-11-14; pf-22, the lead 2026-11-14) in the component gallery: the app
// writes no word of its own for a level; a list's `levelNames` gives its own (stored as a book prints it mid-sentence,
// so it takes a capital at the start of a title or a line), else "Level 0". The real parts, on invented lists and
// spells: First spells with a named level and with the fallback; the sheet's Magic rows and the Spell book count; a
// list with one level named with its own noun (its rows repeat the word, and its group reads "Pick 1"); a trait's
// rolled spell. New pictures for the lead (lv-1's pictures before merge).
import { useState, type ReactElement, type ReactNode } from 'react';
import { FirstSpellsStep } from '../app/FirstSpellsStep.tsx';
import { TraitListStep } from '../app/TraitListStep.tsx';
import { firstSpellsPlan, NO_PICKS, spellsStepTitle, type FirstSpellsPicks, type SpellEntry } from '../modules/characters/firstSpells.ts';
import { magicOf } from '../modules/characters/magic.ts';
import { traitListsOf } from '../modules/characters/traitLists.ts';
import { entryRollPlan } from '../modules/characters/traitSpellRoll.ts';
import { CreationLeave } from '../ui/creation.tsx';
import { MagicBlock } from '../ui/MagicBlock.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const none = () => {};
const GLIMMER = { one: 'glimmer', many: 'glimmers' };
const spell = (id: string, name: string, lists: Record<string, number>, extra: Record<string, unknown> = {}): SpellEntry => ({
  packEntryId: id,
  name,
  data: { id, name, lists, range: '30 ft', duration: { value: 3, unit: 'turn' }, ...extra },
});
const SPELLS: SpellEntry[] = [
  spell('reed-whisper', 'Reed whisper', { 'fen-witch': 1 }, { range: 'touch' }),
  spell('mire-grip', 'Mire grip', { 'fen-witch': 1 }),
  spell('frog-chorus', 'Frog chorus', { 'fen-witch': 0 }),
  spell('dry-boots', 'Dry boots', { 'fen-witch': 0 }, { range: 'touch' }),
  spell('knot-charm', 'Knot charm', { 'fen-witch': 0 }),
  spell('spark', 'Spark', { glimmers: 1 }),
  spell('shimmer', 'Shimmer on the black water at the turn of the tide', { glimmers: 1 }),
];
const witchList = (levelNames?: Record<string, unknown>): SpellEntry => ({
  packEntryId: 'fen-witch',
  name: 'Fen witch spells',
  data: { levels: [{ level: 0, spells: ['frog-chorus', 'dry-boots', 'knot-charm'] }, { level: 1, spells: ['reed-whisper', 'mire-grip'] }], ...(levelNames ? { levelNames } : {}) },
});
const GLIMMERS_LIST: SpellEntry = { packEntryId: 'glimmers', name: 'Glimmers', data: { levels: [{ level: 1, spells: ['spark', 'shimmer'] }], levelNames: { '1': GLIMMER } } };
const WITCH: SpellEntry = { packEntryId: 'fen-witch-class', name: 'Fen witch', data: { spellcasting: { listId: 'fen-witch', type: 'book', fromLevel: 1, firstSpells: { choose: 1 }, known: { byLevel: [{ level: 1, count: 2 }], listLevel: 0 } } } };
const WEAVER: SpellEntry = { packEntryId: 'fae-weaver', name: 'Fae weaver', data: { spellcasting: { listId: 'glimmers', type: 'known', fromLevel: 1, known: { byLevel: [{ level: 1, count: 1 }], listLevel: 1 } } } };
const settingWith = (lists: SpellEntry[]) => ({ spells: SPELLS, lists, tables: [], choices: {} });

/** First spells, the real step, picks kept here. */
function Spells({ klass, lists, title }: { klass: SpellEntry; lists: SpellEntry[]; title: string }) {
  const [picks, setPicks] = useState<FirstSpellsPicks>(NO_PICKS);
  const plan = firstSpellsPlan(klass, 1, settingWith(lists));
  if (!plan) return null;
  return (
    <CreationLeave onLeave={none}>
      <FirstSpellsStep plan={plan} picks={picks} onPicks={setPicks} title={spellsStepTitle(plan, title)} counter={{ at: 7, of: 9 }} why="Your first spells, as your class gives them." help={null} level={1} onBack={none} onSave={() => Promise.resolve(true)} />
    </CreationLeave>
  );
}

// A trait list whose entry rolls one spell from a list that names its level 0.
const SONGS = [
  { kind: 'spellList', packEntryId: 'reed-songs', name: 'Reed songs', data: { levels: [{ level: 0, spells: ['song-glow', 'song-hush', 'song-ripple'] }], levelNames: { '0': { one: 'lesser glimmer', many: 'lesser glimmers' } } } },
  ...['song-glow', 'song-hush', 'song-ripple'].map((id, i) => ({ kind: 'spell', packEntryId: id, name: ['Marsh glow', 'Hush', 'Ripple'][i]!, data: { lists: { 'reed-songs': 0 } } })),
  {
    kind: 'traitList',
    packEntryId: 'fen-backgrounds',
    name: 'Fen backgrounds',
    data: { die: 'd6', entries: [{ id: 'reed-apprentice', name: 'Reed apprentice', min: 1, max: 3, blurb: 'Learnt a little song.', spells: { roll: { listId: 'reed-songs', level: 0 } } }, { id: 'eel-catcher', name: 'Eel catcher', min: 4, max: 6 }] },
  },
];
const BACKGROUNDS = traitListsOf(SONGS)[0]!;

export function LevelNameSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  const named = magicOf({ klass: WITCH, race: null, level: 1, book: ['reed-whisper', 'frog-chorus', 'dry-boots'], prepared: [], slots: [], spells: SPELLS, lists: [witchList({ '0': GLIMMER })] })!;
  const fallback = magicOf({ klass: WITCH, race: null, level: 1, book: ['reed-whisper', 'frog-chorus', 'dry-boots'], prepared: [], slots: [], spells: SPELLS, lists: [witchList()] })!;
  const weaver = magicOf({ klass: WEAVER, race: null, level: 1, book: ['spark', 'shimmer'], prepared: [], slots: [], spells: SPELLS, lists: [GLIMMERS_LIST] })!;
  return (
    <>
      <Specimen name="First spells, the list naming its level 0 (pf-22): Glimmers: pick 2, each spell's line Glimmer, the foot counts glimmers">
        <Spells klass={WITCH} lists={[witchList({ '0': GLIMMER })]} title="First spells" />
      </Specimen>
      <Specimen name="First spells, the list naming nothing: the fallback, Level 0: pick 2, each line Level 0, the foot counts level 0 spells">
        <Spells klass={WITCH} lists={[witchList()]} title="First spells" />
      </Specimen>
      <Specimen name="First spells, a list whose one level is named with its own noun: the step is Glimmers, its group Pick 1, never doubled">
        <Spells klass={WEAVER} lists={[GLIMMERS_LIST]} title="First spells" />
      </Specimen>
      <Specimen name="First spells, the same list naming no level: the step is Glimmers, its group still Pick 1 (one rule: a title that only repeats the step's drops the repeat)">
        <Spells klass={WEAVER} lists={[{ ...GLIMMERS_LIST, data: { levels: GLIMMERS_LIST.data.levels } }]} title="First spells" />
      </Specimen>
      <Specimen name="The sheet's Magic, the level named: rows Glimmer, the Spell book count 1 spell, 2 glimmers">
        <MagicBlock magic={named} onOpen={none} />
      </Specimen>
      <Specimen name="The sheet's Magic, the fallback: rows Level 0, the Spell book count 1 spell, 2 at level 0">
        <MagicBlock magic={fallback} onOpen={none} />
      </Specimen>
      <Specimen name="The sheet's Magic, an unlevelled list Glimmers: every row reads Glimmer, under the list's own heading">
        <MagicBlock magic={weaver} onOpen={none} />
      </Specimen>
      <Specimen name="A trait's rolled spell, its list naming level 0 lesser glimmer: roll d3 for one lesser glimmer">
        <CreationLeave onLeave={none}>
          <TraitListStep
            list={BACKGROUNDS}
            chosen={[{ entryId: 'reed-apprentice' }]}
            why="Where you grew up, and what it taught you."
            roll="Roll d6, then tap what it shows"
            help={null}
            counter={{ at: 6, of: 9 }}
            rollPlan={(entry) => entryRollPlan(entry.spellRoll, SONGS)}
            onSave={() => Promise.resolve(true)}
            onLater={none}
            onBack={none}
          />
        </CreationLeave>
      </Specimen>
    </>
  );
}
