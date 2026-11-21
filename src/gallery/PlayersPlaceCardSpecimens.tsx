// The players' place card (plan dec-9-the-players-scene, P4; page 24 PL1b, PL1c, PL1d, approved 2026-11-18; page 18
// PL1; set 9's PR1 to PR5b; page 01 frame 7b for the GM's eyes) in the component gallery, and on the layout page
// (`layout.html?placeCard=…`, src/testing/layoutHarness.tsx). Invented words only, standing in for a book's. New
// pictures for Francis: the Location's card waits for his look before it goes on the players' page ("Not to build yet").
import { useState, type ReactElement, type ReactNode } from 'react';
import { KnowledgeSheet, type KnowledgeSharing } from '../app/KnowledgeSheet.tsx';
import { PlayersAreaCard, PlayersLocationCard } from '../app/PlayersPlaceCard.tsx';
import { PlayersScenePage } from '../app/PlayersScenePage.tsx';
import type { Db } from '../core/supabase.ts';
import { readPlaceCards, readSharedKnowledge, type PlayersPlaceCard, type ShownPiece } from '../modules/expedition/placeKnowledge.ts';
import type { PlayersRule } from '../modules/expedition/placeRules.ts';
import { BookFaces } from '../ui/BookFaces.tsx';
import { harbourKnowledge } from './KnowledgeSpecimens.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const AREA = 'The Drowned Harbour'; // words: names
const REGION = 'Saltwick Island'; // words: names
const LONG_NAME = 'The long drowned stair under the customs house where the ferrymen keep their oars'; // words: names

const cardOf = (rows: Record<string, unknown>[], here: { key: string; name: string } = { key: '1', name: 'The Jetty' }): PlayersPlaceCard =>
  readPlaceCards([{ group_number: 1, kind: 'here', at: 0, place_id: 'jetty', ...here }, ...rows]).get(1)!;

/** PL1b's card: the trail and the Area shown, two other Locations known. */
const HARBOUR = cardOf([
  { group_number: 1, kind: 'trail', at: 1, name: REGION },
  { group_number: 1, kind: 'trail', at: 2, name: AREA },
  { group_number: 1, kind: 'area', at: 0, name: AREA },
  { group_number: 1, kind: 'known', at: 1, place_id: 'wreck', key: '2', name: 'The Wreck' },
  { group_number: 1, kind: 'known', at: 2, place_id: 'breakwater', key: '3', name: 'The Breakwater' },
]);
/** The Area never shown: no heading, no trail. */
const UNNAMED = cardOf([{ group_number: 1, kind: 'known', at: 1, place_id: 'wreck', key: '2', name: 'The Wreck' }]);
/** Messy: a long name, a three-figure number, a long trail. */
const MESSY = cardOf(
  [
    { group_number: 1, kind: 'trail', at: 1, name: REGION },
    { group_number: 1, kind: 'trail', at: 2, name: LONG_NAME },
    { group_number: 1, kind: 'area', at: 0, name: LONG_NAME },
    { group_number: 1, kind: 'known', at: 1, place_id: 'stair', key: '999', name: LONG_NAME },
  ],
  { key: '999', name: LONG_NAME },
);

const DESCRIPTION: ShownPiece = { id: 'd', kind: 'description', text: 'Black piles and a slick deck, forty paces out over black water. Past the mooring ring, a skiff rocks under the ladder.', lead: '' };
const RING: ShownPiece = { id: 'r', kind: 'clue', text: 'Fresh rope: someone tied up here this week.', lead: 'Mooring ring' };
const LADDER: ShownPiece = { id: 'l', kind: 'hazard', text: 'Iron rungs down to the water, the lowest three green.', lead: 'Ladder' };

const KNOWN = readSharedKnowledge([
  { group_number: 1, share_id: 's1', place_name: AREA, heading: 'What everyone knows', body: 'The harbour silted in a single winter.\nNobody crosses at slack water.', shared_clock: 0 },
]);
const rule = (name: string, placeName = 'The Jetty'): PlayersRule => ({ group: 1, placeName, name, blocks: [{ kind: 'p', lead: '', text: 'A boat crosses in a turn; a swimmer takes three.' }], button: null });
const RULES = [rule('Falling into the harbour'), rule('Rowing and swimming'), rule('The tide'), rule('Weather on the island', REGION)];
const ONE_LONG_RULE = [rule('What the piles will bear when a boat is made fast to them in a rising sea')];

