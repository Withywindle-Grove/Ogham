// A new campaign's steps 2 and 3 on the creation step shell (docs/05 "Creating a campaign", 06 Components: Setting
// rules step, Optional rules list; ruling lr-5, lr-6, 2026-11-02; mockup library/03-campaign-rules). The shell, the
// pack rows and the rule rows are shared parts; this file only lays them out.
//   SetupPacksStep (step 2): the library's Pack rows by kind with the same chips, the ✓ slot picks, the row opens the
//     pack's Browse with Pick at its foot; "needs <pack> ✓"; Next explains a missing base; Import a file… quiet in the foot.
//   SetupRulesStep (step 3): a `ruleKey` clash as one callout at the top (choosing from it picks that pack for the
//     group: one choice per group, 07); one folded group per source, an add-on shown only once its parent has the
//     choice it needs (A1; choosing the parent off sets it back too), a pack's presets first in its group (A8); the Encumbrance
//     row; Reset to the books' defaults (quiet, with Undo); Create campaign the one accent.
import { useId, useState, type ChangeEvent, type ReactNode } from 'react';
import type { LibraryPack } from '../modules/library/library.ts';
import { groupByKind, holdsLine, KIND_GROUPS, sortPacks, usedBy as usedByLine } from '../modules/library/libraryList.ts';
import { changeRule, type Choices } from '../modules/library/options.ts';
import type { PackEntry, PackKind } from '../modules/library/packFile.ts';
import {
  changedFirst,
  changesWith,
  choiceOf,
  countLine,
  decidedAbove,
  needsPicked,
  offeredSources,
  presetChanges,
  ruleClashes,
  setupOrder,
  WHEN_WORDS,
  type ChoicesChange,
  type PresetPlan,
  type RuleGroupPicks,
  type RuleSource,
} from '../modules/library/ruleGroups.ts';
import { CreationStep, PickTick } from '../ui/creation.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { KindChips, KindGroup, PackRow } from '../ui/packList.tsx';
import { RuleKeyCard, RulePresetPreview, RulePresets, RuleRow, RuleSourceGroup, type RuleChoice } from '../ui/ruleRows.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { RulesForThisCampaign, type RuleGroup } from '../ui/organisms.tsx';
import { RulesBrowser } from './RulesBrowser.tsx';
import { writtenMetaId } from '../modules/library/packMeta.ts';
import { readStatBlockLayout } from '../modules/library/statBlockLayout.ts';

/** How each kind is picked, after its heading (lr-5; mockup library/03 §1). */
const KIND_NOTES: Record<PackKind, string> = {
  setting: 'pick one; a second one adds to it',
  adventure: 'any number',
  homebrew: 'sits above everything',
};

const PACKS_HELP =
  'Most campaigns play with one setting rules pack. Add an adventure to run it, and homebrew to change the rules your way. ' +
  'Where two packs have the same entry, the one on top wins; you can change the order later in Rules.';

const RULES_HELP =
  "Each pack's switches start at the book's default, so you can leave them all. Change one only when your table plays it " +
  "differently. A rule that can't change once the campaign starts is worth a look now.";

/** A library pack's `meta.id`, the id other packs' `meta.requires` name. */
export const metaIdOf = (pack: LibraryPack): string | null => writtenMetaId(pack.extraMeta);

/** A library pack's short name (meta.shortName), or its name. */
export const shortNameOf = (pack: LibraryPack): string => {
  const short = pack.extraMeta.shortName;
  return typeof short === 'string' && short.trim() ? short.trim() : pack.name;
};

