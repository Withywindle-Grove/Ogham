// Messages module (GM to players, M5 step 11): plugs its commands into the registry (core never imports this module).
import type { CommandRegistry } from '../../core/commands.ts';
import { MESSAGE_COMMANDS } from './messages.ts';

export function registerMessages(registry: CommandRegistry): void {
  for (const command of MESSAGE_COMMANDS) registry.register(command);
}
