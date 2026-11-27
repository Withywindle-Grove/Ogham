import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { readSourceTitles, type SourceTitles } from '../modules/library/sourceTitles.ts';
import type { LibraryPack } from '../modules/library/library.ts';
import { shownEntryName } from '../core/storedWords.ts';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import type { Db } from '../core/supabase.ts';
import type { CampaignEntry, CampaignPack } from '../modules/library/campaignPacks.ts';
import { describeEntry, hasFormula, sourceLine, type Line } from '../modules/library/describe.ts';
import type { EntryKind, PackEntry } from '../modules/library/packFile.ts';
import { entryKey, resolveStack, type StackPack } from '../modules/library/stack.ts';
import { layOutStatBlock, type StatBlockLayout } from '../modules/library/statBlockLayout.ts';
import { StatBlock, STAT_BLOCK_NAME } from './StatBlock.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { KIND_WORDS } from './PackPreview.tsx';
import { TopRow } from './TopRow.tsx';
import { useWide } from './useWide.ts';
import './RulesBrowser.css';
import { ErrorToast } from '../ui/ToastHost.tsx';
import { asOfWords, campaignEntriesInPlay, loadCampaignPacksAndEntries } from './campaignSetting.ts';
import { useLogUserId } from './campaignLog.tsx';
import { withThe, withTheStart } from '../core/nameWords.ts';

export type BrowsedEntry = PackEntry & { packId?: string };
type Shown = BrowsedEntry & { alsoIn: string[]; preferred: boolean };

/** The GM's exception for one entry: these setting rules' version (a link id), or back to the order (null). */
export type OnPrefer = (entry: { key: string; name: string }, campaignPackId: string | null) => Promise<string | null>;

// Routes (December step 4a) are left out until the Move on sheet (piece b) gives them words: a route has only ids,
// and the GM reads the ways on there (review of #634). Calls to adventure (dec-12 B) have their own sheet, from the place.
// A pack's maps (dec-7 5m-1) are a place's, from its page (5m-2), never a rules entry to browse. Nor a pack's people
// (dec-3, W8): the town's, from its people; nor its shops (dec-3, W9, sh-1): a place's, from its stock table.
const HIDDEN_KINDS: readonly EntryKind[] = ['route', 'adventureHook', 'map', 'npc', 'shop'];
const ORDER = (Object.keys(KIND_WORDS) as EntryKind[]).filter((kind) => !HIDDEN_KINDS.includes(kind));
const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
/** An entry's place in the list: optional rules are each pack's own, so theirs includes the pack. */
const keyOf = (entry: BrowsedEntry) => (entry.kind === 'option' ? `${entryKey(entry)}@${entry.packId ?? ''}` : entryKey(entry));

