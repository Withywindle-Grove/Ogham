// Guards the GitHub workflow files against a YAML slip that makes a whole file invalid (2026-11-02: preview.yml's
// one-line `run:` held "Preview (test database): <url>", so GitHub rejected the file and no preview ever ran).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = '.github/workflows'
const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))

// A one-line value (not a | or > block, not quoted) that contains ": " is a YAML error.
export function badOneLiners(text) {
  const bad = []
  text.split('\n').forEach((line, i) => {
    const m = /^\s*(?:-\s+)?run:\s+(.*)$/.exec(line)
    if (!m) return
    const value = m[1].trim()
    if (/^[|>]/.test(value) || /^['"]/.test(value)) return
    if (/: /.test(value) || value.endsWith(':')) bad.push(i + 1)
  })
  return bad
}

describe('workflow files', () => {
  it('a one-line run command with ": " in it is caught', () => {
    expect(badOneLiners('    steps:\n      - run: echo "a: b"\n')).toEqual([2])
    expect(badOneLiners('      - run: |\n          echo "a: b"\n')).toEqual([])
  })

  it.each(files)('%s has no one-line run command that breaks YAML', (f) => {
    expect(badOneLiners(readFileSync(join(dir, f), 'utf8'))).toEqual([])
  })

  // 2026-11-02: review.yml passed --json-schema and read structured_output; it never arrived, so no review was posted
  // and the real error stayed hidden. A workflow may use --json-schema only if it also reads structured_output.
  it.each(files)('%s uses --json-schema only together with structured_output', (f) => {
    const text = readFileSync(join(dir, f), 'utf8')
    if (text.includes('--json-schema')) expect(text).toContain('structured_output')
  })

  // retro-3 (2026-11-27): 6 of 196 database shards on GitHub's machines failed to bind 54322, most likely because an
  // outgoing download had been given it as its own port. The shards reserve the Supabase ports before anything
  // downloads, and retry the start only when the port is what failed.
  it("check.yml's database shards reserve the Supabase ports before any download, and retry only a held port", () => {
    const text = readFileSync(join(dir, 'check.yml'), 'utf8')
    const job = text.slice(text.indexOf('  database-shard:'), text.indexOf('\n  database:'))
    const reserve = job.indexOf('net.ipv4.ip_local_reserved_ports=54320-54329')
    expect(reserve).toBeGreaterThan(-1)
    expect(reserve).toBeLessThan(job.indexOf('actions/checkout'))
    expect(job).toContain("if: runner.environment == 'github-hosted'")
    expect(job).toContain("ss -Htan 'sport = :54322'")
    expect(job).toContain("grep -q 'address already in use'")
    expect(job).toContain('for attempt in 1 2 3')
  })

  it('review.yml posts the plain-text result read from the execution file', () => {
    const text = readFileSync(join(dir, 'review.yml'), 'utf8')
    expect(text).not.toContain('--json-schema')
    expect(text).toContain('steps.review.outputs.execution_file')
    expect(text).toContain('result: ${{ steps.text.outputs.body }}')
  })

  // 2026-11-02: the review runs once per pull request, not on every push, so a busy day can't use up the $40 cap;
  // the "review" label asks for it again.
  it('review.yml runs once per pull request and again only on the review label', () => {
    const text = readFileSync(join(dir, 'review.yml'), 'utf8')
    const types = /types:\s*\[([^\]]*)\]/.exec(text)?.[1] ?? ''
    expect(types).not.toContain('synchronize')
    expect(types).toContain('labeled')
    expect(text).toContain("github.event.label.name == 'review'")
  })
})
