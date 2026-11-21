import { describe, expect, it } from 'vitest';
import { describeEntry, groupEntries, type LogEvent, type LogNames } from './events.ts';

const names: LogNames = {
  me: 'user-sam',
  people: new Map([
    ['user-sam', 'Sam'],
    ['user-priya', 'Priya'],
    ['user-jo', 'Jo'],
  ]),
  characters: new Map([
    ['actor-wren', 'Wren'],
    ['actor-ash', 'Ash'],
  ]),
  companies: new Map([['company-reed', 'The Reed Cutters']]),
  fields: new Map([['field-might', 'Might']]),
  packs: new Map([['link-river', 'River Rules']]),
  items: new Map([['line-lantern', 'Hooded lantern'], ['line-sack', 'Sack']]),
  places: new Map([['place-stash', 'Party stash']]),
};

let seq = 0;
function event(type: string, extra: Partial<LogEvent> = {}): LogEvent {
  seq += 1;
  return {
    id: `event-${seq}`,
    seq,
    type,
    level: 'simple',
    actorUserId: 'user-priya',
    targetTable: 'actors',
    targetId: 'actor-wren',
    before: null,
    after: null,
    fiat: false,
    reason: null,
    revertsEventId: null,
    requestId: `request-${seq}`,
    createdAt: '2026-10-20T18:30:00Z',
    ...extra,
  };
}
const say = (...events: LogEvent[]) => describeEntry(groupEntries(events)[0]!, names);

