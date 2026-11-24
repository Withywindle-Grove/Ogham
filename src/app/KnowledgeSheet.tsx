// A place's Knowledge, the GM's alone (December dec-7 piece 6a; docs/plans/dec-7-5-place-page-and-map.md, Departures
// 6a; rulings mc-33, mc-34, mc-40; mockup design-december-mockups 01-place-of-linked-spots.html, frames 7 and 7b,
// approved 2026-11-12). Read-only: the book's words as its pack gives them, nothing written by the app.
//   The place's facts open at the top (bold lead-ins, as the place card has them); then each headed section folded
//   under its heading with the book's own first line (mc-40); a tap opens it in place, full length; several may be
//   open at once, and a lone section starts open. A section the pack sets out in blocks (pf-18) is drawn by the shared
//   rule-text part; plain text stays paragraphs. The source line last.
//   Not here, by the lead's ruling: the place's tables (the Tables card, frame 1a) and the town watch (today's town
//   screen until 5t).
// The eye on each section (plan dec-9-the-players-scene P4; p4s-2, mc-35; frame 7b): a tap shares the section with the
// group whose page it is, or takes it back, at once, with Undo (the caller's `sharing`); a shared section says "Shared
// with the players, turn 9." under its heading, and the foot counts them, "1 of 3 sections shared." Without `sharing`
// (the gallery's first frames) the sheet stays read-only, as before.
// The sheet is `Dialog wide`, as the Rules sheet is (frame 7's right-hand panel is a later change to the shared part
// for every sheet). Wired to no screen yet: 5b adds the Knowledge button. The GM's device reads the pack's entry; a
// player's device never receives any of it.
import { useEffect, useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import type { PlaceFacts, PlaceSection } from '../modules/expedition/placeFacts.ts';
import { loadKnowledgeShares, setKnowledgeShare, shareOf, sharedCount, sharedWithLine, type KnowledgeShare, type TurnClock } from '../modules/expedition/placeKnowledge.ts';
import { useToast } from '../ui/ToastHost.tsx';
import { useLogVersion } from './campaignLog.tsx';
import { registry } from './services.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { EyeToggle, SourceLine } from '../ui/parts.tsx';
import { PlaceFactLines, SectionFold } from './PlaceFacts.tsx';
// The folds' summary and chevron are the place card's (PlaceFactsBody's folds), styled there.
import './PlaceCard.css';
import './KnowledgeSheet.css';

/** Whether a place has any knowledge to show (its facts or its sections); the Knowledge button's caller asks this. */
export const hasKnowledge = (facts: PlaceFacts): boolean => facts.facts.length > 0 || facts.sections.length > 0;

/** The eye's side of the sheet: whether a section is shared now (its line, or null), and the tap on its eye. */
export interface KnowledgeSharing {
  /** "Shared with the players, turn 9." for a shared section; null for one not shared. */
  sharedLine: (section: PlaceSection) => string | null;
  onEye: (section: PlaceSection, share: boolean) => void;
}

export function KnowledgeSheet({
  placeName,
  facts,
  source,
  onClose,
  preview = false,
  sharing = null,
}: {
  placeName: string;
  facts: PlaceFacts;
  /** "From your adventure: …" (knowledgeSourceLine), or null when the pack's name isn't known. */
  source: string | null;
  onClose: () => void;
  /** Drawn in place, for the gallery. */
  preview?: boolean;
  /** The eyes (p4s-2); null for a read-only sheet. */
  sharing?: KnowledgeSharing | null;
}) {
  // Only a section the pack lists (its place known) can carry an eye.
  const eyed = sharing ? facts.sections.filter((s) => s.at !== undefined) : [];
  const shared = sharing ? eyed.filter((s) => sharing.sharedLine(s) !== null).length : 0;
  return (
    <Dialog wide label="Knowledge" over={placeName || undefined} onClose={onClose} preview={preview}>
      <div className="knowledge">
        {!hasKnowledge(facts) && <p className="auth__meta">The pack gives no knowledge for this place.</p>}
        <PlaceFactLines facts={facts} />
        {facts.sections.length > 0 && (
          <div className="knowledge__sections">
            {facts.sections.map((s, i) => {
              const fold = <SectionFold key={`${i}:${s.heading}`} section={s} open={facts.sections.length === 1} firstLine note={sharing ? sharing.sharedLine(s) : null} />;
              if (!sharing || s.at === undefined) return fold;
              const line = sharing.sharedLine(s);
              const what = s.heading || 'this section';
              return (
                <div key={`${i}:${s.heading}`} className="knowledge__row">
                  <div className="knowledge__fold">{fold}</div>
                  <EyeToggle label={line ? `Shared with the players: ${what}` : `Share with the players: ${what}`} shown={line !== null} onChange={(on) => sharing.onEye(s, on)} />
                </div>
              );
            })}
          </div>
        )}
        {sharing && eyed.length > 0 && <p className="auth__meta knowledge__count">{sharedCount(shared, eyed.length)}</p>}
        {source && <SourceLine>{source}</SourceLine>}
      </div>
    </Dialog>
  );
}

/**
 * The GM's eyes on a place's Knowledge (p4s-2): the campaign's shares, read while the sheet is open and again after each
 * change or log line; a tap shares the section with the group whose page it is (or takes it back) at once, with Undo.
 * `blocked` (reading ahead, B2) is called instead and nothing is written. Null with no pack place to share from.
 */
export function useKnowledgeSharing({
  db,
  user,
  campaignId,
  group,
  groupLabel,
  place,
  turns,
  open,
  blocked,
}: {
  db: Db;
  user: CurrentUser;
  campaignId: string;
  group: number;
  /** "Group 2" when the party is split, else null ("the players"). */
  groupLabel: string | null;
  /** The pack's location the sheet reads. */
  place: { packId: string; entryId: string } | null;
  turns: TurnClock | null;
  open: boolean;
  blocked?: () => void;
}): KnowledgeSharing | null {
  const show = useToast();
  const logVersion = useLogVersion();
  const [shares, setShares] = useState<KnowledgeShare[] | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void loadKnowledgeShares(db, campaignId).then((found) => live && setShares(found));
    return () => {
      live = false;
    };
  }, [db, campaignId, open, version, logVersion]);
  if (!place) return null;
  const at = (section: PlaceSection) => ({ group, packId: place.packId, entryId: place.entryId, sectionAt: section.at ?? -1 });
  const undoLatest = async () => {
    const eventId = await latestChange(db, campaignId, setKnowledgeShare.name, user.id);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId, eventId, authorUserId: user.id }) : null;
    setVersion((v) => v + 1);
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  };
  return {
    sharedLine: (section) => {
      const found = shares ? shareOf(shares, at(section)) : null;
      return found ? sharedWithLine(found.sharedClock, turns, groupLabel) : null;
    },
    onEye: (section, share) => {
      if (blocked) return blocked();
      // A tap while the last change is still being saved, or before the shares are read, says so (never does nothing).
      if (busy || shares === null) return show({ text: shares === null ? 'Still reading what is shared…' : 'Still saving…' });
      setBusy(true);
      void runCommand(registry, db, user, setKnowledgeShare, { campaignId, ...at(section), share }).then((result) => {
        setBusy(false);
        setVersion((v) => v + 1);
        if (!result.ok) return show({ text: result.message, error: true });
        const what = section.heading || 'A section';
        const whom = groupLabel ?? 'the players';
        show({ text: share ? `Shared with ${whom}: ${what}` : `Taken back from ${whom}: ${what}`, onUndo: () => void undoLatest() });
      });
    },
  };
}
