// The creation review (M5b step 0c, slice 7; cr-18, cw-11; mockups creation/09 and creation/12), on the creation step
// shell: "Step N of N · Review", Leave, Back; one read-only card per step walked, each with a small Change button back
// to its step (the step's Next, or its Back with nothing changed, comes back here); gear as lines, magic by source,
// the starting coin in words; Derived values, folded; the To finish box with Do it now; Send to the GM (the
// one accent), which re-runs every step's check and lands on the first failing step with its message (cr-2); Save and
// leave (quiet, here only). It reads the draft as saved, so it is the same whether the walk just ended or the draft
// was reopened from Your characters. What the cards say and the checks come from CreateCharacter (`build`).
import { useEffect, useState } from 'react';
import type { EncumbranceMode } from '../core/campaignSettings.ts';
import type { CurrentUser } from '../core/commands.ts';
import { loadMyCharacters, type MyCharacter } from '../core/myCharacters.ts';
import type { Db } from '../core/supabase.ts';
import { loadInventory, loadInventorySettings, type InventoryLine } from '../modules/inventory/inventory.ts';
import { CreationLoading, CreationStep, EntryPanel, ReviewSections, type ReviewPart, type ReviewValue } from '../ui/creation.tsx';
import { WarningLine } from '../ui/parts.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { loadEquipContext, type EquipContext } from './EquipWarning.tsx';
import { Breakdown } from '../ui/parts.tsx';
import { ToFinishCard } from '../ui/organisms.tsx';
import { useToast } from '../ui/ToastHost.tsx';

/** The draft as saved, with what it carries and the campaign's load mode. */
export interface ReviewData {
  character: MyCharacter;
  lines: InventoryLine[];
  mode: EncumbranceMode;
  /** The equip checks' context (a kit's thing the class can't wear says so, cw-11); null when it can't be read. */
  equip: EquipContext | null;
}

export interface ReviewBuilt {
  parts: ReviewPart[];
  /** The To finish box: every step put off with Decide later. */
  toFinish: { id: string; name: string }[];
  /** The first step whose check fails (Send lands there), or null. */
  problem: { step: string; message: string } | null;
}

/** A send that didn't go (proposal mockup creation/13): offline, or any other failure; the draft is kept either way. */
export const SEND_OFFLINE = "You're offline. Nothing is saved until you're back: keep this screen open, then try again.";
export const SEND_FAILED = "Couldn't send it to your GM. Nothing is lost.";

