// The purse commands (December step 6, piece b; docs/plans/dec-6-purse.md), run through the app's registry on the
// stand-in database, which acts like supabase/migrations/…_dec_6b_purse_commands.sql (supabase/tests/dec-6b-purse-
// commands.test.ts proves the real one). Invented names and coins only.
//   Purpose:
//   1. The GM gives a character coin: its player reads it, another player reads nothing of it.
//   2. A player spends from their own purse; the few words on what for are kept in the log line.
//   3. A player puts coin in the Party stash, and another player takes it out into their own character's purse.
//   4. A purse never goes below zero: the change is refused in the approved words, "<Name> has 30 herons.", with the
//      setting's coin name, and nothing moves.
//   5. Undo puts coin back as a reversing line; once the coin has moved on since, Undo is refused with its reason.
//   6. A dead character's purse can be taken from by another player; a living one's can't.
//   7. An amount is whole numbers of 1 or more, refused before anything is sent.
//   8. An archived character's purse follows its pack: only the GM changes it (the lead, 2026-11-13).
//   9. The stash's refusal reads "The stash has 0 bits."; a purse holds at most 999,999,999 of a coin, in the lead's words.
//  10. The log lines use the approved words ("spent", "Your GM gave", "took … from the stash"); the rest are plain, and a
//      line never names a purse the reader can't read.
//  11. The review of 2026-11-13: allowed agrees with the database (waiting characters, others' drafts); a request
//      without its id is refused and a line is named by its function; a give past an unreadable cap names no one;
//      a take goes back only while its purse is still open.
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type Command, type CurrentUser } from '../../core/commands.ts';
import { describeEntry, groupEntries, loadLog, loadLogNames } from '../../core/events.ts';
import { taggedDb } from '../../core/eventTags.ts';
import { undoChange } from '../../core/undo.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { addCoin, AMOUNT, coinAmountIn, giveCoin, isAmount, removeCoin, shortWords, spendCoin, takeCoin, tooMuchWords, type PurseRef, type TakeFrom } from './purse.ts';

type Row = Record<string, unknown>;

const registry = createAppRegistry();
let world: FakeWorld;
let campaign: string;
let gm: CurrentUser;
let sam: CurrentUser;
let tess: CurrentUser;
let wren: PurseRef;
let moss: PurseRef;
let stash: PurseRef;

const names = { heron: 'herons', bit: 'bits' };
const coinsOf = (ref: PurseRef) =>
  world.tables.purses.find((p) => (ref.actorId ? p.actor_id === ref.actorId : p.location_id === ref.locationId))?.coins;
const from = (ref: PurseRef, downOrDead = false): TakeFrom => ({ ...ref, downOrDead });
async function as<I, T, O>(user: CurrentUser, command: Command<I, T, O>, input: I) {
  world.signInAs(user.id);
  return runCommand(registry, world.db, user, command, input);
}
/** The newest log line this person made (what a toast's Undo undoes). */
const newestBy = (user: CurrentUser) => [...world.tables.events].filter((e) => e.actor_user_id === user.id).sort((a, b) => Number(b.seq) - Number(a.seq))[0]!;
const undo = (user: CurrentUser, event: Row) => as(user, undoChange, { campaignId: campaign, eventId: String(event.id), authorUserId: String(event.actor_user_id) });

beforeEach(async () => {
  world = createFakeDb();
  const gmId = world.addPerson('priya@lantern.example', 'Priya');
  const samId = world.addPerson('sam@lantern.example', 'Sam');
  const tessId = world.addPerson('tess@lantern.example', 'Tess');
  campaign = world.addCampaign('The Ash Barrows', gmId);
  const wrenId = world.addCharacter(campaign, 'Wren', { ownerId: samId });
  const mossId = world.addCharacter(campaign, 'Moss', { ownerId: tessId });
  world.addMember(campaign, samId, 'player', wrenId);
  world.addMember(campaign, tessId, 'player', mossId);
  gm = { id: gmId, roles: { [campaign]: 'gm' } };
  sam = { id: samId, roles: { [campaign]: 'player' } };
  tess = { id: tessId, roles: { [campaign]: 'player' } };
  // The purse rows are made on the first read.
  world.signInAs(gmId);
  await world.db.from('purses' as never).select('*');
  const stashId = world.tables.locations.find((l) => l.campaign_id === campaign && l.kind === 'stash')!.id as string;
  wren = { campaignId: campaign, actorId: wrenId, locationId: null, ownerUserId: samId, archived: false };
  moss = { campaignId: campaign, actorId: mossId, locationId: null, ownerUserId: tessId, archived: false };
  stash = { campaignId: campaign, actorId: null, locationId: stashId, ownerUserId: null, archived: false };
});

