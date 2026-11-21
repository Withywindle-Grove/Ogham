// A migration that pauses triggers, writes rows, then turns the triggers back on must first run the deferred
// checks ("set constraints all immediate"). Otherwise, when rows were written, Postgres refuses to re-enable the
// trigger ("pending trigger events", SQLSTATE 55006). This passes on the empty test project and fails on the main
// one (2026-11-02: the g5 migration). Checked from 20261102130000 on; older migrations are applied and were fine.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = 'supabase/migrations'
const FROM = '20261102130000'

/** True when the SQL re-enables a trigger after writing rows without running the deferred checks in between. */
export function reenablesWithPendingChecks(sql) {
  const text = sql.replace(/--[^\n]*/g, '').toLowerCase()
  const disable = text.indexOf('disable trigger')
  if (disable < 0) return false
  const enable = text.indexOf('enable trigger', disable)
  if (enable < 0) return false
  const between = text.slice(disable, enable)
  const writes = /\b(insert\s+into|update\s+[\w.]+\s|delete\s+from)/.test(between)
  return writes && !between.includes('set constraints all immediate')
}

const files = readdirSync(dir).filter((f) => f.endsWith('.sql') && f.slice(0, 14) >= FROM)

describe('migrations that pause triggers', () => {
  it('a write between pausing and re-enabling triggers needs the deferred checks run first', () => {
    const bad = 'alter table t disable trigger x;\ninsert into t values (1);\nalter table t enable trigger x;'
    const good = 'alter table t disable trigger x;\ninsert into t values (1);\nset constraints all immediate;\nalter table t enable trigger x;'
    expect(reenablesWithPendingChecks(bad)).toBe(true)
    expect(reenablesWithPendingChecks(good)).toBe(false)
    expect(reenablesWithPendingChecks('alter table t disable trigger x;\nalter table t enable trigger x;')).toBe(false)
  })

  it.each(files)('%s runs the deferred checks before re-enabling triggers', (f) => {
    expect(reenablesWithPendingChecks(readFileSync(join(dir, f), 'utf8'))).toBe(false)
  })
})
