// The class form switch on the sheet's Combat section (07 `classes[].forms`; eq-8, ruled 2026-11-04,
// docs/design/rulings/m5b-pack-review-area-3-2026-11-04.md): one chip per form, the current one pressed. A tap
// switches at once (logged, with Undo); gear the new form can't use comes off in the same change, carried, and the
// toast says what and why. Undo switches back and puts the same gear on again, in one change. Someone who may not
// switch (another player) still taps and is told why: never a greyed button.
import { useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { setForm } from '../modules/characters/playState.ts';
import { currentForm, equipBlocks, formsOf, type ClassForm } from '../modules/inventory/equipWarnings.ts';
import { loadInventory } from '../modules/inventory/inventory.ts';
import type { Value } from '../modules/library/expression.ts';
import { Chip } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { asItem, loadEquipContext } from './EquipWarning.tsx';
import { registry } from './services.ts';

/** What the switch to a form takes off: each worn or held line the form can't use, with the reason. */
export async function gearOffIn(db: Db, user: CurrentUser, character: { id: string; campaignId: string }, formId: string): Promise<{ id: string; name: string; version: number; why: string }[]> {
  const [context, inventory] = await Promise.all([loadEquipContext(db, user.id, character.campaignId, character.id), loadInventory(db, character.campaignId)]);
  if (!context || !inventory) return [];
  const inForm = { ...(context.character as Record<string, Value>), formId };
  return inventory.lines
    .filter((l) => l.actorId === character.id && l.equipped)
    .flatMap((l) => {
      const why = equipBlocks(inForm, asItem(l, context), context.weaponRules ?? null)[0];
      return why ? [{ id: l.id, name: l.name, version: l.version, why }] : [];
    });
}

const listWords = (words: string[]) => (words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)!}`);

export function FormSwitch({
  db,
  user,
  character,
  klass,
  formId,
  canSwitch,
  onSwitched,
}: {
  db: Db;
  user: CurrentUser;
  character: { id: string; campaignId: string; ownerUserId: string | null; name: string };
  /** The class entry as the setting gives it; without forms the switch shows nothing. */
  klass: Value;
  /** The form kept with the character; null reads as the first form. */
  formId: string | null;
  /** Whether this person may switch (the owner or the GM, the character not archived). */
  canSwitch: boolean;
  /** After a switch or its Undo: the sheet and the Pack reload. */
  onSwitched: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const forms = formsOf(klass);
  const current = currentForm(klass, formId);
  if (forms.length === 0 || !current) return null;

  async function switchTo(form: ClassForm) {
    if (form.id === current!.id) {
      toast({ text: `${character.name} is already in ${form.name}.` });
      return;
    }
    if (!canSwitch) {
      toast({ text: `Only ${character.name}'s player or the GM can switch the form.`, error: true });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const off = await gearOffIn(db, user, character, form.id);
      const result = await runCommand(registry, db, user, setForm, { character, form: { id: form.id, name: form.name }, takeOff: off.map((l) => ({ id: l.id, version: l.version })) });
      if (!result.ok) {
        toast({ text: result.message, error: true });
        return;
      }
      onSwitched();
      const cameOff = off.length === 0 ? '' : ` ${listWords(off.map((l) => l.name))} came off and ${off.length === 1 ? 'is' : 'are'} carried: ${off[0]!.why}`;
      // Undo is the switch back, putting the same gear on again in the same change (the log's Undo can't revert a
      // play-state row the switch made; this reads the same either way).
      const before = formId ? { id: current!.id, name: current!.name } : null;
      toast({
        text: `${character.name} is now in ${form.name}.${cameOff}`,
        onUndo: () =>
          void (async () => {
            const undone = await runCommand(registry, db, user, setForm, { character, form: before, putOn: off.map((l) => ({ id: l.id })) });
            if (!undone.ok) toast({ text: undone.message, error: true });
            else onSwitched();
          })(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet__forms" role="group" aria-label="Form">
      <span className="sheet__forms-label">Form</span>
      <div className="sheet__forms-chips">
        {forms.map((form) => (
          <Chip key={form.id} pressed={form.id === current.id} onClick={() => void switchTo(form)}>
            {form.id === current.id ? `${form.name} ✓` : form.name}
          </Chip>
        ))}
      </div>
      {current.note && <p className="sheet__forms-note">{current.note}</p>}
    </div>
  );
}
