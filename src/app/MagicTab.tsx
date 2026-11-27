import { useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { MyCharacter } from '../core/myCharacters.ts';
import type { Db } from '../core/supabase.ts';
import { castSpell, firstSpellsOpen, uncastSpell } from '../modules/characters/magicState.ts';
import { magicTabLevels, prepareView, type MagicTabRow } from '../modules/characters/magicView.ts';
import { slotsOf, type CharacterPlay } from '../modules/characters/playState.ts';
import { BookType, EntryPanel } from '../ui/creation.tsx';
import { Icon } from '../ui/icons.tsx';
import { ListRow, RowList, SpellLevel, type ReadySpellRow } from '../ui/parts.tsx';
import { RuleText } from '../ui/RuleText.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import type { CampaignSetting } from './campaignSetting.ts';
import type { characterFigures } from './fromSetting.ts';
import { prepareSource, PrepareScreen, slotsToFill } from './PrepareScreen.tsx';
import { registry } from './services.ts';
import { spellFacts } from './spellFacts.ts';

type Figures = ReturnType<typeof characterFigures>;

/** "Nothing ready"'s line for a caster who hasn't chosen (mockup magic/04; B's Departure 2, back with C and D). */
export const NOTHING_CHOSEN = "You haven't chosen since your last rest. Choose in Prepare; they're ready after you rest.";

/** "Nothing ready"'s line while the first spells are open (fsr-10; page 46, 46A). */
export const CHOOSE_AT_ONCE = 'Choose in Prepare. What you choose is ready at once.';

/** Prepare's second line on the tab (frame 04): "For your next rest", the closed state's. */
export const FOR_NEXT_REST = 'For your next rest';

/**
 * Prepare's second line while the first spells are open (fsr-9; 46A, 46C): "Ready at once", with the slots a choice
 * could still fill: "Ready at once. 1 slot empty", "Ready at once. 2 slots empty".
 */
export const readyAtOnceLine = (empty: number) => (empty === 0 ? 'Ready at once' : `Ready at once. ${empty === 1 ? '1 slot' : `${empty} slots`} empty`);

/** The sentence the toast gains on the cast that closes the first spells (fsr-8; 46C): "Mire lamp cast. From now, …". */
export const castToastText = (name: string, closesFirstSpells: boolean) =>
  closesFirstSpells ? `${name} cast. From now, what you choose is ready after you rest.` : `${name} cast`;

/**
 * Whether a character gets the Magic tab in the first cut (dec-8 B; mp-20): a caster with spell slots, or anything
 * ready. The same test the Player screen's Spells section used, which this tab replaces. Other kinds of magic (a
 * kindred's glamours, a shrine's blessing, turning) are left out of the cut (docs/plans/dec-8-magic-first-cut.md).
 */
export function hasSpells(figures: Pick<Figures, 'klass' | 'filled'>, play: Pick<CharacterPlay, 'prepared'> | null): boolean {
  const caster = !!figures.klass?.spellcasting && slotsOf(figures.filled).some((n) => n > 0);
  return caster || (play?.prepared.length ?? 0) > 0;
}

/**
 * The Magic tab (dec-8 B; mp-20, mm-1; mockup magic/04, approved 2026-11-10): Prepare, a row first, since it opens a
 * screen; then the spells ready today by level (the view-model `magicTabLevels`), a row a spell with Cast. Cast spends
 * one casting at once, with Undo in the toast (mp-6: never asks who or where); a spell prepared more than once shows a
 * dot a casting; with none left it is crossed out and says "Cast". Anywhere on a row but Cast opens the spell's rules,
 * with Cast at their foot while a casting is left. Only the character's own magic: the screen is their Player screen.
 */
export function MagicTab({
  db,
  user,
  character,
  setting,
  figures,
  play,
  onChanged,
}: {
  db: Db;
  user: CurrentUser;
  character: MyCharacter;
  setting: CampaignSetting;
  figures: Figures;
  play: CharacterPlay;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const slots = slotsOf(figures.filled);
  const caster = !!figures.klass?.spellcasting && slots.some((n) => n > 0);
  // A spell's facts as the class reads them, shared with Prepare (`spellFacts`: the list's own range or duration, its
  // level words, lv-1; a spell whose pack is gone named as the log names it).
  const facts = spellFacts(setting, figures, character);
  // The first spells open (fsr-1): Prepare's row counts the slots a choice could fill, as Prepare's foot does (fsr-9).
  const atOnce = firstSpellsOpen(play);
  const prepareLine = (() => {
    if (!atOnce) return FOR_NEXT_REST;
    const source = prepareSource(setting, figures, character);
    return readyAtOnceLine(slotsToFill(prepareView(play, slots, source.candidates, facts.packSpells, { wholeList: source.wholeList })));
  })();
  const levels = magicTabLevels(play, slots, facts.packSpells);
  const choiceOf = (row: MagicTabRow) => facts.choiceOf(row.spell, row.level, row.inPack);
  const headingsOf = (row: MagicTabRow) => facts.headingsOf(choiceOf(row));
  const keyOf = (row: MagicTabRow) => `${row.level}:${row.spell}`;
  const rows = levels.flatMap((l) => l.rows);
  const shown = open ? rows.find((r) => keyOf(r) === open) : undefined;
  // The opened spell's whole description (mm-12): its notes, else its blurb, as the book sets them out.
  const described = shown ? facts.describe(choiceOf(shown)) : null;
  const description = described?.blocks ?? [];

  async function uncast(row: MagicTabRow, name: string) {
    const result = await runCommand(registry, db, user, uncastSpell, { character, spell: row.spell, level: row.level, name });
    if (!result.ok) return toast({ text: result.message, error: true });
    onChanged();
  }

  async function cast(row: MagicTabRow) {
    const name = choiceOf(row).name;
    // The cast that closes the first spells says so, once (fsr-8): read before it, as the tab last read the play row.
    const closes = atOnce;
    setOpen(null);
    const result = await runCommand(registry, db, user, castSpell, { character, spell: row.spell, level: row.level, name });
    if (!result.ok) return toast({ text: result.message, error: true });
    onChanged();
    toast({ text: castToastText(name, closes), onUndo: () => void uncast(row, name) });
  }

  const readyRow = (row: MagicTabRow): ReadySpellRow => {
    const choice = choiceOf(row);
    const facts = headingsOf(row);
    const fact = (label: string) => facts.find((h) => h.label === label)?.text ?? '';
    const line = [fact('Duration'), fact('Range')].filter(Boolean).join(', ');
    return { key: keyOf(row), name: choice.name, ...(line ? { line } : {}), times: row.times, left: row.left };
  };

  return (
    <>
      {/* The tab's own surface is in the book's faces (the lead's rule under pq-1; po-3's type-only scope replaces
          BookType when it lands); the Player screen's bars around it wait for that screen's redesign. Prepare (piece C)
          is a full screen with its own book scope. */}
      <BookType>
        {caster && (
          // Prepare is a row, first, since it opens a screen (mockup magic/04): the spell book before its word, the
          // chevron kept (ic-2). It opens Prepare, choosing for the next rest (piece C), and says so (frame 04).
          <RowList>
            <ListRow lead={<Icon name="spell-book" size={20} />} title="Prepare" sub={prepareLine} onOpen={() => setPreparing(true)} />
          </RowList>
        )}
        <section className="play-block" aria-labelledby="magic-spells">
          <h2 id="magic-spells" className="play-block__title">
            Spells
          </h2>
          {levels.length === 0 ? (
            <RowList>
              {/* Frame 04's sentence, back now Prepare (C) and the rest (D) make it true; only while nothing is chosen, so
                  its first half holds (a choice waiting for the rest says "Nothing ready" alone). */}
              <ListRow title="Nothing ready" {...(caster && atOnce ? { sub: CHOOSE_AT_ONCE } : caster && !(play.chosen?.length) ? { sub: NOTHING_CHOSEN } : {})} />
            </RowList>
          ) : (
            levels.map((l) => {
              const byKey = new Map(l.rows.map((r) => [keyOf(r), r]));
              return (
                <SpellLevel
                  key={l.level}
                  level={l.level}
                  title={facts.levelTitle(l.level)}
                  slots={l.slots}
                  spells={l.rows.map(readyRow)}
                  onOpen={setOpen}
                  onCast={(key) => {
                    const row = byKey.get(key);
                    if (row) void cast(row);
                  }}
                />
              );
            })
          )}
        </section>
        {shown && (
          // The spell opened (mockup magic/04, the rules frame; mm-12): in the book's format, its head as the book
          // writes a spell's (Level, Range, Duration as labelled lines), then its whole description set out as the
          // pack gives it (`RuleText`), then its page; Cast at its foot while a casting is left. The sheet's ✕ closes it.
          <EntryPanel
            name={choiceOf(shown).name}
            headings={headingsOf(shown).filter((h) => h.label !== 'Rules')}
            extra={description.length > 0 ? <RuleText blocks={description} /> : undefined}
            source={described?.source ?? ''}
            onClose={() => setOpen(null)}
            {...(shown.offersCast
              ? { action: { label: 'Cast', spoken: `Cast ${choiceOf(shown).name}`, icon: 'magic-palm' as const, onAction: () => void cast(shown) } }
              : { backLabel: 'Got it', backIcon: 'check-mark' as const })}
            asSheet
          />
        )}
      </BookType>
      {preparing && <PrepareScreen db={db} user={user} character={character} setting={setting} figures={figures} play={play} onClose={() => setPreparing(false)} onChanged={onChanged} />}
    </>
  );
}
