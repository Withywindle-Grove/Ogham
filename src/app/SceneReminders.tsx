// Reminders on Scene (M5 step 6; docs/05 "Expeditions, time and light"; docs/03: the GM makes and changes them,
// players see the public ones; ruled 2026-10-29, D31).
//   * GmReminders: the GM's own reminders, made any time (even mid-session): a reminder (Done on the card) or a
//     check (Hit / Miss), maybe an Encounter check, how often, players see it or not, and for a check its chance and
//     the table a hit rolls. Tap one to change it, stop it or start it again (from now). Undo from the toast.
//     It is the Reminders sheet's content (S10; st-3; page 16, T6; opened from ⋯'s Reminders): what is to come, one
//     row each with its mark, its name and when it next falls due (`remindersToCome`), then the stacked "+ Reminder".
//   * PlayerReference: the public reminders, as a reference list (the procedure opens from the strip, B5).
//   Check results revealed in Downtime are read in the log (the "Revealed this downtime" card went at the M5 gate, B17).
import { useState } from 'react';
import type { TimeUnits } from '../modules/expedition/clock.ts';
import { chanceTyped, chanceTypedBack } from '../modules/expedition/reminders.ts';
import { everyWords, type Reminder, type ReminderFields } from '../modules/expedition/reminderPlay.ts';
import { remindersToCome } from '../modules/expedition/reminderSheet.ts';
import { Dialog, SheetScope } from '../ui/Dialog.tsx';
import { StepIcon } from '../ui/icons.tsx';
import { ActionBar, ButtonRow, ListRow, RowList, StackedButton, Switch } from '../ui/parts.tsx';
import './SceneExplore.css';

const UNITS = ['turn', 'hour', 'day', 'week'] as const;

export function GmReminders({
  reminders,
  tables,
  units,
  now,
  onSave,
  onStop,
}: {
  reminders: Reminder[] | null;
  /** The campaign's tables (for a check's hit), by id and name. */
  tables: { id: string; name: string }[];
  units: TimeUnits;
  /** The campaign clock now (seconds), for when each next falls due. */
  now: number;
  /** A new reminder (no `reminder`) or a change; resolves true when saved. */
  onSave: (fields: ReminderFields, reminder: Reminder | null) => Promise<boolean>;
  onStop: (reminder: Reminder, active: boolean) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null);
  // What is to come, soonest first, then the stopped ones; each row opens the reminder's own sheet (T6).
  return (
    <section className="scene-reminders scene-reminders--sheet" aria-label="Reminders">
      {reminders === null ? (
        <p className="scene-card__note">Couldn't load the reminders. They'll show when the connection is back.</p>
      ) : reminders.length === 0 ? (
        <p className="scene-card__note">No reminders yet.</p>
      ) : (
        <RowList label="Reminders to come">
          {remindersToCome(reminders, now, units).map(({ reminder: r, line }) => (
            <ListRow
              key={r.id}
              // T6's row: the mark alone in its column (no ring), the name and its line to its right.
              icon={<StepIcon name={r.encounterCheck ? 'encounter' : r.kind === 'check' ? 'search' : 'note'} size={24} />}
              title={r.label}
              sub={line}
              openLabel={`${r.label}: ${line}`}
              onOpen={() => setEditing(r)}
            />
          ))}
        </RowList>
      )}
      <div className="scene-reminders__foot">
        <StackedButton icon="ringing-bell" label="+ Reminder" onClick={() => setEditing('new')} />
      </div>
      {editing && (
        // The reminder's own sheet keeps today's centred card, not the Reminders sheet it opens from (#877's review; as
        // the Depart sheet's place picker, #864).
        <SheetScope.Provider value={false}>
          <ReminderDialog
            reminder={editing === 'new' ? null : editing}
            tables={tables}
            units={units}
            onClose={() => setEditing(null)}
            onSave={async (fields) => {
              if (await onSave(fields, editing === 'new' ? null : editing)) setEditing(null);
            }}
            onStop={async (active) => {
              if (editing !== 'new' && (await onStop(editing, active))) setEditing(null);
            }}
          />
        </SheetScope.Provider>
      )}
    </section>
  );
}

