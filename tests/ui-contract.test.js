import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = join(root, 'site', 'index.html');
const html = readFileSync(htmlPath, 'utf8');

function getUiFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    return entry.isDirectory() ? getUiFiles(fullPath) : entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

test('public HTML has unique IDs for every control and view', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(ids.length >= 70);
  assert.equal(new Set(ids).size, ids.length, 'duplicate HTML id');
});

test('all literal getElementById references in UI modules exist in the HTML', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const missing = [];
  for (const path of getUiFiles(join(root, 'site', 'js', 'ui'))) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)) {
      if (!ids.has(match[1])) missing.push(`${path}: ${match[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('all local module imports and linked assets resolve within the site tree', () => {
  for (const path of getUiFiles(join(root, 'site', 'js', 'ui'))) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const target = resolve(dirname(path), match[1]);
      assert.ok(existsSync(target), `${path} imports missing ${match[1]}`);
    }
  }
  for (const match of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)) {
    const target = resolve(join(root, 'site'), match[1]);
    assert.ok(existsSync(target), `HTML references missing local asset ${match[1]}`);
  }
});

test('Chart.js CDN is version-pinned and only the static UMD file is included', () => {
  assert.match(html, /chart\.umd\.min\.js/);
  assert.match(html, /chart\.js@4\.6\.1/);
  assert.doesNotMatch(html, /chart\.js@latest/);
});

test('forms do not submit to a remote endpoint and the app uses a local module entrypoint', () => {
  assert.match(html, /type="module" src="\.\/js\/ui\/app\.js"/);
  assert.doesNotMatch(html, /<form[^>]+action="https?:/i);
});

test('the UI exposes resource MFA, lateral-path results, and report CSV export', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  for (const id of ['resource-requires-mfa', 'topology-paths', 'topology-path-empty', 'report-export-csv']) assert.ok(ids.has(id), `missing ${id}`);
  assert.match(html, /data-policy-field="enforceResourceMfa"/);
  const dashboard = readFileSync(join(root, 'site', 'js', 'ui', 'dashboard.js'), 'utf8');
  assert.match(dashboard, /\$\{metric\.reviewCount\} REVIEW/);
});

test('batch execution updates audit state per pair and yields between visible progress updates', () => {
  const runner = readFileSync(join(root, 'site', 'js', 'ui', 'test-runner.js'), 'utf8');
  assert.match(runner, /lastPairs\.push\(pair\);[\s\S]*?context\.updateState\(next,/);
  assert.match(runner, /await new Promise\(\(resolve\) => window\.setTimeout\(resolve, 32\)\)/);
});
