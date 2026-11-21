// The card after an expedition ends in the component gallery (S19; ap-11, page 16 frames 16-T11 to 16-T11d; m8b-0
// delivery 5's In a safe place?): just ended (the question unanswered, neither side lit, Full rest the accent), after
// Yes (Staying a while? · Start downtime · Not yet, the rest taken, a row a character with Heal), after No, nobody
// hurt ("Everyone is at full hit points."), and eight characters with a long name, 0 of 12 and 31 of 40 (T11c). The
// card itself reads the database (SceneTime's EndSummary), so these compose its parts with invented names: EndCard,
// SafePlaceQuestion, StayingAWhile and RestLines, the rows from endCardRows.
import { useState, type ReactElement, type ReactNode } from 'react';
import { EndCard, RestLines } from '../app/EndCard.tsx';
import { SafePlaceQuestion, StayingAWhile } from '../app/EndSafety.tsx';
import { endCardRows, restLine } from '../modules/expedition/endCard.ts';

type Who = [string, number | null, number | null];

const FOUR: Who[] = [
  ['Ash', 6, 8],
  ['Wren', 9, 14],
  ['Tam', 4, 4],
  ['Bram', 11, 11],
];
const EIGHT: Who[] = [...FOUR, ['Fennawethelburrowsdottir', 0, 12], ['Moss', 31, 40], ['Sedgewick', 3, 21], ['Pip', 1, 1]];
const FULL: Who[] = [
  ['Ash', 8, 8],
  ['Wren', 14, 14],
];

function Card({ start, rested: restedAtStart = true, who = FOUR }: { start: boolean | null; rested?: boolean; who?: Who[] }) {
  const [answer, setAnswer] = useState<boolean | null>(start);
  const [notYet, setNotYet] = useState(false);
  const [rested, setRested] = useState(restedAtStart);
  const card = endCardRows(who.map(([name, hpCurrent, hpMax]) => ({ ref: { id: name }, name, hpCurrent, hpMax })));
  return (
    <EndCard
      took="Took 3 hours."
      accent
      rested={rested}
      onRest={() => setRested(true)}
      onUndo={() => {}}
      onDone={() => {}}
      safePlace={
        <>
          <SafePlaceQuestion
            answer={answer}
            onAnswer={(safe) => {
              setAnswer(safe);
              setNotYet(false);
            }}
          />
          {answer === true && !notYet && <StayingAWhile onStart={() => {}} onNotYet={() => setNotYet(true)} />}
        </>
      }
    >
      {rested && (
        <RestLines
          line={restLine(['Tam'])}
          healing={{ rule: 'A night’s rest heals 1 hit point.', source: 'From your setting: River Rules' }}
          rows={card.rows}
          everyoneFull={card.everyoneFull}
          none="No characters went."
          onHeal={() => {}}
        />
      )}
    </EndCard>
  );
}

export function EndSafetySpecimens({ Specimen }: { Specimen: (props: { name: string; children: ReactNode }) => ReactElement }) {
  return (
    <>
      <Specimen name="Expedition ended, just ended: In a safe place? unanswered, neither side lit; Full rest the accent">
        <Card start={null} rested={false} />
      </Specimen>
      <Specimen name="Expedition ended, after Yes: Staying a while?, Start downtime, Not yet; the rest taken, Done the accent">
        <Card start={true} />
      </Specimen>
      <Specimen name="Expedition ended, after No: no downtime offer">
        <Card start={false} />
      </Specimen>
      <Specimen name="Expedition ended, nobody hurt: Everyone is at full hit points.">
        <Card start={false} who={FULL} />
      </Specimen>
      <Specimen name="Expedition ended, eight characters: a long name, 0 of 12, 31 of 40">
        <Card start={false} who={EIGHT} />
      </Specimen>
    </>
  );
}
