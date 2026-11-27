import { useRef, useState, type ReactNode } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { MyCharacter } from '../core/myCharacters.ts';
import type { Db } from '../core/supabase.ts';
import { chooseSpells, firstSpellsOpen, nextReady, sameAsYesterday } from '../modules/characters/magicState.ts';
import { chooseOneFewer, chooseOneMore, prepareView, type PrepareLevel, type PrepareStep, type PrepareView, type SpellCount } from '../modules/characters/magicView.ts';
import { withSwaps } from '../modules/characters/patrons.ts';
import { loadCharacterPlay, preparedProblem, slotsOf, spellListOf, type CharacterPlay, type PreparedSpell } from '../modules/characters/playState.ts';
import { spellBookOf } from '../modules/characters/spellBook.ts';
import { entriesInPlay } from '../modules/library/optionGate.ts';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { EntryPanel, FoldedGroup } from '../ui/creation.tsx';
import { BookTypeScope, Dialog } from '../ui/Dialog.tsx';
import { ListRow, RowList, Stepper } from '../ui/parts.tsx';
import { RuleText } from '../ui/RuleText.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import type { CampaignSetting } from './campaignSetting.ts';
import type { characterFigures } from './fromSetting.ts';
import { classListOf, patronInSetting } from './patronGarb.ts';
import { registry } from './services.ts';
import { spellFacts } from './spellFacts.ts';

type Figures = ReturnType<typeof characterFigures>;

/** "Mire lamp ×2, Reed whisper": a counted list in words, in the order given. */
export function countedNames(counts: readonly SpellCount[], nameOf: (c: SpellCount) => string): string {
  return counts.map((c) => (c.count > 1 ? `${nameOf(c)} ×${c.count}` : nameOf(c))).join(', ');
}

/**
 * The level line: "Level 1, 2 a day. 2 chosen" / "Level 2, 1 a day. None chosen". `title` is the level's heading, the
 * list's own name where it gives one (lv-1, `levelWord`'s 'title'), else "Level N".
 */
export const levelLine = (l: Pick<PrepareLevel, 'level' | 'slots' | 'chosen'>, title = `Level ${l.level}`) =>
  `${title}, ${l.slots} a day. ${l.chosen === 0 ? 'None' : l.chosen} chosen`;

/** The full level's pop-up words (mp-1): "Wren has 2 a day at level 1 and both are chosen. Take one out first." */
export function fullLevelWhy(name: string, l: Pick<PrepareLevel, 'level' | 'slots'>): string {
  const which = l.slots === 1 ? 'it is chosen' : l.slots === 2 ? 'both are chosen' : `all ${l.slots} are chosen`;
  return `${name} has ${l.slots} a day at level ${l.level} and ${which}. Take one out first.`;
}

/**
 * The first line (mp-2): what this screen chooses, and what stays ready today. "For Wren's next rest. …"; a name that
 * ends in s takes the apostrophe alone ("For Wren of the Lantern Wardens' next rest"), as the log and lights write it.
 */
export const forLine = (who: string, ready: string) => `For ${who.endsWith('s') ? `${who}'` : `${who}'s`} next rest. ${ready}`;

/** The foot (mockup magic/06): "Saved as you go. 1 slot still empty", or "Saved as you go" with none empty. */
export const footLine = (empty: number) => (empty === 0 ? 'Saved as you go' : `Saved as you go. ${empty === 1 ? '1 slot' : `${empty} slots`} still empty`);

/** The first line while the first spells are open (fsr-10; page 46, 46B): the condition first, "your", never a name. */
export const OPEN_LINE = 'Until your first cast or rest, what you choose is ready at once.';

/**
 * The foot while the first spells are open (fsr-9; 46B): an empty slot is said before the cast. "Ready as you choose.
 * 1 slot still empty: fill it before you cast." / "… 2 slots still empty: fill them before you cast." / none empty:
 * "Ready as you choose".
 */
