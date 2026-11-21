// Expedition module: plugs its commands into the registry (core never imports this module). The engine beside it
// (clock, modes, procedure…) is pure and writes nothing; play.ts and reminderPlay.ts hold what the campaign keeps.
import type { CommandRegistry } from '../../core/commands.ts';
import { GROUP_COMMANDS } from './groupPlay.ts';
import { LIGHT_COMMANDS } from './lightPlay.ts';
import { MARCHING_COMMANDS } from './marchingPlay.ts';
import { PLACE_COMMANDS } from './placePlay.ts';
import { ENCOUNTER_COMMANDS } from './encounterPlay.ts';
import { EXPEDITION_COMMANDS } from './play.ts';
import { REMINDER_COMMANDS } from './reminderPlay.ts';
import { STATUS_COMMANDS } from './statusPlay.ts';
import { REST_COMMANDS } from './restFlow.ts';
import { TABLE_COMMANDS } from './tablePins.ts';
import { TRAVEL_COMMANDS } from './travelPlay.ts';
import { ACTIVITY_COMMANDS } from './activityPlay.ts';
import { CAMP_COMMANDS } from './campPlay.ts';
import { WEATHER_COMMANDS } from './weatherPlay.ts';
import { TOWN_COMMANDS } from './townPlay.ts';
import { PLACE_SAFETY_COMMANDS } from './placeSafety.ts';
import { TOWN_PLACE_COMMANDS } from './townPlaces.ts';
import { PACK_PLACE_COMMANDS } from './placeFromPack.ts';
import { PLACE_RULE_COMMANDS } from './placeRules.ts';
import { PLACE_KNOWLEDGE_COMMANDS } from './placeKnowledge.ts';
import { PLACE_MOVE_COMMANDS } from './placeMove.ts';
import { PLACE_MAP_COMMANDS } from './placeMap.ts';
import { FIND_COMMANDS } from './findSend.ts';

export function registerExpedition(registry: CommandRegistry): void {
  for (const command of [...EXPEDITION_COMMANDS, ...REMINDER_COMMANDS, ...LIGHT_COMMANDS, ...MARCHING_COMMANDS, ...GROUP_COMMANDS, ...PLACE_COMMANDS, ...WEATHER_COMMANDS, ...STATUS_COMMANDS, ...REST_COMMANDS, ...TABLE_COMMANDS, ...ENCOUNTER_COMMANDS, ...TRAVEL_COMMANDS, ...ACTIVITY_COMMANDS, ...CAMP_COMMANDS, ...TOWN_COMMANDS, ...PLACE_SAFETY_COMMANDS, ...TOWN_PLACE_COMMANDS, ...PACK_PLACE_COMMANDS, ...PLACE_RULE_COMMANDS, ...PLACE_KNOWLEDGE_COMMANDS, ...PLACE_MOVE_COMMANDS, ...PLACE_MAP_COMMANDS, ...FIND_COMMANDS]) registry.register(command);
}
