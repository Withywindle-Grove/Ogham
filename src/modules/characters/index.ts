// Characters module: plugs its commands into the registry (core never imports this module).
import type { CommandRegistry } from '../../core/commands.ts';
import {
  archiveCharacter,
  assignCompany,
  createCharacter,
  deleteCharacter,
  editCharacter,
  reassignCharacter,
  restoreCharacter,
  resubmitCharacter,
  reviewCharacter,
  sendCharacter,
} from './commands.ts';
import { createField, deleteField, reorderFields, updateField, applySheetLayout } from './fields.ts';
import { setHp } from './hp.ts';
import { arrangeScreen } from './screenLayout.ts';
import { pinToAtHand } from './pins.ts';
import { prepareSpells, setAc, setForm, useAbility } from './playState.ts';
import { MAGIC_STATE_COMMANDS } from './magicState.ts';
import { clearPortrait, setPortrait } from './portraits.ts';
import { setSpellBook } from './spellBook.ts';
import { redoCreation } from './redo.ts';
import { SHEET_CHANGE_COMMANDS } from './sheetChanges.ts';
import { FINDS_SEEN_COMMANDS } from './findsSeen.ts';

export function registerCharacters(registry: CommandRegistry): void {
  for (const command of [
    createCharacter,
    editCharacter,
    reviewCharacter,
    resubmitCharacter,
    sendCharacter,
    assignCompany,
    deleteCharacter,
    archiveCharacter,
    restoreCharacter,
    reassignCharacter,
    createField,
    applySheetLayout,
    updateField,
    reorderFields,
    deleteField,
    setPortrait,
    clearPortrait,
    setHp,
    setSpellBook,
    redoCreation,
    arrangeScreen,
    prepareSpells,
    setAc,
    setForm,
    useAbility,
    ...MAGIC_STATE_COMMANDS,
    pinToAtHand,
    ...SHEET_CHANGE_COMMANDS,
    ...FINDS_SEEN_COMMANDS,
  ]) {
    registry.register(command);
  }
}
