import { describe, expect, it } from 'vitest';
import { checkEnv } from './env.ts';

describe('checkEnv', () => {
  it('returns both values when they are set', () => {
    const result = checkEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    });
    expect(result).toEqual({
      ok: true,
      env: {
        supabaseUrl: 'https://example.supabase.co',
        supabasePublishableKey: 'sb_publishable_example',
      },
    });
  });

  it('names every missing or blank setting', () => {
    const result = checkEnv({ VITE_SUPABASE_URL: '  ' });
    expect(result).toEqual({
      ok: false,
      missing: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'],
    });
  });
});
