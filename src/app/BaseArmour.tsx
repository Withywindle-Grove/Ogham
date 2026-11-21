// Magic armour whose base is picked when it's found (07, `armour.baseArmour: { choose: [item ids] }`; 05 Combat
// block; ruled 2026-10-29). One list of the bases to choose from, used by Add item ("Which base armour?") and by
// "Choose base armour" on AC. The choice is kept on the item's line (inventory.setBaseArmour, logged).
import { OptionRow } from '../ui/parts.tsx';
import './BaseArmour.css';

export function BaseArmourChoice({
  choices,
  nameOf,
  selected,
  onPick,
}: {
  /** The item ids the base is chosen from. */
  choices: readonly string[];
  /** A base's name from the setting rules (its id when the setting rules don't have it). */
  nameOf: (id: string) => string;
  selected: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className="base-armour" role="radiogroup" aria-label="Base armour">
      {choices.map((id) => (
        <OptionRow key={id} name={nameOf(id)} summary="" selected={selected === id} onPick={() => onPick(id)} />
      ))}
    </div>
  );
}
