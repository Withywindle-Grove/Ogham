// The character overview (docs/06 "The character overview", Components; ruled M5-6, 2026-10-25): one popup for any
// character, opened by a tap in the marching order (and later the party, cards and combat), showing only what this
// viewer may see. HP (per "Show each other's HP"; always to the GM and the character's own player), load and
// speed, the light and its time left with Keep lit (05: the switch lives here; the owner or the GM), and what's at
// hand; and (M5 step 9) every status with how it ends, tap one for its details, + Status for whoever may. Marching
// moves (join the row ahead, a row of their own) come from whoever opened it.
import { useEffect, useMemo, useState } from 'react';
import { encumbranceModeOf } from '../core/campaignSettings.ts';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { leftWords, lightState, mayLight, secondsLeft } from '../modules/expedition/lightPlay.ts';
import { carriedLoad, toLoadLine, wornArmour, type CarriedLoad } from '../modules/inventory/encumbrance.ts';
import { loadTreasureSwitch, type TreasureSwitch } from '../modules/inventory/treasureSwitch.ts';
import { atHandLines, isSeparate } from '../modules/inventory/packView.ts';
import { hasModeButton, modeLine, modeState, weaponModesOf } from '../modules/inventory/weaponModes.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';

/**
 * A weapon's mode in use for the GM's list (ah-3), or nothing for a weapon without a mode button. Read from the item
 * as the campaign has it now (lineInPlay: a mode a pack update added reaches a bow already owned; F27).
 */
function modeWords(line: InventoryLine, lines: readonly InventoryLine[], setting: CampaignSetting | null): string {
  const modes = weaponModesOf(lineInPlay(setting, line).details);
  return hasModeButton(modes) ? modeLine(modeState(modes, line.modeId ?? null, lines, line.actorId)) : '';
}
import { Dialog } from '../ui/Dialog.tsx';
import { LightSymbol } from '../ui/parts.tsx';
import { lineInPlay, type CampaignSetting } from './campaignSetting.ts';
import { KeepLit, useCharacterLight } from './LightSection.tsx';
import { LoadSummary } from './LoadSummary.tsx';
import { CharacterStatuses, useStatusBook } from './Statuses.tsx';
import './CharacterOverview.css';

/** Who the overview is about, as the marching order (or another list) has them. */
export interface OverviewCharacter {
  id: string;
  campaignId: string;
  name: string;
  ownerUserId: string | null;
  level: number;
  hpCurrent: number | null;
  hpMax: number | null;
  archived: boolean;
}

/** "7 / 12", "7", "— / 12", or null when neither is set. */
export function hpWords(current: number | null, max: number | null): string | null {
  if (current === null && max === null) return null;
  return max === null ? String(current) : `${current ?? '—'} / ${max}`;
}

