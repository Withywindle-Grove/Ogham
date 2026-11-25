// The players' place card (plan dec-9-the-players-scene, row P4; rulings p4s-1 to p4s-4, p2p-24, p2p-11, p2p-1, p2p-3,
// rp-7, rp-8, mc-49; mockups: page 18 PL1, approved 2026-11-14; page 24 PL1b, PL1c and PL1d, approved 2026-11-18 as
// drawn; set 9's 09-PR1 to PR5b and 09-PR7*, approved 2026-11-13; the tap on a known Location has no frame and is
// approved from the real screen, p4s-4). Read-only: nothing here writes.
//   PlayersAreaCard, the right column's card: the Area's name as its heading only once the group was shown the Area (no
//     stand-in heading), then one row per section of knowledge the GM has shared ("What everyone knows", "Shared, turn
//     9."; a tap opens its full words), the Rules row (rp-7), and the other Locations of the Area the group knows, each
//     with its number ("2. The Wreck") and, under it on one line, the first piece the group was shown there (ppf-4, as
//     PL1b draws it); a tap opens its shown pieces in the standard sheet, p4s-4. Nothing to show: no card.
//   PlayersLocationCard, the left column's card (PL1b, PL1c, PL1d): the trail of shown names, "1. The Jetty", the rule's
//     icon button and the small picture button at the right of the head, then the shown pieces in the book's format (the
//     description first, its words naming a shown piece bold and underlined; each further piece led by its own word in
//     bold). Approved from the real screen with three fixes (ppf-6, 2026-11-20) and on the players' Scene, in place of
//     today's place line.
// Hidden means hidden: every word here comes from the players' reads (place_card_for_players, knowledge_for_players,
// place_rules_for_players, known_places_campaign), which send only what this group was shown.
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import type { Db } from '../core/supabase.ts';
import { leadWords } from '../modules/expedition/placeFacts.ts';
import { bookFormat, loadPlayersKnowledge, loadPlayersPlaceCards, numbered, sharedLine, type KnownPlace, type PlayersPlaceCard, type SharedKnowledge, type ShownPiece, type TurnClock } from '../modules/expedition/placeKnowledge.ts';
import { loadShownPlaces } from '../modules/expedition/placePlay.ts';
import type { PlayersRule } from '../modules/expedition/placeRules.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { ListRow, OpenCard, RowList } from '../ui/parts.tsx';
import { useLogVersion } from './campaignLog.tsx';
import { namedParts, PlacePicture } from './PlaceCard.tsx';
import { SectionWords } from './PlaceFacts.tsx';
import { PlaceRuleButtons, usePlayersRulesRow } from './PlaceRules.tsx';
import './PlayersPlaceCard.css';

/** Whether the Area's card has anything to show (a heading, a shared section, a rule or another known Location). */
export const areaCardShows = (card: PlayersPlaceCard | null, knowledge: readonly SharedKnowledge[], rules: readonly PlayersRule[]): boolean =>
  !!card && (card.area !== null || knowledge.length > 0 || rules.length > 0 || card.known.length > 0);

/**
 * The shown pieces in the book's format (p2p-24; PL1b): the description first, its words that name another shown piece
 * bold and underlined (only a piece shown: an unshown piece's word is never sent, so never marked), then each further
 * piece led by its own word in bold. Shared by the Location's card and a known Location's sheet.
 */
