// Places from packs in the gallery (M8b slice 0, pull request 2; mockup design/mockups/places/01-place-picker.html):
// the picker's content (the sections, a pack's group unfolded two levels), its search with shared names, its empty
// state, and the place card's lines from a pack. Invented places only; nothing here writes.
import type { ReactElement, ReactNode } from 'react';
import { Icon } from '../ui/icons.tsx';
import { PlacePickerBody } from '../app/PlacePicker.tsx';
import { NoteLines, PlaceFactLines, PlaceFactsBody, PlaceIdentity } from '../app/PlaceFacts.tsx';
import { PlaceLine } from '../app/PlaceCard.tsx';
import { RuleText } from '../ui/RuleText.tsx';
import { ruleBlocks, type PlayersRule } from '../modules/expedition/placeRules.ts';
import { readPlaceFacts } from '../modules/expedition/placeFacts.ts';
import type { Place, ScenePlace } from '../modules/expedition/placePlay.ts';
import { readTable, type ReadTable } from '../modules/expedition/tables.ts';
import type { PackPlace } from '../modules/expedition/placeTree.ts';

const fen = (entryId: string, name: string, type: string, parentId: string | null, extra: Partial<PackPlace> = {}): PackPlace => ({
  packId: 'pack-fen',
  packName: 'Fen Marches', // words: names
  packKind: 'homebrew',
  entryId,
  name,
  type,
  parentId,
  key: null,
  hex: null,
  settlement: false,
  terrain: null,
  ...extra,
});
const PLACES: PackPlace[] = [
  fen('region', 'The Long Fen', 'region', null), // words: names
  fen('hex-0412', 'Heron Isle', 'area', 'region', { key: '0412', hex: '0412', terrain: 'marsh' }), // words: names
  fen('heron-site', 'Heron Isle', 'site', 'hex-0412'), // words: names
  fen('chapel', 'The Sunken Chapel', 'site', 'hex-0412'), // words: names
  fen('reed-road', 'Along the Reed Road', 'site', 'hex-0412'), // words: names
  fen('hex-0413', 'Saltreach and the Eel Weirs', 'area', 'region', { key: '0413', hex: '0413' }), // words: names
  fen('saltreach', 'Saltreach', 'site', 'hex-0413', { settlement: true }), // words: names
  fen('fish-salt', 'Fish Market', 'building', 'saltreach'), // words: names
  fen('ford', "Marlow's Ford", 'site', 'hex-0413'), // words: names
  fen('fish-ford', 'Fish Market', 'building', 'ford'), // words: names
  { ...fen('stair', "The Fishers' Stair", 'room', null), packId: 'pack-abbey', packName: 'The Drowned Abbey', packKind: 'adventure' }, // words: names
];
const here: Place = {
  id: 'place-heron',
  campaignId: 'gallery',
  name: 'Heron Isle', // words: names
  description: '',
  notes: null,
  version: 1,
  notesVersion: 1,
  pack: { packId: 'pack-fen', entryId: 'hex-0412', type: 'area', parentId: 'region', key: '0412' },
  playersName: '',
  regionId: '',
  terrainId: 'marsh',
};
const RECENT: Place[] = [
  { ...here, id: 'place-salt', name: 'Saltreach', pack: { packId: 'pack-fen', entryId: 'saltreach', type: 'site', parentId: 'hex-0413', key: '' }, terrainId: '' },
  { ...here, id: 'place-camp', name: 'The Reed Camp with the Nine Drowned Steps and the Long Causeway', pack: null, terrainId: '' }, // words: names
];

// Hexes by the dozen under the region (a region pack's shape), so the tree shows "Show N more". // words: names
const MANY: PackPlace[] = [
  ...PLACES,
  ...Array.from({ length: 44 }, (_, i) => fen(`hex-${500 + i}`, `Hex ${500 + i} of the fen`, 'area', 'region', { key: String(500 + i), hex: String(500 + i) })),
];

const none = () => undefined;

