import { useEffect, useState, type FormEvent } from 'react';
import { isGm, runCommand, type CurrentUser } from '../../core/commands.ts';
import type { MyCharacter } from '../../core/myCharacters.ts';
import type { Db } from '../../core/supabase.ts';
import { latestChange, undoChange } from '../../core/undo.ts';
import { acCaption, explainAttack } from '../../modules/characters/explain.ts';
import type { FieldDefinition } from '../../modules/characters/fields.ts';
import { readHpInput } from '../../modules/characters/hp.ts';
import { acEmpty, acLines as acLinesOf, acNumber, acShown, attackIsBonus, combatFields, type WornGear } from '../../modules/characters/play.ts';
import { signedNumber } from '../../modules/characters/modifierColumns.ts';
import { AC_LIMIT, setAc } from '../../modules/characters/playState.ts';
import type { AttackFigures } from '../../modules/characters/sheetCombat.ts';
import { BreakdownSheet } from '../../ui/BreakdownSheet.tsx';
import { Dialog } from '../../ui/Dialog.tsx';
import { ListRow, RowList, StatRow, StatTile } from '../../ui/parts.tsx';
import { useToast } from '../../ui/ToastHost.tsx';
import { BaseArmourChoice } from '../BaseArmour.tsx';
import { loadCampaignSetting, type CampaignSetting } from '../campaignSetting.ts';
import { figureSourceOf } from '../CharacterSheet.tsx';
import type { characterFigures } from '../fromSetting.ts';
import { HpInPlace } from '../HpInPlace.tsx';
import { lineNow, pickBaseArmour } from '../pickBase.ts';
import { registry } from '../services.ts';

/** A caption's parts joined by commas, never a middle dot (plan m5b-players-screens-standard A2): "Melee +1, Missile +0". */
const commas = (text: string) => text.replace(/ · /g, ', ');

/** The attack tile's line in plain case, a capital on its first word only (plan dec-14-player-audit-fixes, row 7b): "Melee +2, missile +1". The full sheet's tile keeps its capitals (tfw-7). */
const plainCase = (text: string) => text.replace(/, (\p{Lu})/gu, (_, first: string) => `, ${first.toLowerCase()}`);

/**
 * The vitals: hit points largest, in the HP box (ruled 2026-11-08, mockup players/04 C): the figure at the left (a
 * tap types a value), − and + at the right, each tap at once; taps within two seconds fold into one setHp with one
 * Undo toast. AC and the attack figure beside, one quiet line each; a tap says how each is worked out (2026-10-26).
 */