export const openFootLine = (empty: number) =>
  empty === 0 ? 'Ready as you choose' : `Ready as you choose. ${empty === 1 ? '1 slot still empty: fill it' : `${empty} slots still empty: fill them`} before you cast.`;

/**
 * The slots a tap in Prepare could fill (fix 3, fsr-9): only a level with a stepper to tap, so not one with nothing to
 * choose, nor an empty book's. The one count Prepare's foot and the Magic tab's Prepare row both say.
 */
export function slotsToFill(view: Pick<PrepareView, 'levels'>): number {
  return view.levels.filter((l) => l.steps.length > 0).reduce((sum, l) => sum + l.empty, 0);
}

/**
 * What Prepare chooses from, and how (dec-8 C; December 1a): the class's list with the patron's swaps, a book
 * caster's narrowed to the book, and whether the whole list shows folded. Shared with the Magic tab, so its Prepare
 * row counts the same empty slots as Prepare's foot (fsr-9).
 */
export function prepareSource(setting: CampaignSetting, figures: Figures, character: MyCharacter) {
  const facts = spellFacts(setting, figures, character);
  const casting = figures.klass?.spellcasting && typeof figures.klass.spellcasting === 'object' ? (figures.klass.spellcasting as Record<string, unknown>) : null;
  const book = casting?.type === 'book';
  // The class's list with the patron's swaps (December 1a; pt-5): a swapped-in spell is chosen as the class's own, at
  // the swap's level; one no attached pack has in play is skipped (the class's spell stays).
  const swapped = withSwaps(
    spellListOf(figures.klass, setting.all.filter((e) => e.kind === 'spellList')),
    patronInSetting(setting, character.creation),
    character.classRef ?? '',
    (id) => entriesInPlay(setting.all).some((e) => e.kind === 'spell' && e.packEntryId === id),
    classListOf(setting),
  );
  // A book caster chooses from the book (the class list's spells that are in it, at their level); any other caster
  // from the whole list, and a prayer caster's rest is folded (mp-1).
  const inBook = new Set(spellBookOf(character.spellBook));
  const candidates = book ? new Map([...swapped.list].map(([level, ids]) => [level, ids.filter((id) => inBook.has(id))])) : swapped.list;
  return { facts, swapped, candidates, emptyBook: book && inBook.size === 0, wholeList: casting?.type === 'divine' };
}

/**
 * An empty spell book (frame 06's own note, word for word; the lead, 2026-11-14). The note stands alone: no level line
 * under it and no "1 slot still empty" at the foot (Francis's fix 3, 2026-11-18).
 */
export const EMPTY_BOOK = 'No spells in your book yet. Your GM adds one when you learn it.';

/**
 * A level with slots and no spell to put in them (a book with none of that level, say): one short line under the
 * level's line, in place of its rows (Francis's fix 2, 2026-11-18; the words are the builder's, for his look).
 */
export const nothingToChoose = (level: number) => `Nothing to choose at level ${level}.`;

/**
 * − on a spell not chosen (CLAUDE.md rule 7: never a disabled button): the pop-up's title and why. "Thorn dart isn't
 * chosen" / "Wren hasn't chosen Thorn dart for the next rest, so there's none to take out."
 */
export const noneChosenTitle = (spell: string) => `${spell} isn't chosen`;
export const noneChosenWhy = (who: string, spell: string, open = false) =>
  open ? `${who} hasn't chosen ${spell}, so there's none to take out.` : `${who} hasn't chosen ${spell} for the next rest, so there's none to take out.`;

/** Same as yesterday's refusal when yesterday's set no longer fits (the lead's answer 2, 2026-11-14). */
export const YESTERDAY_NO_LONGER_FITS = "Yesterday's spells no longer fit your slots. Choose again.";

