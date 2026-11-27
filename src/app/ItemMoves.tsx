// Give, Move to and Drop on an item (B19, B24, ruled 2026-10-25; "Put it" became Wear / Hold and Move to,
// ruled 2026-10-26, so wearing is its own button on the item): one sheet each, with the shared how-many prompt
// (a stepper starting at the whole stack, plus "All N"; single items skip it) and the shared destination list
// (grouped, room left per row, blocked rows explain on tap). The main button names the result ("Give 3 to Ilsa",
// "Put in Backpack", "Drop 3"). The screen runs the change and shows the toast.
import { useId, useState } from 'react';
import type { EncumbranceMode } from '../core/campaignSettings.ts';
import type { InventoryLine, NamedCarrier } from '../modules/inventory/inventory.ts';
import { countWords, isContainer, roomLeft, stackable } from '../modules/inventory/packView.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { ActionBar, DestinationList, HowMany, type Destination } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { rememberPlace, startingPlace } from './lastPlace.ts';
import { withTheStart } from '../core/nameWords.ts';

/** Where the item goes. */
export type Placement =
  | { kind: 'give'; to: NamedCarrier }
  | { kind: 'away'; to: string }
  | { kind: 'equip' }
  | { kind: 'carried' }
  | { kind: 'container'; containerId: string; name: string };

const OTHER = '__other__';
const CARRIED = '__carried__';

export function MoveSheet({
  action,
  line,
  lines,
  recipients,
  mode,
  busy,
  onClose,
  onConfirm,
}: {
  action: 'give' | 'put' | 'drop';
  line: InventoryLine;
  /** Everything on this carrier (for containers and room left). */
  lines: InventoryLine[];
  /** Who it can go to: the Party stash first, then the other characters. */
  recipients: NamedCarrier[];
  mode: EncumbranceMode;
  busy: boolean;
  onClose: () => void;
  onConfirm: (qty: number, place: Placement | null) => void;
}) {
  const id = useId();
  const [qty, setQty] = useState(line.qty);
  // Why something can't be chosen: a message, so a toast (A11), never a box in the sheet.
  const toast = useToast();
  const setWhy = (text: string) => toast({ text });
  const [otherName, setOtherName] = useState('');
  const many = stackable(line) && line.qty > 1;

  const destinations: Destination[] =
    action === 'give'
      ? [
          ...recipients.map((r) => ({
            id: (r.actorId ?? r.locationId)!,
            name: r.name,
            group: (r.locationId ? 'Party' : 'People') as Destination['group'],
            room: r.locationId ? 'No limit' : undefined,
          })),
          { id: OTHER, name: 'Someone outside the party…', group: 'People' as const },
        ]
      : action === 'put'
        ? [
            ...(line.equipped || line.containerLineId ? [{ id: CARRIED, name: 'Carried', group: 'Containers' as const }] : []),
            ...lines
              .filter((l) => isContainer(l) && l.id !== line.id && l.id !== line.containerLineId)
              .map((c) => {
                const room = roomLeft(c, lines, mode);
                return {
                  id: c.id,
                  name: c.name,
                  group: 'Containers' as const,
                  room: room ? `${room.left} of ${room.of} left` : undefined,
                  blocked: room && room.left === 0 ? 'Full' : undefined,
                };
              }),
          ]
        : [];
  // It starts on the last place used for this kind of item, else the first with room (B19); "someone outside the
  // party" is never remembered.
  const [picked, setPicked] = useState<string | null>(() =>
    action === 'drop' ? null : startingPlace(action, line.category, destinations.filter((d) => d.id !== OTHER)),
  );
  const chosen = destinations.find((d) => d.id === picked) ?? null;

  const words = many ? (qty === line.qty ? `all ${countWords(line, qty)}` : countWords(line, qty)) : line.name;
  const verb =
    action === 'drop'
      ? many
        ? `Drop ${qty}`
        : 'Drop'
      : action === 'give'
        ? chosen?.id === OTHER
          ? many
            ? `Give ${qty} away`
            : 'Give it away'
          : `Give${many ? ` ${qty}` : ''} to ${chosen?.name ?? '…'}`
        : chosen?.id === CARRIED
            ? 'Carry it'
            : `Put in ${chosen?.name ?? '…'}`;

  function confirm() {
    if (action === 'drop') return onConfirm(qty, null);
    if (!chosen) return setWhy('Choose where it goes.');
    if (chosen.blocked) return setWhy(chosen.blocked === 'Full' ? `${withTheStart(chosen.name)} is full.` : chosen.blocked);
    if (chosen.id !== OTHER) rememberPlace(action, line.category, chosen.id);
    if (chosen.id === OTHER) {
      if (!otherName.trim()) return setWhy('Say who or what gets it.');
      return onConfirm(qty, { kind: 'away', to: otherName.trim() });
    }
    if (action === 'give') {
      const to = recipients.find((r) => (r.actorId ?? r.locationId) === chosen.id);
      return to ? onConfirm(qty, { kind: 'give', to }) : setWhy('Choose who gets it.');
    }
    if (chosen.id === CARRIED) return onConfirm(qty, { kind: 'carried' });
    return onConfirm(qty, { kind: 'container', containerId: chosen.id, name: chosen.name });
  }

  const main = (
    <button type="button" className="button-primary" aria-busy={busy} onClick={confirm}>
      {verb}
    </button>
  );
  const title = action === 'drop' ? `Drop ${line.name}` : action === 'give' ? `Give ${line.name}` : `Move ${line.name}`;
  return (
    <Dialog label={title} onClose={onClose}>
      <div className="top-action">{main}</div>
      {many && (
        <div role="group" aria-label="How many">
          <span className="label">How many</span>
          <HowMany of={line.qty} value={qty} onChange={setQty} />
          <p className="auth__meta">{words}</p>
        </div>
      )}
      {action !== 'drop' && <DestinationList label={action === 'give' ? 'Give to' : 'Move to'} destinations={destinations} selected={picked} onSelect={setPicked} onBlocked={setWhy} />}
      {chosen?.id === OTHER && (
        <label className="field" htmlFor={`${id}-other`}>
          <span className="label">Who or what gets it</span>
          <input id={`${id}-other`} className="field__input" maxLength={100} value={otherName} onChange={(event) => setOtherName(event.target.value)} />
        </label>
      )}
      <div className="bottom-action">
        <ActionBar>{main}</ActionBar>
      </div>
      <button type="button" className="button-secondary button-secondary--small" onClick={onClose}>
        Not now
      </button>
    </Dialog>
  );
}
