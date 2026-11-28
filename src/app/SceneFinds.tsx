// The find card on the Scene (K18d of docs/plans/dec-6-the-whole-pack-tab.md; page 45's FD1c C, approved 2026-11-26;
// p45-3 and p45-23): what another person put in the player's character's pack or purse, in the prompt slot and nowhere
// else on that tab, at every width. It takes the calls' one place (CallsInPromptSlot's `find`), so it comes after the
// rest and light prompts and before a call card, one of the two at a time. It is K18b's `FindCard`, given K20a's
// entries (`loadPlayerFinds`, as the Player screen's other tabs read them), drawn with `live={false}` inside the slot's
// one live region.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { useLogVersion } from './campaignLog.tsx';
import { FindCard } from './FindCard.tsx';
import { useFindsGotIt } from './FindCardHost.tsx';
import { loadPlayerFinds, type PlayerFinds } from './packFinds.ts';

/**
 * The Scene's find card for `characterId` (the player's active character; null draws none), or null when nothing is new.
 * "Got it" writes the mark once, with no toast; the Pack's tags and the count follow through the log's reload
 * (`useFindsGotIt`). Offline it writes nothing and shows FD9's box; a refusal keeps the card under the error toast.
 */
export function useSceneFinds({ db, user, campaignId, characterId, onOpenPack }: { db: Db; user: CurrentUser; campaignId: string; characterId: string | null; /** "and N more": the Pack at the new rows, when the host can open it. */ onOpenPack?: () => void }): ReactNode {
  const logVersion = useLogVersion();
  const [loaded, setLoaded] = useState<PlayerFinds | null>(null);
  const load = useCallback(async () => (characterId ? loadPlayerFinds(db, user, campaignId, characterId).catch(() => null) : null), [db, user, campaignId, characterId]);
  useEffect(() => {
    let current = true;
    void load().then((found) => current && setLoaded(found));
    return () => {
      current = false;
    };
  }, [load, logVersion]);
  const { gotIt, offlineBox } = useFindsGotIt(db, user, () => setLoaded((was) => was && { ...was, entries: [] }));
  if (!loaded || loaded.entries.length === 0) return null;
  return (
    <FindCard
      entries={loaded.entries}
      words={{ names: loaded.names, coinWords: loaded.coinWords, when: loaded.when, now: new Date().toISOString() }}
      onGotIt={() => gotIt(loaded)}
      onMore={() => onOpenPack?.()}
      offlineBox={offlineBox}
      live={false}
    />
  );
}