export function CharacterOverview({
  db,
  user,
  character,
  setting,
  settings,
  showHp,
  refresh,
  moves = [],
  onClose,
}: {
  db: Db;
  user: CurrentUser;
  character: OverviewCharacter;
  setting: CampaignSetting | null;
  /** The campaign's saved settings (its encumbrance mode). */
  settings: unknown;
  /** Whether this viewer may see the character's HP. */
  showHp: boolean;
  refresh: number;
  /** Marching moves this viewer may make for the character (each closes the popup). */
  moves?: { label: string; run: () => void }[];
  onClose: () => void;
}) {
  const view = useCharacterLight({
    db,
    user,
    carrier: { id: character.id, campaignId: character.campaignId, ownerUserId: character.ownerUserId, archived: character.archived, level: character.level },
    setting,
    refresh,
    quiet: true,
  });
  const { light, now, lines } = view;
  const statuses = useStatusBook(db, user, character.campaignId, refresh);
  const rules = setting?.encumbrance ?? null;
  // The GM's Carrying treasure switch for this character (eq-3), read with the pack; null follows the pack.
  const [treasureSwitch, setTreasureSwitch] = useState<TreasureSwitch>(null);
  useEffect(() => {
    let current = true;
    loadTreasureSwitch(db, character.id).then(
      (found) => current && setTreasureSwitch(found),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [db, character.id, refresh]);
  const load: CarriedLoad = useMemo(() => {
    if (!rules) return { mode: 'none' };
    const counting = lines.filter((l) => l.approval === 'approved' && !isSeparate(l, rules)).map(toLoadLine);
    return carriedLoad(counting, rules, encumbranceModeOf(settings), { armour: wornArmour(counting, rules), carryingTreasure: treasureSwitch });
  }, [lines, rules, settings, treasureSwitch]);
  const speed = load.mode === 'coin' || load.mode === 'slot' ? (load.tier?.movement ?? null) : null;
  const atHand = setting ? atHandLines(lines.filter((l) => l.approval === 'approved'), setting.charges) : [];
  const hp = showHp ? hpWords(character.hpCurrent, character.hpMax) : null;
  const may = mayLight(user, { id: character.id, campaignId: character.campaignId, ownerUserId: character.ownerUserId });

  const row = light && light !== 'error' ? light : null;
  const state = lightState(row, now);
  const left = row ? secondsLeft(row, now) : null;
  const words = leftWords(left, row ? view.unitOf(row.typeId) : null);

  return (
    <Dialog label={character.name} onClose={onClose}>
      <div className="overview">
        {hp !== null && (
          <p className="overview__hp">
            <span className="label">HP</span> <span className="overview__hp-value">{hp}</span>
          </p>
        )}

        {load.mode !== 'none' && rules && (
          <div className="overview__part">
            <h3 className="label">Load</h3>
            <LoadSummary
              load={load}
              rules={rules}
              from={setting?.encumbranceFrom ?? []}
              treasure={load.mode === 'armour' ? { gmSwitch: treasureSwitch, onSwitch: null } : undefined}
              // A tap on the burden opens its levels in a pop-up, here too (d5-19, 2026-11-20; frame M2h). It is the
              // Sheet over the overview's card, by its own scope (BreakdownSheet), not the overview's centred card.
              levelsPopUp
            />
            {speed && <p className="auth__meta">{`Speed ${speed}`}</p>}
          </div>
        )}

        <div className="overview__part">
          <h3 className="label">Light</h3>
          {light === undefined ? (
            <p className="auth__meta">Loading…</p>
          ) : light === 'error' ? (
            <p className="auth__meta">Couldn't load the light. Check your connection and try again.</p>
          ) : row && (state === 'lit' || state === 'low') ? (
            <div className="overview__light">
              <LightSymbol name={row.name} left={left} of={row.fullSeconds ?? row.burnSeconds} words={words} warn={state === 'low'} />
              <span className={state === 'low' ? 'overview__words overview__words--low' : 'overview__words'}>{`${row.name}, ${words}`}</span>
            </div>
          ) : (
            <p className="overview__words">{row && state === 'out' ? `${row.name} burnt out` : row?.typeId ? `${row.name}, not lit` : 'No light lit'}</p>
          )}
          {may && row?.typeId && <KeepLit on={row.keepLit} onChange={(on) => void view.keepLit(on)} />}
        </div>

        <div className="overview__part">
          <h3 className="label">Statuses</h3>
          <CharacterStatuses db={db} user={user} book={statuses.book} character={character} onChanged={statuses.reload} list />
        </div>

        {atHand.length > 0 && (
          <div className="overview__part">
            <h3 className="label">At hand</h3>
            <ul className="overview__list">
              {atHand.map((l) => (
                // The weapon's chosen mode, as stored (Design on #569: the GM reads it too): "Reed bow, Quiver: Reed arrows ×18".
                <li key={l.id}>{[l.qty > 1 ? `${l.name} ×${l.qty}` : l.name, modeWords(l, lines, setting)].filter(Boolean).join(', ')}</li>
              ))}
            </ul>
          </div>
        )}

        {moves.length > 0 && (
          <div className="overview__part">
            <h3 className="label">Marching order</h3>
            <div className="overview__actions">
              {moves.map((m) => (
                <button key={m.label} type="button" className="button-secondary" onClick={m.run}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </Dialog>
  );
}