describe('the GM gives and takes', () => {
  it("gives a character coin: its player reads it, another player doesn't", async () => {
    expect((await as(gm, addCoin, { to: wren, coins: { heron: 40 } })).ok).toBe(true);
    expect(coinsOf(wren)).toEqual({ heron: 40 });
    world.signInAs(sam.id);
    const mine = (await world.db.from('purses' as never).select('*')) as unknown as { data: Row[] };
    expect(mine.data.find((p) => p.actor_id === wren.actorId)?.coins).toEqual({ heron: 40 });
    world.signInAs(tess.id);
    const theirs = (await world.db.from('purses' as never).select('*')) as unknown as { data: Row[] };
    expect(theirs.data.some((p) => p.actor_id === wren.actorId)).toBe(false);
    // The log line is Wren's player's and the GM's, never Tess's.
    expect(newestBy(gm)).toMatchObject({ type: 'purse.add', audience: 'owner', owner_user_id: sam.id });
  });

  it('takes coin out of play; a coin at zero leaves the purse', async () => {
    await as(gm, addCoin, { to: stash, coins: { heron: 10, bit: 4 } });
    expect((await as(gm, removeCoin, { from: stash, coins: { bit: 4 } })).ok).toBe(true);
    expect(coinsOf(stash)).toEqual({ heron: 10 });
  });
});

describe('a player spends, gives and takes', () => {
  beforeEach(async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 30, bit: 4 } });
  });

  it('spends from their own purse, the words kept in the line', async () => {
    expect((await as(sam, spendCoin, { from: wren, coins: { heron: 2 }, whatFor: '  Eel pie  ' })).ok).toBe(true);
    expect(coinsOf(wren)).toEqual({ heron: 28, bit: 4 });
    expect(newestBy(sam)).toMatchObject({ type: 'purse.spend', reason: 'Eel pie', fiat: false });
  });

  it('puts coin in the stash, and another player takes it out', async () => {
    expect((await as(sam, giveCoin, { from: wren, to: stash, coins: { heron: 10 } })).ok).toBe(true);
    expect(coinsOf(stash)).toEqual({ heron: 10 });
    expect((await as(tess, takeCoin, { from: from(stash), to: moss, coins: { heron: 10 } })).ok).toBe(true);
    expect(coinsOf(stash)).toEqual({});
    expect(coinsOf(moss)).toEqual({ heron: 10 });
    // The stash's line is everyone's; Moss's line is Tess's.
    const lines = world.tables.events.filter((e) => e.actor_user_id === tess.id && e.type === 'purse.take');
    expect(lines.map((e) => e.audience).sort()).toEqual(['all', 'owner']);
  });

  it('gives coin to another character', async () => {
    expect((await as(sam, giveCoin, { from: wren, to: moss, coins: { heron: 5 } })).ok).toBe(true);
    expect([coinsOf(wren), coinsOf(moss)]).toEqual([{ heron: 25, bit: 4 }, { heron: 5 }]);
  });

  it("is refused in the approved words when the purse hasn't that much, and nothing moves", async () => {
    const spent = await as(sam, spendCoin, { from: wren, coins: { heron: 31 }, names });
    expect(spent).toMatchObject({ ok: false, reason: 'failed', message: 'Wren has 30 herons.' });
    const given = await as(sam, giveCoin, { from: wren, to: moss, coins: { bit: 1, heron: 99 }, names });
    expect(given).toMatchObject({ ok: false, message: 'Wren has 30 herons.' });
    expect([coinsOf(wren), coinsOf(moss)]).toEqual([{ heron: 30, bit: 4 }, {}]);
    // Without the setting's names, the coin's key.
    expect(await as(sam, spendCoin, { from: wren, coins: { crown: 1 } })).toMatchObject({ message: 'Wren has 0 crown.' });
  });

  it("can't touch another player's purse", async () => {
    expect(await as(tess, spendCoin, { from: wren, coins: { heron: 1 } })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await as(tess, takeCoin, { from: from(wren), to: moss, coins: { heron: 1 } })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(coinsOf(wren)).toEqual({ heron: 30, bit: 4 });
  });

  it('refuses an amount that is not whole numbers of 1 or more, before sending', async () => {
    expect(isAmount({})).toBe(false);
    expect(isAmount({ heron: 0 })).toBe(false);
    expect(isAmount({ heron: 1.5 })).toBe(false);
    expect(isAmount({ heron: 2, bit: 1 })).toBe(true);
    const before = world.tables.events.length;
    expect(await as(sam, spendCoin, { from: wren, coins: { heron: -2 } })).toMatchObject({ ok: false, reason: 'failed' });
    expect(world.tables.events.length).toBe(before);
  });
});

