import { useId, useState, type FormEvent } from 'react';
import {
  checkEntry,
  fieldsOf,
  keptAsIs,
  namesToIds,
  newEntryId,
  readMoney,
  readTags,
  setAt,
  showMoney,
  valueAt,
  withChoiceIds,
  type Field,
} from '../modules/library/editor.ts';
import { workOut } from '../modules/library/formula.ts';
import { traitNoteWords } from '../modules/library/ruleText.ts';
import type { EntryKind, PackEntry } from '../modules/library/packFile.ts';
import { KIND_WORDS } from './PackPreview.tsx';
import './EntryEditor.css';

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
/** What a number box holds: a whole number, nothing, or the text as typed (so checking can say what's wrong). */
const wholeOf = (text: string): unknown => (text.trim() === '' ? undefined : /^-?\d+$/.test(text.trim()) ? Number(text.trim()) : text);
const textOf = (value: unknown) => (value === undefined || value === null ? '' : String(value));

// One entry's simple form (docs/07-content-packs.md, In-app editor): the kind's fields, drawn from the editor
// model, writing the pack format itself. Anything the form doesn't show is kept. Checked before saving, with
// what's wrong in plain words; the GM saves it into the campaign's homebrew.
export function EntryEditor({
  kind,
  entry,
  entries,
  usedIds,
  onSave,
  onCancel,
}: {
  kind: EntryKind;
  /** The entry being changed (or copied into homebrew); none for a new one. */
  entry?: PackEntry;
  /** The campaign's entries, for choosing linked ones (a light type, an item). */
  entries: PackEntry[];
  /** Ids already used for this kind in the campaign, so a new entry doesn't replace one by accident. */
  usedIds: Set<string>;
  /** Saves it; returns a problem in plain words, or null. */
  onSave: (data: Record<string, unknown>) => Promise<string | null>;
  onCancel: () => void;
}) {
  const id = useId();
  const [data, setData] = useState<Record<string, unknown>>(() => ({ ...(entry?.data ?? {}) }));
  // What's typed in boxes that read as something else (numbers, money, tags), kept as typed.
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const word = KIND_WORDS[kind][0];
  const [kept] = useState(() => keptAsIs(kind, entry?.data ?? {}));

  const put = (key: string, value: unknown) => setData((current) => setAt(current, key, value));
  const typedBox = (field: Field, show: (value: unknown) => string, read: (text: string) => unknown) => ({
    value: typed[field.key] ?? show(valueAt(data, field.key)),
    onChange: (text: string) => {
      setTyped((current) => ({ ...current, [field.key]: text }));
      put(field.key, read(text));
    },
  });

  async function save(event: FormEvent) {
    event.preventDefault();
    const name = textOf(data.name).trim();
    // Treasure types, hooks and sheet layouts may have no name: the letter (or the kind) gives the new id.
    let final: Record<string, unknown> = { ...setAt(data, 'name', name), id: entry?.packEntryId ?? newEntryId(name || textOf(data.letter) || kind, usedIds) };
    // An optional rule's new choices get ids from their names, so the default can point at one.
    if (kind === 'option') final = setAt(final, 'choices', withChoiceIds(final.choices));
    const found = checkEntry(kind, final);
    setProblems(found);
    if (found.length > 0) return;
    setBusy(true);
    const problem = await onSave(final);
    setBusy(false);
    if (problem) setProblems([problem]);
  }

  function input(field: Field) {
    const fieldId = `${id}-${field.key}`;
    const hint = field.hint ? `${fieldId}-hint` : undefined;
    const common = { id: fieldId, 'aria-describedby': hint, className: 'field__input' };
    let control;
    const current = valueAt(data, field.key);
    // Text that differs by class (or is more detailed than a box) is kept as it is, not flattened.
    if ((field.type === 'text' || field.type === 'longText') && current !== undefined && typeof current !== 'string') {
      control = (
        <p id={fieldId} className="entry-editor__hint">
          More detailed than this form allows (for example, different for each class); kept as it is.
        </p>
      );
    } else switch (field.type) {
      case 'text':
        control = <input {...common} type="text" autoComplete="off" value={textOf(valueAt(data, field.key))} onChange={(e) => put(field.key, e.target.value)} />;
        break;
      case 'longText':
        control = <textarea {...common} className="field__input field__textarea" rows={4} value={textOf(valueAt(data, field.key))} onChange={(e) => put(field.key, e.target.value)} />;
        break;
      case 'whole': {
        const box = typedBox(field, textOf, wholeOf);
        control = <input {...common} type="text" inputMode="numeric" autoComplete="off" value={box.value} onChange={(e) => box.onChange(e.target.value)} />;
        break;
      }
      case 'wholeOrFormula': {
        const box = typedBox(
          field,
          (value) => (isRecord(value) ? textOf(value.formula) : textOf(value)),
          (text) => {
            const number = wholeOf(text);
            if (typeof number !== 'string') return number;
            // A formula using level, or else plain text ("permanent"), which stays as written.
            return workOut(text.trim(), 1) ? { formula: text.trim() } : text.trim();
          },
        );
        control = <input {...common} type="text" autoComplete="off" value={box.value} onChange={(e) => box.onChange(e.target.value)} />;
        break;
      }
      case 'money': {
        const box = typedBox(field, showMoney, (text) => {
          const money = readMoney(text);
          return money === null ? text : money;
        });
        control = <input {...common} type="text" autoComplete="off" value={box.value} onChange={(e) => box.onChange(e.target.value)} />;
        break;
      }
      case 'tags': {
        const box = typedBox(field, (value) => (Array.isArray(value) ? value.join(', ') : ''), readTags);
        control = <input {...common} type="text" autoComplete="off" value={box.value} onChange={(e) => box.onChange(e.target.value)} />;
        break;
      }
      case 'choiceFrom': {
        const choices = withChoiceIds(valueAt(data, field.from)).filter((choice) => textOf(choice.name) !== '');
        control = (
          <select {...common} className="field__input field__input--short-select" value={textOf(current)} onChange={(e) => put(field.key, e.target.value)}>
            <option value="">—</option>
            {choices.map((choice) => (
              <option key={String(choice.id)} value={String(choice.id)}>
                {textOf(choice.name)}
              </option>
            ))}
          </select>
        );
        break;
      }
      case 'choice':
        control = (
          <select {...common} className="field__input field__input--short-select" value={textOf(valueAt(data, field.key))} onChange={(e) => put(field.key, e.target.value)}>
            <option value="">—</option>
            {field.choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.name}
              </option>
            ))}
          </select>
        );
        break;
      case 'ref': {
        const options = entries.filter((e) => e.kind === field.kind).sort((a, b) => a.name.localeCompare(b.name));
        control = (
          <select {...common} className="field__input field__input--short-select" value={textOf(valueAt(data, field.key))} onChange={(e) => put(field.key, e.target.value)}>
            <option value="">None</option>
            {options.map((option) => (
              <option key={option.packEntryId} value={option.packEntryId}>
                {option.name}
              </option>
            ))}
          </select>
        );
        break;
      }
      case 'yesNo':
        // A short dropdown becomes buttons (ruled 2026-10-24): Yes or No; tapping the chosen one again leaves it
        // unset ("—", the usual rule).
        return (
          <div key={field.key} className="field" role="group" aria-labelledby={`${fieldId}-label`} aria-describedby={field.hint ? hint : undefined}>
            <span id={`${fieldId}-label`} className="label">
              {field.label}
            </span>
            {field.hint && (
              <p id={hint} className="entry-editor__hint">
                {field.hint}
              </p>
            )}
            <div className="entry-editor__yes-no">
              {([true, false] as const).map((answer) => (
                <button
                  key={String(answer)}
                  type="button"
                  className="button-secondary"
                  aria-pressed={current === answer}
                  onClick={() => put(field.key, current === answer ? undefined : answer)}
                >
                  {answer ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>
        );
      case 'refList': {
        const box = typedBox(
          field,
          (value) => (Array.isArray(value) ? value.map((id) => entries.find((e) => e.kind === field.kind && e.packEntryId === id)?.name ?? String(id)).join(', ') : ''),
          (text) => {
            const { ids, unknown } = namesToIds(text, field.kind, entries);
            return unknown.length > 0 ? text : ids.length > 0 ? ids : undefined;
          },
        );
        control = <input {...common} type="text" autoComplete="off" value={box.value} onChange={(e) => box.onChange(e.target.value)} />;
        break;
      }
      case 'duration':
        return <Duration key={field.key} field={field} value={current} hintId={hint} onChange={(value) => put(field.key, value)} />;
      case 'refMap':
        return <RefMap key={field.key} field={field} value={current} entries={entries} hintId={hint} onChange={(value) => put(field.key, value)} />;
      case 'wholeLabels':
        return <Labels key={field.key} field={field} value={current} numbers hintId={hint} onChange={(value) => put(field.key, value)} />;
      case 'labels':
        return <Labels key={field.key} field={field} value={valueAt(data, field.key)} hintId={hint} onChange={(value) => put(field.key, value)} />;
      case 'rows':
        return <Rows key={field.key} field={field} value={valueAt(data, field.key)} entries={entries} hintId={hint} onChange={(value) => put(field.key, value)} />;
    }
    return (
      <div key={field.key} className="field">
        <label className="label" htmlFor={fieldId}>
          {field.label}
        </label>
        {field.hint && (
          <p id={hint} className="entry-editor__hint">
            {field.hint}
          </p>
        )}
        {control}
      </div>
    );
  }

  return (
    <form className="entry-editor" onSubmit={(event) => void save(event)} noValidate aria-label={entry ? `Edit ${entry.name}` : `New ${word}`}>
      <h3 className="fields__title">{entry ? `Edit ${entry.name}` : `New ${word}`}</h3>
      <p className="gm__meta">Saved in this campaign’s homebrew{entry ? ', where it wins over other setting rules' : ''}.</p>
      {kept.length > 0 && <p className="entry-editor__hint">Kept as it is (not in this form yet): {kept.join(', ')}.</p>}
      {fieldsOf(kind, data).map(input)}
      {problems.length > 0 && (
        <div className="form-error" role="alert">
          {problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </div>
      )}
      <div className="entry-editor__actions">
        <button type="submit" className="button-secondary" aria-busy={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Free labels and values ("AC" 6, "Move" 60 ft), as a pack's `fields`; with `numbers`, the values are whole numbers ({ DEX: 1 }). */
function Labels({
  field,
  value,
  numbers = false,
  hintId,
  onChange,
}: {
  field: Field;
  value: unknown;
  numbers?: boolean;
  hintId?: string;
  onChange: (value: Record<string, unknown> | undefined) => void;
}) {
  const [pairs, setPairs] = useState<[string, string][]>(() => (isRecord(value) ? Object.entries(value).map(([k, v]) => [k, textOf(v)]) : []));
  const update = (next: [string, string][]) => {
    setPairs(next);
    const written = Object.fromEntries(
      next.filter(([label]) => label.trim() !== '').map(([label, v]) => [label.trim(), numbers ? wholeOf(v.replace(/^\+/, '')) : v]),
    );
    onChange(Object.keys(written).length > 0 ? written : undefined);
  };
  return (
    <fieldset className="entry-editor__group">
      <legend className="label">{field.label}</legend>
      {field.hint && (
        <p id={hintId} className="entry-editor__hint">
          {field.hint}
        </p>
      )}
      {pairs.map(([label, v], index) => (
        <div key={index} className="entry-editor__row">
          <input className="field__input" type="text" aria-label={`${field.label} ${index + 1}: label`} value={label} onChange={(e) => update(pairs.map((p, i) => (i === index ? [e.target.value, p[1]] : p)))} />
          <input
            className={numbers ? 'field__input entry-editor__number' : 'field__input'}
            type="text"
            inputMode={numbers ? 'numeric' : undefined}
            aria-label={`${field.label} ${index + 1}: value`}
            value={v}
            onChange={(e) => update(pairs.map((p, i) => (i === index ? [p[0], e.target.value] : p)))}
          />
          <button type="button" className="button-secondary button-secondary--small" aria-label={`Remove ${field.label} line ${index + 1}`} onClick={() => update(pairs.filter((_, i) => i !== index))}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="button-secondary button-secondary--small" onClick={() => setPairs([...pairs, ['', '']])}>
        + Add a line
      </button>
    </fieldset>
  );
}

/** Other entries, each with a whole number: which classes a race can be (and up to what level), a spell's lists. */
function RefMap({
  field,
  value,
  entries,
  hintId,
  onChange,
}: {
  field: Field;
  value: unknown;
  entries: PackEntry[];
  hintId?: string;
  onChange: (value: Record<string, unknown> | undefined) => void;
}) {
  const kind = field.type === 'refMap' ? field.kind : 'class';
  const numberLabel = field.type === 'refMap' ? field.numberLabel : 'Number';
  const options = entries.filter((e) => e.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
  const [pairs, setPairs] = useState<[string, string][]>(() => (isRecord(value) ? Object.entries(value).map(([k, v]) => [k, textOf(v)]) : []));
  const update = (next: [string, string][]) => {
    setPairs(next);
    const written = Object.fromEntries(next.filter(([id]) => id !== '').map(([id, n]) => [id, wholeOf(n)]));
    onChange(Object.keys(written).length > 0 ? written : undefined);
  };
  return (
    <fieldset className="entry-editor__group">
      <legend className="label">{field.label}</legend>
      {field.hint && (
        <p id={hintId} className="entry-editor__hint">
          {field.hint}
        </p>
      )}
      {pairs.map(([id, n], index) => (
        <div key={index} className="entry-editor__row">
          <select className="field__input" aria-label={`${field.label} ${index + 1}`} value={id} onChange={(e) => update(pairs.map((p, i) => (i === index ? [e.target.value, p[1]] : p)))}>
            <option value="">—</option>
            {options.map((option) => (
              <option key={option.packEntryId} value={option.packEntryId}>
                {option.name}
              </option>
            ))}
            {id && !options.some((option) => option.packEntryId === id) && <option value={id}>{id}</option>}
          </select>
          <input
            className="field__input entry-editor__number"
            type="text"
            inputMode="numeric"
            aria-label={`${field.label} ${index + 1}: ${numberLabel}`}
            placeholder={numberLabel}
            value={n}
            onChange={(e) => update(pairs.map((p, i) => (i === index ? [p[0], e.target.value] : p)))}
          />
          <button type="button" className="button-secondary button-secondary--small" aria-label={`Remove ${field.label} line ${index + 1}`} onClick={() => update(pairs.filter((_, i) => i !== index))}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="button-secondary button-secondary--small" onClick={() => setPairs([...pairs, ['', '']])}>
        + Add one
      </button>
    </fieldset>
  );
}

/** How long: a number or a formula using level, and its unit ({ value, unit } or { formula, unit }). */
function Duration({ field, value, hintId, onChange }: { field: Field; value: unknown; hintId?: string; onChange: (value: unknown) => void }) {
  const units = field.type === 'duration' ? field.units : [];
  const record = isRecord(value) ? value : {};
  const [amount, setAmount] = useState(() => textOf(record.formula ?? record.value ?? record.roll));
  const [unit, setUnit] = useState(() => textOf(record.unit));
  const id = useId();
  const perClass = isRecord(value) && !('value' in value || 'formula' in value || 'roll' in value) && Object.keys(value).length > 0;
  if ((value !== undefined && !isRecord(value)) || perClass) {
    return (
      <div className="field">
        <p className="label">{field.label}</p>
        <p className="entry-editor__hint">{perClass ? 'Different for each class; kept as it is.' : `“${textOf(value)}”, kept as it is.`}</p>
      </div>
    );
  }
  const write = (nextAmount: string, nextUnit: string) => {
    setAmount(nextAmount);
    setUnit(nextUnit);
    const number = wholeOf(nextAmount);
    // Keeps anything else the pack wrote with it; a rolled duration stays rolled.
    const rest = Object.fromEntries(Object.entries(record).filter(([key]) => !['value', 'formula', 'roll', 'unit'].includes(key)));
    const amountPart = number === undefined ? {} : typeof number === 'string' ? ('roll' in record ? { roll: number } : { formula: number.trim() }) : { value: number };
    const next = { ...rest, ...amountPart, ...(nextUnit ? { unit: nextUnit } : {}) };
    onChange(Object.keys(amountPart).length > 0 ? next : undefined);
  };
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {field.label}
      </label>
      {field.hint && (
        <p id={hintId} className="entry-editor__hint">
          {field.hint}
        </p>
      )}
      <div className="entry-editor__row">
        <input id={id} className="field__input" type="text" autoComplete="off" aria-describedby={hintId} value={amount} onChange={(e) => write(e.target.value, unit)} />
        <select className="field__input entry-editor__number" aria-label={`${field.label}: counted in`} value={unit} onChange={(e) => write(amount, e.target.value)}>
          <option value="">—</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Several other entries typed by name in a row ("Glimmer, Mire light"), stored as their ids. */
function RefListCell({
  label,
  placeholder,
  kind,
  value,
  entries,
  onChange,
}: {
  label: string;
  placeholder: string;
  kind: EntryKind;
  value: unknown;
  entries: PackEntry[];
  onChange: (value: unknown) => void;
}) {
  const [text, setText] = useState(() =>
    Array.isArray(value) ? value.map((id) => entries.find((e) => e.kind === kind && e.packEntryId === id)?.name ?? String(id)).join(', ') : textOf(value),
  );
  return (
    <input
      className="field__input"
      type="text"
      autoComplete="off"
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const { ids, unknown } = namesToIds(e.target.value, kind, entries);
        onChange(unknown.length > 0 ? e.target.value : ids.length > 0 ? ids : undefined);
      }}
    />
  );
}

/** A list of rows with fixed columns (abilities, XP by level, a kit's items). */
function Rows({
  field,
  value,
  entries,
  hintId,
  onChange,
}: {
  field: Field;
  value: unknown;
  entries: PackEntry[];
  hintId?: string;
  onChange: (value: Record<string, unknown>[] | undefined) => void;
}) {
  const columns = field.type === 'rows' ? field.columns : [];
  const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const update = (next: Record<string, unknown>[]) => onChange(next.length > 0 ? next : undefined);
  const setCell = (index: number, key: string, cell: unknown) => update(rows.map((r, i) => (i === index ? setAt(r, key, cell) : r)));
  return (
    <fieldset className="entry-editor__group">
      <legend className="label">{field.label}</legend>
      {field.hint && (
        <p id={hintId} className="entry-editor__hint">
          {field.hint}
        </p>
      )}
      {rows.length > 0 && (
        <div className="entry-editor__row entry-editor__columns" aria-hidden="true">
          {columns.map((column) => (
            <span key={column.key} className={column.type === 'whole' ? 'entry-editor__number' : undefined}>
              {column.label}
            </span>
          ))}
        </div>
      )}
      {rows.map((row, index) => (
        <div key={index} className="entry-editor__row">
          {columns.map((column) => {
            const label = `${field.label} ${index + 1}: ${column.label}`;
            if (column.type === 'ref') {
              const options = entries.filter((e) => e.kind === column.kind).sort((a, b) => a.name.localeCompare(b.name));
              const id = textOf(row[column.key]);
              return (
                <select key={column.key} className="field__input" aria-label={label} value={id} onChange={(e) => setCell(index, column.key, e.target.value || undefined)}>
                  <option value="">{column.optional ? `${column.label}: none` : `${column.label}…`}</option>
                  {options.map((option) => (
                    <option key={option.packEntryId} value={option.packEntryId}>
                      {option.name}
                    </option>
                  ))}
                  {id && !options.some((option) => option.packEntryId === id) && <option value={id}>{id}</option>}
                </select>
              );
            }
            if (column.type === 'yesNo') {
              const cell = row[column.key];
              return (
                <select
                  key={column.key}
                  className="field__input entry-editor__number"
                  aria-label={label}
                  value={cell === true ? 'yes' : cell === false ? 'no' : ''}
                  onChange={(e) => setCell(index, column.key, e.target.value === '' ? undefined : e.target.value === 'yes')}
                >
                  <option value="">{column.label}…</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              );
            }
            if (column.type === 'refList') {
              return (
                <RefListCell
                  key={column.key}
                  label={label}
                  placeholder={column.label}
                  kind={column.kind}
                  value={row[column.key]}
                  entries={entries}
                  onChange={(cell) => setCell(index, column.key, cell)}
                />
              );
            }
            // A cell that isn't plain words (a trait's note in pf-18's blocks, tfb-5): its words shown, kept as it is,
            // never written back, as the form's other detailed values are.
            const cell = row[column.key];
            if (column.type === 'text' && cell !== undefined && cell !== null && typeof cell !== 'string') {
              const words = traitNoteWords(cell);
              return (
                <p key={column.key} className="entry-editor__hint" aria-label={label}>
                  {words ? `“${words}”, kept as it is.` : 'More detailed than this form allows (for example, different for each class); kept as it is.'}
                </p>
              );
            }
            return (
              <input
                key={column.key}
                className={column.type === 'whole' ? 'field__input entry-editor__number' : 'field__input'}
                type="text"
                inputMode={column.type === 'whole' ? 'numeric' : undefined}
                aria-label={label}
                placeholder={column.label}
                value={textOf(row[column.key])}
                onChange={(e) => setCell(index, column.key, column.type === 'whole' ? wholeOf(e.target.value) : e.target.value || undefined)}
              />
            );
          })}
          <button type="button" className="button-secondary button-secondary--small" aria-label={`Remove ${field.label} row ${index + 1}`} onClick={() => update(rows.filter((_, i) => i !== index))}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="button-secondary button-secondary--small" onClick={() => onChange([...rows, {}])}>
        + Add a row
      </button>
    </fieldset>
  );
}
