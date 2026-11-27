// Check 3 (hard rule 9): compares the package list in docs/02-architecture.md, "Packages", with package.json's
// dependencies and devDependencies, by name only (versions are never compared). App packages pair with
// dependencies, dev-only packages with devDependencies. Pure, so a test can run it on planted text and on the real files.

const DOC = 'docs/02-architecture.md';
const SIDES = [
  { heading: 'App packages', field: 'dependencies' },
  { heading: 'Dev-only packages', field: 'devDependencies' },
] as const;

// The other groups npm reads; none is used, so an entry in any of them fails instead of passing unseen.
const UNUSED = ['optionalDependencies', 'peerDependencies', 'bundleDependencies', 'bundledDependencies'] as const;

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  bundleDependencies?: string[] | boolean;
  bundledDependencies?: string[] | boolean;
}

/** The names listed under each "###" heading of the "## Packages" section, one `- \`name\`` line each. */
function listed(doc: string): Map<string, string[]> | null {
  const lines = doc.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === '## Packages');
  if (start < 0) return null;
  const groups = new Map<string, string[]>();
  let group: string[] | null = null;
  for (const line of lines.slice(start + 1)) {
    if (/^## /.test(line)) break;
    const heading = /^### (.+?)\s*$/.exec(line)?.[1];
    if (heading !== undefined) groups.set(heading, (group = []));
    const item = /^- `([^`]+)`/.exec(line)?.[1];
    if (item !== undefined && group) group.push(item);
  }
  return SIDES.every((s) => groups.has(s.heading)) ? groups : null;
}

export function packageProblems(doc: string, pkg: PackageJson): string[] {
  const groups = listed(doc);
  if (!groups) return [`${DOC} has no "## Packages" list with "### App packages" and "### Dev-only packages"`];
  const problems: string[] = [];
  for (const field of UNUSED) {
    const entries = pkg[field];
    const names = Array.isArray(entries) ? entries : entries && typeof entries === 'object' ? Object.keys(entries) : entries ? ['(all)'] : [];
    if (names.length > 0) problems.push(`package.json has ${field} (${names.join(', ')}): the list in ${DOC} has app and dev-only packages only`);
  }
  const lists = SIDES.map(({ heading, field }) => ({ heading, field, inList: new Set(groups.get(heading)), installed: Object.keys(pkg[field] ?? {}) }));
  for (const { heading, field, inList, installed } of lists) {
    for (const name of installed) {
      if (inList.has(name)) continue;
      const other = lists.find((l) => l.field !== field && l.inList.has(name));
      if (other) problems.push(`\`${name}\` is listed in ${DOC} (${other.heading}) but installed in package.json (${field}): move it to one side`);
      else problems.push(`\`${name}\` is in package.json (${field}) but missing from the list in ${DOC} (${heading})`);
    }
    for (const name of inList) {
      if (installed.includes(name)) continue;
      // Already reported above, from the side it is installed on.
      if (lists.some((l) => l.field !== field && l.installed.includes(name) && !l.inList.has(name))) continue;
      problems.push(`\`${name}\` is in the list in ${DOC} (${heading}) but missing from package.json (${field})`);
    }
  }
  return problems;
}