describe('undo', () => {
  beforeEach(async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 30 } });
  });

  it('puts a give back on both purses, as reversing lines', async () => {
    await as(sam, giveCoin, { from: wren, to: moss, coins: { heron: 5 } });
    const line = newestBy(sam);
    expect((await undo(sam, line)).ok).toBe(true);
    expect([coinsOf(wren), coinsOf(moss)]).toEqual([{ heron: 30 }, {}]);
    expect(world.tables.events.filter((e) => e.reverts_event_id)).toHaveLength(2);
  });

  it("is refused once the coin has moved on since", async () => {
    await as(sam, giveCoin, { from: wren, to: moss, coins: { heron: 5 } });
    const line = newestBy(sam);
    await as(tess, spendCoin, { from: moss, coins: { heron: 1 } });
    expect(await undo(sam, line)).toMatchObject({ ok: false, message: "That's changed since. Undo the later change first." });
    expect([coinsOf(wren), coinsOf(moss)]).toEqual([{ heron: 25 }, { heron: 4 }]);
  });
});

describe('a dead character', () => {
  it("opens its purse to another player's take; a living one's stays shut", async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 12 } });
    expect(await as(tess, takeCoin, { from: from(wren), to: moss, coins: { heron: 2 } })).toMatchObject({ ok: false, reason: 'not-allowed' });
    world.tables.actors.find((a) => a.id === wren.actorId)!.status = 'dead';
    expect((await as(tess, takeCoin, { from: from(wren, true), to: moss, coins: { heron: 12 } })).ok).toBe(true);
    expect([coinsOf(wren), coinsOf(moss)]).toEqual([{}, { heron: 12 }]);
  });
});

describe('an archived character', () => {
  it("keeps its purse the GM's to change: its player can't spend, give or take into it", async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 12 } });
    world.tables.actors.find((a) => a.id === wren.actorId)!.status = 'archived';
    const kept = { ...wren, archived: true };
    expect(await as(sam, spendCoin, { from: kept, coins: { heron: 1 } })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await as(sam, giveCoin, { from: kept, to: stash, coins: { heron: 1 } })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await as(tess, giveCoin, { from: moss, to: kept, coins: { heron: 1 } })).toMatchObject({ ok: false, reason: 'not-allowed' });
    // The database refuses it too, when asked without the app's check.
    world.signInAs(sam.id);
    expect((await spendCoin.run(world.db, sam, { from: kept, coins: { heron: 1 } })).ok).toBe(false);
    expect((await as(gm, removeCoin, { from: kept, coins: { heron: 12 } })).ok).toBe(true);
    expect(coinsOf(wren)).toEqual({});
  });
});

describe('the refusal words', () => {
  it('reads "<Name> has <n> <coin>." (the stash: "The stash"), and the cap and bad amounts in the lead\'s words', async () => {
    expect(shortWords('Wren', 30, 'heron', names)).toBe('Wren has 30 herons.');
    expect(tooMuchWords('Wren', 'heron', names)).toBe("Wren can't hold more than 999,999,999 herons.");
    expect(await as(sam, spendCoin, { from: stash, coins: { bit: 1 }, names })).toMatchObject({ ok: false });
    expect(await as(sam, takeCoin, { from: from(stash), to: wren, coins: { bit: 1 }, names })).toMatchObject({ message: 'The stash has 0 bits.' });
    await as(gm, addCoin, { to: wren, coins: { heron: 999_999_999 } });
    expect(await as(gm, addCoin, { to: wren, coins: { heron: 1 } })).toMatchObject({ message: "Wren can't hold more than 999,999,999 heron." });
    expect(await as(sam, spendCoin, { from: wren, coins: { heron: 0 } })).toMatchObject({ message: AMOUNT });
    expect(AMOUNT).toBe('Say how many: a whole number, 1 or more.');
  });
});