export function ShownPiecesText({ pieces }: { pieces: readonly ShownPiece[] }) {
  const ordered = bookFormat(pieces);
  const names = ordered.filter((p) => p.kind !== 'description' && p.lead.trim()).map((p) => p.lead);
  return (
    <div className="players-place__pieces">
      {ordered.map((piece) => (
        <p key={piece.id} className="players-place__piece">
          {piece.lead && (
            <>
              <strong>{leadWords(piece.lead)}</strong>{' '}
            </>
          )}
          {(piece.kind === 'description' ? namedParts(piece.text, names) : [{ text: piece.text, named: false }]).map((part, i) =>
            part.named ? (
              <strong key={i} className="players-place__named">
                {part.text}
              </strong>
            ) : (
              <Fragment key={i}>{part.text}</Fragment>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

/** The trail of shown names over a place (PL1b): "Saltwick Island › The Drowned Harbour", the nearest in bold. Words only. */
export function PlayersTrail({ trail }: { trail: readonly string[] }) {
  if (trail.length === 0) return null;
  return (
    <nav className="players-place__trail" aria-label="Where this is">
      <ol>
        {trail.map((name, i) => (
          <li key={`${i}:${name}`}>
            {i > 0 && <Icon name="chevron" size={16} />}
            <span className={i === trail.length - 1 ? 'players-place__trail-here' : undefined}>{name}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * The left column's card (PL1b, PL1c, PL1d; ppf-6): the trail, the numbered name, at the head's right the rule's icon
 * buttons and the place's picture as a small button once shown (ppf-6 c; a tap opens it whole), the shown pieces in the
 * book's format, then what follows it (`children`: P2's "Where to?"). `group` ("Group 2") stands over it where a player
 * has a card for each of their groups.
 */
export function PlayersLocationCard({
  card,
  pieces,
  rules,
  picture = null,
  group = null,
  children = null,
}: {
  card: Pick<PlayersPlaceCard, 'here' | 'trail'>;
  pieces: readonly ShownPiece[];
  rules: readonly PlayersRule[];
  /** The place's picture, once the GM shows it (with what PlacePicture needs). */
  picture?: { db: Db; campaignId: string; assetId: string } | null;
  group?: string | null;
  children?: ReactNode;
}) {
  const name = numbered(card.here);
  return (
    <section className="players-page__card players-place" aria-label={group ? `${group}: where you are: ${name}` : `Where you are: ${name}`}>
      {group && <p className="players-page__over">{group}</p>}
      <PlayersTrail trail={card.trail} />
      <div className="players-place__head">
        <h3 className="players-place__name">{name}</h3>
        <div className="players-place__tools">
          <PlaceRuleButtons rules={rules} />
          {picture && <PlacePicture db={picture.db} campaignId={picture.campaignId} assetId={picture.assetId} name={name} small />}
        </div>
      </div>
      <ShownPiecesText pieces={pieces} />
      {children}
    </section>
  );
}

/** A shared section opened (p4s-2): the standard sheet titled with its heading, its full words, nothing else. */
function SharedSectionSheet({ shared, onClose }: { shared: SharedKnowledge; onClose: () => void }) {
  return (
    <Dialog wide label={shared.section.heading || 'What everyone knows'} over={shared.placeName || undefined} onClose={onClose}>
      <SectionWords section={shared.section} />
    </Dialog>
  );
}

/**
 * A known Location opened (p4s-4): the standard sheet titled with its numbered name, holding its shown pieces in the
 * card's book format, nothing else. Its pieces are read when it opens (known_places_campaign: only what the group was
 * shown, on any visit), and again with the log.
 */
export function KnownLocationSheet({ db, campaignId, place, onClose, asPlayer }: { db: Db; campaignId: string; place: KnownPlace; onClose: () => void; asPlayer?: string }) {
  const logVersion = useLogVersion();
  const [read, setRead] = useState<{ pieces: ShownPiece[] } | 'failed' | null>(null);
  useEffect(() => {
    let live = true;
    void loadShownPlaces(db, campaignId, asPlayer).then((found) => {
      if (!live) return;
      if (!found) return setRead((was) => (was && was !== 'failed' ? was : 'failed'));
      const pieces = [...found.current, ...found.earlier].filter((p) => p.placeId === place.placeId).flatMap((p) => p.pieces.map((piece) => ({ id: piece.id, kind: piece.kind, text: piece.text, lead: piece.lead ?? '' })));
      setRead({ pieces });
    });
    return () => {
      live = false;
    };
  }, [db, campaignId, place.placeId, logVersion, asPlayer]);
  return (
    <Dialog wide label={numbered(place)} onClose={onClose}>
      {read === null && <p className="auth__meta">Opening…</p>}
      {read === 'failed' && <p className="auth__meta">Couldn't open what you know of this place. Close this and try again.</p>}
      {read && read !== 'failed' && (read.pieces.length > 0 ? <ShownPiecesText pieces={read.pieces} /> : <p className="auth__meta">Nothing of it is shown to you now.</p>)}
    </Dialog>
  );
}

/**
 * The right column's card (PL1b; p4s-1, p4s-2, p4s-4, rp-7): the Area's name, the shared sections, the Rules row, the
 * other known Locations. `here` is the name the rules' read gives the place the party is at (rp-4). `group` names whose
 * card it is ("Group 2"), where a player has one for each of their groups.
 */
export function PlayersAreaCard({
  db,
  campaignId,
  card,
  knowledge,
  rules,
  turns,
  group = null,
  asPlayer,
}: {
  db: Db;
  campaignId: string;
  card: PlayersPlaceCard;
  knowledge: readonly SharedKnowledge[];
  rules: readonly PlayersRule[];
  turns: TurnClock | null;
  group?: string | null;
  /** The GM's view as the player (C15f): whose reading a known Location opens with. */
  asPlayer?: string;
}) {
  const [section, setSection] = useState<SharedKnowledge | null>(null);
  const [location, setLocation] = useState<KnownPlace | null>(null);
  const rulesRow = usePlayersRulesRow({ rules, here: card.here.name, over: card.area });
  const label = card.area ?? 'This place';
  // The sheets stand outside the card, so one stays open while what opened it leaves the read (rp-8; a closed rule).
  const sheets = (
    <>
      {rulesRow.sheets}
      {section && <SharedSectionSheet shared={section} onClose={() => setSection(null)} />}
      {location && <KnownLocationSheet db={db} campaignId={campaignId} place={location} onClose={() => setLocation(null)} asPlayer={asPlayer} />}
    </>
  );
  if (!areaCardShows(card, knowledge, rules)) return sheets;
  return (
    <>
      <section className="players-page__card players-area" aria-label={group ? `${group}: ${label}` : label}>
        {group && <p className="players-page__over">{group}</p>}
        {card.area && <h3 className="players-page__heading">{card.area}</h3>}
        {(knowledge.length > 0 || rulesRow.row) && (
          <div className="players-area__rows">
            {knowledge.map((shared) => {
              const line = sharedLine(shared.sharedClock, turns);
              const title = shared.section.heading || 'What everyone knows';
              return <OpenCard key={shared.id} icon="open-book" title={title} summary={line} label={`${title}: ${line}`} onOpen={() => setSection(shared)} />;
            })}
            {rulesRow.row}
          </div>
        )}
        {card.known.length > 0 && (
          <RowList label={card.area ? `Other places of ${card.area}` : 'Other places you know here'} dotted>
            {card.known.map((place) => (
              <ListRow key={place.placeId} title={numbered(place)} sub={place.line || undefined} onOpen={() => setLocation(place)} />
            ))}
          </RowList>
        )}
      </section>
      {sheets}
    </>
  );
}

/**
 * A player's cards and shared knowledge, read now and again with every log line or group signal; a failed read keeps the
 * last good one (as the rules do, review of #726), so a network blip never empties the card. Nothing for the GM.
 */
export function usePlayersPlaceCards(db: Db, campaignId: string, player: boolean, asPlayer?: string): { cards: ReadonlyMap<number, PlayersPlaceCard>; knowledge: readonly SharedKnowledge[] } {
  const logVersion = useLogVersion();
  const [read, setRead] = useState<{ cards: ReadonlyMap<number, PlayersPlaceCard>; knowledge: readonly SharedKnowledge[] }>({ cards: new Map(), knowledge: [] });
  useEffect(() => {
    if (!player) return;
    let live = true;
    void Promise.all([loadPlayersPlaceCards(db, campaignId, asPlayer), loadPlayersKnowledge(db, campaignId, asPlayer)]).then(([cards, knowledge]) => {
      if (!live) return;
      setRead((was) => ({ cards: cards ?? was.cards, knowledge: knowledge ?? was.knowledge }));
    });
    return () => {
      live = false;
    };
  }, [db, campaignId, player, logVersion, asPlayer]);
  return read;
}
