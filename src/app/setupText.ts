// Copy the set-up (cs-set-1, ruled 2026-11-10, design/rulings/m5b-rewalk-campaign-setup-2026-11-10.md): the GM's
// Rules tab puts a plain-text summary of the campaign's set-up on the clipboard, for pasting to a tester, a player or
// a bug report. In order: the campaign's name; each attached pack with its version (top of the stack first); the start
// level and the app's own settings; then every optional rule as "<rule>: <choice>" in the pack's words, the ones that
// differ from the book first. It holds only what players can read too (the campaign's settings and the packs' option
// choices): no GM-only tables or notes.
import type { CampaignRule, RuleGroup } from '../ui/organisms.tsx';
import { changedFirst, choiceName, choiceOf, decidedAbove, type RuleClash, type RuleSource } from '../modules/library/ruleGroups.ts';

export interface SetupTextInput {
  campaignName: string;
  /** The attached packs, top of the stack first. */
  packs: readonly { name: string; version: string }[];
  /** The app's rules in their topic groups (`appRuleGroups`), with the Time and calendar group's `summary`. */
  appGroups: readonly RuleGroup[];
  /** The fixed starting level, said with "Fixed level". */
  fixedLevel: number;
  /** The optional rules on offer, one source per pack (`offeredSources`). */
  sources: readonly RuleSource[];
  /** The `ruleKey` clashes the Rules tab shows (`ruleClashes`): a rule another pack decides says so on its line. */
  clashes?: readonly RuleClash[];
}

const line = (text: string) => `- ${text}`;

/** A rule of the app's as "<name>: <choice>"; the fixed start level says which level. */
function appRuleLine(rule: CampaignRule, fixedLevel: number): string {
  const label = rule.choices.find((c) => c.value === rule.value)?.label ?? rule.value;
  return `${rule.name}: ${label}${rule.id === 'startLevel' && rule.value === 'fixed' ? ` (level ${fixedLevel})` : ''}`;
}

export function setupText({ campaignName, packs, appGroups, fixedLevel, sources, clashes = [] }: SetupTextInput): string {
  const parts: string[][] = [[campaignName]];

  // A pack without a version says only its name.
  const packLine = (p: { name: string; version: string }) => line(p.version.trim() ? `${p.name}, version ${p.version.trim()}` : p.name);
  parts.push(['Setting rules', ...(packs.length === 0 ? [line('None attached')] : packs.map(packLine))]);

  const appRules = appGroups.flatMap((g) => g.rules);
  const start = appRules.find((r) => r.id === 'startLevel');
  if (start) parts.push([appRuleLine(start, fixedLevel)]);
  const settings = appGroups.flatMap((g) => [...g.rules.filter((r) => r.id !== 'startLevel').map((r) => appRuleLine(r, fixedLevel)), ...(g.summary ? [g.summary] : [])]);
  parts.push(['App settings', ...settings.map(line)]);

  // A rule's name is the pack's; with several packs offering rules, each line says whose it is. A rule another pack
  // decides (a `ruleKey` clash) says which pack and choice count, as its row on the Rules tab does.
  const offering = sources.filter((s) => s.rules.length > 0);
  const several = offering.length > 1;
  const ruleLine = (source: RuleSource, rule: RuleSource['rules'][number]) => {
    const decided = decidedAbove(clashes, source.packId, rule);
    const note = decided ? ` (${decided.charAt(0).toLowerCase()}${decided.slice(1)})` : '';
    return line(`${rule.name}${several ? ` (${source.shortName})` : ''}: ${choiceName(rule, choiceOf(rule, source.choices))}${note}`);
  };
  const changed = offering.flatMap((s) => changedFirst(s.rules, s.choices).changed.map((r) => ruleLine(s, r)));
  const rest = offering.flatMap((s) => changedFirst(s.rules, s.choices).rest.map((r) => ruleLine(s, r)));
  if (offering.length === 0) parts.push(['Optional rules', line('None')]);
  else {
    parts.push(['Optional rules changed from the book', ...(changed.length === 0 ? [line('None')] : changed)]);
    if (rest.length > 0) parts.push(['Optional rules as the book has them', ...rest]);
  }

  return `${parts.map((p) => p.join('\n')).join('\n\n')}\n`;
}
