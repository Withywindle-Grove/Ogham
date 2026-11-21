// The map card and the map pop-up (plan dec-7 piece 5a; mc-43, mc-43a, mc-44, mc-44a; mockup december/01) in the
// component gallery, and on the layout page (`layout.html?mapParts=…`, src/testing/layoutHarness.tsx). The picture is
// an invented harbour drawn by hand for these pages (invented-harbour-map.svg), never a pack's map. The eye here is the
// gallery's own: no screen uses these parts yet, and no command shares a map yet. New pictures for Design.
import { useState, type ReactElement, type ReactNode } from 'react';
import { MapCard, MapPopup, MapWanted, type MapSource } from '../ui/MapParts.tsx';
import { EyeToggle } from '../ui/parts.tsx';
import harbourMap from './invented-harbour-map.svg';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const PLACE = 'The Drowned Harbour'; // words: names
const HARBOUR: MapSource = { src: harbourMap, alt: 'The Drowned Harbour, its map' };
const ON_ITS_WAY: MapSource = { src: null, alt: 'The Drowned Harbour, its map' };
const FAILED: MapSource = { src: null, alt: 'The Drowned Harbour, its map', failed: true };
// The map wanted (5m-2): an invented pack's title and file name, and a long pair for messy data.
const WANTED = { title: 'The Drowned Harbour, the harbour chart', file: 'harbour-chart.png' };
// A long map title (the card's title then takes a line of its own above the tools: the lead, 2026-11-15).
const LONG_TITLE = 'The Drowned Harbour and the Saltwick Breakwater at the turn of the tide'; // words: names
const LONG_WANTED = { title: 'The Drowned Harbour and the Saltwick Breakwater at the turn of the tide, lower decks', file: 'maps/saltwick-island/the-drowned-harbour-and-breakwater-lower-decks-v2.webp' };

function Eye() {
  const [shown, setShown] = useState(false);
  return <EyeToggle label="The map shown to the players" shown={shown} onChange={setShown} />;
}

/** A card that opens the real pop-up on a tap. */
function CardThatOpens({ source, title, eye = true }: { source: MapSource; title?: string; eye?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MapCard source={source} title={title} tools={eye ? <Eye /> : undefined} onOpen={() => setOpen(true)} />
      {open && <MapPopup source={source} place={PLACE} headTools={eye ? <Eye /> : undefined} onClose={() => setOpen(false)} />}
    </>
  );
}

export function MapPartsSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Map card: the picture alone; its title at the left, the magnifiers then the eye at the right; a tap opens it whole">
        <div className="gallery__map-card">
          <CardThatOpens source={HARBOUR} title={PLACE} />
        </div>
      </Specimen>
      <Specimen name="Map card: a long title cut short, no title at all, and the tools alone">
        <div className="gallery__map-card">
          <CardThatOpens source={HARBOUR} title={LONG_TITLE} />
        </div>
        <div className="gallery__map-card">
          <CardThatOpens source={HARBOUR} eye={false} />
        </div>
      </Specimen>
      <Specimen name="Map card: while the picture is on its way, and when it didn't load (no tools under either)">
        <div className="gallery__map-card">
          <MapCard source={ON_ITS_WAY} onOpen={() => undefined} />
        </div>
        <div className="gallery__map-card">
          <MapCard source={FAILED} onOpen={() => undefined} />
        </div>
      </Specimen>
      <Specimen name="Map wanted (dec-7 5m-2): the pack names a map not added yet: its title, the file asked for, + Map; while the file is sent; a long title and file name">
        <div className="gallery__map-card">
          <MapWanted title={WANTED.title} file={WANTED.file} sending={false} onAdd={() => undefined} />
          <MapWanted title={WANTED.title} file={WANTED.file} sending onAdd={() => undefined} />
          <MapWanted title={LONG_WANTED.title} file={LONG_WANTED.file} sending={false} onAdd={() => undefined} />
        </div>
      </Specimen>
      <Specimen name="Map pop-up: fitted first; the figure, zoom out, zoom in, Fit (marked); the eye beside the ✕">
        <MapPopup source={HARBOUR} place={PLACE} headTools={<Eye />} onClose={() => undefined} preview />
      </Specimen>
      <Specimen name="Map pop-up: the picture on its way (a still block), and a picture that didn't load">
        <MapPopup source={ON_ITS_WAY} place={PLACE} onClose={() => undefined} preview />
        <MapPopup source={FAILED} place={PLACE} onClose={() => undefined} preview />
      </Specimen>
    </>
  );
}

/**
 * The layout page's map (`?mapParts=1`; `loading` or `failed` for those frames; `&open=1` opens the pop-up at once;
 * `wanted`, `sending` and `long` for the map wanted, 5m-2): the
 * card in a column as the place's page will hold it, the real pop-up over the page on a tap. For the layout checks and
 * the pictures of the built parts; wired to no screen.
 */
export function MapPartsLayoutPage({ state, open }: { state: string; open: boolean }) {
  // The map wanted (5m-2, `wanted`; `sending` while the file goes; `long` for a long title and file name).
  if (state === 'wanted' || state === 'sending' || state === 'long') {
    const map = state === 'long' ? LONG_WANTED : WANTED;
    return (
      <main className="gallery__map-page">
        <h1>{PLACE}</h1>
        <p>A silted harbour of five spots.</p>
        <MapWanted title={map.title} file={map.file} sending={state === 'sending'} onAdd={() => undefined} />
      </main>
    );
  }
  return <MapCardLayoutPage state={state} open={open} />;
}

function MapCardLayoutPage({ state, open: openAtStart }: { state: string; open: boolean }) {
  const source = state === 'loading' ? ON_ITS_WAY : state === 'failed' ? FAILED : HARBOUR;
  // `longTitle`: the card with a long title (#851's round), else the place's own name.
  const title = state === 'longTitle' ? LONG_TITLE : PLACE;
  const [open, setOpen] = useState(openAtStart);
  return (
    <main className="gallery__map-page">
      <h1>{PLACE}</h1>
      <p>A silted harbour of five spots.</p>
      <div className="gallery__map-card">
        <MapCard source={source} title={title} tools={<Eye />} onOpen={() => setOpen(true)} />
      </div>
      {open && <MapPopup source={source} place={PLACE} headTools={<Eye />} onClose={() => setOpen(false)} />}
    </main>
  );
}
