import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createCampaign, updateCampaign } from '../core/campaignCommands.ts';
import {
  DEFAULT_TIME,
  ENCUMBRANCE_MODES,
  ENCUMBRANCE_WORDS,
  readTime,
  startingSettings,
  type EncumbranceMode,
} from '../core/campaignSettings.ts';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { loadCurrentUser } from '../core/currentUser.ts';
import type { Json } from '../core/database.types.ts';
import type { Db } from '../core/supabase.ts';
import { applySheetLayout } from '../modules/characters/fields.ts';
import { attachPack } from '../modules/library/campaignPacks.ts';
import { importPack, loadLibrary, loadPackEntries, type LibraryPack } from '../modules/library/library.ts';
import { campaignPresets, defaultChoices, readOptions, readPresets, resolveRules, type Choices } from '../modules/library/options.ts';
import type { PackEntry, ReadPack } from '../modules/library/packFile.ts';
import { missingBases, missingWords, withExtends, type RuleSource } from '../modules/library/ruleGroups.ts';
import { layoutFields } from '../modules/library/sheetLayout.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { metaIdOf, SetupPacksStep, SetupRulesStep, shortNameOf } from './CampaignSetupSteps.tsx';
import { readChosenPack, savePackPictures, type ChosenBundle } from './packImport.ts';
import { PackPreview } from './PackPreview.tsx';
import { registry } from './services.ts';
import { appRuleGroups, appRuleSetting, CompaniesAbout } from './appRules.tsx';
import { loadMethodOf, loadSwitchesOf, modesOfferedBy } from './loadMethod.ts';
import './NewCampaign.css';
import { ErrorToast, useToast } from '../ui/ToastHost.tsx';

const STEPS = ['Name', 'Setting rules', 'Optional rules'] as const;
type Typed = { roundSeconds: string; turnMinutes: string; dayHours: string };

