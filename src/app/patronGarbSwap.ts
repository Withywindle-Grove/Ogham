// The patron's garb follows a patron changed before Create (pt-6, pt-11; Francis's report, 2026-11-12): Change patron
// on the review takes the old patron's free garb out of the pack and puts the new one's in, without the Gear step open.
// The same rules as the Gear step's (StartingGear.tsx, "The patron's garb goes into the pack once per patron"): only
// the garb the record says was given comes out, never more of a line than was put in (what the player bought or took
// from a kit is never touched); the new garb goes in as No cost, where Add item would put it; the record keeps whose
// garb it is and its lines (`patronGarb`), so the Gear step, opened later, gives nothing twice.
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { loadCreationRecord } from '../core/characterSheet.ts';
import type { Db } from '../core/supabase.ts';
import { editCharacter, type CharacterRef } from '../modules/characters/commands.ts';
import { raceAsPlayed } from '../modules/characters/creation.ts';
import type { FieldDefinition } from '../modules/characters/fields.ts';
import { placeKit } from '../modules/characters/kitPlaces.ts';
import { gearContextOf, piecesName, piecesOf, startingEquipment } from '../modules/characters/startingGear.ts';
import { addItem, loadInventory, removeItem, type CarrierRef, type InventoryLine } from '../modules/inventory/inventory.ts';
import { entriesInPlay } from '../modules/library/optionGate.ts';
import { bundleOf, copyOf } from './AddItem.tsx';
import type { CampaignSetting } from './campaignSetting.ts';
import { equipCheckWith, loadEquipContext } from './EquipWarning.tsx';
import { patronGarbFor, patronGarbGiven } from './patronGarb.ts';
import { registry } from './services.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A swap that didn't finish (gs-5, gs-5a): said first, then the patron's line, in one error toast. */
export const GARB_SWAP_FAILED = "Couldn't swap your patron's garb. Check your connection and try again.";

/**
 * After a patron change on a saved draft: the old patron's garb out, the new one's in, the record saved. Nothing is
 * done where this character has no Gear step (nothing ever gives the garb there), while the patron's option is off
 * (pt-9: garb held stays), or when the garb in the pack is already this patron's; so calling it again after a failure
 * finishes the swap (gs-5: "try again"). Returns the record as saved now (null when nothing changed); a failure
 * returns it too, so a walk on from here (Gear) starts from what is really saved (#727 review, Important 1).
 */
