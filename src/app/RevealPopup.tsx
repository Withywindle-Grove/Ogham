// The Reveal pop-up (K22d; ruling k22-4 to k22-8, picks 4 to 10, 14; page 33, frames K22d, K22e, K22f, K22i 3 and 4,
// K22j, approved 2026-11-21): what is still hidden on one item, one row per fact (hiddenFacts), the whole row a tap
// that tells that fact at once; a told row turns to "Told" and is no longer a button, the pop-up stays open, and the
// toast carries Undo (the log's Undo of the tell). "Tell them everything" is its one accent; with everything told the
// foot reads "Nothing is left hidden.". Opened from inside the item's sheet: its own form, the Sheet, centred on a tablet
// and from the foot on a phone (K22i), with the toast placed above it (ToastHost, `data-toast-above`).
// Charges hidden but never set (no count in the secret) can't be told yet (public.tell_item refuses): their row keeps the
// told row's plain look, "Not set yet", with no Tell (⚑ 3, approved from pictures 25 Nov), and stays a tap that opens the
// blocked-action pop-up saying where the count is rolled (Home Two's audit of #50, findings 4 and 5; Francis, 26 Nov);
// "Tell them everything" tells every other fact (review of #50).
import { useState } from 'react';
import { capitalised, gmChargeUnitOf, type ChargeUnit } from '../core/chargeUnit.ts';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { hiddenFacts, type HiddenFact } from '../modules/inventory/hiddenFacts.ts';
import { tellItem, type InventoryLine, type NamedCarrier } from '../modules/inventory/inventory.ts';
import { possessive, shownName, withThe } from '../modules/inventory/packView.ts';
import type { ResolvedEntry } from '../modules/library/stack.ts';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { CentredPopUpScope, Dialog, SheetScope } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { WarningSign } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import type { Run } from './packHelpers.ts';
import { registry } from './services.ts';
import './RevealPopup.css';

/** The facts still hidden on a line, as the GM's copy of its entry has them; charges with their count from the secret. */
export function factsOf(line: InventoryLine, entry: ResolvedEntry | null, secret: { total: number | null } | null): HiddenFact[] {
  const facts = hiddenFacts(
    { identified: line.identified !== false, revealedFields: line.revealedFields ?? [], details: line.details, chargesHidden: line.chargesHidden, category: line.category },
    entry?.data ?? null,
    entry?.name ?? '',
  );
  const total = secret?.total ?? null;
  return facts.map((f) => (f.id === 'charges' && total !== null ? { ...f, detail: `${Math.max(0, total - line.chargesUsed)} of ${total} left` } : f));
}

/** A hidden count never set: the one fact the pop-up lists but can't tell yet (public.tell_item: "Set its charges first"). */
export const countNotSet = (fact: HiddenFact, secret: { total: number | null } | null) => fact.id === 'charges' && (secret?.total ?? null) === null;

/** A count never set, tapped: the blocked-action pop-up's title and its why, with where the count is rolled (in its unit). */
export const notSetTitle = (unit: ChargeUnit) => `Set its ${unit.many} first`;
export const notSetWhy = (unit: ChargeUnit) => `Its count isn’t rolled yet. Roll it under ${capitalised(unit.many)} on this item, from your own Pack. Then tell them.`;

/** Who a tell tells, in the toast's words: the holder's name, or "the party" for the stash (K22f, 3). */
const whoOf = (carrier: NamedCarrier) => (carrier.locationId !== null ? 'the party' : carrier.name);

/** Where the item is, under the pop-up's title: "in Wren’s pack", or "in the Party stash". */
export const whereOf = (carrier: NamedCarrier) => (carrier.locationId !== null ? 'in the Party stash' : `in ${possessive(carrier.name)} pack`);

/**
 * The toast after a tell (pick 10; K22e, K22f): "Told Wren: the Bronze ring is cursed.", the true name's (pg30-5),
 * everything's. `gmCopy`: the GM's copy of the item's entry, whose unit the GM's toast says.
 */
export function toldWords(fact: HiddenFact | 'everything' | 'all but charges', line: Pick<InventoryLine, 'name'> & Partial<Pick<InventoryLine, 'details'>>, carrier: NamedCarrier, trueName: string, gmCopy?: Record<string, unknown> | null): string {
  const who = whoOf(carrier);
  // The count's unit, as the GM's copy names it, else the line's ("the rum bottle has 2 portions left"; G-233).
  const units = gmChargeUnitOf(gmCopy, line.details).many;
  const item = shownName(line.name);
  if (fact === 'everything') return `Told ${who} everything about ${withThe(trueName || item)}.`;
  if (fact === 'all but charges') return `Told ${who} everything about ${withThe(trueName || item)} but its ${units}.`;
  if (fact.id === 'name') {
    const whose = carrier.locationId !== null ? `The party’s ${item}` : `${possessive(carrier.name)} ${item}`;
    return `Shown to the players: ${fact.detail}. ${whose} now carries its name.`;
  }
  const the = withThe(item);
  const said =
    fact.id === 'magic'
      ? `${the} is magic`
      : fact.id === 'cursed'
        ? `${the} is cursed`
        : fact.id === 'bonus'
          ? /^[+−-]\d+$/.test(fact.detail)
            ? `${the} has a bonus of ${fact.detail}`
            : fact.detail
              ? `${the} gives ${fact.detail}`
              : `${the} has a bonus`
          : fact.id === 'charges'
            ? fact.detail
              ? `${the} has ${fact.detail.replace(/ left$/, '')} ${units} left`
              : `${possessive(the)} ${units}`
            : fact.id.startsWith('power:')
              ? `${the} has a power${fact.detail ? `: ${fact.detail}` : ''}`
              : `${possessive(the)} ${fact.label}${fact.detail ? `: ${fact.detail}` : ''}`;
  return `Told ${who}: ${said}.`;
}

