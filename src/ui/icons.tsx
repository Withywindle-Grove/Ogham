// The app's one icon family (ruled 2026-10-23): every navigation icon lives here, so the style release can swap
// the whole set in one place, and the same thing gets the same icon on every screen. These are plain-line
// placeholders until the carved family replaces them. Line icons are drawn for a 24 × 24 box; icons from the set
// (iconSet.ts, ds-6) are filled on its 512 grid. Both take the text colour, fill the same box, and
// are always decorative: the button or tab beside them carries the words (or an aria-label when icon-only).
import type { ReactNode } from 'react';
import { ICONS as STEP_ICON_NAMES } from '../modules/expedition/modes.ts';
import { symbolNameOf, type StatusSymbolName } from '../modules/expedition/statusLook.ts';
import { ICON_SET, isSetIconName, type SetIconName } from './iconSet.ts';

export type IconName =
  | 'scene'
  | 'players'
  // The GM reference screen (M5 gate B4): an open book with a ribbon, distinct from Log's plain open book.
  | 'reference'
  | 'characters'
  | 'sheet'
  | 'company'
  | 'library'
  | 'sign-out'
  // Messages (M5 gate B3): an envelope, beside the log.
  | 'messages'
  // The time strip's ⋯ items (M5 gate B11: every item its own icon).
  | 'encounter-check'
  | 'darkness'
  | 'advance'
  | 'end-expedition'
  | 'end-session'
  | 'collapse'
  | 'expand'
  // Places from packs (M8b slice 0, the picker's mockup): a place (a pin), the place this one is part of (going up),
  // the places inside it (going in), and unfold / fold (plus and minus, never an arrow).
  | 'pin'
  | 'within'
  | 'inside'
  // Show players, one piece (M5 gate B1): an open eye (shown) and an eye struck through (hidden).
  | 'eye'
  | 'eye-off'
  // The eye (ds-2, 2026-11-12): hidden from the players is a closed eye with lashes; 'eye-off' (struck through) is kept
  // for one meaning only, the GM's alone, never sent.
  | 'eye-shut'
  // The toggle's knob (ds-1, frame B as ds-1c picked it): a tick when on, a cross when off, so the state never rests on colour alone.
  | 'tick'
  | 'cross'
  // A pack's ⋯ in the Rules library (lr-3): Edit pack, Export as a pack file, Delete from your library….
  | 'edit'
  | 'export'
  | 'delete'
  // Creation's rework (cw-11, mockup creation/12): ⓘ on Help me choose and before a name that opens its entry; a plus
  // or a minus on the square button of a row that unfolds (FoldedGroup).
  | 'info'
  | 'plus'
  | 'minus'
  // Creation's app bar (final drafts A1): ← Back at its left.
  | 'back'
  // The phone's navigation (final drafts A11, slice E; mockup creation/17, Francis's picks): the tab bar's crown
  // (Player), tied sack (Pack) and open book (Log; Scene keeps its campfire); ≡ that opens the drawer; the drawer's
  // scales (Setting rules) and two banners (Your campaigns).
  | 'crown'
  | 'sack'
  | 'open-book'
  // The Magic tab (mm-2, approved with mockup magic/04): a crescent moon with a spark (the star is Pin's, the flame Scene's).
  | 'magic'
  | 'menu'
  | 'scales'
  | 'banners'
  // The GM's campaign settings, at the top of the drawer (Design on #549, 2026-11-07): a gear.
  | 'gear'
  // A row that opens something (plan m5b-players-screens-standard A2): a chevron at its right edge, in place of "›".
  | 'chevron'
  // An item's sheet pins it to the top with a star (plan m5b-players-screens-standard C): empty, then filled.
  | 'star'
  | 'star-filled'
  // Check for a new version, at the ⋯ menu's foot (F55, au-1): a circling arrow.
  // The Move on sheet's Takes line (PU1, Francis 2026-11-27: the clock, not the hourglass): a clock face.
  | 'clock'
  | 'refresh';

