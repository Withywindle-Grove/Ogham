// Placeholder: proves the wiring to the test project works.
// Real access-rule tests (e.g. a player can't read another player's purse) arrive with M1's tables.
import { describe, expect, it } from 'vitest';
import { adminClient, readTestProject, visitorClient } from './testProject.ts';

const project = readTestProject();

describe('test project connection', () => {
  it('reaches the test project as a signed-out visitor', async () => {
    const { data, error } = await visitorClient(project).auth.getSession();
    expect(error).toBeNull();
    expect(data.session).toBeNull();

    const health = await fetch(`${project.url}/auth/v1/health`, {
      headers: { apikey: project.publishableKey },
    });
    expect(health.ok).toBe(true);
  });

  it('can manage test users with the secret key', async () => {
    const { error } = await adminClient(project).auth.admin.listUsers({ page: 1, perPage: 1 });
    expect(error).toBeNull();
  });

  it('refuses settings that point at the main project', () => {
    expect(() =>
      readTestProject({
        VITE_SUPABASE_URL: 'https://nplkqwzjdprpgpklatji.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'invented-key',
        SUPABASE_SECRET_KEY: 'invented-secret',
      }),
    ).toThrow(/main project/);
  });

  it('refuses a project URL with a path after it', () => {
    expect(() =>
      readTestProject({
        VITE_SUPABASE_URL: 'https://inventedref.supabase.co/rest/v1/',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'invented-key',
        SUPABASE_SECRET_KEY: 'invented-secret',
      }),
    ).toThrow(/nothing after it/);
  });

  it('accepts a throwaway local Supabase (as CI uses)', () => {
    expect(
      readTestProject({
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'invented-key',
        SUPABASE_SECRET_KEY: 'invented-secret',
      }).url,
    ).toBe('http://127.0.0.1:54321');
  });
});