describe('log lines in plain words', () => {
  it('HP changes say the new value and the old one, and "You" for the person reading', () => {
    expect(say(event('character.setHp', { actorUserId: 'user-sam', before: { hp_current: 11 }, after: { hp_current: 9 } }))).toBe(
      "You set Wren's HP to 9 (was 11).",
    );
    expect(say(event('character.setHp', { before: { hp_current: null }, after: { hp_current: 13 } }))).toBe(
      "Priya set Wren's HP to 13 (was full).",
    );
  });

  // Purpose (eq-8): a form switch names the form, and the gear the switch took off in the same change (the request's
  // inventory events), by name when the log kept it, else by count; clearing the switch reads "the first form".
  it('a form switch names the form and what came off with it', () => {
    const play = { targetTable: 'character_play', requestId: 'req-form' };
    expect(say(event('character.setForm', { ...play, before: { form_id: null }, after: { form_id: 'dusk-phase', form_name: 'Dusk phase' } }))).toBe('Priya switched Wren to Dusk phase.');
    expect(
      say(
        event('character.setForm', { ...play, seq: 1, before: { form_id: null }, after: { form_id: 'dusk-phase', form_name: 'Dusk phase' } }),
        event('character.setForm', { ...play, seq: 2, targetTable: 'inventory_lines', targetId: 'line-1', before: { equipped: true, name: 'Iron coat' }, after: { equipped: false, name: 'Iron coat' } }),
        event('character.setForm', { ...play, seq: 3, targetTable: 'inventory_lines', targetId: 'line-2', before: { equipped: true, name: 'Reed shield' }, after: { equipped: false, name: 'Reed shield' } }),
      ),
    ).toBe('Priya switched Wren to Dusk phase (Iron coat and Reed shield came off and are carried).');
    expect(
      say(
        event('character.setForm', { ...play, seq: 1, before: { form_id: null }, after: { form_id: 'dusk-phase', form_name: 'Dusk phase' } }),
        event('character.setForm', { ...play, seq: 2, targetTable: 'inventory_lines', targetId: 'line-1', before: { equipped: true }, after: { equipped: false } }),
      ),
    ).toBe('Priya switched Wren to Dusk phase (1 item came off and is carried).');
    expect(say(event('character.setForm', { ...play, before: { form_id: 'dusk-phase', form_name: 'Dusk phase' }, after: { form_id: null, form_name: null } }))).toBe('Priya switched Wren to the first form.');
  });

  it('an AC set by hand says the number, and clearing it says what it was (ruled 2026-10-29)', () => {
    const play = { targetTable: 'character_play' };
    expect(say(event('character.setAc', { ...play, before: { ac_override: null }, after: { ac_override: -2 } }))).toBe("Priya set Wren's AC to −2 by hand.");
    expect(say(event('character.setAc', { ...play, before: { ac_override: 14 }, after: { ac_override: null } }))).toBe("Priya cleared Wren's AC set by hand (was 14).");
    expect(say(event('character.setAc', { ...play, before: null, after: { ac_override: 0 } }))).toBe("Priya set Wren's AC to 0 by hand.");
  });

  // Purpose: the magic state's log lines (dec-8 piece A) say what was chosen for the next rest, which spell was cast or
  // given back (by name when the reader's screen knows it, by level when not), and that the GM changed the spells.
  it("magic: choosing for the next rest, Same as yesterday, a cast, its Undo and the GM's change each say what happened", () => {
    const play = { targetTable: 'character_play' };
    const withSpells: LogNames = { ...names, spells: new Map([['mire-lamp', 'Mire lamp']]) };
    const sayS = (...events: LogEvent[]) => describeEntry(groupEntries(events)[0]!, withSpells);
    expect(say(event('character.chooseSpells', { ...play, before: { chosen: null }, after: { chosen: [{ spell: 'a', level: 1 }, { spell: 'b', level: 1 }] } }))).toBe(
      "Priya chose 2 spells for Wren's next rest.",
    );
    expect(say(event('character.chooseSpells', { ...play, before: { chosen: [] }, after: { chosen: null } }))).toBe("Priya cleared Wren's spells chosen for the next rest.");
    expect(say(event('character.sameAsYesterday', { ...play, before: { chosen: null }, after: { chosen: [] } }))).toBe("Priya chose the same spells as yesterday for Wren's next rest.");
    expect(sayS(event('character.castSpell', { ...play, before: { spells_cast: {} }, after: { spells_cast: { '1:mire-lamp': 1 } } }))).toBe('Priya cast Mire lamp for Wren.');
    expect(say(event('character.castSpell', { ...play, before: { spells_cast: { '2:fog-ring': 1 } }, after: { spells_cast: { '2:fog-ring': 2 } } }))).toBe('Priya cast a level 2 spell for Wren.');
    expect(sayS(event('character.uncastSpell', { ...play, before: { spells_cast: { '1:mire-lamp': 1 } }, after: { spells_cast: {} } }))).toBe('Priya took back a cast of Mire lamp for Wren.');
    expect(sayS(event('character.pin', { ...play, before: { pins: [] }, after: { pins: [{ kind: 'spell', key: 'mire-lamp' }] } }))).toBe('Priya pinned Mire lamp to At hand for Wren.');
    // An ability or a trait is pinned to the Player tab's list, not At hand (euf-2, euf-3), and its key is its name.
    expect(say(event('character.pin', { ...play, before: { pins: [] }, after: { pins: [{ kind: 'trait', key: 'Night eyes' }] } }))).toBe('Priya pinned Night eyes for Wren.');
    expect(say(event('character.pin', { ...play, before: { pins: [{ kind: 'trait', key: 'Night eyes' }] }, after: { pins: [] } }))).toBe('Priya unpinned Night eyes for Wren.');
    // A move in the player's order (euf-4; its own command, the detailed log) names the pin that was moved, and which
    // way, the review's finding 1 on #23: never a neighbour it passed.
    const three = [{ kind: 'trait', key: 'Night eyes' }, { kind: 'trait', key: 'Fen sight' }, { kind: 'trait', key: 'Horn charge' }];
    expect(say(event('character.movePin', { ...play, before: { pins: three }, after: { pins: [three[2], three[0], three[1]] } }))).toBe("Priya moved Horn charge up in Wren's pins.");
    expect(say(event('character.movePin', { ...play, before: { pins: three }, after: { pins: [three[1], three[2], three[0]] } }))).toBe("Priya moved Night eyes down in Wren's pins.");
    // Moved by one place it and its neighbour swap, and the lists can't say which was moved: both are named.
    expect(say(event('character.movePin', { ...play, before: { pins: three }, after: { pins: [three[0], three[2], three[1]] } }))).toBe("Priya swapped Horn charge and Fen sight in Wren's pins.");
    expect(say(event('character.setSpells', { ...play, before: { prepared: [] }, after: { prepared: [{ spell: 'a', level: 1 }] } }))).toBe("Priya changed Wren's spells.");
  });

  it('an undo says what was put back', () => {
    expect(say(event('event.undo', { actorUserId: 'user-sam', before: { hp_current: 10 }, after: { hp_current: 11 }, revertsEventId: 'event-x' }))).toBe(
      "You undid a change to Wren's HP (back to 11).",
    );
    expect(say(event('event.undo', { before: { approval: 'approved' }, after: { approval: 'pending' }, revertsEventId: 'event-y' }))).toBe(
      "Priya undid a change to Wren's approval.",
    );
    expect(say(event('event.undo', { targetTable: 'campaigns', before: { name: 'B' }, after: { name: 'A' }, revertsEventId: 'event-z' }))).toBe(
      'Priya undid a change to the campaign.',
    );
  });

  it('notes say who wrote one and what about; edits are plain', () => {
    expect(say(event('note.add', { actorUserId: 'user-sam', targetTable: 'notes', targetId: 'note-1', after: { text: 'Hi', about_actor_id: 'actor-ash' } }))).toBe(
      'You wrote a note about Ash.',
    );
    expect(say(event('note.add', { targetTable: 'notes', targetId: 'note-2', after: { text: 'Hi', about_actor_id: null } }))).toBe('Priya wrote a note.');
    expect(say(event('note.edit', { targetTable: 'notes', targetId: 'note-2', before: { text: 'Hi' }, after: { text: 'Hello' } }))).toBe('Priya edited a note.');
  });

  it('a name ending in s takes just an apostrophe', () => {
    const wardens = { ...names, characters: new Map([['actor-wren', 'Wren of the Wardens']]) };
    const line = groupEntries([event('character.setHp', { before: { hp_current: 2 }, after: { hp_current: 1 } })])[0]!;
    expect(describeEntry(line, wardens)).toBe("Priya set Wren of the Wardens' HP to 1 (was 2).");
  });

  it('approving, sending back and editing a character', () => {
    expect(say(event('character.review', { before: { approval: 'pending' }, after: { approval: 'approved' } }))).toBe('Priya approved Wren.');
    // Purpose (final drafts D): an approval that allowed exceptions says which, in its log line.
    expect(say(event('character.review', { before: { approval: 'pending' }, after: { approval: 'approved', review_note: 'Allowed: Croak and Starting coin 190' } }))).toBe('Priya approved Wren, allowing Croak and Starting coin 190.');
    expect(say(event('character.review', { before: { approval: 'pending' }, after: { approval: 'rejected', review_note: 'More backstory' } }))).toBe(
      'Priya sent Wren back.',
    );
    expect(say(event('character.edit', { actorUserId: 'user-jo', targetId: 'actor-ash', before: { notes: '', level: 2 }, after: { notes: 'Hi', level: 3 } }))).toBe(
      "Jo edited Ash's level and notes.",
    );
  });

  // M5b step 0c: an alignment change is its own row (the character's line still), the spell book, and Ask the GM to allow it.
  it('words an alignment change and a spell book set', () => {
    expect(say(event('character.edit', { actorUserId: 'user-jo', targetTable: 'character_alignments', targetId: 'actor-ash', before: { alignment: 'Reed' }, after: { alignment: 'Mire' } }))).toBe(
      "Jo edited Ash's alignment.",
    );
    expect(say(event('creation.spellBook.set', { actorUserId: 'user-jo', targetId: 'actor-ash', before: { spell_book: [] }, after: { spell_book: ['glimmer'] } }))).toBe("Jo set Ash's spell book.");
  });

  // G-208: a change to the expertise points names them in the log, not a bare "edited".
  it('words an expertise change', () => {
    expect(say(event('character.edit', { actorUserId: 'user-jo', targetId: 'actor-ash', before: { expertise: {} }, after: { expertise: { 'work-locks': 1 } } }))).toBe("Jo edited Ash's expertise.");
  });

  it("uses the name kept in a deleted or renamed thing's record", () => {
    expect(say(event('character.delete', { targetId: 'actor-gone', before: { name: 'Old Tobin' }, after: null }))).toBe('Priya deleted Old Tobin for good.');
    expect(say(event('company.rename', { targetTable: 'companies', targetId: 'company-reed', before: { name: 'The Reeds' }, after: { name: 'The Reed Cutters' } }))).toBe(
      'Priya renamed the company The Reeds to The Reed Cutters.',
    );
  });

  it('companies, fields and the campaign', () => {
    expect(say(event('character.assignCompany', { before: { company_id: null }, after: { company_id: 'company-reed' } }))).toBe(
      'Priya put Wren in The Reed Cutters.',
    );
    expect(say(event('character.assignCompany', { before: { company_id: 'company-reed' }, after: { company_id: null } }))).toBe(
      'Priya took Wren out of The Reed Cutters.',
    );
    expect(say(event('field.update', { targetTable: 'field_definitions', targetId: 'field-might', before: { hidden: false }, after: { hidden: true } }))).toBe(
      'Priya hid the field Might.',
    );
    expect(say(event('campaign.update', { targetTable: 'campaigns', before: { name: 'The Ash Barrows' }, after: { name: 'The Drowned Marches' } }))).toBe(
      'Priya renamed the campaign to The Drowned Marches.',
    );
    expect(say(event('campaign.retire', { targetTable: 'campaigns', before: { retired_at: null }, after: { retired_at: '2026-10-22T09:00:00Z' } }))).toBe(
      'Priya retired the campaign.',
    );
    expect(say(event('campaign.restore', { targetTable: 'campaigns', before: { retired_at: '2026-10-22T09:00:00Z' }, after: { retired_at: null } }))).toBe(
      'Priya brought the campaign back.',
    );
    expect(say(event('invite.redeem', { actorUserId: 'user-jo', targetTable: 'invites' }))).toBe('Jo joined the campaign.');
  });

  it('everything one action did reads as one line, led by its main change', () => {
    // Approving a first character also makes it the player's active one.
    const request = 'request-approve';
    const lines = groupEntries([
      event('character.review', { requestId: request, before: { approval: 'pending' }, after: { approval: 'approved' } }),
      event('character.review', { requestId: request, targetTable: 'members', targetId: 'member-1', before: { active_actor_id: null }, after: { active_actor_id: 'actor-wren' } }),
    ]);
    expect(lines).toHaveLength(1);
    expect(describeEntry(lines[0]!, names)).toBe('Priya approved Wren.');
  });

  // The ruleKey group words (07). An attach or detach that also pins or clears a pick writes two events with one
  // requestId: the campaign_packs link and the campaigns settings row.
  const link = { targetTable: 'campaign_packs', targetId: 'link-river' };
  const settingsWrite = (type: string, before: Record<string, string>, after: Record<string, string>, requestId: string) =>
    event(type, { targetTable: 'campaigns', targetId: 'campaign-1', before: { settings: { ruleGroups: before } }, after: { settings: { ruleGroups: after } }, requestId });

  // KNOWN BUG (reported, not fixed here): 'campaigns' is in MAIN_TABLES and 'campaign_packs' is not, so the campaigns
  // event leads the line and the pack's name (on the link event) is lost: "added the setting rules setting rules".
  it('an attach that pins a pick says the pack by name and that a new choice waits', () => {
    expect(
      say(event('rules.attach', { ...link, after: { pack_id: 'pack-river', pack_name: 'River Rules' }, requestId: 'req-a' }), settingsWrite('rules.attach', {}, { 'item-load': 'pack-fen' }, 'req-a')),
    ).toBe('Priya added the setting rules River Rules; a new choice for item load waits for you.');
  });

  it('a detach that clears a pick says the pack by name and that the choice falls back', () => {
    expect(
      say(
        event('rules.detach', { ...link, before: { pack_id: 'pack-river', pack_name: 'River Rules' }, after: null, requestId: 'req-b' }),
        settingsWrite('rules.detach', { 'item-load': 'pack-river' }, {}, 'req-b'),
      ),
    ).toBe('Priya removed the setting rules River Rules from the campaign; the choice for item load falls back to the next pack.');
  });

  it("the GM's own pick is told as a choice of which pack's rule the campaign uses", () => {
    expect(
      say(event('campaign.update', { targetTable: 'campaigns', before: { settings: { ruleGroups: { 'item-load': 'pack-fen' } } }, after: { settings: { ruleGroups: { 'item-load': 'pack-zine' } } } })),
    ).toBe("Priya chose which pack's item load rule the campaign uses.");
  });

  // The caller (mc-76; S12): kept in the campaign's settings, so its change is a campaign.update that names the caller.
  it("a change of caller in the campaign's settings says who is the caller now, or that there is none", () => {
    expect(say(event('campaign.update', { targetTable: 'campaigns', before: { settings: {} }, after: { settings: { caller: 'actor-wren' } } }))).toBe('Priya made Wren the caller.');
    expect(say(event('campaign.update', { targetTable: 'campaigns', before: { settings: { caller: 'actor-wren' } }, after: { settings: { caller: null } } }))).toBe('Priya set no caller.');
  });

  // Purpose: one optional-rules change that moves two packs (an add-on switched off with its parent, A1) and the load
  // method (A3) is one line naming both packs and the new method.
  it('an optional-rules change over two packs and the load method says both', () => {
    const links = [
      event('rules.setOptions', { targetTable: 'campaign_packs', targetId: 'link-river', before: { pack_name: 'River Rules', option_choices: {} }, after: { pack_name: 'River Rules', option_choices: { a: 'b' } }, requestId: 'req-o' }),
      event('rules.setOptions', { targetTable: 'campaign_packs', targetId: 'link-reed', before: { pack_name: 'Reed Zine', option_choices: {} }, after: { pack_name: 'Reed Zine', option_choices: { c: 'off' } }, requestId: 'req-o' }),
      event('rules.setOptions', { targetTable: 'campaigns', targetId: 'campaign-1', before: { settings: { encumbrance: { mode: 'none' } } }, after: { settings: { encumbrance: { mode: 'slot' } } }, requestId: 'req-o' }),
    ];
    expect(say(...links)).toBe('Priya changed the optional rules of River Rules and Reed Zine; the load method is now Slots.');
  });

  it('setting rules: added, optional rules changed (and undone), removed, and deleted from the library, by name', () => {
    const link = { targetTable: 'campaign_packs', targetId: 'link-river' };
    expect(say(event('rules.attach', { ...link, after: { pack_id: 'pack-river', pack_name: 'River Rules' } }))).toBe('Priya added the setting rules River Rules.');
    expect(say(event('rules.setOptions', { ...link, before: { option_choices: {} }, after: { option_choices: { x: 'y' } } }))).toBe(
      'Priya changed the optional rules of River Rules.',
    );
    expect(say(event('event.undo', { ...link, before: { option_choices: { x: 'y' } }, after: { option_choices: {} }, revertsEventId: 'event-r' }))).toBe(
      'Priya undid a change to the optional rules of River Rules.',
    );
    expect(say(event('rules.reorder', { ...link, before: { priority: 1 }, after: { priority: 2 } }))).toBe('Priya moved the setting rules River Rules up.');
    expect(say(event('rules.reorder', { ...link, before: { priority: 2 }, after: { priority: 1 } }))).toBe('Priya moved the setting rules River Rules down.');
    expect(say(event('event.undo', { ...link, before: { priority: 2 }, after: { priority: 1 }, revertsEventId: 'event-m' }))).toBe(
      'Priya undid a change to the order of the setting rules.',
    );
    expect(say(event('rules.prefer', { ...link, before: { overrides: {} }, after: { overrides: { 'class:warden': 'Lantern Warden' } } }))).toBe(
      'Priya chose River Rules for Lantern Warden, whatever the order.',
    );
    expect(say(event('rules.prefer', { ...link, before: { overrides: { 'class:warden': 'Lantern Warden' } }, after: { overrides: {} } }))).toBe(
      'Priya let the order of the setting rules decide Lantern Warden again.',
    );
    const brew = { targetTable: 'library_entries', targetId: 'entry-1' };
    expect(say(event('homebrew.save', { ...brew, before: null, after: { name: 'Bog lurker', data: { name: 'Bog lurker' } } }))).toBe(
      'Priya added Bog lurker to the campaign’s homebrew.',
    );
    expect(say(event('homebrew.save', { ...brew, before: { data: { name: 'Rope', weightCoin: 50 } }, after: { data: { name: 'Rope', weightCoin: 40 } } }))).toBe(
      'Priya changed Rope in the campaign’s homebrew.',
    );
    expect(say(event('event.undo', { ...brew, before: { data: { name: 'Rope' } }, after: { data: { name: 'Rope' } }, revertsEventId: 'event-h' }))).toBe(
      'Priya undid a change to Rope in the campaign’s homebrew.',
    );
    expect(say(event('homebrew.delete', { ...brew, before: { name: 'Rope' }, after: null }))).toBe('Priya removed Rope from the campaign’s homebrew.');
    expect(say(event('rules.homebrew', { ...link, after: { pack_id: 'pack-home', pack_name: 'The Delve homebrew' } }))).toBe('Priya started the campaign’s homebrew.');
    expect(say(event('rules.detach', { ...link, before: { pack_id: 'pack-river', pack_name: 'River Rules' }, after: null }))).toBe(
      'Priya removed the setting rules River Rules from the campaign.',
    );
    // Once deleted, the pack's name comes only from the record of the link.
    expect(say(event('library.delete', { targetTable: 'campaign_packs', targetId: 'link-gone', before: { pack_id: 'pack-gone', pack_name: 'Marsh Rules' }, after: null }))).toBe(
      'Priya deleted the setting rules Marsh Rules from their library, so they’re no longer in this campaign.',
    );
    expect(say(event('library.delete', { actorUserId: 'user-sam', targetTable: 'campaign_packs', targetId: 'link-gone', before: { pack_name: 'Marsh Rules' }, after: null }))).toBe(
      'You deleted the setting rules Marsh Rules from your library, so they’re no longer in this campaign.',
    );
  });

  it('a change made outside the app still gets a plain line, and the reader is told who', () => {
    expect(say(event('actors.update', { before: { notes: '' }, after: { notes: 'x' } }))).toBe('Priya changed Wren.');
    expect(say(event('actors.update', { actorUserId: null, before: { notes: '' }, after: { notes: 'x' } }))).toBe('Wren was changed.');
  });

  it('newest first, keeping each action together', () => {
    const lines = groupEntries([
      event('character.setHp', { before: { hp_current: 5 }, after: { hp_current: 4 } }),
      event('character.setHp', { before: { hp_current: 4 }, after: { hp_current: 3 } }),
    ]);
    expect(lines.map((line) => line.main.seq)).toEqual([...lines.map((line) => line.main.seq)].sort((a, b) => b - a));
  });
});

