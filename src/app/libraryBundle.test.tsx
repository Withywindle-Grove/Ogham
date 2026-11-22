// @vitest-environment jsdom
// A pack arrives with its pictures in one bundled file (plan scene-point-to-point B14; p2p-27; mockup december/24,
// frames IM1 and IM1b, approved 2026-11-18 with fixes). Invented pack and places only. In plain words:
//   * every picture found: no panel, the toast "Saltwick Island imported, with 2 maps.", the pack's row in the library,
//     and each picture kept with the pack;
//   * a picture missing: the pack is imported all the same, and a panel names the missing picture by its path in the
//     bundle with what it costs; "Add it…" takes the file, and with none left the panel gives way to the toast;
//   * a pack with no pictures (a plain file) imports as before.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { makeZip } from '../testing/makeZip.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { LibraryScreen } from './LibraryScreen.tsx';

const saltwick = JSON.stringify({
  format: 'tabletop-pack',
  formatVersion: 2,
  meta: { id: 'saltwick-island', name: 'Saltwick Island', kind: 'adventure' },
  locations: [
    { id: 'drowned-harbour', name: 'The Drowned Harbour' },
    { id: 'shingle-beach', name: 'The Shingle Beach' },
  ],
  images: [
    { id: 'map-harbour', file: 'images/map-harbour.png', type: 'map', title: 'The Drowned Harbour', alt: 'A harbour, half under water.', locationIds: ['drowned-harbour'] },
    { id: 'map-beach', file: 'images/map-beach.png', type: 'map', title: 'The Shingle Beach', alt: 'A long beach of grey stones.', locationIds: ['shingle-beach'] },
  ],
});
const bundle = async (files: Record<string, string>) => new File([(await makeZip({ 'saltwick-island.pack.json': saltwick, ...files })) as BlobPart], 'saltwick-island.zip');

describe('importing a pack with its pictures in one bundled file (B14)', () => {
  let world: FakeWorld;
  let gm: string;

  beforeEach(() => {
    world = createFakeDb();
    gm = world.addPerson('priya@lantern.example', 'Priya');
    world.signInAs(gm);
    // The browser's picture reader: every picture here already fits, so it goes as it came.
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1200, height: 800, close: () => undefined })));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /** Picks the file under "Import a file" and saves the preview. */
  const importFile = async (file: File) => {
    const user = userEvent.setup();
    render(
      <ToastHost>
        <LibraryScreen db={world.db} user={{ id: gm, roles: {} }} onBack={() => {}} />
      </ToastHost>,
    );
    await user.upload(await screen.findByLabelText('Import a file'), file);
    await user.click(await screen.findByRole('button', { name: 'Save to your library' }));
    return user;
  };
  const kept = () => [...world.files.keys()].sort();
  const packId = () => String(world.tables.packs.find((p) => p.name === 'Saltwick Island')?.id);

  // Purpose (IM1 with its fix): with every picture found there is no panel, only the toast and the pack's row.
  it('every picture found: the toast says so, no panel, and each picture is kept with the pack', async () => {
    await importFile(await bundle({ 'images/map-harbour.png': 'harbour', 'images/map-beach.png': 'beach' }));
    await screen.findByText('Saltwick Island imported, with 2 maps.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(kept()).toEqual([`pack-files/${packId()}/map-beach`, `pack-files/${packId()}/map-harbour`]);
    await waitFor(() => expect(document.querySelector('.pack-row')?.textContent).toContain('Saltwick Island'));
  });

  // Purpose (IM1b): a missing picture is named by its path with its one consequence; the pack is still imported; "Add
  // it…" takes the file, and the panel gives way to the toast.
  it('a picture missing: the panel names it, the pack is imported, and "Add it…" adds it', async () => {
    const user = await importFile(await bundle({ 'images/map-harbour.png': 'harbour' }));
    const panel = await screen.findByRole('dialog', { name: 'Imported: Saltwick Island' });
    expect(within(panel).getByText('Imported')).toBeTruthy();
    expect(within(panel).getByText('saltwick-island.zip')).toBeTruthy();
    expect(within(panel).getByText('The pack: 2 places, 2 maps.')).toBeTruthy();
    expect(within(panel).getByText('1 map: The Drowned Harbour.')).toBeTruthy();
    expect(within(panel).getByText('1 picture missing: images/map-beach.png')).toBeTruthy();
    expect(within(panel).getByText('The Shingle Beach has no map until this picture is added.')).toBeTruthy();
    expect(world.tables.packs.some((p) => p.name === 'Saltwick Island')).toBe(true);
    expect(kept()).toEqual([`pack-files/${packId()}/map-harbour`]);
    // One accent in the sheet, never disabled.
    expect(within(panel).getByRole('button', { name: 'Add it…' }).className).toContain('button-primary');
    await user.upload(within(panel).getByLabelText('Choose the missing picture: images/map-beach.png'), new File(['beach'], 'IMG_0042.png', { type: 'image/png' }));
    await screen.findByText('Saltwick Island imported, with 2 maps.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(kept()).toEqual([`pack-files/${packId()}/map-beach`, `pack-files/${packId()}/map-harbour`]);
  });

  // Purpose: the ✕ closes the panel; the pack stays imported, and the picture can still be picked by hand at its place.
  it('the ✕ closes the panel and the pack stays', async () => {
    const user = await importFile(await bundle({}));
    const panel = await screen.findByRole('dialog', { name: 'Imported: Saltwick Island' });
    expect(within(panel).getByRole('button', { name: 'Add them…' })).toBeTruthy();
    expect(within(panel).getByText('Picture missing: images/map-harbour.png')).toBeTruthy();
    await user.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(world.tables.packs.some((p) => p.name === 'Saltwick Island')).toBe(true);
  });

  // Purpose: a pack with no pictures imports as it always has: the same words, no panel, nothing kept.
  it('a plain pack file imports as before', async () => {
    await importFile(new File([saltwick], 'saltwick-island.pack.json'));
    await screen.findByText('Saltwick Island was added to your library.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(kept()).toEqual([]);
  });
});
