// @vitest-environment jsdom
// The Player tab's own Armour class and Attack sheets keep their source line with the campaign it was read for (the
// review of #1061, nit 3). Purpose:
//   When the character on screen moves to another campaign, the Attack sheet shows no source line until that
//   campaign's setting is read, never the first campaign's pack.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../../core/commands.ts';
import type { MyCharacter } from '../../core/myCharacters.ts';
import type { FieldDefinition } from '../../modules/characters/fields.ts';
import type { AttackFigures } from '../../modules/characters/sheetCombat.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import { loadCampaignSetting, type CampaignSetting } from '../campaignSetting.ts';
import { characterFigures } from '../fromSetting.ts';
import { PlayerVitals } from './PlayerVitals.tsx';

vi.mock('../services.ts', async () => {
  const { createAppRegistry } = await import('../commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

vi.mock('../campaignSetting.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../campaignSetting.ts')>()),
  loadCampaignSetting: vi.fn(),
}));

afterEach(() => cleanup());

const user: CurrentUser = { id: 'person-1', roles: {} };

/** A setting whose class and rules set both come from "Fen sample". */
const fenSetting = {
  packs: [{ packId: 'pack-fen', shortName: 'Fen sample' }],
  all: [
    { kind: 'rulesSet', packId: 'pack-fen', packEntryId: 'fen-rules', data: {} },
    { kind: 'class', packId: 'pack-fen', packEntryId: 'lantern-warden', data: {} },
  ],
} as unknown as CampaignSetting;

const attackField: FieldDefinition = { id: 'field-attack', campaignId: 'campaign-a', key: 'attack', label: 'Attack', type: 'text', choices: [], group: 'Combat', order: 1, showOnCard: false, hidden: false, fill: 'attack', required: false, from: null };

function wren(campaignId: string): MyCharacter {
  return {
    id: 'actor-wren', campaignId, ownerType: 'user', ownerUserId: user.id, approval: 'approved', name: 'Wren', level: 1, hpCurrent: 4, hpMax: 6,
    backstory: '', reviewNote: '', reviewSections: [], active: true, archived: false, fields: { attack: '+1' }, portraitAssetId: null, companyId: null,
    classRef: 'lantern-warden', raceRef: null, creation: null, editedFields: [], spellBook: null, weaponSkills: null,
  } as MyCharacter;
}

const attack: AttackFigures = { direction: 'ascending', label: 'Attack', value: '+1', caption: '', rows: [], toHit: null, ending: '' };

function vitals(character: MyCharacter) {
  const world = createFakeDb();
  return <PlayerVitals db={world.db} user={user} character={character} fieldDefs={[attackField]} figures={characterFigures(null, character, [attackField])} attack={attack} worn={[]} acOverride={null} downAt={null} />;
}

/** Opens the Attack sheet and returns its last line's text, then closes it. */
async function attackSheetFoot(): Promise<string | null> {
  const clicker = userEvent.setup();
  await clicker.click(within(screen.getByRole('region', { name: 'Vitals' })).getByRole('button', { name: /^Attack \+1: / }));
  const sheet = (await screen.findAllByRole('dialog')).at(-1)!;
  const foot = sheet.querySelector('.breakdown-sheet')?.lastElementChild?.textContent ?? null;
  await clicker.click(within(sheet).getByRole('button', { name: /close/i }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  return foot;
}

describe("the Player tab's source line follows the campaign it was read for (#1061, nit 3)", () => {
  it("shows no source line, never the old campaign's pack, while the new campaign's setting is read", async () => {
    vi.mocked(loadCampaignSetting).mockImplementation((_db, _user, campaignId) => (campaignId === 'campaign-a' ? Promise.resolve(fenSetting) : new Promise(() => undefined)));
    const { rerender } = render(vitals(wren('campaign-a')));
    await waitFor(() => expect(vi.mocked(loadCampaignSetting)).toHaveBeenCalledWith(expect.anything(), user.id, 'campaign-a'));
    expect(await attackSheetFoot()).toBe('From your setting: Fen sample');
    rerender(vitals(wren('campaign-b')));
    await waitFor(() => expect(vi.mocked(loadCampaignSetting)).toHaveBeenCalledWith(expect.anything(), user.id, 'campaign-b'));
    expect(await attackSheetFoot()).not.toContain('From your setting');
  });
});
