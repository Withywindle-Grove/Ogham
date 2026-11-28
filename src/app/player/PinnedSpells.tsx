import { useState } from 'react';
import type { CurrentUser } from '../../core/commands.ts';
import type { MyCharacter } from '../../core/myCharacters.ts';
import type { Db } from '../../core/supabase.ts';
import { firstSpellsOpen } from '../../modules/characters/magicState.ts';
import { pinnedSpellBlocks, type PinnedSpellBlock } from '../../modules/characters/magicView.ts';
import type { CharacterPlay } from '../../modules/characters/playState.ts';
import { useBlockedSheet } from '../../ui/BlockedSheet.tsx';
import { PinnedName, StackedButton } from '../../ui/parts.tsx';
import type { CampaignSetting } from '../campaignSetting.ts';
import type { characterFigures } from '../fromSetting.ts';
import { SpellSheet, useCast } from '../MagicTab.tsx';
import { prepareSource } from '../PrepareScreen.tsx';
import { spellFacts } from '../spellFacts.ts';
import { diceFace, FaceLines, type RollFace } from '../WeaponInHand.tsx';

/** What the Player screen hands At hand for its pinned spells (Player sitting piece 2). */
export interface PinnedSpellsInput {
  setting: CampaignSetting;
  figures: ReturnType<typeof characterFigures>;
  character: MyCharacter;
  play: CharacterPlay;
  onChanged: () => void;
}

/**
 * A pinned spell's state line (frame M4g; psb-5): "Memorized, 1 of 2 left" while ready today, every level together
 * (psb-6), "Memorized, 0 of 2 left" with none left; "Not memorized" for a spell in the book not ready today. The pack
 * format has no word of its own for it yet (⚑ in #168's report), so these are the frame's words.
 */
const pinnedSpellState = (block: PinnedSpellBlock) => (block.ready ? `Memorized, ${block.left} of ${block.times} left` : 'Not memorized');

/** Why Cast can't cast (hard rule 10, psb-5): the blocked-action pop-up's line. */
function cantCastWords(block: PinnedSpellBlock, name: string, choosesAtOnce: boolean): string {
  if (block.ready) return `There are no castings of it left today. ${name} is ready again after you rest.`;
  return choosesAtOnce ? `${name} isn't ready today. Choose it in Prepare: what you choose is ready at once.` : `${name} isn't ready today. Choose it in Prepare; it's ready after you rest.`;
}

/**
 * The pinned spells as At hand shows them, in the pins' order (`pinnedSpellBlocks`): a spell pin is live while the
 * spell is ready today or in the caster's book (Prepare's candidates: a book caster's book, any other caster's list).
 */
export function pinnedSpellsOf({ setting, figures, character, play }: Omit<PinnedSpellsInput, 'onChanged'>) {
  if (!play.pins.some((p) => p.kind === 'spell')) return [];
  const source = prepareSource(setting, figures, character);
  const bookLevel = (spell: string) => [...source.candidates].find(([, ids]) => ids.includes(spell))?.[0] ?? null;
  return pinnedSpellBlocks(play.pins, play, (spell) => bookLevel(spell) !== null).map((block) => ({ ...block, readAt: (block.ready ? block.level : bookLevel(block.spell)) ?? 1 }));
}

/**
 * The pinned spells' blocks, first in At hand (pss-5, euf-6, pg28-2; page 28, frame M4g, approved 2026-11-20): the
 * **Weapon in hand** block's spell variant (06's inventory), its ink edge and its parts, not a copy. Each block: the
 * small filled star and the name, a tap that opens the spell's sheet (the Magic tab's own, its star filled); the state
 * line; the roll line when the spell's duration is rolled ("d6 +2 turns") and the range line when it has one ("30 paces
 * range"), each on its own line; Cast at the right. Cast runs the Magic tab's cast, its toast and Undo; with none
 * left, or not ready today, Cast stays a button and says why in a pop-up (hard rule 10, psb-5). No handle (pg28-2).
 */
export function PinnedSpells({
  db,
  user,
  setting,
  figures,
  character,
  play,
  onChanged,
  blocks,
}: PinnedSpellsInput & { db: Db; user: CurrentUser; blocks: ReturnType<typeof pinnedSpellsOf> }) {
  const [open, setOpen] = useState<string | null>(null);
  const blocked = useBlockedSheet();
  const castNow = useCast({ db, user, character, play, onChanged });
  const facts = spellFacts(setting, figures, character);
  const choiceOf = (b: (typeof blocks)[number]) => facts.choiceOf(b.spell, b.readAt, facts.packSpells.has(b.spell));
  const shown = open ? blocks.find((b) => b.spell === open) : undefined;

  function cast(b: (typeof blocks)[number]) {
    const name = choiceOf(b).name;
    const level = b.ready ? b.castLevel : null;
    if (level === null) return blocked.explain(`Can't cast ${name}`, cantCastWords(b, name, firstSpellsOpen(play)));
    setOpen(null);
    void castNow(b.spell, level, name);
  }

  return (
    <>
      <ul className="pack__rows pinned-spells" aria-label="Pinned spells">
        {blocks.map((b) => {
          const choice = choiceOf(b);
          const roll = facts.rollOf(choice);
          const range = facts.headingsOf(choice).find((h) => h.label === 'Range')?.text ?? '';
          const faces: { key: string; face: RollFace }[] = [
            ...(roll ? [{ key: 'roll', face: diceFace(roll.dice, roll.words) }] : []),
            ...(range ? [{ key: 'range', face: { die: null, figure: range, label: 'range' } }] : []),
          ];
          return (
            <li key={b.spell} className="pack__item weapon-in-hand weapon-in-hand--spell">
              <div className="weapon-in-hand__top">
                <button type="button" className="pack__row-main" aria-haspopup="dialog" onClick={() => setOpen(b.spell)}>
                  <span className="pack__name">
                    <PinnedName>{choice.name}</PinnedName>
                  </span>{' '}
                  <span className="auth__meta pack__sub">{pinnedSpellState(b)}</span>
                </button>
                <div className="weapon-in-hand__actions">
                  <StackedButton icon="magic-palm" label="Cast" aria-label={`Cast ${choice.name}`} className="pack__use" onClick={() => cast(b)} />
                </div>
              </div>
              <FaceLines faces={faces} stacked />
            </li>
          );
        })}
      </ul>
      {shown && (
        <SpellSheet
          db={db}
          user={user}
          character={character}
          play={play}
          facts={facts}
          choice={choiceOf(shown)}
          spell={shown.spell}
          onCast={shown.ready && shown.castLevel !== null ? () => cast(shown) : null}
          onClose={() => setOpen(null)}
          onChanged={onChanged}
        />
      )}
      {blocked.sheet}
    </>
  );
}