describe('the log lines (approved words, plan dec-6-purse; the coin by its key until the setting names reach the log)', () => {
  /** The newest line this person reads in the log, in its words. */
  async function newestLine(user: CurrentUser, coinAmount?: (key: string, n: number) => string): Promise<string> {
    world.signInAs(user.id);
    const log = await loadLog(world.db, campaign, { verbose: true });
    const logNames = await loadLogNames(world.db, campaign, user.id);
    return describeEntry(groupEntries(log!.events)[0]!, { ...logNames, ...(coinAmount ? { coinAmount } : {}) });
  }

  it("names the coin in the setting's words when the screen passes them in (the coin-words helpers)", async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 40, zz: 1 } });
    const inWords = coinAmountIn([{ key: 'heron', label: 'herons', unitName: 'heron', pluralName: 'herons' }]);
    expect(await newestLine(sam, inWords)).toBe('Your GM gave Wren 40 herons, 1 zz');
  });

  it('the GM gives: "Your GM gave <Name> 40 herons", read by the player; another player has no such line', async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 40 } });
    expect(await newestLine(sam)).toBe('Your GM gave Wren 40 heron');
    world.signInAs(tess.id);
    expect((await loadLog(world.db, campaign, { verbose: true }))!.events.some((e) => e.targetTable === 'purses')).toBe(false);
  });

  it('a spend: "<Name> spent 2 herons: <what for>"', async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 30 } });
    await as(sam, spendCoin, { from: wren, coins: { heron: 2 }, whatFor: 'Eel pie' });
    expect(await newestLine(sam)).toBe('Wren spent 2 heron: Eel pie');
  });

  it('a take from the stash: "<Name> took 10 herons from the stash", and a put-in in plain words', async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 30 } });
    await as(sam, giveCoin, { from: wren, to: stash, coins: { heron: 10 } });
    expect(await newestLine(sam)).toBe('Wren put 10 heron in the stash');
    await as(tess, takeCoin, { from: from(stash), to: moss, coins: { heron: 10 } });
    expect(await newestLine(tess)).toBe('Moss took 10 heron from the stash');
    expect(await newestLine(gm)).toBe('Moss took 10 heron from the stash');
  });

  it('a give to another character: "<Name> gave <Other> 5 herons", the one line both read, though neither reads the other purse', async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 30 } });
    await as(sam, giveCoin, { from: wren, to: moss, coins: { heron: 5 } });
    expect(await newestLine(sam)).toBe('Wren gave Moss 5 heron');
    expect(await newestLine(tess)).toBe('Wren gave Moss 5 heron');
    expect(await newestLine(gm)).toBe('Wren gave Moss 5 heron');
  });

  it('the GM\'s take, the GM at the stash, and a take from a dead character, in the approved words', async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 30 } });
    await as(gm, removeCoin, { from: wren, coins: { heron: 10 } });
    expect(await newestLine(sam)).toBe('Your GM took 10 heron from Wren');
    await as(gm, addCoin, { to: stash, coins: { heron: 20 } });
    expect(await newestLine(tess)).toBe('Your GM put 20 heron in the stash');
    await as(gm, removeCoin, { from: stash, coins: { heron: 10 } });
    expect(await newestLine(tess)).toBe('Your GM took 10 heron from the stash');
    world.tables.actors.find((a) => a.id === wren.actorId)!.status = 'dead';
    await as(tess, takeCoin, { from: from(wren, true), to: moss, coins: { heron: 10 } });
    expect(await newestLine(tess)).toBe('Moss took 10 heron from Wren');
    expect(await newestLine(sam)).toBe('Moss took 10 heron from Wren');
  });

  it('a spend with nothing said: "<Name> spent 2 herons"', async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 30 } });
    await as(sam, spendCoin, { from: wren, coins: { heron: 2 } });
    expect(await newestLine(sam)).toBe('Wren spent 2 heron');
  });
});