export function PlayerVitals({
  db,
  user,
  character,
  fieldDefs,
  figures,
  attack: attackFigure,
  worn,
  acOverride,
  downAt,
  onSaved,
  onMaxSaved,
  onAcSaved,
}: {
  db: Db;
  user: CurrentUser;
  character: MyCharacter;
  fieldDefs: FieldDefinition[];
  figures: ReturnType<typeof characterFigures>;
  /** The attack figure in the campaign's AC style, and its breakdown (A4, sr-8). */
  attack: AttackFigures;
  /** The armour and shields worn (null until known): AC is worked out from them (ruled 2026-10-29, B9). */
  worn: WornGear[] | null;
  /** The AC set by hand (Set AC, ruled 2026-10-29); null when the worked-out AC shows. */
  acOverride: number | null;
  /** The HP at which the rules set marks a character Down (`downAtOf`); null: the toast never says Down. */
  downAt: number | null;
  onSaved?: () => void;
  /** The most hit points were set ("Set max", N24), so the character is read again. */
  onMaxSaved?: () => void;
  /** The AC was set by hand or cleared, so the play state is read again. */
  onAcSaved?: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState<'set-ac' | 'ac' | 'attack' | 'base' | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The source line at the foot of the Armour class and Attack sheets (H2, owed by A7): the same pack the full sheet
  // names, by the one rule (`figureSourceOf`), from the campaign's setting as the Player screen already holds it.
  // Kept with the person and campaign it was read for: when either changes, no line shows until the new one is read,
  // so a stale pack's name never stands under the sheet (the review of #1061, nit 3).
  const settingFor = `${user.id}:${character.campaignId}`;
  const [read, setRead] = useState<{ for: string; setting: CampaignSetting | null } | null>(null);
  const setting = read?.for === settingFor ? read.setting : null;
  useEffect(() => {
    let current = true;
    void loadCampaignSetting(db, user.id, character.campaignId).then(
      (found) => current && setRead({ for: `${user.id}:${character.campaignId}`, setting: found }),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [db, user.id, character.campaignId]);
  const { ac, attack } = combatFields(fieldDefs);
  const value = (field: FieldDefinition | undefined) => {
    const v = field ? figures.values[field.key] : undefined;
    return v === undefined || v === null || v === '' ? null : String(v);
  };
  const attackName = attackFigure.label;
  // The Attack tile's figure, signed when the rules read the attack as a bonus added to the d20 (as the weapon's roll
  // lines read it; frame P1's "+2", the review's nit of 19 Nov 2026); a target number, or words, as the sheet has it.
  const attackRaw = value(attack);
  const attackWhole = attackRaw !== null && /^[+−-]?\d+$/.test(attackRaw.trim()) ? Number(attackRaw.trim().replace('−', '-')) : null;
  const attackShown = attackWhole !== null && attackIsBonus(figures.klass, character.level, attackFigure.direction) ? signedNumber(attackWhole) : attackRaw;
  // AC is at the top when the sheet or the setting has one (N24): the number players use, with the ability
  // modifier in it, worked out from what's worn; "—" and a quiet Set AC when the setting gives no number, never a
  // guess (ruled 2026-10-29, B9). Its pop-up lists the parts; its quiet line stays compact ("AC +1 from DEX").
  // The GM sees the true AC, hidden magic bonuses included (ruled 2026-10-29).
  const acWorked = figures.ac(worn, isGm(user, character.campaignId));
  const acValue = acShown(value(ac), acWorked, acOverride);
  // Worn magic armour whose base isn't chosen yet (ruled 2026-10-29): AC reads "Choose base armour", and a tap chooses.
  const chooseBase = acValue === null ? (acWorked.chooseBase ?? null) : null;
  const choosingFor = chooseBase ? (worn ?? []).find((g) => g.slot === 'armour' && g.name === chooseBase.item) : undefined;
  const showAc = ac !== undefined || acOverride !== null || acWorked.value !== null || chooseBase !== null || figures.ac([]).value !== null;
  const acLines = acLinesOf(value(ac), acWorked, acOverride);
  const acLine = acOverride !== null ? 'set by hand' : acCaption(figures.filled, (k) => figures.abilityName(k).short, figures.acDirection);
  const canSetAc = showAc && acValue === null && acWorked.known && chooseBase === null;

  /** Chooses the worn magic armour's base (logged; Undo puts it back to unchosen). */
  async function chooseBaseArmour(id: string) {
    if (!choosingFor?.line || busy) return;
    setBusy(true);
    const carrier = { campaignId: character.campaignId, actorId: character.id, locationId: null, ownerUserId: character.ownerUserId, archived: character.archived };
    // bq3-8: a base the class can't wear takes the armour off (carried), in the same logged change.
    const now = await lineNow(db, character.campaignId, choosingFor.line.id);
    if (!now) {
      setBusy(false);
      return setError("That armour couldn't be read. Try again.");
    }
    const result = await pickBaseArmour(db, user, { line: { ...now, version: choosingFor.line.version }, carrier, baseId: id });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setOpen(null);
    onAcSaved?.();
    toast({
      text: result.value.cameOff ?? `${choosingFor.name}: ${figures.baseArmour(id)?.name ?? id}`,
      onUndo: async () => {
        const eventId = await latestChange(db, character.campaignId, 'inventory.setBaseArmour', user.id);
        if (eventId) await runCommand(registry, db, user, undoChange, { campaignId: character.campaignId, eventId, authorUserId: user.id });
        onAcSaved?.();
      },
    });
  }

  // "Set AC" (ruled 2026-10-29): with no number from the setting, the AC typed is kept for this character (logged,
  // with Undo); Clear in AC's pop-up brings the worked-out AC back, with Undo too.
  async function saveAc(next: number | null): Promise<boolean> {
    setBusy(true);
    setError(null);
    const result = await runCommand(registry, db, user, setAc, { character, ac: next });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    onAcSaved?.();
    return true;
  }

  async function submitAc(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const typedAc = readHpInput(typed);
    if (typedAc === null || Math.abs(typedAc) > AC_LIMIT) return setError(`Type a whole number from -${AC_LIMIT} to ${AC_LIMIT}, like 7 or -2.`);
    const before = acOverride;
    if (!(await saveAc(typedAc))) return;
    setOpen(null);
    toast({ text: `AC set to ${acNumber(typedAc)}`, onUndo: () => void saveAc(before) });
  }

  async function clearAc() {
    if (busy || acOverride === null) return;
    const before = acOverride;
    if (!(await saveAc(null))) return;
    setOpen(null);
    toast({ text: 'AC set by hand cleared', onUndo: () => void saveAc(before) });
  }

  const openSetAc = () => {
    setTyped('');
    setError(null);
    setOpen('set-ac');
  };

  return (
    <section className="vitals" aria-label="Vitals">
      <HpInPlace db={db} user={user} character={character} downAt={downAt} onSaved={onSaved} onMaxSaved={onMaxSaved} />
      {(showAc || attackShown !== null) && (
        <StatRow>
          {showAc &&
            (chooseBase ? (
              <StatTile
                label="Armour class"
                value={<span className="vitals__choose-base">{acEmpty(acWorked)}</span>}
                onTap={() => setOpen('base')}
                tapLabel={`Armour class: choose the base armour for ${chooseBase.item}`}
              />
            ) : (
              <StatTile label="Armour class" value={acValue ?? '—'} caption={commas(acLine) || undefined} onTap={() => setOpen('ac')} tapLabel={`Armour class ${acValue ?? 'not known'}: how it's worked out`} />
            ))}
          {attackShown !== null && (
            <StatTile
              // Whole words in plain case, as the pack names it (dec-13 C15, frame P1): "Attack", never "attack" or "AC".
              label={attackName}
              value={attackShown}
              // The same line as the pop-up's rows and the full sheet's tile, from one source (tf-A3): the totals, or the scores' modifiers when the setting names no AC style.
              caption={plainCase(commas(attackFigure.caption)) || undefined}
              onTap={() => setOpen('attack')}
              tapLabel={`${attackName} ${attackShown}: how it's worked out`}
            />
          )}
        </StatRow>
      )}
      {/* No hint line: nothing explains what the screen already shows (mc-46; dec-13 C1, frames P1 and P2). The tiles
          carry the tappable border. */}
      {canSetAc && (
        <button type="button" className="button-secondary button-secondary--small vitals__set-ac" onClick={openSetAc}>
          Set AC
        </button>
      )}
      {error && open !== 'set-ac' && open !== 'ac' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {open === 'base' && chooseBase && (
        <Dialog label={`Base armour for ${chooseBase.item}`} onClose={() => setOpen(null)}>
          <p className="reading">Which armour is it made as? Its AC comes from that armour, plus its magic.</p>
          <BaseArmourChoice choices={chooseBase.choices} nameOf={(id) => figures.baseArmour(id)?.name ?? id} selected={null} onPick={(id) => void chooseBaseArmour(id)} />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {open === 'set-ac' && (
        <Dialog label="Armour class" onClose={() => setOpen(null)}>
          <form className="hp__keypad" onSubmit={(event) => void submitAc(event)} noValidate>
            <label className="label" htmlFor="ac-typed">
              AC
            </label>
            <input id="ac-typed" className="field__input hp__input" type="number" step={1} value={typed} onChange={(event) => setTyped(event.target.value)} />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="hp__keypad-actions">
              <button type="submit" className="button-primary">
                Set
              </button>
              <button type="button" className="button-secondary button-secondary--small" onClick={() => setOpen(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {open === 'attack' && (
        // The breakdown sheet (plan m5b-players-screens-standard B): M4b's parts, unchanged, as a Sheet.
        <BreakdownSheet
          title={attackName}
          figure={attackShown ?? undefined}
          figureHead
          {...(attackFigure.rows.length > 0 ? { rows: attackFigure.rows, toHit: attackFigure.toHit, ...(attackFigure.ending ? { ending: attackFigure.ending } : {}) } : { lines: explainAttack(figures.explaining, attackName) })}
          source={figureSourceOf(setting, 'attack', character.classRef)}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'ac' && (
        <BreakdownSheet title="Armour class" figure={acValue ?? undefined} figureHead lines={acLines} source={figureSourceOf(setting, 'ac', character.classRef)} onClose={() => setOpen(null)}>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {acOverride !== null && (
            <RowList>
              <ListRow title="Clear the AC set by hand" sub="The worked-out AC comes back. Undo from the toast" chevron={false} onOpen={() => void clearAc()} />
            </RowList>
          )}
        </BreakdownSheet>
      )}
    </section>
  );
}
