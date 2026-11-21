// The pack's common player actions (07 `exploration.playerActions`, added 2026-10-31; ruled 2026-10-30, DG10): a
// grouped reference. Reference only: no cost, chance or table. The top rules set that lists any wins (as the stack
// does). Pure. Players' Something else… that showed it was removed at the M5 gate (A5); the list moves to the GM
// reference screen (B4), which will read it from here. The players' Activities on their Scene read it again (mc-45a,
// plan dec-9-the-players-scene P6): only those with rule text, each opening its rule.

export interface PlayerAction {
  id: string;
  name: string;
  /** The heading it sorts under ("Doors", "Searching"); actions without one go under "Other". */
  group: string;
  text: string;
  /** Its page reference, if the pack gives one. */
  source: string | null;
}

export interface ActionGroup {
  name: string;
  actions: PlayerAction[];
}

/** The heading for actions the pack gives no group. */
export const OTHER_GROUP = 'Other';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const words = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** The common player actions of the highest rules set (lowest first in `rulesSets`) that lists any. */
export function readPlayerActions(rulesSets: readonly Record<string, unknown>[]): PlayerAction[] {
  for (const rules of [...rulesSets].reverse()) {
    const listed = isRecord(rules.exploration) && Array.isArray(rules.exploration.playerActions) ? rules.exploration.playerActions : [];
    const actions = listed.filter(isRecord).flatMap((a, i): PlayerAction[] => {
      const name = words(a.name);
      if (!name) return [];
      return [{ id: words(a.id) ?? `action-${i}`, name, group: words(a.group) ?? OTHER_GROUP, text: words(a.text) ?? '', source: words(a.source) }];
    });
    if (actions.length > 0) return actions;
  }
  return [];
}

/**
 * The players' Activities (plan dec-9-the-players-scene P6; mc-45a, 2026-11-12; frames 01-08, 01-08e, 01-08j): a
 * player's aid, not something the app does. The common player actions whose rule the pack carries, in the pack's order
 * and words; one the pack names without rule text is left out, and none at all means no block. A tap opens the rule;
 * nothing is proposed.
 */
export function activitiesWithRules(rulesSets: readonly Record<string, unknown>[]): PlayerAction[] {
  return readPlayerActions(rulesSets).filter((a) => a.text !== '');
}

/** Grouped in the pack's order of first appearance ("Other" last), keeping only the actions the search finds. */
export function groupActions(actions: readonly PlayerAction[], search = ''): ActionGroup[] {
  const query = search.trim().toLowerCase();
  const found = query ? actions.filter((a) => `${a.name} ${a.group} ${a.text}`.toLowerCase().includes(query)) : actions;
  const groups = new Map<string, PlayerAction[]>();
  for (const action of found) groups.set(action.group, [...(groups.get(action.group) ?? []), action]);
  const ordered = [...groups.entries()].filter(([name]) => name !== OTHER_GROUP);
  const other = groups.get(OTHER_GROUP);
  return [...ordered, ...(other ? [[OTHER_GROUP, other] as const] : [])].map(([name, list]) => ({ name, actions: list }));
}
