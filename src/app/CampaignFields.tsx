import { useState } from 'react';
import type { FieldDefinition, FieldInputs } from '../modules/characters/fields.ts';
import { traitRowName, type TraitList } from '../modules/characters/traitLists.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { ButtonRow, InfoButton } from '../ui/parts.tsx';

/** What a field can say beside its input: an ⓘ explanation (≤ 3 sentences) and a one-line hint under it. */
export interface FieldHelp {
  about?: string;
  hint?: string;
}

// A choice becomes a button row only when every option fits one row at Standard text size (ruled 2026-10-25,
// clarifying M4 gate 7): here, three or fewer short options; otherwise it stays a list.
const fitsOneRow = (choices: readonly string[]) => choices.length <= 3 && choices.every((c) => c.length <= 10);

export function CampaignFields({
  fields,
  inputs,
  onField,
  help = {},
  hide = () => false,
  traitLists = [],
}: {
  fields: FieldDefinition[];
  inputs: FieldInputs;
  onField: (key: string, value: string | boolean) => void;
  /** Explanations and hints by field key (guided creation, A5). */
  help?: Record<string, FieldHelp>;
  /** Fields not asked here (guided creation hides what the setting fills in, A5). */
  hide?: (field: FieldDefinition) => boolean;
  /** The setting's trait lists: a list field fed by one (`from`) offers its entries; without the list, free text. */
  traitLists?: TraitList[];
}) {
  const shown = fields.filter((f) => !f.hidden && !hide(f));
  if (shown.length === 0) return null;
  const groups: { name: string; fields: FieldDefinition[] }[] = [];
  for (const field of shown) {
    const group = groups.find((g) => g.name === field.group);
    if (group) group.fields.push(field);
    else groups.push({ name: field.group, fields: [field] });
  }
  return (
    <>
      {groups.map((group) => (
        <fieldset key={group.name || '(none)'} className="campaign-fields">
          {group.name && <legend className="campaign-fields__legend">{group.name}</legend>}
          {group.fields.map((field) => (
            <FieldInput key={field.id} field={field} value={inputs[field.key]} help={help[field.key]} list={field.from ? (traitLists.find((l) => l.id === field.from) ?? null) : null} onChange={(v) => onField(field.key, v)} />
          ))}
        </fieldset>
      ))}
    </>
  );
}

function FieldInput({
  field,
  value,
  help,
  list,
  onChange,
}: {
  field: FieldDefinition;
  value: string | boolean | undefined;
  help?: FieldHelp;
  /** The trait list this field offers (M5b step 0b); null when it has none, or the setting lacks it (free text then). */
  list: TraitList | null;
  onChange: (value: string | boolean) => void;
}) {
  const id = `campaign-field-${field.key}`;
  const [open, setOpen] = useState(false);
  if (field.type === 'checkbox') {
    return (
      <label className="check">
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        <span>{field.label}</span>
      </label>
    );
  }
  const text = typeof value === 'string' ? value : '';
  // A list fed by a trait list: its entries (the value is the entry's id); without the list, typed like text.
  const choices = list ? list.entries.map((e) => ({ value: e.id, label: traitRowName(list, e) })) : field.choices.map((c) => ({ value: c, label: c }));
  const asList = field.type === 'list' && (!field.from || !!list);
  const asRow = asList && fitsOneRow(choices.map((c) => c.label));
  const label = (
    <span className="campaign-fields__label">
      {asRow ? (
        <span className="label" id={`${id}-label`}>
          {field.label}
        </span>
      ) : (
        <label className="label" htmlFor={id}>
          {field.label}
        </label>
      )}
      {help?.about && <InfoButton label={field.label} onOpen={() => setOpen(true)} />}
    </span>
  );
  return (
    <div className="field">
      {label}
      {asRow ? (
        <ButtonRow label={field.label} options={choices} value={text || null} onChange={onChange} />
      ) : asList ? (
        <select id={id} className="field__input" value={text} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose…</option>
          {/* A value the list doesn't have (typed before the list existed) stays as it is, shown as typed. */}
          {text && !choices.some((c) => c.value === text) && <option value={text}>{text}</option>}
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      ) : field.type === 'longtext' ? (
        <textarea id={id} className="field__input field__textarea" rows={3} value={text} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input
          id={id}
          className={field.type === 'number' ? 'field__input field__input--short' : 'field__input'}
          type="text"
          autoComplete="off"
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {help?.hint && <p className="auth__meta">{help.hint}</p>}
      {open && help?.about && (
        <Dialog label={field.label} onClose={() => setOpen(false)}>
          <p className="reading">{help.about}</p>
          <div className="dialog__actions">
            <button type="button" className="button-primary" onClick={() => setOpen(false)}>
              Got it
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
