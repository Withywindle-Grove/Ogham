// Rules for this campaign (B15, ruled 2026-10-25; rebuilt 2026-11-02, lr-7, lr-8): the GM's Rules tab opens on it.
// The app's own settings sit in fixed topic groups (Characters · Time and calendar · Items and treasure · Table and
// players), folded with a count line ("3 settings · 1 changed"); then the attached packs' optional rules, one folded
// group per source with set-up step 3's rows (`RuleRow`, `RuleSourceGroup`, `RuleKeyCard`), editable in place
// with Undo; then Character fields. On a phone one group is open at a time, on a tablet any number. Optional rules
// keep their rules: a locked one explains on tap; a "warn" one asks first. Every change is logged. The foot holds
// Copy the set-up (cs-set-1: a plain-text summary on the clipboard, `setupText.ts`), Reset to the books' defaults and
// the screen's `foot` (Retire campaign…, lr-8). Drawn by the gallery's organism
// (RulesForThisCampaign).
//   Options-gates build order 5 (bq3-13): an add-on (`requires`) shows only once its parent has the choice it needs,
// and a change that hides one sets it back to its default in the same logged change (A1); a change that moves the
// setting's load method moves the campaign's too, so every load is read again (A3); a pack's presets open a preview,
// then apply at once with Undo (A8). Each of these is one `rules.setOptions`, and its Undo one more.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { loadCampaignSettings, updateCampaign } from '../core/campaignCommands.ts';
import { encumbranceModeOf, ENCUMBRANCE_WORDS, ruleGroupPicksOf, startLevelFixedOf, withRuleGroupPick, type EncumbranceMode } from '../core/campaignSettings.ts';
import { copyText } from './clipboard.ts';
import { setupText } from './setupText.ts';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Json } from '../core/database.types.ts';
import type { Db } from '../core/supabase.ts';
import { setPackOptions, type CampaignPack } from '../modules/library/campaignPacks.ts';
import { readOptions, readPresets, type Choices, type OptionalRule } from '../modules/library/options.ts';
import {
  changedFirst,
  changesWith,
  choiceOf,
  countLine,
  decidedAbove,
  movesOf,
  offeredSources,
  presetChanges,
  ruleClashes,
  WHEN_WORDS,
  withExtends,
  type ChoicesChange,
  type PresetPlan,
  type RuleMove,
  type RuleSource,
} from '../modules/library/ruleGroups.ts';
import { stackOrder } from '../modules/library/stack.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { RulesForThisCampaign, type RuleGroup } from '../ui/organisms.tsx';
import { RuleKeyCard, RulePresetPreview, RulePresets, RuleRow } from '../ui/ruleRows.tsx';
import { loadMethodOf } from './loadMethod.ts';
import { usePhone } from './useWide.ts';
import { useSavedToast, useToast } from '../ui/ToastHost.tsx';
import { forgetCampaignSetting, loadCampaignSetting, type CampaignSetting } from './campaignSetting.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { useLogVersion } from './campaignLog.tsx';
import { registry } from './services.ts';
import { FieldsEditor } from './FieldsEditor.tsx';
import { appRuleGroups, appRuleSetting, CompaniesAbout } from './appRules.tsx';
import { CalendarStartForm, StartTimeForm, startWords } from './CalendarStart.tsx';
import { calendarStartOf, monthsOf, startIndex } from '../modules/expedition/clock.ts';
import { campaignUnits, DEFAULT_START_TIME, loadStartClock, setStartTime, startTimeOf, startTimeWords, type Clock } from '../modules/expedition/play.ts';
import { loadFieldDefinitions } from '../modules/characters/fields.ts';
import './EntryEditor.css';
import { fieldsAddedBy, withFieldsAdded } from '../modules/library/optionGate.ts';

type Settings = Record<string, Json | undefined>;

/** An optional-rules group's id: one per attached pack (lr-7). */
const sourceGroup = (linkId: string) => `optional:${linkId}`;
/** The Character fields group's id (N20). */
const CHARACTER_FIELDS = 'fields';
/** A phone keeps one group open at a time (lr-7); the phone breakpoint of docs/06 Layouts. */
const RETIRED_WORDS = 'This campaign is retired: nothing in it can change. Bring it back to change its rules.';