export function CreationReview({
  db,
  user,
  campaignId,
  characterId,
  version,
  counter,
  build,
  onOpen,
  onBack,
  onSend,
  onLeave,
  sendLabel,
  sendHint,
  onStartOver,
}: {
  db: Db;
  user: CurrentUser;
  campaignId: string;
  characterId: string;
  /** Bumped when a step changed the draft: the review reads it again. */
  version: number;
  counter?: { at: number; of: number };
  build: (data: ReviewData) => ReviewBuilt;
  /** Change, Do it now, and Send landing on a failing step. */
  onOpen: (step: string, data: ReviewData) => void;
  onBack: (data: ReviewData) => void;
  /** Sends the draft; false when it didn't go (the review stays). */
  onSend: (data: ReviewData) => Promise<boolean>;
  onLeave: () => void;
  sendLabel: string;
  sendHint: string;
  /** Start over (final drafts D): deletes the draft and opens creation again; false when it couldn't (said by the caller). */
  onStartOver?: (data: ReviewData) => Promise<boolean>;
}) {
  const [data, setData] = useState<ReviewData | null | 'error'>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  // The last send didn't go: the foot says so with ▲ until the next try (Send to the GM is the Try again), and a sheet
  // says what happened and the two ways out (final drafts F).
  const [failed, setFailed] = useState<string | null>(null);
  const [failedSheet, setFailedSheet] = useState(false);
  // A pack-list value tapped (ct3-11): its entry, to read.
  const [entry, setEntry] = useState<NonNullable<ReviewValue['entry']> | null>(null);
  // A derived field tapped (bq-2): its breakdown, the full sheet's words.
  const [breakdown, setBreakdown] = useState<NonNullable<ReviewValue['breakdown']> | null>(null);
  const toast = useToast();
  // Start over asks once, in a sheet (final drafts D): the one confirm in creation.
  const [askingStartOver, setAskingStartOver] = useState(false);
  useEffect(() => {
    let current = true;
    void Promise.all([loadMyCharacters(db, campaignId, user.id), loadInventory(db, campaignId), loadInventorySettings(db, campaignId), loadEquipContext(db, user.id, campaignId, characterId).catch(() => null)]).then(
      ([mine, inventory, settings, equip]) => {
        if (!current) return;
        const character = mine?.find((c) => c.id === characterId);
        setData(character ? { character, lines: (inventory?.lines ?? []).filter((l) => l.actorId === characterId), mode: settings?.mode ?? 'none', equip } : 'error');
      },
      () => current && setData('error'),
    );
    return () => {
      current = false;
    };
  }, [db, campaignId, user.id, characterId, version, retry]);

  if (data === 'error') {
    return (
      <section className="auth">
        <p className="form-error" role="alert">
          Couldn't open the review. Your character is saved: find them in Your characters.
        </p>
        <button type="button" className="button-secondary" onClick={() => setRetry((n) => n + 1)}>
          Try again
        </button>
      </section>
    );
  }
  if (!data) return <CreationLoading line="Opening the review…" />;

  const built = build(data);
  async function send() {
    if (busy || !data || data === 'error') return;
    // Every step's check again (cr-2): the first failing one opens, with what its Next would say.
    if (built.problem) {
      toast({ text: built.problem.message });
      onOpen(built.problem.step, data);
      return;
    }
    setBusy(true);
    setFailed(null);
    const sent = await onSend(data);
    if (!sent) {
      setBusy(false);
      setFailed(typeof navigator !== 'undefined' && navigator.onLine === false ? SEND_OFFLINE : SEND_FAILED);
      setFailedSheet(true);
    }
  }
  // The foot (proposal mockup creation/13): a failed send, else the first unmet check with its card's name ("▲
  // Languages: Pick 1 more."), else what Send does. Send stays tappable and lands on the failing step (cr-2).
  const problemCard = built.problem ? built.parts.find((p) => p.id === built.problem!.step || p.id === `trait:${built.problem!.step}`)?.title : undefined;
  const stopLine = failed ?? (built.problem ? (problemCard ? `${problemCard}: ${built.problem.message}` : built.problem.message) : null);
  const n = built.toFinish.length;
  return (
    <CreationStep
      title={data.character.name}
      counter={counter ? { ...counter, note: 'Review' } : undefined}
      // No instruction line (22-G1, ruled): the cards and Change say it.
      why=""
      help={null}
      onBack={() => onBack(data)}
      // One exit button (follow-up E, nit 4): the top's Save and leave, with the review's "saved" toast.
      onLeave={onLeave}
      hint={stopLine ?? sendHint}
      stop={!!stopLine}
      nextLabel={sendLabel}
      onNext={() => void send()}
      busy={busy}
      waitsOnline
      footQuiet={
        <>
          {/* Only a draft never sent can start over: it is deleted, not kept. Start over first, then Save and leave (cs-36). */}
          {onStartOver && data.character.approval === 'draft' && (
            <button type="button" className="button-secondary" onClick={() => setAskingStartOver(true)}>
              Start over
            </button>
          )}
          <button type="button" className="button-secondary" onClick={onLeave}>
            Save and leave
          </button>
        </>
      }
    >
      {failedSheet && (
        <Dialog label="Not sent" onClose={() => setFailedSheet(false)}>
          <p className="reading">
            <WarningLine>Your GM didn’t get it</WarningLine>
          </p>
          <p className="reading">The connection dropped while sending. Everything you chose is still here. Try again when you’re back online, or save and leave and send later from your sheet.</p>
          <div className="dialog__actions">
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                setFailedSheet(false);
                void send();
              }}
            >
              Try again
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setFailedSheet(false);
                onLeave();
              }}
            >
              Save and leave
            </button>
          </div>
        </Dialog>
      )}
      {askingStartOver && onStartOver && (
        <Dialog label="Start over?" onClose={() => setAskingStartOver(false)} noClose>
          <p className="reading">{`Everything you chose for ${data.character.name} goes, and creation begins again at step 1. Nothing has been sent to your GM yet.`}</p>
          {/* Both plain, Start over outermost (cs-26): an act that destroys a draft does not take the accent. */}
          <div className="dialog__actions">
            <button type="button" className="button-secondary" onClick={() => setAskingStartOver(false)}>
              Keep going
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setAskingStartOver(false);
                void onStartOver(data);
              }}
            >
              Start over
            </button>
          </div>
        </Dialog>
      )}
      <ReviewSections parts={built.parts} onEntry={setEntry} onBreakdown={setBreakdown} />
      {breakdown && (
        <Dialog label={breakdown.title} onClose={() => setBreakdown(null)}>
          <Breakdown lines={breakdown.lines} />
          <div className="dialog__actions">
            <button type="button" className="button-primary" onClick={() => setBreakdown(null)}>
              Got it
            </button>
          </div>
        </Dialog>
      )}
      {entry && <EntryPanel name={entry.name} meta={entry.meta} lead={entry.lead} description={entry.description} headings={entry.headings} onClose={() => setEntry(null)} backLabel="Got it" asSheet />}
      <ToFinishCard title={`To finish: ${n}. You can do ${n === 1 ? 'it' : 'these'} later, from your sheet`} action="Do it now" steps={built.toFinish} onOpen={(id) => onOpen(id, data)} />
    </CreationStep>
  );
}
