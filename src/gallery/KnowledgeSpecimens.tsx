// A place's Knowledge (plan dec-7 piece 6a; mc-33, mc-34, mc-40; mockup december/01 frames 7 and 7b) in the component
// gallery, and on the layout page (`layout.html?knowledge=…`, src/testing/layoutHarness.tsx). The words are invented,
// standing in for a book's at a real length (the mockup's own example); never a pack's. Wired to no screen until 5b.
// New pictures for Design.
import { useState, type ReactElement, type ReactNode } from 'react';
import { KnowledgeSheet } from '../app/KnowledgeSheet.tsx';
import { knowledgeSourceLine, readPlaceFacts, type PlaceFacts } from '../modules/expedition/placeFacts.ts';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const PLACE = 'The Drowned Harbour'; // words: names
const MADE_BY_HAND = 'Fenwick Hole'; // words: names

const FACTS = [
  { lead: 'Tides', text: 'Two a day; the bar dries at low water.' },
  { lead: 'Law', text: 'None since the customs men left.' },
  { lead: 'Owed to', text: '[[npc:heron-wardens|The Heron Wardens]], in name.' },
];

const EVERYONE_KNOWS = {
  heading: 'What everyone knows',
  text: [
    'The harbour silted in a single winter. The old men say the river changed its mind; the harbourmaster’s ledger says only that the dredger was sold in the autumn and not replaced. By the thaw the bar stood dry at low water and no keel deeper than a ferry’s could cross it.',
    'The cog went down on the bar the same night the last customs men left. She was outward bound and laden, and nobody has claimed her. Her mast still shows at every tide, and the gulls will not sit on it.',
    'Since then the harbour has belonged to whoever is standing in it. The ferrymen cross by day. Nobody crosses at slack water.',
  ].join('\n'),
};

// Set out in the rule-text block shape (pf-18): its list is drawn as a list by the shared rule-text part.
const CARGO = {
  heading: 'The wreck’s cargo',
  text: {
    blocks: [
      { p: 'The manifest lists her cargo plainly, and the list is honest as far as it goes:' },
      {
        list: [
          'Forty tuns of marsh salt, in the forward hold, most of it spoiled.',
          'Twelve bales of reed-cloth, sound where the tar held.',
          'Ship’s stores for a month, long since taken by the ferrymen.',
          'One sealed chest, stowed aft, which the manifest does not name.',
        ],
      },
      { p: 'The chest is bound in green copper and has no lock that a key would fit. It is the reason she sailed at night.' },
    ],
  },
};

const TIDEWIFE = {
  heading: 'What the Tidewife wants',
  text: 'The Tidewife wants the chest. She cannot leave the water to fetch it, and she will not say what is in it; she will say only that it was promised her, and by whom.\nShe is seen on the bar at slack water and nowhere else.',
};

const LONG = {
  heading: 'What the ferrymen of the lower reach say to anyone who asks about the breakwater after dark',
  text: 'Nothing.',
};

/** The harbour's knowledge as its pack would carry it, read by the same reader the place card uses. */
export const harbourKnowledge = (sections: readonly Record<string, unknown>[] = [EVERYONE_KNOWS, CARGO, TIDEWIFE]): PlaceFacts =>
  readPlaceFacts({ facts: FACTS, gm: { sections } });

const SOURCE = knowledgeSourceLine('adventure', 'The Reed Marches', 'p. 38'); // words: names
const NO_PAGE = knowledgeSourceLine('adventure', 'The Reed Marches', undefined); // words: names
const NOTHING: PlaceFacts = readPlaceFacts({});

export function KnowledgeSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Knowledge as it opens: the facts open; each section folded under its heading with the book’s first line; the source last">
        <KnowledgeSheet preview placeName={PLACE} facts={harbourKnowledge()} source={SOURCE} onClose={() => undefined} />
      </Specimen>
      <Specimen name="Knowledge: a lone section starts open, its list set out by the shared rule-text part">
        <KnowledgeSheet preview placeName={PLACE} facts={harbourKnowledge([CARGO])} source={SOURCE} onClose={() => undefined} />
      </Specimen>
      <Specimen name="Knowledge: a long heading, a one-line section, no page in the source; and a place with nothing written">
        <KnowledgeSheet preview placeName={PLACE} facts={harbourKnowledge([LONG, TIDEWIFE])} source={NO_PAGE} onClose={() => undefined} />
        <KnowledgeSheet preview placeName={MADE_BY_HAND} facts={NOTHING} source={null} onClose={() => undefined} />
      </Specimen>
    </>
  );
}

/**
 * The layout page's Knowledge (`?knowledge=1`; `one` a lone section, `empty` nothing written): the real sheet open over
 * a stand-in page, a button to open it again. For the layout checks and the pictures of the built part.
 */
export function KnowledgeLayoutPage({ state }: { state: string }) {
  const [open, setOpen] = useState(true);
  const facts = state === 'empty' ? NOTHING : state === 'one' ? harbourKnowledge([CARGO]) : harbourKnowledge();
  return (
    <main className="gallery__map-page">
      <h1>{PLACE}</h1>
      <p>A silted harbour of five spots.</p>
      <div>
        <button type="button" className="button-secondary" onClick={() => setOpen(true)}>
          Knowledge
        </button>
      </div>
      {open && <KnowledgeSheet placeName={PLACE} facts={facts} source={state === 'empty' ? null : SOURCE} onClose={() => setOpen(false)} />}
    </main>
  );
}