describe('inventory lines in the log (M4)', () => {
  const line = (type: string, extra: Partial<LogEvent>) => describeEntry(groupEntries([event(type, { targetTable: 'inventory_lines', targetId: 'line-lantern', ...extra })])[0]!, names);

  it('says what was got, for whom, and how; a purchase notes its cost until purses arrive', () => {
    expect(line('inventory.add', { after: { name: 'Hooded lantern', qty: 1, how_got: 'bought', cost: '10 gp', actor_id: 'actor-wren', location_id: null } })).toBe(
      'Priya bought Hooded lantern for Wren (10 gp). Cost noted; purses arrive later.',
    );
    expect(line('inventory.add', { after: { name: 'Rope', qty: 2, how_got: 'found', approval: 'approved', actor_id: null, location_id: 'place-stash' } })).toBe('Priya added Rope ×2 to the Party stash (no cost).');
    expect(line('inventory.add', { after: { name: 'Glow wand', qty: 1, how_got: 'given', notes: 'From the drowned shrine', actor_id: 'actor-wren', location_id: null } })).toBe('Priya gave Wren Glow wand: From the drowned shrine.');
    expect(line('inventory.add', { after: { name: 'Lucky pebble', qty: 1, how_got: 'found', approval: 'pending', actor_id: 'actor-wren', location_id: null } })).toBe('Priya made Lucky pebble for Wren, waiting for the GM.');
  });

  // Purpose: picking magic armour's base reads as a plain line, and when the base took the armour off (bq3-8) the
  // same line says it came off, is carried, and why.
  it('says a base was picked, and when the armour came off with it, why', () => {
    expect(line('inventory.setBaseArmour', { before: { base_armour_id: null }, after: { base_armour_id: 'reed-coat' } })).toBe('Priya picked the base armour for Hooded lantern.');
    expect(line('inventory.setBaseArmour', { before: { base_armour_id: null, equipped: true }, after: { base_armour_id: 'reed-coat', equipped: false } })).toBe(
      "Priya picked the base armour for Hooded lantern. It came off and is carried: the class can't wear that base.",
    );
  });

  // Purpose (Design on #552): use one up says what happened, by the item's kind, never "dropped" for a drink: the last
  // one from the log's copy of the line, a count down from the line as it is now.
  it('says what item.use did: drank the last one, fired one of a stack, used one of an unknown kind', () => {
    expect(line('item.use', { before: { name: 'Moss draught', qty: 1, category: 'potion', item_data: {}, stack: 1 }, after: null })).toBe('Priya drank the last Moss draught.');
    const kinds = { ...names, itemKinds: new Map([['line-lantern', { category: 'ammunition', details: { unitName: 'reed arrow' }, stack: 20 }]]) };
    const said = (extra: Partial<LogEvent>, n = names) => describeEntry(groupEntries([event('item.use', { targetTable: 'inventory_lines', targetId: 'line-lantern', ...extra })])[0]!, n);
    expect(said({ before: { qty: 18 }, after: { qty: 17 } }, kinds)).toBe('Priya fired a reed arrow, 17 left.');
    expect(said({ before: { qty: 3 }, after: { qty: 2 } })).toBe('Priya used Hooded lantern, 2 left.');
    expect(said({ before: { qty: 3 }, after: { qty: 2 } })).not.toContain('dropped');
  });

  // Purpose (Design on #569): a weapon's chosen mode reads "Short bow: silver arrows" by the mode's name in the pack (or
  // "Priya changed how Hooded lantern is used." when the item doesn't list it, never the id; Design, 2026-11-10), and a
  // last use that cleared the mode says so.
  it('says which mode a weapon was set to, and when a last use cleared it', () => {
    const bow = { weapon: { modes: { button: 'quiver', list: [{ id: 'bone', name: 'Bone-tipped arrows' }] } } };
    const kinds = { ...names, itemKinds: new Map([['line-lantern', { category: 'weapon', details: bow, stack: 1 }]]) };
    const chose = (after: Record<string, unknown>) =>
      describeEntry(groupEntries([event('item.setMode', { targetTable: 'inventory_lines', targetId: 'line-lantern', before: { mode_id: null }, after })])[0]!, kinds);
    expect(chose({ mode_id: 'bone' })).toBe('Priya chose Hooded lantern: bone-tipped arrows.');
    // A mode the line's copy doesn't list (one that came from the pack entry only) never shows its id (Design, 2026-11-10).
    expect(chose({ mode_id: 'ember' })).toBe('Priya changed how Hooded lantern is used.');
    const entryOnly = { ...names, itemKinds: new Map([['line-lantern', { category: 'weapon', details: {}, stack: 1 }]]) };
    const fromEntry = describeEntry(groupEntries([event('item.setMode', { targetTable: 'inventory_lines', targetId: 'line-lantern', before: { mode_id: null }, after: { mode_id: 'thrown-far' } })])[0]!, entryOnly);
    expect(fromEntry).toBe('Priya changed how Hooded lantern is used.');
    expect(fromEntry).not.toContain('thrown-far');
    expect(chose({ mode_id: null })).toBe('Priya chose Hooded lantern: nothing.');
    const lastUse = describeEntry(
      groupEntries([
        event('item.use', { id: 'e1', seq: 1, requestId: 'r1', targetTable: 'inventory_lines', targetId: 'line-arrows', before: { name: 'Bone-tipped arrows', qty: 1, category: 'ammunition', item_data: {}, stack: 20 }, after: null }),
        event('item.use', { id: 'e2', seq: 2, requestId: 'r1', targetTable: 'inventory_lines', targetId: 'line-bow', before: { mode_id: 'bone' }, after: { name: 'Reed bow', mode_id: null } }),
      ])[0]!,
      names,
    );
    expect(lastUse).toBe('Priya fired the last Bone-tipped arrows. Reed bow: nothing chosen.');
  });

  it('says what was used up, counted, equipped and moved, by the item’s name', () => {
    expect(line('inventory.remove', { before: { name: 'Hooded lantern', qty: 1, actor_id: 'actor-wren', location_id: null }, after: null })).toBe("Priya dropped Hooded lantern from Wren's pack.");
    expect(line('inventory.remove', { before: { qty: 6 }, after: { qty: 4 } })).toBe('Priya dropped 2 of Hooded lantern (4 left).');
    expect(line('inventory.setQty', { level: 'verbose', before: { qty: 3 }, after: { qty: 2 } })).toBe('Priya set Hooded lantern to 2 (was 3).');
    expect(line('inventory.equip', { before: { equipped: false }, after: { equipped: true } })).toBe('Priya equipped Hooded lantern.');
    expect(line('inventory.pin', { before: { pinned: false }, after: { pinned: true } })).toBe('Priya pinned Hooded lantern to At hand.');
    expect(line('inventory.atHand', { level: 'verbose', before: { at_hand_hidden: false }, after: { at_hand_hidden: true } })).toBe('Priya hid Hooded lantern from At hand.');
    expect(line('inventory.atHand', { level: 'verbose', before: { at_hand_hidden: true }, after: { at_hand_hidden: false } })).toBe('Priya showed Hooded lantern in At hand again.');
    expect(line('inventory.move', { before: { actor_id: 'actor-wren' }, after: { actor_id: 'actor-ash' } })).toBe('Priya moved Hooded lantern to Ash.');
    expect(line('inventory.move', { before: { container_line_id: null }, after: { container_line_id: 'line-sack' } })).toBe('Priya put Hooded lantern in Sack.');
  });

  it('moving part of a stack reads as one line, with the count that moved', () => {
    const request = { requestId: 'request-split' };
    const entries = groupEntries([
      event('inventory.move', { ...request, targetTable: 'inventory_lines', targetId: 'line-torch', before: { qty: 6 }, after: { qty: 4 } }),
      event('inventory.move', { ...request, targetTable: 'inventory_lines', targetId: 'line-new', before: null, after: { name: 'Torch', qty: 2, actor_id: 'actor-wren' } }),
      event('inventory.move', { ...request, targetTable: 'inventory_lines', targetId: 'line-new', before: { actor_id: 'actor-wren' }, after: { actor_id: 'actor-ash' } }),
    ]);
    expect(entries).toHaveLength(1);
    expect(describeEntry(entries[0]!, names)).toBe('Priya moved Torch ×2 to Ash.');
  });
});

