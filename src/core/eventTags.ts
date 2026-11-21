// Tagging requests so the database can log them. The database writes every event itself (a trigger on each
// table, in the same transaction as the change; see supabase/migrations/…_m2_events.sql). Each command's
// requests carry a header naming the event, its log level, an id shared by everything the command does, and
// (for the GM) fiat and a reason. Untagged writes are still logged, under a plain name like "actors.update".
// Each request also says which of the command's requests it is (`part`: 0, 1, 2… in order), so the database can
// tell a repeat (the same request id and part sent again, after an answer was lost) and change nothing
// (supabase/migrations/…_m5_intents.sql). The request id stays the same when a command is tried again.
import type { Db } from './supabase.ts';

export type LogLevel = 'simple' | 'verbose';

export interface EventTag {
  /** The event's name: the command's name, e.g. "character.setHp". */
  type: string;
  level: LogLevel;
  /** Shared by every event one command writes. Made up if left out. */
  requestId?: string;
  /** Which of the command's requests this is (0, 1, 2…); set by taggedDb for each request. */
  part?: number;
  /** Only honoured for the GM (the database checks). */
  fiat?: boolean;
  reason?: string;
}

export const EVENT_HEADER = 'x-grimoire-command';

/** The header's value: the tag as JSON, base64-encoded so any text (a reason in any language) fits in a header. */
export function encodeEventTag(tag: EventTag): string {
  const json = JSON.stringify({
    type: tag.type,
    level: tag.level,
    requestId: tag.requestId ?? crypto.randomUUID(),
    fiat: tag.fiat ?? false,
    reason: tag.reason?.trim() || null,
    ...(tag.part !== undefined ? { part: tag.part } : {}),
  });
  let binary = '';
  for (const byte of new TextEncoder().encode(json)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

type Headed = { headers?: { set?: (name: string, value: string) => void }; setHeader?: (name: string, value: string) => unknown };

/**
 * The same database connection, but every request made through it carries this tag, numbered in the order the
 * command makes them (run the same command again with the same request id and the numbers match).
 */
export function taggedDb(db: Db, tag: EventTag): Db {
  const fixed = { ...tag, requestId: tag.requestId ?? crypto.randomUUID() };
  let part = 0;
  const next = () => encodeEventTag({ ...fixed, part: part++ });
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property === 'from') {
        return (relation: string) => {
          const query = target.from(relation as never) as unknown as Headed;
          // Each query copies the client's headers, so this tags only this request.
          query.headers?.set?.(EVENT_HEADER, next());
          return query;
        };
      }
      if (property === 'rpc') {
        return (...args: unknown[]) => {
          const call = (target.rpc as (...a: unknown[]) => unknown)(...args) as Headed;
          return typeof call.setHeader === 'function' ? call.setHeader(EVENT_HEADER, next()) : call;
        };
      }
      const found = Reflect.get(target, property, receiver) as unknown;
      return typeof found === 'function' ? (found as (...a: unknown[]) => unknown).bind(target) : found;
    },
  });
}