export function RevealPopup({
  line,
  entry,
  secret,
  carrier,
  db,
  user,
  campaign,
  run,
  busy,
  onClose,
}: {
  line: InventoryLine;
  entry: ResolvedEntry | null;
  secret: { total: number | null } | null;
  carrier: NamedCarrier;
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  run: Run;
  busy: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const blocked = useBlockedSheet();
  const now = factsOf(line, entry, secret);
  // The list as it was opened (k22-5): a told row stays, as "Told"; opened again later, only what is still hidden.
  const [listed] = useState(now);
  // A failed tell: the database's words when it refused, '' when no answer came back ("Try again"); null: none.
  const [failed, setFailed] = useState<string | null>(null);
  const hiddenNow = new Set(now.map((f) => f.id));
  const left = listed.filter((f) => hiddenNow.has(f.id));
  const tellable = left.filter((f) => !countNotSet(f, secret));
  const waiting = left.length > tellable.length;
  const where = whereOf(carrier);
  // The GM's pop-up: the unit of the GM's copy, else the line's (piece C).
  const unit = gmChargeUnitOf(entry?.data, line.details);

  function tell(fact: HiddenFact | 'everything') {
    if (busy) return;
    // "Everything" with a count never set tells the rest, as one act, and leaves the count hidden.
    const skip = fact === 'everything' && waiting;
    const words = toldWords(skip ? 'all but charges' : fact, line, carrier, entry?.name ?? '', entry?.data);
    let toldOk = false;
    void run(async () => {
      const told = await runCommand(registry, db, user, tellItem, {
        line: { id: line.id, carrier, version: line.version },
        fact: fact !== 'everything' ? fact.id : skip ? tellable.map((f) => f.id) : 'everything',
      });
      toldOk = told.ok;
      setFailed(told.ok ? null : told.message);
      // A failed tell says so in the pop-up, above the foot (pick 14), not in a second toast; the Pack still reads again.
      return told.ok ? told : { ok: true as const, value: null };
    }).then((done) => {
      if (!done || !toldOk) return;
      toast({
        text: words,
        onUndo: () =>
          void run(async () => {
            const eventId = await latestChange(db, campaign.id, 'inventory.tell', user.id);
            if (!eventId) return { ok: false as const, message: 'There was nothing to undo.' };
            return runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id });
          }),
      });
    });
  }

  return (
    <SheetScope.Provider value>
      <CentredPopUpScope.Provider value>
        <Dialog label="Reveal" onClose={onClose}>
          <p className="auth__meta reveal-popup__where" data-toast-above>
            {shownName(line.name)}, {where}
          </p>
          {/* Focusable by itself (Home Two's audit of #50, finding 2): with everything told it holds no button, and a long
              list must still scroll from the keyboard (axe's scrollable-region-focusable). */}
          <ul className="reveal-popup__list" aria-label="What is hidden" tabIndex={0}>
            {listed.map((fact) => {
              const told = !hiddenNow.has(fact.id);
              const notYet = !told && countNotSet(fact, secret);
              const words = (
                <>
                  <span className="reveal-popup__eye" aria-hidden="true">
                    <Icon name={told ? 'eye' : 'eye-shut'} size={24} />
                  </span>
                  <span className="reveal-popup__fact">
                    <span className="reveal-popup__label">{fact.label}</span>
                    {(notYet || fact.detail) && <span className="reveal-popup__detail">{notYet ? 'Not set yet' : fact.detail}</span>}
                  </span>
                </>
              );
              return (
                <li key={fact.id}>
                  {told ? (
                    <div className="reveal-popup__row">
                      {words}
                      <span className="reveal-popup__told">
                        <Icon name="tick" size={18} /> Told
                      </span>
                    </div>
                  ) : notYet ? (
                    // Blocked, so it stays tappable and says why (CLAUDE.md), in the plain look approved (⚑ 3).
                    <button type="button" className="reveal-popup__row" aria-label={`${fact.label}: Not set yet`} onClick={() => blocked.explain(notSetTitle(unit), notSetWhy(unit))}>
                      {words}
                    </button>
                  ) : (
                    <button type="button" className="reveal-popup__row" aria-busy={busy} aria-label={`Tell ${fact.label}${fact.detail ? `: ${fact.detail}` : ''}`} onClick={() => tell(fact)}>
                      {words}
                      <span className="reveal-popup__tell" aria-hidden="true">
                        Tell
                      </span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {failed !== null && (
            <p className="pack__problem reveal-popup__error" role="alert">
              <WarningSign /> {failed || `Couldn’t tell ${whoOf(carrier)}. Try again.`}
            </p>
          )}
          {tellable.length > 0 ? (
            <div className="dialog__actions">
              <button type="button" className="button-primary" aria-busy={busy} onClick={() => tell('everything')}>
                Tell them everything
              </button>
            </div>
          ) : (
            <p className="auth__meta">{waiting ? `${notSetTitle(unit)}, then tell them.` : 'Nothing is left hidden.'}</p>
          )}
        </Dialog>
        {blocked.sheet}
      </CentredPopUpScope.Provider>
    </SheetScope.Provider>
  );
}
