// The app's shared services, created once: settings check, database connection (connection.ts), command registry.
import { createAppRegistry } from './commandRegistry.ts';

export { db, missingSettings } from './connection.ts';

export const registry = createAppRegistry();