const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function SetupPacksStep({
  library,
  picked,
  hint,
  onPick,
  loadEntries,
  onImport,
  onBack,
  onNext,
  onCreateNow,
  busy,
  counter,
}: {
  library: LibraryPack[] | null | 'error';
  picked: string[];
  hint: string;
  onPick: (pack: LibraryPack) => void;
  /** The pack's entries for Browse (cached by the caller); null when they couldn't be loaded. */
  loadEntries: (pack: LibraryPack) => Promise<PackEntry[] | null>;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
  onNext: () => void;
  onCreateNow: () => void;
  busy: boolean;
  counter: { at: number; of: number };
}) {
  const importId = useId();
  const [shown, setShown] = useState<PackKind | 'all'>('all');
  const [browsing, setBrowsing] = useState<{ pack: LibraryPack; entries: PackEntry[] | null | 'loading' } | null>(null);
  const packs = Array.isArray(library) ? library : [];
  const present = KIND_GROUPS.map((group) => ({ ...group, count: packs.filter((p) => p.kind === group.kind).length })).filter((group) => group.count > 0);
  const showing = shown !== 'all' && present.some((group) => group.kind === shown) ? shown : 'all';
  const groups = groupByKind(sortPacks(packs.filter((p) => showing === 'all' || p.kind === showing), 'name'));
  const names = new Map(packs.flatMap((p) => (metaIdOf(p) ? [[metaIdOf(p)!, p.name] as const] : [])));
  const pickedIds = new Set(packs.filter((p) => picked.includes(p.id)).flatMap((p) => (metaIdOf(p) ? [metaIdOf(p)!] : [])));

  async function browse(pack: LibraryPack) {
    setBrowsing({ pack, entries: 'loading' });
    const entries = await loadEntries(pack);
    setBrowsing((now) => (now?.pack.id === pack.id ? { pack, entries } : now));
  }

  const browsed = browsing && (
    <Dialog full label={browsing.pack.name} meta={[browsing.pack.version && `Version ${browsing.pack.version}`, holdsLine(browsing.pack.counts, browsing.pack.words)].filter(Boolean).join(', ')} onClose={() => setBrowsing(null)}>
      {browsing.pack.description && <p>{browsing.pack.description}</p>}
      {browsing.entries === 'loading' && <p role="status">Opening…</p>}
      {browsing.entries === null && (
        <p className="form-error" role="alert">
          Couldn't open {browsing.pack.name}. Check your connection and try again.
        </p>
      )}
      {Array.isArray(browsing.entries) && <RulesBrowser entries={browsing.entries} pack={browsing.pack} gm headingLevel={3} statBlockLayout={readStatBlockLayout(browsing.pack.extraMeta)} />}
      <div className="entry-panel__foot">
        <button
          type="button"
          className={picked.includes(browsing.pack.id) ? 'button-secondary' : 'button-primary'}
          onClick={() => {
            onPick(browsing.pack);
            setBrowsing(null);
          }}
        >
          {picked.includes(browsing.pack.id) ? `Unpick ${browsing.pack.name}` : `Pick ${browsing.pack.name}`}
        </button>
      </div>
    </Dialog>
  );

  return (
    <CreationStep
      title="Setting rules"
      counter={counter}
      why="Pick what this campaign plays with. You can add more later."
      help={PACKS_HELP}
      onBack={onBack}
      footExtra={
        <span className="new-campaign__import">
          <label htmlFor={importId} className="button-secondary button-secondary--small new-campaign__file-button">
            Import a file…
          </label>
          <input
            id={importId}
            className="new-campaign__file"
            type="file"
            // No "accept" list: on an iPhone, files from Google Drive can show greyed out with one (M4b gate); the import reads and checks the file.
            onChange={onImport}
          />
        </span>
      }
      hint={hint}
      onNext={onNext}
      busy={busy}
    >
      {library === null && <p role="status">Opening your library…</p>}
      {library === 'error' && <p className="form-error">Couldn't load your library. You can still go on, and add setting rules later.</p>}
      {Array.isArray(library) && library.length === 0 && <p className="auth__meta">Nothing in your library yet. Import a file to add some, or go on and add setting rules later.</p>}
      {packs.length > 0 && <KindChips kinds={present} total={packs.length} selected={showing} onSelect={setShown} />}
      {groups.map((group) => (
        <KindGroup key={group.kind} title={group.title} count={group.items.length} note={KIND_NOTES[group.kind]}>
          {group.items.map((pack) => {
            const on = picked.includes(pack.id);
            return (
              <PackRow
                key={pack.id}
                name={pack.name}
                description={pack.description}
                needs={needsPicked(pack.requires, pickedIds, names)}
                holds={holdsLine(pack.counts, pack.words)}
                usedBy={usedByLine(pack.usedBy)}
                version={pack.version}
                updated={dateOf(pack.importedAt)}
                lead={<PickTick name={pack.name} picked={on} onPick={() => onPick(pack)} />}
                onOpen={() => void browse(pack)}
              />
            );
          })}
        </KindGroup>
      ))}
      <p className="auth__meta new-campaign__now">
        <button type="button" className="button-quiet" onClick={onCreateNow}>
          Create campaign now
        </button>{' '}
        keeps the defaults for the steps left.
      </p>
      {browsed}
    </CreationStep>
  );
}

/** The Encumbrance row (ruled 2026-10-24): the modes the setting rules give data for; app-wide, so its own row. */
export interface EncumbranceRow {
  choices: RuleChoice[];
  current: string;
  defaultChoice: string;
  about: string;
  onChoose: (mode: string) => void;
}

/** The changed count over every source's rules on offer (A1: a hidden add-on is at its default), for the hint. */
export const changedTotal = (sources: readonly RuleSource[]) => offeredSources(sources).reduce((n, s) => n + changedFirst(s.rules, s.choices).changed.length, 0);

export function SetupRulesStep({
  sources,
  noPacks,
  encumbrance,
  onChoices,
  picks = {},
  onPick,
  onReset,
  onBack,
  onCreate,
  busy,
  counter,
  after,
  app,
}: {
  /** The picked packs, in the order picked, each with its rules and choices. */
  sources: RuleSource[];
  /** True when no pack was picked. */
  noPacks: boolean;
  /**
   * The app's own Encumbrance row; left out while a pack's option moves the load method (that option is the one switch
   * for how load is carried, 2026-10-24; gate check 4).
   */
  encumbrance?: EncumbranceRow;
  onChoices: (packId: string, choices: Choices) => void;
  /** The GM's picks for the `ruleKey` groups (which pack's rule counts), and choosing from a clash callout makes one. */
  picks?: RuleGroupPicks;
  onPick?: (ruleKey: string, packId: string) => void;
  onReset: () => void;
  onBack: () => void;
  onCreate: () => void;
  busy: boolean;
  counter: { at: number; of: number };
  /** After the rules: the sheet layout offer. */
  after?: ReactNode;
  /**
   * The app's own rules (tf-7): the App section at the top, folded like a pack, with the same rows as Rules for this
   * campaign (its topic groups' rules in one group).
   */
  app?: { groups: RuleGroup[]; onChange: (ruleId: string, value: string) => void };
}) {
  const toast = useToast();
  // The rules on offer (A1): an add-on whose parent hasn't the choice it needs isn't shown (and is at its default).
  const shown = offeredSources(sources);
  const withRules = shown.filter((s) => s.rules.length > 0);
  const [open, setOpen] = useState<string[]>(() => (withRules[0] ? [withRules[0].packId] : []));
  const [preview, setPreview] = useState<PresetPlan | null>(null);
  const clashes = ruleClashes(setupOrder(shown.map((s) => ({ ...s, id: s.packId }))), picks);

  const apply = (changes: readonly ChoicesChange[], use: 'next' | 'previous') => {
    for (const change of changes) onChoices(change.packId, change[use]);
  };
  // One choice; an add-on it hides goes back to its default with it (A1).
  const choose = (source: RuleSource, ruleId: string, choiceId: string) => {
    const full = sources.find((s) => s.packId === source.packId) ?? source;
    const result = changeRule(full.rules, full.choices, ruleId, choiceId, { attaching: true });
    if (result.ok) apply(changesWith(sources, { [full.packId]: result.choices }), 'next');
  };
  const row = (source: RuleSource, rule: RuleSource['rules'][number]) => (
    <RuleRow
      key={rule.id}
      name={rule.name}
      about={rule.notes}
      source={[source.shortName, rule.source, WHEN_WORDS[rule.changeLater]].filter(Boolean).join(', ')}
      choices={rule.choices}
      current={choiceOf(rule, source.choices)}
      defaultChoice={rule.defaultChoice}
      decided={decidedAbove(clashes, source.packId, rule)}
      manual={rule.manual}
      onChoose={(choiceId) => choose(source, rule.id, choiceId)}
    />
  );
  const total = changedTotal(sources);

  return (
    <CreationStep
      title="Optional rules"
      counter={counter}
      why="Each pack's switches, with its own default on. Change what you like; the rest stays as the book says."
      help={RULES_HELP}
      onBack={onBack}
      footExtra={
        <button type="button" className="button-secondary button-secondary--small" onClick={onReset}>
          Reset to the books' defaults
        </button>
      }
      hint={total === 0 ? 'No rules changed' : `${total} ${total === 1 ? 'rule' : 'rules'} changed`}
      nextLabel={busy ? 'Creating…' : 'Create campaign'}
      onNext={onCreate}
      busy={busy}
    >
      {app && (
        <RulesForThisCampaign
          label="The app's rules"
          groups={[{ id: 'app', name: 'App', rules: app.groups.flatMap((g) => g.rules) }]}
          onChange={app.onChange}
        />
      )}
      {clashes.map((clash) => (
        // tf-1: every pack's choices under its name; one tap sets that choice and picks that pack for the group.
        <RuleKeyCard
          key={clash.ruleKey}
          topic={clash.topic}
          // The GM is meant to pick here: the card starts open (rc-fold, Francis 2026-11-20).
          startOpen
          packs={clash.offers.map((offer) => ({
            label: offer.source.shortName,
            choices: offer.rule.choices,
            ticked: offer === clash.winner ? offer.choiceId : null,
            onPick: (choiceId: string) => {
              const source = sources.find((s) => s.packId === offer.source.packId)!;
              choose(source, offer.rule.id, choiceId);
              onPick?.(clash.ruleKey, offer.source.packId);
            },
          }))}
        />
      ))}
      {noPacks && <p className="auth__meta">No setting rules picked, so there are no optional rules to choose.</p>}
      {shown.map((source) => {
        const changedCount = changedFirst(source.rules, source.choices).changed.length;
        const isOpen = open.includes(source.packId);
        return (
          <RuleSourceGroup
            key={source.packId}
            title={source.name}
            count={countLine(source.rules.length, changedCount)}
            open={isOpen}
            onToggle={() => setOpen(isOpen ? open.filter((id) => id !== source.packId) : [...open, source.packId])}
            rows={source.rules.map((rule) => ({ id: rule.id, changed: choiceOf(rule, source.choices) !== rule.defaultChoice, row: row(source, rule) }))}
            top={<RulePresets presets={source.presets ?? []} onOpen={(presetId) => setPreview(presetChanges(sources, source.packId, presetId, { attaching: true }))} />}
          />
        );
      })}
      {preview && (
        <RulePresetPreview
          name={preview.preset.name}
          notes={preview.preset.notes}
          moves={preview.moves}
          kept={preview.kept}
          onClose={() => setPreview(null)}
          onUse={() => {
            const { changes, preset, moves } = preview;
            apply(changes, 'next');
            toast({ text: `${preset.name}: ${moves.length === 1 ? '1 rule' : `${moves.length} rules`} changed`, onUndo: () => apply(changes, 'previous') });
          }}
        />
      )}
      {encumbrance && (
        <section className="new-campaign__options" aria-label="For the whole campaign">
          <RuleRow
            name="Encumbrance"
            about={encumbrance.about}
            source={`The app, ${WHEN_WORDS.warn}`}
            choices={encumbrance.choices}
            current={encumbrance.current}
            defaultChoice={encumbrance.defaultChoice}
            onChoose={encumbrance.onChoose}
          />
        </section>
      )}
      {after}
    </CreationStep>
  );
}

