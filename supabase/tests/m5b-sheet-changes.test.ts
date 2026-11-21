// M5b, the full sheet revised: sheet changes (supabase/migrations/20261108200000_m5b_sheet_changes.sql; plan
// m5b-sheet-revised B; ruled 2026-11-08, evening). TEST project only; invented characters.
//   The owner of an approved, active character asks for Max HP and for a score; another player can't read the row or
//   its log lines, nor ask for someone else's figures; the GM and the owner read it.
//   A second ask for the same figure withdraws the first, so one waits per figure.
//   The owner takes back while it waits; the GM can't take back, and can't answer a withdrawn one.
//   Approve writes hp_max or the field's value in the same change and logs sheet.approveChange; Refuse keeps the
//   reason and leaves the figure; a player can't answer.
//   A draft or archived character can't ask, a figure that isn't a number field can't be asked for, nor the figure it
//   already has; the four commands are in logged_commands.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import type { CharacterRef } from '../../src/modules/characters/commands.ts';
import { approveSheetChange, loadSheetChanges, refuseSheetChange, requestSheetChange, takeBackSheetChange } from '../../src/modules/characters/sheetChanges.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I, requestId?: string) {
  return runCommand(registry, asDb(person), await userOf(person), command, input, { requestId });
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

/** A fresh campaign: Reed (player A's, approved, 6 Max HP, Muscle 13), Moss (player B's) and a draft of A's. */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Lantern Warrens', created_by: world.gm.id }).select().single());
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaign.id, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaign.id, user_id: world.playerA.id, base_role: 'player' },
        { campaign_id: campaign.id, user_id: world.playerB.id, base_role: 'player' },
      ])
      .select(),
  );
  // Fields: Muscle (a score of the rules set below), Nimble (a score whose field is hidden), a GM text field and a GM
  // number field that is not a score. A field key is lower case (field_definitions_key_check): the rules set's abilities
  // MUS and NIM hold in the fields "mus" and "nim", the key private.score_keys and the app (holdsAbility) make of them.
  must(
    await world.admin
      .from('field_definitions')
      .insert([
        { campaign_id: campaign.id, key: 'mus', label: 'Muscle', type: 'number', choices: [], hidden: false },
        { campaign_id: campaign.id, key: 'nim', label: 'Nimble', type: 'number', choices: [], hidden: true },
        { campaign_id: campaign.id, key: 'motto', label: 'Motto', type: 'text', choices: [], hidden: false },
        { campaign_id: campaign.id, key: 'lamps', label: 'Lamps', type: 'number', choices: [], hidden: false },
      ])
      .select('id'),
  );
  // An invented rules set whose abilities are Muscle and Nimble, attached to the campaign: they are its score keys.
  const pack = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Fen sample', version: '0.1', kind: 'setting' }).select('id').single());
  must(
    await world.admin
      .from('library_entries')
      .insert({ pack_id: pack.id, kind: 'rulesSet', pack_entry_id: 'fen-rules', name: 'Fen rules', data: { abilities: [{ key: 'MUS', name: 'Muscle' }, { key: 'NIM', name: 'Nimble' }] } })
      .select('id'),
  );
  must(await world.admin.from('campaign_packs').insert({ campaign_id: campaign.id, pack_id: pack.id, created_by: world.gm.id }).select('id'));
  const pc = (name: string, owner: Person, extra: Record<string, unknown> = {}) => ({
    campaign_id: campaign.id,
    kind: 'pc',
    name,
    owner_type: 'user',
    owner_user_id: owner.id,
    approval: 'approved',
    status: 'active',
    level: 1,
    hp_current: 6,
    hp_max: 6,
    fields: { mus: 13, motto: 'Lights first', lamps: 2 },
    ...extra,
  });
  const [reed, moss, draft] = must(
    await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB), pc('Draft Wren', world.playerA, { approval: 'draft' })]).select('id'),
  ) as { id: string }[];
  const ref = (id: string, owner: Person, extra: Partial<CharacterRef> = {}): CharacterRef => ({ id, campaignId: campaign.id as string, ownerType: 'user', ownerUserId: owner.id, approval: 'approved', archived: false, ...extra });
  return { campaignId: campaign.id as string, reed: ref(reed!.id, world.playerA), moss: ref(moss!.id, world.playerB), draft: ref(draft!.id, world.playerA, { approval: 'draft' }) };
}

