// The pack checker's format checks for a rules set's exploration fields (G-07, ruled 2026-10-29; docs/07,
// "Exploration") and the rules-set sections that go with them (weather, special seasons, daylight,
// wildEncounters, time.turnsPerHour, dungeonExit), and the engine rulings of 2026-10-29 (a byTerrain check's
// terrainChance, a mode's chanceDie, turnMinutes × turnsPerHour making an hour). Like pack-format.mjs, it only says in plain lines whether a
// pack writes these the way 07 says, and names the new shape when a pack writes an old one. Nothing blocks.
//
// Also the rulings of 2026-10-30: onlyWithOption names an option (and choice) the pack defines, on any activity, camp
// step, check or table (WA1); a check's alsoWhen (D9; four keys naming a route id or a terrain id) and onlyWhen
// (settlement: "outDay" | "activeNight"); movement.routes and forced march; and camp.sleep (D19).
//
// Used by scripts/pack-format.mjs; tested in scripts/pack-exploration.test.mjs with invented packs.

/**
 * The closed list of exploration symbols (07, "Everywhere in exploration"; 19 since the 2026-10-29 ruling). Anything
 * else shows a plain dot.
 */
export const ICONS = [
  'time', 'light', 'listen', 'door', 'search', 'rest', 'camp', 'travel', 'weather', 'encounter', 'star', 'note',
  'watch', 'describe', 'course', 'lost', 'monster', 'forage', 'hunt',
];

/** Procedure step kinds (07, "Procedure steps"). */
export const STEP_KINDS = ['note', 'roll', 'check', 'camp', 'watches', 'auto'];

/** Which terrain chance a byTerrain check uses (engine ruling 1, 2026-10-29). */
export const TERRAIN_CHANCES = ['lostChance', 'wanderChance'];

/** The events a check's alsoWhen can name (07; ruled 2026-10-30, D9 and F3): two name a route id, two a terrain id. */
export const ALSO_WHEN_EVENTS = ['leaveRoute', 'enterRoute', 'enterTerrain', 'leaveTerrain'];

/** When a check with onlyWhen is prompted (settlement rulings, 2026-10-30). */
export const ONLY_WHEN = ['outDay', 'activeNight'];

/** What a sleep difficulty's result is (07, camp.sleep; ruled 2026-10-30). */
export const SLEEP_RESULTS = ['good', 'check', 'bad'];

/** How repeated forced marches add up (07, Movement; ruled 2026-10-30). */
export const FORCED_STACK = ['once', 'add'];

/** A die as packs write it ("d6"). */
const DIE = /^d\d+$/i;

/** What a terrain class's mounts may say. */
export const MOUNTS = ['ride', 'lead', 'none'];

/** The rules set's wildEncounters keys (07, "Rules-set sections the engine reads"). */
const WILD_KEYS = ['typeTableId', 'commonTables', 'regionalTables', 'aquaticTableId', 'activityTableId', 'lairChance', 'lairMultiplier', 'surprise', 'distance', 'note', 'notes', 'source'];

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isWhole = (value) => Number.isInteger(value);
const list = (values) => values.join(', ');
const label = (entry, fallback) => (isObject(entry) && isText(entry.id) ? entry.id : isObject(entry) && isText(entry.name) ? entry.name : fallback);
const textList = (value) => Array.isArray(value) && value.length > 0 && value.every(isText);

/** "note" is the field; "notes" is read as its alias. Both at once is worth a line. */
function noteNotes(where, object) {
  if (!isObject(object)) return [];
  const notes = [];
  if (object.note !== undefined && object.notes !== undefined) notes.push(`${where}: has both note and notes; note is read, notes can go.`);
  for (const key of ['note', 'notes']) {
    if (object[key] !== undefined && typeof object[key] !== 'string') notes.push(`${where}: ${key} should be words.`);
  }
  return notes;
}

/**
 * `onlyWithOption: "<option id>[:<choice id>]"` (ruled 2026-10-30, WA1), checked against the pack's own options
 * (the top-level `options` list): the option must be one the pack defines, the choice one of its choices, and with no
 * choice id the option needs an `on` choice.
 */
function optionNotes(where, object, options) {
  if (!isObject(object) || object.onlyWithOption === undefined) return [];
  const value = object.onlyWithOption;
  if (!isText(value) || !/^[^:\s]+(:[^:\s]+)?$/.test(value.trim())) return [`${where}: onlyWithOption should be "<option id>" or "<option id>:<choice id>".`];
  const [id, choice] = value.trim().split(':');
  const option = options.get(id);
  if (!option) return [`${where}: onlyWithOption names "${id}", which isn't an option in this pack (fine if another attached pack has it).`];
  const choiceIds = (Array.isArray(option.choices) ? option.choices : []).filter(isObject).map((c) => c.id).filter(isText);
  if (choiceIds.length === 0) return [];
  const wanted = choice ?? 'on';
  if (choiceIds.includes(wanted)) return [];
  if (choice === undefined) return [`${where}: onlyWithOption "${id}" means its "on" choice, but that option has no "on" choice (${list(choiceIds)}); write "${id}:<choice id>".`];
  return [`${where}: onlyWithOption names choice "${choice}", which isn't one of option "${id}"'s choices (${list(choiceIds)}).`];
}

/** The pack's options by id, for onlyWithOption. */
const optionsById = (file) => new Map((Array.isArray(file.options) ? file.options : []).filter((o) => isObject(o) && isText(o.id)).map((o) => [o.id, o]));

/**
 * onlyWithOption on the pack's tables (WA1: any table may carry it). A table's `option` is no longer the old way: since
 * of-3 and of-12 any entry, tables included, may carry `option` (one spec or a list), and pack-option-gates.mjs checks
 * the option and choices it names, so nothing is said about it here.
 */
