// The player's and the GM's sections, with the phone's tab bars (final drafts A11, slice E; Design on #549).
import type { NavTab } from '../ui/SectionNav.tsx';

export type PlayerTab = 'player' | 'scene' | 'pack' | 'magic' | 'log';

/** Magic (mp-20, mm-2; dec-8 B): a crescent moon with a spark, after Pack, for a character with spells. */
const MAGIC_TAB: NavTab<PlayerTab> = { id: 'magic', name: 'Magic', icon: 'magic' };

// The player's sections, the same on every device (ruled 2026-10-23), with the same icons on every device (06; Design
// on #549, 2026-11-07: Francis's crown, campfire and tied sack, no fork by width).
export const TABS: NavTab<PlayerTab>[] = [
  { id: 'player', name: 'Player', icon: 'crown' },
  { id: 'scene', name: 'Scene', icon: 'scene' },
  { id: 'pack', name: 'Pack', icon: 'sack' },
];

/** The player's sections on a tablet: Player, Scene, Pack, and Magic for a character with spells (mp-20). */
export const playerTabs = (magic: boolean): NavTab<PlayerTab>[] => (magic ? [...TABS, MAGIC_TAB] : TABS);

/**
 * The phone's tab bar (final drafts A11, slice E; mockup creation/17): Player, Scene, Pack and Log, with Francis's
 * icons (a crown, a campfire, a tied sack, an open book); a character with spells has Magic before Log (mm-2). Scene's badge counts what waits there that the app knows
 * of: the GM's unread messages (their card is on Scene). A tablet keeps its three sections and the top row's Log.
 */
export function phoneTabs(waiting: number, magic = false): NavTab<PlayerTab>[] {
  return [
    { id: 'player', name: 'Player', icon: 'crown' },
    { id: 'scene', name: 'Scene', icon: 'scene', badge: waiting, badgeLabel: waiting === 1 ? 'message waiting' : 'messages waiting' },
    { id: 'pack', name: 'Pack', icon: 'sack' },
    // A caster's bar is five (mm-2): Magic before Log. Five is the limit; a sixth tab needs a new answer first.
    ...(magic ? [MAGIC_TAB] : []),
    { id: 'log', name: 'Log', icon: 'open-book' },
  ];
}

export type GmSection = 'scene' | 'players' | 'rules' | 'log';

/**
 * What waits for the GM, by kind (plan m5b-sheet-revised PR 2, steps 9–11; mockup gm/01-rail-attention, A2). Each tab
 * lights while its own list isn't empty and goes out when it empties, never on a visit:
 *   Players: characters waiting for approval, sheet changes waiting (#567), players' one-offs and worn armour's base
 *   to pick (Waiting for you), and players' requests (Waiting for you lists them on Players today).
 *   Scene and Rules: nothing in the app feeds them yet (a yield to accept, a vote to call; a homebrew suggestion from
 *   a player's Other…): see the plan's Departures.
 */
export interface GmWaiting {
  /** New characters and sheet changes waiting for approval, and players' one-off items. */
  toApprove: number;
  /** Players' requests waiting for an answer. */
  toAnswer: number;
  /** Worn magic armour whose base the GM hasn't picked yet. */
  toPick: number;
}

export const NOTHING_WAITING: GmWaiting = { toApprove: 0, toAnswer: 0, toPick: 0 };

/** Everything waiting on Players, as one figure (the tablet's "3 waiting", the phone's badge). */
export const waitingTotal = (w: GmWaiting) => w.toApprove + w.toAnswer + w.toPick;

/** What waits on Players, in words for its name ("1 to approve, 2 to answer"); empty when nothing does. */
export function playersWaitWords(w: GmWaiting): string {
  return [
    w.toApprove ? `${w.toApprove} to approve` : '',
    w.toAnswer ? `${w.toAnswer} to answer` : '',
    w.toPick ? `${w.toPick} ${w.toPick === 1 ? 'base' : 'bases'} to pick` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/** The GM's sections on a tablet: Scene, Players with its count in words (and its glow), Rules. */
export function gmTabs(waiting: GmWaiting): NavTab<GmSection>[] {
  const n = waitingTotal(waiting);
  return [
    { id: 'scene', name: 'Scene', icon: 'scene' },
    { id: 'players', name: 'Players', icon: 'players', count: n, countLabel: 'waiting for you', countWord: 'waiting', waits: playersWaitWords(waiting) },
    { id: 'rules', name: 'Rules', icon: 'scales' },
  ];
}

/**
 * The GM's phone tab bar (Design on #549): Scene, Players, Rules and Log. What waits for the GM is a badge on Players
 * (and its glow), in words in the tab's name for screen readers. Rules is the scales and Log the open book on every
 * device (Design on #549).
 */
export function gmPhoneTabs(waiting: GmWaiting): NavTab<GmSection>[] {
  const n = waitingTotal(waiting);
  return [
    { id: 'scene', name: 'Scene', icon: 'scene' },
    { id: 'players', name: 'Players', icon: 'players', badge: n, badgeLabel: 'waiting for you', waits: playersWaitWords(waiting) },
    { id: 'rules', name: 'Rules', icon: 'scales' },
    { id: 'log', name: 'Log', icon: 'open-book' },
  ];
}
