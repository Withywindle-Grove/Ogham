// The call card in the component gallery (row P7 of plan dec-9-the-players-scene; page 18's PL4b, approved 2026-11-14,
// and page 40, approved 2026-11-24 as drawn): 40A's cards (a call that pays, one that doesn't, a rumour, messy data),
// 40B's folded rows (a call, a rumour, a long name, one reopened), and 40C's slot ("1 of 3", "1 of 2" with a fold
// under it, one call with no count). Phone and dark are approved from these pictures (p7-8). Invented words.
import type { ReactElement, ReactNode } from 'react';
import { CallCard, CallFoldedRow, CallsInPromptSlot } from '../app/CallCard.tsx';
import { callsInSlot, type CallSend } from '../modules/library/callCards.ts';

const LONG = 'Fenna of the Long Causeway below the Old Lantern'; // words: names
const HOOK = '“The harbour office wants the manifest of the cog on the bar. No questions as to how.”';
const RUMOUR = '“They say the bell under the breakwater still rings on a spring tide.”';
const send = (id: string, extra: Partial<CallSend> = {}): CallSend => ({
  id,
  campaignId: 'gallery',
  kind: 'hook',
  actorId: null,
  actorName: null,
  playerUserId: null,
  body: HOOK,
  pays: '',
  createdAt: '2026-11-24T19:00:00Z',
  ...extra,
});
const PAYS = send('pays', { pays: '50 crowns.' });
const WREN = send('wren', { actorId: 'wren', actorName: 'Wren', body: '“Old Sedge asks after his brother, last seen rowing for the wreck.”' }); // words: names
const RUMOUR_PARTY = send('rumour', { kind: 'rumour', body: RUMOUR });
const nothing = () => {};

export function CallCardSpecimens({ Specimen }: { Specimen: (props: { name: string; children: ReactNode }) => ReactElement }) {
  return (
    <>
      <Specimen name="A call that pays (40A, p7-5): one “Pays” line under the words; no source line (p7-6)">
        <CallCard send={PAYS} onGotIt={nothing} />
      </Specimen>
      <Specimen name="A call that pays nothing, to one character: no “Pays” line">
        <CallCard send={WREN} onGotIt={nothing} />
      </Specimen>
      <Specimen name="A rumour (p7-4): the same card, the stein, never a “Pays” line">
        <CallCard send={RUMOUR_PARTY} onGotIt={nothing} />
      </Specimen>
      <Specimen name="Messy data: a long character name, long words, a long “Pays”, 999">
        <div className="calls-slot">
          <CallCard
            send={send('long-rumour', {
              kind: 'rumour',
              actorId: 'fenna',
              actorName: LONG,
              body: '“The customs men were paid to look away the night the cog went on the bar, and the one who took the coin has not been seen at the Tarred Door since; some say he rows out to the wreck at low water and comes back with his boat riding lower than it went.”',
            })}
            onGotIt={nothing}
          />
          <CallCard send={send('long-call', { actorId: 'fenna', actorName: LONG, pays: '999 crowns, a berth on the next ship out, and the harbour office’s thanks for as long as that lasts.' })} onGotIt={nothing} />
        </div>
      </Specimen>
      <Specimen name="After Got it (40B, p7-7): one quiet row a call, a tap reads it again; a rumour; a long name wraps">
        <div className="calls-slot">
          <CallFoldedRow send={PAYS} />
          <CallFoldedRow send={RUMOUR_PARTY} />
          <CallFoldedRow send={send('long-fold', { actorId: 'fenna', actorName: LONG })} />
        </div>
      </Specimen>
      <Specimen name="Reopened from its row (p7-10): the card under it with no button; a tap on the row folds it">
        <div className="calls-slot">
          <CallFoldedRow send={PAYS} startOpen />
        </div>
      </Specimen>
      <Specimen name="Three unseen calls (40C, p7-9): the oldest, “1 of 3” on its quiet line">
        <CallsInPromptSlot calls={callsInSlot([PAYS, { ...RUMOUR_PARTY, createdAt: '2026-11-24T20:00:00Z' }, { ...WREN, createdAt: '2026-11-24T21:00:00Z' }], new Map())} onGotIt={nothing} />
      </Specimen>
      <Specimen name="After Got it on the first (p7-12, p7-13): “1 of 2”, the seen one folded under the card">
        <CallsInPromptSlot calls={callsInSlot([PAYS, { ...RUMOUR_PARTY, createdAt: '2026-11-24T20:00:00Z' }, { ...WREN, createdAt: '2026-11-24T21:00:00Z' }], new Map([[PAYS.id, '2026-11-24T22:00:00Z']]))} onGotIt={nothing} />
      </Specimen>
      <Specimen name="One unseen call: no count">
        <CallsInPromptSlot calls={callsInSlot([WREN], new Map())} onGotIt={nothing} />
      </Specimen>
    </>
  );
}
