import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function freePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((done, reject) => socket.close((error) => error ? reject(error) : done()));
  return port;
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Static server exited early with ${child.exitCode}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return response;
    } catch { /* startup can take a short moment */ }
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error('Static server did not become ready within 5 seconds.');
}

test('local HTTP server serves styled entrypoint and only static site assets', async (t) => {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [join(root, 'scripts', 'serve.mjs')], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let serverError = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { serverError += chunk; });
  t.after(async () => {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
    if (child.exitCode === null) await Promise.race([once(child, 'exit'), new Promise((done) => setTimeout(done, 1500))]);
    if (child.exitCode === null) child.kill('SIGKILL');
  });

  const htmlResponse = await waitForServer(`${baseUrl}/`, child);
  assert.match(htmlResponse.headers.get('content-type'), /text\/html/);
  const html = await htmlResponse.text();
  assert.match(html, /\.\/assets\/css\/tokens\.css/);
  assert.match(html, /\.\/assets\/css\/app\.css/);
  assert.match(html, /\.\/js\/ui\/app\.js/);

  const css = await fetch(`${baseUrl}/assets/css/app.css`);
  assert.equal(css.status, 200, serverError);
  assert.match(css.headers.get('content-type'), /text\/css/);
  assert.match(await css.text(), /\.sidebar\s*\{/);

  const module = await fetch(`${baseUrl}/js/ui/app.js`);
  assert.equal(module.status, 200);
  assert.match(module.headers.get('content-type'), /javascript/);
  assert.match(await module.text(), /initDashboardUI/);

  const logo = await fetch(`${baseUrl}/assets/images/brand-mark.svg`);
  assert.equal(logo.status, 200);
  assert.match(logo.headers.get('content-type'), /image\/svg\+xml/);

  const escapedFile = await fetch(`${baseUrl}/%252e%252e/README.md`);
  assert.equal(escapedFile.status, 404);
  const rejectedMethod = await fetch(`${baseUrl}/`, { method: 'POST' });
  assert.equal(rejectedMethod.status, 405);
});
