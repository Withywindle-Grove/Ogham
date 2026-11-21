// Words the app saves in their old format (the sweep's review, #561): a patch's name, a draft roll's label and a
// watch choice are stored and matched against what's stored (in the database and its tests), so they keep " · ".
// Only what a person reads changes: shown through here, the middle dot reads as a comma (words rule 11). Data from
// before the sweep reads the same way.

/**
 * The separator those stored strings keep, exactly as before the sweep. The one place the app writes a middle dot,
 * never shown as is (the no-dot test leaves this file out).
 */
export const STORED_SEPARATOR = ' · ';

/** A stored string as a person reads it: " · " becomes ", ". Pure. */
export const shownWords = (text: string): string => text.replace(/ · /g, ', ');

/** A library entry's name as shown: a patch's name is the app's own (stored with " · "); a pack's own names show as written. */
export const shownEntryName = (entry: { kind: string; name: string }): string => (entry.kind === 'patch' ? shownWords(entry.name) : entry.name);
