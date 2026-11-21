// The app's one command registry: core commands plus each module's.
import { createRegistry } from '../core/commands.ts';
import { registerCampaignCommands } from '../core/campaignCommands.ts';
import { addNote, editNote } from '../core/notes.ts';
import { recordRoll } from '../core/rolls.ts';
import { undoChange } from '../core/undo.ts';
import { registerCharacters } from '../modules/characters/index.ts';
import { registerExpedition } from '../modules/expedition/index.ts';
import { registerInventory } from '../modules/inventory/index.ts';
import { registerLibrary } from '../modules/library/index.ts';
import { registerMessages } from '../modules/messages/index.ts';
import { registerRequests } from '../modules/requests/index.ts';

export function createAppRegistry() {
  const registry = createRegistry();
  registerCampaignCommands(registry);
  registry.register(undoChange);
  registry.register(addNote);
  registry.register(editNote);
  registry.register(recordRoll);
  registerCharacters(registry);
  registerLibrary(registry);
  registerInventory(registry);
  registerExpedition(registry);
  registerMessages(registry);
  registerRequests(registry);
  return registry;
}
