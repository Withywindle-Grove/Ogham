// The Urgent strip's sources (docs/05-features.md "Urgent strip"; M4 framework, ruled 2026-10-23). A source says
// what's urgent for a character right now (a light about to go out, a status ending, ready to level) and how it
// is dealt with; the strip on the Player screen shows every item, even when its section is hidden, until then.
// Real sources arrive with their milestones (lights M5, statuses M6, levels M7); each decides its own "dealt
// with" rule. Modules register sources here; core knows nothing about them.

export interface UrgentItem {
  /** Unique among this source's items. */
  key: string;
  /** The Player screen section it belongs to (shown here even when that section is hidden). */
  section: string;
  text: string;
  /** How it's dealt with: dismiss ("OK") or go somewhere ("Review"). */
  action?: { label: string; run: () => void | Promise<void> };
}

export interface UrgentSource {
  id: string;
  items(context: { characterId: string; campaignId: string }): Promise<UrgentItem[]>;
}

const sources = new Map<string, UrgentSource>();

/** Adds a source; returns how to take it away again. */
export function registerUrgentSource(source: UrgentSource): () => void {
  sources.set(source.id, source);
  return () => {
    sources.delete(source.id);
  };
}

/** Everything urgent for this character, source by source (a source that fails shows nothing). */
export async function urgentItems(context: { characterId: string; campaignId: string }): Promise<(UrgentItem & { sourceId: string })[]> {
  const lists = await Promise.all(
    [...sources.values()].map(async (source) => {
      try {
        return (await source.items(context)).map((item) => ({ ...item, sourceId: source.id }));
      } catch {
        return [];
      }
    }),
  );
  return lists.flat();
}
