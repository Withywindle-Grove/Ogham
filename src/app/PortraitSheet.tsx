// The avatar's tap on the Player screen (ruled 2026-11-08): the portrait sheet, with the same picker as the sheet's Edit
// (choose an image or take a photo, through the device's own chooser; remove), then one button that saves the choice.
// Only someone who may change the portrait gets the sheet; anyone else gets the blocked Sheet saying who may.
import { useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { forgetFileLinks } from '../core/files.ts';
import type { Db } from '../core/supabase.ts';
import type { CharacterRef } from '../modules/characters/commands.ts';
import { clearPortrait, setPortrait } from '../modules/characters/portraits.ts';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { Portrait, PortraitPicker, type PortraitChoice, type Size as PortraitSize } from './Portrait.tsx';
import { registry } from './services.ts';
import { whoMayChange } from './whoMayChange.ts';

/** Applies a portrait choice to a saved character. Returns a plain-words problem, or null when it worked. */
export async function applyPortrait(db: Db, user: CurrentUser, character: CharacterRef, choice: PortraitChoice): Promise<string | null> {
  if (choice === null) return null;
  const result =
    choice === 'remove'
      ? await runCommand(registry, db, user, clearPortrait, { character })
      : await runCommand(registry, db, user, setPortrait, { character, image: choice.blob });
  forgetFileLinks();
  return result.ok ? null : result.message;
}

/** The character's avatar as a button: it opens the portrait sheet, or says who may change the portrait. */
export function PortraitTap({
  db,
  user,
  character,
  onSaved,
  size = 'medium',
}: {
  db: Db;
  user: CurrentUser;
  character: CharacterRef & { name: string; portraitAssetId: string | null };
  onSaved?: (() => void) | undefined;
  /** The circle's size: 56 px, or the head's 64 px (dec-13 C2). */
  size?: PortraitSize;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<PortraitChoice>(null);
  const [saving, setSaving] = useState(false);
  const blocked = useBlockedSheet();
  const toast = useToast();
  const may = registry.can(user, setPortrait.name, character);
  const has = character.portraitAssetId !== null;

  function tap() {
    if (!may) return blocked.explain('Portrait', whoMayChange(user, character, `${character.name}'s portrait`));
    setChoice(null);
    setOpen(true);
  }

  async function save() {
    // The busy guard (as the quick portrait's, #561): a second tap while it saves waits, and says so.
    if (saving) return blocked.explain('Still saving', `${character.name}'s portrait is still saving. It closes when it's done.`);
    if (choice === null) return setOpen(false);
    setSaving(true);
    const problem = await applyPortrait(db, user, character, choice);
    setSaving(false);
    if (problem) return toast({ text: problem, error: true });
    setOpen(false);
    toast({ text: choice === 'remove' ? `${character.name}'s portrait was removed.` : `${character.name}'s portrait was saved.` });
    onSaved?.();
  }

  return (
    <>
      <button type="button" className="portrait-tap" aria-label={has ? `Change ${character.name}'s portrait` : `Add a portrait for ${character.name}`} onClick={tap}>
        <Portrait db={db} campaignId={character.campaignId} assetId={character.portraitAssetId} name={character.name} size={size} />
      </button>
      {blocked.sheet}
      {open && (
        <Dialog label="Portrait" onClose={() => setOpen(false)}>
          <PortraitPicker db={db} campaignId={character.campaignId} name={character.name} currentAssetId={character.portraitAssetId} choice={choice} onChoice={setChoice} />
          {choice !== null && (
            <div className="dialog__actions">
              <button type="button" className="button-primary" aria-busy={saving} onClick={() => void save()}>
                {saving ? 'Saving…' : choice === 'remove' ? 'Remove portrait' : 'Save portrait'}
              </button>
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