export function RulesForCampaign({
  db,
  user,
  campaign,
  focus = 0,
  fieldsVersion = 0,
  fieldsFocus = 0,
  foot,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  /** Bumped by "Change rules for this campaign": opens the optional-rules groups (the first, on a phone). */
  focus?: number;
  /** Bumped when setting rules add character fields (a sheet layout), so the Character fields group follows. */
  fieldsVersion?: number;
  /** Bumped by the homebrew's "Edit character fields": opens Character fields, even with none yet. */
  fieldsFocus?: number;
  /** At the screen's foot, after Reset to the books' defaults: Retire campaign… (lr-8). */
  foot?: ReactNode;
}) {
  const single = usePhone();
  const [settings, setSettings] = useState<Settings | null>(null);
  // Character fields (N20, ruled 2026-10-28): a collapsible group here, shown only when the campaign has fields
  // (the rules name them), or when the GM asked to edit them.
  const [fieldCount, setFieldCount] = useState(0);
  const [fieldsChanged, setFieldsChanged] = useState(0);
  const [setting, setSetting] = useState<CampaignSetting | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string[]>([]);
  const [about, setAbout] = useState<'companies' | null>(null);
  // A rule that asks first (warn): the change waiting, named by the rule and its new choice.
  const [asking, setAsking] = useState<{ option: OptionalRule; choiceName: string; plan: OptionsPlan } | null>(null);
  const [preview, setPreview] = useState<{ plan: PresetPlan; options: OptionsPlan } | null>(null);
  const [resetting, setResetting] = useState<{ names: string[]; apply: () => void } | null>(null);
  // Copy the set-up's text, shown when the clipboard is out of reach (cs-set-1).
  const [byHand, setByHand] = useState<string | null>(null);
  // The clock, for the first day's start time (B13): whether it has moved decides if the start time can still move it.
  const [startClock, setStartClock] = useState<{ clock: Clock; moved: boolean } | 'unread' | null>(null);
  const here = useRef<HTMLDivElement>(null);
  const toast = useToast();
  // Changes save at once; "Saved" follows the last one (ruled 2026-10-26).
  const savedToast = useSavedToast();
  const logVersion = useLogVersion();

  useEffect(() => {
    let current = true;
    void loadCampaignSettings(db, campaign.id).then((found) => current && setSettings(found ?? {}));
    void loadCampaignSetting(db, user.id, campaign.id).then((found) => current && setSetting(found));
    return () => {
      current = false;
    };
  }, [db, user.id, campaign.id, logVersion]);

  useEffect(() => {
    let current = true;
    void loadFieldDefinitions(db, campaign.id).then((found) => current && found && setFieldCount(found.length));
    return () => {
      current = false;
    };
  }, [db, campaign.id, logVersion, fieldsVersion, fieldsChanged]);

  useEffect(() => {
    if (!settings) return;
    let current = true;
    void loadStartClock(db, campaign.id, campaignUnits(settings, setting?.rulesSets ?? [])).then((found) => current && setStartClock(found ?? 'unread'));
    return () => {
      current = false;
    };
  }, [db, campaign.id, settings, setting, logVersion]);

  // The homebrew's "Edit character fields": open the Character fields group, then bring it into view.
  const [fieldsAsked, setFieldsAsked] = useState(fieldsFocus);
  if (fieldsFocus !== fieldsAsked) {
    setFieldsAsked(fieldsFocus);
    setOpen((now) => (single ? [CHARACTER_FIELDS] : now.includes(CHARACTER_FIELDS) ? now : [...now, CHARACTER_FIELDS]));
  }
  useEffect(() => {
    if (fieldsFocus === 0) return;
    const group = document.getElementById(`rules-group-${CHARACTER_FIELDS}`);
    group?.querySelector('button')?.focus();
    group?.scrollIntoView?.({ block: 'start' });
  }, [fieldsFocus]);

  // "Change rules for this campaign" (Setting rules): open the optional-rules groups (on a phone the first) and bring
  // them into view.
  useEffect(() => {
    if (focus === 0) return;
    let current = true;
    // Setting rules may have just changed (a pack added or updated): read them again first.
    forgetCampaignSetting(campaign.id);
    void loadCampaignSetting(db, user.id, campaign.id).then((found) => {
      if (!current) return;
      setSetting(found);
      const sources = (found ? stackOrder(found.packs) : []).filter((link) => found!.all.some((e) => e.kind === 'option' && e.packId === link.packId)).map((link) => sourceGroup(link.id));
      setOpen(single ? sources.slice(0, 1) : sources);
      here.current?.scrollIntoView?.({ block: 'start' });
    });
    return () => {
      current = false;
    };
    // `single` is read when asked, not followed: rotating the tablet doesn't reopen groups.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, user.id, campaign.id, focus]);

  if (!settings) return null;
  const retired = !!campaign.retiredAt;

  async function set(key: string, value: boolean | string | number | Json) {
    if (!settings || retired) return;
    setBusy(true);
    const next = { ...settings, [key]: value };
    const saved = await runCommand(registry, db, user, updateCampaign, { campaignId: campaign.id, settings: next as Json });
    setBusy(false);
    if (saved.ok) {
      setSettings(next);
      savedToast();
    } else toast({ text: saved.message });
  }

  // The first day's start time (B13): the setting and, while the clock hasn't moved, the clock, in one logged change.
  async function saveStartTime(next: { hour: number; minute: number }, clock: Clock) {
    if (!settings || retired || busy) return;
    setBusy(true);
    const saved = await runCommand(registry, db, user, setStartTime, { campaignId: campaign.id, start: next, clock, units: campaignUnits(settings, setting?.rulesSets ?? []) });
    setBusy(false);
    if (saved.ok) {
      setSettings({ ...settings, startTime: { hour: next.hour, minute: next.minute } });
      setStartClock({ clock: saved.value, moved: false });
      savedToast();
    } else toast({ text: saved.message });
  }

  // Packs' optional-rule choices, and the load method when it moves (A3), in one logged change (rules.setOptions).
  async function setOptions(changes: readonly { linkId: string; choices: Choices }[], mode: EncumbranceMode | undefined): Promise<boolean> {
    const [first, ...others] = changes;
    if (!first) return false;
    setBusy(true);
    const saved = await runCommand(registry, db, user, setPackOptions, {
      campaignId: campaign.id,
      campaignPackId: first.linkId,
      optionChoices: first.choices,
      others: others.map((c) => ({ campaignPackId: c.linkId, optionChoices: c.choices })),
      ...(mode ? { encumbranceMode: mode } : {}),
    });
    setBusy(false);
    if (!saved.ok) {
      toast({ text: saved.message, error: true });
      return false;
    }
    forgetCampaignSetting(campaign.id);
    if (mode && settings) setSettings({ ...settings, encumbrance: { ...(typeof settings.encumbrance === 'object' && settings.encumbrance && !Array.isArray(settings.encumbrance) ? settings.encumbrance : {}), mode } });
    setSetting(await loadCampaignSetting(db, user.id, campaign.id));
    return true;
  }

  // Undo over confirm (lr-7): the change happens at once; Undo saves what each had before again (a new logged change).
  async function changeOptions(plan: OptionsPlan, text: string) {
    const done = await setOptions(plan.changes.map((c) => ({ linkId: c.linkId, choices: c.next })), plan.mode?.next);
    if (!done) return;
    toast({ text, onUndo: () => void setOptions(plan.changes.map((c) => ({ linkId: c.linkId, choices: c.previous })), plan.mode?.previous) });
  }

  // The app's own rules in their topic groups, shared with campaign creation's App section (tf-7; appRules.tsx).
  const groups: RuleGroup[] = appRuleGroups(settings, { set: (key, value) => void set(key, value), onAboutCompanies: () => setAbout('companies'), rulesSets: setting?.rulesSets ?? [] });

  // The fixed Time and calendar group (ruled 2026-10-30), before Table and players: the first day's start time (B13,
  // ruled 2026-11-01), for every campaign; and the calendar start (ruled 2026-10-29; 04 calendarStart) when the
  // setting rules have a calendar: empty until set, prefilled from the pack's calendar.defaultStart; "Which season?"
  // on Scene can set it too.
  const units = campaignUnits(settings, setting?.rulesSets ?? []);
  const savedStart = startTimeOf(settings.startTime);
  const start = savedStart ?? DEFAULT_START_TIME;
  const months = monthsOf(setting?.calendar ?? null);
  const chosen = calendarStartOf(settings.calendarStart);
  const fallback = calendarStartOf(setting?.calendar?.defaultStart);
  const calendarSummary =
    months.length === 0
      ? null
      : chosen && startIndex(months, chosen)
        ? `Calendar starts ${startWords(months, chosen)}`
        : fallback && startIndex(months, fallback)
          ? `Calendar starts ${startWords(months, fallback)} (the setting's)`
          : 'Calendar start not set';
  const startSummary = savedStart ? `Starts at ${startTimeWords(savedStart)}` : `Starts at ${startTimeWords(start)} (the default)`;
  groups.splice(groups.findIndex((g) => g.id === 'table'), 0, {
    id: 'time',
    name: 'Time and calendar',
    rules: [],
    summary: [startSummary, calendarSummary].filter(Boolean).join(', '),
    body: (
      <>
        <h4 className="label">Start time</h4>
        {startClock === null ? (
          <p className="time-strip__notes">Reading the clock…</p>
        ) : startClock === 'unread' ? (
          <p className="time-strip__notes">Couldn't read the clock. The start time is {startTimeWords(start)}; try again later to change it.</p>
        ) : (
          <StartTimeForm
            key={`${start.hour}-${start.minute}-${startClock.moved}`}
            start={start}
            moved={startClock.moved}
            hoursInDay={Math.floor(units.day! / units.hour!)}
            minutesInHour={Math.floor(units.hour! / 60)}
            onSave={(next) => void saveStartTime(next, startClock.clock)}
          />
        )}
        {months.length > 0 && (
          <>
            <h4 className="label">Calendar start</h4>
            <CalendarStartForm
              key={`${chosen?.month ?? fallback?.month ?? 0}-${chosen?.day ?? fallback?.day ?? 0}`}
              months={months}
              start={chosen ?? fallback}
              onSave={(next) => void set('calendarStart', { month: next.month, day: next.day })}
            />
          </>
        )}
      </>
    ),
  });

  // The app's own groups as they stand here, for Copy the set-up (cs-set-1).
  const appGroups = [...groups];

  // The attached packs' optional rules, one folded group per source after the topic groups (lr-7), top of the stack
  // first; the rows are set-up step 3's. A pack without optional rules says "none" and opens nothing.
  const links: CampaignPack[] = setting ? stackOrder(setting.packs) : [];
  // An option extending another pack's (of-1) shows on its base's row, its choices labelled by pack.
  const sources: (RuleSource & { link: CampaignPack })[] = withExtends(links.map((link) => ({
    link,
    packId: link.packId,
    name: link.name,
    shortName: link.shortName,
    kind: link.kind,
    rules: readOptions(setting!.all.filter((e) => e.kind === 'option' && e.packId === link.packId)),
    choices: link.optionChoices,
    presets: readPresets(setting!.all.filter((e) => e.kind === 'rulesSet' && e.packId === link.packId)),
  })));
  // The rules on offer (A1): an add-on whose parent hasn't the choice it needs is hidden, at its default.
  const shown = offeredSources(sources);
  // A `ruleKey` clash: one callout before the sources, "Decided above" in their rows; the winner is the GM's pick
  // (`settings.ruleGroups`), else the pack on top (one choice per group, 07; built in #283).
  const clashes = ruleClashes(shown, ruleGroupPicksOf(settings));
  const whyBlocked = (option: OptionalRule) => (retired ? RETIRED_WORDS : option.changeLater === 'lock' ? `${option.name} can't change once the campaign has started.` : undefined);

  // A change of choices as it would be saved: each pack's (an add-on it hides back to its default, A1), the rules it
  // moves, and the load method when the setting's moves with it (A3: read as at set-up, loadMethod.ts).
  function planOf(changes: readonly ChoicesChange[]): OptionsPlan {
    const linkOf = new Map(sources.map((s) => [s.packId, s.link.id]));
    const entriesOf = (packId: string) => setting?.all.filter((e) => e.packId === packId) ?? [];
    const bottomUp = [...sources].reverse();
    const before = loadMethodOf(bottomUp.map((s) => ({ entries: entriesOf(s.packId), choices: s.choices })));
    const nextOf = (s: RuleSource) => changes.find((c) => c.packId === s.packId)?.next ?? s.choices;
    const after = loadMethodOf(bottomUp.map((s) => ({ entries: entriesOf(s.packId), choices: nextOf(s) })));
    const current = encumbranceModeOf(settings);
    return {
      changes: changes.map((c) => ({ linkId: linkOf.get(c.packId)!, previous: c.previous, next: c.next })),
      moves: movesOf(sources, changes),
      mode: before !== after && after !== current ? { previous: current, next: after } : null,
    };
  }

  // The toast's words: each rule moved ("Cantrips: Off · Read magic cantrip: Off"), then the load method.
  const planWords = (plan: OptionsPlan) =>
    [...plan.moves.map((m) => `${m.name}: ${m.to}`), ...(plan.mode ? [`Load method: ${ENCUMBRANCE_WORDS[plan.mode.next].name}`] : [])].join(', ');

  function chooseOption(link: CampaignPack, option: OptionalRule, choiceId: string) {
    const blocked = whyBlocked(option);
    if (blocked) return toast({ text: blocked });
    if (busy || choiceId === choiceOf(option, link.optionChoices)) return;
    const plan = planOf(changesWith(sources, { [link.packId]: { ...link.optionChoices, [option.id]: choiceId } }));
    if (plan.changes.length === 0) return;
    // The rule chosen first in the words, then what moves with it.
    plan.moves.sort((a, b) => Number(b.ruleId === option.id) - Number(a.ruleId === option.id));
    // "Asks first" (warn), for the rule or any add-on it moves: the preview, then the change with Undo.
    const warns = plan.moves.some((m) => sources.find((s) => s.packId === m.packId)?.rules.find((r) => r.id === m.ruleId)?.changeLater === 'warn');
    const named = plan.moves.find((m) => m.ruleId === option.id)?.to ?? choiceId;
    if (warns) return setAsking({ option, choiceName: named, plan });
    void changeOptions(plan, planWords(plan));
  }

  // A pack's preset (A8): its preview first (05: a preview and a confirm), then at once with Undo.
  function openPreset(packId: string, presetId: string) {
    if (retired) return toast({ text: RETIRED_WORDS });
    if (busy) return;
    const plan = presetChanges(sources, packId, presetId, { attaching: false });
    if (plan) setPreview({ plan, options: planOf(plan.changes) });
  }

  const rowOf = (source: (typeof sources)[number], option: OptionalRule) => (
    <RuleRow
      key={option.id}
      name={option.name}
      about={withFieldsAdded(option.notes, fieldsAddedBy(setting?.all ?? [], option.id))}
      source={[source.shortName, option.source, WHEN_WORDS[option.changeLater]].filter(Boolean).join(', ')}
      choices={option.choices}
      current={choiceOf(option, source.choices)}
      defaultChoice={option.defaultChoice}
      decided={decidedAbove(clashes, source.packId, option)}
      manual={option.manual}
      blocked={whyBlocked(option)}
      onBlocked={(why) => toast({ text: why })}
      onChoose={(choiceId) => chooseOption(source.link, option, choiceId)}
    />
  );
  const clashCallouts =
    clashes.length > 0 ? (
      <>
        {clashes.map((clash) => (
          // tf-1: every pack's choices under its name; one tap sets that choice and picks that pack for the group.
          <RuleKeyCard
            key={clash.ruleKey}
            topic={clash.topic}
            packs={clash.offers.map((offer) => ({
              label: offer.source.shortName,
              choices: offer.rule.choices,
              ticked: offer === clash.winner ? offer.choiceId : null,
              onPick: (choiceId: string) => {
                const blocked = whyBlocked(offer.rule);
                if (blocked) return toast({ text: blocked });
                chooseOption(sources.find((s) => s.packId === offer.source.packId)!.link, offer.rule, choiceId);
                // That pack's rule now counts for the group (logged as a settings change).
                if (ruleGroupPicksOf(settings)[clash.ruleKey] !== offer.source.packId)
                  void set('ruleGroups', withRuleGroupPick(settings, clash.ruleKey, offer.source.packId).ruleGroups as Json);
              },
            }))}
          />
        ))}
      </>
    ) : undefined;
  shown.forEach((source, index) => {
    const changedCount = changedFirst(source.rules, source.choices).changed.length;
    groups.push({
      id: sourceGroup(source.link.id),
      name: `Optional rules: ${source.name}`,
      rules: [],
      lead: index === 0 ? clashCallouts : undefined,
      source: {
        count: countLine(source.rules.length, changedCount),
        rows: source.rules.map((option) => ({ id: option.id, changed: choiceOf(option, source.choices) !== option.defaultChoice, row: rowOf(source, option) })),
        top: <RulePresets presets={source.presets ?? []} onOpen={(presetId) => openPreset(source.packId, presetId)} />,
      },
    });
  });

  // Character fields, after the optional rules (N20; lr-7): only when the campaign has fields, or the GM asked to
  // edit them (the homebrew's "Edit character fields"), or there are no setting rules at all (then the GM's fields
  // are the only way to describe a character).
  if (fieldCount > 0 || fieldsFocus > 0 || (setting !== null && setting.packs.length === 0)) {
    groups.push({
      id: CHARACTER_FIELDS,
      name: 'Character fields',
      rules: [],
      summary: fieldCount === 0 ? 'None yet' : fieldCount === 1 ? '1 field' : `${fieldCount} fields`,
      body: <FieldsEditor key={fieldsVersion} db={db} user={user} campaign={campaign} onChanged={() => setFieldsChanged((n) => n + 1)} />,
    });
  }

  // Reset to the books' defaults (lr-6, lr-7): locked rules stay as chosen; rules that ask first are named, and it
  // asks; then it happens at once with Undo.
  function resetToDefaults() {
    if (retired) return toast({ text: RETIRED_WORDS });
    if (busy) return;
    const edits: Record<string, Choices> = {};
    for (const { packId, rules, choices } of sources) {
      const next = { ...choices };
      for (const o of rules) if (o.changeLater !== 'lock' && choiceOf(o, choices) !== o.defaultChoice) next[o.id] = o.defaultChoice;
      edits[packId] = next;
    }
    const plan = planOf(changesWith(sources, edits));
    if (plan.changes.length === 0) return toast({ text: "The optional rules are at the books' defaults already. Locked ones stay as chosen." });
    const apply = () => void changeOptions(plan, "Optional rules reset to the books' defaults");
    const names = plan.moves.filter((m) => sources.find((s) => s.packId === m.packId)?.rules.find((r) => r.id === m.ruleId)?.changeLater === 'warn').map((m) => m.name);
    if (names.length > 0) setResetting({ names, apply });
    else apply();
  }
  const hasOptions = shown.some((s) => s.rules.length > 0);

  // Copy the set-up (cs-set-1): a plain-text summary on the clipboard, with a toast; a read, so no command and no
  // log line. Where the clipboard is out of reach (plain http, an older browser) the summary opens to copy by hand.
  async function copySetup() {
    // Before the setting rules have opened, the summary would leave out the packs: say so instead.
    if (!setting) return toast({ text: "The setting rules haven't opened yet. Try again in a moment." });
    const text = setupText({
      campaignName: campaign.name,
      packs: links.map((link) => ({ name: link.name, version: link.version })),
      appGroups,
      fixedLevel: startLevelFixedOf(settings),
      sources: shown,
      clashes,
    });
    if (await copyText(text)) toast({ text: 'Set-up copied' });
    else setByHand(text);
  }

  function change(ruleId: string, value: string) {
    if (busy) return;
    void set(...appRuleSetting(ruleId, value));
  }

  return (
    <div ref={here} className="campaign-rules__screen">
      <h3 className="label">Rules for this campaign</h3>
      <RulesForThisCampaign groups={groups} onChange={change} open={open} onOpen={setOpen} single={single} />
      {/* The foot (lr-8): Copy the set-up (cs-set-1), Reset to the books' defaults when there are optional rules, then
          Retire campaign…. */}
      <div className="campaign-rules__foot">
        <button type="button" className="button-secondary button-secondary--small" onClick={() => void copySetup()}>
          Copy the set-up
        </button>
        {hasOptions && (
          <button type="button" className="button-secondary button-secondary--small" onClick={resetToDefaults}>
            Reset to the books' defaults
          </button>
        )}
        {foot}
      </div>
      {about === 'companies' && (
        <CompaniesAbout onClose={() => setAbout(null)} />
      )}
      {asking && (
        <Dialog label={`Change ${asking.option.name}?`} onClose={() => setAsking(null)}>
          <p className="reading">Changing it mid-campaign can leave characters and items out of step with the new rule. {asking.option.notes}</p>
          {alsoLines(asking.plan, asking.option.id).map((line) => (
            <p key={line} className="reading">
              {line}
            </p>
          ))}
          <div className="dialog__actions">
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                const { plan } = asking;
                setAsking(null);
                void changeOptions(plan, planWords(plan));
              }}
            >
              Change to {asking.choiceName}
            </button>
            <button type="button" className="button-secondary button-secondary--small" onClick={() => setAsking(null)}>
              Not now
            </button>
          </div>
        </Dialog>
      )}
      {preview && (
        <RulePresetPreview
          name={preview.plan.preset.name}
          notes={preview.plan.preset.notes}
          moves={preview.plan.moves}
          also={alsoLines(preview.options, null)}
          kept={preview.plan.kept}
          onClose={() => setPreview(null)}
          onUse={() => void changeOptions(preview.options, `${preview.plan.preset.name}: ${preview.plan.moves.length === 1 ? '1 rule' : `${preview.plan.moves.length} rules`} changed`)}
        />
      )}
      {byHand !== null && (
        <Dialog label="The set-up" onClose={() => setByHand(null)}>
          <p className="reading">Couldn't copy it here. Select the text below and copy it by hand.</p>
          <pre className="campaign-rules__setup">{byHand}</pre>
          <div className="dialog__actions">
            <button type="button" className="button-primary" onClick={() => setByHand(null)}>
              Done
            </button>
          </div>
        </Dialog>
      )}
      {resetting && (
        <Dialog label="Reset to the books' defaults?" onClose={() => setResetting(null)}>
          <p className="reading">
            This changes {resetting.names.join(', ')}. Changing {resetting.names.length === 1 ? 'it' : 'them'} mid-campaign can affect characters and
            records made under the old rule.
          </p>
          <div className="dialog__actions">
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                const { apply } = resetting;
                setResetting(null);
                apply();
              }}
            >
              Reset
            </button>
            <button type="button" className="button-secondary button-secondary--small" onClick={() => setResetting(null)}>
              Not now
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/** A change of optional rules as it is saved (one `rules.setOptions`): each link's choices before and after, the rules
 * it moves, and the campaign's load method when it moves (A3). */
interface OptionsPlan {
  changes: { linkId: string; previous: Choices; next: Choices }[];
  moves: RuleMove[];
  mode: { previous: EncumbranceMode; next: EncumbranceMode } | null;
}

/**
 * The lines a preview adds about what else moves: each add-on the change sets back ("Read magic cantrip goes back to
 * Off: it needs Cantrips."), then the load method ("The load method becomes Slots: every character's load is read
 * again."). `own` is the rule the GM chose, left out.
 */
function alsoLines(plan: OptionsPlan, own: string | null): string[] {
  const others = own ? plan.moves.filter((m: RuleMove) => m.ruleId !== own) : [];
  return [
    ...others.map((m) => `${m.name} goes back to ${m.to} with it.`),
    ...(plan.mode ? [`The load method becomes ${ENCUMBRANCE_WORDS[plan.mode.next].name}: every character's load is read again.`] : []),
  ];
}
