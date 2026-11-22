// The GM's view as the player: the player-only pop-ups that open from inside a sheet (page 32, M3f2 and M3i, approved
// 2026-11-21; rows C15d and C15f of plans/test-feedback-2026-11-19.md), on the layout page only
// (`layout.html?as=gm&viewPopUps=activity|stay`, src/testing/layoutHarness.tsx). The real parts, in the view's context,
// with the GM signed in and invented rules, so the layout checks reach what a travel day or a town would open:
//   activity: a secret activity's sheet, its "Who acts?" chips and its Ask the GM ("Only Sam can send this request");
//   stay: Where you stay, and its Stay here ("Only Sam can choose where … stays").
import { ActivityButtons } from '../app/ActivityButtons.tsx';
import type { OpenCampaign } from '../app/Campaigns.tsx';
import { PlayerViewContext } from '../app/playerView.ts';
import { TownActions } from '../app/TownActions.tsx';
import type { TravelView } from '../app/travelView.ts';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { readExploration } from '../modules/expedition/modes.ts';
import { campaignUnits } from '../modules/expedition/play.ts';
import { ToastHost } from '../ui/ToastHost.tsx';

const CAMPAIGN: OpenCampaign = { id: 'view-popups', name: 'The Drowned Marches', role: 'gm', line: null }; // words: names
const WREN = 'Wren of the Lantern Wardens'; // words: names

/** Invented rules: a day-by-day mode with a budget, one open and one secret activity, each done by one of the group. */
const rules = {
  id: 'reed-rules',
  name: 'Reedwalk rules',
  time: { roundSeconds: 6, turnMinutes: 10, dayHours: 24 },
  exploration: {
    modes: [
      {
        id: 'roam',
        name: 'Roaming',
        step: { value: 1, unit: 'day' },
        procedure: [],
        checks: [],
        movement: { kind: 'budget', name: 'Leagues', unit: 'points', perDay: 'floor(speed / 5)' },
        terrainClasses: [{ id: 'soft', name: 'Soft going', cost: 2 }],
        terrain: [{ id: 'marsh', name: 'Marsh', class: 'soft' }],
        activities: [{ id: 'sing-low', name: 'Sing low', icon: 'search', cost: { budget: 1 }, chance: { abilityCheck: 'CHA' }, secret: true, who: 'one' }],
      },
    ],
  },
};
const exploration = readExploration([rules]);
const mode = exploration.modes.find((m) => m.id === 'roam')!;
// Wren and the lantern bearer are Sam's; Ash is the GM's own: the group the GM sees in "Who acts?".
const view = {
  expeditionId: 'view-trip',
  mode,
  rules: exploration,
  travel: mode.wild.travel!,
  day: 0,
  weatherTags: [],
  tags: new Map(),
  rows: new Map(),
  lost: new Map(),
  travellers: new Map([
    [
      1,
      [
        { id: 'wren', name: WREN, speed: 20, ownerUserId: 'sam' },
        { id: 'bree', name: 'Bree the Lantern Bearer of the Lower Sluices', speed: 20, ownerUserId: 'sam' }, // words: names
        { id: 'ash', name: 'Ash', speed: 20, ownerUserId: 'gm' },
      ],
    ],
  ]),
  gettingLost: { enabled: false },
  units: campaignUnits(null, [rules]),
  season: null,
  choices: {},
} as unknown as TravelView;

export function GmViewPopUpsLayoutPage({ state, db, gm }: { state: string; db: Db; gm: string }) {
  const user: CurrentUser = { id: gm, roles: { [CAMPAIGN.id]: 'gm' } };
  return (
    <PlayerViewContext.Provider value={{ player: 'Sam', character: WREN, goToWaiting: () => undefined }}>
      <ToastHost>
        <main className="gallery">
          {state === 'activity' ? (
            <ActivityButtons
              db={db}
              user={user}
              campaign={CAMPAIGN}
              group={1}
              view={view}
              row={{ total: 4, spent: 0, pending: null, forced: 0, terrainId: 'marsh' }}
              actor={{ id: 'wren', name: WREN, skills: new Set(), items: new Set() }}
              itemOf={() => null}
              onChanged={() => undefined}
            />
          ) : (
            <TownActions
              db={db}
              user={user}
              campaign={CAMPAIGN}
              town={{ group: 1, name: 'Quay Gate', places: [{ key: 'lodging:the lantern rest', name: 'The Lantern Rest', kind: 'lodging', open: true }] }} // words: names
              rules={null}
              setting={null}
              character={{ id: 'wren', name: WREN }}
              activities={[]}
              stepWords={(steps) => `${steps} parts of the day`}
              now={0}
              units={null}
            />
          )}
        </main>
      </ToastHost>
    </PlayerViewContext.Provider>
  );
}
