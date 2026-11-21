// The Player screen's Light section (M5 step 7; docs/05 "Expeditions, time and light", "The Player screen"; docs/06
// key journey 5; ruled M5-8, M5-9, D29). What the character is lighting their way with: the light and its time left,
// its symbol draining in the lit-light glow, turning the warning colour with the ▲ shape at its warnAt; Put out;
// Keep lit (off by default); a holder's Refill. Not lit: **Light** lights the one light the pack has in one tap, or
// asks which when there's more than one (journey 5: 1–2 taps). Burnt out: "Torch burnt out" with Light another, a
// holder's Refill (N left), or the plain words when nothing's left ("No torches left", "Out of oil").
// useCharacterLight is mounted for the whole Player screen, so the burnout toast ("Torch burnt out · Light another",
// no Undo: undoing the turn from the log brings it back) reaches the player on any tab.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { loadCampaignSettings } from '../core/campaignCommands.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import type { TimeUnits } from '../modules/expedition/clock.ts';
import {
  anotherLight,
  burnoutWords,
  douseLight,
  fuelLeft,
  keepLightLit,
  leftWords,
  lightable,
  lightLight,
  lightOptions,
  lightState,
  loadClockNow,
  loadLight,
  othersThan,
  refillable,
  refillLight,
  secondsLeft,
  unitOf,
  type CharacterLight,
  type LightOption,
} from '../modules/expedition/lightPlay.ts';
import { campaignUnits } from '../modules/expedition/play.ts';
import { loadInventory, type InventoryLine } from '../modules/inventory/inventory.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { InfoButton, StackedButton, Switch, WarningSign } from '../ui/parts.tsx';
import { StatusRingMark } from '../ui/StatusRing.tsx';
import './LightSection.css';
import { ringFraction } from '../modules/expedition/statusLook.ts';
import { useToast } from '../ui/ToastHost.tsx';
import type { CampaignSetting } from './campaignSetting.ts';
import { registry } from './services.ts';

/** Whose light: the character as the light commands see it. */
export interface LightCarrier {
  id: string;
  campaignId: string;
  ownerUserId: string | null;
  archived: boolean;
  level: number;
}

export interface CharacterLightView {
  /** Null while loading; 'error' when it couldn't be loaded. */
  light: CharacterLight | null | 'error' | undefined;
  now: number;
  options: LightOption[];
  lines: InventoryLine[];
  units: TimeUnits;
  /** Fuel items left for this light (a holder's), and the fuel's name. */
  fuel: { left: number; name: string | null };
  /** A light type's unit ("turn") and length, for "4 turns left"; null when the setting rules don't have it. */
  unitOf: (typeId: string | null) => { name: string; seconds: number } | null;
  lightIt: (option: LightOption) => Promise<void>;
  lightAnother: () => Promise<void>;
  douse: () => Promise<void>;
  keepLit: (on: boolean) => Promise<void>;
  refill: () => Promise<void>;
  /** Refill and light a holder that burnt out earlier (not the current light). */
  refillAndLight: (option: LightOption) => Promise<void>;
  reload: () => void;
}

/**
 * The character's light, its pack's light items, and the clock, read again whenever the log moves (another device,
 * the GM's Next turn). When it burns out between two reads, the burnout toast shows with its one action.
 */
