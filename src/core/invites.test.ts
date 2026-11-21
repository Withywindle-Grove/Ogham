import { describe, expect, it } from 'vitest';
import { inviteCodeFromPath, inviteLink, normalizeInviteCode } from './invites.ts';

describe('invite codes', () => {
  it('ignores capitals, spaces and dashes in a typed code', () => {
    expect(normalizeInviteCode(' k7qm 2xpa ')).toBe('K7QM2XPA');
    expect(normalizeInviteCode('K7QM-2XPA')).toBe('K7QM2XPA');
  });
});

describe('invite links', () => {
  it('reads the code from a /join link', () => {
    expect(inviteCodeFromPath('/join/k7qm2xpa')).toBe('K7QM2XPA');
    expect(inviteCodeFromPath('/join/K7QM2XPA/')).toBe('K7QM2XPA');
  });

  it("treats other addresses as not an invite", () => {
    for (const path of ['/', '/join', '/join/', '/join/K7QM2XPA/extra', '/joined/K7QM2XPA']) {
      expect(inviteCodeFromPath(path), path).toBeNull();
    }
  });

  it('builds a link that reads back to the same code', () => {
    const link = inviteLink('https://grimoire.example', 'K7QM2XPA');
    expect(link).toBe('https://grimoire.example/join/K7QM2XPA');
    expect(inviteCodeFromPath(new URL(link).pathname)).toBe('K7QM2XPA');
  });
});
