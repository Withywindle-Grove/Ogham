// The inventory module: items on characters and in the Party stash (M4).
import type { CommandRegistry } from '../../core/commands.ts';
import { recharge, revealCharges, revealSpent, setCharges, useCharge } from './charges.ts';
import { setCarryingTreasure } from './treasureSwitch.ts';
import { addCoin, giveCoin, removeCoin, spendCoin, takeCoin } from './purse.ts';
import { addItem, approveItem, declineItem, emptyContainer, equipAnyway, equipItem, giveAway, hideFromAtHand, moveItem, noteRuleSkipped, pinItem, removeItem, revealItemField, setBaseArmour, setItemQty, setWeaponMode, useItem } from './inventory.ts';

export function registerInventory(registry: CommandRegistry): void {
  registry.register(addItem);
  registry.register(removeItem);
  registry.register(setItemQty);
  registry.register(useItem);
  registry.register(setWeaponMode);
  registry.register(equipItem);
  registry.register(equipAnyway);
  registry.register(noteRuleSkipped);
  registry.register(moveItem);
  registry.register(revealItemField);
  registry.register(pinItem);
  registry.register(setBaseArmour);
  registry.register(hideFromAtHand);
  registry.register(approveItem);
  registry.register(giveAway);
  registry.register(declineItem);
  registry.register(setCharges);
  registry.register(useCharge);
  registry.register(recharge);
  registry.register(revealSpent);
  registry.register(revealCharges);
  registry.register(emptyContainer);
  registry.register(setCarryingTreasure);
  // December step 6b: the purse commands.
  registry.register(addCoin);
  registry.register(removeCoin);
  registry.register(spendCoin);
  registry.register(giveCoin);
  registry.register(takeCoin);
}
