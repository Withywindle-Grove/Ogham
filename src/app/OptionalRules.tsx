import { useState, type ReactNode } from 'react';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { changeRule, type Choices, type OptionalRule } from '../modules/library/options.ts';
import './OptionalRules.css';

// Optional rules, as in the design: each rule's choices as buttons (the default marked), and "Use all defaults".
// While attaching (a new campaign, or newly attached rules) every rule is open; afterwards locked rules can't
// change (marked "Locked") and changing a "warn" rule asks first, once per rule. Each rule's name is a quiet ⓘ
// button that opens, underneath, whether it can change later and the pack's notes: no room taken until asked.
const ALL = '*all';
const LATER = {
  allow: 'Can change at any time.',
  warn: 'Can change during the campaign, but asks first.',
  lock: "Can't change once the campaign starts.",
} as const;

export function OptionalRules({
  options,
  choices,
  attaching,
  onChange,
}: {
  options: OptionalRule[];
  choices: Choices;
  attaching: boolean;
  onChange: (choices: Choices) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const blocked = useBlockedSheet();
  // A "warn" rule's new choice waiting for "Change it"; rules already confirmed don't ask again.
  const [asking, setAsking] = useState<{ optionId: string; choiceId: string } | null>(null);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const changed = options.filter((o) => (choices[o.id] ?? o.defaultChoice) !== o.defaultChoice).length;
  const defaults = Object.fromEntries(
    options.map((o) => [o.id, !attaching && o.changeLater === 'lock' ? (choices[o.id] ?? o.defaultChoice) : o.defaultChoice]),
  );
  const warnedByDefaults = attaching
    ? []
    : options.filter((o) => o.changeLater === 'warn' && !confirmed.includes(o.id) && (choices[o.id] ?? o.defaultChoice) !== o.defaultChoice);

  return (
    <div className="optional-rules">
      {blocked.sheet}
      <div className="optional-rules__head">
        <button
          type="button"
          className="button-secondary"
          onClick={() => (warnedByDefaults.length > 0 ? setAsking({ optionId: ALL, choiceId: '' }) : onChange(defaults))}
        >
          Use all defaults
        </button>
        <span className="auth__meta">{changed === 0 ? 'All defaults' : `${changed} ${changed === 1 ? 'choice' : 'choices'} changed from the defaults`}</span>
      </div>
      {asking?.optionId === ALL && (
        <Ask
          label="Use all defaults?"
          onChange={() => {
            setConfirmed([...confirmed, ...warnedByDefaults.map((o) => o.id)]);
            setAsking(null);
            onChange(defaults);
          }}
          onKeep={() => setAsking(null)}
        >
          This changes {warnedByDefaults.map((o) => o.name).join(', ')}. Changing {warnedByDefaults.length === 1 ? 'it' : 'them'} mid-campaign can
          affect characters and records made under the old rule.
        </Ask>
      )}
      {options.map((option) => {
        const current = choices[option.id] ?? option.defaultChoice;
        const locked = !attaching && option.changeLater === 'lock';
        const choose = (choiceId: string) => {
          const result = changeRule(options, { ...defaults, ...choices }, option.id, choiceId, { attaching });
          if (result.ok) onChange(result.choices);
        };
        return (
          <div key={option.id} className="optional-rules__rule" role="group" aria-label={option.name}>
            <div className="optional-rules__name">
              <button
                type="button"
                className="optional-rules__about"
                aria-expanded={open === option.id}
                onClick={() => setOpen(open === option.id ? null : option.id)}
              >
                {option.name}
                <span className="optional-rules__about-mark" aria-hidden="true">
                  {open === option.id ? ' ▴' : ' ⓘ'}
                </span>
              </button>
              {locked && <span className="optional-rules__later">Locked</span>}
            </div>
            {open === option.id && (
              // The rule's notes, then each choice's (its name in bold), then whether it can change later, last.
              <div className="optional-rules__notes">
                {option.notes && <p>{option.notes}</p>}
                {option.choices
                  .filter((c) => c.notes)
                  .map((c) => (
                    <p key={c.id}>
                      <strong>{c.name}:</strong> {c.notes}
                    </p>
                  ))}
                {LATER[option.changeLater] && <p className="optional-rules__later-note">{LATER[option.changeLater]}</p>}
              </div>
            )}
            <div className="optional-rules__choices">
              {option.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className="optional-rules__choice"
                  aria-pressed={current === choice.id}
                  onClick={() => {
                    if (choice.id === current) return;
                    if (locked) return blocked.explain(`${option.name} is locked`, `${LATER.lock} It stays ${option.choices.find((c) => c.id === current)?.name ?? 'as it is'}.`);
                    if (!attaching && option.changeLater === 'warn' && !confirmed.includes(option.id)) {
                      setAsking({ optionId: option.id, choiceId: choice.id });
                    } else choose(choice.id);
                  }}
                >
                  <span>{choice.name}</span>
                  {choice.id === option.defaultChoice && <span className="optional-rules__default">default</span>}
                </button>
              ))}
            </div>
            {asking?.optionId === option.id && (
              <Ask
                label={`Change ${option.name}?`}
                onChange={() => {
                  setConfirmed([...confirmed, option.id]);
                  setAsking(null);
                  choose(asking.choiceId);
                }}
                onKeep={() => setAsking(null)}
              >
                Changing this mid-campaign can affect characters and records made under the old rule.
              </Ask>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Asks before a change that can affect what was made under the old rule. */
function Ask({ label, children, onChange, onKeep }: { label: string; children: ReactNode; onChange: () => void; onKeep: () => void }) {
  return (
    <div className="optional-rules__ask" role="alertdialog" aria-label={label}>
      <p>{children}</p>
      <div className="optional-rules__ask-actions">
        <button type="button" className="button-secondary" autoFocus onClick={onChange}>
          Change it
        </button>
        <button type="button" className="button-secondary button-secondary--small" onClick={onKeep}>
          Keep
        </button>
      </div>
    </div>
  );
}