/**
 * Prepare (dec-8 C; mp-1 to mp-4, mm-4; mockup magic/06, the Prepare frames, approved 2026-11-10): choosing the spells
 * for the character's next rest. Open at any time; it never changes what is ready today (mp-2), and its first line
 * says both. Same as yesterday is one tap (Pick). A − N + stepper a spell, by level ("Level 1, 2 a day. 2 chosen"),
 * saved as each step is made; + on a full level stays tappable and answers "Level 1 is full" (mp-1). A book caster
 * chooses from the spell book; a caster who chooses from the whole class list sees the chosen first and the rest folded
 * (`prepareView`, the lead's answer 3). A name opens the spell as the Magic tab opens it (mm-12). No accent: nothing is
 * asked. The screen is its own surface, so it is in the book's faces (the lead's rule under pq-1).
 */
export function PrepareScreen({
  db,
  user,
  character,
  setting,
  figures,
  play,
  onClose,
  onChanged,
}: {
  db: Db;
  user: CurrentUser;
  character: MyCharacter;
  setting: CampaignSetting;
  figures: Figures;
  play: CharacterPlay;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const blocked = useBlockedSheet();
  const [open, setOpen] = useState<{ spell: string; level: number } | null>(null);
  // What is chosen, kept here while the screen is open so quick taps build on each other; each is saved as made.
  const [chosen, setChosen] = useState<PreparedSpell[] | null>(play.chosen);
  // The choice last known to be saved, and which save is the newest: a refused save goes back to what is saved, never
  // to what this screen held before the tap (that may be a choice that never saved, or one changed since).
  const saved = useRef<PreparedSpell[] | null>(play.chosen);
  const newest = useRef(0);
  const slots = slotsOf(figures.filled);
  const { facts, swapped, candidates, emptyBook, wholeList } = prepareSource(setting, figures, character);
  // The first spells open (fsr-1): a choice is ready at once, and the words say so.
  const atOnce = firstSpellsOpen(play);
  const state = { prepared: play.prepared, chosen };
  const view = prepareView(state, slots, candidates, facts.packSpells, { wholeList });
  const choiceOf = (spell: string, level: number, inPack = true) => facts.choiceOf(spell, level, inPack);
  const nameOf = (spell: string, level: number, inPack = facts.packSpells.has(spell)) => {
    const name = choiceOf(spell, level, inPack).name;
    const from = swapped.from.get(spell);
    return from ? `${name}, from ${from}` : name;
  };
  const counted = (counts: readonly SpellCount[]) => countedNames(counts, (c) => nameOf(c.spell, c.level));
  const who = character.name.trim() || 'This character';

  /**
   * A refused save: the steppers go back to the choice as saved, read fresh (another device may have chosen since);
   * if that read fails too, to the last choice this screen saw saved. A newer tap's save, still on its way, keeps its
   * own steppers.
   */
  async function backToSaved(mine: number, message: string) {
    const fresh = await loadCharacterPlay(db, character.id);
    if (fresh) saved.current = fresh.chosen;
    if (mine === newest.current) setChosen(saved.current);
    toast({ text: message, error: true });
  }

  async function save(next: PreparedSpell[] | null) {
    const mine = ++newest.current;
    setChosen(next);
    const result = await runCommand(registry, db, user, chooseSpells, { character, chosen: next, slots });
    if (!result.ok) return backToSaved(mine, result.message);
    saved.current = next;
    onChanged();
  }

  function more(step: PrepareStep, l: PrepareLevel) {
    if (l.full) return blocked.explain(`${facts.levelTitle(l.level)} is full`, fullLevelWhy(who, l));
    const next = chooseOneMore(nextReady(state), step.spell, l.level, slots);
    if (!next) return blocked.explain(`${facts.levelTitle(l.level)} is full`, preparedProblem([...nextReady(state), { spell: step.spell, level: l.level }], slots) ?? fullLevelWhy(who, l));
    void save(next);
  }

  function fewer(step: PrepareStep, l: PrepareLevel) {
    if (!step.mayRemove) {
      const name = nameOf(step.spell, l.level, step.inPack);
      return blocked.explain(noneChosenTitle(name), noneChosenWhy(who, name, atOnce));
    }
    void save(chooseOneFewer(nextReady(state), step.spell, l.level));
  }

  async function pickYesterday() {
    if (!view.sameAsYesterday.fits) return blocked.explain('Same as yesterday', YESTERDAY_NO_LONGER_FITS);
    const mine = ++newest.current;
    setChosen(play.prepared);
    const result = await runCommand(registry, db, user, sameAsYesterday, { character });
    if (!result.ok) return backToSaved(mine, result.message);
    saved.current = result.value.chosen;
    onChanged();
    toast({ text: `Picked ${counted(view.sameAsYesterday.would)}`, onUndo: () => void save(result.value.before) });
  }

  const shown = open ? choiceOf(open.spell, open.level, facts.packSpells.has(open.spell)) : null;
  // The opened spell's whole description (mm-12), as the Magic tab draws it.
  const described = shown ? facts.describe(shown) : null;

  return (
    <PrepareSheet
      who={who}
      view={view}
      nameOf={nameOf}
      lineOf={(spell, level, inPack) => facts.lineOf(choiceOf(spell, level, inPack))}
      levelTitle={facts.levelTitle}
      emptyBook={emptyBook}
      firstSpellsOpen={atOnce}
      onMore={more}
      onFewer={fewer}
      onPick={() => void pickYesterday()}
      onOpen={(spell, level) => setOpen({ spell, level })}
      onClose={onClose}
    >
      {shown && open && (
        // In the book's format (mm-12), as on the Magic tab: its head as the book writes a spell's, then its whole
        // description and its page. Nothing to cast here, so its foot is Got it.
        <EntryPanel
          name={shown.name}
          headings={facts.headingsOf(shown).filter((h) => h.label !== 'Rules')}
          extra={described && described.blocks.length > 0 ? <RuleText blocks={described.blocks} /> : undefined}
          source={described?.source ?? ''}
          onClose={() => setOpen(null)}
          backLabel="Got it"
          backIcon="check-mark"
          asSheet
        />
      )}
      {blocked.sheet}
    </PrepareSheet>
  );
}

/**
 * Prepare as drawn (dec-8 C; mockup magic/06, the Prepare frames), apart from where its facts come from, so the
 * component gallery can draw it with invented spells (`preview`: in the page, not over it). `PrepareScreen` reads the
 * character and saves each step; this draws the first line, Same as yesterday, a level a section with a Stepper row a
 * spell (the chosen first and the rest folded, as `view` says), and the foot. `children` are its pop-ups.
 */
export function PrepareSheet({
  who,
  view,
  nameOf,
  lineOf,
  levelTitle,
  emptyBook,
  firstSpellsOpen: open = false,
  onMore,
  onFewer,
  onPick,
  onOpen,
  onClose,
  preview = false,
  children,
}: {
  who: string;
  view: PrepareView;
  /** A spell's name as the row says it (", from <patron>" after a swapped-in one); `inPack` left out: look it up. */
  nameOf: (spell: string, level: number, inPack?: boolean) => string;
  /** A spell's quiet line under its name ("6 turns, 30 ft"), or ''. */
  lineOf: (spell: string, level: number, inPack: boolean) => string;
  /** A level's heading: the list's name for it, else "Level N" (lv-1). */
  levelTitle: (level: number) => string;
  /**
   * A book caster with nothing in the book: frame 06's note, alone while nothing is chosen; a spell still chosen keeps
   * its level under the note.
   */
  emptyBook: boolean;
  /**
   * The first spells are open (fsr-1; page 46, 46B): the first line and the foot say a choice is ready at once, and
   * Same as yesterday is not offered (there is no yesterday).
   */
  firstSpellsOpen?: boolean;
  onMore: (step: PrepareStep, l: PrepareLevel) => void;
  onFewer: (step: PrepareStep, l: PrepareLevel) => void;
  onPick: () => void;
  onOpen: (spell: string, level: number) => void;
  onClose: () => void;
  preview?: boolean;
  children?: ReactNode;
}) {
  const counted = (counts: readonly SpellCount[]) => countedNames(counts, (c) => nameOf(c.spell, c.level));
  const stepRow = (step: PrepareStep, l: PrepareLevel) => {
    const name = nameOf(step.spell, l.level, step.inPack);
    const line = lineOf(step.spell, l.level, step.inPack);
    return (
      <ListRow
        key={step.spell}
        title={name}
        {...(line ? { sub: line } : {})}
        openLabel={[name, line].filter(Boolean).join(', ')}
        onOpen={() => onOpen(step.spell, l.level)}
        control={
          <Stepper
            label={name}
            value={step.count}
            min={0}
            max={l.full ? step.count : step.count + l.empty}
            onChange={(n) => (n > step.count ? onMore(step, l) : onFewer(step, l))}
            // Both ends stay tappable and say why (CLAUDE.md rule 7): + on a full level, − on a spell not chosen.
            onLimit={(side) => (side === 'max' ? onMore(step, l) : onFewer(step, l))}
          />
        }
      />
    );
  };
  const ready = view.readyToday.length > 0 ? `Ready today stays as it is: ${counted(view.readyToday)}.` : 'Nothing is ready today.';
  // The levels with a stepper to tap: a spell to choose, or one chosen already (kept even when its book is empty now).
  const choosable = view.levels.filter((l) => l.steps.length > 0);

  return (
    // The piece's own surface in the book's scope (pq-1; the lead, 2026-11-14): its pop-ups take the book's faces too.
    <BookTypeScope.Provider value>
      <Dialog label="Prepare" onClose={onClose} full preview={preview}>
        <div className="prepare">
          {/* Chosen and ready told apart in words (mp-2): what this screen chooses, and what stays ready today. */}
          <p className="prepare__for">{open ? OPEN_LINE : forLine(who, ready)}</p>
          {view.sameAsYesterday.offers && !open && (
            <RowList>
              <ListRow title="Same as yesterday" sub={counted(view.sameAsYesterday.would)} action="Pick" actionLabel="Pick the same as yesterday" onAction={onPick} />
            </RowList>
          )}
          {emptyBook && <p className="prepare__for">{EMPTY_BOOK}</p>}
          {/* An empty book's note stands alone (fix 3): no level line under it. A spell still chosen (the book emptied
              since) keeps its level and its stepper, so nothing chosen is hidden and − can take it out. */}
          {(emptyBook ? choosable : view.levels).map((l) => {
            const shownSteps = l.steps.filter((s) => !s.folded);
            const folded = l.steps.filter((s) => s.folded);
            return (
              <section key={l.level} className="spell-level" aria-label={levelTitle(l.level)}>
                <h3 className="spell-level__title">{levelLine(l, levelTitle(l.level))}</h3>
                {l.steps.length === 0 && <p className="prepare__none">{nothingToChoose(l.level)}</p>}
                {shownSteps.length > 0 && <RowList>{shownSteps.map((s) => stepRow(s, l))}</RowList>}
                {folded.length > 0 && (
                  // The + square, as frame 06 draws the fold (fix 1; pl-1 as amended 2026-11-18), not creation's chevron.
                  <FoldedGroup square label={`${l.folded} ${shownSteps.length > 0 ? 'more ' : ''}at level ${l.level}`} note={folded.map((s) => nameOf(s.spell, l.level, s.inPack)).join(', ')}>
                    <RowList>{folded.map((s) => stepRow(s, l))}</RowList>
                  </FoldedGroup>
                )}
              </section>
            );
          })}
          {/* The foot counts the slots a tap here could fill: not those of a level with nothing to choose, so "Nothing
              to choose at level 2." is never followed by "2 slots still empty", nor an empty book's (fix 3). */}
          <p className="prepare__foot">{(open ? openFootLine : footLine)(slotsToFill(view))}</p>
        </div>
        {children}
      </Dialog>
    </BookTypeScope.Provider>
  );
}
