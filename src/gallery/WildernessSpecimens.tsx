// The wilderness parts in the component gallery (M5b gate, plan m5b-5 build order 2; docs/06 Components): the ones
// drawn from what they're given, with invented data and no database. Encounter waiting cards (no row yet, a camp
// night's Which watch? as chips, the watch answered; Start the accent, View and Dismiss small, fl-2), the camp's
// Watches step by watch (fl-3: boxes with names as chips, + Add, a full watch, Split evenly, a caster on watch) and the
// Open card (What we know's, and the location view's on a phone: bq-4). The budget
// card, the Lost card, the camp card and What we know read the database, so their pictures are the layout scenes'
// (tests/layout/layout.spec.ts, the wilderness scenes on layoutHarness.tsx's Fen treks).
import { useState, type ReactElement, type ReactNode } from 'react';
import { EncounterWaitingSource } from '../app/EncounterWaiting.tsx';
import { WatchesStep } from '../app/CampNight.tsx';
import type { CampInfo } from '../app/campView.ts';
import '../app/CampCard.css';
import { OpenCard } from '../ui/parts.tsx';
import type { EncounterCard } from '../modules/expedition/encounterPlay.ts';

const hit = (id: string, name: string, rowText: string | null, atSeconds: number): EncounterCard['hit'] => ({
  id,
  campaignId: 'gallery',
  expeditionId: 'gallery-trek',
  checkKey: `mode:${id}`,
  name,
  source: 'mode',
  outcome: 'hit',
  atSeconds,
  modifiers: [],
  note: null,
  tableId: null,
  roll: null,
  rowText,
  revealed: false,
  secret: true,
  version: 1,
});

const card = (id: string, h: EncounterCard['hit'], watch: string | null): EncounterCard => ({
  encounter: { id, campaignId: 'gallery', expeditionId: 'gallery-trek', checkResultId: h.id, watch, state: 'waiting', createdAt: '2026-11-03T20:00:00Z', version: 1 },
  hit: h,
});

const CARDS: EncounterCard[] = [
  card('night', hit('night', 'Night prowlers', 'Bog lurkers (1d4)', 79200), null),
  card('awake', hit('awake', 'Night prowlers, Group 2', 'A Lantern Warden, alone, with a shuttered lantern and a long story about the causeway', 82800), '2nd watch, Reed, Moss'), // words: names
  card('road', hit('road', 'Prowlers', null, 36000), null),
];

const MEMBERS = [
  { id: 'reed', name: 'Reed of the Long Sedge Causeway and the Nine Drowned Steps', ownerUserId: 'sam' }, // words: names
  { id: 'moss', name: 'Moss', ownerUserId: null },
  { id: 'wick', name: 'Wick', ownerUserId: null },
  { id: 'fern', name: 'Fern', ownerUserId: null },
  { id: 'ash', name: 'Ash', ownerUserId: null },
];

// WatchesStep reads only the night from the camp's info: the rest of CampInfo is the camp card's.
const NIGHT_INFO = { night: { watchMinutes: 120, minutes: 600, watches: 5, startsAt: 19 * 60, dayMinutes: 1440 } } as unknown as CampInfo;

export function WildernessSpecimens({ Specimen }: { Specimen: (props: { name: string; children: ReactNode }) => ReactElement }) {
  const [cards, setCards] = useState(CARDS);
  const [watches, setWatches] = useState<string[][]>([['reed'], ['moss', 'wick', 'fern']]);
  return (
    <>
      <Specimen name="Encounter waiting cards (GM), as page 16's T2 draws them (S8b): An encounter waits, what was rolled a link to the encounter, Start (the accent, no other here) and Dismiss stacked; a camp night's hit has Who is awake…; answered, it reads Awake; a hit with no row picked yet">
        <EncounterWaitingSource
          cards={cards}
          tables={new Map()}
          statBlock={() => null}
          when={(at) => `Day 1, ${String(Math.floor(at / 3600) % 24).padStart(2, '0')}:00`}
          onStart={async () => false}
          onDismiss={(c) => setCards((all) => all.filter((x) => x.encounter.id !== c.encounter.id))}
          watchChoices={(c) => (c.encounter.id === 'night' ? ['1st watch, Reed of the Long Sedge Causeway and the Nine Drowned Steps', '2nd watch, Moss, Wick'] : null)} // words: names
          accent
          onWatch={(c, w) => setCards((all) => all.map((x) => (x.encounter.id === c.encounter.id ? { ...x, encounter: { ...x.encounter, watch: w } } : x)))}
        />
      </Specimen>
      <Specimen name="Camp: Watches by watch, the names as chips (✕), + Add (hidden on a full watch), Not on watch, Split evenly, a caster on watch">
        <div className="camp">
          <WatchesStep info={NIGHT_INFO} members={MEMBERS} mine={MEMBERS.slice(0, 1)} watches={watches} casters={new Set(['wick'])} onSet={(next) => next !== 'full' && setWatches(next)} />
        </div>
      </Specimen>
      <Specimen name="Open card (What we know; the location view on a phone): the place, the empty state's Set place, a long name">
        <OpenCard title="Moss Landing" summary="Around them: Bog, 2 of 5 pieces shown" label="Moss Landing: Around them: Bog, 2 of 5 pieces shown" onOpen={() => undefined} /> {/* words: names */}
        <OpenCard title="Where are we?" summary="Around them: Bog, Set place" label="Where are we?: Around them: Bog, Set place" onOpen={() => undefined} />
        <OpenCard
          title="The Drowned Causeway of the Heron Wardens, Below the Old Lantern" // words: names
          summary="A rotten jetty leans out over black water, its last post crowned with a heron's skull, 999 more"
          label="Where you are: the long name"
          onOpen={() => undefined}
        />
      </Specimen>
    </>
  );
}