/** The known places' read, for a known Location's sheet: the Wreck's two shown pieces. */
const db = {
  rpc: async () => ({
    data: [
      { current: true, place_id: 'wreck', place_name: 'The Wreck', kind: 'description', piece_id: 'w1', body: 'A cog on her side on the bar; her ribs green with weed.', lead: '' },
      { current: true, place_id: 'wreck', place_name: 'The Wreck', kind: 'clue', piece_id: 'w2', body: 'Her ribs stand clear at low water.', lead: 'Ribs' },
    ],
    error: null,
  }),
} as unknown as Db;

/** The GM's sheet with its eyes, the first section shared at turn 9. */
const SHARING: KnowledgeSharing = { sharedLine: (s) => (s.at === 0 ? 'Shared with the players, turn 9.' : null), onEye: () => undefined };

export function PlayersPlaceCardSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <BookFaces>
      <Specimen name="The Location's card (PL1b): the trail, 1. The Jetty, the description with only a shown piece's word marked, the shown piece led by its own word. Not on the page yet">
        <PlayersLocationCard card={HARBOUR} pieces={[DESCRIPTION, RING]} rules={[]} />
      </Specimen>
      <Specimen name="The Location's card (PL1c): only the description shown, nothing marked; and messy: a long name, 999">
        <PlayersLocationCard card={UNNAMED} pieces={[DESCRIPTION]} rules={[]} />
        <PlayersLocationCard card={MESSY} pieces={[DESCRIPTION, RING, LADDER]} rules={[]} />
      </Specimen>
      <Specimen name="The Area's card (PL1b, PR4): its name, a shared section, the Rules row with a second shown place's rules, the other Locations">
        <PlayersAreaCard db={db} campaignId="gallery" card={HARBOUR} knowledge={KNOWN} rules={RULES} turns={null} />
      </Specimen>
      <Specimen name="The Area's card: the Area never shown (no heading), one rule with a long name; and messy">
        <PlayersAreaCard db={db} campaignId="gallery" card={UNNAMED} knowledge={[]} rules={ONE_LONG_RULE} turns={null} />
        <PlayersAreaCard db={db} campaignId="gallery" card={MESSY} knowledge={KNOWN} rules={RULES.map((r) => (r.placeName === REGION ? r : { ...r, placeName: LONG_NAME }))} turns={null} />
      </Specimen>
      <Specimen name="The GM's Knowledge with its eyes (frame 7b): one section shared, the count at the foot">
        <KnowledgeSheet preview placeName={AREA} facts={harbourKnowledge()} source={null} sharing={SHARING} onClose={() => undefined} />
      </Specimen>
    </BookFaces>
  );
}

/**
 * The layout page's players' card (`?placeCard=1`; `bare` the Area never shown, `messy` long names and 999; `gm` the
 * GM's Knowledge with its eyes): the two columns as the players' page sets them, for the layout checks and the pictures
 * of the built part.
 */
export function PlayersPlaceCardLayoutPage({ state }: { state: string }) {
  const [shared, setShared] = useState<number[]>([0]);
  if (state === 'gm')
    return (
      <main className="gallery__map-page">
        <KnowledgeSheet
          placeName={AREA}
          facts={harbourKnowledge()}
          source={null}
          sharing={{ sharedLine: (s) => (shared.includes(s.at ?? -1) ? 'Shared with the players, turn 9.' : null), onEye: (s, on) => setShared((was) => (on ? [...was, s.at ?? -1] : was.filter((a) => a !== s.at))) }}
          onClose={() => undefined}
        />
      </main>
    );
  const card = state === 'bare' ? UNNAMED : state === 'messy' ? MESSY : HARBOUR;
  return (
    <main className="gallery__map-page">
      <PlayersScenePage
        left={<PlayersLocationCard card={card} pieces={state === 'bare' ? [DESCRIPTION] : [DESCRIPTION, RING, LADDER]} rules={[]} />}
        right={<PlayersAreaCard db={db} campaignId="layout" card={card} knowledge={state === 'bare' ? [] : KNOWN} rules={state === 'bare' ? ONE_LONG_RULE : RULES.map((r) => (r.placeName === REGION ? r : { ...r, placeName: card.here.name }))} turns={null} />}
      />
    </main>
  );
}
