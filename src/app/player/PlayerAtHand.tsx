import type { ReactNode } from 'react';
import type { CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import type { OpenCampaign } from '../Campaigns.tsx';
import type { WeaponBreakdown, WeaponLine, WeaponRolls } from '../CarrierItems.tsx';
import { LightInAtHand, litLineOf, type CharacterLightView } from '../LightSection.tsx';
import { PackScreen } from '../PackScreen.tsx';
import { PinnedSpells, pinnedSpellsOf, type PinnedSpellsInput } from './PinnedSpells.tsx';

/**
 * The Player screen's At hand and its light (dec-13 C1 split it out, be-3; C9 placed the light, ps-9; lt-4, page 35):
 * At hand is the Pack screen's own rows (its "atHand" view: the weapon in hand as its own block above At hand (C14),
 * then the worn or held things with uses, the pins), then the light with no "Light" heading, lit, not lit or burnt
 * out, in the one place (frame P1: weapon, then At hand's bow, lantern, wand). The light's own item row is then left
 * out, so it shows once; the light's name opens its item's sheet. A light that couldn't be loaded says so, with Try
 * again, in the same place (⚑ 6, B; page 37, 37C). The pinned spells' blocks come first inside At hand (Player sitting
 * piece 2; frame M4g, pg28-2).
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
  spells = null,
  onRead,
}: {
  /** Rows that join At hand after its items: the pinned traits (dec-13 C8). */
  extra?: ReactNode;
  /** The caster's setting, figures and play row, for the pinned spells' blocks; null for no spells to show. */
  spells?: PinnedSpellsInput | null;
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
  const block = litLineOf(light);
  const spellBlocks = spells ? pinnedSpellsOf(spells) : [];
  return (
    <PackScreen
      key="at-hand"
      db={db}
      user={user}
      campaign={campaign}
      carrierId={carrierId}
      view="atHand"
      light={light}
      litLight={block ? { lineId: block.lineId, lit: block.lit, rows: (onOpenItem, use) => <LightInAtHand view={light} onOpenItem={onOpenItem} use={use} /> } : null}
      onChanged={onChanged}
      weaponLine={weaponLine}
      weaponBreakdown={weaponBreakdown}
      weaponRolls={weaponRolls}
      extra={extra}
      first={spells && spellBlocks.length > 0 ? <PinnedSpells db={db} user={user} {...spells} blocks={spellBlocks} /> : null}
      onRead={onRead}
    />
  );
}