// Read-only: what's in setting rules, one folded group per kind ("Classes · 22"), with a search. Tap an entry
// for its details in plain words; on a landscape tablet they show beside the list. Optional rules aren't listed
// (they're chosen on the Campaign screen). What a player is sent is already limited by the database.
// With a campaign's stack, each entry shows once (the winning version) and says where else it is; the other
// versions can be read, and the GM can make an exception for one entry (onPrefer). An entry with formulas
// gets a level picker, and each formula shows its worked value at that level. The GM can edit an entry of the
// kinds the editor covers: the campaign's homebrew version in place, anything else as a new homebrew version.
export function RulesBrowser({
  entries,
  stack,
  gm,
  onPrefer,
  editable = [],
  onEdit,
  onDeleteHomebrew,
  initialSelected,
  startLevel = 1,
  headingLevel = 2,
  ownPack = false,
  statBlockLayout = null,
  pack,
}: {
  entries: BrowsedEntry[];
  /** The campaign's setting rules, top first; without it the entries are one pack's. */
  stack?: (StackPack & { campaignHomebrew?: boolean })[];
  gm: boolean;
  onPrefer?: OnPrefer;
  /** The kinds the GM can edit here (none: read only). */
  editable?: EntryKind[];
  /** Opens the editor on this version of an entry. */
  onEdit?: (entry: BrowsedEntry) => void;
  /** Deletes the campaign's homebrew version of an entry; returns a problem, or null. */
  onDeleteHomebrew?: (entry: BrowsedEntry) => Promise<string | null>;
  /** The entry shown first (after coming back from editing it). */
  initialSelected?: string;
  /** The level formulas are first worked out at (a player's character's level). */
  startLevel?: number;
  headingLevel?: 2 | 3;
  /** Every entry here is the GM's own pack, being edited (Rules library → Edit pack): plain Edit, optional rules too. */
  ownPack?: boolean;
  /** Without a stack (one pack's entries): how that pack lays out its stat blocks (07 `meta.statBlockLayout`, pf-13). */
  statBlockLayout?: StatBlockLayout | null;
  /**
   * Without a stack, the one pack these entries are from (the Rules library's Browse, the set-up step's): the source
   * line names it, by its short name, and reads its sources map (fix-library-source-and-count, fault 1).
   */
  pack?: Pick<LibraryPack, 'name' | 'extraMeta'>;
}) {
  const wide = useWide();
  const [level, setLevel] = useState(startLevel);
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(initialSelected ?? null);

  const shown = useMemo<Shown[]>(() => {
    const listed = stack
      ? resolveStack(
          entries.map((entry) => ({ ...entry, packId: entry.packId ?? '' })),
          stack,
        )
      : entries.map((entry) => ({ ...entry, alsoIn: [], preferred: false }));
    // Optional rules are chosen on the Campaign screen; the GM sees the campaign's own homebrew ones here, to edit them.
    const ownHomebrew = (packId: string | undefined) => ownPack || Boolean(stack?.find((pack) => pack.packId === packId)?.campaignHomebrew);
    return listed.filter((entry) => entry.kind !== 'option' || (gm && editable.includes('option') && ownHomebrew(entry.packId))).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [entries, stack, gm, editable, ownPack]);
  const nameOf = useMemo(() => {
    const names = new Map<string, string>();
    for (const entry of entries) if (!names.has(entry.packEntryId)) names.set(entry.packEntryId, entry.name);
    return (id: string) => names.get(id);
  }, [entries]);
  // One pack's entries without a stack (the library): its own name, short name and sources map, never "other setting rules".
  const single = !stack && pack ? pack : null;
  const singleShort = single && typeof single.extraMeta.shortName === 'string' && single.extraMeta.shortName.trim() ? single.extraMeta.shortName.trim() : (single?.name ?? null);
  const packName = (packId: string | undefined) => (single ? single.name : (stack?.find((pack) => pack.packId === packId)?.name ?? 'other setting rules'));
  const shortName = (packId: string | undefined) => (single ? singleShort! : ((stack?.find((pack) => pack.packId === packId) as { shortName?: string } | undefined)?.shortName ?? packName(packId)));
  // A pack's sources map (07 meta.sourceTitles, G-212): its codes read as the books' titles at the foot.
  const titlesOf = (packId: string | undefined): SourceTitles =>
    single ? readSourceTitles(single.extraMeta) : ((stack?.find((pack) => pack.packId === packId) as { sourceTitles?: SourceTitles } | undefined)?.sourceTitles ?? {});
  // A pack's stat block layout (pf-13): the stack's pack's, or the one pack's being browsed.
  const layoutOf = (packId: string | undefined): StatBlockLayout | null =>
    stack ? ((stack.find((pack) => pack.packId === packId) as { statBlockLayout?: StatBlockLayout | null } | undefined)?.statBlockLayout ?? null) : statBlockLayout;
  const isHomebrew = (packId: string | undefined) => ownPack || Boolean(stack?.find((pack) => pack.packId === packId)?.campaignHomebrew);
  const manyPacks = new Set(shown.map((entry) => entry.packId)).size > 1;
  const from = (entry: BrowsedEntry) => (manyPacks && entry.packId ? `From ${packName(entry.packId)}` : null);

  const needle = query.trim().toLowerCase();
  const matching = needle ? shown.filter((entry) => entry.name.toLowerCase().includes(needle)) : shown;
  const groups = ORDER.map((kind) => [kind, matching.filter((entry) => entry.kind === kind)] as const).filter(([, list]) => list.length > 0);
  const chosen = shown.find((entry) => keyOf(entry) === selected) ?? null;

  if (shown.length === 0) return <p className="auth__meta">There's nothing to look through in these setting rules yet.</p>;

  const detail = chosen && (
    <EntryDetail
      key={keyOf(chosen)}
      entry={chosen}
      versions={chosen.kind === 'option' ? [chosen] : entries.filter((entry) => entryKey(entry) === entryKey(chosen))}
      packName={packName}
      shortName={shortName}
      titlesOf={titlesOf}
      layoutOf={layoutOf}
      from={from(chosen)}
      gm={gm}
      nameOf={nameOf}
      level={level}
      onLevel={setLevel}
      headingLevel={headingLevel}
      onPrefer={onPrefer && stack ? (packId) => onPrefer({ key: entryKey(chosen), name: chosen.name }, stack.find((pack) => pack.packId === packId)?.id ?? null) : undefined}
      onBack={wide ? undefined : () => setSelected(null)}
      editing={
        gm && onEdit && editable.includes(chosen.kind) && (chosen.kind !== 'option' || isHomebrew(chosen.packId))
          ? { isHomebrew, onEdit, onDelete: onDeleteHomebrew }
          : undefined
      }
    />
  );
  if (chosen && !wide) return <div className="rules-browser">{detail}</div>;

  return (
    <div className={wide ? 'rules-browser rules-browser--wide' : 'rules-browser'}>
      <div className="rules-browser__list">
        <div className="field">
          <label className="label" htmlFor={searchId}>
            Search these rules
          </label>
          <input id={searchId} className="field__input" type="search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {groups.length === 0 && <p className="auth__meta">Nothing called “{query.trim()}”.</p>}
        {groups.map(([kind, list]) => (
          <details key={kind} className="rules-browser__group" open={needle ? true : undefined}>
            <summary className="rules-browser__summary">
              {capital(KIND_WORDS[kind][1])}: {list.length}
            </summary>
            <ul className="rules-browser__entries">
              {list.map((entry) => (
                <li key={keyOf(entry)}>
                  <button
                    type="button"
                    className="rules-browser__entry"
                    aria-current={keyOf(entry) === selected ? 'true' : undefined}
                    onClick={() => setSelected(keyOf(entry))}
                  >
                    <span>{shownEntryName(entry)}</span>
                    {from(entry) && <span className="auth__meta">{from(entry)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      {wide && <div className="rules-browser__detail">{detail ?? <p className="auth__meta">Tap an entry to read it.</p>}</div>}
    </div>
  );
}

function EntryDetail({
  entry,
  versions,
  packName,
  shortName,
  titlesOf,
  layoutOf,
  from,
  gm,
  nameOf,
  level,
  onLevel,
  headingLevel,
  onPrefer,
  onBack,
  editing,
}: {
  /** The winning version. */
  entry: Shown;
  /** Every version of this entry in the campaign's setting rules. */
  versions: BrowsedEntry[];
  packName: (packId: string | undefined) => string;
  /** A pack's short name, for the page reference at the foot. */
  shortName: (packId: string | undefined) => string;
  /** A pack's sources map, for the same line (G-212). */
  titlesOf: (packId: string | undefined) => SourceTitles;
  /** A pack's stat block layout (pf-13), for a stat block. */
  layoutOf: (packId: string | undefined) => StatBlockLayout | null;
  from: string | null;
  gm: boolean;
  nameOf: (id: string) => string | undefined;
  level: number;
  onLevel: (level: number) => void;
  headingLevel: 2 | 3;
  /** The GM picks this pack's version (its pack id), or back to the order (null). Returns a problem, or null. */
  onPrefer?: (packId: string | null) => Promise<string | null>;
  /** On a phone or portrait tablet, back to the list. */
  onBack?: () => void;
  /** The GM's editing, for kinds the editor covers. */
  editing?: {
    isHomebrew: (packId: string | undefined) => boolean;
    onEdit: (entry: BrowsedEntry) => void;
    onDelete?: (entry: BrowsedEntry) => Promise<string | null>;
  };
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const blocked = useBlockedSheet();
  const [deleting, setDeleting] = useState(false);
  // Another pack's version being read (undefined: the one used).
  const [reading, setReading] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const shown = (reading && versions.find((version) => version.packId === reading)) || entry;
  const winning = shown.packId === entry.packId;
  const formulas = hasFormula(shown);
  const { notes, lines } = describeEntry(shown, nameOf, { gm, level: formulas ? level : undefined });
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  const focusOnOpen = Boolean(onBack);
  useEffect(() => {
    if (focusOnOpen) heading.current?.focus();
  }, [entry, focusOnOpen]);

  async function remove() {
    if (!editing?.onDelete) return;
    setBusy(true);
    setProblem(null);
    const failed = await editing.onDelete(shown);
    setBusy(false);
    if (failed) setProblem(failed);
    else {
      setDeleting(false);
      setReading(undefined);
    }
  }
  const homebrewHere = editing?.isHomebrew(shown.packId) ?? false;
  const otherVersion = [entry.packId, ...entry.alsoIn].find((packId) => packId !== shown.packId);

  async function prefer(packId: string | null) {
    if (!onPrefer) return;
    setBusy(true);
    setProblem(null);
    const failed = await onPrefer(packId);
    setBusy(false);
    if (failed) setProblem(failed);
    else setReading(undefined);
  }

  return (
    <article className="rules-browser__article" aria-label={shownEntryName(entry)}>
      {onBack && (
        <button type="button" className="button-quiet rules-browser__back" onClick={onBack}>
          ‹ Back to the list
        </button>
      )}
      <Heading ref={heading} tabIndex={-1} className={shown.kind === 'statBlock' ? `rules-browser__name ${STAT_BLOCK_NAME}` : 'rules-browser__name'}>
        {shownEntryName(shown)}
      </Heading>
      <p className="auth__meta">
        {winning
          ? homebrewHere && entry.alsoIn.length > 0
            ? `${capital(KIND_WORDS[entry.kind][0])}, Your version (${packName(shown.packId)})`
            : [capital(KIND_WORDS[entry.kind][0]), from].filter(Boolean).join(', ')
          : `${withTheStart(packName(shown.packId))} version, not used`}
      </p>

      {entry.alsoIn.length > 0 && (
        <div className="rules-browser__versions" role="group" aria-label="Other versions">
          <p className="auth__meta">
            {winning
              ? entry.preferred
                ? `Also in ${entry.alsoIn.map(packName).join(', ')}. ${packName(entry.packId)} wins for this one, by your choice.`
                : `Also in ${entry.alsoIn.map(packName).join(', ')}. ${packName(entry.packId)} wins: it's higher in the stack.`
              : `${withTheStart(packName(entry.packId))} version is the one used.`}
          </p>
          <div className="rules-browser__version-actions">
            {[entry.packId, ...entry.alsoIn]
              .filter((packId) => packId !== shown.packId)
              .map((packId) => (
                <button key={packId} type="button" className="button-secondary button-secondary--small" onClick={() => setReading(packId === entry.packId ? undefined : packId)}>
                  {packId === entry.packId ? 'Back to the one used' : `See ${withThe(packName(packId))} version`}
                </button>
              ))}
            {gm && onPrefer && !winning && (
              <button type="button" className="button-secondary" aria-busy={busy} onClick={() => void prefer(shown.packId ?? null)}>
                Use this version
              </button>
            )}
            {gm && onPrefer && winning && entry.preferred && (
              <button type="button" className="button-secondary" aria-busy={busy} onClick={() => void prefer(null)}>
                Back to the stack order
              </button>
            )}
          </div>
          <ErrorToast message={problem} />
        </div>
      )}

      {formulas && (
        <div className="rules-browser__level" role="group" aria-label="Work out at level">
          <span className="label">At level</span>
          <button type="button" className="button-secondary rules-browser__step" aria-label="Lower level" onClick={() => (level <= 1 ? blocked.explain("Can't go lower", 'Level 1 is the lowest.') : onLevel(level - 1))}>
            −
          </button>
          <span className="rules-browser__level-value" aria-live="polite">
            {level}
          </span>
          <button type="button" className="button-secondary rules-browser__step" aria-label="Higher level" onClick={() => (level >= 99 ? blocked.explain("Can't go higher", 'Level 99 is the highest the app works out.') : onLevel(level + 1))}>
            +
          </button>
          {blocked.sheet}
        </div>
      )}
      {editing &&
        (deleting ? (
          <div className="rules-browser__versions" role="group" aria-label={`Delete ${shown.name} from the homebrew`}>
            <p>
              Delete <strong>{shown.name}</strong> from this campaign’s homebrew?
              {otherVersion ? ` ${withTheStart(packName(otherVersion))} version applies again.` : ''} The log keeps a copy.
            </p>
            <div className="rules-browser__version-actions">
              <button type="button" className="button-secondary" aria-busy={busy} onClick={() => void remove()}>
                Delete
              </button>
              <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => setDeleting(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="rules-browser__version-actions">
            <button type="button" className="button-secondary" onClick={() => editing.onEdit(shown)}>
              {homebrewHere ? 'Edit' : 'Edit as homebrew'}
            </button>
            {homebrewHere && editing.onDelete && (
              <button type="button" className="button-secondary button-secondary--small" onClick={() => setDeleting(true)}>
                Delete from homebrew…
              </button>
            )}
          </div>
        ))}
      {problem && !entry.alsoIn.length && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
      {shown.kind === 'statBlock' ? (
        // A stat block is the shared part (December 5c), laid out as its pack says, as View shows it.
        <StatBlock
          shown={layOutStatBlock(shown.data, layoutOf(shown.packId), nameOf, gm || !Array.isArray(shown.data.gmOnly) ? [] : shown.data.gmOnly.map(String))}
          source={sourceLine(shown.data.source, shortName(shown.packId), nameOf, undefined, titlesOf(shown.packId))}
        />
      ) : (
        <>
          {notes.map((note) => (
            <p key={note} className="rules-browser__notes">
              {note}
            </p>
          ))}
          {lines.length > 0 && <Lines lines={lines} />}
          {sourceLine(shown.data.source, shortName(shown.packId), nameOf, undefined, titlesOf(shown.packId)) && <p className="auth__meta">{sourceLine(shown.data.source, shortName(shown.packId), nameOf, undefined, titlesOf(shown.packId))}</p>}
        </>
      )}
    </article>
  );
}

/**
 * An entry's details as label and value lines (also the Pack tab's item sheet). Variant `kv` (the item sheet, Design
 * on #552): each line a kv row, the label at the left and the value at the right edge ("Slot", "hand"), as the sheet's
 * How many row; a nested group still sits under its label.
 */
export function Lines({ lines, kv = false }: { lines: Line[]; kv?: boolean }) {
  return (
    <dl className={kv ? 'rules-browser__lines rules-browser__lines--kv' : 'rules-browser__lines'}>
      {lines.map((line, index) => (
        <div key={`${line.label}-${index}`} className="rules-browser__line">
          <dt>{line.label}</dt>
          <dd>{line.lines ? <Lines lines={line.lines} /> : line.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// A campaign's setting rules on a screen of their own (a player's ⋯ → Setting rules): everything this person
// may see, from every pack the campaign uses, as the stack resolves it.
export function CampaignRules({
  db,
  campaign,
  level,
  backLabel,
  onBack,
}: {
  db: Db;
  campaign: OpenCampaign;
  /** The player's active character's level, for working out formulas. */
  level?: number;
  backLabel: string;
  onBack: () => void;
}) {
  const [loaded, setLoaded] = useState<{ entries: CampaignEntry[]; packs: CampaignPack[]; asOf?: string } | null | 'error'>(null);
  const userId = useLogUserId();

  useEffect(() => {
    let current = true;
    // The kept copy of the setting rules when there is one (perf fix 2a), through the device's store (2b).
    loadCampaignPacksAndEntries(db, userId, campaign.id).then(
      (rows) => {
        if (!current) return;
        setLoaded(rows ?? 'error');
      },
      () => current && setLoaded('error'),
    );
    return () => {
      current = false;
    };
  }, [db, userId, campaign.id]);

  return (
    <section className="rules-screen">
      <TopRow back={backLabel} onBack={onBack} />
      <h1 className="rules-screen__title">Setting rules</h1>
      <p className="auth__meta">{campaign.name}</p>
      {loaded === null && <p role="status">Opening…</p>}
      {loaded === 'error' && (
        <p className="form-error" role="alert">
          Couldn't load the setting rules. Check your connection and try again.
        </p>
      )}
      {loaded && loaded !== 'error' && loaded.asOf && (
        // Offline on the device's stored copy (ruled 2026-11-07, ⚑ 4 B): one quiet line, gone when online.
        <p className="auth__meta" role="status">
          {asOfWords(loaded.asOf)}
        </p>
      )}
      {loaded && loaded !== 'error' && <RulesBrowser entries={campaignEntriesInPlay(loaded.entries, loaded.packs)} stack={loaded.packs} gm={campaign.role === 'gm'} startLevel={level} />}
    </section>
  );
}
