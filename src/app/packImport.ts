import type { ChangeEvent } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { loadPackEntries, type LibraryPack } from '../modules/library/library.ts';
import { isZip, readBundle, type PackBundle } from '../modules/library/packBundle.ts';
import { comparePacks, type ReadPack } from '../modules/library/packFile.ts';
import { readStoredMap, type PackMap } from '../modules/library/packMaps.ts';
import { readPackFile } from '../modules/library/packMarkdown.ts';
import { addPackPicture } from '../modules/library/packPictures.ts';
import { PhotoError, shrinkMap } from './image.ts';
import type { Preview } from './PackPreview.tsx';
import { registry } from './services.ts';

// Choosing a pack file, shared by the Rules library, Campaign → Setting rules and New campaign: read it,
// say what's wrong in plain words, and (for an update) compare it with what's in the library now.
//
// A pack may arrive with its pictures in one bundled file, a .zip (B14, p2p-27; mockup december/24, IM1 and IM1b,
// approved 2026-11-18 with fixes): the pack file inside it is read as any pack file is, and once the pack is saved
// each map's picture is kept with the pack (`savePackPictures`). A picture the bundle doesn't hold is named, and the
// pack still imports. A pack with no pictures imports as before.

/** The bundle a pack came in: the .zip's own name, and its pictures by the path the pack names them with. */
export interface ChosenBundle {
  name: string;
  picture: PackBundle['picture'];
}

export type ChosenPack = { ok: true; pack: ReadPack; bundle?: ChosenBundle } | { ok: false; message: string };

/**
 * Reads the file picked in a file input, or null if none was picked. The input is cleared either way,
 * so picking the same file again (after fixing it) reads it again. A .zip is known by how it starts, not by its name.
 */
export async function readChosenPack(event: ChangeEvent<HTMLInputElement>): Promise<ChosenPack | null> {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isZip(bytes)) {
    const read = readPackFile(file.name, await file.text());
    return read.ok ? { ok: true, pack: read.pack } : { ok: false, message: read.message };
  }
  const bundle = await readBundle(bytes);
  if (!bundle.ok) return bundle;
  const read = readPackFile(bundle.bundle.fileName, bundle.bundle.text);
  return read.ok ? { ok: true, pack: read.pack, bundle: { name: file.name, picture: bundle.bundle.picture } } : { ok: false, message: read.message };
}

/** What updating a library pack from this file will change, or a message if the library couldn't be read. */
export async function updatePreview(db: Db, target: LibraryPack, pack: ReadPack): Promise<{ ok: true; preview: Preview } | { ok: false; message: string }> {
  const before = await loadPackEntries(db, target.id);
  if (!before) return { ok: false, message: "Couldn't load what's in your library now. Try again." };
  return { ok: true, preview: { mode: 'update', target, pack, diff: comparePacks(before, pack.entries) } };
}

/** A bundle's maps once the pack is saved: those whose picture is kept with the pack, and those still without one. */
export interface PackPictures {
  found: PackMap[];
  missing: PackMap[];
}

/** The pack in the library the pictures are kept with: its id and whose it is (only its owner may keep one). */
export type SavedPack = Pick<LibraryPack, 'id' | 'ownerUserId'>;

const PICTURE_TYPES: Record<string, string> = { png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

/**
 * Keeps one map's picture with the pack: made smaller as a place's map is (mc-32), then stored (library.addPicture).
 * Gives back what went wrong in plain words, or null when it is kept.
 */
export async function savePicture(db: Db, user: CurrentUser, pack: SavedPack, map: Pick<PackMap, 'id'>, file: Blob, shrink: (file: Blob) => Promise<Blob> = shrinkMap): Promise<string | null> {
  let image: Blob;
  try {
    image = await shrink(file);
  } catch (problem) {
    return problem instanceof PhotoError ? problem.message : "Couldn't read that picture. Try a JPEG or PNG.";
  }
  const saved = await runCommand(registry, db, user, addPackPicture, { packId: pack.id, ownerUserId: pack.ownerUserId, mapId: map.id, image });
  return saved.ok ? null : saved.message;
}

/**
 * Keeps the bundle's pictures with the saved pack, one for each map the pack names. A map whose picture the bundle
 * doesn't hold, or holds in a form that can't be read or saved, is `missing`: the pack is imported all the same.
 */
export async function savePackPictures(db: Db, user: CurrentUser, saved: SavedPack, pack: ReadPack, bundle: ChosenBundle, shrink?: (file: Blob) => Promise<Blob>): Promise<PackPictures> {
  const pictures: PackPictures = { found: [], missing: [] };
  for (const map of pack.entries.filter((entry) => entry.kind === 'map').map(readStoredMap)) {
    const read = bundle.picture(map.file);
    let kept = false;
    if (read) {
      try {
        const type = PICTURE_TYPES[map.file.split('.').pop()?.toLowerCase() ?? ''] ?? 'image/jpeg';
        kept = (await savePicture(db, user, saved, map, new Blob([(await read()) as BlobPart], { type }), shrink)) === null;
      } catch {
        // The .zip couldn't give this picture: named as missing, and it can be added by hand.
      }
    }
    (kept ? pictures.found : pictures.missing).push(map);
  }
  return pictures;
}

/** The toast once a bundle is in with every picture found (IM1): "Saltwick Island imported, with 2 maps." */
export const importedWords = (name: string, maps: number, updated = false): string => `${name} ${updated ? 'updated' : 'imported'}, with ${maps === 1 ? '1 map' : `${maps} maps`}.`;

/** What a missing picture costs, in words (IM1b): "The Shingle Beach has no map until this picture is added." */
export function missingWords(map: PackMap, pack: Pick<ReadPack, 'entries'>): string {
  const names = map.locationIds.flatMap((id) => pack.entries.find((entry) => entry.kind === 'location' && entry.packEntryId === id)?.name ?? []);
  if (names.length === 0) return `${map.title} has no picture until this one is added.`;
  // A map of many places names the first three: "A, B, C and 12 more".
  const shown = names.length > 4 ? [...names.slice(0, 3), `${names.length - 3} more`] : names;
  const list = shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`;
  return `${list} ${names.length === 1 ? 'has' : 'have'} no map until this picture is added.`;
}

/**
 * Which missing map each picked file is for: by its file name, whatever the folder or the case. One file picked for
 * the one map missing is taken whatever its name.
 */
export function matchPicked<F extends { name: string }>(missing: readonly PackMap[], files: readonly F[]): { map: PackMap; file: F }[] {
  if (missing.length === 1 && files.length === 1) return [{ map: missing[0]!, file: files[0]! }];
  const base = (path: string) => path.replaceAll('\\', '/').split('/').pop()!.toLowerCase();
  return missing.flatMap((map) => {
    const file = files.find((picked) => base(picked.name) === base(map.file));
    return file ? [{ map, file }] : [];
  });
}
