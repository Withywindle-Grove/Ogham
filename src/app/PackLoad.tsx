// The full sheet's Pack load (sr-9, sheet plan order 5; docs/06 "Pack load"): the Pack tab's load bar (the same
// `LoadSummary`, so slot bands show as `LoadBands`: a bar per band, the slower named "sets your speed"; coin mode one
// bar with its tier marks; armour mode the treasure line), then what's carried in the Pack's groups, one line each,
// with the tiny things as their own group last. A group is a fold row that opens in place to its things. No coins line until
// purses (M7b). Reads only; moving things stays on the Pack tab.
import type { EncumbranceMode } from '../core/campaignSettings.ts';
import type { CarriedLoad, EncumbranceRules } from '../modules/inventory/encumbrance.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { countWords, loadGroups, shownName, stackable, tinyCountsNothing, type PackGroup } from '../modules/inventory/packView.ts';
import { loadSpeed } from '../modules/inventory/encumbrance.ts';
import { packLoadSummary } from '../modules/characters/sheetSummaries.ts';
import type { TreasureSwitch } from '../modules/inventory/treasureSwitch.ts';
import { FoldedGroup } from '../ui/creation.tsx';
import { SkeletonRows } from '../ui/parts.tsx';
import { LoadSummary } from './LoadSummary.tsx';
import { itemCount } from './packHelpers.ts';
import { SheetSection } from './SheetSection.tsx';
import './PackLoad.css';

/** What the section reads: the load and the lines it came from (null while loading, "error" when unread). */
export type PackLoadState = { load: CarriedLoad; lines: InventoryLine[]; mode: EncumbranceMode; treasureSwitch: TreasureSwitch } | null | 'error';

/** Up to this many things, a group's line names them; past it, it counts them. */
const NAMED_UP_TO = 3;

const thingWords = (l: InventoryLine) => (stackable(l) ? countWords(l, l.qty) : shownName(l.name));

/** A group's one line: its things named (up to 3) or counted; tiny things say they're not counted when they add nothing. */
export function groupLine(group: PackGroup, mode: EncumbranceMode): string {
  const n = group.lines.length;
  if (group.key === 'tiny') return tinyCountsNothing(group.lines, mode) ? `${n}, not counted` : String(n);
  return n <= NAMED_UP_TO ? group.lines.map(thingWords).join(', ') : itemCount(n);
}

/** A group's fold row (Design on #552): its title, a colon, its line ("In the Backpack: 8 items"). */
export const groupWords = (group: PackGroup, mode: EncumbranceMode) => `${group.title}: ${groupLine(group, mode)}`;

export function PackLoad({
  state,
  rules,
  from,
  tinyCategories,
  initialOpen = null,
  fold = false,
}: {
  state: PackLoadState;
  rules: EncumbranceRules | null;
  from: string[];
  tinyCategories: ReadonlySet<string>;
  /** A group open from the start (the gallery's specimen); the sheet starts with every group closed. */
  initialOpen?: string | null;
  /** On the full sheet: folds to its summary line on a phone (sr-7), as the sheet's other sections. */
  fold?: boolean;
}) {
  if (!rules || (state && state !== 'error' && state.load.mode === 'none')) return null;
  const groups = state && state !== 'error' ? loadGroups(state.lines, state.mode, rules, tinyCategories) : [];
  return (
    <SheetSection label="Pack load" className="pack-load" fold={fold} summary={state && state !== 'error' ? packLoadSummary(loadSpeed(state.load), state.lines.length) : ''}>
      {state === null ? (
        <SkeletonRows rows={3} label="Loading the pack" />
      ) : state === 'error' ? (
        <p className="sheet__text">Couldn't load the pack. Check your connection and try again.</p>
      ) : (
        <>
          <LoadSummary
            load={state.load}
            rules={rules}
            from={from}
            treasure={state.load.mode === 'armour' ? { gmSwitch: state.treasureSwitch, onSwitch: null } : undefined}
            // A tap on the burden opens its levels in a pop-up (tfb-4, frame M2h).
            levelsPopUp
          />
          {groups.length === 0 ? (
            <p className="sheet__text">Nothing carried.</p>
          ) : (
            // Each group is the inventory's one fold row (FoldedGroup, + and −; Design on #552), its words "Worn and in
            // hand: Reed spear, Storm lantern", never a "▸" or a middle dot.
            <div className="pack-load__groups">
              {groups.map((g) => (
                <FoldedGroup key={g.key} label={groupWords(g, state.mode)} open={initialOpen === g.key}>
                  <ul className="pack-load__things">
                    {g.lines.map((l) => (
                      <li key={l.id}>{thingWords(l)}</li>
                    ))}
                  </ul>
                </FoldedGroup>
              ))}
            </div>
          )}
        </>
      )}
    </SheetSection>
  );
}
