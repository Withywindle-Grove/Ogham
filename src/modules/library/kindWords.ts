import type { EntryKind } from './packFile.ts';

/** Plain words for each kind of entry: one and many. */
export const KIND_WORDS: Record<EntryKind, [string, string]> = {
  class: ['class', 'classes'],
  race: ['race', 'races'],
  item: ['item', 'items'],
  spell: ['spell', 'spells'],
  spellList: ['spell list', 'spell lists'],
  statBlock: ['stat block', 'stat blocks'],
  table: ['table', 'tables'],
  treasureType: ['treasure type', 'treasure types'],
  condition: ['condition', 'conditions'],
  lightType: ['light type', 'light types'],
  xpTable: ['XP table', 'XP tables'],
  option: ['optional rule', 'optional rules'],
  rulesSet: ['rules set', 'rules sets'],
  startingKit: ['starting kit', 'starting kits'],
  fieldTemplate: ['sheet layout', 'sheet layouts'],
  hook: ['rule hook', 'rule hooks'],
  calendar: ['calendar', 'calendars'],
  traitList: ['trait list', 'trait lists'],
  gmReferencePanel: ['GM reference panel', 'GM reference panels'],
  location: ['place', 'places'],
  patch: ['patch', 'patches'],
  patron: ['patron', 'patrons'],
  route: ['route', 'routes'],
  // A screen's word, never the format's (pf-7a): "Call to adventure".
  adventureHook: ['call to adventure', 'calls to adventure'],
  map: ['map', 'maps'],
};
