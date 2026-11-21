// The one roll prompt (docs/02-architecture.md, "Dice entry"): every dice result typed into the app comes through
// here. It shows the dice, takes the number rolled, and refuses one the dice can't give. The caller keeps the
// roll (roll.record) and uses the result.
import { useId, useState, type FormEvent } from 'react';
import { readRoll } from '../core/rolls.ts';
import './RollPrompt.css';

export function RollPrompt({
  label,
  expression,
  busy = false,
  onRolled,
  onCancel,
}: {
  /** What the roll is for, e.g. "Charges". */
  label: string;
  /** The dice, e.g. "2d10". */
  expression: string;
  busy?: boolean;
  onRolled: (result: number) => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const read = readRoll(text, expression);
    if (!read.ok) return setProblem(read.message);
    setProblem(null);
    onRolled(read.value);
  }

  return (
    <form className="field" onSubmit={submit}>
      <label className="label" htmlFor={id}>
        {label} ({expression}): enter the roll
      </label>
      <input
        id={id}
        className="field__input field__input--short"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={5}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
      <div className="roll-prompt__actions">
        <button type="submit" className="button-primary" aria-busy={busy}>
          Save
        </button>
        {onCancel && (
          <button type="button" className="button-secondary button-secondary--small" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
