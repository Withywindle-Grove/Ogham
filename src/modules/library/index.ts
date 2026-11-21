// Library module: the rules library (your packs). Plugs its commands into the registry (core never imports this module).
import type { CommandRegistry } from '../../core/commands.ts';
import { attachPack, detachPack, moveSettingRules, preferEntry, setPackOptions, startHomebrew } from './campaignPacks.ts';
import { CALL_COMMANDS } from './callsToAdventure.ts';
import { deleteHomebrewEntry, saveHomebrewEntry } from './homebrew.ts';
import { copyHomebrewToLibrary, deletePack, editPackEntry, importPack, updatePack } from './library.ts';
import { giveRumour } from './rumours.ts';

export function registerLibrary(registry: CommandRegistry): void {
  for (const command of [importPack, updatePack, deletePack, attachPack, setPackOptions, detachPack, moveSettingRules, preferEntry, startHomebrew, saveHomebrewEntry, deleteHomebrewEntry, copyHomebrewToLibrary, editPackEntry, ...CALL_COMMANDS, giveRumour]) registry.register(command);
}
