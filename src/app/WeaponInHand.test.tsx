// @vitest-environment jsdom
// dec-13 C14 (docs/plans/dec-13-the-player-screen.md; ps-2, ps-9, frames P1 and P2 of december/14, approved
// 2026-11-14): the weapon in hand's two roll lines, read from the Attack sheet's own rolls (weaponRolls), never a second
// sum. Invented names and numbers. Purposes:
//   A roll's face is its die without a leading 1 ("d20", "d8"; "2d4" kept), then what the line adds, signed with the
//   true minus ("+2", "−1"), as frame P1 draws "d20 +2" and "d8 +1".
//   The to-hit always says its sum, a zero too ("d20 +0", frames P2 and P5b); a damage that adds nothing is the die
//   alone ("d6", frame P5b's ash staff).
//   The small word beside each is "to hit" or "damage"; a weapon both melee and missile names which ("to hit, in melee").
//   With a target figure (descending AC) the to-hit has no "to hit" (as-1: never roll-high-and-add), and no note goes
//   under the lines (tfw-2, 2026-11-19: no line on who reads the hit).
//   The lines read in order with the die's glyph beside each, and nothing at all when there is no roll.
//   The block's line keeps what the campaign's choices changed on the weapon ("Damage −1 · Bone, …", of-13, bq3-17),
//   though the figures themselves move to the roll lines, so a lowered damage never shows without its reason (C14's
//   review).
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { weaponRolls, type AttackRoll } from '../modules/characters/play.ts';
import { combineEncumbrance } from '../modules/inventory/encumbrance.ts';
import type { InventoryLine, NamedCarrier } from '../modules/inventory/inventory.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { ItemRow } from './ItemRow.tsx';
import { diceFace, RollLines, rollFace } from './WeaponInHand.tsx';

afterEach(cleanup);

const roll = (over: Partial<AttackRoll>): AttackRoll => ({ roll: 'hit', dice: '1d20', line: '', adds: 0, which: null, againstTarget: false, lineNote: null, notes: [], parts: [], ...over });
const WARDEN = { progression: [{ level: 2, attackBonus: 1 }] };
const strong = { 'abilityModifiers.MIG': { melee: 1 } };
const BY_MIGHT = [{ attack: { damageScore: 'MIG' } }];

describe('a roll’s face (dec-13 C14)', () => {
  it('reads the die without its leading 1, then the sum the line carries, as P1 draws', () => {
    // Purpose: P1's "d20 +2 to hit" and "d8 +1 damage", from the rolls the Attack sheet shows.
    const [hit, damage] = weaponRolls({ name: 'Eel spear', weapon: { damage: '1d8', qualities: ['Melee'] } }, strong, WARDEN, 2, BY_MIGHT);
    expect(rollFace(hit!)).toMatchObject({ die: 20, figure: 'd20 +2', label: 'to hit' });
    expect(rollFace(damage!)).toMatchObject({ die: 8, figure: 'd8 +1', label: 'damage' });
  });

  it('says a to-hit of nothing as +0 and a damage of nothing as the die alone', () => {
    // Purpose: P2 and P5b draw "d20 +0" and the ash staff's bare "d6".
    expect(rollFace(roll({ adds: 0 })).figure).toBe('d20 +0');
    expect(rollFace(roll({ roll: 'damage', dice: '1d6', adds: 0 })).figure).toBe('d6');
  });

  it('writes a penalty with the true minus and keeps a count of dice above one', () => {
    // Purpose: "−1" (U+2212), never a hyphen; "2d4" is not cut to "d4"; a rules die "d6" stays as written.
    expect(rollFace(roll({ adds: -1 })).figure).toBe('d20 −1');
    expect(rollFace(roll({ roll: 'damage', dice: '2d4', adds: 2 })).figure).toBe('2d4 +2');
    expect(rollFace(roll({ roll: 'damage', dice: 'd6', adds: -1 })).figure).toBe('d6 −1');
  });

  it('names which kind a roll is for when the weapon has both', () => {
    // Purpose: a weapon both melee and missile has two to-hit lines; each says which.
    expect(rollFace(roll({ which: 'melee' })).label).toBe('to hit, in melee');
    expect(rollFace(roll({ which: 'missile' })).label).toBe('to hit, as a missile');
    expect(rollFace(roll({ roll: 'damage', dice: '1d6', which: 'missile' })).label).toBe('damage, as a missile');
  });

  it('leaves "to hit" off a roll read against a target figure', () => {
    // Purpose: as-1: with descending AC the sum isn't a to-hit, so no "to hit" beside it, though no note says so now
    // (tfw-2): the roll itself says it is read against a target.
    expect(rollFace(roll({ adds: 1, againstTarget: true })).label).toBe('');
    const target = { progression: [{ level: 2, thac0: 19 }] };
    const [hit] = weaponRolls({ name: 'Reed bow', weapon: { damage: '1d6', qualities: ['Missile'] } }, { 'abilityModifiers.NIM': { missile: 1 } }, target, 2, [], { direction: 'descending' });
    expect(hit!.lineNote).toBeNull();
    expect(rollFace(hit!)).toMatchObject({ figure: 'd20 +1', label: '' });
  });
});

