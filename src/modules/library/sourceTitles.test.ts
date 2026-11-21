// A pack's sources map (07 `meta.sourceTitles`, G-212; creation retest 4 T6). Invented books only. Purposes:
//   The app never prints a bare code: a source starting with a code reads "<the book's title>, <page>", the longest
//   code winning ("Vol. 10" before "Vol. 1"), the page tidied ("p96" → "p. 96"); a code with spaces or an apostrophe
//   works; the key "" names the pack's own book for a bare page; a source no code matches (a note) stays as written.
//   Every `source` in an entry's data is titled, nested ones and class-keyed ones too, and nothing else changes.
//   The "pack, page" line doesn't repeat the pack's name when the source already names its book.
import { describe, expect, it } from 'vitest';
import { settingFrom } from '../../app/campaignSetting.ts';
import type { CampaignPack } from './campaignPacks.ts';
import { packAndPage, readSourceTitles, tidyPage, titledData, titledSource } from './sourceTitles.ts';

const titles = readSourceTitles({
  sourceTitles: { i3: 'The Heron Almanac, issue 3', 'Vol. 1': 'Fen Lore, volume 1', 'Vol. 10': 'Fen Lore, volume 10', "Warden's Book": "The Warden's Book", '': 'Reed Rules', bad: 4 },
});

describe('meta.sourceTitles (G-212)', () => {
  it('reads text titles only', () => {
    expect(new Set(Object.keys(titles))).toEqual(new Set(['', 'Vol. 1', 'Vol. 10', 'i3', "Warden's Book"]));
    expect(readSourceTitles({})).toEqual({});
    expect(readSourceTitles({ sourceTitles: 'i3' })).toEqual({});
  });

  it('turns a code into the book\'s title and tidies the page', () => {
    expect(titledSource('i3 p. 8', titles)).toBe('The Heron Almanac, issue 3, p. 8');
    expect(titledSource('i3 p96', titles)).toBe('The Heron Almanac, issue 3, p. 96');
    expect(titledSource('i3 p.116', titles)).toBe('The Heron Almanac, issue 3, p. 116');
    expect(titledSource('i3 pp. 22–23', titles)).toBe('The Heron Almanac, issue 3, pp. 22–23');
    expect(titledSource('i3', titles)).toBe('The Heron Almanac, issue 3');
    expect(titledSource('Vol. 10 p. 4', titles)).toBe('Fen Lore, volume 10, p. 4');
    expect(titledSource('Vol. 1 p. 4', titles)).toBe('Fen Lore, volume 1, p. 4');
    expect(titledSource("Warden's Book p. 2", titles)).toBe("The Warden's Book, p. 2");
    expect(titledSource('i3 p. 8; Vol. 1 p. 2', titles)).toBe('The Heron Almanac, issue 3, p. 8; Fen Lore, volume 1, p. 2');
  });

  it('a bare page is the pack\'s own book; a note no code matches stays as written', () => {
    expect(titledSource('p. 12', titles)).toBe('Reed Rules, p. 12');
    expect(titledSource('p12', titles)).toBe('Reed Rules, p. 12');
    expect(titledSource('classes[].progression', titles)).toBe('classes[].progression');
    expect(titledSource('i30 p. 1', titles)).toBe('i30 p. 1');
    expect(titledSource('p. 12', {})).toBe('p. 12');
    expect(tidyPage('pp 3–4')).toBe('pp. 3–4');
  });

  it('titles every source in an entry\'s data, and leaves the rest alone', () => {
    const data = { id: 'eel', source: 'i3 p. 8', notes: 'i3 p. 8 stays in notes', entries: [{ id: 'a', source: 'p. 2' }], byClass: { source: { warden: 'Vol. 1 p. 3' } } };
    const titled = titledData(data, titles);
    expect(titled).toEqual({ id: 'eel', source: 'The Heron Almanac, issue 3, p. 8', notes: 'i3 p. 8 stays in notes', entries: [{ id: 'a', source: 'Reed Rules, p. 2' }], byClass: { source: { warden: 'Fen Lore, volume 1, p. 3' } } });
    const plain = { id: 'x', source: 'classes[].progression' };
    expect(titledData(plain, titles)).toBe(plain);
    expect(titledData(data, {})).toBe(data);
  });

  it('the pack, page line doesn\'t say the pack twice', () => {
    expect(packAndPage('Heron', 'The Heron Almanac, issue 3, p. 8', titles)).toBe('The Heron Almanac, issue 3, p. 8');
    expect(packAndPage('Heron', 'p. 8', titles)).toBe('Heron, p. 8');
    expect(packAndPage('Heron', '', titles)).toBe('Heron');
    expect(packAndPage('Heron', 'Reed Rules, p. 2', titles)).toBe('Reed Rules, p. 2');
  });
});

describe("the campaign's setting (T6)", () => {
  // Purpose: every entry of a pack with a sources map reaches the screens with its source titled, so no screen prints
  // a code; another pack's entries are left as written.
  it("titles the sources of a pack with a map, and only that pack's", () => {
    const link = (packId: string, priority: number, sourceTitles?: Record<string, string>): CampaignPack => ({
      id: `link-${packId}`, campaignId: 'c', packId, name: packId, shortName: packId, version: '1', kind: 'setting', optionChoices: {}, priority, overrides: {}, campaignHomebrew: false, ...(sourceTitles ? { sourceTitles } : {}),
    });
    const setting = settingFrom(
      [link('heron', 2, { i3: 'The Heron Almanac, issue 3' }), link('fen', 1)],
      [
        { packId: 'heron', kind: 'class', packEntryId: 'reed-warden', name: 'Reed Warden', data: { id: 'reed-warden', name: 'Reed Warden', source: 'i3 p. 8' } },
        { packId: 'fen', kind: 'class', packEntryId: 'lantern-warden', name: 'Lantern Warden', data: { id: 'lantern-warden', name: 'Lantern Warden', source: 'i3 p. 9' } },
      ],
      {},
    );
    expect(setting.all.find((e) => e.packEntryId === 'reed-warden')?.data.source).toBe('The Heron Almanac, issue 3, p. 8');
    expect(setting.all.find((e) => e.packEntryId === 'lantern-warden')?.data.source).toBe('i3 p. 9');
  });
});
