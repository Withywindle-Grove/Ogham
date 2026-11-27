// Check 3 (hard rule 9): compares the package list in docs/02-architecture.md, "Packages", with package.json's
// dependencies and devDependencies, by name only (versions are never compared). App packages pair with
// dependencies, dev-only packages with devDependencies. Pure, so a test can run it on planted text and on the real files.

const DOC = 'docs/02-architecture.md';
const SIDES = [
  { heading: 'App packages', field: 'dependencies' },
  { heading: 'Dev-only packages', field: 'devDependencies' },
] as const;

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
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
    const heading = /^### (.+?)\s*$/.exec(line);
    if (heading) groups.set(heading[1]!, (group = []));
    const item = /^- `([^`]+)`/.exec(line);
    if (item && group) group.push(item[1]!);
  }
  return SIDES.every((s) => groups.has(s.heading)) ? groups : null;
}

export function packageProblems(doc: string, pkg: PackageJson): string[] {
  const groups = listed(doc);
  if (!groups) return [`${DOC} has no "## Packages" list with "### App packages" and "### Dev-only packages"`];
  const problems: string[] = [];
  for (const { heading, field } of SIDES) {
    const inList = new Set(groups.get(heading));
    const installed = Object.keys(pkg[field] ?? {});
    for (const name of installed) if (!inList.has(name)) problems.push(`\`${name}\` is in package.json (${field}) but missing from the list in ${DOC} (${heading})`);
    for (const name of inList) if (!installed.includes(name)) problems.push(`\`${name}\` is in the list in ${DOC} (${heading}) but missing from package.json (${field})`);
  }
  return problems;
}
