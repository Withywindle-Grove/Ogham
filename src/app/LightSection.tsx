// The Player screen's light (M5 step 7; docs/05 "Expeditions, time and light", "The Player screen"; docs/06 key
// journey 5; ruled M5-8, M5-9, D29; lt-1 to lt-9, page 35). The light sits in At hand with no heading, lit or not
// (`LightInAtHand`): its Status ring is the tap ("Put out"; "Light" for the one light, at once; "Light…" for the pick),
// its time left in the ring's arc and its line, turning the warning colour with the ▲ shape at its warnAt; Keep lit's
// row under it while it burns, with a holder's Refill. Burnt out: the ring struck through, the words ("Burnt out. 3
// refills left"), Refill and Light another when each can act, or the words alone when nothing's left.
// useCharacterLight is mounted for the whole Player screen, so the burnout toast ("Torch burnt out · Light another",
// no Undo: undoing the turn from the log brings it back) reaches the player on any tab.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  lightAct,
  lightBlock,
  lightLight,
  lightOptions,
  lightState,
  loadClockNow,
  loadLight,
  optionName,
  refillLight,
  refillsWords,
  secondsLeft,
  unitOf,
  type CharacterLight,
  type LightAct,
  type LightBlock,
  type LightOption,
} from '../modules/expedition/lightPlay.ts';
import { campaignUnits } from '../modules/expedition/play.ts';
import { loadInventory, type InventoryLine } from '../modules/inventory/inventory.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { litWords } from '../modules/expedition/darkness.ts';
import type { FactLine } from '../modules/expedition/sceneTop.ts';
import { FactSheet } from './SceneBand.tsx';
import { InfoButton, StackedButton, StackedGroup, Switch, WarningSign } from '../ui/parts.tsx';
import { StatusRingMark, StatusRingTap } from '../ui/StatusRing.tsx';
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
  /** True once it is lit; false when it couldn't be (its toast says why). */
  lightIt: (option: LightOption) => Promise<boolean>;
  lightAnother: () => Promise<void>;
  douse: () => Promise<void>;
  keepLit: (on: boolean) => Promise<void>;
  refill: () => Promise<void>;
  /** Refill and light a holder that burnt out earlier (not the current light). */
  refillAndLight: (option: LightOption) => Promise<boolean>;
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
    if (lit) show({ text: litWords(option.type.name || option.line.name), onUndo: () => void undoLatest('light.light')() });
    return !!lit;
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
    return !!done;
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
  const kept = option.line.fuelLeftSeconds ?? null;
  const length =
    option.type.seconds === null
      ? 'burns on'
      : !option.unit
        ? ''
        : kept !== null
          ? leftWords(kept, option.unit)
          : leftWords(option.type.seconds, option.unit).replace(/ left$/, '');
  return [optionName(option), length, option.radius].filter(Boolean).join(', ');
}

/**
 * Keep lit (tg-1, replacing B10's pressed button): its name, its ⓘ for the rule (05: relights from the character's own
 * pack; off by default; turns itself off when a different light is lit) and the bare switch, as frame P1 draws it.
 * `before` sits just before the switch (At hand's Refill, lt-6). Under the lit light in At hand, where its row puts the
 * switch at the right edge (LightSection.css); in the character overview as it is (lt-9).
 */
