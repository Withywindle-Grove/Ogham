// Edit, on the standard (plan m5b-sheet-revised B5, B6; mockup players/05 "Edit and approval", approved 2026-11-08):
// one screen, the sheet's own parts. Scores (tiles, a tap opens a stepper sheet), Max HP (a stepper), the level (a
// line for a player once the character is approved: "Level 1, your GM changes it"), then Details last (rows, a tap
// opens a text sheet; the backstory a long text). Details save at once (character.edit, logged, with Undo). A score
// or Max HP changed by the player of an approved character is a request (sheet.requestChange): Send to the GM, the
// foot's one accent, sends them; the foot counts "n changes, m need approval". The GM's changes, and a player's on a
// character not approved yet, apply at once with Save.
import { useState, type FormEvent } from 'react';
import type { SheetCharacter } from '../core/characterSheet.ts';
import { isGm, runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { editCharacter, type CharacterChanges } from '../modules/characters/commands.ts';
import { abilityKeys, holdsAbility } from '../modules/characters/creation.ts';
import { speedEditMarks } from '../modules/characters/movement.ts';
import { fieldInputsFrom, readFieldInputs, type FieldDefinition, type FieldInputs } from '../modules/characters/fields.ts';
import { detailLines, detailsOf, nameTablesOf, PHYSICAL, type CharacterDetails } from '../modules/characters/kindredTables.ts';
import { HP_MAX_FIELD, requestSheetChange, type SheetChange } from '../modules/characters/sheetChanges.ts';
import { traitListsOf, traitLookup } from '../modules/characters/traitLists.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { ListRow, RowList, ScoreRow, Stepper } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { CampaignFields } from './CampaignFields.tsx';
import type { CampaignSetting } from './campaignSetting.ts';
import { characterFigures } from './fromSetting.ts';
import { kindredOfCharacter, NameRoll } from './KindredTables.tsx';
import { registry } from './services.ts';

const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The highest score or Max HP a stepper goes to (the database takes 9999). */
const SCORE_MOST = 99;
const HP_MOST = 9999;

/** "2 changes, 1 needs approval"; "1 change"; "No changes yet". */
export function changesLine(changes: number, needApproval: number): string {
  if (changes === 0) return 'No changes yet';
  const counted = `${changes} ${changes === 1 ? 'change' : 'changes'}`;
  return needApproval > 0 ? `${counted}, ${needApproval} ${needApproval === 1 ? 'needs' : 'need'} approval` : counted;
}

type DetailRow = { key: string; label: string; value: string; kind: 'name' | 'detail' | 'physical' | 'field' | 'backstory'; id: string };

export function SheetEdit({
  db,
  user,
  character,
  fieldDefs,
  fieldsOff,
  setting,
  canChangeLevel,
  ruling,
  waiting = [],
  onDetailSaved,
  onDone,
}: {
  db: Db;
  user: CurrentUser;
  character: SheetCharacter;
  fieldDefs: FieldDefinition[];
  /** The fields left off this character's sheet (sr-6): not on the form, their values sent back as they are. */
  fieldsOff: ReadonlySet<string> | undefined;
  setting: CampaignSetting | null;
  canChangeLevel: boolean;
  /** The GM editing a player's character: a ruling (fiat), with an optional reason. */
  ruling: boolean;
  /** The changes already waiting for the GM: a tile says "17 waiting". */
  waiting?: readonly SheetChange[];
  /** A detail was saved (the sheet reads the character again). */
  onDetailSaved: () => void;
  /** Done: `message` for the foot's status line (null: nothing was saved or sent). */
  onDone: (message: string | null) => void;
}) {
  const toast = useToast();
  // A player's score or Max HP on an approved character goes to the GM (B6); the GM's, or a draft's, applies at once.
  const asks = !isGm(user, character.campaignId) && character.approval === 'approved';
  const figures = characterFigures(setting, character, fieldDefs);
  const abilities = setting ? abilityKeys(setting.rulesSets) : [];
  const abilityField = (key: string) => fieldDefs.find((f) => !f.hidden && holdsAbility(f.key, key));
  const shownAbilities = abilities.filter((k) => abilityField(k));
  const saved = isPlainRecord(character.fields) ? character.fields : {};
  const scoreNow = (k: string): number | null => {
    const v = saved[abilityField(k)!.key];
    return typeof v === 'number' ? v : null;
  };
  const [scores, setScores] = useState<Record<string, number>>({});
  const [hpMax, setHpMax] = useState<number | null>(null);
  const [level, setLevel] = useState(character.level);
  const [openScore, setOpenScore] = useState<string | null>(null);
  const [openDetail, setOpenDetail] = useState<DetailRow | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(0);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sent before a later one failed (Send to the GM): said in the error line, and Cancel still closes with them sent.
  const [sentAlready, setSentAlready] = useState<string[]>([]);
  const levels = LEVELS.includes(character.level) ? LEVELS : [...LEVELS, character.level].sort((a, b) => a - b);
  const played = kindredOfCharacter(setting, character.raceRef, character.classRef);
  // A field fed by a trait list keeps the entry's id; its row says the entry's name.
  const lookup = traitLookup(traitListsOf(setting?.all ?? []));

  // The fields that hold the pack's scores: once approved, only the GM writes them (the database checks too).
  const scoreKeys = shownAbilities.map((k) => abilityField(k)!.key);
  const labelOf = (field: string) => (field === HP_MAX_FIELD ? 'Max HP' : figures.abilityName(shownAbilities.find((k) => abilityField(k)!.key === field) ?? field).long);
  const staged = [
    ...shownAbilities.filter((k) => scores[k] !== undefined && scores[k] !== scoreNow(k)).map((k) => ({ field: abilityField(k)!.key, label: figures.abilityName(k).long, to: scores[k]! })),
    ...(hpMax !== null && hpMax !== character.hpMax ? [{ field: HP_MAX_FIELD, label: 'Max HP', to: hpMax }] : []),
  ];
  const levelChanged = canChangeLevel && level !== character.level;
  const count = detailsSaved + staged.length + (levelChanged ? 1 : 0);

  // Details (B5), last: the name, the kindred's details, the GM's fields that aren't scores, the backstory.
  const details = detailsOf(character.fields);
  const detailRows: DetailRow[] = [
    { key: 'name', label: 'Name', value: character.name, kind: 'name', id: 'name' },
    ...(played
      ? detailLines(details, played.tables, played.physical, played.kindred.name).map((l): DetailRow => {
          const physical = PHYSICAL.some((p) => p.key === l.key);
          return { key: `detail:${l.key}`, label: l.label, value: physical ? (details[l.key as 'age'] ?? '') : (details.tables[l.key] ?? l.value), kind: physical ? 'physical' : 'detail', id: l.key };
        })
      : []),
    ...fieldDefs
      .filter((f) => !shownAbilities.some((k) => abilityField(k)!.key === f.key) && (!f.hidden || isGm(user, character.campaignId)))
      .map((f): DetailRow => ({ key: `field:${f.key}`, label: f.label, value: (typeof saved[f.key] === 'string' ? lookup(f, saved[f.key] as string) : null) ?? shownField(saved[f.key]), kind: 'field', id: f.key })),
    { key: 'backstory', label: 'Backstory', value: character.backstory, kind: 'backstory', id: 'backstory' },
  ];

  /** Saves one detail at once (character.edit), with Undo putting the old words back. */
  async function saveDetail(row: DetailRow, next: string | boolean): Promise<boolean> {
    if (busy) return false;
    // A speed typed here is marked as typed by hand (mv-2); its Undo puts the mark back as it was.
    const marks = row.kind === 'field' ? speedEditMarks(fieldDefs.find((f) => f.key === row.id)?.fill, (character.editedFields ?? []).includes(row.id)) : {};
    const changesFor = (value: string | boolean, mark?: boolean): CharacterChanges | string => {
      if (row.kind === 'name') return typeof value === 'string' && value.trim() ? { name: value.trim() } : 'Give your character a name.';
      if (row.kind === 'backstory') return { backstory: String(value).trim() };
      if (row.kind === 'detail' || row.kind === 'physical') {
        const now: CharacterDetails = { ...details, tables: { ...details.tables } };
        if (row.kind === 'detail') now.tables[row.id] = String(value).trim();
        else now[row.id as 'age'] = String(value).trim();
        return { details: now };
      }
      // Only the field being saved (review on #567, B): a figure the GM changed meanwhile is never sent back.
      return { field: { key: row.id, value, ...(mark === undefined ? {} : { mark }) } };
    };
    const changes = changesFor(next, marks.save);
    if (typeof changes === 'string') {
      setError(changes);
      return false;
    }
    const before = changesFor(row.kind === 'field' ? (fieldInputsFrom(fieldDefs, character.fields)[row.id] ?? '') : row.value, marks.undo);
    setBusy(true);
    setError(null);
    const result = await runCommand(registry, db, user, editCharacter, { character, changes, scoreKeys }, { reason });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    setDetailsSaved((n) => n + 1);
    onDetailSaved();
    toast({
      text: `${row.label} saved`,
      ...(typeof before !== 'string'
        ? {
            onUndo: () =>
              void runCommand(registry, db, user, editCharacter, { character, changes: before, scoreKeys }, { reason }).then((undone) => {
                if (!undone.ok) return toast({ text: undone.message, error: true });
                setDetailsSaved((n) => Math.max(0, n - 1));
                onDetailSaved();
              }),
          }
        : {}),
    });
    return true;
  }

  /** Send to the GM (a player's approved character), else Save: the scores, Max HP and the level. */
  async function finish() {
    if (busy) return;
    if (staged.length === 0 && !levelChanged) return onDone(detailsSaved > 0 ? 'Saved.' : null);
    setBusy(true);
    setError(null);
    if (asks) {
      const sent: string[] = [];
      for (const change of staged) {
        const result = await runCommand(registry, db, user, requestSheetChange, { character, field: change.field, label: change.label, to: change.to });
        if (!result.ok) {
          setBusy(false);
          // Never a silent close: what went before this one is with the GM, this one and the rest aren't.
          setSentAlready(sent);
          setScores((was) => Object.fromEntries(Object.entries(was).filter(([k]) => !sent.includes(abilityField(k)?.key ?? ''))));
          if (sent.includes(HP_MAX_FIELD)) setHpMax(null);
          return setError(sent.length > 0 ? `Sent to your GM: ${sent.map(labelOf).join(', ')}. Not sent: ${change.label} (${result.message})` : result.message);
        }
        sent.push(change.field);
      }
      setBusy(false);
      toast({ text: staged.length === 1 ? 'Sent to your GM.' : `${staged.length} changes sent to your GM.` });
      return onDone('Sent to your GM.');
    }
    const changes: CharacterChanges = {};
    if (hpMax !== null && hpMax !== character.hpMax) changes.hpMax = hpMax;
    if (levelChanged) changes.level = level;
    const scoreFields = staged.filter((c) => c.field !== HP_MAX_FIELD);
    if (scoreFields.length > 0) {
      const inputs: FieldInputs = { ...fieldInputsFrom(fieldDefs, character.fields), ...Object.fromEntries(scoreFields.map((c) => [c.field, String(c.to)])) };
      const fields = readFieldInputs(fieldDefs, inputs);
      if (!fields.ok) {
        setBusy(false);
        return setError(fields.message);
      }
      const kept = Object.fromEntries(Object.entries(saved).filter(([key]) => fieldsOff?.has(key)));
      changes.fields = { ...kept, ...fields.values } as CharacterChanges['fields'];
    }
    const result = await runCommand(registry, db, user, editCharacter, { character, changes, scoreKeys }, { reason });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone('Saved.');
  }

  const waitingFor = (field: string) => waiting.find((c) => c.field === field && c.status === 'waiting') ?? null;
  const scoreShown = (k: string) => scores[k] ?? scoreNow(k);
  const openKey = openScore;
  const primary = asks && staged.length > 0 ? 'Send to the GM' : staged.length > 0 || levelChanged ? 'Save' : 'Done';

  return (
    <div className="sheet__edit" role="form" aria-label={`Edit ${character.name}`}>
      <p className="reading">{asks ? 'Change what you need. Details save at once; your GM approves a score or max HP before it counts.' : 'Change what you need. Details save at once.'}</p>
      {ruling && (
        <div className="field sheet__ruling">
          <p className="sheet__ruling-note">This is a player's character, so your changes are logged as a GM ruling (fiat).</p>
          <label className="label" htmlFor="sheet-reason">
            Reason (optional)
          </label>
          <input
            id="sheet-reason"
            className="field__input"
            type="text"
            maxLength={500}
            value={reason}
            onChange={(event) => {
              if (busy) return;
              setReason(event.target.value);
            }}
          />
        </div>
      )}
      {shownAbilities.length > 0 && (
        <section className="sheet__section sheet__block" aria-label="Scores">
          <h2 className="sheet__label">Scores</h2>
          <ScoreRow
            scores={shownAbilities.map((k) => {
              const value = scoreShown(k);
              const asked = waitingFor(abilityField(k)!.key);
              const changed = scores[k] !== undefined && scores[k] !== scoreNow(k);
              const caption = changed ? `was ${scoreNow(k) ?? '—'}` : asked ? `${asked.to} waiting` : '';
              return { key: k, name: figures.abilityName(k).long, value: value === null ? '—' : String(value), modifier: caption, modifierSaid: caption };
            })}
            onOpen={(k) => setOpenScore(k)}
          />
          {asks && <p className="auth__meta">A score or max HP needs your GM's approval; details don't.</p>}
        </section>
      )}
      <section className="sheet__section sheet__block" aria-label="Hit points">
        <h2 className="sheet__label">Hit points</h2>
        <div className="sheet__kv">
          <span>Max HP</span>
          <Stepper label="Max HP" value={hpMax ?? character.hpMax ?? 1} min={1} max={HP_MOST} onChange={(next) => !busy && setHpMax(next)} onLimit={(side) => setError(side === 'min' ? 'Max HP is at least 1.' : `Max HP goes up to ${HP_MOST}.`)} />
        </div>
        {waitingFor(HP_MAX_FIELD) && <p className="auth__meta">{`${waitingFor(HP_MAX_FIELD)!.to} waiting for your GM`}</p>}
      </section>
      <section className="sheet__section sheet__block" aria-label="Level">
        <h2 className="sheet__label">Level</h2>
        {canChangeLevel ? (
          <select
            id="sheet-level"
            aria-label="Level"
            className="field__input field__input--short"
            value={level}
            onChange={(event) => {
              if (busy) return;
              setLevel(Number(event.target.value));
            }}
          >
            {levels.map((n) => (
              <option key={n} value={n}>
                Level {n}
              </option>
            ))}
          </select>
        ) : (
          <p id="sheet-level" className="sheet__fixed">
            Level {character.level}, your GM changes it
          </p>
        )}
      </section>
      <section className="sheet__section sheet__block" aria-label="Details">
        <h2 className="sheet__label">Details</h2>
        <RowList>
          {detailRows.map((row) => (
            <ListRow key={row.key} title={row.label} sub={row.value || 'Not written yet'} openLabel={`${row.label}: ${row.value || 'not written yet'}. Change it`} onOpen={() => setOpenDetail(row)} />
          ))}
        </RowList>
      </section>
      {error && !openDetail && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="sheet__foot">
        <p className="sheet__foot-status" role="status" aria-label="Edit status">
          {changesLine(count, asks ? staged.length : 0)}
        </p>
        <div className="sheet__foot-actions">
          <button
            type="button"
            className="button-secondary"
            aria-busy={busy}
            onClick={() => {
              // Cancel waits while Send to the GM runs (the busy guard), then closes with what was sent said.
              if (busy) return;
              onDone(sentAlready.length > 0 ? 'Sent to your GM.' : detailsSaved > 0 ? 'Saved.' : null);
            }}
          >
            Cancel
          </button>
          <button type="button" className="button-primary" aria-busy={busy} onClick={() => void finish()}>
            {busy ? (asks ? 'Sending…' : 'Saving…') : primary}
          </button>
        </div>
      </div>
      {openKey && (
        <Dialog label={figures.abilityName(openKey).long} onClose={() => setOpenScore(null)}>
          <Stepper
            label={figures.abilityName(openKey).long}
            value={scoreShown(openKey) ?? 10}
            min={1}
            max={SCORE_MOST}
            onChange={(next) => !busy && setScores((was) => ({ ...was, [openKey]: next }))}
            onLimit={(side) => setError(side === 'min' ? 'A score is at least 1.' : `A score goes up to ${SCORE_MOST}.`)}
          />
          <p className="auth__meta">{asks ? `Was ${scoreNow(openKey) ?? '—'}. Your GM approves it before it counts.` : `Was ${scoreNow(openKey) ?? '—'}.`}</p>
          <div className="dialog__actions">
            <button type="button" className="button-secondary" onClick={() => setOpenScore(null)}>
              Done
            </button>
          </div>
        </Dialog>
      )}
      {openDetail && (
        <DetailSheet
          row={openDetail}
          field={openDetail.kind === 'field' ? fieldDefs.find((f) => f.key === openDetail.id) : undefined}
          inputs={fieldInputsFrom(fieldDefs, character.fields)}
          traitLists={traitListsOf(setting?.all ?? [])}
          nameTables={played ? nameTablesOf(played.tables) : []}
          kindred={played?.kindred.name ?? ''}
          busy={busy}
          error={error}
          onSave={async (value) => {
            if (await saveDetail(openDetail, value)) setOpenDetail(null);
          }}
          onClose={() => {
            setError(null);
            setOpenDetail(null);
          }}
        />
      )}
    </div>
  );
}

/** A field's saved value as words on its row. */
function shownField(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/** A detail's text sheet: one field (the name with Roll for a name, a long text for the backstory, a GM's field as the form draws it), then Save. */
function DetailSheet({
  row,
  field,
  inputs,
  traitLists,
  nameTables,
  kindred,
  busy,
  error,
  onSave,
  onClose,
}: {
  row: DetailRow;
  field: FieldDefinition | undefined;
  inputs: FieldInputs;
  traitLists: ReturnType<typeof traitListsOf>;
  nameTables: Parameters<typeof NameRoll>[0]['tables'];
  kindred: string;
  busy: boolean;
  error: string | null;
  onSave: (value: string | boolean) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(row.value);
  const [fieldInputs, setFieldInputs] = useState<FieldInputs>(inputs);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    onSave(field ? (fieldInputs[field.key] ?? '') : text);
  };
  const id = `detail-${row.id}`;
  return (
    <Dialog label={row.label} onClose={onClose}>
      <form className="sheet__form" onSubmit={submit} noValidate>
        {field ? (
          <CampaignFields fields={[field]} inputs={fieldInputs} onField={(key, value) => !busy && setFieldInputs((was) => ({ ...was, [key]: value }))} traitLists={traitLists} />
        ) : (
          <div className="field">
            <label className="label" htmlFor={id}>
              {row.label}
            </label>
            {row.kind === 'backstory' ? (
              <textarea id={id} className="field__input field__textarea" rows={6} maxLength={4000} value={text} onChange={(event) => !busy && setText(event.target.value)} />
            ) : (
              <input id={id} className={row.kind === 'name' ? 'field__input field__input--name' : 'field__input'} type="text" autoComplete="off" maxLength={row.kind === 'name' ? 80 : 200} value={text} onChange={(event) => !busy && setText(event.target.value)} />
            )}
            {row.kind === 'name' && nameTables && nameTables.length > 0 && <NameRoll tables={nameTables} kindred={kindred} name={text} onName={setText} />}
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <button type="submit" className="button-primary" aria-busy={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
