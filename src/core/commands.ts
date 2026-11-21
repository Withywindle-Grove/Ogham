// Commands: the only way state changes (docs/02-architecture.md, Foundation 3).
// Each command has a name, a typed input, a permission rule and a run step.
// Screens call runCommand; can() lets them hide controls the user can't use.
// The database's access rules stay the real gate. Event writing is added inside run() in M2.
import type { PostgrestError } from '@supabase/supabase-js';
import { taggedDb, type LogLevel } from './eventTags.ts';
import type { Db } from './supabase.ts';

export type BaseRole = 'gm' | 'player';

/** The signed-in person: their id, their role in each campaign they belong to, and which of those are retired. */
export interface CurrentUser {
  id: string;
  roles: Readonly<Record<string, BaseRole>>; // campaignId -> role
  /** Campaigns retired by their GM: readable, but nothing in them can change. */
  retired?: readonly string[];
}

export type CommandResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      /** 'stale': saved from an old copy, refused (STALE); show the latest and let the person try again. */
      reason: 'not-allowed' | 'failed' | 'stale';
      message: string;
      /** The run's request id: try the same command again with it and the database won't apply it twice. */
      requestId?: string;
    };

/** What a command's run knows about itself: the request id every request it makes carries. */
export interface RunMeta {
  requestId: string;
}

export interface Command<Input, Target, Output> {
  name: string;
  /** What the permission rule looks at, worked out from the input. */
  target(input: Input): Target;
  /** The app's copy of the access rule. Must agree with the database's rules (tested). */
  allowed(user: CurrentUser, target: Target): boolean;
  /** `meta` comes from runCommand; a test calling run directly may leave it out (a new request id is made up). */
  run(db: Db, user: CurrentUser, input: Input, meta?: RunMeta): Promise<CommandResult<Output>>;
  /**
   * How its events show in the log: "simple" (the default view) or "verbose" (everything, e.g. every HP tick).
   * "none" for account-level commands that aren't campaign events. Defaults to "simple".
   */
  log?: LogLevel | 'none';
  /**
   * When running it is a GM ruling (fiat): the GM using a player's own power on what that player owns.
   * Logged with the fiat seal and the optional reason; the database honours fiat only for the GM.
   */
  fiat?(user: CurrentUser, target: Target): boolean;
  /** True only for bringing a retired campaign back: every other command in a retired campaign is refused. */
  whileRetired?: boolean;
}

/** Helps TypeScript infer a command's types from its definition. */
export function defineCommand<Input, Target, Output>(
  command: Command<Input, Target, Output>,
): Command<Input, Target, Output> {
  return command;
}

// Commands of any type, as stored in the registry.
type AnyCommand = Command<never, unknown, unknown>;

export interface CommandRegistry {
  register(command: AnyCommand): void;
  has(name: string): boolean;
  names(): string[];
  /** A command's log level ("simple" unless it says otherwise); undefined if there's no such command. */
  logLevel(name: string): LogLevel | 'none' | undefined;
  /** can(user, command, target): may this user run this command on this target? */
  can(user: CurrentUser | null, commandName: string, target: unknown): boolean;
}

export function createRegistry(): CommandRegistry {
  const commands = new Map<string, AnyCommand>();
  return {
    register(command) {
      if (commands.has(command.name)) throw new Error(`Command "${command.name}" is already registered.`);
      commands.set(command.name, command);
    },
    has: (name) => commands.has(name),
    names: () => [...commands.keys()].sort(),
    logLevel: (name) => (commands.has(name) ? (commands.get(name)!.log ?? 'simple') : undefined),
    can(user, commandName, target) {
      const command = commands.get(commandName);
      if (!user || !command) return false;
      if (!command.whileRetired && inRetiredCampaign(user, target)) return false;
      return command.allowed(user, target);
    },
  };
}

export const RETIRED = 'This campaign is retired, so nothing in it can change.';

