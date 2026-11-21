// The database's description as the app uses it: the generated file (`npm run db:types`), plus the few function
// arguments that take null on purpose. A Postgres function's arguments always accept null, but the generator can't
// tell which ones mean something by it, so it types them all as never null. An argument with `default null` needs
// nothing here (leave it out and it is null); one without a default, where the SQL reads null as "none", is listed
// below so it can be sent as null. Never edit database.types.ts by hand: regenerating it would undo the edit.
import type { Database as Generated } from './database.types.ts';

type Functions = Generated['public']['Functions'];

/** Per function, the arguments (without a default) that the SQL reads null for. */
type NullableArgs = {
  /** No finder when nothing was found (checked only when something was). */
  apply_activity: 'finder';
  /** A light with no timer, no warning or no fuel. */
  light_light: 'burn_seconds' | 'warn_seconds' | 'fuel_item';
  /** No warning before it burns out. */
  refill_and_light: 'warn_seconds';
  /** Null takes the picture away. */
  set_place_picture: 'asset';
};

type WithNulls<A, K extends keyof A> = Omit<A, K> & { [P in K]: A[P] | null };

type AppFunctions = {
  [F in keyof Functions]: F extends keyof NullableArgs
    ? Omit<Functions[F], 'Args'> & { Args: WithNulls<Functions[F]['Args'], NullableArgs[F] & keyof Functions[F]['Args']> }
    : Functions[F];
};

export type Database = Omit<Generated, 'public'> & {
  public: Omit<Generated['public'], 'Functions'> & { Functions: AppFunctions };
};
