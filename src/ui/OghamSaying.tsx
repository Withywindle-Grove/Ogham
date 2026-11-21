// One of Ogham's sayings on an empty setup screen (docs/06-screens-and-design.md, Voice; ruled 2026-10-23):
// Your campaigns, the Rules library and the GM's Players and characters only, never on the screens used during
// play. Historical sayings show their source in small text. The list lives in the brand file.
import { useState } from 'react';
import { BRAND, type Saying } from '../brand.ts';
import './OghamSaying.css';

/** A saying for a number from 0 to 1 (random by default, so they rotate). */
export function pickSaying(at: number): Saying {
  const sayings = BRAND.sayings;
  return sayings[Math.min(sayings.length - 1, Math.floor(at * sayings.length))]!;
}

export function OghamSaying({ at }: { at?: number }) {
  const [saying] = useState(() => pickSaying(at ?? Math.random()));
  return (
    <figure className="saying" aria-label={`A saying from ${BRAND.persona}`}>
      <blockquote className="saying__text">{saying.text}</blockquote>
      {saying.source && <figcaption className="auth__meta saying__source">{saying.source}</figcaption>}
    </figure>
  );
}
