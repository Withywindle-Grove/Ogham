// The GM reference screen (docs/05 "The GM reference screen", ruled 2026-11-01, M5 gate B4; mockup
// docs/design/mockups/m5-gate/b4-gm-reference.html): the book itself, full screen from the open-book icon in the GM's
// top row. A fallback and a stand-in for the referee's paper screen, not tied to what the GM is doing elsewhere.
//   * GmReferenceProvider: put around the GM's campaign screens; without it (a player's) there's no icon at all.
//   * ReferenceButton: the top row's open-book icon (TopRow places it beside Log).
//   * GmReference: the screen. A search that never takes focus by itself (A4) and searches every panel of every
//     pack; a pack switcher only with two or more packs; the panel list (fixed order) and the panel's entries, side
//     by side on a wide screen, one after the other on a phone; it reopens on the panel last used.
// What fills the panels is src/modules/library/gmReference.ts. Read only: nothing here changes the pack.
// Wide (tf-10, 2026-11-03): a fixed 220 px list at the left under "From the rules" and "The book's GM pages"; the pack
// switcher wraps, its pack in the Selected wash.
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Db } from '../core/supabase.ts';
import { linkedTables, readTable, rowLeadsTo, tableLookup, type ReadTable, type TableRow } from '../modules/expedition/tables.ts';
import { withRowLinks } from '../modules/expedition/rowLinks.ts';
import type { CampaignEntry, CampaignPack } from '../modules/library/campaignPacks.ts';
import { buildReference, searchReference, type RefEntry, type RefPack, type RefPanel } from '../modules/library/gmReference.ts';
import { Icon } from '../ui/icons.tsx';
import { LogPanel, useLogUserId } from './campaignLog.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { TableListItem, TableRows } from './EncounterTables.tsx';
import { Lines } from './RulesBrowser.tsx';
import { useWide } from './useWide.ts';
import './GmReference.css';
import { asOfWords, campaignEntriesInPlay, loadCampaignPacksAndEntries } from './campaignSetting.ts';

const Context = createContext<{ db: Db; campaign: OpenCampaign } | null>(null);

