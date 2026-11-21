// A thing's own button at the right of its row (dec-13 C6; sb-2, md-1, ic-3): on the Player screen the stacked button,
// its ruled icon above its word, every one one size (`StackedButton`); elsewhere (the Pack tab's At hand group, whose
// stacked buttons wait for their own frame, K25) the small word button it always was. Drawn once here so At hand's rows
// and the weapon in hand's block (C14) carry the same buttons: Wield, Attack, the mode buttons (Quiver, Pouch, Grip,
// Stance), Use, Light, Put out, and use one up (Fire, Drink, Eat).
import type { SetIconName } from '../ui/iconSet.ts';
import { StackedButton } from '../ui/parts.tsx';

/**
 * Each button's icon (ic-3, ruled by Francis 2026-11-14, page 20 frame IC1; Attack's raised sword, `sword-brandish`,
 * as frame P1 draws it). A word not here (Fire, Drink, Eat, Stance) has no ruled icon yet and carries the set's generic mark (sb-2).
 */
export const ACTION_ICONS: Readonly<Record<string, SetIconName>> = {
  Wield: 'sword-hilt',
  Grip: 'fist',
  Quiver: 'quiver',
  Pouch: 'swap-bag',
  Use: 'pointing',
  Light: 'torch',
  'Put out': 'smoking-finger',
  Refill: 'jug',
  Attack: 'sword-brandish',
};

/** The ruled icon for a button's word, or null for the generic mark. */
export const actionIcon = (word: string): SetIconName | null => ACTION_ICONS[word] ?? null;

/**
 * One row button. `word` is what it shows; `hidden` finishes its name for a screen reader ("Wield" + "Eel knife").
 * `stacked` draws the stacked button (the Player screen); `wordAsButton` is the word the small button shows where it
 * says more ("Use a charge"; the stacked one says "Use", as frame P1 draws, and is still named in full). Never disabled:
 * a blocked tap says why (its `onClick`).
 */
export function ItemAction({
  word,
  hidden,
  stacked,
  onClick,
  wordAsButton,
  opensSheet = false,
}: {
  word: string;
  hidden: string;
  stacked: boolean;
  onClick: () => void;
  wordAsButton?: string;
  opensSheet?: boolean;
}) {
  const full = wordAsButton ?? word;
  if (stacked) {
    return (
      <StackedButton
        icon={actionIcon(word)}
        label={word}
        aria-label={`${full} ${hidden}`}
        {...(opensSheet ? { 'aria-haspopup': 'dialog' as const } : {})}
        className="pack__use"
        onClick={onClick}
      />
    );
  }
  return (
    <button type="button" className="button-secondary button-secondary--small pack__use" {...(opensSheet ? { 'aria-haspopup': 'dialog' as const } : {})} onClick={onClick}>
      {full} <span className="visually-hidden">{hidden}</span>
    </button>
  );
}

