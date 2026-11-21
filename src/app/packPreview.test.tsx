// @vitest-environment jsdom
// The import preview (ruled A by Francis, 2026-11-03). Invented packs only. What it checks:
//   * a pack that needs another (`meta.requires`) is labelled "Overlay", whatever its meta.kind; a plain setting
//     stays "Setting";
//   * a rules or overlay pack's `locations` (07 G-58) are listed as text, with nothing said about them being left out;
//   * a pack's top-level `gmReference` (07 G-55) is counted as GM reference panels, not called an unknown part.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ClashPack } from '../modules/library/clashes.ts';
import { readPackJson } from '../modules/library/packFile.ts';
import { PackPreview } from './PackPreview.tsx';

afterEach(cleanup);

const show = (file: Record<string, unknown>, attached: ClashPack[] = []) => {
  const read = readPackJson(JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, ...file }));
  if (!read.ok) throw new Error(read.message);
  render(<PackPreview preview={{ mode: 'import', pack: read.pack }} busy={false} onSave={() => {}} onCancel={() => {}} attached={attached} />);
};
const classes = [{ id: 'lantern-warden', name: 'Lantern Warden' }];

describe('the import preview', () => {
  it('labels a pack with meta.requires "Overlay", even when its kind says homebrew or something unknown', () => {
    show({ meta: { name: 'Lantern Wardens', version: '0.1', kind: 'homebrew', requires: [{ packId: 'fen-rules' }] }, classes });
    expect(screen.getByText('Version 0.1, Overlay')).toBeTruthy();
    cleanup();
    show({ meta: { name: 'Bog Beasts', version: '0.1.0', kind: 'overlay', requires: [{ packId: 'fen-rules' }] }, classes });
    expect(screen.getByText('Version 0.1.0, Overlay')).toBeTruthy();
  });

  it('keeps "Setting" for a plain setting with no meta.requires', () => {
    show({ meta: { name: 'Fen Rules', version: '2', kind: 'setting' }, classes });
    expect(screen.getByText('Version 2, Setting')).toBeTruthy();
  });

  it('lists a pack\'s places as text, and doesn\'t say they were left out', () => {
    show({
      meta: { name: 'Lantern Wardens', kind: 'homebrew', requires: [{ packId: 'fen-rules' }] },
      classes,
      locations: [
        { id: 'the-reed-inn', name: 'The Reed Inn', type: 'building', playerView: { text: 'Smoke, eel stew and a low ceiling.' }, gm: { notes: 'The keeper fences stolen lanterns.' } },
        { id: 'the-old-weir', name: 'The Old Weir', type: 'area' },
      ],
    });
    expect(screen.getByText('Places, kept as text for now')).toBeTruthy();
    const inn = screen.getByText('The Reed Inn').closest('li');
    expect(inn?.textContent).toBe('The Reed Inn: Smoke, eel stew and a low ceiling.');
    expect(screen.getByText('The Old Weir').closest('li')?.textContent).toBe('The Old Weir');
    expect(screen.queryByText(/isn't a part/)).toBeNull();
    expect(screen.getByText(/2 places/)).toBeTruthy();
  });

  it('counts top-level GM reference panels and doesn\'t call them an unknown part', () => {
    show({ meta: { name: 'Lantern Wardens', kind: 'homebrew', requires: [{ packId: 'fen-rules' }] }, classes, gmReference: [{ id: 'lantern-lore', title: 'Lantern lore', entries: [{ heading: 'Wick', text: 'Burns blue.' }] }] });
    expect(screen.getByText(/1 GM reference panel\b/)).toBeTruthy();
    expect(screen.queryByText(/isn't a part/)).toBeNull();
  });

  const pearl = { id: 'marsh-pearl', name: 'Marsh pearl', category: 'gem' };
  const fenRules: ClashPack = { name: 'Fen rules', entries: [{ kind: 'item', packEntryId: 'marsh-pearl', name: 'Marsh pearl' }] };

  // Purpose: an item id shared with an attached pack is listed, with the line saying which copy wins.
  it('lists an item id shared with an attached pack, and says the pack on top wins', () => {
    show({ meta: { name: 'Fen gear extras', kind: 'homebrew' }, items: [pearl] }, [fenRules]);
    expect(screen.getByText('Same item id as an attached pack')).toBeTruthy();
    expect(screen.getByText('Marsh pearl (marsh-pearl), also in Fen rules')).toBeTruthy();
    expect(screen.getByText('The pack on top wins; the other copy stays one tap away in Rules.')).toBeTruthy();
  });

  // Purpose: with no shared id the block is not shown.
  it('shows no clash block when no item id is shared', () => {
    show({ meta: { name: 'Fen gear extras', kind: 'homebrew' }, items: [{ ...pearl, id: 'reed-lantern', name: 'Reed lantern' }] }, [fenRules]);
    expect(screen.queryByText('Same item id as an attached pack')).toBeNull();
  });
});