export function KeepLit({ on, onChange, before = null }: { on: boolean; onChange: (on: boolean) => void; before?: ReactNode }) {
  const [about, setAbout] = useState(false);
  return (
    <span className="keep-lit">
      <span className="keep-lit__name" aria-hidden="true">
        Keep lit
      </span>
      <InfoButton label="Keep lit" onOpen={() => setAbout(true)} />
      {before}
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

/** What At hand's light block stands for (lightBlock), or null when there's no block (nothing loaded, or no light). */
function blockOf(view: CharacterLightView): LightBlock | null {
  const { light, now, options, lines, fuel } = view;
  return light === undefined || light === 'error' ? null : lightBlock(light, now, options, lines, fuel);
}

/**
 * Whether At hand has a light block, and the pack line it stands for (the lit light's, the one light's, the burnt-out
 * light's; null for several): At hand draws the block instead of that item's row, so the light shows once.
 */
export function litLineOf(view: CharacterLightView): { lineId: string | null; lit: boolean } | null {
  // The light that couldn't be read keeps the light's place in At hand (⚑ 6, B; page 37, 37C).
  if (view.light === 'error') return { lineId: null, lit: false };
  const block = blockOf(view);
  return block ? { lineId: block.lineId, lit: block.kind === 'lit' } : null;
}

/**
 * What a lit light's row carries for its own item when that item is At hand itself and has charges (Player sitting
 * piece 9, frame 47-3; pss-17, C2, D1): the charges in words, at the end of the light's line, and Use beside the ring
 * (null when the holder can't use it).
 */
export interface LightUse {
  words: string;
  button: ReactNode;
}

/**
 * At hand's light (lt-1 to lt-6; page 35, frames 35A to 35F; dec-13 C9): the light's own row among At hand's rows, with
 * no heading, lit or not. The ring leads it: lit, a tap over "Put out"; one light to light, a tap over "Light"; several,
 * "Light…" opening the pick; burnt out, struck through and still, with Refill and Light another under it when each can
 * act. Its name opens the item's sheet (`onOpenItem`). Lit, Keep lit's row is under it, with a holder's Refill.
 */
export function LightInAtHand({ view, onOpenItem = null, use = null }: { view: CharacterLightView; onOpenItem?: (() => void) | null; use?: LightUse | null }) {
  const [picking, setPicking] = useState(false);
  const block = blockOf(view);
  const { light, now, fuel } = view;
  // Couldn't be read (⚑ 6, ruled B 2026-11-22; page 37, frame 37C): the words and Try again in the light's place, no
  // heading; with nothing else at hand it alone makes At hand.
  if (light === 'error') {
    return (
      <div className="light-block light-block--at-hand">
        <p className="form-error" role="alert">
          Couldn't load the light. Check your connection and try again.
        </p>
        <button type="button" className="button-secondary light-block__retry" onClick={view.reload}>
          Try again
        </button>
      </div>
    );
  }
  if (!block) return null;
  const name = (text: string) =>
    onOpenItem ? (
      // The light's own item row is left out, so its name opens the item's sheet (frame P1; dec-13 C9).
      <button type="button" className="light-block__name light-block__name--open" aria-haspopup="dialog" onClick={onOpenItem}>
        {text}
      </button>
    ) : (
      <p className="light-block__name">{text}</p>
    );
  const row = (ring: ReactNode, title: string, words: ReactNode, low = false, end: ReactNode = null) => (
    <div className="light-block__row">
      {ring}
      <div className="light-block__body">
        {name(title)}
        <p className={low ? 'light-block__words light-block__words--low' : 'light-block__words'}>{words}</p>
      </div>
      {end}
    </div>
  );
  const flame = { icon: 'flame', tone: 'light' } as const;

  if (block.kind === 'lit' && light) {
    const low = lightState(light, now) === 'low';
    const left = secondsLeft(light, now);
    const words = leftWords(left, view.unitOf(light.typeId));
    const refills = !!light.fuelItem && fuel.left > 0;
    return (
      <div className="light-block light-block--at-hand">
        {row(
          // The ring is the tap (lt-1, lt-2): put out at once, with Undo (lt-3).
          <StatusRingTap verb="Put out" label={`Put out ${light.name}`} onTap={() => void view.douse()} name={light.name} {...flame} fraction={ringFraction(left, light.fullSeconds ?? light.burnSeconds)} endless={left === null} />,
          light.name,
          <>
            {/* Running low: the warning shape with the words, so it's never colour alone. */}
            {low && <WarningSign size={16} />}
            {low && <span className="visually-hidden">Running low. </span>}
            {`Lit, ${words}${refills ? `. ${refillsWords(fuel.left)}` : ''}${use ? `. ${use.words}` : ''}`}
          </>,
          low,
          // Use, beside the ring at the row's right (frame 47-3): the item's own Use a charge.
          use?.button ?? null,
        )}
        {/* Keep lit's own row (lt-6): its name and ⓘ, a holder's Refill, the switch at the right edge. */}
        <div className="light-block__keep">
          <KeepLit on={light.keepLit} onChange={(on) => void view.keepLit(on)} before={refills && <StackedButton icon="jug" label="Refill" onClick={() => void view.refill()} />} />
        </div>
      </div>
    );
  }
  if (block.kind === 'lit') return null;

  // Light (journey 5): the one light at once; a pick when there's more than one (`lightAct`, as the Scene's Light
  // pop-up does it, PL8).
  const act = lightAct(block);
  const lightOne = () => {
    if (act?.kind === 'pick') setPicking(true);
    else if (act) void runLightAct(view, act.option, act.refillFirst);
  };
  const ring =
    block.kind === 'one' ? (
      <StatusRingTap
        verb="Light"
        label={`Light ${block.option.type.name || block.option.line.name}`}
        onTap={() => void (block.refillFirst ? view.refillAndLight(block.option) : view.lightIt(block.option))}
        name={block.name}
        {...flame}
        fraction={null}
        still="unlit"
      />
    ) : block.kind === 'several' ? (
      <StatusRingTap verb="Light…" label="Light: choose which" opensPick onTap={() => setPicking(true)} name={block.name} {...flame} fraction={null} still="unlit" />
    ) : (
      // Burnt out, or nothing to light: a picture, not a tap (no verb under it, lt-5).
      // Read aloud "Storm lantern, burnt out", "Reed lamp, not lit", or (nothing to light among several) "No light lit".
      <span className="light-block__still" role="img" aria-label={block.kind === 'burnt' ? `${block.name}, burnt out` : block.lineId ? `${block.name}, not lit` : block.name}>
        <StatusRingMark name={block.name} {...flame} fraction={null} still={block.kind === 'burnt' ? 'out' : 'unlit'} />
      </span>
    );

  return (
    <div className="light-block light-block--at-hand">
      {row(ring, block.name, block.words)}
      {block.kind === 'burnt' && (block.refill || block.another) && (
        <div className="light-block__acts">
          <StackedGroup>
            {block.refill && <StackedButton icon="jug" label="Refill" onClick={() => void view.refill()} />}
            {block.another && <StackedButton icon="torch" label="Light another" aria-haspopup={act?.kind === 'pick' ? 'dialog' : undefined} onClick={lightOne} />}
          </StackedGroup>
        </div>
      )}
      {picking && act?.kind === 'pick' && <LightPick view={view} act={act} onClose={() => setPicking(false)} />}
    </div>
  );
}

/** Lights one light, as At hand's ring does: a holder that burnt out earlier is refilled first. True once it is lit. */
function runLightAct(view: CharacterLightView, option: LightOption, refillFirst: boolean): Promise<boolean> {
  return refillFirst ? view.refillAndLight(option) : view.lightIt(option);
}

/**
 * The pick's choices (journey 5; page 35): each light to light, then each holder that burnt out earlier as "Refill and
 * light (N left)". `onChoose` lights the one tapped. `focusFirst`: focus on the first choice as it shows (a step inside
 * a pop-up, which keeps the focus it opened with; a pop-up of its own focuses it itself).
 */
function LightChoices({ view, act, onChoose, focusFirst = false }: { view: CharacterLightView; act: Extract<LightAct, { kind: 'pick' }>; onChoose: (option: LightOption, refillFirst: boolean) => void; focusFirst?: boolean }) {
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (focusFirst) list.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [focusFirst]);
  return (
    <ul ref={list} className="light-block__pick">
      {act.lightable.map((o) => (
        <li key={o.line.id}>
          <button type="button" className="button-secondary light-block__option" onClick={() => onChoose(o, false)}>
            {optionWords(o)}
          </button>
        </li>
      ))}
      {act.refills.map((o) => (
        <li key={o.line.id}>
          <button type="button" className="button-secondary light-block__option" onClick={() => onChoose(o, true)}>
            {`${optionWords(o)}, Refill and light (${fuelLeft(view.lines, o.type.fuel)} left)`}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** At hand's pick "Which light?", a pop-up of its own: a tap closes it and lights the light tapped. */
function LightPick({ view, act, onClose }: { view: CharacterLightView; act: Extract<LightAct, { kind: 'pick' }>; onClose: () => void }) {
  return (
    <Dialog label="Which light?" onClose={onClose}>
      <LightChoices
        view={view}
        act={act}
        onChoose={(option, refillFirst) => {
          onClose();
          void runLightAct(view, option, refillFirst);
        }}
      />
    </Dialog>
  );
}

/**
 * The players' Light pop-up (page 18, PL8, approved 2026-11-14): the group's light as `FactSheet`'s lines, then its one
 * act, "Light", the stacked button with the torch at the foot's right, lighting the player's own light as At hand does
 * (`lightAct`: one at once, several through the pick, after a burnout Light another's act), with its "Lit a torch."
 * toast and Undo. No button while their light is lit, with nothing to light, or while the light can't be read (`view`
 * null for the GM). With several, the pick "Which light?" is a step inside the same card (the audit of #86, pick 3):
 * Back ‹ or Escape go back to the first step with focus on Light; the one ✕ closes it all. Once lit, `onLit` (the
 * pop-up closes and focus goes back to the Light fact); when lighting fails it stays open under its toast, on its first
 * step with focus on Light.
 */
export function LightFactSheet({ lines, view, onClose, onLit }: { lines: readonly FactLine[]; view: CharacterLightView | null; onClose: () => void; onLit: () => void }) {
  const [picking, setPicking] = useState(false);
  const foot = useRef<HTMLDivElement>(null);
  const act = view ? lightAct(blockOf(view)) : null;
  const pick = picking && act?.kind === 'pick' ? act : null;
  // Back from the pick (Back, Escape, a light that couldn't be lit): focus on Light again once the first step shows.
  const wasPicking = useRef(false);
  useEffect(() => {
    if (wasPicking.current && !pick) foot.current?.querySelector('button')?.focus({ preventScroll: true });
    wasPicking.current = pick !== null;
  }, [pick]);
  const light = async (option: LightOption, refillFirst: boolean) => {
    if (!view) return;
    if (await runLightAct(view, option, refillFirst)) onLit();
    else setPicking(false);
  };
  return (
    <FactSheet
      title="Light"
      lines={lines}
      rule={[]}
      onClose={onClose}
      foot={
        act && (
          <div ref={foot} className="dialog__actions">
            <StackedButton icon="torch" label="Light" onClick={() => (act.kind === 'pick' ? setPicking(true) : void light(act.option, act.refillFirst))} />
          </div>
        )
      }
      step={pick && view ? { title: 'Which light?', body: <LightChoices view={view} act={pick} onChoose={(o, r) => void light(o, r)} focusFirst />, onBack: () => setPicking(false) } : null}
    />
  );
}
