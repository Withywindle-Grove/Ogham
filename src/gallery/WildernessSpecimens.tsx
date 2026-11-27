// The wilderness parts in the component gallery (M5b gate, plan m5b-5 build order 2; docs/06 Components): the ones
// drawn from what they're given, with invented data and no database. Encounter waiting cards, the one card a hit
// (sf-4; page 44, EN1 B: the row's words, a creature's detail row, the picked line with Change…, Reveal…, Message… and
// Done the accent; a camp night's Who is awake…, the watch answered; no row yet), the camp's
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
import { readTable } from '../modules/expedition/tables.ts';

const HARBOUR = readTable('harbour', 'Encounters in the harbour', {
  die: 'd20',
  rows: [
    { min: 1, max: 8, result: 'Nothing stirs.' },
    { min: 9, max: 14, result: 'A Lantern Warden, alone, with a shuttered lantern and a long story about the causeway and the nine drowned steps' },
    { min: 15, max: 16, result: 'Two bog lurkers rise from the weed and reach for the oars.', statBlockIds: [{ statBlockId: 'bog-lurker', count: 2 }] },
    { min: 17, max: 20, result: 'Night prowlers circle the camp.' },
  ],
})!;
const TABLES = new Map([[HARBOUR.id, HARBOUR]]);
const LURKER = { name: 'Bog lurker', description: 'A grey shape under the duckweed. Drags its prey under and holds it there.' };

const hit = (id: string, name: string, rowText: string | null, atSeconds: number, roll: string | null = null): EncounterCard['hit'] => ({
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
  tableId: roll ? 'harbour' : null,
  roll,
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
  card('lurkers', hit('lurkers', 'Encounters in the harbour', 'Encounters in the harbour: Two bog lurkers rise from the weed and reach for the oars.', 79200, '15–16'), null),
  card('night', hit('night', 'Night prowlers', 'Encounters in the harbour: Night prowlers circle the camp.', 79200, '17–20'), null),
  card('awake', hit('awake', 'Night prowlers, Group 2', 'Encounters in the harbour: A Lantern Warden, alone, with a shuttered lantern and a long story about the causeway and the nine drowned steps', 82800, '9–14'), '2nd watch, Reed, Moss'), // words: names
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
  // One card's words stand (sf-4, EN1 C): its "Revealed" is pressed and its line quotes them; a tap takes them back.
  const [shown, setShown] = useState<ReadonlyMap<string, string>>(new Map([['awake', 'A lone figure with a shuttered lantern waits on the causeway.']]));
  const [watches, setWatches] = useState<string[][]>([['reed'], ['moss', 'wick', 'fern']]);
  return (
    <>
      <Specimen name="Encounter waiting cards (GM), one encounter one card (sf-4; page 44, EN1 B): An encounter, the row's words, a creature's detail row, the picked line with Change…, then Reveal…, Message… and Done (the accent, no other here); a card whose words stand, its pressed “Revealed” under the line “Players see: …” (EN1 C); a camp night's hit has Who is awake…; answered, it reads Awake; a long row; a hit with no row picked yet">
        <EncounterWaitingSource
          cards={cards}
          tables={TABLES}
          statBlock={(id) => (id === 'bog-lurker' ? LURKER : null)}
          onDone={(c) => setCards((all) => all.filter((x) => x.encounter.id !== c.encounter.id))}
          onChange={(c, tap) => setCards((all) => all.map((x) => (x.encounter.id === c.encounter.id ? { ...x, hit: { ...x.hit, roll: tap.roll, rowText: tap.rowText } } : x)))}
          onShow={(c, words) => {
            setShown((was) => new Map(was).set(c.hit.id, words));
            return Promise.resolve(true);
          }}
          shownFor={(c) => shown.get(c.hit.id) ?? null}
          onTakeBack={(c) =>
            setShown((was) => {
              const next = new Map(was);
              next.delete(c.hit.id);
              return next;
            })
          }
          onMessage={() => undefined}
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