export function useCharacterLight({
  db,
  user,
  carrier,
  setting,
  refresh,
  quiet = false,
}: {
  db: Db;
  user: CurrentUser;
  carrier: LightCarrier;
  setting: CampaignSetting | null;
  /** Changes when something may have changed (the log's live updates). */
  refresh: number;
  /** No burnout toast (the character overview: the Player screen already shows it to whoever carries the light). */
  quiet?: boolean;
}): CharacterLightView {
  const show = useToast();
  const [light, setLight] = useState<CharacterLight | null | 'error' | undefined>(undefined);
  const [now, setNow] = useState(0);
  const [lines, setLines] = useState<InventoryLine[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [version, setVersion] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    let current = true;
    void Promise.all([loadLight(db, carrier.id), loadClockNow(db, carrier.campaignId), loadInventory(db, carrier.campaignId), loadCampaignSettings(db, carrier.campaignId)]).then(
      ([found, clock, inventory, campaignSettings]) => {
        if (!current) return;
        setLight(found === 'error' || clock === null ? 'error' : found);
        setNow(clock ?? 0);
        setLines((inventory?.lines ?? []).filter((l) => l.actorId === carrier.id));
        setSettings(campaignSettings);
      },
    );
    return () => {
      current = false;
    };
  }, [db, carrier.id, carrier.campaignId, refresh, version]);

  const units = useMemo(() => campaignUnits(settings, setting?.rulesSets ?? []), [settings, setting]);
  const lightTypes = useMemo(() => new Map((setting?.all ?? []).filter((e) => e.kind === 'lightType').map((e) => [e.packEntryId, e.data])), [setting]);
  const options = useMemo(() => lightOptions(lines, lightTypes, units, carrier.level), [lines, lightTypes, units, carrier.level]);
  const row = light && light !== 'error' ? light : null;
  const fuelItem = row?.fuelItem ?? null;
  const fuelName = fuelItem ? (lines.find((l) => l.sourceEntryId === fuelItem)?.name ?? setting?.items.find((e) => e.packEntryId === fuelItem)?.name ?? null) : null;
  const fuel = { left: fuelLeft(lines, fuelItem), name: fuelName };

  /** Runs one light command at a time; reads everything again after. */
  async function run<I, O>(command: Parameters<typeof runCommand<I, unknown, O>>[3], input: I): Promise<O | null> {
    if (busy.current) return null;
    busy.current = true;
    const result = await runCommand(registry, db, user, command, input);
    busy.current = false;
    setVersion((v) => v + 1);
    if (!result.ok) {
      show({ text: result.message, error: true });
      return null;
    }
    return result.value;
  }

  /** Undoes this person's newest change of a kind (the same Undo as the log). */
  const undoLatest = (type: string) => async () => {
    const eventId = await latestChange(db, carrier.campaignId, type, user.id);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: carrier.campaignId, eventId, authorUserId: user.id }) : null;
    setVersion((v) => v + 1);
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  };

  const character = { id: carrier.id, campaignId: carrier.campaignId, ownerUserId: carrier.ownerUserId, archived: carrier.archived };

  async function lightIt(option: LightOption) {
    const lit = await run(lightLight, { character, light: row, option });
    if (lit) show({ text: `Lit ${option.type.name || option.line.name}`, onUndo: () => void undoLatest('light.light')() });
  }

  async function lightAnother() {
    const next = row ? anotherLight(options, row) : (options[0] ?? null);
    if (!next) return show({ text: row ? burnoutWords(row, options, fuel).text : 'No light in the pack.', error: true });
    await lightIt(next);
  }

  async function refill() {
    const done = await run(refillLight, { character, light: row });
    if (done) show({ text: `Refilled ${done.name}${fuel.left > 1 ? `, ${fuel.left - 1} left` : ''}`, onUndo: () => void undoLatest('light.refill')() });
  }

  async function refillAndLight(option: LightOption) {
    const left = fuelLeft(lines, option.type.fuel);
    const done = await run(refillLight, { character, light: row, option });
    if (done) show({ text: `Refilled and lit ${done.name}${left > 1 ? `, ${left - 1} left` : ''}`, onUndo: () => void undoLatest('light.refill')() });
  }

  // The burnout toast (D29): when the light went out since the last read (on this device), on any tab. Its action
  // runs what the screen has by then (the latest copy of the light).
  const latest = useRef({ lightAnother, refill });
  useEffect(() => {
    latest.current = { lightAnother, refill };
  });
  const seen = useRef<CharacterLight | null>(null);
  useEffect(() => {
    if (!row) return;
    const before = seen.current;
    seen.current = row;
    if (quiet || !before || before.litAt === null || row.litAt !== null || row.outAt === null || before.outAt === row.outAt) return;
    const words = burnoutWords(row, options, fuel);
    show({
      text: words.text,
      action:
        words.action === 'light'
          ? { label: words.actionLabel!, run: () => void latest.current.lightAnother() }
          : words.action === 'refill'
            ? { label: words.actionLabel!, run: () => void latest.current.refill() }
            : undefined,
    });
    // Only a change of the light itself shows the toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  return {
    light,
    now,
    options,
    lines,
    units,
    fuel,
    unitOf: (typeId) => {
      const data = typeId ? lightTypes.get(typeId) : undefined;
      return data ? unitOf(data, units) : null;
    },
    lightIt,
    lightAnother,
    refill,
    refillAndLight,
    douse: async () => {
      const done = await run(douseLight, { character, light: row });
      if (done) show({ text: `Put out ${done.name}`, onUndo: () => void undoLatest('light.douse')() });
    },
    keepLit: async (on: boolean) => {
      const done = await run(keepLightLit, { character, light: row, keep: on });
      // Ruled 2026-10-30: "Rushlight will be kept lit".
      if (done) show({ text: `${done.name} ${on ? 'will' : "won't"} be kept lit`, onUndo: () => void undoLatest('light.keepLit')() });
    },
    reload: () => setVersion((v) => v + 1),
  };
}