// Starting a campaign: name → setting rules → optional rules (with the Encumbrance row). Time lengths come from
// the setting rules (ruled 2026-10-24; M4b gate item 2). Steps 2 and 3 sit on the creation step shell (lr-5, lr-6,
// 2026-11-02; CampaignSetupSteps.tsx); the name step is a plain form.
// Only the name is needed; every later step starts at its defaults (or what the chosen setting rules preset),
// and "Create campaign now" skips the rest. Nothing is saved until the campaign is created at the end.
export function NewCampaign({
  db,
  user,
  onCreated,
  onCancel,
}: {
  db: Db;
  user: CurrentUser;
  onCreated: (campaign: OpenCampaign) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [library, setLibrary] = useState<LibraryPack[] | null | 'error'>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [entries, setEntries] = useState<Record<string, PackEntry[]>>({});
  const [choices, setChoices] = useState<Record<string, Choices>>({});
  // The GM's picks for the `ruleKey` groups (which pack's rule counts; one choice per group, 07), by ruleKey.
  const [groupPicks, setGroupPicks] = useState<Record<string, string>>({});
  const [encumbrance, setEncumbrance] = useState<EncumbranceMode | null>(null);
  // The app's own rules chosen in the App section (tf-7), saved with the starting settings on Create. A new campaign starts characters at level 1 (cw-3).
  const [appSettings, setAppSettings] = useState<Record<string, Json>>({ startLevel: 'one' });
  const [aboutCompanies, setAboutCompanies] = useState(false);
  const [importing, setImporting] = useState<ReadPack | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Use this sheet layout" for picked setting rules that have one: offered on the last step, on by default there.
  const [useLayout, setUseLayout] = useState(true);
  const [halfDone, setHalfDone] = useState<{ campaign: OpenCampaign; message: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const firstStep = useRef(true);
  /** The bundle the file being imported came in, when it is one (B14). */
  const bundle = useRef<ChosenBundle | undefined>(undefined);
  const toast = useToast();

  useEffect(() => {
    let current = true;
    loadLibrary(db, user.id).then(
      (found) => current && setLibrary(found ?? 'error'),
      () => current && setLibrary('error'),
    );
    return () => {
      current = false;
    };
  }, [db, user.id]);

  // Each new step starts at the top of the page (M5 gate fix: it kept the last step's scroll) and is announced by
  // moving to its heading (not on first opening, where the name box takes focus).
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    window.scrollTo?.({ top: 0 });
    // The name step's heading, or the shell's title (made focusable here, for screen readers).
    const title = heading.current ?? page.current?.querySelector<HTMLHeadingElement>('h1') ?? null;
    if (title && !title.hasAttribute('tabindex')) title.tabIndex = -1;
    title?.focus({ preventScroll: true });
  }, [step]);

  const packs = Array.isArray(library) ? library : [];
  const chosen = picked.map((id) => ({ id, name: packs.find((p) => p.id === id)?.name ?? 'Setting rules', entries: entries[id] ?? [] }));
  const presets = campaignPresets(chosen.map((p) => ({ entries: p.entries, choices: choices[p.id] ?? {} })));
  const packChoices = chosen.map((p) => ({ entries: p.entries, choices: choices[p.id] ?? {} }));
  // A mode is offered only when the chosen setting rules give its data (2026-10-23); "Not tracked" always is.
  const offered = modesOfferedBy(packChoices);
  const rulesSets = chosen.flatMap((p) => p.entries.filter((e) => e.kind === 'rulesSet').map((e) => resolveRules(e.data, choices[p.id] ?? {}) as Record<string, unknown>));
  const setApp = (key: string, value: Json) => setAppSettings((all) => ({ ...all, [key]: value }));
  const appGroups = appRuleGroups(appSettings, { set: setApp, onAboutCompanies: () => setAboutCompanies(true), rulesSets });
  // The same reading as a later change of the rule (A3, loadMethod.ts).
  const presetMode = loadMethodOf(packChoices);
  // An option extending another picked pack's (of-1) shows on its base's row; its choice is the base's.
  const sources: RuleSource[] = withExtends(chosen.map((p) => {
    const pack = packs.find((l) => l.id === p.id);
    return {
      packId: p.id,
      name: p.name,
      shortName: pack ? shortNameOf(pack) : p.name,
      kind: pack?.kind ?? 'setting',
      rules: readOptions(p.entries),
      choices: choices[p.id] ?? {},
      presets: readPresets(p.entries),
    };
  }));
  // A pack option that moves the load method is the one switch for how load is carried (2026-10-24; gate check 4):
  // then the app's own Encumbrance row isn't shown and the option decides, as in Rules for this campaign (A3).
  // Read only where it matters (step 3, or a choice made there), not on every key of the name.
  const packCarries =
    (step === 2 || encumbrance !== null) &&
    loadSwitchesOf(sources.map((s) => ({ entries: entries[s.packId] ?? [], choices: s.choices, rules: s.rules }))).length > 0;
  const mode = !packCarries && encumbrance && offered.includes(encumbrance) ? encumbrance : presetMode;
  const presetTime = { ...DEFAULT_TIME, ...presets.time };
  // Time lengths come from the setting rules, or the usual ones (ruled 2026-10-24); the GM changes them later in Rules.
  const typed: Typed = {
    roundSeconds: String(presetTime.roundSeconds),
    turnMinutes: String(presetTime.turnMinutes),
    dayHours: String(presetTime.dayHours),
  };
  const time = readTime(typed);
  const pickedPacks = packs.filter((p) => picked.includes(p.id));
  const missing = missingBases(pickedPacks, packs, metaIdOf);

  function go(to: number) {
    setError(null);
    if (to > 0 && !name.trim()) {
      setStep(0);
      setError('Give the campaign a name.');
      return;
    }
    setStep(to);
  }

  /** The pack's entries, loaded once and kept (Browse and picking both need them); null when they couldn't load. */
  async function entriesOf(pack: LibraryPack): Promise<PackEntry[] | null> {
    const known = entries[pack.id];
    if (known) return known;
    const found = await loadPackEntries(db, pack.id);
    if (found) setEntries((all) => ({ ...all, [pack.id]: found }));
    return found ?? null;
  }

  async function pick(pack: LibraryPack) {
    if (picked.includes(pack.id)) {
      setPicked(picked.filter((id) => id !== pack.id));
      return;
    }
    if (busy) return toast({ text: 'One moment: the last pack is still opening.', error: true });
    setError(null);
    setBusy(true);
    const loaded = await entriesOf(pack);
    setBusy(false);
    if (!loaded) return toast({ text: `Couldn't open ${pack.name}. Check your connection and try again.`, error: true });
    setChoices((all) => ({ ...all, [pack.id]: all[pack.id] ?? defaultChoices(readOptions(loaded)) }));
    setPicked((now) => (now.includes(pack.id) ? now : [...now, pack.id]));
  }

  /** Step 2's Next: a picked pack whose base isn't picked stops it, saying what to do (lr-5). */
  function nextFromPacks() {
    if (busy) return;
    const first = missing[0];
    if (first) return toast({ text: missingWords(first), error: true });
    go(2);
  }

  /** Reset to the books' defaults (lr-6): every pack's rules and the Encumbrance row; Undo puts the choices back. */
  function resetRules() {
    const before = { choices, encumbrance, groupPicks };
    const reset = Object.fromEntries(picked.map((id) => [id, defaultChoices(readOptions(entries[id] ?? []))]));
    const same =
      encumbrance === null &&
      Object.keys(groupPicks).length === 0 &&
      picked.every((id) => Object.entries(reset[id] ?? {}).every(([rule, choice]) => (choices[id]?.[rule] ?? choice) === choice));
    if (same) return toast({ text: "Every rule is already at the books' defaults." });
    setChoices((all) => ({ ...all, ...reset }));
    setEncumbrance(null);
    setGroupPicks({});
    toast({
      text: "Back to the books' defaults",
      onUndo: () => {
        setChoices(before.choices);
        setEncumbrance(before.encumbrance);
        setGroupPicks(before.groupPicks);
      },
    });
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const read = await readChosenPack(event);
    if (!read) return;
    if (!read.ok) return setError(read.message);
    setError(null);
    bundle.current = read.bundle;
    setImporting(read.pack);
  }

  async function saveImport() {
    if (!importing) return;
    setBusy(true);
    const made = await runCommand(registry, db, user, importPack, { pack: importing });
    // A bundle's pictures are kept with the pack (B14); one that is missing is asked for at its place, as before.
    if (made.ok && bundle.current) await savePackPictures(db, user, { id: made.value, ownerUserId: user.id }, importing, bundle.current);
    setBusy(false);
    if (!made.ok) return setError(made.message);
    const packId = made.value;
    const fresh = await loadLibrary(db, user.id);
    if (fresh) setLibrary(fresh);
    setEntries((all) => ({ ...all, [packId]: importing.entries }));
    setChoices((all) => ({ ...all, [packId]: defaultChoices(readOptions(importing.entries)) }));
    setPicked((now) => [...now, packId]);
    setImporting(null);
  }

  async function create(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setStep(0);
      return setError('Give the campaign a name.');
    }
    if (!time.ok) return setError(time.message);
    setBusy(true);
    setError(null);
    const made = await runCommand(registry, db, user, createCampaign, { name: trimmed });
    if (!made.ok) {
      setBusy(false);
      return setError(made.message);
    }
    const campaign: OpenCampaign = { id: made.value, name: trimmed, role: 'gm', line: 'GM, No players yet' };
    // The new campaign's GM role isn't in the roles loaded at sign-in; the commands below need it.
    const gm = (await loadCurrentUser(db).catch(() => null)) ?? { ...user, roles: { ...user.roles, [campaign.id]: 'gm' as const } };
    const missed: string[] = [];
    for (const pack of chosen) {
      const attached = await runCommand(registry, db, gm, attachPack, { campaignId: campaign.id, packId: pack.id, optionChoices: choices[pack.id] ?? {} });
      if (!attached.ok) missed.push(pack.name);
    }
    // The starting settings first: they replace the settings, and the sheet layout may add to them ("HP is asked").
    // With the GM's picks for the ruleKey groups (one choice per group, 07), kept by pack id.
    const picksMade = Object.fromEntries(Object.entries(groupPicks).filter(([, packId]) => picked.includes(packId)));
    const saved = await runCommand(registry, db, gm, updateCampaign, {
      campaignId: campaign.id,
      settings: {
        ...(startingSettings({ encumbranceMode: mode, time: time.time }) as Record<string, Json>),
        ...appSettings,
        ...(Object.keys(picksMade).length > 0 ? { ruleGroups: picksMade } : {}),
      },
    });
    // Only if the GM saw the offer (the last step) and left it on.
    const layout = step === STEPS.length - 1 && useLayout ? chosen.flatMap((pack) => layoutFields(entries[pack.id] ?? [])) : [];
    if (layout.length > 0) {
      const laidOut = await runCommand(registry, db, gm, applySheetLayout, { campaignId: campaign.id, fields: layout });
      if (!laidOut.ok) missed.push('the sheet layout');
    }
    setBusy(false);
    if (missed.length === 0 && saved.ok) return onCreated(campaign);
    const parts = [
      missed.length > 0 && `${missed.join(', ')} couldn't be added; add ${missed.length === 1 ? 'it' : 'them'} from Campaign → Setting rules`,
      !saved.ok && "the encumbrance and time lengths couldn't be saved, so it starts with the app's defaults",
    ].filter(Boolean);
    setHalfDone({ campaign, message: `${trimmed} was made, but ${parts.join(', and ')}.` });
  }

  if (halfDone) {
    return (
      <section className="auth">
        <h1 className="auth__title">{halfDone.campaign.name}</h1>
        <p className="form-error" role="alert">
          {halfDone.message}
        </p>
        <button type="button" className="button-primary" onClick={() => onCreated(halfDone.campaign)}>
          Open the campaign
        </button>
      </section>
    );
  }

  if (importing) {
    return (
      <section className="auth new-campaign">
        <PackPreview
          preview={{ mode: 'import', pack: importing }}
          busy={busy}
          onSave={() => void saveImport()}
          onCancel={() => setImporting(null)}
          attached={picked.flatMap((id) => {
            const pack = Array.isArray(library) ? library.find((p) => p.id === id) : undefined;
            return pack ? [{ name: pack.name, entries: entries[id] ?? [] }] : [];
          })}
        />
        <ErrorToast message={error} />
      </section>
    );
  }

  const withLayout = chosen.filter((pack) => layoutFields(entries[pack.id] ?? []).length > 0);
  const counter = (at: number) => ({ at, of: STEPS.length });

  if (step === 1) {
    const first = missing[0];
    const hint = first
      ? missingWords(first)
      : picked.length === 0
        ? 'Nothing picked, you can add setting rules later'
        : picked.length === 1
          ? '1 picked'
          : `${picked.length} picked, where two have the same entry, the one on top wins`;
    return (
      <div className="new-campaign new-campaign--shell" ref={page}>
        <SetupPacksStep
          library={library}
          picked={picked}
          hint={hint}
          onPick={(pack) => void pick(pack)}
          loadEntries={entriesOf}
          onImport={(event) => void readFile(event)}
          onBack={() => go(0)}
          onNext={nextFromPacks}
          onCreateNow={() => void create()}
          busy={busy}
          counter={counter(2)}
        />
        <ErrorToast message={error} />
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="new-campaign new-campaign--shell" ref={page}>
        <SetupRulesStep
          sources={sources}
          noPacks={picked.length === 0}
          encumbrance={
            packCarries
              ? undefined
              : {
                  // Encumbrance is one optional-rules row (ruled 2026-10-24): only the modes the setting rules give data for.
                  choices: ENCUMBRANCE_MODES.filter((m) => offered.includes(m)).map((m) => ({ id: m, name: ENCUMBRANCE_WORDS[m].name, notes: ENCUMBRANCE_WORDS[m].about })),
                  current: mode,
                  defaultChoice: presetMode,
                  about: ENCUMBRANCE_WORDS[mode].about,
                  onChoose: (m) => setEncumbrance(m as EncumbranceMode),
                }
          }
          onChoices={(packId, next) => setChoices((all) => ({ ...all, [packId]: next }))}
          app={{ groups: appGroups, onChange: (ruleId, value) => setApp(...appRuleSetting(ruleId, value)) }}
          picks={groupPicks}
          onPick={(ruleKey, packId) => setGroupPicks((all) => ({ ...all, [ruleKey]: packId }))}
          onReset={resetRules}
          onBack={() => go(1)}
          onCreate={() => void create()}
          busy={busy}
          counter={counter(3)}
          after={
            withLayout.length > 0 && (
              <div className="field">
                <label className="new-campaign__layout">
                  <input type="checkbox" checked={useLayout} onChange={(event) => setUseLayout(event.target.checked)} />
                  <span>Use the sheet layout from {withLayout.map((pack) => pack.name).join(', ')} for characters</span>
                </label>
                <p className="auth__meta">
                  {withLayout
                    .flatMap((pack) => layoutFields(entries[pack.id] ?? []))
                    .map((field) => (field.label ?? field.key ?? '').trim())
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            )
          }
        />
        {aboutCompanies && <CompaniesAbout onClose={() => setAboutCompanies(false)} />}
        <ErrorToast message={error} />
      </div>
    );
  }

  return (
    <form className="auth new-campaign" onSubmit={(event) => (event.preventDefault(), go(1))} noValidate>
      <div className="new-campaign__head">
        <span className="auth__meta">{`New campaign, step 1 of ${STEPS.length}`}</span>
        <h1 className="auth__title" ref={heading} tabIndex={-1}>
          Start a new campaign
        </h1>
      </div>
      <p>You'll be its GM. You can invite players once it's made.</p>
      <div className="field">
        <label className="label" htmlFor="campaign-name">
          Campaign name
        </label>
        <input
          id="campaign-name"
          className="field__input"
          type="text"
          autoComplete="off"
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-describedby={error ? 'new-campaign-error' : undefined}
        />
      </div>

      {error && (
        <p id="new-campaign-error" className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="footer-buttons">
        <button type="button" className="button-secondary" onClick={() => (busy ? toast({ text: 'One moment: the campaign is being made.', error: true }) : onCancel())}>
          Cancel
        </button>
        <button type="submit" className="button-primary">
          Next: setting rules
        </button>
      </div>
      <button type="button" className="button-secondary button-secondary--small" onClick={() => void create()}>
        {busy ? 'Creating…' : 'Create campaign now'}
      </button>
    </form>
  );
}