const PATHS: Record<IconName, ReactNode> = {
  // A campfire: two crossed logs and a flame.
  scene: (
    <>
      <path d="M12 3c2 3 4 4.5 4 7.5a4 4 0 0 1-8 0c0-1.6.8-2.8 1.8-3.8.2 1.4.9 2.3 1.7 2.8C11 7.5 11.2 5.2 12 3z" />
      <path d="M4 20l16-4M20 20L4 16" />
    </>
  ),
  // People: two heads and shoulders.
  players: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="16.5" cy="9" r="2.5" />
      <path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5" />
    </>
  ),
  // An open book with a bookmark ribbon hanging from it: the book itself (the GM reference screen, B4).
  reference: (
    <>
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z" />
      <path d="M12 6.5v13" />
      <path d="M15 5.2v6.3l1.5-1.3 1.5 1.3V4.8" />
    </>
  ),
  // Your characters: two cards, one behind the other.
  characters: (
    <>
      <path d="M8 4h11v14" />
      <path d="M5 7h11v13H5z" />
      <circle cx="10.5" cy="12" r="2" />
      <path d="M7.5 17.5a3 3 0 0 1 6 0" />
    </>
  ),
  // The full character sheet: a page with a portrait corner and lines.
  sheet: (
    <>
      <path d="M6 3h12v18H6z" />
      <path d="M9 7h3v3H9zM14 8h1M9 14h6M9 17h6" />
    </>
  ),
  // A company: a banner on a pole.
  company: (
    <>
      <path d="M6 21V3" />
      <path d="M6 4h12l-3 4 3 4H6" />
    </>
  ),
  // The rules library: books on a shelf.
  library: (
    <>
      <path d="M4 20h16" />
      <path d="M6 5h3v15H6zM10 7h3v13h-3z" />
      <path d="M15 6.5l2.8-.8 2.5 13.5-2.8.8z" />
    </>
  ),
  // Sign out: a door with an arrow leaving it.
  // An envelope: its outline and the flap.
  messages: (
    <>
      <path d="M3 6h18v12H3z" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  'sign-out': (
    <>
      <path d="M13 4H6v16h7" />
      <path d="M10 12h10M17 9l3 3-3 3" />
    </>
  ),
  // Encounter check: two crossed blades (the hour track's encounter symbol).
  'encounter-check': (
    <>
      <path d="M5 4l10 10M19 4L9 14" />
      <path d="M13 16l3-3M11 16l-3-3M15 15l3.5 3.5M9 15l-3.5 3.5" />
    </>
  ),
  // Travelling in darkness: a crescent moon.
  darkness: <path d="M15.5 4a8 8 0 1 0 4.5 12A6.5 6.5 0 0 1 15.5 4z" />,
  // Advance by…: two arrowheads forward over a clock's base line.
  advance: (
    <>
      <path d="M4 7l6 5-6 5zM12 7l6 5-6 5z" />
      <path d="M20 6v12" />
    </>
  ),
  // End expedition: an archway with the path leading out of it.
  'end-expedition': (
    <>
      <path d="M4 20V10a5 5 0 0 1 10 0v10" />
      <path d="M9 20l2-5M15 15h6M18 12l3 3-3 3" />
    </>
  ),
  // End session: an hourglass.
  'end-session': (
    <>
      <path d="M7 3h10M7 21h10" />
      <path d="M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />
    </>
  ),
  // Collapse the left-hand menu (B15): a chevron pointing left to a bar.
  collapse: <path d="M15 6l-6 6 6 6M5 4v16" />,
  // Expand it again: a chevron pointing right from a bar.
  expand: <path d="M9 6l6 6-6 6M5 4v16" />,
  // Shown to players (B1): an open eye, its pupil filled.
  eye: (
    <>
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </>
  ),
  // Hidden from players (B1): the eye, open pupil, with a stroke through it.
  'eye-off': (
    <>
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 20L20 4" />
    </>
  ),
  // Hidden from the players (ds-2): a closed eye, its lid's curve with five lashes (the mockup's eyeshut).
  'eye-shut': (
    <>
      <path d="M2.5 8c2.6 4.4 5.8 6.4 9.5 6.4s6.9-2 9.5-6.4" />
      <path d="M12 14.4v4.6M7.2 13.4l-1.7 3.8M16.8 13.4l1.7 3.8M3.9 10.4l-2.6 2.7M20.1 10.4l2.6 2.7" />
    </>
  ),
  // The toggle's knob when on (ds-1): a tick.
  tick: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  // The toggle's knob when off (ds-1): a cross.
  cross: <path d="M7 7l10 10M17 7L7 17" />,
  // Edit pack (lr-3): a pencil.
  edit: <path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3" />,
  // Export as a pack file (lr-3): an arrow up out of a tray.
  export: <path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6" />,
  // Delete from your library… (lr-3): a bin.
  delete: <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6" />,
  // ⓘ (cw-11): a ring with the i inside.
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.5" r="0.6" fill="currentColor" />
    </>
  ),
  // Pin to the top (plan m5b-players-screens-standard C): a five-pointed star, empty, then filled once pinned.
  star: <path d="M12 3l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.5l-5.7 3 1.1-6.3L2.8 9.7l6.4-.9z" />,
  'star-filled': <path d="M12 3l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.5l-5.7 3 1.1-6.3L2.8 9.7l6.4-.9z" fill="currentColor" />,
  // Unfold / fold (cw-11): a plus, a minus.
  // The place picker (M8b slice 0): a map pin; a place within another; a place with places inside it.
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" fill="currentColor" />
    </>
  ),
  within: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor" />
    </>
  ),
  inside: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="9" r="1.6" fill="currentColor" />
      <circle cx="15.5" cy="9" r="1.6" fill="currentColor" />
      <circle cx="12" cy="15.5" r="1.6" fill="currentColor" />
    </>
  ),
  plus: <path d="M5 12h14M12 5v14" />,
  minus: <path d="M5 12h14" />,
  // ← Back (final drafts A1): a shaft and its head.
  back: <path d="M19 12H6M11 6l-6 6 6 6" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  // Player (slice E): a crown, three points over its band.
  crown: (
    <>
      <path d="M4 17l1-10 4 4 3-6 3 6 4-4 1 10z" />
      <path d="M4 20h16" />
    </>
  ),
  // Pack (slice E): a sack tied at the neck.
  sack: (
    <>
      <path d="M9 8h6l3 4c2 3 1 8-6 8s-8-5-6-8z" />
      <path d="M9 8L8 4h8l-1 4" />
    </>
  ),
  // Log (slice E): an open book, its spine down the middle.
  'open-book': (
    <>
      <path d="M3 5c3 0 6 1 9 3 3-2 6-3 9-3v13c-3 0-6 1-9 3-3-2-6-3-9-3z" />
      <path d="M12 8v13" />
    </>
  ),
  // Magic (mm-2): a crescent moon with a spark, as mockup magic/04 draws it.
  magic: (
    <>
      <path d="M14 3a8.5 8.5 0 1 0 7 13.5A7.5 7.5 0 0 1 14 3z" />
      <path d="M18.5 4v4M16.5 6h4" />
    </>
  ),
  // ≡, the drawer (slice E): three lines.
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  // Setting rules (slice E): a pair of scales.
  scales: (
    <>
      <path d="M12 4v16M7 20h10M4 8h16" />
      <path d="M3 14l3-6 3 6zM15 14l3-6 3 6z" />
    </>
  ),
  // The campaign's settings (slice E): a gear, a hub and its teeth.
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </>
  ),
  // Your campaigns (slice E): two banners on their poles.
  banners: (
    <>
      <path d="M5 3v18M14 3v18" />
      <path d="M5 4h7l-2 3 2 3H5zM14 4h7l-2 3 2 3h-7z" />
    </>
  ),
  // Check for a new version (F55, au-1): an arrow circling back to its start.
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 3.5v4.5H15" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
};

