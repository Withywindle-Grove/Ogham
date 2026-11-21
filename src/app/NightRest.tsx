// The GM's rest prompt, "A night's rest" (December step 8, piece D; mp-5, M7-5; mockup
// docs/design/mockups/magic/06-prepare-and-rest.html, the rest prompt, approved 2026-11-10). Opened by End
// expedition's Full rest when someone who went has magic or a once-a-rest power. Three parts:
//   loadRestCharacters  the characters as the prompt reads them (their spells, slots and limited-use powers)
//   NightRestSheet      the Sheet: a row a character with its switch (ds-1c); Apply rest
//   applyNightRest      Apply rest through the commands: the full rest's uses, then each ✓ caster's spells
// The data (who is listed, the words, what Apply changes) is nightRest.ts's, never worked out here.
import { useState } from "react";
import { BookTypeScope, Dialog, SheetScope } from "../ui/Dialog.tsx";
import { RowList, StackedButton, Switch } from "../ui/parts.tsx";
import type { Command } from "../core/commands.ts";
import type { Db } from "../core/supabase.ts";
import type { CharacterRef } from "../modules/characters/commands.ts";
import { setSpells } from "../modules/characters/magicState.ts";
import {
  restRows,
  type RestCharacter,
  type RestRow,
} from "../modules/characters/magicView.ts";
import {
  restApply,
  restMarksStart,
  restRowPowers,
  type RestMarks,
} from "../modules/characters/nightRest.ts";
import { limitedAbilities, slotsOf } from "../modules/characters/playState.ts";
import { loadRestActors } from "../modules/characters/restLoad.ts";
import type { CampaignSetting } from "./campaignSetting.ts";
import { characterFigures } from "./fromSetting.ts";
import "./NightRest.css";

/** One character as the rest prompt reads them: who (for the commands), their name, and the rest's facts. */
export interface Rester {
  ref: CharacterRef;
  name: string;
  rest: RestCharacter;
}

/**
 * The characters, in the order given, with their spells (character_play) and what the setting gives them: their spell
 * slots and their class's and race's limited-use powers (as the full rest has always read them). Null if unreadable.
 */
export async function loadRestCharacters(
  db: Db,
  setting: CampaignSetting | null,
  ids: readonly string[],
): Promise<Rester[] | null> {
  const actors = await loadRestActors(db, ids);
  return (
    actors?.map((a) => {
      const figures = characterFigures(
        setting,
        {
          level: a.level,
          fields: a.fields,
          creation: a.creation,
          classRef: a.classRef,
          raceRef: a.raceRef,
        },
        [],
      );
      return {
        ref: a.ref,
        name: a.name,
        rest: {
          id: a.ref.id,
          play: a.play,
          slots: slotsOf(figures.filled),
          powers: limitedAbilities(figures.klass, figures.race, a.level).map(
            (p) => ({ name: p.name, uses: p.uses, refill: p.refill }),
          ),
        },
      };
    }) ?? null
  );
}

/** When the characters can't be read (at Full rest, or again at Apply rest): nothing is applied (#790 review). */
export const REST_READ_FAILED =
  "Couldn't read who went. Check your connection and try again.";

/** Who the prompt lists (casters and once-a-rest powers), in the order given; none means no prompt. */
export function restListed(resters: readonly Rester[]): RestRow[] {
  return restRows(resters.map((r) => r.rest));
}

/**
 * Apply rest (mp-5) through the commands: first the full rest (the uses that come back, D23, as `restApply` says),
 * then each ✓ caster's spells (the GM's set: the chosen ready, nothing chosen, no casts), one log line each, each
 * undone from the log. `resters` should be read again just before (a change made while the sheet was open is kept).
 * When the full rest is refused, no spells are written; a caster's refusal after it is named in the result.
 */
export async function applyNightRest({
  resters,
  marks,
  act,
  fullRest,
}: {
  resters: readonly Rester[];
  marks: RestMarks;
  act: <I, T, O>(command: Command<I, T, O>, input: I) => Promise<O | null>;
  /** The full rest with the uses that come back (End expedition's `expedition.fullRest`). */
  fullRest: (refills: Record<string, string[]>) => Promise<boolean>;
}): Promise<NightRestResult> {
  const applied = restApply(
    resters.map((r) => r.rest),
    marks,
    true,
  );
  if (!(await fullRest(applied.refills))) return { done: false, notBack: [] };
  const notBack: string[] = [];
  for (const back of applied.spells) {
    const who = resters.find((r) => r.rest.id === back.characterId);
    if (
      who &&
      (await act(setSpells, {
        character: who.ref,
        ready: back.ready,
        chosen: null,
        spellsCast: {},
      })) === null
    )
      notBack.push(who.name);
  }
  return { done: true, notBack };
}

/** What Apply rest did: whether the full rest went through, and the ✓ casters whose own change was refused after it. */
export interface NightRestResult {
  done: boolean;
  /** Their names, for the summary's line ("Spells didn't come back for Ash."). */
  notBack: string[];
}

/**
 * The Sheet (the mockup's rest prompt): "A night's rest", the question, a row a character with its switch (the ruled
 * toggle, ds-1c: on, magic or uses back; the lead on #790, mc-46) and its once-a-rest powers under it, the line about
 * once-a-day uses, and Apply rest, the sheet's one accent. ✕ or a tap outside closes it
 * and changes nothing (no Cancel beside the X, mc-78).
 */
export function NightRestSheet({
  rows,
  names,
  onApply,
  onClose,
  preview = false,
}: {
  rows: readonly RestRow[];
  /** Each listed character's name, by id. */
  names: ReadonlyMap<string, string>;
  onApply: (marks: RestMarks) => void;
  onClose: () => void;
  /** Drawn in the page (the gallery), not over it. */
  preview?: boolean;
}) {
  const [marks, setMarks] = useState<RestMarks>(() => restMarksStart(rows));
  return (
    <SheetScope.Provider value>
      {/* The piece's own surface in the book's scope (pq-1, the lead on #790): the Scene behind it stays as it is. */}
      <BookTypeScope.Provider value>
        <Dialog label="A night's rest" onClose={onClose} preview={preview}>
          <p className="night-rest__ask">Who gets their magic back?</p>
          <RowList label="Who rested">
            {rows.map((row) => {
              const on = marks[row.characterId] !== false;
              const powers = restRowPowers(row);
              return (
                <div key={row.characterId} className="night-rest__row">
                  <Switch
                    label={names.get(row.characterId) ?? ""}
                    on={on}
                    onChange={(next) =>
                      setMarks((m) => ({ ...m, [row.characterId]: next }))
                    }
                  />
                  {powers && <p className="night-rest__powers">{powers}</p>}
                </div>
              );
            })}
          </RowList>
          <p className="night-rest__note">
            Once-a-day uses come back to everyone with the new day.
          </p>
          <div className="dialog__actions">
            <StackedButton
              icon="night-sleep"
              label="Apply rest"
              variant="primary"
              onClick={() => onApply(marks)}
            />
          </div>
        </Dialog>
      </BookTypeScope.Provider>
    </SheetScope.Provider>
  );
}
