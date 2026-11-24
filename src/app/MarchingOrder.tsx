// Marching order on Scene (M5 step 8; docs/05 "Expeditions, time and light", docs/06 "Marching order"; ruled M5-6,
// 2026-10-25): a column of rows, front to back, each holding 1–3 characters side by side. Each character shows its
// light symbol first, then up to 2 status symbols, then "+N" (M5 step 9). Hold a row to move it (no handles); tap a character for the
// character overview, which also holds "Join the row ahead" and "A row of their own". Saved orders: Save as… and use
// one, or delete one (Undo puts it back). No lock (B11, p2p-21). Every move happens at once with an Undo toast and is
// logged; a move made from an old copy (another device moved it first) is refused, said, and the latest shown, so
// nothing is lost silently. Per party group (DG14, ruled 2026-10-30): it shows one group's order (`group`; 1 is the
// party), with only that group's characters; saved orders are the campaign's.
// As circles (S12 of the whole-Scene plan, 2026-11-14; mc-1 to mc-6, mo-1, ds-12; pictures R1 and page 16 T10): one
// card for the GM and the players alike, in place of the name chips and the players' tiles. Over the ranks, the lights
// lit in a line; "Front", the ranks of one to three party circles (PartyCircle.tsx: portrait or initials, the light's
// ring and halo, hit points under each circle by "Show each other's HP", the light or "No light", the statuses), then
// "Rear". No "You" tag (ds-12). Hold a rank to move it, as before; a circle opens the overview.
// As a player sees it on their Scene (P8 of plan dec-9-the-players-scene; page 18, PL1 and PL6, approved 2026-11-14,
// ap-10): the same card, at the bottom of the page's right column; in a split party a player's own group alone is
// plain "Marching order", with one line naming who is elsewhere, never where (`ownGroup`).
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { loadCampaignSettings, updateCampaign } from '../core/campaignCommands.ts';
import type { Json } from '../core/database.types.ts';
import { isGm, runCommand, type CurrentUser } from '../core/commands.ts';
import { arrange, joinRow, moveRow, moveWords, ownRow, rowOf, type Rows } from '../core/marchingRows.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { leftWords, lightState, loadClockNow, loadLights, secondsLeft, unitOf, type CharacterLight } from '../modules/expedition/lightPlay.ts';
import {
  applyMarchingPreset,
  deleteMarchingPreset,
  loadMarchers,
  loadMarchingOrders,
  playersReorderOf,
  playersSeeHpOf,
  saveMarchingPreset,
  setMarchingOrder,
  whyNot,
  type Marcher,
  type MarchingOrder as Order,
  type MarchingTarget,
} from '../modules/expedition/marchingPlay.ts';
import { loadGroupMembers } from '../modules/expedition/groupPlay.ts';
import { campaignUnits } from '../modules/expedition/play.ts';
import { groupName, groupOf, type GroupOf } from '../core/partyGroups.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { InfoButton, SkeletonRows, StackedButton } from '../ui/parts.tsx';
import { SortableList } from '../ui/SortableList.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { useLogVersion } from './campaignLog.tsx';
import { loadCampaignSetting, type CampaignSetting } from './campaignSetting.ts';
import { CharacterOverview } from './CharacterOverview.tsx';
import { PartyCircle, type CircleLight } from './PartyCircle.tsx';
import { CallerBanner } from './CallerBanner.tsx';
import { callerOf, circleInitials, elsewhereLine, lightLine, litSummary } from './partyCircles.ts';
import { statusWordsOf, useStatusBook } from './Statuses.tsx';
import { ringView } from './statusRings.ts';
import { registry } from './services.ts';
import './MarchingOrder.css';