function Svg({ size, children, stroke = '1.6' }: { size: number; children: ReactNode; stroke?: string }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/**
 * An icon: a line icon of the app's own (24 grid, stroked), or, named from the set (iconSet.ts, ds-6), the set's
 * filled shape on its 512 grid. Both take the text colour and the same box, so they sit side by side until the sweep.
 */
export function Icon({ name, size = 24 }: { name: IconName | SetIconName; size?: number }) {
  if (isSetIconName(name)) return <SetIconSvg d={ICON_SET[name].d} size={size} />;
  return <Svg size={size}>{PATHS[name]}</Svg>;
}

// The filled variant (ds-6): the set's one path on its 512 grid, filled in the text colour, no stroke; the set's
// square background is left out.
function SetIconSvg({ d, size }: { d: string; size: number }) {
  return (
    <svg className="icon icon--filled" viewBox="0 0 512 512" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

// The step and event symbols (M5 gate B11, ruled 2026-11-01: icons over letters): the hour track's marks, the
// procedure strip and list, and the reminder card. Same family, same placeholders, drawn inline (no icon
// dependency). A symbol with no clear icon keeps its letter (StepSymbol, parts.tsx).
const STEP_PATHS: Partial<Record<string, ReactNode>> = {
  // The clock moves: a clock face.
  time: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  // A light: a flame over a torch's head.
  light: (
    <>
      <path d="M12 3c2 2.5 3.5 4 3.5 6.5a3.5 3.5 0 0 1-7 0C8.5 7 10.5 5.5 12 3z" />
      <path d="M10 14.5h4l-1 6.5h-2z" />
    </>
  ),
  // Listen: an ear.
  listen: (
    <>
      <path d="M8 9a4 4 0 0 1 8 0c0 2.5-2.5 3.5-2.5 6a2.5 2.5 0 0 1-5 0" />
      <path d="M11 9.5a1 1 0 0 1 2 0" />
    </>
  ),
  // A door, ajar.
  door: (
    <>
      <path d="M6 21V4h12v17" />
      <path d="M4 21h16M14.5 12.5h.5" />
    </>
  ),
  // Search: a magnifying glass.
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="M15 15l5 5" />
    </>
  ),
  // Rest: a crescent moon.
  rest: <path d="M15.5 4a8 8 0 1 0 4.5 12A6.5 6.5 0 0 1 15.5 4z" />,
  // Camp: a tent.
  camp: (
    <>
      <path d="M3 20L12 5l9 15z" />
      <path d="M12 12l-3 8M12 12l3 8" />
    </>
  ),
  // Travel: footprints along a path.
  travel: (
    <>
      <ellipse cx="8" cy="15" rx="2" ry="3" />
      <ellipse cx="16" cy="8" rx="2" ry="3" />
      <path d="M8 20v.5M16 13v.5" />
    </>
  ),
  // The weather: a cloud.
  weather: <path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18z" />,
  // An encounter check: two crossed blades.
  encounter: (
    <>
      <path d="M5 4l10 10M19 4L9 14" />
      <path d="M13 16l3-3M11 16l-3-3M15 15l3.5 3.5M9 15l-3.5 3.5" />
    </>
  ),
  // An effect: a star.
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />,
  // A GM's reminder: a note with a folded corner.
  note: (
    <>
      <path d="M5 4h14v11l-5 5H5z" />
      <path d="M14 20v-5h5" />
    </>
  ),
  // A watch: an open eye.
  watch: (
    <>
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  // Describe: a speech bubble.
  describe: <path d="M4 5h16v10H10l-5 4v-4H4z" />,
  // The course: a compass rose.
  course: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 6.5l2 5.5-2 5.5-2-5.5z" />
    </>
  ),
  // A monster: claw marks.
  monster: <path d="M7 4c-1 5 0 11 3 16M12 4c-.5 5 .5 11 3 16M17 4c0 5 1 10 3 14" />,
  // Forage: a leaf.
  forage: (
    <>
      <path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z" />
      <path d="M5 19l8-8" />
    </>
  ),
  // Hunt: an arrow.
  hunt: <path d="M4 20L19 5M19 5h-5M19 5v5M4 20l1-4M4 20l4-1" />,
};

/** A step or event symbol's icon (B11), or null when it has none (the caller shows its letter). */
export function StepIcon({ name, size = 16 }: { name: string; size?: number }) {
  const paths = STEP_PATHS[name];
  return paths ? <Svg size={size}>{paths}</Svg> : null;
}

/** Whether a step or event symbol has an icon (B11). */
export const hasStepIcon = (name: string) => STEP_PATHS[name] !== undefined;

/**
 * What a pack's icon name draws (pf-12c): a step's or activity's `icon` and a rule's `button` ('step'), or a
 * condition's `icon` ('condition'). A step's or button's name from the set draws the set's icon; every name packs already use keeps
 * what it drew before: a step symbol's line icon, or its letter where it has none (as `lost` today), and a status
 * symbol. Null for a name the app doesn't know: the caller falls back (a step to its number, a rule button to a
 * plain mark with its words, a condition to its first letter).
 */
export type PackIcon = { from: 'set'; name: SetIconName } | { from: 'step'; name: string; drawn: boolean } | { from: 'status'; name: StatusSymbolName };

export function packIconOf(value: unknown, field: 'step' | 'condition'): PackIcon | null {
  if (field === 'condition') {
    // The status symbols stay their own closed list (07, R3-6): pf-12c names steps and rule buttons only.
    const status = symbolNameOf(value);
    return status ? { from: 'status', name: status } : null;
  }
  if (isSetIconName(value)) return { from: 'set', name: value };
  if (typeof value !== 'string') return null;
  return (STEP_ICON_NAMES as readonly string[]).includes(value) ? { from: 'step', name: value, drawn: hasStepIcon(value) } : null;
}

// The status symbols (plan m5b-creation-retest-3 F; mockup players/03-status-symbols, approved 2026-11-08): 25, one
// idea each, drawn at stroke 2 in the ring's colour. A condition's `icon` names one (statusLook.ts, STATUS_SYMBOLS);
// the Record makes sure every name has its drawing.
const STATUS_PATHS: Record<StatusSymbolName, ReactNode> = {
  flame: <path d="M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1.2-3.3C9.5 9 10.5 10 11 10.5 11 8 11 5.5 12 3z" />,
  star: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7z" />,
  ghost: (
    <>
      <path d="M5 21V11a7 7 0 0 1 14 0v10l-2.3-2-2.4 2-2.3-2-2.3 2-2.4-2z" />
      <path d="M9.5 11h.01M14.5 11h.01" strokeWidth="2.6" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z" />,
  'arrow-forward': <path d="M4 12h15M13 6l6 6-6 6" />,
  'arrow-back': <path d="M20 12H5M11 6l-6 6 6 6" />,
  bolt: <path d="M13 2L5 14h6l-1 8 9-13h-6z" />,
  'eye-slash': <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M7 7.5C4.5 9 3 12 3 12s3.5 6 9 6c1.5 0 2.9-.4 4-1M10 6.2A9 9 0 0 1 12 6c5.5 0 9 6 9 6s-.8 1.4-2.2 2.8" />,
  'eye-half': (
    <>
      <path d="M3 12s3.5-6 9-6 9 6 9 6" />
      <path d="M3 12s3.5 6 9 6 9-6 9-6" strokeDasharray="2 3" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  'sun-slash': (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
      <path d="M3 21L21 3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  chain: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.4 1.4" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.4-1.4" />
    </>
  ),
  bed: (
    <>
      <path d="M3 18V8M3 14h18v4M21 18v-6a3 3 0 0 0-3-3H10v5" />
      <circle cx="6.5" cy="10.5" r="1.5" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  stone: (
    <>
      <path d="M7 19l-3-5 2-6 6-3 6 3 2 6-3 5z" />
      <path d="M9 13l3-4 3 4" />
    </>
  ),
  spiral: <path d="M12 12a1.5 1.5 0 0 1 3 0 3 3 0 0 1-6 0 4.5 4.5 0 0 1 9 0 6 6 0 0 1-12 0 7.5 7.5 0 0 1 15 0" />,
  hand: <path d="M7 11V6a1.5 1.5 0 0 1 3 0v5M10 10V4.5a1.5 1.5 0 0 1 3 0V11M13 10.5V5.5a1.5 1.5 0 0 1 3 0V12M16 11.5V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3.5 14a1.6 1.6 0 0 1 2.7-1.7L7 13" />,
  drop: <path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z" />,
  blot: (
    <>
      <path d="M8 4c2-1.5 5 0 6 2 3 0 5 3 3.5 5.5 1.5 2.5-1 5-3.5 4.5-1.5 2.5-5 2.5-6.5 0C4 16 3 12.5 5 11 3.5 8.5 5.5 5 8 4z" />
      <path d="M10 10h.01M13.5 12.5h.01M9 14h.01" strokeWidth="2.6" />
    </>
  ),
  feather: <path d="M20 4c-6 0-11 4-13 10l-3 6M8 14l8-8M9.5 18c4 0 8-3 9.5-9-5 0-8 2-9.5 6" />,
  bread: (
    <>
      <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 2 7.5V19H6v-5.5A4 4 0 0 1 4 10z" />
      <path d="M9 11v4M12 10v5M15 11v4" />
    </>
  ),
  cup: (
    <>
      <path d="M5 5h11v8a5.5 5.5 0 0 1-11 0z" />
      <path d="M16 8h2a2.5 2.5 0 0 1 0 5h-2M4 20h13" />
    </>
  ),
  snowflake: <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5M3.3 7l3.4.9M3.3 7l.9-3.4M20.7 17l-3.4-.9M20.7 17l-.9 3.4M3.3 17l.9 3.4M3.3 17l3.4-.9M20.7 7l-.9-3.4M20.7 7l-3.4.9" />,
  skull: (
    <>
      <path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 5 3.5 6v3h9v-3c2-1 3.5-3 3.5-6a8 8 0 0 0-8-8z" />
      <circle cx="9" cy="11" r="1.6" />
      <circle cx="15" cy="11" r="1.6" />
      <path d="M10.5 20v-2M13.5 20v-2M12 14l-1 2h2z" />
    </>
  ),
  crack: (
    <>
      <path d="M5 4h14v16H5z" />
      <path d="M12 4l-2 5 3 2-2.5 4 2 5" />
    </>
  ),
};

/** A status symbol (players/03), stroke 2, in the text colour (the ring sets its tone's colour). */
export function StatusIcon({ name, size = 24 }: { name: StatusSymbolName; size?: number }) {
  return (
    <Svg size={size} stroke="2">
      {STATUS_PATHS[name]}
    </Svg>
  );
}
