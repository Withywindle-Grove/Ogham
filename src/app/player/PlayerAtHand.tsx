import type { ReactNode } from 'react';
import type { CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import type { OpenCampaign } from '../Campaigns.tsx';
import type { WeaponBreakdown, WeaponLine, WeaponRolls } from '../CarrierItems.tsx';
import { LightInAtHand, LightSection, litLineOf, type CharacterLightView } from '../LightSection.tsx';
import { PackScreen } from '../PackScreen.tsx';

/**
 * The Player screen's At hand and its light (dec-13 C1 split it out, be-3; C9 placed the light, ps-9): At hand is the
 * Pack screen's own rows (its "atHand" view: the weapon in hand as its own block above At hand (C14), then the worn
 * or held things with uses, the pins), then the lit light with no "Light" heading, then the pinned traits (C8; frame
 * P1: weapon, then At hand's bow, lantern, wand, pinned trait). The lantern's own item row is then left out, so it shows
 * once; the light's name opens its item's sheet. A light not burning keeps the Light section, under the weapon in hand
 * and just above At hand (its states are not drawn by the frames; C7's Departures).
 */
export function PlayerAtHand({
  db,
  user,
  campaign,
  carrierId,
  light,
  onChanged,
  weaponLine,
  weaponBreakdown,
  weaponRolls,
  extra = null,
  onRead,
}: {
  /** Rows that join At hand after its items: the pinned traits (dec-13 C8). */
  extra?: ReactNode;
  /** Told once the pack has been read (the screen's one loading state, dec-13 C11). */
  onRead?: (() => void) | undefined;
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  carrierId: string;
  light: CharacterLightView;
  onChanged?: (() => void) | undefined;
  weaponLine: WeaponLine;
  weaponBreakdown: WeaponBreakdown;
  weaponRolls: WeaponRolls;
}) {
  const lit = litLineOf(light);
  return (
    <PackScreen
      key="at-hand"
      db={db}
      user={user}
      campaign={campaign}
      carrierId={carrierId}
      view="atHand"
      light={light}
      litLight={lit ? { lineId: lit.lineId, rows: (onOpenItem) => <LightInAtHand view={light} onOpenItem={onOpenItem} /> } : null}
      onChanged={onChanged}
      weaponLine={weaponLine}
      weaponBreakdown={weaponBreakdown}
      weaponRolls={weaponRolls}
      extra={extra}
      beforeAtHand={<LightSection view={light} litInAtHand />}
      onRead={onRead}
    />
  );
}