describe('lights in the log (M5 step 7)', () => {
  const withLights: LogNames = { ...names, lights: new Map([['light-wren', { who: 'Wren', name: 'Rushlight' }], ['light-ash', { who: 'Ash', name: 'Reed lamp' }]]) };
  const sayL = (...events: LogEvent[]) => describeEntry(groupEntries(events)[0]!, withLights);
  const lit = { targetTable: 'character_lights', targetId: 'light-wren' };

  it('lighting, putting out, Keep lit and Refill name the light with its character', () => {
    expect(sayL(event('light.light', { ...lit, actorUserId: 'user-sam', before: { lit_at: null }, after: { lit_at: 0 } }))).toBe("You lit Wren's rushlight.");
    expect(sayL(event('light.douse', { ...lit, before: { lit_at: 0 }, after: { lit_at: null, left_seconds: 600 } }))).toBe("Priya put out Wren's rushlight.");
    expect(sayL(event('light.keepLit', { ...lit, before: { keep_lit: false }, after: { keep_lit: true } }))).toBe("Priya switched Keep lit on for Wren's rushlight.");
    expect(sayL(event('light.refill', { targetTable: 'character_lights', targetId: 'light-ash', before: { lit_at: null }, after: { lit_at: 2400 } }))).toBe("Priya refilled Ash's reed lamp.");
  });

  it("a burnout in the Simple log (the routine Next turn that caused it isn't shown) says what burnt out", () => {
    const requestId = 'request-burn';
    const used = event('light.burnOut', { targetTable: 'inventory_lines', targetId: 'line-rush', requestId, before: { qty: 2 }, after: { qty: 1 } });
    const out = event('light.burnOut', { ...lit, requestId, before: { lit_at: 0, out_at: null }, after: { lit_at: null, out_at: 3600 } });
    expect(sayL(used, out)).toBe("Wren's rushlight burnt out.");
    const relit = event('light.burnOut', { targetTable: 'character_lights', targetId: 'light-ash', requestId, before: { lit_at: 0 }, after: { lit_at: 2400 } });
    expect(sayL(used, out, relit)).toBe("Wren's rushlight burnt out. Keep lit lit another: Ash's reed lamp.");
  });

  it('a time move that burnt lights out joins them to its own line: "Ran out with the clock: …" (05, Set time…)', () => {
    const requestId = 'request-set';
    const clock = event('time.set', { targetTable: 'campaign_clocks', targetId: 'clock-1', requestId, before: { seconds: 0 }, after: { seconds: 4200 } });
    const out = event('light.burnOut', { ...lit, requestId, before: { lit_at: 0, out_at: null }, after: { lit_at: null, out_at: 3600 } });
    expect(sayL(clock, out)).toBe("Priya set the clock on 1 hour 10 minutes (a correction). Ran out with the clock: Wren's rushlight.");
    const turn = event('time.advance', { targetTable: 'campaign_clocks', targetId: 'clock-1', requestId: 'request-turn', before: { seconds: 3000 }, after: { seconds: 3600 } });
    const outToo = event('light.burnOut', { ...lit, requestId: 'request-turn', before: { lit_at: 0, out_at: null }, after: { lit_at: null, out_at: 3600 } });
    expect(sayL(turn, outToo)).toBe("Priya moved the clock on 10 minutes. Ran out with the clock: Wren's rushlight.");
    expect(sayL(event('time.advance', { targetTable: 'campaign_clocks', targetId: 'clock-1', before: { seconds: 0 }, after: { seconds: 600 } }))).toBe('Priya moved the clock on 10 minutes.');
  });

  // B13 (ruled 2026-11-01): the start time and the clock it moved make one line; a player who sees only the clock's
  // part still reads what it was.
  it('setting the start time says the time and that the clock moved with it', () => {
    const requestId = 'request-start';
    const setting = event('time.start', { targetTable: 'campaigns', targetId: 'campaign-1', requestId, before: { settings: {} }, after: { settings: { startTime: { hour: 7, minute: 30 } } } });
    const clock = event('time.start', { targetTable: 'campaign_clocks', targetId: 'clock-1', requestId, before: { seconds: 0 }, after: { seconds: 27000 } });
    expect(sayL(setting, clock)).toBe("Priya set the first day's start time to 07:30, and the clock with it.");
    expect(sayL(setting)).toBe("Priya set the first day's start time to 07:30.");
    expect(sayL(clock)).toBe("Priya set the first day's start time, and the clock with it.");
  });
});

