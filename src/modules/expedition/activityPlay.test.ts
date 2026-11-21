// Who may run an activity (ac-1, ruled 2026-11-11; plan docs/plans/m5b-ac-1.md). The database's apply_activity holds
// the same rule (supabase/tests/m5b-3-activities.test.ts). Purposes:
//   In an activity one character does, a player may name their own characters and hirelings, and no one else's.
//   The GM may name anyone.
//   An activity several or the party do is open to the group, whoever's characters are named.
//   Someone the GM owns (no player) can't be named by a player in an activity one character does.
//   A player whose characters aren't in the group can't run it at all, whatever the kind.
import { describe, expect, it } from 'vitest';
import type { CurrentUser } from '../../core/commands.ts';
import { mayDoActivity, type ActivityTarget } from './activityPlay.ts';

const sam: CurrentUser = { id: 'sam', roles: { camp: 'player' } };
const gail: CurrentUser = { id: 'gail', roles: { camp: 'gm' } };
const target = (who: ActivityTarget['who'], ownersNamed: (string | null)[], mine = true): ActivityTarget => ({ campaignId: 'camp', group: 1, mine, who, ownersNamed });

describe('who may run an activity (ac-1)', () => {
  it('in an activity one character does, a player names their own characters and hirelings, and no one else’s', () => {
    expect(mayDoActivity(sam, target('one', ['sam']))).toBe(true);
    expect(mayDoActivity(sam, target('one', ['sam', 'sam']))).toBe(true);
    expect(mayDoActivity(sam, target('one', ['pat']))).toBe(false);
    expect(mayDoActivity(sam, target('one', ['sam', 'pat']))).toBe(false);
  });

  it('the GM names anyone', () => {
    expect(mayDoActivity(gail, target('one', ['pat'], false))).toBe(true);
  });

  it('an activity several or the party do is open to the group', () => {
    expect(mayDoActivity(sam, target('several', ['sam', 'pat']))).toBe(true);
    expect(mayDoActivity(sam, target('party', ['pat', null]))).toBe(true);
  });

  it("a player can't name someone the GM owns in an activity one character does", () => {
    expect(mayDoActivity(sam, target('one', [null]))).toBe(false);
  });

  it("a player whose characters aren't in the group can't run it, whatever the kind", () => {
    expect(mayDoActivity(sam, target('several', ['sam'], false))).toBe(false);
    expect(mayDoActivity(sam, target('one', ['sam'], false))).toBe(false);
  });
});