/** Is the target in a campaign its GM has retired? (Campaign targets carry their campaignId.) */
function inRetiredCampaign(user: CurrentUser, target: unknown): boolean {
  const campaignId = typeof target === 'object' && target !== null ? (target as { campaignId?: unknown }).campaignId : undefined;
  return typeof campaignId === 'string' && (user.retired ?? []).includes(campaignId);
}

/** Runs a command: checks permission first, never throws (errors come back as a failed result). */
export async function runCommand<Input, Target, Output>(
  registry: CommandRegistry,
  db: Db,
  user: CurrentUser | null,
  command: Command<Input, Target, Output>,
  input: Input,
  /**
   * The reason for a GM ruling, if this run is one (see Command.fiat); and the request id, when this is the same
   * command tried again (a retry keeps its first id, so the database applies it once).
   */
  context: { reason?: string; requestId?: string } = {},
): Promise<CommandResult<Output>> {
  if (!registry.has(command.name)) return failed(`"${command.name}" isn't a registered command.`);
  const target = command.target(input);
  if (user && !command.whileRetired && inRetiredCampaign(user, target)) return notAllowed(RETIRED);
  if (!user || !registry.can(user, command.name, target)) return notAllowed();
  const requestId = context.requestId ?? crypto.randomUUID();
  try {
    // The database logs every change this command makes under its name (see eventTags.ts).
    const log = command.log ?? 'simple';
    const fiat = command.fiat?.(user, target) ?? false;
    const tagged =
      log === 'none' ? db : taggedDb(db, { type: command.name, level: log, fiat, reason: fiat ? context.reason : undefined, requestId });
    const result = await command.run(tagged, user, input, { requestId });
    return withRequest(result, requestId);
  } catch (error) {
    return withRequest(failed<Output>(error instanceof Error ? error.message : 'Something went wrong.'), requestId);
  }
}

/** A failed result says its request id, so the caller can try the same command again with it. */
function withRequest<T>(result: CommandResult<T>, requestId: string): CommandResult<T> {
  return result.ok ? result : { ...result, requestId };
}

/** The request id of this run (made up when a test calls run directly, without runCommand). */
export const requestIdOf = (meta?: RunMeta): string => meta?.requestId ?? crypto.randomUUID();

// Helpers for command results.

export const ok = <T>(value: T): CommandResult<T> => ({ ok: true, value });

export const notAllowed = <T>(message = "You don't have permission to do that."): CommandResult<T> => ({
  ok: false,
  reason: 'not-allowed',
  message,
});

export const failed = <T>(message: string): CommandResult<T> => ({ ok: false, reason: 'failed', message });

/**
 * A save made from an old copy, refused by the database (supabase/migrations/…_m5_intents.sql, code GR409): the
 * words the person sees, in the voice of undo's "That's changed since. Undo the later change first."
 */
export const STALE = "That's changed since. Here's the latest.";
export const STALE_CODE = 'GR409';

export const stale = <T>(): CommandResult<T> => ({ ok: false, reason: 'stale', message: STALE });

/** A database error as a result: refused (42501), saved from an old copy (GR409), or failed with its words. */
export function fromError<T>(error: { code?: string; message: string }): CommandResult<T> {
  return error.code === '42501' ? notAllowed() : error.code === STALE_CODE ? stale() : failed(error.message);
}

/**
 * Turns a database write (insert, update or delete with .select()) into a command result.
 * The access rules refuse writes either with an error (code 42501) or by matching no rows.
 */
export function fromWrite<T>(result: { data: T[] | null; error: PostgrestError | null }): CommandResult<T> {
  if (result.error) return fromError(result.error);
  const row = result.data?.[0];
  return row === undefined ? notAllowed() : ok(row);
}

export function isGm(user: CurrentUser, campaignId: string): boolean {
  return user.roles[campaignId] === 'gm';
}

export function isMember(user: CurrentUser, campaignId: string): boolean {
  return user.roles[campaignId] !== undefined;
}