describe('the town switches in the log (M5b step 6.0; sw-1 … sw-4)', () => {
  const town = { targetTable: 'campaigns', targetId: 'campaign-1' };
  const sayL = (...events: LogEvent[]) => describeEntry(groupEntries(events)[0]!, names);

  it("says the GM's flips, the morning's reset, and Start downtime's", () => {
    expect(say(event('town.outDay', { ...town, before: { out_day: false }, after: { out_day: true } }))).toBe('Priya switched Out and about today on.');
    expect(say(event('town.activeNight', { ...town, before: { active_night: true }, after: { active_night: false } }))).toBe('Priya switched Active tonight off.');
    // Purpose (sm-1): when turning one half on also turned the other off, the line says both; when the other was already off, it stays as before.
    expect(say(event('town.outDay', { ...town, before: { out_day: false, active_night: true }, after: { out_day: true, active_night: false } }))).toBe('Priya switched Out and about today on, and Active tonight off.');
    expect(say(event('town.activeNight', { ...town, before: { out_day: true, active_night: false }, after: { out_day: false, active_night: true } }))).toBe('Priya switched Active tonight on, and Out and about today off.');
    expect(say(event('town.outDay', { ...town, before: { out_day: false, active_night: false }, after: { out_day: true, active_night: false } }))).toBe('Priya switched Out and about today on.');
    expect(say(event('town.reset', { ...town, before: { out_day: true, active_night: false }, after: { out_day: false } }))).toBe('Out and about ended, morning.');
    expect(say(event('town.reset', { ...town, before: { out_day: true, active_night: true }, after: { out_day: false, active_night: false } }))).toBe('Out and about and Active tonight ended, morning.');
    // M5b step 6a (dt-2): the reset rides Start downtime, its own line; End expedition says only how long it took.
    const requestId = 'request-downtime';
    const ended = event('expedition.end', { targetTable: 'expeditions', targetId: 'expedition-1', requestId: 'request-end', before: { ended_at: null }, after: { ended_at: 600, summary: { seconds: 600 } } });
    expect(sayL(ended)).toBe('Priya ended the expedition after 10 minutes.');
    const rest = event('downtime.start', { targetTable: 'character_play', targetId: 'play-1', requestId, before: { uses_spent: { Mend: 1 } }, after: { uses_spent: {} } });
    const downtime = event('downtime.start', { ...town, requestId, before: { mode: 'adventure', active_night: true }, after: { mode: 'downtime', active_night: false } });
    expect(sayL(rest, downtime)).toBe('Priya started downtime with a full rest (1 character got abilities back). Active tonight ended, downtime.');
    expect(sayL(event('downtime.start', { ...town, requestId, before: { mode: 'adventure' }, after: { mode: 'downtime' } }))).toBe('Priya started downtime with a full rest.');
  });

  // Purpose: a Yes to In a safe place? reads as one End line, folded in as it's read; No or no answer leaves it as it was (m8b-0 delivery 5).
  it("folds a Yes into End expedition's line, and says the answer's own Verbose line", () => {
    const ended = event('expedition.end', { targetTable: 'expeditions', targetId: 'expedition-1', requestId: 'request-end', before: { ended_at: null }, after: { ended_at: 600, summary: { seconds: 600 } } });
    const saying = (safeEnds: Set<string>) => describeEntry(groupEntries([ended])[0]!, { ...names, safeEnds });
    expect(saying(new Set(['expedition-1']))).toBe('Priya ended the expedition in a safe place after 10 minutes.');
    expect(saying(new Set(['expedition-2']))).toBe('Priya ended the expedition after 10 minutes.');
    expect(sayL(ended)).toBe('Priya ended the expedition after 10 minutes.');
    const answered = (now: boolean | null) => event('expedition.safePlace', { targetTable: 'expeditions', targetId: 'expedition-1', before: { ended_safe: null }, after: { ended_safe: now } });
    expect(sayL(answered(true))).toBe('Priya said the party ended in a safe place.');
    expect(sayL(answered(false))).toBe('Priya said the party ended somewhere not safe.');
  });

  // Purpose: Next part of day and End downtime each say what happened in the Simple log (M5b step 6a).
  it('says Next part of day and End downtime', () => {
    const clock = { targetTable: 'campaign_clocks', targetId: 'clock-1' };
    expect(say(event('time.partOfDay', { ...clock, before: { seconds: 21600 }, after: { seconds: 50400 } }))).toBe('Priya moved on to the next part of the day (8 hours).');
    expect(say(event('downtime.end', { ...town, before: { mode: 'downtime' }, after: { mode: 'adventure' } }))).toBe('Priya ended downtime.');
  });

  // Purpose: Use safe paths in Leave the dungeon is one Simple line that says what the GM did (sq-2).
  it('says Use safe paths', () => {
    expect(say(event('expedition.safePaths', { targetTable: 'expeditions', targetId: 'expedition-1', before: { safe_paths: false }, after: { safe_paths: true } }))).toBe('Priya led the party out by safe paths.');
  });
});

describe('the marching order in the log (M5 step 8)', () => {
  const order = { targetTable: 'marching_orders', targetId: 'marching-1' };
  const [wren, ash] = ['actor-wren', 'actor-ash'];

  it('every move says what it did, with the characters named', () => {
    expect(say(event('marching.set', { ...order, before: { rows: [[wren], [ash]] }, after: { rows: [[ash], [wren]] } }))).toBe('Priya moved Ash to the front.');
    expect(say(event('marching.set', { ...order, before: { rows: [[wren], [ash]] }, after: { rows: [[wren, ash]] } }))).toBe('Priya put Ash beside Wren.');
    expect(say(event('marching.set', { ...order, before: { rows: [[wren, ash]] }, after: { rows: [[wren], [ash]] } }))).toBe('Priya gave Ash a row of their own.');
  });

  it('a saved order used or saved, and the lock', () => {
    expect(say(event('marching.usePreset', { ...order, before: { rows: [[wren], [ash]], last_preset: null }, after: { rows: [[ash], [wren]], last_preset: 'Tunnel' } }))).toBe(
      'Priya put the party in the saved order “Tunnel”.',
    );
    expect(say(event('marching.savePreset', { ...order, before: { presets: [] }, after: { presets: [{ name: 'Ford', rows: [[wren]] }] } }))).toBe('Priya saved the marching order as “Ford”.');
    expect(say(event('marching.lock', { ...order, before: { locked: false }, after: { locked: true } }))).toBe('Priya locked the marching order.');
    expect(say(event('marching.lock', { ...order, before: { locked: true }, after: { locked: false } }))).toBe('Priya unlocked the marching order.');
    expect(say(event('marching.deletePreset', { ...order, before: { presets: [{ name: 'Ford', rows: [[wren]] }] }, after: { presets: [] } }))).toBe('Priya deleted the saved order “Ford”.');
  });
});

describe('party groups in the log (M5 step 8, DG14)', () => {
  const member = (id: string, before: number, after: number, requestId: string) =>
    event('party.chooseGroup', { targetTable: 'party_group_members', targetId: id, requestId, before: { group_number: before }, after: { group_number: after } });

  it('a character to a group names them and the group; a hireling going along adds nothing', () => {
    expect(say(member('actor-wren', 1, 2, 'r-split'))).toBe('Priya put Wren in Group 2.');
    expect(say(member('actor-wren', 1, 2, 'r-both'), member('actor-ash', 1, 2, 'r-both'))).toBe('Priya put Wren in Group 2.');
  });

  it('the move that leaves one group says the party is together again', () => {
    // Wren joined Ash's group 2, the only one left, so the database put everyone back in the party.
    expect(say(member('actor-wren', 1, 2, 'r-last'), member('actor-wren', 2, 1, 'r-last'), member('actor-ash', 2, 1, 'r-last'))).toBe(
      'Priya put Wren with the others: the party is together again.',
    );
  });

  it('Join up names both groups', () => {
    const join = (id: string, before: number, after: number, requestId: string) =>
      event('party.joinUp', { targetTable: 'party_group_members', targetId: id, requestId, before: { group_number: before }, after: { group_number: after } });
    expect(say(join('actor-wren', 3, 2, 'r-join'))).toBe('Priya joined up Group 3 with Group 2.');
    expect(say(join('actor-wren', 3, 2, 'r-all'), join('actor-wren', 2, 1, 'r-all'))).toBe('Priya joined up the groups: the party is together again.');
  });
});

