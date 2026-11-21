import type { ChangeEvent } from 'react';
import type { Db } from '../core/supabase.ts';
import { loadPackEntries, type LibraryPack } from '../modules/library/library.ts';
import { comparePacks, type ReadPack } from '../modules/library/packFile.ts';
import { readPackFile } from '../modules/library/packMarkdown.ts';
import type { Preview } from './PackPreview.tsx';

// Choosing a pack file, shared by the Rules library, Campaign → Setting rules and New campaign: read it,
// say what's wrong in plain words, and (for an update) compare it with what's in the library now.

export type ChosenPack = { ok: true; pack: ReadPack } | { ok: false; message: string };

/**
 * Reads the file picked in a file input, or null if none was picked. The input is cleared either way,
 * so picking the same file again (after fixing it) reads it again.
 */
export async function readChosenPack(event: ChangeEvent<HTMLInputElement>): Promise<ChosenPack | null> {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return null;
  const read = readPackFile(file.name, await file.text());
  return read.ok ? { ok: true, pack: read.pack } : { ok: false, message: read.message };
}

/** What updating a library pack from this file will change, or a message if the library couldn't be read. */
export async function updatePreview(db: Db, target: LibraryPack, pack: ReadPack): Promise<{ ok: true; preview: Preview } | { ok: false; message: string }> {
  const before = await loadPackEntries(db, target.id);
  if (!before) return { ok: false, message: "Couldn't load what's in your library now. Try again." };
  return { ok: true, preview: { mode: 'update', target, pack, diff: comparePacks(before, pack.entries) } };
}