/** Gives the GM's screens the reference icon. Only the GM's campaign screens are wrapped in it. */
export function GmReferenceProvider({ db, campaign, children }: { db: Db; campaign: OpenCampaign; children: ReactNode }) {
  const value = useMemo(() => (campaign.role === 'gm' ? { db, campaign } : null), [db, campaign]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The top row's open-book icon (GM only): opens the reference full screen. Nothing at all for anyone else. */
export function ReferenceButton() {
  const reference = useContext(Context);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  if (!reference) return null;
  return (
    <>
      <button ref={button} type="button" className="log-button" aria-label="Reference" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="reference" />
      </button>
      {open && (
        <LogPanel
          label="Reference"
          onClose={() => {
            setOpen(false);
            button.current?.focus({ preventScroll: true });
          }}
        >
          <GmReference db={reference.db} campaign={reference.campaign} />
        </LogPanel>
      )}
    </>
  );
}

/** Where the screen was last left, per campaign, on this device (a convenience: it may be lost). */
const placeKey = (campaignId: string) => `grimoire:reference:${campaignId}`;
function readPlace(campaignId: string): { packId?: string; panelId?: string } {
  try {
    const raw = window.localStorage.getItem(placeKey(campaignId));
    const place: unknown = raw ? JSON.parse(raw) : null;
    return place && typeof place === 'object' ? (place as { packId?: string; panelId?: string }) : {};
  } catch {
    return {};
  }
}
function keepPlace(campaignId: string, packId: string, panelId: string) {
  try {
    window.localStorage.setItem(placeKey(campaignId), JSON.stringify({ packId, panelId }));
  } catch {
    // Private browsing or blocked storage: the screen just opens on its first panel next time.
  }
}

export function GmReference({ db, campaign }: { db: Db; campaign: OpenCampaign }) {
  const [loaded, setLoaded] = useState<{ entries: CampaignEntry[]; packs: CampaignPack[]; asOf?: string } | null | 'error'>(null);
  const userId = useLogUserId();
  useEffect(() => {
    let current = true;
    // The kept copy of the setting rules when there is one (perf fix 2a), through the device's store (2b).
    loadCampaignPacksAndEntries(db, userId, campaign.id).then(
      // Only the entries that exist under the campaign's options (the options audit's X7).
      (rows) => current && setLoaded(rows ? { entries: campaignEntriesInPlay(rows.entries, rows.packs), packs: rows.packs, asOf: rows.asOf } : 'error'),
      () => current && setLoaded('error'),
    );
    return () => {
      current = false;
    };
  }, [db, userId, campaign.id]);

  return (
    <section className="gm-reference" aria-labelledby="gm-reference-title">
      <h2 id="gm-reference-title" className="gm-reference__title">
        Reference
      </h2>
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
      {loaded && loaded !== 'error' && <ReferenceBook campaignId={campaign.id} entries={loaded.entries} packs={loaded.packs} />}
    </section>
  );
}

/** The screen once the setting rules are in. Exported for tests. */
export function ReferenceBook({ campaignId, entries, packs }: { campaignId: string; entries: CampaignEntry[]; packs: CampaignPack[] }) {
  const wide = useWide();
  const book = useMemo(() => buildReference(packs, entries), [packs, entries]);
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState(() => readPlace(campaignId));
  // On a phone the list is the first screen; a panel opens over it.
  const [inPanel, setInPanel] = useState(false);
  // The table open (B2's table screen, M5b g3), and the tables its rows led to after it.
  const [tablePath, setTablePath] = useState<string[]>([]);
  const tableId = tablePath[tablePath.length - 1] ?? null;
  const setTableId = (id: string | null) => setTablePath(id ? [id] : []);

  const pack = book.find((p) => p.packId === place.packId) ?? book[0];
  const panel = pack?.panels.find((p) => p.id === place.panelId) ?? pack?.panels[0];
  const hits = useMemo(() => searchReference(book, query), [book, query]);
  const searching = query.trim() !== '';
  const many = book.length > 1;

  // A table named in an entry, from the top of the stack down (as the rules resolve it).
  const tables = useMemo(() => {
    const order = new Map(packs.map((p, i) => [p.packId, i]));
    const map = new Map<string, ReadTable>();
    const sorted = entries.filter((e) => e.kind === 'table').sort((a, b) => (order.get(a.packId) ?? 99) - (order.get(b.packId) ?? 99));
    for (const e of sorted) {
      if (map.has(e.packEntryId)) continue;
      const read = readTable(e.packEntryId, e.name, e.data);
      if (read) map.set(e.packEntryId, read);
    }
    // A row's stat block and next table may be in another attached pack (December 5a).
    return withRowLinks(map, { packs, entries });
  }, [packs, entries]);
  // A row's one-line description (B2): its note, or the description of the stat block it names.
  const statBlockLines = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) {
      const said = e.kind === 'statBlock' ? (e.data as Record<string, unknown>).description : undefined;
      if (typeof said === 'string' && said.trim() && !map.has(e.packEntryId)) map.set(e.packEntryId, said.trim());
    }
    return map;
  }, [entries]);
  const describeRow = (row: TableRow) => row.note ?? (row.statBlockId ? (statBlockLines.get(row.statBlockId) ?? null) : null);
  const table = tableId ? (tables.get(tableId) ?? null) : null;
  const trail = tablePath.map((id) => tables.get(id)?.name ?? id);
  const known = tableLookup(tables.keys());

  if (!pack || !panel) return <p className="auth__meta">No reference in this setting.</p>;

  const go = (packId: string, panelId: string) => {
    setPlace({ packId, panelId });
    keepPlace(campaignId, packId, panelId);
    setTableId(null);
  };
  const choose = (packId: string, panelId: string) => {
    go(packId, panelId);
    setInPanel(true);
  };

  const search = (
    <div className="field gm-reference__search">
      <label className="label" htmlFor={searchId}>
        Search the rules
      </label>
      <input id={searchId} className="field__input" type="search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />
    </div>
  );

  const switcher = many && (
    <div className="gm-reference__packs" role="group" aria-label="Packs">
      {book.map((p) => (
        <button key={p.packId} type="button" className="button-secondary gm-reference__pack" aria-pressed={p.packId === pack.packId} onClick={() => go(p.packId, p.panels[0]!.id)}>
          {p.name}
        </button>
      ))}
    </div>
  );

  // Two quiet headings (tf-10): the panels the app builds, then the pack's own GM pages.
  const panelButton = (p: RefPanel) => (
        <button
          key={p.id}
          type="button"
          className="rules-browser__entry gm-reference__panel"
          aria-current={!searching && p.id === panel.id ? 'true' : undefined}
          onClick={() => {
            setQuery('');
            choose(pack.packId, p.id);
          }}
        >
          <span>
            {p.title}
            {p.id === 'tables' && <span className="auth__meta">: {p.entries.length}</span>}
          </span>
          {!wide && <span aria-hidden="true">›</span>}
        </button>
  );
  const fromRules = pack.panels.filter((p) => p.from === 'rules');
  const fromBook = pack.panels.filter((p) => p.from === 'book');
  const list = (
    <nav className="gm-reference__panels" aria-label="Panels">
      {fromRules.length > 0 && (
        <>
          <h3 className="gm-reference__list-heading">From the rules</h3>
          {fromRules.map(panelButton)}
        </>
      )}
      {fromBook.length > 0 && (
        <>
          <h3 className="gm-reference__list-heading">The book's GM pages</h3>
          {fromBook.map(panelButton)}
        </>
      )}
    </nav>
  );

  const content = tableId ? (
    <div className="gm-reference__content">
      <button type="button" className="button-quiet gm-reference__back" onClick={() => setTablePath((p) => p.slice(0, -1))}>
        ‹ {tablePath.length > 1 ? trail[trail.length - 2] : searching ? 'Search' : panel.title}
      </button>
      {table ? (
        // For reading, as from Table library ›: nothing is recorded; a row leading to another table offers it below.
        <div key={tablePath.join('/')}>
          <h3 className="gm-reference__table-name">
            {trail.join(' › ')}
            {table.die && <span className="auth__meta">{`, Roll ${table.die}`}</span>}
          </h3>
          <TableRows
            table={table}
            trail={trail}
            column={null}
            lit={null}
            describe={describeRow}
            leadsTo={(row, col) => {
              const id = rowLeadsTo(table, row, col, known);
              return id ? (tables.get(id)?.name ?? id) : null;
            }}
          />
          <div className="table-list">
            {linkedTables(table, known)
              .filter((id) => !tablePath.includes(id))
              .map((id) => (
                <TableListItem key={id} table={tables.get(id)!} tag={tables.get(id)!.die ?? ''} onOpen={() => setTablePath((p) => [...p, id])} />
              ))}
          </div>
        </div>
      ) : (
        <p className="auth__meta">That table isn't in this campaign's setting rules, or has no rows to read.</p>
      )}
    </div>
  ) : searching ? (
    <div className="gm-reference__content" aria-live="polite">
      {hits.length === 0 ? (
        <p className="auth__meta">Nothing in the reference says “{query.trim()}”.</p>
      ) : (
        hits.map((hit) => (
          <EntryView
            key={`${hit.pack.packId}:${hit.panel.id}:${hit.entry.key}`}
            entry={hit.entry}
            shortName={hit.pack.shortName}
            where={many ? `${hit.panel.title}, ${hit.pack.name}` : hit.panel.title}
            onTable={setTableId}
          />
        ))
      )}
    </div>
  ) : (
    <PanelView pack={pack} panel={panel} onTable={setTableId} onBack={wide ? undefined : () => setInPanel(false)} />
  );

  if (wide) {
    return (
      <div className="gm-reference__book">
        {search}
        {switcher}
        <div className="gm-reference__wide">
          {list}
          {content}
        </div>
      </div>
    );
  }
  // Phone: the list first; a panel, a table or the search's results full screen.
  if (inPanel || tableId) return <div className="gm-reference__book">{content}</div>;
  return (
    <div className="gm-reference__book">
      {search}
      {searching ? (
        content
      ) : (
        <>
          {switcher}
          {list}
        </>
      )}
    </div>
  );
}