describe('the roll lines (dec-13 C14)', () => {
  it('shows the to-hit then the damage, each with its die’s glyph and its small word', () => {
    // Purpose: the two lines in P1's order; the glyph is decorative, the words say the roll.
    render(<RollLines rolls={[roll({ adds: 2 }), roll({ roll: 'damage', dice: '1d8', adds: 1 })]} />);
    const lines = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(lines).toEqual(['d20 +2 to hit', 'd8 +1 damage']);
    expect(document.querySelectorAll('svg[data-die="20"], svg[data-die="8"]')).toHaveLength(2);
  });

  it('puts no note under the lines when the hit is read from a target, and no "to hit" either', () => {
    // Purpose: tfw-2 (2026-11-19): no line on who reads the hit; as-1 still holds, so the bare "d20 +1" carries no "to hit".
    render(<RollLines rolls={[roll({ adds: 1, againstTarget: true })]} />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['d20 +1']);
    expect(document.querySelector('.weapon-in-hand__rolls')!.textContent).toBe('d20 +1');
    expect(screen.queryByText(/GM/)).toBeNull();
  });

  it('draws nothing when the weapon has no roll', () => {
    // Purpose: no class figure and no die: no empty line in the block.
    const { container } = render(<RollLines rolls={[]} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('the block keeps what the campaign changed (C14 review)', () => {
  it('keeps the patch line in the block’s line while the figures move to the roll lines', () => {
    // Purpose: of-13, bq3-17: a lowered damage ("d6 −1") always shows its reason in the block.
    const spear = {
      id: 'line-bone-spear', actorId: 'actor-wren', locationId: null, name: 'Bone spear', category: 'weapon', slots: null, stack: 1, qty: 1, containerLineId: null,
      equipped: true, approval: 'approved', details: { weapon: { damage: '1d6' } }, weightCoin: 10, perUnits: 1, pinned: false, atHandHidden: false, chargesLeft: null,
      chargesHidden: false, chargesUsed: 0, spentShown: false, notes: '', libraryEntryId: null, sourcePackId: 'pack-fen', sourceEntryId: 'bone-spear', version: 1,
    } as unknown as InventoryLine;
    const wren = { actorId: 'actor-wren', locationId: null, name: 'Wren', ownerUserId: 'user-sam' } as NamedCarrier;
    const patch = 'Damage −1 · Bone, Mire zine';
    render(
      <ItemRow
        db={null as unknown as Db}
        user={{ id: 'user-sam', roles: { 'campaign-ash': 'player' } } as CurrentUser}
        campaign={{ id: 'campaign-ash', name: 'Ash barrows' } as unknown as OpenCampaign}
        line={spear}
        carrier={wren}
        lines={[spear]}
        mode="coin"
        rules={combineEncumbrance([{ mode: 'coin', coin: { maxLoadCoin: 500, tiers: [{ label: 'Unburdened', max: 300, movement: '40 ft' }] } }])}
        others={[]}
        may
        open={false}
        onToggle={() => undefined}
        atHand
        inHand
        busy={false}
        run={async () => false}
        entry={null}
        chargeRules={{ hidden: false, dice: {}, rechargeable: false }}
        rechargeDefault={false}
        onNote={() => undefined}
        secret={null}
        packShortName={null}
        problem={null}
        castingNote={null}
        blockedEquip={null}
        weapon={`+2, d6−1, ${patch}`}
        patchLines={[patch]}
        weaponRolls={[roll({ adds: 2 }), roll({ roll: 'damage', dice: 'd6', adds: -1 })]}
      />,
    );
    const main = screen.getByRole('button', { name: /^Bone spear/ });
    expect(main.textContent).toContain(`In hand, ${patch}`);
    // The figures themselves are the roll lines', not the line's.
    expect(main.textContent).not.toContain('+2');
    expect([...document.querySelectorAll('.weapon-in-hand__roll')].map((r) => r.textContent)).toEqual(['d20 +2 to hit', 'd6 −1 damage']);
  });
});

describe("a spell's roll in its block (Player sitting piece 2; frame M4g)", () => {
  // Purpose: a spell's dice read as a weapon's roll does ("d6 +2", the leading 1 dropped, the true minus), with its die's
  // glyph and its words beside ("turns"), so the spell block's roll line matches the weapon block's.
  it('reads its dice as a weapon roll reads, with its words', () => {
    expect(diceFace('d6+2', 'turns')).toEqual({ die: 6, figure: 'd6 +2', label: 'turns' });
    expect(diceFace('1d4 - 1', 'rounds')).toEqual({ die: 4, figure: 'd4 −1', label: 'rounds' });
    expect(diceFace('2d8', '')).toEqual({ die: 8, figure: '2d8', label: '' });
  });
});