describe('statuses and rest in the log (M5 step 9)', () => {
  const withStatuses: LogNames = {
    ...names,
    statuses: new Map([
      ['status-wren', { who: 'Wren', name: 'Weary' }],
      ['status-ash', { who: 'Ash', name: 'Reeling' }],
    ]),
    rests: new Map([
      ['rest-wren', 'Wren'],
      ['rest-ash', 'Ash'],
    ]),
  };
  const sayS = (...events: LogEvent[]) => describeEntry(groupEntries(events)[0]!, withStatuses);
  const on = (id: string) => ({ targetTable: 'character_statuses', targetId: id });

  it('putting on, stacking, removing and stepping name the status with its character', () => {
    expect(sayS(event('status.add', { ...on('status-new'), before: null, after: { name: 'Muddy boots', actor_id: 'actor-wren' } }))).toBe('Priya put Muddy boots on Wren.');
    expect(sayS(event('status.add', { ...on('status-wren'), before: { stacks: 1 }, after: { stacks: 2 } }))).toBe('Priya put Weary on Wren on again (×2).');
    expect(sayS(event('status.remove', { ...on('status-wren'), before: { ended_at: null }, after: { ended_at: 600, end_reason: 'removed' } }))).toBe('Priya removed Weary from Wren.');
    expect(sayS(event('status.step', { ...on('status-ash'), before: { level: 0 }, after: { level: 1 } }))).toBe('Priya changed the level of Reeling on Ash.');
  });

  it("the GM's time-left stepper names the status with its character, on the status or on its secret timer", () => {
    expect(sayS(event('status.setTime', { ...on('status-wren'), before: { ends_at: 1800 }, after: { ends_at: 2400 } }))).toBe('Priya changed the time left of Weary on Wren.');
    expect(sayS(event('status.setTime', { ...on('status-wren'), targetTable: 'status_secrets', before: { ends_at: 1800 }, after: { ends_at: 2400 } }))).toBe('Priya changed the time left of Weary on Wren.');
  });

  it('Push on, Rest this turn, and what a Next turn ended or rested', () => {
    const requestId = 'request-push';
    expect(
      sayS(
        event('rest.pushOn', { ...on('status-a'), requestId, before: null, after: { name: 'Weary', actor_id: 'actor-wren' } }),
        event('rest.pushOn', { ...on('status-b'), requestId, before: null, after: { name: 'Weary', actor_id: 'actor-ash' } }),
      ),
    ).toBe('Priya pushed on without rest: Weary on Wren, Weary on Ash.');
    expect(sayS(event('rest.choose', { targetTable: 'character_rests', targetId: 'rest-wren', actorUserId: 'user-sam', before: { chosen_at: null }, after: { chosen_at: 0 } }))).toBe('You chose rest for Wren.');
    const turn = 'request-turn';
    expect(
      sayS(
        event('time.advance', { targetTable: 'campaign_clocks', targetId: 'clock-1', requestId: turn, before: { seconds: 0 }, after: { seconds: 600 } }),
        event('rest.taken', { targetTable: 'character_rests', targetId: 'rest-wren', requestId: turn, before: { chosen_at: 0, rested_at: null }, after: { chosen_at: null, rested_at: 0 } }),
        event('status.timerEnd', { ...on('status-ash'), requestId: turn, before: { ended_at: null }, after: { ended_at: 600, end_reason: 'timer' } }),
      ),
    ).toBe('Priya moved the clock on 10 minutes. Ran out with the clock: Reeling on Ash. Rested: Wren.');
    // In the Simple log the routine turn isn't shown: the lines say what ended and who rested.
    expect(sayS(event('status.timerEnd', { ...on('status-ash'), before: { ended_at: null }, after: { ended_at: 600 } }))).toBe('Ended with the clock: Reeling on Ash.');
    expect(sayS(event('rest.taken', { targetTable: 'character_rests', targetId: 'rest-wren', before: { rested_at: null }, after: { rested_at: 0 } }))).toBe('Rested: Wren.');
  });

  // M5b g6 (B5): the applied rest is one line, the record: who rested, who pushed on with the condition, who called it.
  it('a rest applied with Next turn is one line: rested, pushed on with the stacked condition, and who called it', () => {
    const turn = 'request-rest';
    const rest = (id: string, after: Record<string, unknown>, before: Record<string, unknown> = { chosen_at: 1200 }) =>
      event('rest.applied', { targetTable: 'character_rests', targetId: id, requestId: turn, before, after });
    expect(
      sayS(
        rest('rest-wren', { rested_at: 1200, chosen_at: null, period_from: 1200 }),
        rest('rest-ash', { pushed_on_at: 1200, period_from: 1200 }, { chosen_at: null }),
        event('rest.applied', { ...on('status-ash'), requestId: turn, before: { stacks: 1 }, after: { stacks: 2 } }),
      ),
    ).toBe('Rest, rested: Wren, pushed on: Ash (Reeling ×2)');
    expect(sayS(rest('rest-wren', { rested_at: 1200, chosen_at: null }, { chosen_at: 900, called_by: 'actor-wren' }), rest('rest-ash', { rested_at: 1200, chosen_at: null }))).toBe(
      'Rest called by Wren, rested: everyone',
    );
  });

  // SC-g6-3 (ruled B, 2026-11-03; mockup b5, panel 4): the line names when the next rest falls due, as the strip counts.
  it('the applied rest names the next due turn; a line from before (no next_due) reads as it did', () => {
    const turn = 'request-rest';
    const due = { at: 3600, unit: 'turn', number: 7 };
    const rest = (id: string, after: Record<string, unknown>) => event('rest.applied', { targetTable: 'character_rests', targetId: id, requestId: turn, before: { chosen_at: 1200 }, after });
    expect(sayS(rest('rest-wren', { rested_at: 1200, chosen_at: null, next_due: due }), rest('rest-ash', { rested_at: 1200, chosen_at: null, next_due: due }))).toBe(
      'Rest, rested: everyone, next rest due turn 7',
    );
    expect(sayS(rest('rest-wren', { rested_at: 1200, chosen_at: null, next_due: null }))).toBe('Rest, rested: everyone');
    expect(sayS(rest('rest-wren', { rested_at: 1200, chosen_at: null }))).toBe('Rest, rested: everyone');
  });
});

