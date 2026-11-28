// A pack's people (`npcs`; dec-3, town row W8): the importer keeps each as a GM-only library entry of kind `npc`,
// the person as the pack wrote it. Data only: no screen shows them yet. Invented people only.
import { describe, expect, it } from 'vitest';
import { packFile } from './exportPack.ts';
import { PACK_PARTS, PLAYER_FACING, playerFacingEntry, readPackJson } from './packFile.ts';

const WARDEN = {
  id: 'bh-npc-lantern-warden',
  name: 'Hobb the Lantern Warden',
  role: 'keeper of the quay lamps',
  locationId: 'bh-quay',
  playerView: { description: 'A thin man with a pole and a smoking lamp.' },
  gm: {
    leads: [
      { lead: 'Demeanour', text: 'Polite, tired, counts everything twice.' },
      { lead: 'Speech', text: 'Whispers, as if the lamps could hear.' },
      { lead: 'Desires', text: 'A night without the Bog lurker.' },
      { lead: 'In a fight', text: 'Swings the pole, then runs for the bell.' },
    ],
    lines: ['"Mind the third step; it bites."'],
  },
  statBlockId: 'bh-npc-lantern-warden-stats',
  source: 'p. 7',
};
const pack = (npcs: unknown[]) => ({
  format: 'tabletop-pack',
  formatVersion: 3,
  meta: { name: 'Brackwater people', version: '0.1', kind: 'adventure' },
  locations: [{ id: 'bh-quay', name: 'The quay', type: 'area' }],
  npcs,
});

describe('importing a pack’s people', () => {
  // Purpose: the importer keeps each person as an entry of kind `npc`, named by their name, with every field the pack
  // wrote (their leads and lines included) kept as data, and no warning that `npcs` is unknown.
  it('keeps each person as an `npc` entry, with their leads and lines as written', () => {
    const read = readPackJson(JSON.stringify(pack([WARDEN])));
    if (!read.ok) throw new Error(read.message);
    const people = read.pack.entries.filter((e) => e.kind === 'npc');
    expect(people).toEqual([{ kind: 'npc', packEntryId: WARDEN.id, name: WARDEN.name, data: WARDEN }]);
    expect(read.pack.counts.npc).toBe(1);
    expect(read.pack.warnings.join(' ')).not.toContain(`"npcs" isn't a part`);
    expect(PACK_PARTS.npcs).toBe('npc');
  });

  // Purpose (dec5-gaps F, #192; dg-10): what a person carries, `holds`, is kept on her entry as written, every line
  // with its itemId or itemRef, qty and note, so the GM's device reads it from her GM-only entry.
  it('keeps a person’s holds as written', () => {
    const holds = [{ itemId: 'bh-wardens-lantern', note: 'A lantern on a pole' }, { itemRef: 'river-rules:oil-flask', qty: 999, note: 'In a crate' }];
    const read = readPackJson(JSON.stringify(pack([{ ...WARDEN, holds }])));
    if (!read.ok) throw new Error(read.message);
    expect((read.pack.entries.find((e) => e.kind === 'npc')?.data as { holds?: unknown }).holds).toEqual(holds);
    expect(read.pack.warnings.join(' ')).not.toContain('holds');
  });

  // Purpose: a person with no id is skipped and said, like any other entry; one with no name is named by their id.
  it('skips a person with no id and names a nameless one by their id', () => {
    const read = readPackJson(JSON.stringify(pack([{ name: 'Nobody' }, { id: 'bh-npc-mute' }])));
    if (!read.ok) throw new Error(read.message);
    expect(read.pack.problems).toEqual(['npcs: entry 1 has no id; skipped.']);
    expect(read.pack.entries.filter((e) => e.kind === 'npc').map((e) => e.name)).toEqual(['bh-npc-mute']);
  });

  // Purpose: hidden means hidden: a person is the GM's alone, never a player-facing kind, whatever the entry says.
  it('is never player-facing', () => {
    expect(PLAYER_FACING).not.toContain('npc');
    expect(playerFacingEntry('npc', { ...WARDEN, gmOnly: false })).toBe(false);
  });

  // Purpose: exporting the pack writes its people back under `npcs`, as they were read.
  it('exports people back as `npcs`', () => {
    const read = readPackJson(JSON.stringify(pack([WARDEN])));
    if (!read.ok) throw new Error(read.message);
    const { file } = packFile({ name: 'Brackwater people', version: '0.1', kind: 'adventure' }, read.pack.entries);
    expect(file.npcs).toEqual([WARDEN]);
  });
});
