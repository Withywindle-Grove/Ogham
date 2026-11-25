// What we know (M5b step 3, build order 4; ruled 2026-10-30, S4-4; docs/06 Components "What we know panel"): a card
// on the players' Scene that pops out into a panel with the places the GM has shown them: this expedition's open
// (each with the pieces shown, in the order shown), earlier expeditions' in one fold, closed by default (ruled
// 2026-11-03, until M8b's location browser), and the maps and handouts revealed to them (the campaign's assets they
// may see). Nothing the GM hasn't shown is read: public.known_places_campaign and the assets' own reading rule
// decide. Empty: "Nothing shared yet." Handouts proper come with M8b.
import { useEffect, useState } from 'react';
import type { Db } from '../core/supabase.ts';
import { leadWords } from '../modules/expedition/placeFacts.ts';
import { loadRevealedImages, loadShownPlaces, type RevealedImage, type ShownPlace, type ShownPlaces } from '../modules/expedition/placePlay.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { OpenCard } from '../ui/parts.tsx';
import { useLogVersion } from './campaignLog.tsx';
import './WhatWeKnow.css';

/** The card's line: "2 places · 1 map or handout · 3 earlier", or "Nothing shared yet". Pure. */
export function knownSummary(places: number, images: number, earlier = 0): string {
  if (places === 0 && images === 0 && earlier === 0) return 'Nothing shared yet';
  const parts: string[] = [];
  if (places > 0) parts.push(`${places} ${places === 1 ? 'place' : 'places'}`);
  if (images > 0) parts.push(`${images} ${images === 1 ? 'map or handout' : 'maps and handouts'}`);
  if (earlier > 0) parts.push(`${earlier} earlier`);
  return parts.join(', ');
}

/** The fold's line: "Earlier expeditions · 3 places". Pure. */
export const earlierSummary = (n: number) => `Earlier expeditions: ${n} ${n === 1 ? 'place' : 'places'}`;

function PlaceList({ places }: { places: readonly ShownPlace[] }) {
  return (
    <>
      {places.map((place) => (
        <article key={place.placeId} className="known__place">
          <h4 className="known__place-name">{place.name}</h4>
          {place.pieces.map((piece) => (
            <p key={piece.id} className="known__text">
              {/* An aspect's lead-in (pf-3), bold before the text, as on the Scene. */}
              {piece.lead && <strong>{`${leadWords(piece.lead)} `}</strong>}
              {piece.text}
            </p>
          ))}
        </article>
      ))}
    </>
  );
}

/** `asPlayer`: the GM's view as the player (C15f): the places shown to that player's groups. */
export function WhatWeKnow({ db, campaignId, asPlayer }: { db: Db; campaignId: string; asPlayer?: string }) {
  const logVersion = useLogVersion();
  const [known, setKnown] = useState<{ places: ShownPlaces; images: RevealedImage[] } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let current = true;
    void Promise.all([loadShownPlaces(db, campaignId, asPlayer), loadRevealedImages(db, campaignId)]).then(([places, images]) => current && setKnown({ places: places ?? { current: [], earlier: [] }, images }));
    return () => {
      current = false;
    };
  }, [db, campaignId, logVersion, asPlayer]);

  const summary = known ? knownSummary(known.places.current.length, known.images.length, known.places.earlier.length) : 'Opening…';
  const nothing = known !== null && known.places.current.length === 0 && known.places.earlier.length === 0 && known.images.length === 0;
  return (
    <>
      <OpenCard title="What we know" summary={summary} label={`What we know: ${summary}`} onOpen={() => setOpen(true)} />
      {open && (
        <Dialog label="What we know" onClose={() => setOpen(false)}>
          {nothing && <p className="auth__meta">Nothing shared yet. Places and maps the GM shows you gather here.</p>}
          {known && known.places.current.length > 0 && (
            <section className="known__section" aria-label="Places">
              <h3 className="known__heading">Places</h3>
              <PlaceList places={known.places.current} />
            </section>
          )}
          {known && known.places.earlier.length > 0 && (
            <details className="known__fold">
              <summary className="known__fold-summary">{earlierSummary(known.places.earlier.length)}</summary>
              <section className="known__section" aria-label="Earlier expeditions">
                <PlaceList places={known.places.earlier} />
              </section>
            </details>
          )}
          {known && known.images.length > 0 && (
            <section className="known__section" aria-label="Maps and handouts">
              <h3 className="known__heading">Maps and handouts</h3>
              {known.images.map((image) => (
                <figure key={image.id} className="known__image">
                  {image.url ? <img src={image.url} alt={image.name} /> : <p className="auth__meta">The picture couldn't be opened.</p>}
                  <figcaption className="known__text">{image.name}</figcaption>
                </figure>
              ))}
            </section>
          )}
        </Dialog>
      )}
    </>
  );
}