function ReminderDialog({
  reminder,
  tables,
  units,
  onClose,
  onSave,
  onStop,
}: {
  reminder: Reminder | null;
  tables: { id: string; name: string }[];
  units: TimeUnits;
  onClose: () => void;
  onSave: (fields: ReminderFields) => void;
  onStop: (active: boolean) => void;
}) {
  const [label, setLabel] = useState(reminder?.label ?? '');
  const [kind, setKind] = useState<'reminder' | 'check'>(reminder?.kind ?? 'reminder');
  const [amount, setAmount] = useState(String(reminder?.every.value ?? 1));
  const [unit, setUnit] = useState(reminder?.every.unit ?? 'turn');
  const [chance, setChance] = useState(chanceTypedBack(reminder?.chance ?? null));
  const [tableId, setTableId] = useState(reminder?.tableId ?? '');
  const [encounter, setEncounter] = useState(reminder?.encounterCheck ?? false);
  const [isPublic, setIsPublic] = useState(reminder?.isPublic ?? false);
  const [note, setNote] = useState(reminder?.note ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const units4 = UNITS.filter((u) => units[u] !== undefined);

  function save() {
    const value = /^\d{1,5}$/.test(amount.trim()) ? Number(amount.trim()) : 0;
    if (!label.trim()) return setProblem('Give it a few words, like "Eat a ration".');
    if (value < 1) return setProblem('How often: a whole number above 0, like 2.');
    const read = kind === 'check' && chance.trim() ? chanceTyped(chance) : null;
    if (kind === 'check' && chance.trim() && !read) return setProblem('Write the chance like "1 in 6" or "1-2 in 6", or leave it empty.');
    onSave({
      label: label.trim(),
      kind,
      encounterCheck: kind === 'check' && encounter,
      every: { value, unit },
      isPublic,
      chance: read,
      tableId: kind === 'check' && tableId ? tableId : null,
      note: note.trim() || null,
    });
  }

  return (
    <Dialog label={reminder ? 'Change the reminder' : 'New reminder'} onClose={onClose}>
      <label className="field">
        <span className="label">What to remember</span>
        <input className="field__input" value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <ButtonRow
        label="Kind"
        options={[
          { value: 'reminder', label: 'Reminder' },
          { value: 'check', label: 'Check' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <p className="scene-card__note">{kind === 'check' ? 'A check shows Hit and Miss when it comes due.' : 'A reminder shows Done when it comes due.'}</p>
      <label className="field">
        <span className="label">Every</span>
        <input className="field__input field__input--short" inputMode="numeric" pattern="[0-9]*" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <ButtonRow label="Unit" options={units4.map((u) => ({ value: u, label: `${u}s` }))} value={unit} onChange={setUnit} />
      {kind === 'check' && (
        <>
          <label className="field">
            <span className="label">Chance (optional)</span>
            <input className="field__input" placeholder="1 in 6" value={chance} maxLength={20} onChange={(e) => setChance(e.target.value)} />
          </label>
          {tables.length > 0 && (
            <label className="field">
              <span className="label">Table on a hit (optional)</span>
              <select className="field__input" value={tableId} onChange={(e) => setTableId(e.target.value)}>
                <option value="">None</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Switch label="Encounter check" on={encounter} onChange={setEncounter} />
        </>
      )}
      <Switch label="Players see it" on={isPublic} onChange={setIsPublic} />
      <label className="field">
        <span className="label">Note (optional)</span>
        <input className="field__input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </label>
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
      <ActionBar>
        <button type="button" className="button-primary" onClick={save}>
          {reminder ? 'Save the changes' : 'Make the reminder'}
        </button>
        {reminder && (
          <button type="button" className="button-secondary" onClick={() => onStop(!reminder.active)}>
            {reminder.active ? 'Stop it' : 'Start it again'}
          </button>
        )}
      </ActionBar>
    </Dialog>
  );
}

/**
 * The players' reference list: the public reminders. (The procedure opens from the strip's mode and turn since the
 * M5 gate, B5; the Procedure button here went.)
 */
export function PlayerReference({ reminders }: { reminders: Reminder[] }) {
  const shown = reminders.filter((r) => r.active);
  if (shown.length === 0) return null;
  return (
    <section className="scene-reminders" aria-label="Reference">
      <h3 className="label">Reference</h3>
      {shown.length > 0 && (
        <ul className="scene-reminders__list">
          {shown.map((r) => (
            <li key={r.id} className="scene-reminders__static">
              <span className="scene-reminders__label">{r.label}</span>
              <span className="scene-card__note">{everyWords(r.every)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
