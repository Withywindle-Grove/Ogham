// The app's name and voice, in one place (docs/09-decisions-log.md, 2026-10-23). Every screen, the page title,
// the installed app's name and the email settings read from here, so a rename is a one-file change.
// The name never goes into database names, ids, code identifiers, the repo name or the pack format.
// The Supabase dashboard's email sender name and templates are set by hand from these values (docs/testing.md).

/** A one-line saying Ogham may offer on empty screens and the loading screen (never during play). */
export interface Saying {
  text: string;
  /** Historical sayings are attributed honestly; table sayings are original, never quoted from games or books. */
  kind: 'historical' | 'table';
  source?: string;
}

const PERSONA = 'Ogham';

export const BRAND = {
  /** What the app is called, on screen and in the page title. */
  appName: 'Tome',
  /** The installed app's name under its icon. */
  shortName: 'Tome',
  /** The app's persona: an archivist and teacher (docs/06-screens-and-design.md, Voice). */
  persona: PERSONA,
  /** Who sign-in emails come from. */
  emailSenderName: PERSONA,
  /** One line under the name (ruled 2026-10-23; the words 2026-11-07, Francis's placeholder): sign-in, link previews,
   * the installed app's description and the email footer; never on in-game screens. */
  tagline: 'Here beginneth a tale of high adventure.',
  /** What Ogham says when the GM ends a live session (M8). */
  sessionSignOff: 'Until the returning night.',
  /** One rotates on empty screens (M4 step 6) and the loading screen (style release). */
  sayings: [
    { kind: 'historical', text: 'Honour the gods, do no evil, and practise courage.', source: 'the druid triad, recorded by Diogenes Laertius' },
    { kind: 'historical', text: "It's a long road that has no turning.", source: 'Irish proverb' },
    { kind: 'historical', text: "People live in each other's shelter.", source: 'Irish proverb' },
    { kind: 'historical', text: "There's no hearth like your own hearth.", source: 'Irish proverb' },
    { kind: 'historical', text: `The druids would not write their lore; ${PERSONA} keeps it for you.`, source: "after Caesar's account of the druids" },
    { kind: 'table', text: 'Every torch counts.' },
    { kind: 'table', text: 'The ten-foot pole is never wasted.' },
    { kind: 'table', text: 'Check the ceiling.' },
    { kind: 'table', text: 'Running away is a plan.' },
    { kind: 'table', text: `The dice remember nothing. ${PERSONA} remembers everything.` },
    { kind: 'table', text: 'A closed door is a question.' },
    { kind: 'table', text: 'Count your rations before you count your gold.' },
    { kind: 'table', text: 'The map is not the dungeon.' },
  ] as readonly Saying[],
  /** The dictionary entry for the loading screen (2026-11-07, mockup brand/01-tome; no phonetics). The word in italics
   * is `dictionaryItalic`. */
  dictionaryEntry: 'tome, noun, from the Greek tomos, one volume of a work: a large and weighty book. What the table remembers.',
  dictionaryItalic: 'tomos',
} as const;