interface Loaded {
  orders: Order[];
  members: GroupOf;
  party: Marcher[];
  lights: CharacterLight[];
  now: number;
  settings: Record<string, unknown> | null;
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function MarchingOrder({
  db,
  user,
  campaign,
  group = 1,
  split = false,
  ownGroup = false,
  footer,
  dark = false,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  /** The party group whose order it shows (1: the party). */
  group?: number;
  /** The party has split: the title names the group. */
  split?: boolean;
  /**
   * A player seeing their own group alone in a split party (page 18, PL6; ap-10): the title is plain "Marching order"
   * and one line names who is elsewhere, never where, in the lights' line's place.
   */
  ownGroup?: boolean;
  /** Under the tiles: the players' Rest button (B5). */
  footer?: ReactNode;
  /** The group is in darkness (05: the "in darkness" symbol): each tile reads "◑ No light" (SC-g6-2, ruled B 2026-11-03). */
  dark?: boolean;
}) {
  const show = useToast();
  const blocked = useBlockedSheet();
  const logVersion = useLogVersion();
  const [loaded, setLoaded] = useState<Loaded | null | 'error'>(null);
  const [setting, setSetting] = useState<CampaignSetting | null>(null);
  const [version, setVersion] = useState(0);
  // The rows as just moved on this device, shown at once while the move is saved.
  const [moving, setMoving] = useState<Rows | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [about, setAbout] = useState(false);
  const [saved, setSaved] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const { book: statusBook } = useStatusBook(db, user, campaign.id, logVersion + version);

  useEffect(() => {
    let current = true;
    void Promise.all([
      loadMarchingOrders(db, campaign.id),
      loadGroupMembers(db, campaign.id),
      loadMarchers(db, campaign.id),
      loadLights(db, campaign.id),
      loadClockNow(db, campaign.id),
      loadCampaignSettings(db, campaign.id),
    ]).then(([orders, members, party, lights, now, settings]) => {
      if (!current) return;
      if (orders === 'error' || !members || !party || !lights || now === null || !settings) return setLoaded('error');
      setLoaded({ orders, members, party, lights, now, settings });
    });
    return () => {
      current = false;
    };
  }, [db, campaign.id, logVersion, version]);

  useEffect(() => {
    let current = true;
    void loadCampaignSetting(db, user.id, campaign.id).then((found) => current && setSetting(found));
    return () => {
      current = false;
    };
  }, [db, user.id, campaign.id]);

  if (loaded === null) {
    return (
      <section className="marching" aria-label="Marching order">
        <SkeletonRows rows={3} label="Loading the marching order" />
      </section>
    );
  }
  if (loaded === 'error') {
    return (
      <section className="marching" aria-labelledby="marching-title">
        <h2 id="marching-title" className="label">
          Marching order
        </h2>
        <p className="marching__note" role="alert">
          Couldn't load the marching order. Check your connection and try again.
        </p>
        <StackedButton icon="refresh" label="Try again" onClick={() => setVersion((v) => v + 1)} />
      </section>
    );
  }

  const { orders, members, lights, now, settings } = loaded;
  // Only this group's characters; the saved orders are the campaign's (group 1's row).
  const party = loaded.party.filter((m) => groupOf(members, m.id) === group);
  const order = orders.find((o) => o.group === group) ?? null;
  const partyOrder = orders.find((o) => o.group === 1) ?? null;
  const gm = isGm(user, campaign.id);
  const viewer = gm ? 'gm' : 'player';
  const target: MarchingTarget = { campaignId: campaign.id, group, playersReorder: playersReorderOf(settings) };
  const why = whyNot(user, target);
  const rows = moving ?? arrange(order?.rows ?? [], party.map((m) => m.id));
  // PL6: a player's own group alone needs no group name; one line says who is elsewhere (their names only).
  const elsewhere = split && ownGroup;
  const title = split && !elsewhere ? `Marching order: ${groupName(group)}` : 'Marching order';
  const othersLine = elsewhere ? elsewhereLine(loaded.party.filter((m) => groupOf(members, m.id) !== group).map((m) => m.name)) : null;
  const byId = new Map(party.map((m) => [m.id, m]));
  const nameOf = (id: string) => byId.get(id)?.name ?? 'someone';
  const units = campaignUnits(settings, setting?.rulesSets ?? []);
  const lightTypes = new Map((setting?.all ?? []).filter((e) => e.kind === 'lightType').map((e) => [e.packEntryId, e.data]));
  const seesHp = (m: Marcher) => gm || m.ownerUserId === user.id || playersSeeHpOf(settings);

  /** Undoes this person's newest change of a kind (the same Undo as the log). */
  const undoLatest = async (type: string) => undoEvent(await latestChange(db, campaign.id, type, user.id));
  /** Undoes one logged change by its event (the caller's toast keeps its own, so a later settings change isn't the one undone). */
  const undoEvent = async (eventId: string | null) => {
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
    setVersion((v) => v + 1);
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  };

  // The caller (mc-76): the party's characters, no hirelings (a caller is a person); kept in the campaign's settings,
  // written by the GM through the settings' own command (the lead, 2026-11-14), with its Undo.
  const callers = loaded.party.filter((m) => m.kind === 'pc');
  const callerInitials = circleInitials(callers);
  const caller = callerOf(settings, callers.map((m) => m.id));
  async function chooseCaller(id: string | null) {
    setChoosing(false);
    // The caller picked again: nothing to write.
    if (id === caller) return;
    // Read the settings fresh, so a switch changed elsewhere since this loaded is kept.
    const latest = await loadCampaignSettings(db, campaign.id);
    if (!latest) return show({ text: "Couldn't change the caller. Check your connection and try again.", error: true });
    const result = await runCommand(registry, db, user, updateCampaign, { campaignId: campaign.id, settings: { ...latest, caller: id } as Json });
    setVersion((v) => v + 1);
    if (!result.ok) return show({ text: result.message, error: true });
    // This change's own event, kept for its Undo.
    const eventId = await latestChange(db, campaign.id, 'campaign.update', user.id);
    const who = callers.find((m) => m.id === id)?.name;
    show({ text: who ? `${who} is the caller` : 'No caller now', onUndo: () => void undoEvent(eventId) });
  }

  /** A move: shown at once, saved, then an Undo toast. From an old copy it's refused, said, and the latest shown. */
  async function move(next: Rows) {
    if (why) return show({ text: why, error: true });
    if (busy) return;
    const before = rows;
    setMoving(next);
    setBusy(true);
    const result = await runCommand(registry, db, user, setMarchingOrder, { target, order, rows: next });
    setBusy(false);
    setMoving(null);
    setVersion((v) => v + 1);
    if (!result.ok) return show({ text: result.message, error: true });
    show({ text: capital(moveWords(before, next, nameOf)), onUndo: () => void undoLatest('marching.set') });
  }

  // The overview's marching moves for one character (only for those who may move it).
  const movesFor = (id: string) => {
    if (why) return [];
    const at = rowOf(rows, id);
    const joinWay = at > 0 ? 'ahead' : 'behind';
    const neighbours = rows[joinWay === 'ahead' ? at - 1 : at + 1];
    const found: { label: string; run: () => void }[] = [];
    if (neighbours) {
      found.push({
        label: `Walk beside ${neighbours.map(nameOf).join(', ')}`,
        run: () => {
          const joined = joinRow(rows, id, joinWay);
          setOpen(null);
          if (joined === 'full') show({ text: 'That row has 3 already. Move someone out of it first.', error: true });
          else if (joined) void move(joined);
        },
      });
    }
    const alone = ownRow(rows, id);
    if (alone) {
      found.push({
        label: 'A row of their own',
        run: () => {
          setOpen(null);
          void move(alone);
        },
      });
    }
    return found;
  };

  const overview = open ? byId.get(open) : undefined;
  const items = rows.map((row) => ({ key: row.join('|'), label: row.map(nameOf).join(', '), row }));
  const initials = circleInitials(party);
  /** A lit light on a character, as the circle draws it; null when none is lit. */
  const lightOf = (id: string): (CircleLight & { words: string }) | null => {
    const light = lights.find((l) => l.actorId === id) ?? null;
    const state = lightState(light, now);
    if (!light || (state !== 'lit' && state !== 'low')) return null;
    const left = secondsLeft(light, now);
    const of = light.fullSeconds ?? light.burnSeconds;
    const data = light.typeId ? lightTypes.get(light.typeId) : undefined;
    const words = leftWords(left, data ? unitOf(data, units) : null);
    return { name: light.name, fraction: left === null || !of ? 1 : left / of, line: lightLine(light.name, words), low: state === 'low', words };
  };
  const ringsOf = (id: string) => (statusBook && statusBook !== 'error' ? statusBook.statuses.filter((st) => st.actorId === id).map((st) => ringView(st, statusBook, viewer)) : []);
  const said = litSummary(
    rows.flat().flatMap((id) => {
      const light = lightOf(id);
      return light ? [{ who: nameOf(id), light: light.name, words: light.words }] : [];
    }),
  );
  const titleId = `marching-title-${group}`;

  return (
    <section className="marching" aria-labelledby={titleId}>
      {group === 1 && (
        <CallerBanner
          db={db}
          campaignId={campaign.id}
          people={callers.map((m) => ({ id: m.id, name: m.name, initials: callerInitials.get(m.id) ?? '?', portraitAssetId: m.portraitAssetId ?? null }))}
          caller={caller}
          open={choosing}
          onPress={() => (gm ? setChoosing((on) => !on) : blocked.explain("Can't change the caller", 'The GM chooses the caller in this campaign.'))}
          onClose={() => setChoosing(false)}
          onChoose={(id) => void chooseCaller(id)}
        />
      )}
      <div className="marching__head">
        <h2 id={titleId} className="marching__title">
          {title}
        </h2>
        <InfoButton label="the marching order" onOpen={() => setAbout(true)} />
        <span className="marching__spacer" />
        {/* The unrolled scroll (ic-4, S17). */}
        <StackedButton icon="scroll-unfurled" label="Saved orders" onClick={() => setSaved(true)} />
      </div>
      {why && rows.length > 0 && <p className="marching__note">{why}</p>}
      {blocked.sheet}

      {rows.length === 0 ? (
        <p className="marching__note">{split ? `No one in ${groupName(group)} now.` : 'No characters yet. Approved characters join the marching order here.'}</p>
      ) : (
        <>
          {/* PL6: in a split party a player's own group reads who is elsewhere, in the lights' line's place. */}
          {othersLine ? <p className="marching__say">{othersLine}</p> : said && <p className="marching__say">{said}</p>}
          <p className="marching__way">
            <span aria-hidden="true">↑</span> Front
          </p>
          <SortableList
            items={items}
            label="Marching order, front to back"
            blocked={!!why}
            onBlocked={() => why && blocked.explain("Can't move them now", why)}
            onMove={(from, to) => void move(moveRow(rows, from, to))}
            render={(item, index) => (
              <div className="marching__rank">
                <span className="marching__place" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="marching__abreast">
                  {item.row.map((id) => {
                    const marcher = byId.get(id);
                    const light = lightOf(id);
                    const hp = marcher && seesHp(marcher) && marcher.hpMax !== null ? { current: marcher.hpCurrent, max: marcher.hpMax } : null;
                    const statuses = statusWordsOf(statusBook, id);
                    const noLight = dark && !light;
                    return (
                      <PartyCircle
                        key={id}
                        db={db}
                        campaignId={campaign.id}
                        name={nameOf(id)}
                        initials={initials.get(id) ?? '?'}
                        portraitAssetId={marcher?.portraitAssetId ?? null}
                        light={light}
                        dark={noLight}
                        hp={hp}
                        statuses={ringsOf(id)}
                        label={`${nameOf(id)}${light ? `, ${light.name} lit, ${light.words}` : noLight ? ', no light' : ''}${hp ? `, ${hp.current ?? 'not set'} of ${hp.max} hit points` : ''}${statuses ? `, ${statuses}` : ''}. Details`}
                        onOpen={() => setOpen(id)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          />
          <p className="marching__way">Rear</p>
        </>
      )}
      {footer}

      {overview && (
        <CharacterOverview
          db={db}
          user={user}
          character={overview}
          setting={setting}
          settings={settings}
          showHp={seesHp(overview)}
          refresh={logVersion + version}
          moves={movesFor(overview.id)}
          onClose={() => setOpen(null)}
        />
      )}

      {about && (
        <Dialog label="Marching order" onClose={() => setAbout(false)}>
          <p>
            Front to back. Each row holds 1 to 3 characters side by side.
            {elsewhere ? " This is your group's order; each group has its own." : split ? ` This is ${groupName(group)}'s order; each group has its own.` : ''}
          </p>
          <p>Hold a row for a moment to move it. Tap a character for their details, and to walk beside the row ahead or take a row of their own.</p>
          <p>{gm ? 'You can always move it.' : (why ?? 'Anyone at the table can move it. Every move is in the log.')}</p>
        </Dialog>
      )}

      {saved && (
        <SavedOrders
          order={partyOrder}
          why={why}
          hasRows={(order?.rows.length ?? 0) > 0}
          onClose={() => setSaved(false)}
          onUse={async (name) => {
            setSaved(false);
            if (why) return show({ text: why, error: true });
            const result = await runCommand(registry, db, user, applyMarchingPreset, { target, order, name });
            setVersion((v) => v + 1);
            if (!result.ok) return show({ text: result.message, error: true });
            show({ text: `Marching as “${name}”`, onUndo: () => void undoLatest('marching.usePreset') });
          }}
          onSave={async (name) => {
            if (why) {
              show({ text: why, error: true });
              return false;
            }
            const result = await runCommand(registry, db, user, saveMarchingPreset, { target, order: partyOrder, name });
            setVersion((v) => v + 1);
            if (!result.ok) {
              show({ text: result.message, error: true });
              return false;
            }
            setSaved(false);
            show({ text: `Saved as “${name.trim()}”`, onUndo: () => void undoLatest('marching.savePreset') });
            return true;
          }}
          onDelete={async (name) => {
            if (why) return show({ text: why, error: true });
            const result = await runCommand(registry, db, user, deleteMarchingPreset, { target, order: partyOrder, name });
            setVersion((v) => v + 1);
            if (!result.ok) return show({ text: result.message, error: true });
            show({ text: `Deleted “${name}”`, onUndo: () => void undoLatest('marching.deletePreset') });
          }}
        />
      )}
    </section>
  );
}

/** Saved orders: each one to march in (or delete, with Undo), and Save as… for the order as it is. */
function SavedOrders({
  order,
  why,
  hasRows,
  onClose,
  onUse,
  onSave,
  onDelete,
}: {
  order: Order | null;
  why: string | null;
  hasRows: boolean;
  onClose: () => void;
  onUse: (name: string) => void;
  onSave: (name: string) => Promise<boolean>;
  onDelete: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const presets = order?.presets ?? [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (why) return setProblem(why);
    if (!hasRows) return setProblem("Move someone first: there's no order to save yet.");
    if (!name.trim()) return setProblem('Give it a name, like “Tunnel” or “Open road”.');
    if (name.trim().length > 60) return setProblem('Keep the name to 60 characters.');
    await onSave(name);
  }

  return (
    <Dialog label="Saved orders" onClose={onClose}>
      {presets.length === 0 ? (
        <p className="marching__note">None yet. Save the order as it is now, then march in it again with one tap.</p>
      ) : (
        <ul className="marching__presets">
          {presets.map((p) => (
            <li key={p.name} className="marching__preset-row">
              <button type="button" className="button-secondary marching__preset" onClick={() => onUse(p.name)}>
                {p.name}
              </button>
              <button type="button" className="button-secondary button-secondary--small" aria-label={`Delete ${p.name}`} onClick={() => onDelete(p.name)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="marching__save" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span className="label">Save as…</span>
          <input
            className="field__input"
            value={name}
            maxLength={60}
            onChange={(event) => {
              setName(event.target.value);
              setProblem(null);
            }}
            placeholder="Tunnel"
          />
        </label>
        {problem && (
          <p className="form-error" role="alert">
            {problem}
          </p>
        )}
        <div className="marching__save-actions">
          <button type="submit" className="button-secondary">
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}
