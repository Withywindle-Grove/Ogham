// The pure parts of scripts/db-push-test.mjs (ruled 2026-11-11, db-1; plan docs/plans/process-db-1.md), kept apart so
// the script always runs its main and the tests import these without running it.

/**
 * The versions TEST holds that this branch doesn't, from `supabase migration list` text output: the table rows whose
 * Local column is empty and whose Remote column is a version. Throws when the output has no table whose first two
 * columns are exactly Local and Remote, so a changed CLI format stops the push instead of pushing blind.
 */
export function remoteOnlyVersions(listOutput) {
  // Outside an interactive terminal the CLI prints the list as one JSON line ({"migrations":[{local, remote, time}]};
  // database session 4, 2026-11-12): read the same pairs from it.
  for (const line of listOutput.split(/\r?\n/)) {
    if (!line.trimStart().startsWith('{')) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (!parsed || !Array.isArray(parsed.migrations)) continue;
    return parsed.migrations
      .filter((m) => m && (m.local ?? '') === '' && /^\d{14}$/.test(String(m.remote ?? '')))
      .map((m) => String(m.remote));
  }
  const rows = listOutput.split(/\r?\n/).filter((line) => line.includes('|'));
  const cells = (line) => line.split('|').map((cell) => cell.trim());
  const header = rows.findIndex((line) => {
    const [first, second] = cells(line);
    return first === 'Local' && second === 'Remote';
  });
  if (header === -1) throw new Error('could not read the migration list (no Local | Remote table).');
  const versions = [];
  for (const line of rows.slice(header + 1)) {
    const [local = '', remote = ''] = cells(line);
    if (/^-+$/.test(local) || /^-+$/.test(remote)) continue;
    if (local === '' && /^\d{14}$/.test(remote)) versions.push(remote);
  }
  return versions;
}

/**
 * A backstop against misreading the list: a version said to be held only on TEST must not be one of this branch's own
 * files. Throws with the clashing versions.
 */
export function checkHeldAgainstLocal(held, localFiles) {
  const local = new Set(localFiles.map((name) => name.slice(0, 14)));
  const clash = held.filter((version) => local.has(version));
  if (clash.length > 0) throw new Error(`the list says TEST alone holds ${clash.join(', ')}, but this branch has them: stopped rather than guess.`);
}

/** The empty stand-in for a version TEST holds from another pull request: never run, only counted as applied. */
export function stubFile(version) {
  return {
    name: `${version}_held_on_test.sql`,
    text: `-- Stand-in for ${version}, applied to TEST by another open pull request (scripts/db-push-test.mjs).\n`,
  };
}

/**
 * The push's arguments, always with --include-all; with something held, from the temporary copy (`--workdir`,
 * the folder that holds its supabase/), so this branch's migrations go on top of the held ones.
 */
export function pushArgs(dbUrl, held, work) {
  // Always --include-all: a branch's migration can be stamped older than TEST's newest even with nothing held (session 2, 2026-11-12).
  return held.length === 0 ? ['db', 'push', '--db-url', dbUrl, '--include-all'] : ['db', 'push', '--db-url', dbUrl, '--include-all', '--workdir', work];
}
