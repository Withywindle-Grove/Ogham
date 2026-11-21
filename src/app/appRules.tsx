// The app's own rules (docs/05 "Rules for this campaign"; B15, lr-7), shared by Rules for this campaign and campaign
// creation's App section (tf-7, ruled 2026-11-03): the topic groups Characters · Items and treasure · Table and
// players, each rule a `CampaignRule` drawn by the same rows. Time and calendar stays the Rules tab's (it needs the
// clock). `appRuleSetting` turns a row's value into the setting it writes.
import type { ReactNode } from 'react';
import { BRAND } from '../brand.ts';
import {
  characterApprovalOf,
  oneOffApprovalOf,
  playersReorderOf,
  playersSeeHpOf,
  rechargeDefaultOf,
  START_LEVEL_WORDS,
  START_LEVELS,
  type StartLevel,
  startLevelFixedOf,
  startLevelOf,
} from '../core/campaignSettings.ts';
import { companiesOn } from '../core/companies.ts';
import type { Json } from '../core/database.types.ts';
import { readExploration } from '../modules/expedition/modes.ts';
import { gettingLostOf } from '../modules/expedition/travelPlay.ts';
import { weatherRolledByOf } from '../modules/expedition/weatherPlay.ts';
import type { CampaignRule, RuleGroup } from '../ui/organisms.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { Stepper } from '../ui/parts.tsx';

/** What a company is (A14, text ruled 2026-10-26): the Companies rule's ⓘ. */
export function CompaniesAbout({ onClose }: { onClose: () => void }) {
  return (
    <Dialog label="Companies" onClose={onClose}>
      <p className="reading">
        A company is the party's shared charter: how treasure is split and how votes go. You can play without one; the GM turns companies on in Rules
        for this campaign.
      </p>
      <div className="dialog__actions">
        <button type="button" className="button-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </Dialog>
  );
}

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

/** The setting a row's value writes: the start level and the two-way words as they are, Yes / No as true / false. */
export function appRuleSetting(ruleId: string, value: string): [string, Json] {
  if (ruleId === 'startLevel') return ['startLevel', value];
  if (ruleId === 'weatherRolledBy') return ['weatherRolledBy', value === 'gm' ? 'gm' : 'players'];
  if (ruleId === 'gettingLost') return ['gettingLost', value === 'open' ? 'open' : 'secret'];
  return [ruleId, value === 'yes'];
}

/**
 * The app's rules in their topic groups, read from the campaign's settings. `set` writes one setting (the fixed
 * level's stepper writes `startLevelFixed`); `onAboutCompanies` opens what a company is (A14). Getting lost and
 * Weather rolled by show only when the setting rules have a travel budget or weather.
 */
export function appRuleGroups(
  settings: Record<string, Json | undefined>,
  {
    set,
    onAboutCompanies,
    rulesSets,
  }: { set: (key: string, value: Json) => void; onAboutCompanies: () => void; rulesSets: readonly Record<string, unknown>[] },
): RuleGroup[] {
  const appName = BRAND.appName;
  const yesNo = (key: string, name: string, value: boolean, byDefault: boolean, more?: Partial<CampaignRule>): CampaignRule => ({
    id: key,
    name,
    source: appName,
    choices: YES_NO,
    value: value ? 'yes' : 'no',
    defaultValue: byDefault ? 'yes' : 'no',
    ...more,
  });

  const startAt = startLevelOf(settings);
  const meaning = (choice: StartLevel) =>
    choice === 'one'
      ? 'Everyone starts at the beginning.'
      : choice === 'lowest'
        ? 'Matches the lowest active character, worked out when each is made.'
        : choice === 'fixed'
          ? `Every new character starts at level ${startLevelFixedOf(settings)}, capped at each class's maximum.`
          : 'The player picks; you approve or ask for another.';
  const fixedLevel: ReactNode = (
    <Stepper label="fixed starting level" value={startLevelFixedOf(settings)} min={1} max={20} onChange={(value) => set('startLevelFixed', value)} />
  );

  const groups: RuleGroup[] = [
    {
      id: 'characters',
      name: 'Characters',
      rules: [
        yesNo('characterApproval', 'New characters need approval', characterApprovalOf(settings), true),
        {
          id: 'startLevel',
          name: 'New characters start at',
          source: appName,
          choices: START_LEVELS.map((choice) => ({
            value: choice,
            label: START_LEVEL_WORDS[choice],
            meaning: meaning(choice),
            // The level sits right under "Fixed level" (re-test 2026-10-26).
            extra: choice === 'fixed' && fixedLevel,
          })),
          value: startAt,
          defaultValue: 'one',
        },
      ],
    },
    {
      id: 'items',
      name: 'Items and treasure',
      rules: [
        yesNo('oneOffApproval', 'One-off items need approval', oneOffApprovalOf(settings), true),
        yesNo('rechargeDefault', 'Charged items can be recharged', rechargeDefaultOf(settings), false),
      ],
    },
    {
      id: 'table',
      name: 'Table and players',
      // A14 (ruled 2026-10-25; text ruled 2026-10-26): what a company is, one tap away.
      rules: [
        yesNo('companies', 'Companies', companiesOn(settings), true, { onInfo: onAboutCompanies }),
        // M5 step 8 (docs/04 playersReorderMarching, playersSeeHp; ruled 2026-10-25, M5-6): both Yes by default. "Show
        // each other's HP" (renamed 2026-10-30) only decides what the overview shows; keeping HP from players is M6's.
        yesNo('playersReorderMarching', 'Players can reorder marching order', playersReorderOf(settings), true),
        yesNo('playersSeeHp', "Show each other's HP", playersSeeHpOf(settings), true),
      ],
    },
  ];
  const table = groups.find((g) => g.id === 'table')!;

  // "Getting lost" (ruled 2026-10-30, S4-6; 2026-10-31 default Secret; 04 gettingLost): whether players see their
  // group's Lost status and its recovery roll; shown when a day-by-day mode has a travel budget (M5b step 1).
  const exploration = readExploration(rulesSets);
  if (exploration.modes.some((m) => m.pace === 'day' && m.wild.travel)) {
    table.rules.push({
      id: 'gettingLost',
      name: 'Getting lost',
      source: appName,
      choices: [
        { value: 'secret', label: 'Secret', meaning: "Only you see when the party is lost, and the roll to find the way." },
        { value: 'open', label: 'Open', meaning: 'Players see when their group is lost and may enter the roll; Found the way is still your call.' },
      ],
      value: gettingLostOf(settings),
      defaultValue: 'secret',
    });
  }
  // "Weather rolled by" (ruled 2026-10-30, D1; 04 weatherRolledBy): who enters the weather roll, in Table and
  // players (it's who does what at the table); shown only when the setting rules have weather.
  const hasWeather = !!exploration.weather || exploration.modes.some((m) => m.weather || m.procedure.some((s) => s.kind === 'roll' && s.icon === 'weather'));
  if (hasWeather) {
    table.rules.push({
      id: 'weatherRolledBy',
      name: 'Weather rolled by',
      source: appName,
      choices: [
        { value: 'players', label: 'Players', meaning: 'Any player enters the roll; the first entry counts. You can enter it instead.' },
        { value: 'gm', label: 'GM', meaning: 'You enter the roll; players see the result and its effects.' },
      ],
      value: weatherRolledByOf(settings),
      defaultValue: 'players',
    });
  }
  return groups;
}