function PanelView({ pack, panel, onTable, onBack }: { pack: RefPack; panel: RefPanel; onTable: (id: string) => void; onBack?: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (onBack) heading.current?.focus({ preventScroll: true });
  }, [onBack, panel.id]);
  // Entries under the pack's own subheadings (the player actions' groups, the items' categories), in order.
  const groups: { name: string | null; entries: RefEntry[] }[] = [];
  for (const entry of panel.entries) {
    const last = groups[groups.length - 1];
    if (last && last.name === entry.group) last.entries.push(entry);
    else groups.push({ name: entry.group, entries: [entry] });
  }
  return (
    <div className="gm-reference__content">
      {onBack && (
        <button type="button" className="button-quiet gm-reference__back" onClick={onBack}>
          ‹ Reference
        </button>
      )}
      <h3 ref={heading} tabIndex={-1} className="gm-reference__panel-title">
        {panel.title}
      </h3>
      {panel.id === 'tables' ? (
        <ul className="rules-browser__entries">
          {panel.entries.map((entry) => (
            <li key={entry.key}>
              <button type="button" className="rules-browser__entry" onClick={() => onTable(entry.tableId ?? entry.key)}>
                <span>{entry.heading} ›</span>
                {entry.paragraphs[0] && <span className="auth__meta">{entry.paragraphs[0]}</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        groups.map((group, i) => (
          <div key={`${group.name ?? ''}-${i}`} className="gm-reference__group">
            {group.name && <h4 className="gm-reference__group-name">{group.name}</h4>}
            {group.entries.map((entry) => (
              <EntryView key={entry.key} entry={entry} shortName={pack.shortName} onTable={onTable} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

/** One entry: the pack's words, the rest labelled, its page, and the table it names. */
function EntryView({ entry, shortName, where, onTable }: { entry: RefEntry; shortName: string; where?: string; onTable: (id: string) => void }) {
  return (
    <article className="gm-reference__entry" aria-label={entry.heading || undefined}>
      {entry.heading && <h4 className="gm-reference__heading">{entry.heading}</h4>}
      {where && <p className="auth__meta">{where}</p>}
      {entry.paragraphs.map((text, i) => (
        <p key={i}>{text}</p>
      ))}
      {entry.lines.length > 0 && <Lines lines={entry.lines} />}
      {entry.tableId && (
        <button type="button" className="button-quiet gm-reference__table" onClick={() => onTable(entry.tableId!)}>
          Open the table ›
        </button>
      )}
      {entry.source && (
        <p className="auth__meta">
          {shortName}, {entry.source}
        </p>
      )}
    </article>
  );
}
