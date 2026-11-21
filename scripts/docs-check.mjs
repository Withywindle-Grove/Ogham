// npm run docs:check (part of npm run check, so it runs in the GitHub Check job too): catches the docs drifting
// from the repo. Each problem is one plain line naming the file to fix. The generated references
// (docs/generated/) are checked by npm test (src/testing/commandsDoc.test.ts, scripts/visibility-matrix.test.mjs).
//   1. Relative links in Markdown files point at files that exist.
//   2. Every ruling file (docs/design/rulings/) starts with a valid header.
//   3. The mockup index (docs/design/mockups/index.md) matches the pictures in the folder.
//   4. The components inventory's Code column (docs/06) names files that exist.
//   5. Every row of the modelling-gaps register (docs/11) has a valid status and kind.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const STATUSES = ['pending', 'absorbed', 'superseded'];
const GAP_STATUSES = ['open', 'verify', 'ruled', 'done', 'wontfix'];
const GAP_KINDS = ['🟡', '🔴'];
const MOCKUP_STATUSES = ['current', 'superseded'];

/** Markdown links that point at a file in the repo: [text](path) and ![alt](path), minus web, mail and #anchor links. */
export function relativeLinks(markdown) {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return [...withoutCode.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map((m) => m[1])
    .filter((target) => !/^(https?:|mailto:|#|data:)/i.test(target))
    .map((target) => decodeURIComponent(target.split('#')[0]))
    .filter(Boolean);
}

/** Problems with a ruling file's header (an empty list when it's fine). */
export function rulingHeaderProblems(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text.replace(/^\uFEFF/, ''));
  if (!m) return ['it has no header (a --- block with status, milestone, absorbed-into and supersedes)'];
  const fields = Object.fromEntries(
    m[1].split(/\r?\n/).map((line) => {
      const i = line.indexOf(':');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );
  const problems = [];
  for (const key of ['status', 'milestone', 'absorbed-into', 'supersedes']) if (!fields[key]) problems.push(`its header has no "${key}"`);
  if (fields.status && !STATUSES.includes(fields.status)) problems.push(`its status "${fields.status}" isn't one of ${STATUSES.join(', ')}`);
  if (fields.status === 'absorbed' && (!fields['absorbed-into'] || fields['absorbed-into'] === '—'))
    problems.push('it is marked absorbed but "absorbed-into" doesn\'t say where');
  return problems;
}

/** Table rows of a Markdown page as arrays of trimmed cells (header and divider rows included). */
function tableRows(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^\|.*\|\s*$/.test(line))
    .map((line) => line.trim().slice(1, -1).split(/(?<!\\)\|/).map((cell) => cell.trim()));
}

/** Problems with the modelling-gaps register's rows. */
export function gapRowProblems(markdown) {
  const problems = [];
  for (const cells of tableRows(markdown)) {
    if (!/^G-\d+$/.test(cells[0] ?? '')) continue;
    const kind = cells[2] ?? '';
    const status = (cells[cells.length - 1] ?? '').split(/[\s(]/)[0];
    if (!GAP_KINDS.includes(kind)) problems.push(`${cells[0]}: the kind "${kind}" isn't one of ${GAP_KINDS.join(' ')}`);
    if (!GAP_STATUSES.includes(status)) problems.push(`${cells[0]}: the status "${status}" isn't one of ${GAP_STATUSES.join(', ')}`);
  }
  return problems;
}

/** The mockup index's rows: { image, status } for each row that links a picture. */
export function mockupRows(markdown) {
  return tableRows(markdown)
    .map((cells) => ({ link: /\]\(([^)]+)\)/.exec(cells[0] ?? '')?.[1], status: cells[cells.length - 1] }))
    .filter((row) => row.link)
    .map((row) => ({ image: decodeURIComponent(row.link), status: row.status }));
}

/** File names in the inventory's Code cells: backticked names ending in a code file extension. */
export function inventoryCodeFiles(markdown) {
  const files = [];
  let codeColumn = -1;
  for (const cells of tableRows(markdown)) {
    if (cells.includes('Code')) {
      codeColumn = cells.indexOf('Code');
      continue;
    }
    if (codeColumn < 0 || cells.every((c) => /^-+$/.test(c))) continue;
    const cell = cells[codeColumn] ?? '';
    for (const m of cell.matchAll(/`([\w./-]+\.(?:tsx|ts|css|mjs|html|json))`/g)) files.push(m[1]);
  }
  return files;
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const posixPath = (path) => path.split('\\').join('/');

function main() {
  const problems = [];
  const say = (file, problem) => problems.push(`${posixPath(file)}: ${problem}`);
  const tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '*.md'], { encoding: 'utf8' })
    .split('\0')
    .filter((f) => f && existsSync(f) && !f.startsWith('node_modules/'));

  // 1. Relative links.
  for (const file of tracked) {
    for (const target of relativeLinks(readFileSync(file, 'utf8'))) {
      const path = target.startsWith('/') ? target.slice(1) : posix.join(posix.dirname(posixPath(file)), target);
      if (!existsSync(path)) say(file, `the link "${target}" points at nothing (${path} doesn't exist)`);
    }
  }

  // 2. Ruling headers.
  const rulings = 'docs/design/rulings';
  if (existsSync(rulings)) {
    for (const file of walk(rulings).filter((f) => f.endsWith('.md'))) {
      for (const problem of rulingHeaderProblems(readFileSync(file, 'utf8'))) say(file, problem);
    }
  }

  // 3. Mockup index against the folder.
  const mockups = 'docs/design/mockups';
  const index = join(mockups, 'index.md');
  if (existsSync(mockups)) {
    const rows = existsSync(index) ? mockupRows(readFileSync(index, 'utf8')) : [];
    if (!existsSync(index)) say(index, 'the mockup index is missing');
    const listed = new Set(rows.map((row) => posix.normalize(row.image)));
    for (const row of rows) {
      if (!existsSync(join(mockups, row.image))) say(index, `lists ${row.image}, which isn't in the folder`);
      if (!MOCKUP_STATUSES.includes(row.status)) say(index, `${row.image}: the status "${row.status}" isn't one of ${MOCKUP_STATUSES.join(', ')}`);
    }
    for (const picture of walk(mockups).filter((f) => /\.(png|jpe?g|webp|svg)$/i.test(f))) {
      const rel = posixPath(relative(mockups, picture));
      if (!listed.has(rel)) say(index, `has no row for ${rel} (add one: image, ruling, light/dark, status)`);
    }
  }

  // 4. Inventory Code paths.
  const inventory = 'docs/06-screens-and-design.md';
  if (existsSync(inventory)) {
    const srcFiles = walk('src').map(posixPath);
    for (const name of inventoryCodeFiles(readFileSync(inventory, 'utf8'))) {
      const found = name.includes('/') ? existsSync(name) : srcFiles.some((f) => f.endsWith(`/${name}`));
      if (!found) say(inventory, `the components inventory's Code column names ${name}, which doesn't exist`);
    }
  }

  // 5. Modelling-gaps register rows.
  const gaps = 'docs/11-modelling-gaps.md';
  if (existsSync(gaps)) for (const problem of gapRowProblems(readFileSync(gaps, 'utf8'))) say(gaps, problem);

  if (problems.length) {
    console.error(`The docs check found ${problems.length} problem(s). Fix the file named at the start of each line:\n`);
    for (const problem of problems) console.error(`- ${problem}`);
    return 1;
  }
  console.log('Docs check passed: links, ruling headers, mockup index, inventory paths and the gaps register.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main());
}
