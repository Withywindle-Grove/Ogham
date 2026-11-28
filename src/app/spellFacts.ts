// A spell's facts as a character's class reads them (dec-8 B and C): shared by the Magic tab and Prepare.
import type { MyCharacter } from '../core/myCharacters.ts';
import { spellChoice, spellDescription, spellHeadings, spellRollOf } from '../modules/characters/firstSpells.ts';
import { levelNameOf, levelWord } from '../modules/characters/levelNames.ts';
import { blocksOfRead } from '../modules/expedition/placeRules.ts';
import type { CampaignSetting } from './campaignSetting.ts';
import type { characterFigures } from './fromSetting.ts';

type Figures = ReturnType<typeof characterFigures>;

/**
 * A spell's facts as this character's class reads them, shared by the Magic tab and Prepare (dec-8 B, C): its entry
 * (`spellChoice`, the class list's own range or duration where the pack gives one), its rules' headings, the row's
 * quiet line (duration, then range: "6 turns, 30 ft"), and the opened spell's whole description and page (mm-12). A
 * level's words come from the class's list where it names the level (lv-1, pf-22: "Glimmers", "Glimmer"), else "Level
 * 0" and "0", never a word of the app's own; the same function as creation and the sheet. A spell whose pack is gone
 * is named as the log names it ("A level 1 spell"), never by its raw id.
 */
export function spellFacts(setting: CampaignSetting, figures: Pick<Figures, 'klass'>, character: Pick<MyCharacter, 'classRef' | 'level'>) {
  const spells = setting.all.filter((e) => e.kind === 'spell');
  const casting = figures.klass?.spellcasting && typeof figures.klass.spellcasting === 'object' ? (figures.klass.spellcasting as Record<string, unknown>) : null;
  const keys = [character.classRef ?? '', typeof casting?.listId === 'string' ? casting.listId : ''].filter(Boolean);
  const classList = setting.all.find((e) => e.kind === 'spellList' && e.packEntryId === casting?.listId) ?? null;
  const nameOf = (level: number) => levelNameOf(classList, level);
  /** A level's heading: the list's name for it, else "Level N" (lv-1). */
  const levelTitle = (level: number) => levelWord(nameOf(level), level, 'title');
  const choiceOf = (spell: string, level: number, inPack = true) => {
    const choice = spellChoice(spell, level, spells, keys, character.level, classList);
    if (inPack) return choice;
    const what = levelWord(nameOf(level), level, 'aSpell');
    return { ...choice, name: `${/^[aeiou]/i.test(what) ? 'An' : 'A'} ${what}` };
  };
  type Choice = ReturnType<typeof choiceOf>;
  const headingsOf = (choice: Choice) => spellHeadings(choice, keys, character.level);
  const lineOf = (choice: Choice) => {
    const headings = headingsOf(choice);
    const fact = (label: string) => headings.find((h) => h.label === label)?.text ?? '';
    return [fact('Duration'), fact('Range')].filter(Boolean).join(', ');
  };
  /** The opened spell in the book's format (mm-12): its whole description as blocks (notes, else blurb) and its page. */
  const describe = (choice: Choice) => {
    const { text, source } = spellDescription(choice, keys);
    return { blocks: blocksOfRead(text), source };
  };
  /** Its roll for the pinned spell's block, a rolled duration ("d6+2", "turns"), or null (Player sitting piece 2). */
  const rollOf = (choice: Choice) => spellRollOf(choice, keys);
  return { packSpells: new Set(spells.map((e) => e.packEntryId)), choiceOf, headingsOf, lineOf, describe, levelTitle, rollOf };
}
