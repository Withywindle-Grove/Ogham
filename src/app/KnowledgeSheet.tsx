// A place's Knowledge, the GM's alone (December dec-7 piece 6a; docs/plans/dec-7-5-place-page-and-map.md, Departures
// 6a; rulings mc-33, mc-34, mc-40; mockup design-december-mockups 01-place-of-linked-spots.html, frames 7 and 7b,
// approved 2026-11-12). Read-only: the book's words as its pack gives them, nothing written by the app.
//   The place's facts open at the top (bold lead-ins, as the place card has them); then each headed section folded
//   under its heading with the book's own first line (mc-40); a tap opens it in place, full length; several may be
//   open at once, and a lone section starts open. A section the pack sets out in blocks (pf-18) is drawn by the shared
//   rule-text part; plain text stays paragraphs. The source line last.
//   Not here, by the lead's ruling: the place's tables (the Tables card, frame 1a), the town watch (today's town
//   screen until 5t), an eye on a section and the "shared" lines (sharing a section waits for a plan).
// The sheet is `Dialog wide`, as the Rules sheet is (frame 7's right-hand panel is a later change to the shared part
// for every sheet). Wired to no screen yet: 5b adds the Knowledge button. The GM's device reads the pack's entry; a
// player's device never receives any of it.
import type { PlaceFacts } from '../modules/expedition/placeFacts.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { SourceLine } from '../ui/parts.tsx';
import { PlaceFactLines, SectionFold } from './PlaceFacts.tsx';
// The folds' summary and chevron are the place card's (PlaceFactsBody's folds), styled there.
import './PlaceCard.css';
import './KnowledgeSheet.css';

/** Whether a place has any knowledge to show (its facts or its sections); the Knowledge button's caller asks this. */
export const hasKnowledge = (facts: PlaceFacts): boolean => facts.facts.length > 0 || facts.sections.length > 0;

export function KnowledgeSheet({
  placeName,
  facts,
  source,
  onClose,
  preview = false,
}: {
  placeName: string;
  facts: PlaceFacts;
  /** "From your adventure: …" (knowledgeSourceLine), or null when the pack's name isn't known. */
  source: string | null;
  onClose: () => void;
  /** Drawn in place, for the gallery. */
  preview?: boolean;
}) {
  return (
    <Dialog wide label="Knowledge" over={placeName || undefined} onClose={onClose} preview={preview}>
      <div className="knowledge">
        {!hasKnowledge(facts) && <p className="auth__meta">The pack gives no knowledge for this place.</p>}
        <PlaceFactLines facts={facts} />
        {facts.sections.length > 0 && (
          <div className="knowledge__sections">
            {facts.sections.map((s, i) => (
              <SectionFold key={`${i}:${s.heading}`} section={s} open={facts.sections.length === 1} firstLine />
            ))}
          </div>
        )}
        {source && <SourceLine>{source}</SourceLine>}
      </div>
    </Dialog>
  );
}