describe('places and messages in plain words (M5 step 11)', () => {
  const gm = { actorUserId: 'user-priya' };
  const placed = (extra: Partial<LogEvent>) => event('place.set', { targetTable: 'group_places', targetId: 'gp-1', ...extra });
  const withPlaces: LogNames = {
    ...names,
    placeNames: new Map([['place-gallery', 'The Moth Gallery']]),
    groupPlaces: new Map([['gp-1', 'place-gallery']]),
    messages: new Map([['msg-1', 'Bring the lantern.']]),
  };
  const sayP = (...events: LogEvent[]) => describeEntry(groupEntries(events)[0]!, withPlaces);

  it('Where now? says where a group was put, or "somewhere unnamed" with no place', () => {
    expect(sayP(placed({ ...gm, after: { group_number: 2, place_id: 'place-gallery' } }))).toBe('Priya put Group 2 at The Moth Gallery.');
    expect(sayP(placed({ ...gm, after: { group_number: 1, place_id: null } }))).toBe('Priya put the party somewhere unnamed.');
  });

  // Purpose: Move on's one line names the place, the way taken and its turns for the GM, with what ran out with the
  // clock. A device that got only the clock's part (a player's) reads that the party moved: to the place by the name
  // they were given once it's been shown to their group, else "moved on"; never the way, never "moved the clock on".
  describe('Move on (December step 4)', () => {
    const request = { requestId: 'req-move-on', ...gm };
    const clock = event('place.moveOn', { ...request, id: 'event-move-clock', targetTable: 'campaign_clocks', targetId: 'clock-1', before: { seconds: 600 }, after: { seconds: 2400 } });
    const left = event('place.moveOn', { ...request, targetTable: 'group_places', targetId: 'gp-0', before: { moved_on: false }, after: { moved_on: true } });
    const arrived = event('place.moveOn', { ...request, targetTable: 'group_places', targetId: 'gp-1', before: null, after: { group_number: 1, place_id: 'place-gallery' } });
    const record = (after: Record<string, unknown>) => event('place.moveOn', { ...request, targetTable: 'place_moves', targetId: 'move-1', before: null, after: { group_place_id: 'gp-1', ...after } });
    const moves = (to: string | null, from: string | null, turns = 3): LogNames => ({ ...withPlaces, partyMoves: new Map([['event-move-clock', { turns, to, from }]]) });
    const say = (names: LogNames, ...events: LogEvent[]) => describeEntry(groupEntries(events)[0]!, names);

    it('the GM reads the place, the way and the turns', () => {
      expect(sayP(left, arrived, record({ way_by: 'row', way_name: 'Rowing', turns: 3 }), clock)).toBe('Priya moved the party to The Moth Gallery: Rowing, 3 turns.');
      expect(sayP(left, arrived, record({ way_by: 'swim', way_name: 'Swimming', turns: 1 }), clock)).toBe('Priya moved the party to The Moth Gallery: Swimming, 1 turn.');
      // A link with one amount and no named way.
      expect(sayP(left, arrived, record({ way_by: null, way_name: null, turns: 999 }), clock)).toBe('Priya moved the party to The Moth Gallery: 999 turns.');
      // A place the reader has no name for (undone since).
      expect(sayP(event('place.moveOn', { ...request, targetTable: 'group_places', targetId: 'gp-2', before: null, after: { group_number: 1, place_id: 'place-gone' } }), record({ way_name: 'Rowing', turns: 2 }), clock)).toBe(
        'Priya moved the party to a place: Rowing, 2 turns.',
      );
      // A light that burnt out in the move is said with it, as for Advance by….
      const burnt = event('light.burnOut', { ...request, targetTable: 'character_lights', targetId: 'light-1', before: { lit_at: 0, out_at: null }, after: { lit_at: null, out_at: 1200 } });
      expect(sayP(left, arrived, record({ way_name: 'Rowing', turns: 3 }), clock, burnt)).toMatch(/^Priya moved the party to The Moth Gallery: Rowing, 3 turns\. Ran out with the clock: /);
    });

    it("a player reads that the party moved: the place by the players' name once shown to their group, else moved on", () => {
      // The clock's event alone reaches a player's device.
      expect(say(moves('A hall of moths', null), clock)).toBe('The party moved to A hall of moths: 3 turns.');
      expect(say(moves(null, null), clock)).toBe('The party moved on: 3 turns.');
      expect(say(moves(null, null, 1), clock)).toBe('The party moved on: 1 turn.');
      // Nothing known of the move at all (it couldn't be loaded): still no clock words.
      expect(sayP(clock)).toBe('The party moved on.');
      for (const names of [moves('A hall of moths', null), moves(null, null), withPlaces]) expect(say(names, clock)).not.toContain('clock');
    });

    it('an undone move says so: the GM reads both places, a player where the party is back at, or that it went back', () => {
      const undo = { requestId: 'req-undo-move', ...gm };
      const clockBack = event('event.undo', { ...undo, targetTable: 'campaign_clocks', targetId: 'clock-1', before: { seconds: 2400 }, after: { seconds: 600 }, revertsEventId: 'event-move-clock' });
      const visitUndone = event('event.undo', { ...undo, targetTable: 'group_places', targetId: 'gp-1', before: { undone: false }, after: { undone: true } });
      const visitBack = event('event.undo', { ...undo, targetTable: 'group_places', targetId: 'gp-0', before: { moved_on: true }, after: { moved_on: false } });
      const recordUndone = event('event.undo', { ...undo, targetTable: 'place_moves', targetId: 'move-1', before: { undone: false }, after: { undone: true } });
      const gmNames: LogNames = {
        ...moves('The Moth Gallery', 'The Reed Stair'),
        placeNames: new Map([['place-gallery', 'The Moth Gallery'], ['place-stair', 'The Reed Stair']]),
        groupPlaces: new Map([['gp-1', 'place-gallery'], ['gp-0', 'place-stair']]),
      };
      expect(say(gmNames, visitUndone, recordUndone, visitBack, clockBack)).toBe('Priya undid the move to The Moth Gallery: the party is back at The Reed Stair.');
      // A player's device: the clock's part alone.
      expect(say(moves(null, 'The foot of the stair'), clockBack)).toBe('The party is back at The foot of the stair.');
      expect(say(moves(null, null), clockBack)).toBe('The party went back.');
      // Known only as a move by its kind (the page's event types), with nothing loaded about it.
      expect(say({ ...withPlaces, eventTypes: new Map([['event-move-clock', 'place.moveOn']]) }, clockBack)).toBe('The party went back.');
      // Any other change to the clock undone reads as before.
      expect(say(moves(null, null), event('event.undo', { ...undo, targetTable: 'campaign_clocks', targetId: 'clock-1', before: { seconds: 2400 }, after: { seconds: 600 }, revertsEventId: 'event-other' }))).not.toContain('party');
    });
  });

  it('pieces after they are added (M5b g2b): an edit says the new words, a removal names the piece, a return visit counts', () => {
    const withPieces: LogNames = {
      ...withPlaces,
      pieces: new Map([['piece-arch', 'An archway to the east, dark beyond']]),
    };
    const say = (...events: LogEvent[]) => describeEntry(groupEntries(events)[0]!, withPieces);
    expect(say(event('place.editPiece', { targetTable: 'place_pieces', targetId: 'piece-arch', before: { body: 'An archway to the east' }, after: { body: 'An archway to the east, dark beyond' } }))).toBe(
      'Priya changed a piece to “An archway to the east, dark beyond”.',
    );
    expect(say(event('place.editPiece', { targetTable: 'place_pieces', targetId: 'piece-arch', before: { kind: 'exit' }, after: { kind: 'clue' } }))).toBe('Priya changed the kind of “An archway to the east, dark beyond”.');
    expect(say(event('place.removePiece', { targetTable: 'place_pieces', targetId: 'piece-arch', before: { undone: false }, after: { undone: true } }))).toBe('Priya removed a piece: “An archway to the east, dark beyond”.');
    const back = (id: string, piece: string) => event('place.backAt', { targetTable: 'piece_shows', targetId: id, before: null, after: { piece_id: piece, group_number: 1, group_place_id: 'gp-1', shown: true }, requestId: 'req-back' });
    expect(say(back('show-1', 'piece-arch'), back('show-2', 'piece-hall'))).toBe('Priya is back at The Moth Gallery with the party, 2 pieces shown again.');
  });

  // Purpose: Safe / Hostile on a place (M5b step 6b, ST2) says the place and what it was marked, in the GM's log.
  it('Safe or hostile says the place and its new mark', () => {
    const marked = (safety: string | null) => event('place.setSafety', { targetTable: 'places', targetId: 'place-gallery', before: { safety: null }, after: { safety } });
    expect(sayP(marked('safe'))).toBe('Priya marked The Moth Gallery safe.');
    expect(sayP(marked('hostile'))).toBe('Priya marked The Moth Gallery hostile.');
    expect(sayP(marked(null))).toBe('Priya marked The Moth Gallery neither safe nor hostile.');
  });

  // Purpose: the town screen's lines (M5b step 6c, ST3) say which place in town changed, where, and how.
  it('Show players and Open / Closed in town say the place in town and the town', () => {
    const stall = (shown: boolean, open: boolean) => ({ 'service:stall': { name: 'The Tinker’s Stall', kind: 'shop', shown, open } });
    const changed = (type: string, before: object, after: object) => event(type, { targetTable: 'places', targetId: 'place-gallery', before: { town: before }, after: { town: after } });
    expect(sayP(changed('town.showPlace', {}, stall(true, true)))).toBe('Priya showed players The Tinker’s Stall in The Moth Gallery.');
    expect(sayP(changed('town.showPlace', stall(true, true), stall(false, true)))).toBe('Priya hid The Tinker’s Stall in The Moth Gallery from players.');
    expect(sayP(changed('town.openPlace', {}, stall(false, false)))).toBe('Priya closed The Tinker’s Stall in The Moth Gallery.');
    expect(sayP(changed('town.openPlace', stall(false, false), stall(false, true)))).toBe('Priya opened The Tinker’s Stall in The Moth Gallery.');
  });

  it('Show players and Hide (retired in g2b) still say which place was shown or hidden', () => {
    expect(sayP(event('place.show', { targetTable: 'group_places', targetId: 'gp-1', before: { shown: false }, after: { shown: true } }))).toBe('Priya showed players The Moth Gallery.');
    expect(sayP(event('place.hide', { targetTable: 'group_places', targetId: 'gp-1', before: { shown: true }, after: { shown: false } }))).toBe('Priya hid The Moth Gallery from players.');
  });

  it('pieces (M5b g2): + Piece, Show and Hide name the piece and the group; Hide all is one line with the count', () => {
    const withPieces: LogNames = {
      ...withPlaces,
      pieces: new Map([['piece-arch', 'An archway to the east']]),
      pieceShows: new Map([
        ['show-1', { piece: 'piece-arch', group: 1 }],
        ['show-2', { piece: 'piece-arch', group: 2 }],
      ]),
    };
    const say = (...events: LogEvent[]) => describeEntry(groupEntries(events)[0]!, withPieces);
    expect(say(event('place.addPiece', { targetTable: 'place_pieces', targetId: 'piece-arch', before: null, after: { place_id: 'place-gallery', body: 'An archway to the east' } }))).toBe(
      'Priya added a piece to The Moth Gallery: “An archway to the east”.',
    );
    expect(say(event('place.showPiece', { targetTable: 'piece_shows', targetId: 'show-1', before: null, after: { piece_id: 'piece-arch', group_number: 1, shown: true } }))).toBe(
      'Priya showed the party “An archway to the east”.',
    );
    expect(say(event('place.hidePiece', { targetTable: 'piece_shows', targetId: 'show-2', before: { shown: true }, after: { shown: false } }))).toBe('Priya hid “An archway to the east” from Group 2.');
    const all = 'request-hide-all';
    expect(
      say(
        event('place.hideAll', { targetTable: 'piece_shows', targetId: 'show-1', requestId: all, before: { shown: true }, after: { shown: false } }),
        event('place.hideAll', { targetTable: 'piece_shows', targetId: 'show-9', requestId: all, before: { shown: true }, after: { shown: false } }),
      ),
    ).toBe('Priya hid 2 pieces from the party.');
  });

  // Purpose: the GM's log names the place a map was added to (hidden) or taken off, in plain words.
  it("a place's map (dec-7 5m-2): added (hidden) and taken off name the place", () => {
    const say = (e: LogEvent) => describeEntry(groupEntries([e])[0]!, withPlaces);
    expect(say(event('place.setMap', { targetTable: 'places', targetId: 'place-gallery', before: { map_asset_id: null }, after: { map_asset_id: 'asset-chart' } }))).toBe(
      'Priya added a map to The Moth Gallery (hidden).',
    );
    expect(say(event('place.setMap', { targetTable: 'places', targetId: 'place-gallery', before: { map_asset_id: 'asset-chart' }, after: { map_asset_id: null } }))).toBe('Priya took the map off The Moth Gallery.');
  });

  // Purpose: the GM's log says when a map was shared with the players, or taken back (dec-7 5m-3, the map's eye).
  it("a map's eye (dec-7 5m-3): shared with the players and taken back", () => {
    const say = (e: LogEvent) => describeEntry(groupEntries([e])[0]!, withPlaces);
    expect(say(event('place.shareMap', { targetTable: 'assets', targetId: 'asset-chart', before: { visibility: 'gm' }, after: { visibility: 'all' } }))).toBe('Priya shared a map with the players.');
    expect(say(event('place.shareMap', { targetTable: 'assets', targetId: 'asset-chart', before: { visibility: 'all' }, after: { visibility: 'gm' } }))).toBe('Priya took a map back from the players.');
  });

  it("the GM's Send line keeps the text and says who and how; a player's line is the short one", () => {
    const sent = (burn: boolean) =>
      event('message.send', { targetTable: 'gm_messages', targetId: 'msg-1', before: null, after: { body: 'Bring the lantern.', everyone: true, burn, keep: false } });
    expect(sayP(sent(true))).toBe('Priya sent everyone (burn after reading): “Bring the lantern.”.');
    expect(sayP(sent(false))).toBe('Priya sent everyone: “Bring the lantern.”.');
    const mine = event('message.send', { targetTable: 'message_recipients', targetId: 'rec-1', before: null, after: { message_id: 'msg-1', user_id: 'user-sam' } });
    expect(sayP(mine)).toBe('The GM sent you a message: “Bring the lantern.”.');
  });
});

