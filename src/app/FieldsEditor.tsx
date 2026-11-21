import { useEffect, useId, useState, type FormEvent } from 'react';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import {
  cleanChoices,
  createField,
  deleteField,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  loadFieldDefinitions,
  loadUsedFieldKeys,
  reorderFields,
  updateField,
  type FieldDefinition,
  type FieldType,
} from '../modules/characters/fields.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { registry } from './services.ts';
import './FieldsEditor.css';
import { useLogVersion } from './campaignLog.tsx';
import { moved, SortableList } from '../ui/SortableList.tsx';
import { ErrorToast, NoticeToast, useToast } from '../ui/ToastHost.tsx';
import { InfoButton } from '../ui/parts.tsx';

// GM: Campaign → Rules → Rules for this campaign → Character fields (a collapsible group there, ruled 2026-10-28,
// N20). Add, edit, reorder, hide, or delete fields nobody has filled in.
export function FieldsEditor({
  db,
  user,
  campaign,
  onChanged,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  /** A field was added, changed or removed (so the group's count follows). */
  onChanged?: () => void;
}) {
  const toast = useToast();
  const blocked = useBlockedSheet();
  const [fields, setFields] = useState<FieldDefinition[] | null | 'error'>(null);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState(0);
  const logVersion = useLogVersion();
  const [editing, setEditing] = useState<FieldDefinition | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = (message?: string) => {
    setNotice(message ?? null);
    setVersion((v) => v + 1);
    if (message) onChanged?.();
  };

  useEffect(() => {
    let current = true;
    Promise.all([loadFieldDefinitions(db, campaign.id), loadUsedFieldKeys(db, campaign.id)]).then(
      ([found, keys]) => {
        if (!current) return;
        setFields(found ?? 'error');
        setUsed(keys ?? new Set());
      },
      () => current && setFields('error'),
    );
    return () => {
      current = false;
    };
  }, [db, campaign.id, version, logVersion]);

  const list = Array.isArray(fields) ? fields : [];
  const shown = list.filter((f) => !f.hidden);
  const hidden = list.filter((f) => f.hidden);
  const groups = [...new Set(list.map((f) => f.group).filter(Boolean))];

  async function run(work: () => Promise<{ ok: boolean; message?: string }>, done: string) {
    setError(null);
    const result = await work();
    if (result.ok) reload(done);
    else setError(result.message ?? 'Something went wrong. Please try again.');
  }

  // Hold a field to move it (ruled 2026-10-25, replacing ↑↓): the shown fields in their new order, hidden ones after.
  function moveShown(from: number, to: number) {
    const order = moved(shown, from, to);
    const ids = [...order, ...list.filter((f) => !order.includes(f))].map((f) => f.id);
    void run(() => runCommand(registry, db, user, reorderFields, { campaignId: campaign.id, ids }), `Moved ${shown[from]!.label}.`);
  }

  const hide = (field: FieldDefinition, hiddenNow: boolean) =>
    void run(
      () => runCommand(registry, db, user, updateField, { field, changes: { hidden: hiddenNow } }),
      hiddenNow ? `${field.label} is hidden. Characters keep their values.` : `${field.label} is shown again.`,
    );

  const remove = (field: FieldDefinition) =>
    void run(() => runCommand(registry, db, user, deleteField, { field }), `${field.label} was deleted.`);

  return (
    <div className="fields">
      <div className="fields__head">
        {/* Setting rules → the homebrew's "Edit character fields" brings the GM here. */}
        {/* The group's toggle names it ("Character fields"), so no heading here. "Hold to move" lives behind an ⓘ
            (ruled 2026-10-25: reorderable lists explain it there). */}
        <div className="campaign-fields__label">
          <p className="gm__meta">Every character in this campaign has these. Players fill them in when they make a character.</p>
          <InfoButton label="moving fields" onOpen={() => toast({ text: 'Hold a field about half a second, then drag it.' })} />
        </div>
      </div>
      <NoticeToast message={notice} />
      <ErrorToast message={error} />
      {fields === null && <p role="status">Opening…</p>}
      {fields === 'error' && (
        <>
          <p className="form-error" role="alert">
            Couldn't load the fields. Check your connection and try again.
          </p>
          <button type="button" className="button-secondary" onClick={() => reload()}>
            Try again
          </button>
        </>
      )}
      {Array.isArray(fields) && shown.length === 0 && editing === null && (
        <p className="gm__meta">No fields yet. Add the things your setting tracks, like abilities, a class or an oath.</p>
      )}

      {blocked.sheet}
      {shown.length > 0 && (
        <>
        <SortableList
          items={shown.map((f) => ({ key: f.id, label: f.label, field: f }))}
          label="Character fields"
          blocked={editing !== null}
          onBlocked={() => blocked.explain("Can't move fields now", 'A field is open for editing. Save or cancel it, then move the fields.')}
          onMove={moveShown}
          render={({ field }) =>
            editing !== 'new' && editing?.id === field.id ? (
              <div className="fields__row">
                <FieldForm
                  db={db}
                  user={user}
                  campaign={campaign}
                  field={field}
                  groups={groups}
                  onDone={(message) => {
                    setEditing(null);
                    if (message) reload(message);
                  }}
                />
              </div>
            ) : (
              <div className="fields__row gm__row">
                {/* Tapping the row opens the field, as Edit does (ruled 2026-10-26). */}
                <button type="button" className="gm__row-main fields__open" onClick={() => setEditing(field)}>
                  <span className="gm__row-name">{field.label}</span>
                  <span className="gm__meta">{describeField(field)}</span>
                </button>
                <span className="gm__actions">
                  <button type="button" className="button-secondary" aria-label={`Edit ${field.label}`} onClick={() => setEditing(field)}>
                    Edit
                  </button>
                  <button type="button" className="button-secondary button-secondary--small" aria-label={`Hide ${field.label}`} onClick={() => hide(field, true)}>
                    Hide
                  </button>
                  {!used.has(field.key) && (
                    <button type="button" className="button-secondary button-secondary--small" aria-label={`Delete ${field.label}`} onClick={() => remove(field)}>
                      Delete
                    </button>
                  )}
                </span>
              </div>
            )
          }
        />
        </>
      )}

      {editing === 'new' ? (
        <FieldForm
          db={db}
          user={user}
          campaign={campaign}
          groups={groups}
          onDone={(message) => {
            setEditing(null);
            if (message) reload(message);
          }}
        />
      ) : (
        Array.isArray(fields) && (
          <button type="button" className="picker__new" onClick={() => setEditing('new')}>
            + Add a field
          </button>
        )
      )}

      {hidden.length > 0 && (
        <details className="archived">
          <summary className="archived__summary">Hidden fields ({hidden.length})</summary>
          <p className="gm__meta">Not shown to players. Characters keep their values.</p>
          <ul className="gm__list">
            {hidden.map((field) => (
              <li key={field.id} className="gm__row">
                <span className="gm__row-main">
                  <span className="gm__row-name">{field.label}</span>
                  <span className="gm__meta">{describeField(field)}</span>
                </span>
                <span className="gm__actions">
                  <button type="button" className="button-secondary" aria-label={`Show ${field.label}`} onClick={() => hide(field, false)}>
                    Show
                  </button>
                  {!used.has(field.key) && (
                    <button type="button" className="button-secondary button-secondary--small" aria-label={`Delete ${field.label}`} onClick={() => remove(field)}>
                      Delete
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** "List: Lantern Warden, Reedblade · Abilities · on the card · required" (not every field is optional; M4b gate). */
export function describeField(field: FieldDefinition): string {
  const type = field.type === 'list' ? `List: ${field.choices.join(', ')}` : FIELD_TYPE_LABELS[field.type];
  return [type, field.group, field.showOnCard ? 'on the card' : '', field.required ? 'required' : ''].filter(Boolean).join(', ');
}

/** The category picker's "New category…" choice (never a category name: it can't be typed in 40 letters as-is). */
const NEW_GROUP = ' new';

function FieldForm({
  db,
  user,
  campaign,
  field,
  groups,
  onDone,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  field?: FieldDefinition;
  groups: string[];
  onDone: (message?: string) => void;
}) {
  const id = useId();
  const [label, setLabel] = useState(field?.label ?? '');
  const [type, setType] = useState<FieldType>(field?.type ?? 'text');
  const [choices, setChoices] = useState(field?.choices.join('\n') ?? '');
  const [group, setGroup] = useState(field?.group ?? '');
  const [newGroup, setNewGroup] = useState(false);
  const [onCard, setOnCard] = useState(field?.showOnCard ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const list = cleanChoices(choices);
    const result = field
      ? await runCommand(registry, db, user, updateField, {
          field,
          changes: { label, group, showOnCard: onCard, ...(field.type === 'list' ? { choices: list } : {}) },
        })
      : await runCommand(registry, db, user, createField, {
          campaignId: campaign.id,
          label,
          type,
          choices: list,
          group,
          showOnCard: onCard,
        });
    setBusy(false);
    if (result.ok) onDone(field ? `${label.trim()} was saved.` : `${label.trim()} was added.`);
    else setError(result.message);
  }

  return (
    <form className="gm__panel" onSubmit={save} noValidate>
      <p className="gm__row-name">{field ? `Edit ${field.label}` : 'New field'}</p>
      <div className="field">
        <label className="label" htmlFor={`${id}-label`}>
          Name
        </label>
        <input
          id={`${id}-label`}
          className="field__input"
          type="text"
          autoComplete="off"
          maxLength={60}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>
      <div className="field">
        <label className="label" htmlFor={`${id}-type`}>
          Type
        </label>
        {field ? (
          <p id={`${id}-type`} className="gm__meta">
            {FIELD_TYPE_LABELS[field.type]} (can't be changed; hide this field and add a new one instead)
          </p>
        ) : (
          <select
            id={`${id}-type`}
            className="field__input field__input--short-select"
            value={type}
            onChange={(event) => setType(event.target.value as FieldType)}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        )}
      </div>
      {(field ? field.type : type) === 'list' && (
        <div className="field">
          <label className="label" htmlFor={`${id}-choices`}>
            Choices, one per line
          </label>
          <textarea
            id={`${id}-choices`}
            className="field__input field__textarea"
            rows={4}
            value={choices}
            onChange={(event) => setChoices(event.target.value)}
          />
        </div>
      )}
      {(field ? field.type : type) === 'number' && <p className="gm__meta">Whole numbers; negatives are fine.</p>}
      <div className="field">
        <label className="label" htmlFor={`${id}-group`}>
          Category (optional)
        </label>
        {/* Picked from the categories in use, or "New category…" to type one (ruled 2026-10-26): no typos. */}
        <select
          id={`${id}-group`}
          className="field__input"
          value={newGroup ? NEW_GROUP : group}
          onChange={(event) => {
            const picked = event.target.value;
            setNewGroup(picked === NEW_GROUP);
            setGroup(picked === NEW_GROUP ? '' : picked);
          }}
        >
          <option value="">No category</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
          <option value={NEW_GROUP}>New category…</option>
        </select>
      </div>
      {newGroup && (
        <div className="field">
          <label className="label" htmlFor={`${id}-new-group`}>
            New category
          </label>
          <input
            id={`${id}-new-group`}
            className="field__input"
            type="text"
            autoComplete="off"
            maxLength={40}
            value={group}
            onChange={(event) => setGroup(event.target.value)}
          />
        </div>
      )}
      <label className="check">
        <input type="checkbox" checked={onCard} onChange={(event) => setOnCard(event.target.checked)} />
        <span>Show on the character card</span>
      </label>
      <ErrorToast message={error} />
      <div className="gm__actions">
        <button type="submit" className="button-primary" aria-busy={busy}>
          {busy ? 'Saving…' : field ? 'Save' : 'Add field'}
        </button>
        <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => onDone()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
