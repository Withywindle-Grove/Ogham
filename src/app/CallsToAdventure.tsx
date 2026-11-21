// Calls to adventure for the GM (dec-12 piece B; ruled mc-61 to mc-64, 2026-11-12; pictures 03-01, 03-02, 03-03,
// 03-03b, 03-03c, 03-10, 03-11, 03-12, 03-14, 03-15 on the branch design-december-mockups, approved 2026-11-12):
//   CallsLine, on the GM's card of the place the party is in, a line of its own: the hook's mark, "Calls to
//     adventure", and what is left to give at the right ("6 of 17 sent", across every adventure). Not drawn at all
//     while no attached adventure has a hook (frame 11).
//   The sheet it opens (a Dialog, closed by its ✕; ds-9):
//     the adventures, one row each with "1 of 5 sent" or "All sent" (frame 2); skipped when there is one (mc-62);
//     an adventure's hooks (frame 2b): its mark, its name, "Pays …", "From <giver>, at <place>", and a sent one's
//       "Sent to the party, day 1"; it keeps its chevron (it can be sent again to someone else);
//     a hook (frame 3): its words in the book's paragraphs, "Pays" and "Given by" as labelled lines, the source line,
//       the quill beside the ✕ (Edit before sending), and "Who hears it?" answered by Character (the crown) or Party
//       (three figures); Back at the foot;
//     Edit before sending (frame 4): the words and what it pays as plain fields from the book's; "Back to the book's
//       words"; Cancel and "Use these words" (the accent, rightmost; ds-10); it changes this send, never the pack.
//   Sending (hook.send) acts at once with Undo in the toast; a second send to the same hearer is refused in words.
// Where the line shows (plan scene-point-to-point B19; p2p-15, changing mc-61; ⚑ 8 ruled 2026-11-18): only in a
// settlement, never at a Location of an adventure, except at a Location where one of the adventure's calls comes from a
// person there (the hook's `giverNpcId`, that npc's `locationId`; 07 §7a and §5). Only the line goes: the sheet and the
// send are the same wherever it shows, and the GM's sending is not limited. A call that comes from a place waits for a
// format line from Design. `callsLineShows` is the rule; `CallsLine` takes where it is drawn as `at`.
// Icons are the app's present ones until the icon set (dec-9 A): the hook's mark is `sheet`, the quill `edit`, Character
// `crown`, Party `players`. Notices are piece F: not here. Character asks which character on a step of the same sheet (not
// pictured: scope check SC-1 in docs/status/2026-11-13-dec-12-b-calls-to-adventure.md).
// Rumours (dec-12 piece E; ruled mc-65, tb-1, rm-1; pictures 03-04-rumours, 03-04b-who-hears-rumour and the rumours' row
// of 03-10, approved 2026-11-12): after an adventure's hooks, its rumours tables, a row each with the die and how many
// rows have been heard (frame 2b); a table (frame 5) in the book's table style, its title bar the table's name, the head
// row the die, "Rumour", and "Truth" under the crossed eye, each row its number, its words, "Heard by …" under a heard
// one, and its truth as the word alone; five rows, then "3 more rows. Show all 8"; a tap on a row asks "Who hears it?"
// (frame 6): its words, Character or Party as for a hook, and the truth's mark with the crossed eye, which is never
// sent. Giving (rumour.give) acts at once with Undo; only the row's words leave the GM's library.
import { useEffect, useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { loadCampaignSettings } from '../core/campaignCommands.ts';
import type { Db } from '../core/supabase.ts';
import { undoChange } from '../core/undo.ts';
import { readClock } from '../modules/expedition/clock.ts';
import { campaignUnits } from '../modules/expedition/play.ts';
import type { StoredHook } from '../modules/library/adventureHooks.ts';
import {
  alreadySent,
  alreadyWords,
  hookNameProblem,
  hookRowLines,
  loadCalls,
  loadHearers,
  sendEventId,
  sendHook,
  sendsOf,
  sentCount,
  sentLine,
  sentWords,
  type Adventure,
  type Calls,
  type Hearer,
} from '../modules/library/callsToAdventure.ts';
import {
  alreadyHeard,
  giveRumour,
  givesOf,
  heardLine,
  heardWords,
  rumourKey,
  RUMOURS_SHOWN,
  type RumourRow,
  type RumourTable,
} from '../modules/library/rumours.ts';
import { BookTapHead } from '../ui/creation.tsx';
import { BookTypeScope, Dialog } from '../ui/Dialog.tsx';
import { DieGlyph, dieOf } from '../ui/dice.tsx';
import { Icon } from '../ui/icons.tsx';
import { ListRow, OptionRow, RowList, SkeletonRows, SourceLine } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { useLogVersion } from './campaignLog.tsx';
import { loadCampaignSetting } from './campaignSetting.ts';
import { registry } from './services.ts';
import './CallsToAdventure.css';

/** The calls to adventure, reloaded whenever the log moves (a send, an Undo, a pack attached). */
function useCalls(db: Db, campaignId: string, bump: number): Calls | null | 'error' {
  const logVersion = useLogVersion();
  const [calls, setCalls] = useState<{ key: string; calls: Calls | 'error' } | null>(null);
  const key = `${campaignId}:${logVersion}:${bump}`;
  useEffect(() => {
    let live = true;
    void loadCalls(db, campaignId).then((found) => live && setCalls({ key, calls: found ?? 'error' }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the campaign and the versions
  }, [db, key]);
  // While a reload runs, the last list stays (no flash of the loading frame after a send).
  return calls ? calls.calls : null;
}

/**
 * Where the line would be drawn (p2p-15): a settlement, or any other place with the pack it comes from and its map key
 * and name as the pack writes them (a place typed by hand has no pack).
 */
export type CallsAt = { settlement: true } | { settlement: false; packId: string | null; key: string | null; name: string };

/** A place's words as the importer keeps them for a hook's giver: its map key, then its name ("3 The Reed Market"). */
const placeWords = (key: string | null, name: string) =>
  [key ?? '', name]
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');

/**
 * Whether the calls line shows here (B19; p2p-15, ⚑ 8): in a settlement whenever an adventure has a hook or a rumours
 * table; anywhere else only where a hook of that place's own adventure is given by a person there (its `giverNpcId`,
 * whose `locationId` is this place). The importer keeps the giver's place as its words, key and name, not its id
 * (`giverOf`, adventureHooks.ts), so the place is matched by those words within the same pack. A hook with no giver, a
 * giver somewhere else, or a place typed by hand: no line.
 */
export function callsLineShows(adventures: readonly Adventure[], at: CallsAt): boolean {
  if (adventures.length === 0) return false;
  if (at.settlement) return true;
  const here = placeWords(at.key, at.name);
  if (!at.packId || !here) return false;
  return adventures.some((a) => a.packId === at.packId && a.hooks.some((h) => !!h.giverNpcId && !!h.giver && placeWords(null, h.giver.place) === here));
}

/**
 * The line on the place's card (mc-61) and the sheet it opens. Nothing while no adventure has a hook; with `at`, nothing
 * where `callsLineShows` says no (without it: the settlement's card, which PartyGroups draws only in a settlement).
 */
export function CallsLine({ db, user, campaign, placeName, at, onBlocked }: { db: Db; user: CurrentUser; campaign: OpenCampaign; placeName: string; at?: CallsAt; onBlocked?: () => void }) {
  const [bump, setBump] = useState(0);
  const calls = useCalls(db, campaign.id, bump);
  const [open, setOpen] = useState(false);
  if (calls === null || calls === 'error' || !callsLineShows(calls.adventures, at ?? { settlement: true })) return null;
  const count = sentCount(calls.adventures, calls.sends);
  // With rumours but no hooks there is nothing to count (piece E): the line alone.
  const counted = count.of > 0 ? sentWords(count) : '';
  return (
    <>
      <button type="button" className="button-secondary calls-line" aria-label={counted ? `Calls to adventure, ${counted}` : 'Calls to adventure'} onClick={() => setOpen(true)}>
        <Icon name="sheet" size={20} />
        <span className="calls-line__words">Calls to adventure</span>
        {counted && <span className="calls-line__count">{counted}</span>}
      </button>
      {open && <CallsSheet db={db} user={user} campaign={campaign} placeName={placeName} calls={calls} onChanged={() => setBump((b) => b + 1)} onClose={() => setOpen(false)} onBlocked={onBlocked} />}
    </>
  );
}

type View =
  | { at: 'adventures' }
  | { at: 'hooks'; packId: string }
  | { at: 'hook'; packId: string; hookId: string }
  | { at: 'edit'; packId: string; hookId: string }
  | { at: 'who'; packId: string; hookId: string }
  | { at: 'rumours'; packId: string; tableId: string }
  | { at: 'rumour'; packId: string; tableId: string; min: number; max: number }
  | { at: 'rumourWho'; packId: string; tableId: string; min: number; max: number };

/** The words and pays for this send: the book's until the GM changes them (frame 4). */
type Words = { key: string; body: string; pays: string };

type SheetProps = {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  placeName: string;
  calls: Calls;
  onChanged: () => void;
  onClose: () => void;
  /**
   * Reading ahead on the GM's place page (plan scene-point-to-point B2): the sheet stays readable, and a send or a give
   * calls this (the page's pop-up) and writes nothing.
   */
  onBlocked?: () => void;
};

/**
 * The sheet, every step of it, in the book's scope (dec-12 E; the lead's ruling for E: the whole Calls to adventure
 * sheet, B's frames with it): BookTypeScope draws each step's Dialog in the book's faces, its title included.
 */
export function CallsSheet(props: SheetProps) {
  return (
    <BookTypeScope.Provider value>
      <CallsSheetSteps {...props} />
    </BookTypeScope.Provider>
  );
}

/** The sheet's steps: the adventures, an adventure's hooks and rumours, a hook, its edit, a rumour table, who hears it. */
function CallsSheetSteps({
  db,
  user,
  campaign,
  placeName,
  calls,
  onChanged,
  onClose,
  onBlocked,
}: SheetProps) {
  const show = useToast();
  const single = calls.adventures.length === 1;
  const [view, setView] = useState<View>(single ? { at: 'hooks', packId: calls.adventures[0]!.packId } : { at: 'adventures' });
  const [edited, setEdited] = useState<Words | null>(null);
  const [busy, setBusy] = useState(false);
  const [hearers, setHearers] = useState<Hearer[] | null>(null);
  const [dayOf, setDayOf] = useState<((seconds: number) => number) | null>(null);
  // The row last given in this sheet, marked on its table (frame 5's picked row), and the tables shown whole.
  const [marked, setMarked] = useState<string | null>(null);
  const [whole, setWhole] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let live = true;
    void loadHearers(db, campaign.id, user.id).then((found) => live && setHearers(found ?? []));
    // The day a send was made ("day 1"), from the clock's units; without them the line leaves the day out.
    void Promise.all([loadCampaignSettings(db, campaign.id), loadCampaignSetting(db, user.id, campaign.id)]).then(([settings, setting]) => {
      if (!live || !settings) return;
      const units = campaignUnits(settings, setting?.rulesSets ?? []);
      setDayOf(() => (seconds: number) => readClock(seconds, units).day);
    });
    return () => {
      live = false;
    };
  }, [db, user.id, campaign.id]);

  const adventureOf = (packId: string): Adventure | null => calls.adventures.find((a) => a.packId === packId) ?? null;
  const hookOf = (packId: string, hookId: string): StoredHook | null => adventureOf(packId)?.hooks.find((h) => h.id === hookId) ?? null;
  const hookKey = (packId: string, hookId: string) => `${packId}/${hookId}`;
  const wordsFor = (packId: string, hook: StoredHook): Words =>
    edited && edited.key === hookKey(packId, hook.id) ? edited : { key: hookKey(packId, hook.id), body: hook.text, pays: hook.pays };

  // The toast's Undo undoes the send it names, by that send's own log line, never the newest send (review of #741).
  const undoSend = async (sendId: string, type: 'hook.send' | 'rumour.give' = 'hook.send') => {
    const eventId = await sendEventId(db, campaign.id, sendId, type);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
    onChanged();
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  };

  async function send(packId: string, hook: StoredHook, actorId: string | null) {
    if (busy) return;
    if (onBlocked) return onBlocked();
    const hearer = actorId === null ? 'the party' : (hearers?.find((h) => h.id === actorId)?.name ?? 'That character');
    if (alreadySent(calls.sends, packId, hook.id, actorId)) return show({ text: alreadyWords(hearer), error: true });
    const nameProblem = hookNameProblem(hook.name);
    if (nameProblem) return show({ text: nameProblem, error: true });
    const words = wordsFor(packId, hook);
    if (!words.body.trim()) return show({ text: 'Write the words to send.', error: true });
    setBusy(true);
    const result = await runCommand(registry, db, user, sendHook, { campaignId: campaign.id, packId, hookId: hook.id, actorId, body: words.body, pays: words.pays });
    setBusy(false);
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    setEdited(null);
    setView({ at: 'hooks', packId });
    const sendId = result.value.id;
    show({ text: `Sent to ${hearer}: ${hook.name}`, onUndo: () => void undoSend(sendId) });
  }

  // rumour.give: the row's words to a character or the party; its truth never leaves (rm-1).
  async function give(table: RumourTable, row: RumourRow, actorId: string | null) {
    if (busy) return;
    if (onBlocked) return onBlocked();
    const hearer = actorId === null ? 'the party' : (hearers?.find((h) => h.id === actorId)?.name ?? 'That character');
    if (alreadyHeard(calls.gives, table, row, actorId)) return show({ text: alreadyWords(hearer), error: true });
    setBusy(true);
    const result = await runCommand(registry, db, user, giveRumour, { campaignId: campaign.id, packId: table.packId, tableId: table.id, min: row.min, max: row.max, actorId });
    setBusy(false);
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    setMarked(rumourKey(table.id, row));
    setView({ at: 'rumours', packId: table.packId, tableId: table.id });
    const sendId = result.value.id;
    show({ text: `Sent to ${hearer}: ${table.name}, ${row.range}`, onUndo: () => void undoSend(sendId, 'rumour.give') });
  }

  // The way back from a rumours sheet and from the character step (TW9, TW9b, approved ap-12; the step: wh-1): the link under its title,
  // "‹ <where it came from>", in the link style (`button-quiet`, a 44 px tap), in place of a Back button in the foot.
  const wayBack = (to: View, where: string) => (
    <button type="button" className="button-quiet calls__way-back" aria-label={`Back to ${where}`} onClick={() => setView(to)}>
      {`‹ ${where}`}
    </button>
  );

  // Back at the foot of B's sheets (the adventures' list, an adventure, a hook).
  const back = (to: View) => (
    <div className="calls__foot">
      <button type="button" className="button-secondary" onClick={() => setView(to)}>
        Back
      </button>
    </div>
  );

  // Which character (SC-1 for a hook; the same step for a rumour): the characters in play; a tap sends at once. The
  // way back is the link under the title to where it came from (wh-1; page 19's TW9b, ap-12), for a hook and a rumour alike.
  const whoStep = (from: string, onPick: (actorId: string) => void, backTo: View) => (
    <Dialog label="Who hears it?" onClose={onClose}>
      {wayBack(backTo, from)}
      {hearers === null ? (
        <SkeletonRows rows={3} label="Loading the characters" />
      ) : hearers.length === 0 ? (
        <p className="calls__line">No player has a character in play yet.</p>
      ) : (
        // SC-1 (approved by Francis, 2026-11-13): the app's option row, the character's name with whose it is in the muted
        // line ("you" for one the GM plays); a tap sends at once.
        <div className="calls__hearers" role="radiogroup" aria-label="Characters">
          {hearers.map((h) => (
            <OptionRow key={h.id} name={h.name} summary={h.player} label={`Send to ${h.name}, ${h.player}`} onPick={() => onPick(h.id)} />
          ))}
        </div>
      )}
    </Dialog>
  );

  // Frame 2: the adventures.
  if (view.at === 'adventures') {
    return (
      <Dialog label="Calls to adventure" onClose={onClose}>
        <p className="calls__kicker">{placeName}</p>
        <RowList label="Adventures">
          {calls.adventures.map((a) => (
            <ListRow key={a.packId} title={a.name} value={a.hooks.length > 0 ? sentWords(sentCount([a], calls.sends), true) : undefined} onOpen={() => setView({ at: 'hooks', packId: a.packId })} />
          ))}
        </RowList>
      </Dialog>
    );
  }

  const adventure = adventureOf(view.packId);
  if (!adventure) {
    // An adventure detached while the sheet was open: the list again, or the sheet closes with nothing to show.
    return (
      <Dialog label="Calls to adventure" onClose={onClose}>
        <p className="calls__line">That adventure isn't attached any more.</p>
        {!single && back({ at: 'adventures' })}
      </Dialog>
    );
  }

  // Frame 2b (and 2c with one adventure: no Back, the place in the small line).
  if (view.at === 'hooks') {
    return (
      <Dialog label={adventure.name} onClose={onClose}>
        <p className="calls__kicker">{single ? placeName : 'Calls to adventure'}</p>
        {adventure.hooks.length > 0 && <h3 className="calls__heading">Hooks</h3>}
        {adventure.hooks.length > 0 && (
        <RowList label="Hooks">
          {adventure.hooks.map((hook) => {
            const sent = sendsOf(calls.sends, adventure.packId, hook.id);
            return (
              <ListRow
                key={hook.id}
                lead={
                  <span className="calls__mark" aria-hidden="true">
                    <Icon name="sheet" size={20} />
                  </span>
                }
                title={hook.name}
                sub={
                  <>
                    {hookRowLines(hook).map((line) => (
                      <span key={line} className="calls__sub">
                        {line}
                      </span>
                    ))}
                    {sent.map((s) => (
                      <span key={s.id} className="calls__sub calls__sent">
                        {sentLine(s, hearers ?? [], dayOf)}
                      </span>
                    ))}
                  </>
                }
                openLabel={[hook.name, ...hookRowLines(hook), ...sent.map((s) => sentLine(s, hearers ?? [], dayOf))].join(', ')}
                onOpen={() => setView({ at: 'hook', packId: adventure.packId, hookId: hook.id })}
              />
            );
          })}
        </RowList>
        )}
        {adventure.rumours.length > 0 && <h3 className="calls__heading">Rumours</h3>}
        {adventure.rumours.length > 0 && (
          <RowList label="Rumours">
            {adventure.rumours.map((table) => {
              const glyph = table.die ? dieOf(table.die) : null;
              return (
                <ListRow
                  key={table.id}
                  lead={
                    <span className="calls__mark" aria-hidden="true">
                      <Icon name="open-book" size={20} />
                    </span>
                  }
                  title={table.name}
                  sub={
                    <span className="calls__sub calls__heard">
                      {glyph && <DieGlyph die={glyph} size={16} />}
                      {heardWords(table, calls.gives)}
                    </span>
                  }
                  openLabel={`${table.name}, ${heardWords(table, calls.gives)}`}
                  onOpen={() => setView({ at: 'rumours', packId: adventure.packId, tableId: table.id })}
                />
              );
            })}
          </RowList>
        )}
        {!single && back({ at: 'adventures' })}
      </Dialog>
    );
  }

  if (view.at === 'rumours' || view.at === 'rumour' || view.at === 'rumourWho') {
    const table = adventure.rumours.find((t) => t.id === view.tableId);
    if (!table) {
      return (
        <Dialog label="Rumours" onClose={onClose}>
          {wayBack({ at: 'hooks', packId: adventure.packId }, adventure.name)}
          <p className="calls__line">That table of rumours isn't in its adventure any more.</p>
        </Dialog>
      );
    }
    if (view.at === 'rumours') {
      // Shown whole, by pack and table (two adventures may have tables with the same id).
      const wholeKey = `${table.packId}/${table.id}`;
      const shownAll = whole.has(wholeKey) || table.rows.length <= RUMOURS_SHOWN;
      const rows = shownAll ? table.rows : table.rows.slice(0, RUMOURS_SHOWN);
      const more = table.rows.length - rows.length;
      return (
        <Dialog label="Rumours" onClose={onClose}>
          {wayBack({ at: 'hooks', packId: adventure.packId }, adventure.name)}
          <div className="rumour-table">
              <BookTapHead
                title={table.name}
                die={table.die ?? ''}
                column="Rumour"
                aside={
                  <>
                    <Icon name="eye-off" size={16} />
                    Truth
                  </>
                }
              />
              <div className="table-sheet__rows" role="group" aria-label={table.name}>
                {rows.map((row) => {
                  const heard = givesOf(calls.gives, table, row).map((g) => heardLine(g, hearers ?? [], dayOf));
                  const key = rumourKey(table.id, row);
                  const range = row.range.replace('–', ' to ');
                  return (
                    <button
                      key={key}
                      type="button"
                      className="rumour-row"
                      aria-current={marked === key ? 'true' : undefined}
                      aria-label={[`${range}: ${row.words}`, row.truth ? `Truth: ${row.truth}` : '', ...heard].filter(Boolean).join('. ')}
                      onClick={() => setView({ at: 'rumour', packId: adventure.packId, tableId: table.id, min: row.min, max: row.max })}
                    >
                      <span className="rumour-row__range">{row.range}</span>
                      <span className="rumour-row__body">
                        <span className="rumour-row__words">{row.words}</span>
                        {heard.map((line) => (
                          <span key={line} className="rumour-row__heard">
                            {line}
                          </span>
                        ))}
                      </span>
                      <span className="rumour-row__truth">{row.truth ?? ''}</span>
                    </button>
                  );
                })}
              </div>
          </div>
          {more > 0 && (
            <p className="calls__line rumour-table__more">
              {`${more} more ${more === 1 ? 'row' : 'rows'}. `}
              <button type="button" className="button-quiet" onClick={() => setWhole(new Set([...whole, wholeKey]))}>
                {`Show all ${table.rows.length}`}
              </button>
            </p>
          )}
        </Dialog>
      );
    }
    const row = table.rows.find((r) => r.min === view.min && r.max === view.max);
    if (!row) {
      return (
        <Dialog label="Who hears it?" onClose={onClose}>
          {wayBack({ at: 'rumours', packId: adventure.packId, tableId: table.id }, table.name)}
          <p className="calls__line">That rumour isn't in its table any more.</p>
        </Dialog>
      );
    }
    const kicker = `${table.name}: ${row.range}`;
    const rowView = { packId: adventure.packId, tableId: table.id, min: row.min, max: row.max };
    if (view.at === 'rumourWho') return whoStep(kicker, (actorId) => void give(table, row, actorId), { at: 'rumour', ...rowView });
    // Frame 6: the rumour's words, Character or Party, and its truth's mark, which stays behind.
    return (
      <Dialog label="Who hears it?" onClose={onClose}>
        {wayBack({ at: 'rumours', packId: adventure.packId, tableId: table.id }, table.name)}
        <p className="rumour-words">{`“${row.words}”`}</p>
        <div className="calls__answers">
          <button type="button" className="button-secondary calls__answer" onClick={() => setView({ at: 'rumourWho', ...rowView })}>
            <Icon name="crown" size={28} />
            <span>Character</span>
          </button>
          <button type="button" className="button-secondary calls__answer" onClick={() => void give(table, row, null)}>
            <Icon name="players" size={28} />
            <span>Party</span>
          </button>
        </div>
        {row.truth && (
          <p className="rumour-truth">
            <Icon name="eye-off" size={16} />
            <span className="visually-hidden">Truth, the GM's alone: </span>
            {row.truth}
          </p>
        )}
      </Dialog>
    );
  }

  const hook = hookOf(view.packId, view.hookId);
  if (!hook) {
    return (
      <Dialog label={adventure.name} onClose={onClose}>
        <p className="calls__line">That call to adventure isn't in its adventure any more.</p>
        {back({ at: 'hooks', packId: adventure.packId })}
      </Dialog>
    );
  }
  const words = wordsFor(adventure.packId, hook);

  // Frame 4: Edit before sending.
  if (view.at === 'edit') {
    return <EditWords key={words.key} hook={hook} words={words} onUse={(next) => { setEdited(next); setView({ at: 'hook', packId: adventure.packId, hookId: hook.id }); }} onCancel={() => setView({ at: 'hook', packId: adventure.packId, hookId: hook.id })} onClose={onClose} />;
  }

  // Which character (SC-1, approved by Francis 2026-11-13 from the as-built pictures, with the lead's changes).
  if (view.at === 'who') return whoStep(hook.name, (actorId) => void send(adventure.packId, hook, actorId), { at: 'hook', packId: adventure.packId, hookId: hook.id });

  // Frame 3: one hook.
  const quill = (
    <button type="button" className="close-button calls__quill" aria-label="Edit before sending" onClick={() => setView({ at: 'edit', packId: adventure.packId, hookId: hook.id })}>
      <Icon name="edit" size={22} />
    </button>
  );
  const giver = hook.giver ? [hook.giver.role ? `${hook.giver.name}, ${hook.giver.role}` : hook.giver.name, hook.giver.place ? `at ${hook.giver.place}` : ''].filter(Boolean).join(', ') : '';
  return (
    <Dialog label={hook.name} onClose={onClose} headAction={quill}>
      <p className="calls__kicker">{`Calls to adventure. ${adventure.name}`}</p>
      <div className="calls__book">
        {paragraphs(words.body).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {(words.pays || giver) && (
        <dl className="calls__facts">
          {words.pays && (
            <div>
              <dt>Pays</dt>
              <dd>{words.pays}</dd>
            </div>
          )}
          {giver && (
            <div>
              <dt>Given by</dt>
              <dd>{`${giver}.`}</dd>
            </div>
          )}
        </dl>
      )}
      <SourceLine>{`From your adventure: ${adventure.name}.`}</SourceLine>
      <h3 className="calls__question">Who hears it?</h3>
      <div className="calls__answers">
        <button type="button" className="button-secondary calls__answer" onClick={() => setView({ at: 'who', packId: adventure.packId, hookId: hook.id })}>
          <Icon name="crown" size={28} />
          <span>Character</span>
        </button>
        <button type="button" className="button-secondary calls__answer" onClick={() => void send(adventure.packId, hook, null)}>
          <Icon name="players" size={28} />
          <span>Party</span>
        </button>
      </div>
      {back({ at: 'hooks', packId: adventure.packId })}
    </Dialog>
  );
}

/** A hook's words as the book's paragraphs: a blank line or a line break starts a new one. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Frame 4: the words and what it pays, as plain fields starting from the book's; this send only. */
function EditWords({ hook, words, onUse, onCancel, onClose }: { hook: StoredHook; words: Words; onUse: (next: Words) => void; onCancel: () => void; onClose: () => void }) {
  const [body, setBody] = useState(words.body);
  const [pays, setPays] = useState(words.pays);
  const show = useToast();
  return (
    <Dialog label="Edit before sending" onClose={onClose}>
      <p className="calls__kicker">{hook.name}</p>
      <textarea className="calls__field calls__words" aria-label="The words to send" rows={6} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
      <label className="calls__pays">
        <span>Pays</span>
        <input className="calls__field" type="text" maxLength={500} value={pays} onChange={(e) => setPays(e.target.value)} />
      </label>
      <div>
        <button
          type="button"
          className="button-secondary button-secondary--small"
          onClick={() => {
            setBody(hook.text);
            setPays(hook.pays);
          }}
        >
          Back to the book's words
        </button>
      </div>
      <div className="calls__foot">
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            if (!body.trim()) return show({ text: 'Write the words to send.', error: true });
            onUse({ key: words.key, body: body.trim(), pays: pays.trim() });
          }}
        >
          Use these words
        </button>
      </div>
    </Dialog>
  );
}