export function tableOptionNotes(file) {
  if (!isObject(file) || !Array.isArray(file.tables)) return [];
  const options = optionsById(file);
  return file.tables.filter(isObject).flatMap((t, i) => optionNotes(`tables: "${label(t, `#${i + 1}`)}"`, t, options));
}

function iconNotes(where, object) {
  if (!isObject(object) || object.icon === undefined) return [];
  if (!isText(object.icon) || !ICONS.includes(object.icon)) {
    return [`${where}: icon "${object.icon}" isn't on the symbol list (${list(ICONS)}); it would show a plain dot.`];
  }
  return [];
}

const isEvery = (value) => isObject(value) && typeof value.value === 'number' && value.value > 0 && isText(value.unit);

function stepNotes(where, step, ctx) {
  const notes = [...iconNotes(where, step), ...noteNotes(where, step), ...optionNotes(where, step, ctx.options)];
  if (step.kind !== undefined && !STEP_KINDS.includes(step.kind)) notes.push(`${where}: kind "${step.kind}" isn't one of ${list(STEP_KINDS)}.`);
  if (typeof step.tableId === 'string' && step.tableId.trim().toLowerCase() === 'byseason') {
    notes.push(`${where}: tableId "byseason" is the old way; write tableBySeason: { <season id>: <table id> }.`);
  } else if (step.tableId !== undefined && step.tableId !== null && !isText(step.tableId)) {
    notes.push(`${where}: tableId should be a table id (or left out, and the GM types the result).`);
  }
  if (step.tableBySeason !== undefined) {
    if (!isObject(step.tableBySeason) || !Object.values(step.tableBySeason).every(isText)) notes.push(`${where}: tableBySeason should map season ids to table ids.`);
    else if (ctx.seasonIds.size > 0) {
      for (const season of Object.keys(step.tableBySeason).filter((s) => !ctx.seasonIds.has(s))) notes.push(`${where}: tableBySeason names "${season}", which isn't a season.`);
    }
  }
  if (step.kind === 'check' && isText(step.checkId) && !ctx.checkIds.has(step.checkId)) notes.push(`${where}: checkId "${step.checkId}" isn't one of this mode's checks.`);
  if (step.checkAbility !== undefined && !isText(step.checkAbility)) notes.push(`${where}: checkAbility should name an ability ("WIS").`);
  for (const key of ['onGoodRest', 'onBadRest']) {
    if (step[key] === undefined) continue;
    if (!Array.isArray(step[key]) || !step[key].every(isObject)) notes.push(`${where}: ${key} should be a list of effects like [{ "condition": "<condition id>" }].`);
    else if (key === 'onBadRest' && step[key].some((e) => !isText(e.condition))) notes.push(`${where}: each onBadRest effect names a condition: { "condition": "<condition id>" }.`);
  }
  return notes;
}

function onHitNotes(where, onHit) {
  if (onHit === undefined) return [];
  if (!isObject(onHit)) return [`${where}: onHit should be { tableId? | tableChoices?, columns?, regionTables?, note? }.`];
  const notes = noteNotes(`${where}.onHit`, onHit);
  if (onHit.tableId !== undefined && onHit.tableId !== null && !isText(onHit.tableId)) notes.push(`${where}: onHit.tableId should be a table id.`);
  if (onHit.tableChoices !== undefined && !textList(onHit.tableChoices)) notes.push(`${where}: onHit.tableChoices should be a list of table ids (the GM picks one).`);
  if (isText(onHit.tableId) && onHit.tableChoices !== undefined) notes.push(`${where}: onHit has both tableId and tableChoices; give one.`);
  if (onHit.column !== undefined && !isText(onHit.column)) notes.push(`${where}: onHit.column should be column labels joined by a bar ("road|wild"); better, write onHit.columns: ["<label>", "<label>"].`);
  else if (onHit.column !== undefined) notes.push(`${where}: onHit.column is the old way: it's read as columns split on "|"; write onHit.columns: ["<label>", "<label>"] (the GM picks one).`);
  if (onHit.columns !== undefined && !textList(onHit.columns)) notes.push(`${where}: onHit.columns should be a list of column labels.`);
  if (onHit.regionTables !== undefined && onHit.regionTables !== true) notes.push(`${where}: onHit.regionTables is true or left out.`);
  return notes;
}

/**
 * A check's `terrainChance` (engine ruling 1, 2026-10-29): with byTerrain it names the terrain chance used. Without
 * it the app falls back to a guess from the symbol of the step that runs the check, so the checker warns.
 */
function terrainChanceNotes(where, check, icon) {
  const notes = [];
  if (check.terrainChance !== undefined && !TERRAIN_CHANCES.includes(check.terrainChance)) {
    notes.push(`${where}: terrainChance "${check.terrainChance}" isn't one of ${list(TERRAIN_CHANCES)}.`);
  } else if (check.terrainChance !== undefined && check.byTerrain !== true) {
    notes.push(`${where}: terrainChance is only read with byTerrain: true.`);
  }
  if (check.byTerrain === true && check.terrainChance === undefined) {
    const guess = icon === 'lost' ? 'lostChance' : 'wanderChance';
    notes.push(`${where}: byTerrain with no terrainChance; the app falls back to guessing ${guess} from the step's symbol. Write terrainChance: "lostChance" or "wanderChance".`);
  }
  return notes;
}

/**
 * A check's `alsoWhen` (ruled 2026-10-30, D9 and F3): one event object or a list of them, each with any of four keys.
 * leaveRoute and enterRoute name a route's id (a mode's `movement.routes`); enterTerrain and leaveTerrain name a
 * terrain id (a mode's `terrain`). Ids are looked up across the pack's modes; another attached pack may add more.
 */
function alsoWhenNotes(where, alsoWhen, ctx) {
  if (alsoWhen === undefined) return [];
  const shape = `${where}: alsoWhen should be an event like { "leaveRoute": "<route id>" }, or a list of them.`;
  const events = Array.isArray(alsoWhen) ? alsoWhen : [alsoWhen];
  if (events.length === 0 || !events.every(isObject)) return [shape];
  const notes = [];
  for (const [i, event] of events.entries()) {
    const at = Array.isArray(alsoWhen) ? `${where}: alsoWhen #${i + 1}` : `${where}: alsoWhen`;
    const keys = Object.keys(event);
    if (keys.length === 0) notes.push(`${at} names no event (${list(ALSO_WHEN_EVENTS)}).`);
    for (const key of keys.filter((k) => !ALSO_WHEN_EVENTS.includes(k))) notes.push(`${at}.${key} isn't an event 07 knows (${list(ALSO_WHEN_EVENTS)}); it's kept but not read.`);
    for (const key of ALSO_WHEN_EVENTS.filter((k) => event[k] !== undefined)) {
      const route = key.endsWith('Route');
      const [kind, ids, home] = route ? ['route', ctx.routeIds, 'movement.routes'] : ['terrain', ctx.terrainIds, 'terrain'];
      const id = event[key];
      if (!isText(id)) notes.push(`${at}.${key} should name a ${kind} id.`);
      else if (ids.size === 0) notes.push(`${at}.${key} "${id}": this pack's modes define no ${kind}s (${home}), so the checker can't tell whether it's one (fine if another attached pack has it).`);
      else if (!ids.has(id)) notes.push(`${at}.${key} "${id}" isn't a ${kind} id in this pack (${list([...ids])}); fine if another attached pack has it.`);
    }
  }
  return notes;
}

/** A check's `routeType` modifiers name a route id from `movement.routes` (07, Checks; ruled 2026-10-30). */
function routeTypeNotes(where, check, ctx) {
  if (!Array.isArray(check.modifiers)) return [];
  const notes = [];
  for (const m of check.modifiers.filter((x) => isObject(x) && x.routeType !== undefined)) {
    const id = m.routeType;
    if (!isText(id)) notes.push(`${where}: a routeType modifier should name a route id.`);
    else if (ctx.routeIds.size === 0) notes.push(`${where}: routeType "${id}": this pack's modes define no routes (movement.routes), so the checker can't tell whether it's one (fine if another attached pack has it).`);
    else if (!ctx.routeIds.has(id)) notes.push(`${where}: routeType "${id}" isn't a route id in this pack (${list([...ctx.routeIds])}); fine if another attached pack has it.`);
  }
  return notes;
}

/** A modifier keyed to the party (ex-2, ga-3): it names `ifPartyHas`, `who: "self"` or `ifClass`. */
const isPartyModifier = (m) => isObject(m) && (m.ifPartyHas !== undefined || m.who !== undefined || m.ifClass !== undefined);

/**
 * A party modifier's shape (07; ruled 2026-11-03, ex-2 and ga-3): `ifPartyHas: { class } | { skill }`, `who: "self"`,
 * `ifClass`, `onlyOnTerrain` (a list), and `add` (a whole number) or `chance: { on: [faces] }`.
 */
function partyModifierNotes(where, list) {
  if (!Array.isArray(list)) return [];
  const notes = [];
  for (const m of list.filter(isPartyModifier)) {
    const has = m.ifPartyHas;
    if (has !== undefined && !(isObject(has) && (isText(has.class) || isText(has.skill)))) notes.push(`${where}: a modifier's ifPartyHas should be { "class": "<id>" } or { "skill": "<code>" }.`);
    if (m.who !== undefined && m.who !== 'self') notes.push(`${where}: a modifier's who should be "self".`);
    if (m.ifClass !== undefined && !isText(m.ifClass)) notes.push(`${where}: a modifier's ifClass should name a class id.`);
    if (m.who === 'self' && m.ifClass === undefined && has === undefined) notes.push(`${where}: a who: "self" modifier says whose it is (ifClass or ifPartyHas).`);
    if (m.onlyOnTerrain !== undefined && !(Array.isArray(m.onlyOnTerrain) && m.onlyOnTerrain.every(isText))) notes.push(`${where}: a modifier's onlyOnTerrain should be a list of terrain ids.`);
    const sets = isObject(m.chance) && Array.isArray(m.chance.on) && m.chance.on.length > 0 && m.chance.on.every(isWhole);
    if (m.chance !== undefined && !sets) notes.push(`${where}: a modifier's chance should be { "on": [faces] }.`);
    if (m.chance === undefined && !(isWhole(m.add) && m.add !== 0)) notes.push(`${where}: a party modifier adds (a whole number) or sets the chance ({ "on": [faces] }).`);
  }
  return notes;
}

/** A check's `onlyWhen` (settlement rulings, 2026-10-30): "outDay" or "activeNight". */
function onlyWhenNotes(where, check) {
  if (check.onlyWhen === undefined || ONLY_WHEN.includes(check.onlyWhen)) return [];
  return [`${where}: onlyWhen "${check.onlyWhen}" isn't one of ${list(ONLY_WHEN)}.`];
}

/** `movement.routes` (ruled 2026-10-30): [{ id, name, cost?, column?, note? }]. */
function routeNotes(where, routes) {
  if (routes === undefined) return [];
  if (!Array.isArray(routes)) return [`${where}: routes should be a list like [{ "id": "<id>", "name": "<name>", "cost"?, "column"?, "note"? }].`];
  const notes = [];
  const seen = new Set();
  for (const [i, route] of routes.entries()) {
    const at = `${where}, route "${label(route, `#${i + 1}`)}"`;
    if (!isObject(route)) { notes.push(`${at}: should be { id, name, cost?, column?, note? }.`); continue; }
    if (!isText(route.id)) notes.push(`${at}: has no id (checks name routes by id).`);
    else if (seen.has(route.id)) notes.push(`${at}: the id is used twice.`);
    else seen.add(route.id);
    if (!isText(route.name)) notes.push(`${at}: has no name.`);
    if (route.cost !== undefined && !(isWhole(route.cost) && route.cost >= 0)) notes.push(`${at}: cost should be a whole number of 0 or more.`);
    if (route.column !== undefined && !isText(route.column)) notes.push(`${at}: column should be an encounter-table column label.`);
    notes.push(...noteNotes(at, route));
  }
  return notes;
}

/** `movement.forced` (ruled 2026-10-30): { factor | add, stack?: "once" | "add", note? }. */
function forcedNotes(where, forced) {
  if (forced === undefined) return [];
  if (!isObject(forced)) return [`${where}: forced should be { factor | add, stack?, note? }.`];
  const notes = noteNotes(`${where} forced`, forced);
  if (forced.factor !== undefined && !(typeof forced.factor === 'number' && forced.factor > 0)) notes.push(`${where}: forced.factor should be a number above 0 (the day's budget is multiplied by it, rounded down).`);
  if (forced.add !== undefined && !(isWhole(forced.add) && forced.add > 0)) notes.push(`${where}: forced.add should be a whole number of points above 0.`);
  if (forced.factor !== undefined && forced.add !== undefined) notes.push(`${where}: forced has both factor and add; give one.`);
  if (forced.factor === undefined && forced.add === undefined) notes.push(`${where}: forced gives neither factor nor add; give one.`);
  if (forced.stack !== undefined && !FORCED_STACK.includes(forced.stack)) notes.push(`${where}: forced.stack "${forced.stack}" isn't one of ${list(FORCED_STACK)}.`);
  return notes;
}

function movementNotes(where, movement) {
  if (!isObject(movement)) return movement === undefined ? [] : [`${where}: movement should be an object.`];
  const notes = noteNotes(where, movement);
  if (movement.unit !== undefined && !isText(movement.unit)) notes.push(`${where}: unit should be a unit name ("ft", "miles", "points").`);
  if (movement.terrainCostPer !== undefined) notes.push(`${where}: terrainCostPer is the old name; write costPer: { value, unit }.`);
  if (movement.hexSize !== undefined) notes.push(`${where}: hexSize is the old way; write costPer: { value, unit } (the hex size itself belongs on hexGrid).`);
  if (movement.costPer !== undefined && !isEvery(movement.costPer)) notes.push(`${where}: costPer should be { value: <number>, unit: "<unit>" }.`);
  for (const key of ['mounted', 'vehicle']) {
    if (movement[key] !== undefined && !(isWhole(movement[key]) && movement[key] > 0)) notes.push(`${where}: ${key} should be a whole-number speed in the mode's unit.`);
  }
  for (const key of ['roads', 'tracks']) if (movement[key] !== undefined) notes.push(`${where}: ${key} is the old way; write routes: [{ id, name, cost?, column?, note? }].`);
  notes.push(...routeNotes(where, movement.routes), ...forcedNotes(where, movement.forced));
  return notes;
}

function activityNotes(where, activity, ctx, mode) {
  const notes = [...iconNotes(where, activity), ...noteNotes(where, activity), ...optionNotes(where, activity, ctx.options)];
  const cost = activity.cost;
  if (cost !== undefined) {
    if (!isObject(cost)) notes.push(`${where}: cost should be { steps }, { budget }, { time } or { fromTerrain }.`);
    else {
      if (typeof cost.budget === 'string' && cost.budget !== 'all') {
        const field = cost.budget.replace(/^terrain\./, '');
        notes.push(`${where}: cost.budget "${cost.budget}" is the old way; write cost: { fromTerrain: "${field}" }.`);
      } else if (cost.budget !== undefined && cost.budget !== 'all' && !isWhole(cost.budget)) notes.push(`${where}: cost.budget should be a whole number or "all".`);
      if (cost.steps !== undefined && !(isWhole(cost.steps) && cost.steps >= 0)) notes.push(`${where}: cost.steps should be a whole number of the mode's steps.`);
      if (cost.fromTerrain !== undefined && !isText(cost.fromTerrain)) notes.push(`${where}: cost.fromTerrain names a terrain field ("searchCost").`);
      if (!['steps', 'budget', 'time', 'fromTerrain'].some((k) => cost[k] !== undefined)) notes.push(`${where}: cost should be { steps }, { budget }, { time } or { fromTerrain }.`);
    }
  }
  const requires = activity.requires;
  if (requires !== undefined) {
    if (!isObject(requires)) notes.push(`${where}: requires should be { skill?, item? }.`);
    else {
      if (requires.classSkill !== undefined) notes.push(`${where}: requires.classSkill is the old name; write requires.skill.`);
      for (const key of ['skill', 'item']) if (requires[key] !== undefined && !isText(requires[key])) notes.push(`${where}: requires.${key} should be an id.`);
    }
  }
  if (activity.requiresItem !== undefined) notes.push(`${where}: requiresItem is the old way; write requires: { item: "<item id>" } (keep the words as note if there's no item id).`);
  const chance = activity.chance;
  if (isObject(chance) && chance.abilityCheck !== undefined && !isText(chance.abilityCheck)) notes.push(`${where}: chance.abilityCheck names an ability ("WIS").`);
  // A skill, or a list of skills whose best counts (ex-3).
  const skillOk = (s) => isText(s) || (Array.isArray(s) && s.length > 0 && s.every(isText));
  if (isObject(chance) && chance.skill !== undefined && !skillOk(chance.skill)) notes.push(`${where}: chance.skill names a skill ("hark") or a list of them (["hark", "EAR"]); the best the character has counts.`);
  if (activity.maxActors !== undefined && !(isWhole(activity.maxActors) && activity.maxActors >= 1)) notes.push(`${where}: maxActors should be a whole number of 1 or more.`);
  if (activity.bestOf !== undefined && typeof activity.bestOf !== 'boolean') notes.push(`${where}: bestOf is true or false.`);
  if (activity.modifiers !== undefined) {
    if (!Array.isArray(activity.modifiers)) notes.push(`${where}: modifiers should be a list like [{ "when": "fullDay", "add": 1 }].`);
    else {
      notes.push(...partyModifierNotes(where, activity.modifiers));
      for (const m of activity.modifiers) {
        if (!isObject(m) || isPartyModifier(m)) continue;
        if (m.ifFullDay !== undefined) notes.push(`${where}: a modifier's ifFullDay is the old way; write { "when": "fullDay", "add": <n> }.`);
        else if (!isText(m.when)) notes.push(`${where}: each modifier says when it applies ("fullDay" or a condition).`);
        if (!isWhole(m.add)) notes.push(`${where}: each modifier's add should be a whole number.`);
      }
    }
  }
  const renamed = [
    ['onSuccessTableId', 'tableId'],
    ['onSuccessTableByTerrain', 'tableByTerrain'],
    ['seasonResult', 'bySeason'],
    ['specialSeasons', 'bySpecialSeason'],
  ];
  for (const [old, now] of renamed) if (activity[old] !== undefined) notes.push(`${where}: ${old} is the old name; write ${now}.`);
  for (const key of ['tableByTerrain', 'bySeason', 'bySpecialSeason']) {
    if (activity[key] !== undefined && !(isObject(activity[key]) && Object.values(activity[key]).every((v) => isText(v) || typeof v === 'number'))) {
      notes.push(`${where}: ${key} should map ids to ${key === 'tableByTerrain' ? 'table ids' : 'text or dice'}.`);
    }
  }
  if (isObject(activity.tableByTerrain)) {
    for (const terrain of Object.keys(activity.tableByTerrain).filter((t) => mode.terrainIds.size > 0 && !mode.terrainIds.has(t))) notes.push(`${where}: tableByTerrain names "${terrain}", which isn't a terrain of this mode.`);
  }
  if (activity.onlyIn !== undefined) {
    if (!textList(activity.onlyIn)) notes.push(`${where}: onlyIn should be a list of mode ids.`);
    else {
      const terrains = activity.onlyIn.filter((id) => !ctx.modeIds.has(id) && mode.terrainIds.has(id));
      const unknown = activity.onlyIn.filter((id) => !ctx.modeIds.has(id) && !mode.terrainIds.has(id));
      if (terrains.length > 0) notes.push(`${where}: onlyIn lists terrains (${list(terrains)}); onlyIn means modes now, so write onlyOnTerrain: [${terrains.map((t) => `"${t}"`).join(', ')}].`);
      if (unknown.length > 0) notes.push(`${where}: onlyIn names ${list(unknown.map((u) => `"${u}"`))}, which isn't a mode.`);
    }
  }
  if (activity.onlyOnTerrain !== undefined) {
    if (!textList(activity.onlyOnTerrain)) notes.push(`${where}: onlyOnTerrain should be a list of terrain ids.`);
    else if (mode.terrainIds.size > 0) {
      for (const t of activity.onlyOnTerrain.filter((id) => !mode.terrainIds.has(id))) notes.push(`${where}: onlyOnTerrain names "${t}", which isn't a terrain of this mode.`);
    }
  }
  if (activity.yields !== undefined) notes.push(...yieldsNotes(where, activity.yields, ctx));
  return notes;
}

/** Dice or a number the way the app reads a yield's count ("1d3", "2d4 + 1", "3"; activities.ts DICE). */
const YIELD_DICE = /^\s*(\d+\s*|\d*d\d+(\s*[+-]\s*\d+)?)\s*$/i;

/**
 * An activity's `yields` (07; G-108, ga-5): `{ item, dice }` counts whole items (a bundle each), `{ item, units }`
 * single pieces of a bundled item (a day's food from a week's rations; G-92's units). Says a shape the app can't
 * read, an item the pack lacks, both counts at once, and units on an item with no bundle (they'd change nothing).
 */
function yieldsNotes(where, yields, ctx) {
  if (!isObject(yields)) return [`${where}: yields should be { item, dice } (whole items) or { item, units } (single pieces of a bundled item).`];
  const notes = [];
  if (!isText(yields.item)) notes.push(`${where}: yields names no item.`);
  else if (ctx.itemIds.size > 0 && !ctx.itemIds.has(yields.item)) notes.push(`${where}: yields names "${yields.item}", which isn't an item of this pack.`);
  const hasUnits = yields.units !== undefined;
  if (yields.dice === undefined && !hasUnits) notes.push(`${where}: yields should say how many: dice (whole items) or units (single pieces of a bundled item).`);
  if (yields.dice !== undefined && hasUnits) notes.push(`${where}: yields has both dice and units; write one (units wins: single pieces).`);
  if (yields.dice !== undefined && !(typeof yields.dice === 'string' && YIELD_DICE.test(yields.dice))) notes.push(`${where}: yields.dice should be dice or a number written as text, like "1d3".`);
  if (hasUnits) {
    const ok = (isWhole(yields.units) && yields.units >= 1) || (typeof yields.units === 'string' && YIELD_DICE.test(yields.units) && yields.units.trim() !== '0');
    if (!ok) notes.push(`${where}: yields.units should be dice like "1d3" or a whole number of 1 or more (single pieces of the bundle).`);
    const item = isText(yields.item) ? ctx.itemsById.get(yields.item) : undefined;
    if (ok && item && !(isWhole(item.bundle) && item.bundle > 1)) notes.push(`${where}: yields counts units of "${yields.item}", which has no bundle; units and dice give the same.`);
  }
  return notes;
}

function terrainNotes(where, mode) {
  const notes = [];
  const classIds = new Set();
  for (const [i, c] of (Array.isArray(mode.terrainClasses) ? mode.terrainClasses : []).entries()) {
    const at = `${where}, terrain class "${label(c, `#${i + 1}`)}"`;
    if (!isObject(c)) continue;
    if (isText(c.id)) classIds.add(c.id);
    else notes.push(`${at}: has no id.`);
    if (c.name !== undefined && !isText(c.name)) notes.push(`${at}: name should be words.`);
    if (c.mounts !== undefined && !MOUNTS.includes(c.mounts)) notes.push(`${at}: mounts "${c.mounts}" isn't one of ${list(MOUNTS)}.`);
    notes.push(...noteNotes(at, c));
  }
  for (const [i, t] of (Array.isArray(mode.terrain) ? mode.terrain : []).entries()) {
    if (!isObject(t)) continue;
    const at = `${where}, terrain "${label(t, `#${i + 1}`)}"`;
    notes.push(...noteNotes(at, t));
    if (t.class !== undefined && !classIds.has(t.class)) notes.push(`${at}: class "${t.class}" isn't one of this mode's terrainClasses.`);
    if (t.class === undefined && t.cost === undefined) notes.push(`${at}: names no class and gives no cost; give one or the other.`);
    if (t.encounterColumn !== undefined && !isText(t.encounterColumn)) notes.push(`${at}: encounterColumn should be a column label.`);
    if (t.mounts !== undefined && !MOUNTS.includes(t.mounts)) notes.push(`${at}: mounts "${t.mounts}" isn't one of ${list(MOUNTS)}.`);
  }
  return notes;
}

function campNotes(where, mode, ctx, own) {
  const camp = mode.camp;
  if (camp === undefined) return [];
  if (!isObject(camp)) return [`${where}: camp should be { procedure, quick?, note? } or { sameAs: "<mode id>" }.`];
  const notes = [...noteNotes(`${where} camp`, camp)];
  if (typeof camp.procedure === 'string') {
    notes.push(`${where}: camp.procedure "${camp.procedure}" is the old way to reuse a camp; write camp: { sameAs: "${camp.procedure}" }.`);
  }
  if (camp.sameAs !== undefined) {
    if (!isText(camp.sameAs) || !ctx.modeIds.has(camp.sameAs)) notes.push(`${where}: camp.sameAs should name another mode ("${camp.sameAs}" isn't one).`);
    else if (camp.sameAs === mode.id) notes.push(`${where}: camp.sameAs names its own mode.`);
    else if (!ctx.modesById.get(camp.sameAs)?.camp) notes.push(`${where}: camp.sameAs names "${camp.sameAs}", which has no camp.`);
  }
  for (const [i, step] of (Array.isArray(camp.procedure) ? camp.procedure : []).entries()) {
    if (!isObject(step)) continue;
    const at = `${where}, camp step "${label(step, `#${i + 1}`)}"`;
    notes.push(...stepNotes(at, step, { ...ctx, checkIds: own.checkIds }));
    if (step.difficulty !== undefined) notes.push(`${at}: a sleep step's difficulty is the old way; write camp.sleep: { difficulties, rows, … }.`);
  }
  if (camp.bedding !== undefined) notes.push(`${where}: camp.bedding is the old way; write camp.sleep: { difficulties, rows, beddingItems, … }.`);
  notes.push(...sleepNotes(`${where} camp.sleep`, camp.sleep, ctx));
  return notes;
}

/**
 * `camp.sleep` (ruled 2026-10-30, D19): difficulties { id, name, result: "good" | "check" | "bad", add? }, rows that pick
 * one, the bedding items and modifiers. A difficulty's earlier `roll` is the old way.
 */
function sleepNotes(where, sleep, ctx) {
  if (sleep === undefined) return [];
  if (!isObject(sleep)) return [`${where}: should be { difficulties, rows, beddingItems?, modifiers?, checkAbility?, note? }.`];
  const notes = noteNotes(where, sleep);
  const difficultyIds = new Set();
  if (!Array.isArray(sleep.difficulties)) notes.push(`${where}: difficulties should be a list like [{ "id": "<id>", "name": "<name>", "result": "check", "add"? }].`);
  for (const [i, d] of (Array.isArray(sleep.difficulties) ? sleep.difficulties : []).entries()) {
    const at = `${where}, difficulty "${label(d, `#${i + 1}`)}"`;
    if (!isObject(d)) { notes.push(`${at}: should be { id, name, result, add? }.`); continue; }
    if (isText(d.id)) difficultyIds.add(d.id);
    else notes.push(`${at}: has no id.`);
    if (!isText(d.name)) notes.push(`${at}: has no name.`);
    if (d.add !== undefined && !isWhole(d.add)) notes.push(`${at}: add should be a whole number.`);
    if (d.roll !== undefined) notes.push(`${at}: roll is the old way; write result: "good", "check" or "bad".`);
    else if (!SLEEP_RESULTS.includes(d.result)) notes.push(`${at}: result should be one of ${list(SLEEP_RESULTS)}.`);
  }
  const itemKnown = (id) => ctx.itemIds.size === 0 || ctx.itemIds.has(id);
  if (!Array.isArray(sleep.rows)) notes.push(`${where}: rows should be a list like [{ "fire": true, "bedding": "none", "difficulty": "<difficulty id>" }].`);
  for (const [i, row] of (Array.isArray(sleep.rows) ? sleep.rows : []).entries()) {
    const at = `${where}, row #${i + 1}`;
    if (!isObject(row)) { notes.push(`${at}: should be { season?, fire?, bedding?, difficulty }.`); continue; }
    if (!isText(row.difficulty)) notes.push(`${at}: names no difficulty.`);
    else if (difficultyIds.size > 0 && !difficultyIds.has(row.difficulty)) notes.push(`${at}: difficulty "${row.difficulty}" isn't one of the sleep difficulties.`);
    if (row.season !== undefined) {
      if (!textList(row.season)) notes.push(`${at}: season should be a list of season ids.`);
      else if (ctx.seasonIds.size > 0) for (const s of row.season.filter((id) => !ctx.seasonIds.has(id))) notes.push(`${at}: season "${s}" isn't a season.`);
    }
    if (row.fire !== undefined && typeof row.fire !== 'boolean') notes.push(`${at}: fire is true or false.`);
    const bedding = row.bedding;
    if (bedding !== undefined && bedding !== 'none') {
      const keys = isObject(bedding) ? Object.keys(bedding) : [];
      if (keys.length !== 1 || !['any', 'all'].includes(keys[0]) || !textList(bedding[keys[0]])) notes.push(`${at}: bedding should be "none", { "any": [<item ids>] } or { "all": [<item ids>] }.`);
      else for (const id of bedding[keys[0]].filter((b) => !itemKnown(b))) notes.push(`${at}: bedding names "${id}", which isn't an item in this pack (fine if another attached pack has it).`);
    }
  }
  if (sleep.beddingItems !== undefined) {
    if (!Array.isArray(sleep.beddingItems)) notes.push(`${where}: beddingItems should be a list like [{ "id": "<item id>", "shares"?: 2 }].`);
    for (const [i, b] of (Array.isArray(sleep.beddingItems) ? sleep.beddingItems : []).entries()) {
      const at = `${where}, bedding item #${i + 1}`;
      if (!isObject(b) || !isText(b.id)) { notes.push(`${at}: should be { id: "<item id>", shares? }.`); continue; }
      if (!itemKnown(b.id)) notes.push(`${at}: "${b.id}" isn't an item in this pack (fine if another attached pack has it).`);
      if (b.shares !== undefined && !(isWhole(b.shares) && b.shares >= 1)) notes.push(`${at}: shares should be a whole number of 1 or more (how many characters it covers).`);
    }
  }
  if (sleep.modifiers !== undefined) {
    if (!Array.isArray(sleep.modifiers) || sleep.modifiers.some((m) => !isObject(m) || !isText(m.when) || !isWhole(m.add))) {
      notes.push(`${where}: modifiers should be a list like [{ "when": "<when>", "add": <whole number>, "note"? }].`);
    }
  }
  if (sleep.checkAbility !== undefined && !isText(sleep.checkAbility)) notes.push(`${where}: checkAbility should name an ability ("WIS").`);
  return notes;
}

function modeNotes(rulesWhere, mode, ctx) {
  const where = `${rulesWhere}, mode "${label(mode, '?')}"`;
  const checks = (Array.isArray(mode.checks) ? mode.checks : []).filter(isObject);
  const own = { checkIds: new Set(checks.map((c) => c.id).filter(isText)), terrainIds: new Set((Array.isArray(mode.terrain) ? mode.terrain : []).filter(isObject).map((t) => t.id).filter(isText)) };
  const notes = [...noteNotes(where, mode), ...optionNotes(where, mode, ctx.options)];
  if (mode.other !== undefined && typeof mode.other !== 'boolean') notes.push(`${where}: other is true or false (show "Other…").`);
  if (mode.rest !== undefined && mode.rest !== null) {
    if (!isObject(mode.rest)) notes.push(`${where}: rest should be { every, length, condition, note? }, or null for no rest.`);
    else notes.push(...noteNotes(`${where} rest`, mode.rest));
  }
  for (const [i, step] of (Array.isArray(mode.procedure) ? mode.procedure : []).entries()) {
    if (isObject(step)) notes.push(...stepNotes(`${where}, step "${label(step, `#${i + 1}`)}"`, step, { ...ctx, checkIds: own.checkIds }));
  }
  // The symbol of the first step (procedure, then camp) that runs each check: the engine's fallback guess.
  const campSteps = isObject(mode.camp) && Array.isArray(mode.camp.procedure) ? mode.camp.procedure : [];
  const runBy = new Map();
  for (const step of [...(Array.isArray(mode.procedure) ? mode.procedure : []), ...campSteps]) {
    if (isObject(step) && step.kind === 'check' && isText(step.checkId) && !runBy.has(step.checkId)) runBy.set(step.checkId, step.icon);
  }
  for (const [i, check] of checks.entries()) {
    const at = `${where}, check "${label(check, `#${i + 1}`)}"`;
    notes.push(...noteNotes(at, check), ...optionNotes(at, check, ctx.options), ...onHitNotes(at, check.onHit), ...terrainChanceNotes(at, check, runBy.get(check.id)), ...alsoWhenNotes(at, check.alsoWhen, ctx), ...onlyWhenNotes(at, check), ...routeTypeNotes(at, check, ctx), ...partyModifierNotes(at, check.modifiers));
    // of-4 (G-100): a modifier may sit behind an option, checked as a check's own onlyWithOption is.
    for (const [j, m] of (Array.isArray(check.modifiers) ? check.modifiers : []).entries()) notes.push(...optionNotes(`${at}, modifier ${j + 1}`, m, ctx.options));
    if (isObject(check.chance) && check.chance.die !== undefined && !(isText(check.chance.die) && DIE.test(check.chance.die.trim()))) notes.push(`${at}: chance.die should be a die like "d6".`);
  }
  if (mode.chanceDie !== undefined && !(isText(mode.chanceDie) && DIE.test(mode.chanceDie.trim()))) notes.push(`${where}: chanceDie should be a die like "d6" (terrain faces with no die of their own use it).`);
  notes.push(...movementNotes(`${where} movement`, mode.movement));
  notes.push(...terrainNotes(where, mode));
  notes.push(...campNotes(where, mode, ctx, own));
  for (const [i, activity] of (Array.isArray(mode.activities) ? mode.activities : []).entries()) {
    if (isObject(activity)) notes.push(...activityNotes(`${where}, activity "${label(activity, `#${i + 1}`)}"`, activity, ctx, own));
  }
  if (mode.weather !== undefined) notes.push(...weatherNotes(`${where} weather`, mode.weather, ctx));
  return notes;
}

function weatherNotes(where, weather, ctx) {
  if (!isObject(weather)) return [`${where}: weather should be an object.`];
  const notes = [...noteNotes(where, weather), ...optionNotes(where, weather, ctx.options)];
  if (weather.option !== undefined) notes.push(`${where}: option is the old name; write onlyWithOption: "${weather.option}".`);
  if (weather.rollEvery !== undefined && !isEvery(weather.rollEvery)) notes.push(`${where}: rollEvery should be { value: <number>, unit: "day" }.`);
  return notes;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Everything G-07 says about one rules set: its exploration modes and the rules-set sections beside them. */
export function explorationNotes(rules, where, file) {
  const notes = [];
  const exploration = isObject(rules.exploration) ? rules.exploration : null;
  const modes = exploration && Array.isArray(exploration.modes) ? exploration.modes.filter(isObject) : [];
  // Route and terrain ids across every mode in the pack, for alsoWhen (another rules set's modes count too).
  const allModes = (Array.isArray(file.rulesSets) ? file.rulesSets : []).filter(isObject)
    .flatMap((r) => (isObject(r.exploration) && Array.isArray(r.exploration.modes) ? r.exploration.modes.filter(isObject) : []));
  const idsOf = (entries) => new Set(entries.filter(isObject).map((e) => e.id).filter(isText));
  const ctx = {
    options: optionsById(file),
    routeIds: idsOf(allModes.flatMap((m) => (isObject(m.movement) && Array.isArray(m.movement.routes) ? m.movement.routes : []))),
    terrainIds: idsOf(allModes.flatMap((m) => (Array.isArray(m.terrain) ? m.terrain : []))),
    itemIds: idsOf(Array.isArray(file.items) ? file.items : []),
    itemsById: new Map((Array.isArray(file.items) ? file.items : []).filter((e) => isObject(e) && isText(e.id)).map((e) => [e.id, e])),
    modeIds: new Set(modes.map((m) => m.id).filter(isText)),
    modesById: new Map(modes.filter((m) => isText(m.id)).map((m) => [m.id, m])),
    seasonIds: new Set((Array.isArray(rules.seasons) ? rules.seasons : []).filter(isObject).map((s) => s.id).filter(isText)),
  };
  if (isObject(rules.time) && rules.time.turnsPerHour !== undefined && !(isWhole(rules.time.turnsPerHour) && rules.time.turnsPerHour > 0)) {
    notes.push(`${where}: time.turnsPerHour should be a whole number of 1 or more.`);
  } else if (isObject(rules.time) && isWhole(rules.time.turnsPerHour) && typeof rules.time.turnMinutes === 'number' && rules.time.turnMinutes * rules.time.turnsPerHour !== 60) {
    // Engine ruling 9 (2026-10-29): turnsPerHour wins, so the app's hour isn't 60 minutes here.
    const minutes = rules.time.turnMinutes * rules.time.turnsPerHour;
    notes.push(`${where}: time.turnMinutes × time.turnsPerHour is ${rules.time.turnMinutes} × ${rules.time.turnsPerHour} = ${minutes} minutes, not 60; turnsPerHour wins, so the app's hour is ${minutes} minutes.`);
  }
  if (exploration) {
    notes.push(...noteNotes(`${where} exploration`, exploration));
    for (const mode of modes) notes.push(...modeNotes(where, mode, ctx));
  }
  if (rules.weather !== undefined) notes.push(...weatherNotes(`${where} weather`, rules.weather, ctx));
  for (const [i, season] of (Array.isArray(rules.specialSeasons) ? rules.specialSeasons : []).entries()) {
    if (!isObject(season)) continue;
    const at = `${where}, special season "${label(season, `#${i + 1}`)}"`;
    if (season.encounterSwaps !== undefined) notes.push(`${at}: encounterSwaps is the old name; write encounterSwap: { chance: { die, on: [..] }, tableId } (one swap).`);
    const swap = season.encounterSwap;
    if (swap !== undefined) {
      const chanceOk = isObject(swap) && isObject(swap.chance) && isText(swap.chance.die) && Array.isArray(swap.chance.on) && swap.chance.on.every(isWhole);
      if (!chanceOk || !isText(swap.tableId)) notes.push(`${at}: encounterSwap should be { chance: { die: "d6", on: [1, 2] }, tableId: "<table id>" }.`);
    }
    if (season.weatherFrom !== undefined && ctx.seasonIds.size > 0 && !ctx.seasonIds.has(season.weatherFrom)) notes.push(`${at}: weatherFrom "${season.weatherFrom}" isn't a season.`);
  }
  if (isObject(rules.daylight) && rules.daylight.byMonth !== undefined) {
    const rows = rules.daylight.byMonth;
    if (!Array.isArray(rows) || rows.some((r) => !isObject(r) || !isText(r.month) || !HHMM.test(String(r.sunrise)) || !HHMM.test(String(r.sunset)))) {
      notes.push(`${where}: daylight.byMonth should be a list like [{ "month": "<name>", "sunrise": "06:30", "sunset": "19:45" }].`);
    }
  }
  if (rules.wildEncounters !== undefined) {
    const wild = rules.wildEncounters;
    if (!isObject(wild)) notes.push(`${where}: wildEncounters should be an object (07, Exploration).`);
    else {
      for (const key of Object.keys(wild).filter((k) => !WILD_KEYS.includes(k))) notes.push(`${where}: wildEncounters.${key} isn't a field 07 knows; it's kept but not read.`);
      for (const key of ['commonTables', 'regionalTables']) {
        if (wild[key] !== undefined && !(isObject(wild[key]) && Object.values(wild[key]).every(isText))) notes.push(`${where}: wildEncounters.${key} should map names to table ids.`);
      }
      for (const key of ['lairChance', 'lairMultiplier']) if (wild[key] !== undefined && typeof wild[key] !== 'number') notes.push(`${where}: wildEncounters.${key} should be a number.`);
    }
  }
  notes.push(...dungeonExitNotes(where, rules.dungeonExit, ctx));
  return notes;
}

/** `rulesSets[].dungeonExit` (D24, ruled 2026-10-29). */
function dungeonExitNotes(where, exit, ctx) {
  if (exit === undefined) return [];
  const shape = 'dungeonExit should be { roll?: { save | check }, modifiers?, depth?, onFail?: { table }, safePaths? } (without a roll, safePaths)';
  if (!isObject(exit)) return [`${where}: ${shape}.`];
  const notes = [...optionNotes(`${where} dungeonExit`, exit, ctx.options)];
  const roll = exit.roll;
  // of-5 (G-104): without a roll, the rule offers Use safe paths only, so it needs its safePaths note and no onFail.
  if (roll === undefined || roll === null) {
    if (!isText(exit.safePaths)) notes.push(`${where}: dungeonExit has no roll, so it offers only Use safe paths; give it safePaths (the pack's note on using them), or a roll.`);
    return notes;
  }
  if (!isObject(roll) || (isText(roll.save) ? 1 : 0) + (isText(roll.check) ? 1 : 0) !== 1) notes.push(`${where}: dungeonExit.roll should be { save: "<save id>" } or { check: "<check id>" } (one of them).`);
  if (exit.modifiers !== undefined && !(Array.isArray(exit.modifiers) && exit.modifiers.every((m) => isObject(m) && isText(m.id) && isText(m.name) && typeof m.value === 'number'))) {
    notes.push(`${where}: dungeonExit.modifiers should be a list like [{ "id": "map", "name": "Has a map", "value": 2 }].`);
  }
  if (exit.depth !== undefined && !(isObject(exit.depth) && typeof exit.depth.per === 'number' && exit.depth.per > 0 && typeof exit.depth.value === 'number')) {
    notes.push(`${where}: dungeonExit.depth should be { per: <levels>, value: <number added per that many levels> }.`);
  }
  if (!isObject(exit.onFail) || !isText(exit.onFail.table)) notes.push(`${where}: dungeonExit.onFail should be { table: "<table id>" }.`);
  if (exit.safePaths !== undefined && !isText(exit.safePaths)) notes.push(`${where}: dungeonExit.safePaths should be a note.`);
  return notes;
}

/** Counts for the checker's summary. */
export function explorationCounts(file) {
  const rulesSets = Array.isArray(file.rulesSets) ? file.rulesSets.filter(isObject) : [];
  const modes = rulesSets.flatMap((r) => (isObject(r.exploration) && Array.isArray(r.exploration.modes) ? r.exploration.modes.filter(isObject) : []));
  const checks = modes.flatMap((m) => (Array.isArray(m.checks) ? m.checks.filter(isObject) : []));
  return {
    'exploration modes': modes.length,
    'byTerrain checks naming terrainChance': checks.filter((c) => c.byTerrain === true && c.terrainChance !== undefined).length,
    'exploration activities': modes.reduce((n, m) => n + (Array.isArray(m.activities) ? m.activities.length : 0), 0),
    'rules sets with dungeonExit': rulesSets.filter((r) => r.dungeonExit !== undefined).length,
  };
}