// December piece 2c: an invented river town as a pack writes it (pf-3 … pf-5). // words: names
const REEDMOUTH = readPlaceFacts({
  identity: 'A river town of reed-cutters and ferrymen, held by the [[npc:wardens|Heron Wardens]].', // words: names
  facts: [
    { lead: 'Inhabitants', text: '1,100 (a small town).' },
    { lead: 'Ruler', text: 'Warden Halewyn, for the Heron Wardens.' }, // words: names
    { lead: 'Religion', text: 'The Lantern rite.' }, // words: names
    { lead: 'Rumours', text: '[[table:reed-rumours|Reedmere rumours]], d20.' }, // words: names
  ],
  tableIds: ['town-day', 'reed-rumours'],
  gm: {
    sections: [
      { heading: 'The town', text: 'A hundred tarred roofs on stilts, a quay that floods each spring.' },
      { heading: "The Wardens' grip", text: 'They take a toll at the quay and an eel in ten.' }, // words: names
      { heading: 'A brewing trouble', text: 'The ferrymen have stopped paying.' },
    ],
  },
  settlement: { size: 'town', watch: { text: 'Six Wardens with poles and nets.', leads: [{ lead: 'Arrival on the scene', text: '2d6 rounds after a cry is raised.' }], statBlockId: 'heron-warden' } }, // words: names
});
const table = (id: string, name: string, die: string): ReadTable => readTable(id, name, { die, rows: [{ min: 1, max: 6, result: 'A funeral, bound for the graveyard' }] })!;
const TOWN_TABLES = new Map<string, ReadTable>([
  ['town-day', table('town-day', 'Encounters in town, by day', 'd6')],
  ['reed-rumours', table('reed-rumours', 'Reedmere rumours', 'd20')], // words: names
]);
// A place's rule open to players (dec-7 piece 3, 02-20 and 02-22): its button on the place line, and its words.
const FALLING_IN = ruleBlocks({
  blocks: [
    { p: 'A character in the harbour’s water is cold at once and in danger within the turn.' },
    { h: 'Each turn in the water' },
    { lead: 'Swimming', p: 'A save, or the character becomes Exhausted.' },
    { list: ['A rope thrown from the jetty', 'A boat alongside', 'A friend in the water'] },
    { box: [{ p: 'The jetty’s ladder is rotten below the waterline.' }, { list: ['Climbing it: a save, or back in the water'] }], title: 'The old ladder' },
    { table: { title: 'Hauled out', columns: ['By', 'Takes'], rows: [['A rope from the jetty', '1 turn'], ['A boat alongside', 'At once']] } },
    { source: 'From your adventure: The Reed Marches, p. 40.' },
  ],
});
// dec-7 piece 2 (pf-12e): an icon of the set, alone, beside a button whose words name no icon (the generic mark).
const HARBOUR_RULES: PlayersRule[] = [
  { group: 1, placeName: '1 The jetty', name: 'Falling into the harbour', blocks: FALLING_IN, button: { icon: 'water-splash', words: 'Someone fell in' } }, // words: names
  { group: 1, placeName: '1 The jetty', name: 'Rowing and swimming', blocks: [], button: 'Someone is swimming' }, // words: names
];
const AT_THE_JETTY: ScenePlace = { group: 1, name: '1 The jetty', pieces: [{ id: 'j', kind: 'description', text: 'Black piles, a mooring ring, weed to the waterline.' }], pictureAssetId: null }; // words: names

const SHOWN_INN: ScenePlace = {
  group: 1,
  name: 'The Eel and Lantern', // words: names
  pieces: [
    { id: 'a', kind: 'description', text: 'Three storeys of tarred timber leaning over the quay.' },
    { id: 'b', kind: 'other', lead: 'Sign', text: 'A brass lantern with an eel coiled round it, both green with age.' },
    { id: 'c', kind: 'other', lead: 'Common room', text: 'Low beams, a long hearth, eel pies and small beer at every table.' },
  ],
  pictureAssetId: null,
};

