// No light (M5 step 10; docs/05 "Expeditions, time and light"; ruled 2026-10-30, DG7, S2-7; the screen dim was
// removed at the M5 gate, R3 audit item 8, 2026-11-01). On the Player screen (on its Player tab inside the notices box,
// row C1, tfn-2; on Pack and Magic above the tab; on Scene in the prompt slot): when the player's group
// has no light (in a turn-by-turn mode, or a day-by-day one while the GM's Travelling in darkness is on), the
// reminder "No light" with its one-tap "Light a torch (N left)" while the dark lasts. The screen itself never darkens.
import { useEffect, useState } from 'react';
import { loadCampaignSettings } from '../core/campaignCommands.ts';
import { groupOf } from '../core/partyGroups.ts';
import type { Db } from '../core/supabase.ts';
import { inDarkness, lightButtonWords } from '../modules/expedition/darkness.ts';
import { loadGroupMembers } from '../modules/expedition/groupPlay.ts';
import { lightable, loadLights, secondsLeft, type LightOption } from '../modules/expedition/lightPlay.ts';
import { FALLBACK_MODES, modeById, readExploration } from '../modules/expedition/modes.ts';
import { loadScene } from '../modules/expedition/play.ts';
import type { CampaignSetting } from './campaignSetting.ts';
import type { CharacterLightView } from './LightSection.tsx';
import './Darkness.css';

/** Whether the character's group is in the dark now (null until known), read again whenever `refresh` changes. */
function useInDarkness(db: Db, campaignId: string, characterId: string, setting: CampaignSetting | null, refresh: number): boolean | null {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    // The modes come from the setting rules: until they're read, nothing is decided (no reminder on a guess).
    if (!setting) return;
    let current = true;
    void Promise.all([loadScene(db, campaignId), loadCampaignSettings(db, campaignId), loadLights(db, campaignId), loadGroupMembers(db, campaignId)]).then(
      ([scene, settings, lights, members]) => {
        if (!current) return;
        // Anything unreadable: no darkness (never remind on a guess).
        if (!scene || !lights || !members) return setDark(false);
        const expedition = scene.expedition;
        const exploration = readExploration(setting.rulesSets);
        const mode = expedition ? (modeById(exploration.modes, expedition.mode) ?? modeById(FALLBACK_MODES, expedition.mode) ?? FALLBACK_MODES[0]!) : null;
        const now = scene.clock?.seconds ?? 0;
        const mine = groupOf(members, characterId);
        const group = [characterId, ...[...members.entries()].filter(([id, n]) => n === mine && id !== characterId).map(([id]) => id)];
        const litBy = lights.filter((l) => l.litAt !== null && (secondsLeft(l, now) ?? 1) > 0).map((l) => l.actorId);
        const next = inDarkness({
          underWay: expedition !== null,
          pace: mode?.pace ?? null,
          travellingInDarkness: settings?.travellingInDarkness === true,
          group,
          litBy,
        });
        setDark(next);
      },
      () => current && setDark(false),
    );
    return () => {
      current = false;
    };
  }, [db, campaignId, characterId, setting, refresh]);
  return dark;
}

type DarknessProps = {
  db: Db;
  campaignId: string;
  characterId: string;
  /** Null: nothing is read (the rules not in yet, or a tab that shows its own reminder). */
  setting: CampaignSetting | null;
  light: CharacterLightView;
  /** Changes when something may have changed (the log's live updates: the GM's Next turn, a light lit). */
  refresh: number;
};

/** "No light" now: the first light this character's pack can light (null for none), and the act that lights it. */
export type NoLightView = { option: LightOption | null; words: string | null; lightIt: () => void };

/**
 * Whether "No light" stands for this character, and its one-tap light: null while the group has light or it isn't
 * known. The Player tab puts it in the notices box (row C1, tfn-2); the Pack and Magic tabs draw it as `NoLight`.
 */
export function useNoLight({ db, campaignId, characterId, setting, light, refresh }: DarknessProps): NoLightView | null {
  const dark = useInDarkness(db, campaignId, characterId, setting, refresh);
  if (dark !== true) return null;
  const option = lightable(light.options)[0] ?? null;
  return { option, words: lightButtonWords(option), lightIt: () => void (option && light.lightIt(option)) };
}

export function Darkness(props: DarknessProps) {
  const view = useNoLight(props);
  return view && <NoLight view={view} />;
}

/** "No light", with the one-tap light from this character's pack when there is one. */
export function NoLight({ view }: { view: NoLightView }) {
  const { option, words } = view;
  return (
    <section className="no-light" role="status" aria-label="No light">
      <p className="no-light__words">
        <span className="no-light__mark" aria-hidden="true">
          ●
        </span>
        {option ? 'No light' : 'No light, Nothing to light in your pack'}
      </p>
      {option && words && (
        <button type="button" className="button-secondary" onClick={view.lightIt}>
          {words}
        </button>
      )}
    </section>
  );
}
