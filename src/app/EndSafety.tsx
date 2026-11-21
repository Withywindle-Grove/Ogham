// The end of an expedition and safety (m8b-0 delivery 5, ruled 2026-11-06; docs/plans/m8b-0-places-from-packs.md),
// in the end card's dress since S19 (ap-11; page 16, frames 16-T11 to 16-T11d). Safety is no longer a property of a
// place but one question on the GM's Expedition ended card:
//   SafePlaceQuestion: "In a safe place?" at the row's left, Yes · No at its right as the two-sided switch (ds-1d; no
//     accent). Unanswered, neither side is lit (the one case a two-sided switch has no side chosen, T11b; it never
//     returns to it); answered, the chosen side is lit and the other changes the answer while the card is up. End
//     expedition still ends at once (after any leave-the-dungeon rolls), so nothing is asked first. Kept with the
//     expedition's end (expedition.safePlace, Verbose); Undo of End forgets it.
//   StayingAWhile (M5b step 6b, dt-9): after Yes, "Staying a while?" with Start downtime (the calendar) · Not yet (the
//     cross) as stacked buttons, one width (no accent, dt-2); under the question where they don't fit beside it. After
//     No, nothing here; the band's ⋯ Start downtime stays offered in town either way.
// The GM's alone (the card is the GM's).
import { ButtonRow, StackedButton, StackedGroup } from '../ui/parts.tsx';
import './EndSafety.css';

type Answer = 'yes' | 'no';

export function SafePlaceQuestion({ answer, onAnswer }: { answer: boolean | null; onAnswer: (safe: boolean) => void }) {
  const value: Answer | null = answer === null ? null : answer ? 'yes' : 'no';
  return (
    <div className="safe-place end-card__row">
      <p className="safe-place__question">In a safe place?</p>
      <ButtonRow<Answer>
        label="In a safe place?"
        sides
        options={[
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ]}
        value={value}
        onChange={(next) => {
          if (next !== value) onAnswer(next === 'yes');
        }}
      />
    </div>
  );
}

export function StayingAWhile({ onStart, onNotYet }: { onStart: () => void; onNotYet: () => void }) {
  return (
    <div className="staying-a-while end-card__row">
      <p className="staying-a-while__note">Staying a while?</p>
      <StackedGroup>
        <StackedButton icon="calendar" label="Start downtime" onClick={onStart} />
        <StackedButton icon="cancel" label="Not yet" onClick={onNotYet} />
      </StackedGroup>
    </div>
  );
}