export function PlacesSpecimens({ Specimen }: { Specimen: (props: { name: string; children: ReactNode }) => ReactElement }) {
  return (
    <>
      <Specimen name="Place picker: Near here, Recently visited (a typed place says so, a long name wraps), one folded group per pack; the square plus / minus only unfolds">
        <PlacePickerBody places={PLACES} recent={RECENT} current={here} onPick={none} />
      </Specimen>
      <Specimen name="Place picker: nothing picked yet (no Near here), the packs folded, Other… last">
        <PlacePickerBody places={PLACES} recent={[]} current={null} allowUnnamed onPick={none} />
      </Specimen>
      <Specimen name="Place picker: a pack's group open, the region unfolded with its hexes by map number, a hex unfolded with its sites indented, the current place marked here now, Show N more">
        <PlacePickerBody places={MANY} recent={[]} current={here} initialOpen={['pack:pack-fen', 'pack-fen:region', 'pack-fen:hex-0412']} onPick={none} />
      </Specimen>
      <Specimen name="Place picker: a search with results, two places sharing a name told apart by their parent, the source pack quieter, Other… with the words">
        <PlacePickerBody places={PLACES} recent={[]} current={null} initialQuery="fish" onPick={none} />
      </Specimen>
      <Specimen name="Place picker: no packs with places; loading; offline">
        <PlacePickerBody places={[]} recent={[]} current={null} onPick={none} />
        <PlacePickerBody places={null} recent={[]} current={null} onPick={none} />
        <PlacePickerBody places={null} recent={[]} current={null} offline onPick={none} />
      </Specimen>
      <Specimen name="Place card lines from a pack: no Players see and no Rename (p2p-11); Part of (icon, no ›); Here: N places folded; Change place with the pin">
        <div className="place-card">
          <div className="place-card__head">
            <h3 className="place-card__name">Heron Isle (Hex), 0412</h3> {/* words: names */}
            <p className="place-card__state">Fen Marches, marsh, 0 of 5 pieces shown</p>
          </div>
          <div className="place-card__related">
            <button type="button" className="button-secondary place-pick__row" onClick={none}>
              <Icon name="within" size={20} />
              <span className="place-pick__words">Part of The Long Fen (Region)</span> {/* words: names */}
            </button>
            <div className="place-pick__group">
              <div className="place-pick__group-head">
                <Icon name="inside" size={20} />
                <div className="place-pick__group-words">
                  <span>Here: 3 places</span>
                </div>
                <button type="button" className="button-secondary place-pick__fold" aria-expanded={false} aria-label="Show the places here" onClick={none}>
                  <Icon name="plus" size={20} />
                </button>
              </div>
            </div>
          </div>
          <div className="place-card__actions">
            <button type="button" className="button-secondary" onClick={none}>
              Hide all
            </button>
            <button type="button" className="button-secondary" onClick={none}>
              <Icon name="pin" size={20} />
              Change place
            </button>
          </div>
        </div>
      </Specimen>
      <Specimen name="A town from its pack (2c): identity under the name, the facts as bold lead-ins, About the town folded by heading, its tables as rows, the watch in its box">
        <div className="place-card">
          <div className="place-card__head">
            <h3 className="place-card__name">Reedmouth</h3> {/* words: names */}
            <PlaceIdentity identity={REEDMOUTH.identity} />
          </div>
          <PlaceFactLines facts={REEDMOUTH} />
          <PlaceFactsBody facts={REEDMOUTH} town tables={TOWN_TABLES} watchFightsAs="Heron warden" onOpenTable={none} />
        </div>
      </Specimen>
      <Specimen name="A place's notes as the pack carries them today (2c, the fallback): a label-and-colon line set as a bold lead-in; a player's place with its shown aspects, each lead-in bold">
        <div className="place-card">
          <NoteLines notes={'Ruler: Warden Halewyn, for the Heron Wardens (p. 64).\nReedmouth sits where the Reedmere empties into the fen.\nArrival on the scene: 2d6 rounds after a cry is raised.'} />
        </div>
        <PlaceLine place={SHOWN_INN} />
      </Specimen>
      <Specimen name="A place's rules for players (dec-7 piece 3): the open rules' buttons at the foot of the place line, an icon of the set alone beside the generic mark with its words (piece 2); the rule in the book's words, its list, its boxed aside (frame 7b), its table and source">
        <PlaceLine place={AT_THE_JETTY} rules={HARBOUR_RULES} />
        <div className="place-card">
          <RuleText blocks={FALLING_IN} />
        </div>
      </Specimen>
    </>
  );
}
