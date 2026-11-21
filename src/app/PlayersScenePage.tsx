// The players' Scene under its top: the page's structure (plan dec-9-the-players-scene, row P1; the lead's 5c; rulings
// mc-50, mc-31). Mockups (approved by Francis): page 18 of the December mockups (`18-the-players-scene-whole.html`),
// frames PL1 (whole, tablet), PL2 (before anything is shown), PL5 and PL5b (the phone's order) and PL9 (loading),
// approved 2026-11-14 (ap-10); set 1's `01-08` and `01-09` (body), approved 2026-11-12.
//
// Structure only. Two columns of one width under the top: at the left what the party may do next (the place the
// party is at; "Where to?" and Activities join it with rows P2 and P6), at the right what there is to read (the map,
// the place's card, the marching order last). In one column, on a phone, the left column comes first and the right
// after it, which is PL5's order. What stands in the columns is `PartyGroups`' business: today's parts, until their
// own rows are built.
//
// Before anything of the place is shown to the group (mc-28b, mc-50; PL2) the left card says so without a name, and
// the right column keeps its place, plainly empty, so players see where the map and what is shared will land. These
// parts take no place, name or id: nothing of an unshown place can reach the screen through them (hard rule 5).
//
// Activities (row P6; mc-45a; frames `01-08`, `01-08e`, `01-08j`, approved 2026-11-12; PL1 and PL5 place it under the
// place's card at the left): a player's aid, not something the app does. The pack's common player actions whose rule
// it carries, in its order and words, each a button with the book mark; a tap opens the rule in the rule's sheet, and
// nothing is proposed, rolled or sent. No such rules, no block (01-08e).
import { useState, type ReactNode } from 'react';
import { ruleBlocks, type RuleBlock } from '../modules/expedition/placeRules.ts';
import type { PlayerAction } from '../modules/expedition/playerActions.ts';
import { BookFaces } from '../ui/BookFaces.tsx';
import { Icon } from '../ui/icons.tsx';
import { SkeletonRows } from '../ui/parts.tsx';
import { RuleSheet } from './PlaceRules.tsx';
import './PlayersScenePage.css';

/** The two columns, in the book's faces as the top above them (st-8). One column under 768 px, the left one first. */
export function PlayersScenePage({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <BookFaces>
      <div className="players-page">
        <div className="players-page__column" data-column="left">
          {left}
        </div>
        <div className="players-page__column" data-column="right">
          {right}
        </div>
      </div>
    </BookFaces>
  );
}

/**
 * A card of the page (PL1): the place the party is at, at the left. With a `label` it is a named section; without one
 * it is a plain box around a part that names itself (today's place line). `group` ("Group 2") stands over what it
 * holds, where a player's characters are in more than one group and the page has a card for each.
 */
export function PlayersSceneCard({ label, group = null, children }: { label?: string; group?: string | null; children: ReactNode }) {
  const over = group && <p className="players-page__over">{group}</p>;
  if (!label)
    return (
      <div className="players-page__card">
        {over}
        {children}
      </div>
    );
  return (
    <section className="players-page__card" aria-label={label}>
      {over}
      {children}
    </section>
  );
}

/**
 * Whether a player's Scene takes this structure: during an expedition, wherever their groups are but in a town (the
 * town is its own plan) and not in a wilderness day, whose controls keep today's one column (not walked yet for
 * players). When the towns couldn't be read (`townsRead` false) nobody can say the player isn't in one, so the page
 * keeps today's column. The GM's Scene never does: the GM has a place page of their own.
 */
export function showsPlayersPage({ gm, expedition, day, townsRead, inTown }: { gm: boolean; expedition: boolean; day: boolean; townsRead: boolean; inTown: boolean }): boolean {
  return !gm && expedition && !day && townsRead && !inTown;
}

/** "Group 2: where you are", or the words alone with no group to name. */
const named = (group: string | null, words: string) => (group ? `${group}: ${words.charAt(0).toLowerCase()}${words.slice(1)}` : words);

/**
 * PL2's left card, before anything of the place is shown: no name, said in one line. `group` names whose card it is,
 * where the page has one for each of a player's groups.
 */
export function SomewhereNew({ group = null }: { group?: string | null }) {
  const over = named(group, 'Where you are');
  return (
    <PlayersSceneCard label={over}>
      <p className="players-page__over" aria-hidden="true">
        {over}
      </p>
      <h3 className="players-page__name">Somewhere new</h3>
      <p className="players-page__line">Your GM hasn’t described this place yet.</p>
    </PlayersSceneCard>
  );
}

/**
 * PL2's right column, before anything of the place is shown: where the map will stand, and the place's card, empty.
 * `group` names whose they are, as on the left card.
 */
export function NothingSharedYet({ group = null }: { group?: string | null }) {
  return (
    <>
      <section className="players-page__card" aria-label={named(group, 'The map')}>
        <div className="players-page__no-map">
          <p className="players-page__hint">No map shared yet.</p>
        </div>
      </section>
      <section className="players-page__card" aria-label={named(group, 'This place')}>
        <h3 className="players-page__heading">{named(group, 'This place')}</h3>
        <p className="players-page__hint">Nothing shared yet.</p>
      </section>
    </>
  );
}

/** An activity's rule as the sheet draws it: the pack's words, then its source as the setting's (01-08j). */
export function activityBlocks(action: PlayerAction): RuleBlock[] {
  const source: RuleBlock[] = action.source ? [{ kind: 'source', text: `From your setting: ${action.source}` }] : [];
  return [...ruleBlocks(action.text), ...source];
}

/**
 * Activities (P6; mc-45a; 01-08, 01-08j): a card at the left under the place's, the actions in the pack's order, each a
 * button with the book mark and its name that opens its rule. Nothing on the card or the sheet proposes, rolls or sends
 * anything. Absent, with nothing in its place, when the pack carries no such rules (01-08e).
 */
export function PlayersActivities({ activities }: { activities: readonly PlayerAction[] }) {
  const [open, setOpen] = useState<PlayerAction | null>(null);
  if (activities.length === 0) return null;
  return (
    <PlayersSceneCard label="Activities">
      <h3 className="players-page__heading">Activities</h3>
      <div className="players-activities">
        {activities.map((action) => (
          <button key={action.id} type="button" className="button-secondary players-activities__button" onClick={() => setOpen(action)}>
            <Icon name="open-book" size={20} />
            <span>{action.name}</span>
          </button>
        ))}
      </div>
      {open && <RuleSheet placeName="" line="Activities" name={open.name} blocks={activityBlocks(open)} onClose={() => setOpen(null)} />}
    </PlayersSceneCard>
  );
}

/** PL9's loading: still bars where the cards will be, one in each column, so nothing jumps when they arrive. */
export function PlayersSceneLoading() {
  return (
    <PlayersScenePage
      left={
        <div className="players-page__card">
          <SkeletonRows rows={3} label="Loading where you are" />
        </div>
      }
      right={
        <div className="players-page__card">
          <SkeletonRows rows={3} label="Loading the marching order" />
        </div>
      }
    />
  );
}