const actorRow = async (id: string) => must(await world.admin.from('actors').select('hp_max, fields').eq('id', id).single());
const changeRow = async (id: string) => must(await world.admin.from('sheet_changes').select('*').eq('id', id).single());
const latestEvent = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id, audience').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!;
const seenTypes = async (person: Person, campaignId: string) =>
  must(await person.db.from('events').select('type').eq('campaign_id', campaignId)).map((e) => e.type as string);
const ask = (t: { reed: CharacterRef }, field: string, label: string, to: number, who: Person = world.playerA) => as(who, requestSheetChange, { character: t.reed, field, label, to });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('asking', () => {
  it("the owner asks for Max HP and for a score on an approved, active character; the figure before is read there, not sent", async () => {
    const t = await freshTable();
    const hp = await ok(ask(t, 'hpMax', 'Max HP', 8));
    expect([hp.status, hp.field, hp.label, hp.from, hp.to, hp.requesterId, hp.actorId]).toEqual(['waiting', 'hpMax', 'Max HP', 6, 8, world.playerA.id, t.reed.id]);
    const score = await ok(ask(t, 'mus', 'Muscle', 14));
    expect([score.status, score.from, score.to]).toEqual(['waiting', 13, 14]);
    // Asking changes nothing on the character.
    const reed = await actorRow(t.reed.id);
    expect(reed.hp_max).toBe(6);
    expect((reed.fields as Record<string, unknown>).mus).toBe(13);
    // The figure before is the database's: a lie in the call has nowhere to go.
    expect(await seenTypes(world.playerA, t.campaignId)).toContain('sheet.requestChange');
  });

  it("another player can't read the row or its log lines, nor ask for someone else's figures; the GM and the owner read it", async () => {
    const t = await freshTable();
    const made = await ok(ask(t, 'mus', 'Muscle', 14));
    expect((await loadSheetChanges(asDb(world.playerA), t.campaignId))?.map((c) => c.id)).toEqual([made.id]);
    expect((await loadSheetChanges(asDb(world.gm), t.campaignId, { waiting: true }))?.map((c) => c.id)).toEqual([made.id]);
    expect(await loadSheetChanges(asDb(world.playerB), t.campaignId)).toEqual([]);
    expect(must(await world.playerB.db.from('sheet_changes').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
    expect(await seenTypes(world.gm, t.campaignId)).toContain('sheet.requestChange');
    expect(await seenTypes(world.playerB, t.campaignId)).not.toContain('sheet.requestChange');
    // Not Reed's, from Moss's player; not through the table.
    expect((await world.playerB.db.rpc('request_sheet_change', { actor: t.reed.id, field: 'mus', label: 'Muscle', to_value: 18 })).error?.code).toBe('42501');
    expect((await world.playerA.db.from('sheet_changes').insert({ campaign_id: t.campaignId, actor_id: t.reed.id, requester_id: world.playerA.id, field: 'mus', label: 'Muscle', to_value: 20 })).error).not.toBeNull();
    // The GM isn't the character's player: the GM changes the sheet directly.
    expect((await world.gm.db.rpc('request_sheet_change', { actor: t.reed.id, field: 'mus', label: 'Muscle', to_value: 18 })).error?.code).toBe('42501');
  });

  it('a second ask for the same figure withdraws the first, in the same change; another figure keeps its own', async () => {
    const t = await freshTable();
    const first = await ok(ask(t, 'mus', 'Muscle', 14));
    const hp = await ok(ask(t, 'hpMax', 'Max HP', 8));
    const second = await ok(ask(t, 'mus', 'Muscle', 15));
    expect((await changeRow(first.id)).status).toBe('withdrawn');
    expect((await changeRow(second.id)).status).toBe('waiting');
    expect((await changeRow(hp.id)).status).toBe('waiting');
    expect((await loadSheetChanges(asDb(world.gm), t.campaignId, { waiting: true }))?.map((c) => c.id).sort()).toEqual([hp.id, second.id].sort());
  });

  it("a draft or an archived character can't ask; nor for a figure that isn't a number field, a bad number, or the figure it has", async () => {
    const t = await freshTable();
    const draft = await ask({ reed: t.draft }, 'mus', 'Muscle', 14);
    expect(draft.ok ? 'asked' : draft.message).toBe('Only a character in play asks the GM for a change.');
    must(await world.admin.from('actors').update({ status: 'archived' }).eq('id', t.reed.id).select('id'));
    const archived = await ask(t, 'mus', 'Muscle', 14);
    expect(archived.ok ? 'asked' : archived.message).toBe('Only a character in play asks the GM for a change.');
    must(await world.admin.from('actors').update({ status: 'active' }).eq('id', t.reed.id).select('id'));
    const call = (field: string, to: number) => world.playerA.db.rpc('request_sheet_change', { actor: t.reed.id, field, label: 'Something', to_value: to });
    expect((await call('motto', 5)).error?.message).toBe("That figure saves at once: only a score, Max HP or the level waits for the GM.");
    expect((await call('nowhere', 5)).error?.message).toBe("That figure saves at once: only a score, Max HP or the level waits for the GM.");
    expect((await call('mus', 0)).error?.message).toBe('Ask for a whole number from 1 to 9999.');
    expect((await call('mus', 10000)).error?.message).toBe('Ask for a whole number from 1 to 9999.');
    expect((await call('mus', 13)).error?.message).toBe("That's the figure already.");
    expect(must(await world.admin.from('sheet_changes').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
  });
});

describe('taking back', () => {
  it("the owner takes back while it waits; the GM can't, and can't answer a withdrawn one; a repeat changes nothing", async () => {
    const t = await freshTable();
    const made = await ok(ask(t, 'mus', 'Muscle', 14));
    // The GM can't take back the player's own ask.
    expect(((await world.gm.db.rpc('take_back_sheet_change', { change: made.id })).error)?.code).toBe('42501');
    expect(((await world.playerB.db.rpc('take_back_sheet_change', { change: made.id })).error)?.code).toBe('42501');
    const back = await ok(as(world.playerA, takeBackSheetChange, { change: made }));
    expect(back.status).toBe('withdrawn');
    expect(await seenTypes(world.playerA, t.campaignId)).toContain('sheet.takeBackChange');
    const again = await ok(as(world.playerA, takeBackSheetChange, { change: back }));
    expect(again.status).toBe('withdrawn');
    const answered = await as(world.gm, approveSheetChange, { change: back });
    expect(answered.ok ? 'approved' : answered.message).toBe('Its player took it back.');
    expect((await actorRow(t.reed.id)).fields).toMatchObject({ mus: 13 });
  });

  it('after the GM answers, taking back is refused', async () => {
    const t = await freshTable();
    const made = await ok(ask(t, 'mus', 'Muscle', 14));
    const approved = await ok(as(world.gm, approveSheetChange, { change: made }));
    const late = await as(world.playerA, takeBackSheetChange, { change: approved });
    expect(late.ok ? 'taken back' : late.message).toBe('Your GM has answered it already.');
  });
});

describe('the GM answers', () => {
  it('Approve writes Max HP onto the character in the same change, and logs sheet.approveChange', async () => {
    const t = await freshTable();
    const made = await ok(ask(t, 'hpMax', 'Max HP', 9));
    const approved = await ok(as(world.gm, approveSheetChange, { change: made }));
    expect(approved.status).toBe('approved');
    expect((await actorRow(t.reed.id)).hp_max).toBe(9);
    const row = await changeRow(made.id);
    expect([row.status, row.answered_by]).toEqual(['approved', world.gm.id]);
    expect(await seenTypes(world.gm, t.campaignId)).toContain('sheet.approveChange');
    // The player reads their own answer in the log.
    expect(await seenTypes(world.playerA, t.campaignId)).toContain('sheet.approveChange');
    // The request's own log line stays the player's (the figure changing on an approved character is everyone's line).
    expect((await latestEvent(t.campaignId, 'sheet.requestChange')).audience).toBe('owner');
  });

  it("Approve writes a score into the character's fields and leaves the rest of them alone", async () => {
    const t = await freshTable();
    const made = await ok(ask(t, 'mus', 'Muscle', 14));
    await ok(as(world.gm, approveSheetChange, { change: made }));
    const reed = await actorRow(t.reed.id);
    expect(reed.fields).toEqual({ mus: 14, motto: 'Lights first', lamps: 2 });
    expect(reed.hp_max).toBe(6);
    // A repeat of the same request changes nothing and makes no second log line.
    const requestId = crypto.randomUUID();
    const next = await ok(ask(t, 'mus', 'Muscle', 15));
    const first = await ok(as(world.gm, approveSheetChange, { change: next }, requestId));
    const repeat = await ok(as(world.gm, approveSheetChange, { change: next }, requestId));
    expect([first.status, repeat.status]).toEqual(['approved', 'approved']);
    expect((await actorRow(t.reed.id)).fields).toMatchObject({ mus: 15 });
  });

  it('Refuse keeps the reason and leaves the figure; the player reads the reason', async () => {
    const t = await freshTable();
    const made = await ok(ask(t, 'mus', 'Muscle', 14));
    const refused = await ok(as(world.gm, refuseSheetChange, { change: made, reason: '  Not before the next level.  ' }));
    expect([refused.status, refused.reason]).toEqual(['refused', 'Not before the next level.']);
    expect((await actorRow(t.reed.id)).fields).toMatchObject({ mus: 13 });
    const mine = (await loadSheetChanges(asDb(world.playerA), t.campaignId))?.find((c) => c.id === made.id);
    expect([mine?.status, mine?.reason]).toEqual(['refused', 'Not before the next level.']);
    expect(await seenTypes(world.gm, t.campaignId)).toContain('sheet.refuseChange');
    // Answered once: a second answer is refused with the status, not applied.
    const again = await as(world.gm, approveSheetChange, { change: refused });
    expect(again.ok ? 'approved' : again.message).toBe('That change was already refused.');
  });

  it("a player can't answer: not the owner, not the other player", async () => {
    const t = await freshTable();
    const made = await ok(ask(t, 'mus', 'Muscle', 14));
    for (const who of [world.playerA, world.playerB]) {
      const result = await who.db.rpc('answer_sheet_change', { change: made.id, approve: true });
      expect(result.error?.code, who.email).toBe('42501');
    }
    const refused = await as(world.playerA, refuseSheetChange, { change: made, reason: 'No' });
    expect(refused.ok).toBe(false);
    expect((await changeRow(made.id)).status).toBe('waiting');
    expect((await actorRow(t.reed.id)).fields).toMatchObject({ mus: 13 });
  });

  it('a stale copy is refused: the change moved on since the GM looked', async () => {
    const t = await freshTable();
    const made = await ok(ask(t, 'mus', 'Muscle', 14));
    const result = await world.gm.db.rpc('answer_sheet_change', { change: made.id, approve: true, seen_version: made.version + 5 });
    expect(result.error?.message).toBe("That's changed since. Here's the latest.");
    expect((await changeRow(made.id)).status).toBe('waiting');
  });
});

describe('the rules set’s own figures (#567 review)', () => {
  const callAsk = (person: Person, actor: string, field: string, to: number) => person.db.rpc('request_sheet_change', { actor, field, label: 'Something', to_value: to });

  it("the owner's direct update of Max HP (even from none) or of a score on an approved character is refused; a detail passes", async () => {
    const t = await freshTable();
    const direct = (patch: Record<string, unknown>) => world.playerA.db.from('actors').update(patch).eq('id', t.reed.id).select('id');
    expect((await direct({ hp_max: 9 })).error?.code).toBe('42501');
    must(await world.admin.from('actors').update({ hp_max: null }).eq('id', t.reed.id).select('id'));
    expect((await direct({ hp_max: 9 })).error?.code).toBe('42501');
    expect((await direct({ fields: { mus: 20, motto: 'Lights first', lamps: 2 } })).error?.code).toBe('42501');
    // A GM's text field and a GM's number field that is not a score save at once, the score as it was.
    expect((await direct({ fields: { mus: 13, motto: 'Lamps up', lamps: 5 } })).error).toBeNull();
    expect((await actorRow(t.reed.id)).fields).toEqual({ mus: 13, motto: 'Lamps up', lamps: 5 });
  });

  it('the GM changes any of them directly, and the GM’s approval does too', async () => {
    const t = await freshTable();
    expect((await world.gm.db.from('actors').update({ hp_max: 11 }).eq('id', t.reed.id).select('id')).error).toBeNull();
    expect((await world.gm.db.from('actors').update({ fields: { mus: 17, motto: 'Lights first', lamps: 2 } }).eq('id', t.reed.id).select('id')).error).toBeNull();
    const reed = await actorRow(t.reed.id);
    expect([reed.hp_max, (reed.fields as Record<string, unknown>).mus]).toEqual([11, 17]);
    const made = await ok(ask(t, 'mus', 'Muscle', 18));
    await ok(as(world.gm, approveSheetChange, { change: made }));
    expect((await actorRow(t.reed.id)).fields).toMatchObject({ mus: 18 });
  });

  it('on a character that is not approved yet, the owner changes Max HP and scores directly', async () => {
    const t = await freshTable();
    const direct = await world.playerA.db.from('actors').update({ hp_max: 8, fields: { mus: 15, motto: 'Lights first', lamps: 2 } }).eq('id', t.draft.id).select('id');
    expect(direct.error).toBeNull();
    const draft = await actorRow(t.draft.id);
    expect([draft.hp_max, (draft.fields as Record<string, unknown>).mus]).toEqual([8, 15]);
  });

  it('asking for a GM number field or for a hidden score field is refused', async () => {
    const t = await freshTable();
    const refusal = 'That figure saves at once: only a score, Max HP or the level waits for the GM.';
    expect((await callAsk(world.playerA, t.reed.id, 'lamps', 5)).error?.message).toBe(refusal);
    expect((await callAsk(world.playerA, t.reed.id, 'nim', 15)).error?.message).toBe(refusal);
    expect(must(await world.admin.from('sheet_changes').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
  });

  it('asking for the level works, and Approve writes it', async () => {
    const t = await freshTable();
    const made = await ok(ask(t, 'level', 'Level', 2));
    expect([made.from, made.to]).toEqual([1, 2]);
    await ok(as(world.gm, approveSheetChange, { change: made }));
    expect(must(await world.admin.from('actors').select('level').eq('id', t.reed.id).single()).level).toBe(2);
  });

  it('Approve after the figure changed is refused, and nothing is written', async () => {
    const t = await freshTable();
    const made = await ok(ask(t, 'mus', 'Muscle', 14));
    must(await world.admin.from('actors').update({ fields: { mus: 15, motto: 'Lights first', lamps: 2 } }).eq('id', t.reed.id).select('id'));
    const result = await world.gm.db.rpc('answer_sheet_change', { change: made.id, approve: true });
    expect(result.error?.message).toMatch(/^That's changed since: the sheet reads 15 now/);
    expect((await changeRow(made.id)).status).toBe('waiting');
    expect((await actorRow(t.reed.id)).fields).toMatchObject({ mus: 15 });
    // Refuse still works on it.
    const refused = await ok(as(world.gm, refuseSheetChange, { change: made, reason: 'It moved.' }));
    expect(refused.status).toBe('refused');
  });
});

describe('Undo (the app’s undoChange)', () => {
  const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });

  it('undoing an approval puts the figure back and makes the request waiting again, in one change', async () => {
    const t = await freshTable();
    const made = await ok(ask(t, 'hpMax', 'Max HP', 9));
    await ok(as(world.gm, approveSheetChange, { change: made }));
    expect((await actorRow(t.reed.id)).hp_max).toBe(9);
    await ok(undo(world.gm, t.campaignId, (await latestEvent(t.campaignId, 'sheet.approveChange')).id as string));
    expect((await actorRow(t.reed.id)).hp_max).toBe(6);
    const row = await changeRow(made.id);
    expect([row.status, row.answered_by]).toEqual(['waiting', null]);
  });

  it('undoing an ask marks the request undone, so it no longer waits', async () => {
    const t = await freshTable();
    const made = await ok(ask(t, 'mus', 'Muscle', 14));
    await ok(undo(world.playerA, t.campaignId, (await latestEvent(t.campaignId, 'sheet.requestChange')).id as string));
    expect((await changeRow(made.id)).undone).toBe(true);
    expect(await loadSheetChanges(asDb(world.gm), t.campaignId, { waiting: true })).toEqual([]);
    expect((await actorRow(t.reed.id)).fields).toMatchObject({ mus: 13 });
  });

  // Purpose: the update right the undo needs (20261108230000) doesn't let the player write their change straight from
  // the app: approving their own ask, or marking it undone, by a direct update is refused and changes nothing.
  it("the player can't approve or undo their own ask by writing the row directly", async () => {
    const t = await freshTable();
    const made = await ok(ask(t, 'mus', 'Muscle', 14));
    expect((await world.playerA.db.from('sheet_changes').update({ status: 'approved' }).eq('id', made.id).select('id')).error?.code).toMatch(/^(42501|P0001)$/); // the older sheet_change_rules trigger (P0001) or the new guard (42501) refuses it first, by trigger name order
    expect((await world.playerA.db.from('sheet_changes').update({ undone: true }).eq('id', made.id).select('id')).error?.code).toMatch(/^(42501|P0001)$/);
    const row = await changeRow(made.id);
    expect([row.status, row.undone]).toEqual(['waiting', false]);
  });
});

describe('the command lists', () => {
  it('logged_commands holds the four commands, the two answers the GM’s', async () => {
    const rows = must(await world.playerA.db.from('logged_commands').select('name, level, gm_only').like('name', 'sheet.%'));
    const byName = Object.fromEntries(rows.map((r) => [r.name as string, r]));
    expect(Object.keys(byName).sort()).toEqual(['sheet.approveChange', 'sheet.refuseChange', 'sheet.requestChange', 'sheet.takeBackChange']);
    expect(byName['sheet.requestChange']).toMatchObject({ level: 'simple', gm_only: false });
    expect(byName['sheet.takeBackChange']).toMatchObject({ level: 'simple', gm_only: false });
    expect(byName['sheet.approveChange']).toMatchObject({ level: 'simple', gm_only: true });
    expect(byName['sheet.refuseChange']).toMatchObject({ level: 'simple', gm_only: true });
  });

  it('asking is one of the actions whose record Undo marks undone', async () => {
    const rows = must(await world.playerA.db.from('undoable_makings').select('name').eq('name', 'sheet.requestChange'));
    expect(rows).toHaveLength(1);
  });
});