/**
 * The option's line in the picker: "Torches ×4 · 6 turns · 30 ft"; a holder put out earlier says the fuel left in it
 * ("Lantern · 3 turns left", ruled 2026-10-30: it keeps its fuel).
 */
function optionWords(option: LightOption): string {
  const count = option.line.qty > 1 ? ` ×${option.line.qty}` : '';
  const kept = option.line.fuelLeftSeconds ?? null;
  const length =
    option.type.seconds === null
      ? 'burns on'
      : !option.unit
        ? ''
        : kept !== null
          ? leftWords(kept, option.unit)
          : leftWords(option.type.seconds, option.unit).replace(/ left$/, '');
  return [`${option.line.name}${count}`, length, option.radius].filter(Boolean).join(', ');
}

/** "3 refills left", "1 refill left": the count of refills in the light's line (frame P1). */
export const refillsWords = (n: number) => `${n} ${n === 1 ? 'refill' : 'refills'} left`;

/**
 * Keep lit (tg-1, replacing B10's pressed button): its name, its ⓘ for the rule (05: relights from the character's own
 * pack; off by default; turns itself off when a different light is lit) and the bare switch, as frame P1 draws it.
 * Under the lit light's row in the Light section; in the character overview too.
 */
export function KeepLit({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const [about, setAbout] = useState(false);
  return (
    <span className="keep-lit">
      <span className="keep-lit__name" aria-hidden="true">
        Keep lit
      </span>
      <InfoButton label="Keep lit" onOpen={() => setAbout(true)} />
      <Switch bare label="Keep lit" on={on} onChange={onChange} />
      {about && (
        <Dialog label="Keep lit" onClose={() => setAbout(false)}>
          <p>When this light burns out, another one from this character's own pack is lit at once, and that's logged.</p>
          <p>It's off until you turn it on, and it turns itself off when a different kind of light is lit.</p>
        </Dialog>
      )}
    </span>
  );
}

/**
 * The pack line of the light burning now (lit or running low), or null: At hand (dec-13 C9) draws that light's own row
 * instead of the item's, so the lantern shows once.
 */
export function litLineOf(view: CharacterLightView): { lineId: string | null } | null {
  const { light, now } = view;
  if (!light || light === 'error') return null;
  const state = lightState(light, now);
  return state === 'lit' || state === 'low' ? { lineId: light.lineId ?? null } : null;
}

/**
 * The lit light's rows (tg-1, frame P1): the ring, its name and "Lit, 4 turns left. 3 refills left", the lit toggle at
 * the right; under it Keep lit and Refill. Drawn in the Light section, and in At hand on the Player screen with no
 * heading (dec-13 C9, ps-9). Nothing when the light isn't burning.
 */
export function LitLight({ view, onOpenItem = null }: { view: CharacterLightView; onOpenItem?: (() => void) | null }) {
  const { light, now, fuel } = view;
  if (!light || light === 'error') return null;
  const state = lightState(light, now);
  if (state !== 'lit' && state !== 'low') return null;
  const left = secondsLeft(light, now);
  const words = leftWords(left, view.unitOf(light.typeId));
  const refillable1 = !!light.fuelItem && fuel.left > 0;
  return (
        <>
          <div className="light-block__row">
            {/* The Status ring as the row's glyph (Francis's option B on #560, 2026-11-08): the flame in the light tone,
                the arc the burn's time left, dashed for a light with no burn time. It stays a light, not a status. */}
            <span className="light-block__ring" role="img" aria-label={`${light.name}, lit, ${words}${state === 'low' ? ', running low' : ''}`}>
              <StatusRingMark name={light.name} icon="flame" tone="light" fraction={ringFraction(left, light.fullSeconds ?? light.burnSeconds)} endless={left === null} />
            </span>
            {/* Its name, then "Lit, 4 turns left. 3 refills left" (frame P1): the refills' count is in the line, Refill's
                button carries only its word. */}
            <div className="light-block__body">
              {onOpenItem ? (
                // In At hand the lantern's own row is left out, so its name opens the item's sheet (frame P1; dec-13 C9).
                <button type="button" className="light-block__name light-block__name--open" aria-haspopup="dialog" onClick={onOpenItem}>
                  {light.name}
                </button>
              ) : (
                <p className="light-block__name">{light.name}</p>
              )}
              <p className={state === 'low' ? 'light-block__words light-block__words--low' : 'light-block__words'}>
                {/* Running low: the warning shape with the words, so it's never colour alone. */}
                {state === 'low' && <WarningSign size={16} />}
                {`Lit, ${words}${refillable1 ? `. ${refillsWords(fuel.left)}` : ''}`}
              </p>
            </div>
            {/* Lit or out is one toggle on the light's row (tg-1, frame P1): off puts it out at once, with Undo. */}
            <Switch bare label={`${light.name}: lit`} on onChange={() => void view.douse()} />
          </div>
          <div className="light-block__keep">
            <KeepLit on={light.keepLit} onChange={(on) => void view.keepLit(on)} />
            {refillable1 && <StackedButton icon="jug" label="Refill" className="light-block__refill" onClick={() => void view.refill()} />}
          </div>
        </>
  );
}

/**
 * At hand's light (dec-13 C9; ps-9, frames P1 and P2): the lit light's rows as one block among At hand's rows, with no
 * "Light" heading; its name opens the lantern's item sheet (`onOpenItem`). The block keeps the Light section's look (`light-block`), so its parts are drawn once.
 */
export function LightInAtHand({ view, onOpenItem = null }: { view: CharacterLightView; onOpenItem?: (() => void) | null }) {
  if (!litLineOf(view)) return null;
  return (
    <div className="light-block light-block--at-hand">
      <LitLight view={view} onOpenItem={onOpenItem} />
    </div>
  );
}

/**
 * The Light section: shown only when the character has a light, or a light item to light. With `litInAtHand` (the
 * Player screen, dec-13 C9) a burning light is At hand's, so the section stands down while it burns; its not-lit,
 * burnt-out and pick states stay here, not drawn by the frames (C7's Departures).
 */
export function LightSection({ view, litInAtHand = false }: { view: CharacterLightView; litInAtHand?: boolean }) {
  const [picking, setPicking] = useState(false);
  // The heading's id, one per section (the gallery draws several).
  const headingId = useId();
  const { light, now, options, fuel } = view;
  if (light === undefined) return null;
  if (light === 'error') {
    return (
      <section className="play-block" aria-labelledby={headingId}>
        <h2 id={headingId} className="play-block__title">
          Light
        </h2>
        <p className="form-error" role="alert">
          Couldn't load the light. Check your connection and try again.
        </p>
        <button type="button" className="button-secondary" onClick={view.reload}>
          Try again
        </button>
      </section>
    );
  }
  const state = lightState(light, now);
  // What can be lit now: after a holder burnt out, everything but it (it needs a Refill first), and never a holder
  // that burnt out earlier (its line remembers); those can be refilled and lit from the pick instead.
  const lightableNow = light && state === 'out' ? othersThan(options, light) : lightable(options);
  const refills = refillable(options, view.lines, light?.lineId ?? null);
  const choices = lightableNow.length + refills.length;
  if (state === 'unlit' && options.length === 0) return null;
  const lit = state === 'lit' || state === 'low';
  if (lit && litInAtHand) return null;
  // Light (journey 5): the one light at once; a pick when there's more than one.
  const light1 = () =>
    choices > 1 ? setPicking(true) : lightableNow[0] ? void view.lightIt(lightableNow[0]) : refills[0] ? void view.refillAndLight(refills[0]) : undefined;
  const holderHere = !!light?.fuelItem && !!light.lineId && options.some((o) => o.line.id === light.lineId);

  return (
    <section className="play-block light-block" aria-labelledby={headingId}>
      <h2 id={headingId} className="play-block__title">
        Light
      </h2>
      {lit && light ? (
        <LitLight view={view} />
      ) : state === 'out' && light ? (
        <>
          <p className="light-block__words">{burnoutWords(light, options, fuel).text}</p>
          {(choices > 0 || (holderHere && fuel.left > 0)) && (
            <div className="light-block__actions">
              {holderHere && fuel.left > 0 && (
                <button type="button" className="button-secondary" onClick={() => void view.refill()}>
                  {`Refill (${fuel.left} left)`}
                </button>
              )}
              {choices > 0 && (
                <button type="button" className="button-secondary" onClick={light1}>
                  Light another
                </button>
              )}
            </div>
          )}
        </>
      ) : choices === 0 ? (
        // Only holders that burnt out, and no fuel for them: said plainly (never a button that does nothing).
        <p className="light-block__words">{`Nothing to light: ${options.map((o) => o.line.name).join(', ')} ${options.length === 1 ? 'needs' : 'need'} fuel, and there's none in the pack.`}</p>
      ) : (
        <div className="light-block__actions">
          <button type="button" className="button-secondary" onClick={light1}>
            Light
          </button>
          {choices === 1 && lightableNow[0] && <span className="light-block__meta">{optionWords(lightableNow[0])}</span>}
          {choices === 1 && refills[0] && <span className="light-block__meta">{`${optionWords(refills[0])}, Refill and light`}</span>}
        </div>
      )}
      {picking && (
        <Dialog label="Which light?" onClose={() => setPicking(false)}>
          <ul className="light-block__pick">
            {lightableNow.map((o) => (
              <li key={o.line.id}>
                <button
                  type="button"
                  className="button-secondary light-block__option"
                  onClick={() => {
                    setPicking(false);
                    void view.lightIt(o);
                  }}
                >
                  {optionWords(o)}
                </button>
              </li>
            ))}
            {refills.map((o) => (
              <li key={o.line.id}>
                <button
                  type="button"
                  className="button-secondary light-block__option"
                  onClick={() => {
                    setPicking(false);
                    void view.refillAndLight(o);
                  }}
                >
                  {`${optionWords(o)}, Refill and light (${fuelLeft(view.lines, o.type.fuel)} left)`}
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </section>
  );
}
