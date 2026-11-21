// Checked by the type check (npm run typecheck); the run itself only confirms the file loads.
import { describe, expectTypeOf, it } from 'vitest';
import type { Database as Generated } from './database.types.ts';
import type { Database } from './databaseWithNulls.ts';

type Args<F extends keyof Database['public']['Functions']> = Database['public']['Functions'][F]['Args'];

describe("the app's database description", () => {
  it('lets the arguments without a default that the SQL reads null for be sent as null', () => {
    expectTypeOf<null>().toMatchTypeOf<Args<'apply_activity'>['finder']>();
    expectTypeOf<null>().toMatchTypeOf<Args<'light_light'>['burn_seconds']>();
    expectTypeOf<null>().toMatchTypeOf<Args<'light_light'>['warn_seconds']>();
    expectTypeOf<null>().toMatchTypeOf<Args<'light_light'>['fuel_item']>();
    expectTypeOf<null>().toMatchTypeOf<Args<'refill_and_light'>['warn_seconds']>();
    expectTypeOf<null>().toMatchTypeOf<Args<'set_place_picture'>['asset']>();
  });

  it('keeps every other argument, table and function exactly as generated', () => {
    expectTypeOf<Args<'light_light'>['actor']>().toEqualTypeOf<string>();
    expectTypeOf<Args<'set_place_picture'>['place']>().toEqualTypeOf<string>();
    expectTypeOf<Database['public']['Functions']['douse_light']>().toEqualTypeOf<Generated['public']['Functions']['douse_light']>();
    expectTypeOf<Database['public']['Tables']>().toEqualTypeOf<Generated['public']['Tables']>();
  });
});
