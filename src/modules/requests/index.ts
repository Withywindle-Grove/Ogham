// Requests module: plugs its commands into the registry (core never imports this module).
import type { CommandRegistry } from '../../core/commands.ts';
import { REQUEST_COMMANDS } from './requests.ts';
import { SHOP_STOCK_COMMANDS } from './shopStock.ts';
import { TOWN_REQUEST_COMMANDS } from './townRequests.ts';

export function registerRequests(registry: CommandRegistry): void {
  for (const command of REQUEST_COMMANDS) registry.register(command);
  for (const command of TOWN_REQUEST_COMMANDS) registry.register(command);
  for (const command of SHOP_STOCK_COMMANDS) registry.register(command);
}