describe('the app agrees with the database (review, 2026-11-13)', () => {
  // Purpose: a player gives only to an approved character; the GM never adds to or takes from another person's draft.
  it('can() refuses a give to a waiting character, and the GM touching another person\'s draft', () => {
    const waiting = { ...moss, approval: 'pending' };
    const draft = { ...wren, approval: 'draft' };
    expect(registry.can(sam, 'purse.give', giveCoin.target({ from: wren, to: waiting, coins: { heron: 1 } }))).toBe(false);
    expect(registry.can(sam, 'purse.give', giveCoin.target({ from: wren, to: moss, coins: { heron: 1 } }))).toBe(true);
    expect(registry.can(gm, 'purse.add', addCoin.target({ to: draft, coins: { heron: 1 } }))).toBe(false);
    expect(registry.can(gm, 'purse.remove', removeCoin.target({ from: draft, coins: { heron: 1 } }))).toBe(false);
    expect(registry.can(gm, 'purse.take', takeCoin.target({ from: from(draft), to: moss, coins: { heron: 1 } }))).toBe(false);
    expect(registry.can(sam, 'purse.take', takeCoin.target({ from: from(stash), to: { ...wren, approval: 'pending' }, coins: { heron: 1 } }))).toBe(false);
    // Not even its own player spends from a draft or a waiting character's purse (the Fable check, 2026-11-13).
    expect(registry.can(sam, 'purse.spend', spendCoin.target({ from: draft, coins: { heron: 1 } }))).toBe(false);
  });

  // Purpose: the GM's add names the coin in the setting's words when the cap refuses it.
  it("the GM's add says the cap in the setting's words", async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 999_999_999 } });
    expect(await as(gm, addCoin, { to: wren, coins: { heron: 1 }, names })).toMatchObject({ message: "Wren can't hold more than 999,999,999 herons." });
  });

  // Purpose: a request without its id is refused, and a line is named by the function, never by the request's header.
  it('refuses a request without its id, and names the line itself whatever the header says', async () => {
    world.signInAs(gm.id);
    expect((await addCoin.run(world.db, gm, { to: wren, coins: { heron: 5 } })).ok).toBe(false);
    expect(coinsOf(wren)).toEqual({});
    await as(gm, addCoin, { to: wren, coins: { heron: 30 } });
    world.signInAs(sam.id);
    const forged = taggedDb(world.db, { type: 'purse.spend', level: 'simple', requestId: crypto.randomUUID() });
    expect((await giveCoin.run(forged, sam, { from: wren, to: stash, coins: { heron: 5 } })).ok).toBe(true);
    expect(newestBy(sam)).toMatchObject({ type: 'purse.give' });
  });

  // Purpose: a give past the cap of a purse the giver can't read names no one (the lead, 2026-11-13).
  it("a give past the cap of an unreadable purse says only that it didn't go through", async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 5 } });
    await as(gm, addCoin, { to: moss, coins: { heron: 999_999_999 } });
    expect(await as(sam, giveCoin, { from: wren, to: moss, coins: { heron: 1 }, names })).toMatchObject({ ok: false, message: "That give didn't go through. Nothing changed." });
    expect([coinsOf(wren), coinsOf(moss)]).toEqual([{ heron: 5 }, { heron: 999_999_999 }]);
  });

  // Purpose: a player's Undo goes by the purses as they are now: after the GM archives the character, an Undo of its
  // spend is refused and the archived purse is left alone.
  it('Undo of a spend is refused once the character is archived', async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 30 } });
    await as(sam, spendCoin, { from: wren, coins: { heron: 5 } });
    const spend = newestBy(sam);
    world.tables.actors.find((a) => a.id === wren.actorId)!.status = 'archived';
    expect(await undo(sam, spend)).toMatchObject({ ok: false, message: "That's changed since. Undo the later change first." });
    expect(coinsOf(wren)).toEqual({ heron: 25 });
  });

  // Purpose: the GM can't undo an Undo of coin; the refusal says to move the coin again, and nothing changes.
  it('an Undo of coin is not undone again, in the lead\'s words', async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 30 } });
    expect((await undo(gm, newestBy(gm))).ok).toBe(true);
    const reversal = newestBy(gm);
    expect(reversal.reverts_event_id).toBeTruthy();
    expect(await undo(gm, reversal)).toMatchObject({ ok: false, reason: 'failed', message: "An Undo of coin can't be undone. Move the coin again instead." });
    expect(coinsOf(wren)).toEqual({});
  });

  // Purpose: a player's take from a dead character goes back while it is still dead, and not once it is back in play.
  it('Undo of a take from a dead character: allowed while still dead, refused after', async () => {
    await as(gm, addCoin, { to: wren, coins: { heron: 12 } });
    const wrenRow = world.tables.actors.find((a) => a.id === wren.actorId)!;
    wrenRow.status = 'dead';
    await as(tess, takeCoin, { from: from(wren, true), to: moss, coins: { heron: 4 } });
    expect((await undo(tess, newestBy(tess))).ok).toBe(true);
    expect([coinsOf(wren), coinsOf(moss)]).toEqual([{ heron: 12 }, {}]);
    await as(tess, takeCoin, { from: from(wren, true), to: moss, coins: { heron: 4 } });
    const take = newestBy(tess);
    wrenRow.status = 'active';
    expect(await undo(tess, take)).toMatchObject({ ok: false, message: "That's changed since. Undo the later change first." });
    expect([coinsOf(wren), coinsOf(moss)]).toEqual([{ heron: 8 }, { heron: 4 }]);
  });
});
