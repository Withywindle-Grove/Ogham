// The sent-back note's author line (22-G5, fix-creation-review-foot): "<Name>, your GM, <when>". TEST project only;
// invented. Purpose: a member player whose character was sent back can read exactly what the author line needs (the
// GM's display name as players already see it, and the review's day) and nothing more of the GM's account. These are
// the reads loadSentBackBy (src/core/myCharacters.ts) makes, under the read rules as they stand: no new rule. If a
// read is refused, the author line doesn't show; nothing falls back to a wider read.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { createCharacter, reviewCharacter } from '../../src/modules/characters/commands.ts';
import { buildWorld, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe("the sent-back note's author line", () => {
  it('the player reads who sent it back and when, and the GM name in the two columns asked; others read neither', async () => {
    const made = await as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name: 'Moss', level: 1 });
    if (!made.ok) throw new Error(made.message);
    const sent = await as(world.gm, reviewCharacter, { character: made.value, decision: 'rejected' as const, note: 'A gentler name?' });
    if (!sent.ok) throw new Error(sent.message);

    // loadSentBackBy's first read: the send-back line in the log, as the character's player.
    const reviewLines = (person: Person) =>
      person.db
        .from('events')
        .select('id, actor_user_id, after, created_at, seq, reverts_event_id')
        .eq('type', 'character.review')
        .eq('target_table', 'actors')
        .eq('target_id', made.value.id)
        .order('seq', { ascending: false });
    const mine = await reviewLines(world.playerA);
    expect(mine.error).toBeNull();
    const line = (mine.data ?? []).find((r) => (r.after as Record<string, unknown> | null)?.approval === 'rejected');
    expect(line, 'the player reads the send-back line').toBeDefined();
    expect(line!.actor_user_id).toBe(world.gm.id);
    expect(Number.isNaN(new Date(line!.created_at).getTime())).toBe(false);

    // Its undo check: no line reverts it.
    const reverted = await world.playerA.db.from('events').select('reverts_event_id').in('reverts_event_id', [line!.id]);
    expect(reverted.error).toBeNull();
    expect(reverted.data).toEqual([]);

    // The second read: the GM's display name and whether they chose it, the two columns asked, as fellow members read them.
    const gmProfile = await world.playerA.db.from('profiles').select('display_name, named_at').eq('id', world.gm.id).maybeSingle();
    expect(gmProfile.error).toBeNull();
    expect(gmProfile.data).not.toBeNull();
    expect(Object.keys(gmProfile.data!).sort()).toEqual(['display_name', 'named_at']);

    // Another player of the campaign doesn't read the line (the character is not approved: its lines are its player's).
    const theirs = await reviewLines(world.playerB);
    expect(theirs.error).toBeNull();
    expect(theirs.data).toEqual([]);

    // Someone outside the campaign reads neither the line nor the GM's name.
    const outside = await reviewLines(world.outsider);
    expect(outside.data ?? []).toEqual([]);
    const outsideProfile = await world.outsider.db.from('profiles').select('display_name, named_at').eq('id', world.gm.id).maybeSingle();
    expect(outsideProfile.data).toBeNull();
  });
});
