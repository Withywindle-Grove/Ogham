// The Player screen's state lines (dec-13 C11; the self-review's states, built from parts the app already draws: the
// Busy text, the Error line with its secondary Try again, and the offline line of the setting rules, ⚑ 4 B of
// 2026-11-07). One of them stands at the top of the Player tab: while the screen first opens, if it can't, or while the
// rules are the device's stored copy. "Player screen states" in 06's inventory.
import { asOfWords } from '../campaignSetting.ts';

export type PlayerState = { kind: 'opening' } | { kind: 'failed'; onTryAgain: () => void } | { kind: 'offline'; asOf: string };

export function PlayerStateLine({ state }: { state: PlayerState }) {
  if (state.kind === 'opening') return <p role="status">Opening…</p>;
  if (state.kind === 'offline') {
    // One quiet line, gone when online.
    return (
      <p className="auth__meta" role="status">
        {asOfWords(state.asOf)}
      </p>
    );
  }
  return (
    <>
      <p className="form-error" role="alert">
        Couldn’t open this character. Check your connection and try again.
      </p>
      <button type="button" className="button-secondary" onClick={state.onTryAgain}>
        Try again
      </button>
    </>
  );
}
