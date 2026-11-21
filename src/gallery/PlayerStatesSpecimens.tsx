// The Player screen's state lines (dec-13 C11; "Player screen states" in 06's inventory): while the screen first opens,
// when it can't, and while the setting rules are the device's stored copy. The lines the screen itself draws.
import type { ReactNode } from 'react';
import { PlayerStateLine } from '../app/player/PlayerStates.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactNode;

export function PlayerStatesSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Opening: one line for the whole Player tab while its reads are out, none of its parts">
        <PlayerStateLine state={{ kind: 'opening' }} />
      </Specimen>
      <Specimen name="Couldn't open: the error, then Try again (a secondary button), none of its parts">
        <PlayerStateLine state={{ kind: 'failed', onTryAgain: () => undefined }} />
      </Specimen>
      <Specimen name="Offline: the rules are the device's stored copy, one quiet line above the head">
        <PlayerStateLine state={{ kind: 'offline', asOf: '2026-11-16T10:00:00Z' }} />
      </Specimen>
    </>
  );
}