export async function swapPatronGarb(
  db: Db,
  user: CurrentUser,
  setting: CampaignSetting,
  character: CharacterRef,
  who: { level: number; classRef: string; raceRef: string | null },
  fieldDefs: readonly FieldDefinition[],
  gearStep: boolean,
): Promise<{ ok: true; creation: Record<string, unknown> | null } | { ok: false; creation: Record<string, unknown> | null }> {
  // gs-1: whether the Gear step has opened can't be read from the record (it saves `givenGear` only where the setting
  // gives gear). Giving the garb before it opens is harmless: it finds the garb given (`patronGarb`) and gives nothing
  // twice. Only a character with no Gear step at all must get none.
  if (!gearStep) return { ok: true, creation: null };
  const saved = await loadCreationRecord(db, character.id);
  if (!saved) return { ok: false, creation: null };
  let record: Record<string, unknown> = isRecord(saved.creation) ? saved.creation : {};
  const failed = () => ({ ok: false as const, creation: record });
  const had = patronGarbGiven(record);
  const garb = patronGarbFor(setting, record, who, fieldDefs);
  if (garb?.kept) return { ok: true, creation: null };
  const garbKey = garb?.id ?? '';
  if (had ? had.patron === garbKey : !garbKey) return { ok: true, creation: null };

  const carrier: CarrierRef = { campaignId: character.campaignId, actorId: character.id, locationId: null, ownerUserId: character.ownerUserId, archived: false };
  /** Takes lines back out (as many as were put in, never more than each holds now); false if one couldn't go. */
  async function takeOut(given: readonly { id: string; qty: number }[]): Promise<boolean> {
    const inventory = await loadInventory(db, character.campaignId);
    if (!inventory) return false;
    for (const line of given) {
      const now = inventory.lines.find((l) => l.id === line.id);
      // Already gone (dropped from the pack): nothing to take out.
      if (!now) continue;
      const removed = await runCommand(registry, db, user, removeItem, { line: { id: line.id, carrier, version: now.version }, qty: Math.min(line.qty, now.qty), of: now.qty });
      if (!removed.ok) return false;
    }
    return true;
  }
  // The old patron's garb out: as many as were given, never more than the line holds now (the Gear step's rule).
  // The record is written first, without them (the lead's ruling for #727): a failure from here on can only leave
  // garb in the pack that no record lists (a free extra), never have a later try take the player's own.
  if (had) {
    const base: Record<string, unknown> = { ...record };
    delete base.patronGarb;
    const cleared = await runCommand(registry, db, user, editCharacter, { character, changes: { creation: base } });
    if (!cleared.ok) return failed();
    record = base;
    if (!(await takeOut(had.lines))) return failed();
  }

  // The new patron's garb in, placed as the Gear step places it (worn where it can be, else carried).
  const lines: { id: string; qty: number }[] = [];
  const items: string[] = [];
  if (garb && garb.itemIds.length > 0) {
    const [context, inventory] = await Promise.all([loadEquipContext(db, user.id, character.campaignId, character.id), loadInventory(db, character.campaignId)]);
    if (!inventory) return failed();
    const mine = inventory.lines.filter((l) => l.actorId === character.id);
    const item = (itemId: string) => entriesInPlay(setting.items).find((e) => e.packEntryId === itemId);
    const raceEntry = who.raceRef ? (setting.all.find((e) => e.kind === 'race' && e.packEntryId === who.raceRef) ?? null) : null;
    const classEntry = setting.all.find((e) => e.kind === 'class' && e.packEntryId === who.classRef) ?? null;
    const ctx = gearContextOf(raceAsPlayed(raceEntry, classEntry)?.data, (id) => item(id)?.name, who.classRef, (id) => {
      const found = item(id);
      return found ? (piecesName(found.data) ?? undefined) : undefined;
    });
    const entries = startingEquipment([{ startingEquipment: garb.itemIds }], ctx).flatMap((l) => {
      const found = l.itemId ? item(l.itemId) : undefined;
      return found ? [{ entry: found, line: l }] : [];
    });
    const pieces = entries.map(({ entry, line }) => ({ item: entry, name: entry.name, qty: piecesOf({ itemId: entry.packEntryId, qty: line.qty, ...(line.units !== undefined ? { units: line.units } : {}) }, bundleOf(entry)), data: entry.data }));
    const asLine = (piece: (typeof pieces)[number], n: number) => ({ id: `garb-${n}`, name: piece.name, details: piece.data, sourceEntryId: piece.item.packEntryId, equipped: true }) as unknown as InventoryLine;
    const hands = mine.filter((l) => l.equipped && (l.details.slot === 'hand' || l.details.slot === 'shield')).reduce((n, l) => n + (l.details.hands === 2 ? 2 : 1), 0);
    const placed = placeKit(
      pieces,
      (piece, on) => {
        const check = equipCheckWith(context, asLine(piece, -1), [...mine, ...on.map(asLine)]);
        return check.blocked.length > 0 || check.warnings.length > 0 || check.stopsCasting ? 'warned' : null;
      },
      { armour: mine.some((l) => l.equipped && l.details.slot === 'armour'), hands, container: false },
    );
    for (const piece of placed) {
      const put = await runCommand(registry, db, user, addItem, { carrier, item: copyOf(piece.item), qty: piece.qty, howGot: 'found', containerLineId: null, equipped: piece.place === 'worn' || piece.place === 'hand' });
      if (!put.ok) {
        // The record (saved above) lists no garb: what did go in comes back out, and the next try gives it whole.
        await takeOut(lines);
        return failed();
      }
      lines.push({ id: put.value.id, qty: piece.qty });
      if (!items.includes(piece.item.packEntryId)) items.push(piece.item.packEntryId);
    }
  }

  const next: Record<string, unknown> = { ...record };
  delete next.patronGarb;
  if (garbKey) next.patronGarb = { patron: garbKey, lines, items };
  const written = await runCommand(registry, db, user, editCharacter, { character, changes: { creation: next } });
  if (!written.ok) {
    // Not saved: what was just put in comes back out, so a later try (or the Gear step) can never double the garb.
    await takeOut(lines);
    return failed();
  }
  return { ok: true, creation: next };
}