describe('sheet changes in plain words (plan m5b-sheet-revised B)', () => {
  // The row a request makes: the figure, its words, before and after (an insert logs the whole row).
  const asked = { actor_id: 'actor-wren', requester_id: 'user-sam', field: 'MUS', label: 'Muscle', from_value: 16, to_value: 17, status: 'waiting', reason: '' };
  const change = (type: string, before: Record<string, unknown> | null, after: Record<string, unknown> | null, extra: Partial<LogEvent> = {}) =>
    event(type, { targetTable: 'sheet_changes', targetId: 'change-1', actorUserId: 'user-sam', before, after, ...extra });

  // Purpose: asking reads as the player asking the GM, with both figures.
  it('sheet.requestChange says who asked the GM for what, from and to', () => {
    expect(say(change('sheet.requestChange', null, asked))).toBe("You asked the GM to change Wren's Muscle from 16 to 17.");
    expect(say(change('sheet.requestChange', null, { ...asked, field: 'hpMax', label: 'Max HP', from_value: 6, to_value: 8 }, { actorUserId: 'user-jo' }))).toBe("Jo asked the GM to change Wren's Max HP from 6 to 8.");
  });

  // Purpose: a new ask for a figure that already waits takes the old one back in the same request; the line is the ask.
  it('a repeat ask reads as the new ask, not the figure it withdrew', () => {
    const request = 'request-again';
    const withdrawn = change('sheet.requestChange', { status: 'waiting' }, { status: 'withdrawn' }, { requestId: request });
    const again = change('sheet.requestChange', null, { ...asked, to_value: 18 }, { targetId: 'change-2', requestId: request });
    expect(say(withdrawn, again)).toBe("You asked the GM to change Wren's Muscle from 16 to 18.");
  });

  // Purpose: taking back, approving and refusing each read as the act, with the figure and (for a refusal) the reason.
  it('take back, approve and refuse name the figure; a refusal keeps the reason', () => {
    expect(say(change('sheet.takeBackChange', { status: 'waiting' }, { ...asked, status: 'withdrawn' }))).toBe("You took back the change to Wren's Muscle.");
    expect(say(change('sheet.approveChange', { status: 'waiting' }, { ...asked, status: 'approved' }, { actorUserId: 'user-priya' }))).toBe("Priya approved Wren's Muscle 17.");
    expect(say(change('sheet.refuseChange', { status: 'waiting' }, { ...asked, status: 'refused', reason: 'Not yet, you have not levelled.' }, { actorUserId: 'user-priya' }))).toBe(
      "Priya refused Wren's Muscle 17: “Not yet, you have not levelled.”.",
    );
    expect(say(change('sheet.refuseChange', { status: 'waiting' }, { ...asked, status: 'refused' }, { actorUserId: 'user-priya' }))).toBe("Priya refused Wren's Muscle 17.");
  });

  // Purpose: the database logs only the columns an update changes, so an answer's event carries the status and no
  // label or figures; the line still names them, from the sheet changes the log loads (names.sheetChanges).
  it('an answer logged as the database logs it (changed columns only) still names the figure', () => {
    const answered = change('sheet.approveChange', { status: 'waiting' }, { status: 'approved' }, { actorUserId: 'user-priya' });
    const withChanges: LogNames = { ...names, sheetChanges: new Map([['change-1', { actorId: 'actor-wren', label: 'Muscle', to: 17 }]]) };
    expect(describeEntry(groupEntries([answered])[0]!, withChanges)).toBe("Priya approved Wren's Muscle 17.");
  });
});

// December step 6b: the purse lines in the approved words (pu-7; the lead's ruling on the GM's moves, 2026-11-13).
describe('purse lines', () => {
  const purseNames: LogNames = {
    ...names,
    characters: new Map([
      ['actor-wren', 'Wren'],
      ['actor-moss', 'Moss'],
    ]),
    gms: new Set(['user-priya']),
    purses: new Map([
      ['purse-wren', { actorId: 'actor-wren' }],
      ['purse-moss', { actorId: 'actor-moss' }],
      ['purse-stash', { actorId: null }],
    ]),
    coinAmount: (key, n) => `${n} ${key === 'heron' ? 'herons' : key}`,
  };
  const line = (type: string, actorUserId: string, purse: string, was: number, now: number, requestId: string, reason: string | null = null) =>
    event(type, { actorUserId, targetTable: 'purses', targetId: purse, before: { coins: { heron: was } }, after: { coins: { heron: now } }, requestId, reason });
  const read = (lines: LogEvent[], who: Partial<LogNames> = {}) => describeEntry(groupEntries(lines)[0]!, { ...purseNames, ...who });

  // Purpose: the GM's move between two characters reads as the GM's, never a character's, and the same for both players.
  it('the GM moving coin between two characters: "Your GM moved 10 herons from Wren to Moss."', () => {
    const from = line('purse.take', 'user-priya', 'purse-wren', 30, 20, 'req-gm-move', 'with:actor-moss');
    const to = line('purse.take', 'user-priya', 'purse-moss', 0, 10, 'req-gm-move', 'with:actor-wren');
    expect(read([from, to])).toBe('Your GM moved 10 herons from Wren to Moss.');
    // Wren's player reads only Wren's side, Moss's player only Moss's: the same line.
    expect(read([from], { purses: new Map([['purse-wren', { actorId: 'actor-wren' }]]) })).toBe('Your GM moved 10 herons from Wren to Moss.');
    expect(read([to], { purses: new Map([['purse-moss', { actorId: 'actor-moss' }]]) })).toBe('Your GM moved 10 herons from Wren to Moss.');
  });

  // Purpose: the GM taking from the stash for a character reads as the GM's gift from the stash.
  it('the GM from the stash to a character: "Your GM gave Moss 10 herons from the stash."', () => {
    const from = line('purse.take', 'user-priya', 'purse-stash', 10, 0, 'req-gm-stash', 'with:actor-moss');
    const to = line('purse.take', 'user-priya', 'purse-moss', 0, 10, 'req-gm-stash', 'with:stash');
    expect(read([from, to])).toBe('Your GM gave Moss 10 herons from the stash.');
  });

  // Purpose: "<Name> took … from <Other>" stays only for a player's own take from a Down or dead character.
  it('a player taking from a dead character: "Moss took 10 herons from Wren"', () => {
    const from = line('purse.take', 'user-jo', 'purse-wren', 10, 0, 'req-take', 'with:actor-moss');
    const to = line('purse.take', 'user-jo', 'purse-moss', 0, 10, 'req-take', 'with:actor-wren');
    expect(read([from, to])).toBe('Moss took 10 herons from Wren');
  });

  // Purpose: pu-7's other lines read as written.
  it("the GM's take and the GM at the stash, in pu-7's words", () => {
    expect(read([line('purse.remove', 'user-priya', 'purse-wren', 30, 20, 'req-r1')])).toBe('Your GM took 10 herons from Wren');
    expect(read([line('purse.add', 'user-priya', 'purse-stash', 0, 20, 'req-r2')])).toBe('Your GM put 20 herons in the stash');
    expect(read([line('purse.remove', 'user-priya', 'purse-stash', 20, 10, 'req-r3')])).toBe('Your GM took 10 herons from the stash');
  });
});
