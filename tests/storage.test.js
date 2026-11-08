import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState, STORAGE_SCHEMA_VERSION } from '../site/js/data/default-state.js';
import { createTestAttempt } from '../site/js/core/test-catalog.js';
import { runPairedTest } from '../site/js/core/simulator.js';
import { appendPairedAuditEvents } from '../site/js/core/audit.js';
import { loadState, resetDemoState, saveState, STORAGE_KEY } from '../site/js/core/storage.js';

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    peek(key) { return values.get(key) ?? null; },
  };
}

function createStateWithEvents() {
  const state = createDefaultState();
  const pair = runPairedTest(createTestAttempt('critical-resource', state), state);
  return appendPairedAuditEvents(state, pair, { timestamp: '2026-11-07T12:00:00.000Z' });
}

test('missing local state returns an isolated demonstrative state without a recovery warning', () => {
  const storage = createMemoryStorage();
  const loaded = loadState(storage);
  assert.equal(loaded.state.schemaVersion, STORAGE_SCHEMA_VERSION);
  assert.equal(loaded.state.users.length, 6);
  assert.equal(loaded.recoveryNotice, null);
  assert.equal(loaded.source, 'demo');
  loaded.state.users.pop();
  assert.equal(loadState(storage).state.users.length, 6);
});

test('save and load preserve user configuration and event history', () => {
  const storage = createMemoryStorage();
  const state = createStateWithEvents();
  state.users[0].name = 'Nome fictício editado';
  saveState(state, storage);
  const loaded = loadState(storage);
  assert.equal(loaded.source, 'local');
  assert.equal(loaded.recoveryNotice, null);
  assert.equal(loaded.state.users[0].name, 'Nome fictício editado');
  assert.deepEqual(loaded.state.events, state.events);
});

test('invalid JSON recovers to defaults with a visible reason and without throwing', () => {
  const storage = createMemoryStorage({ [STORAGE_KEY]: '{broken' });
  const loaded = loadState(storage);
  assert.equal(loaded.source, 'recovered');
  assert.match(loaded.recoveryNotice, /inválid|recuperad/i);
  assert.equal(loaded.state.users.length, 6);
});

test('schema-version mismatch recovers to defaults instead of interpreting stale data', () => {
  const oldState = createDefaultState();
  oldState.schemaVersion += 1;
  const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify(oldState) });
  const loaded = loadState(storage);
  assert.equal(loaded.source, 'recovered');
  assert.match(loaded.recoveryNotice, /versão|incompatível/i);
  assert.equal(loaded.state.schemaVersion, STORAGE_SCHEMA_VERSION);
});

test('resetDemoState clears local history and stores a fresh default state', () => {
  const storage = createMemoryStorage();
  const dirty = createStateWithEvents();
  saveState(dirty, storage);
  const reset = resetDemoState(storage);
  assert.equal(reset.events.length, 0);
  assert.equal(loadState(storage).state.events.length, 0);
});

test('saving malformed state fails explicitly instead of persisting partial data', () => {
  assert.throws(() => saveState({ users: [] }, createMemoryStorage()), /estado|schema|versão/i);
});

test('malformed nested resources, policies, and audit events recover to a safe demo state', () => {
  const malformed = [];
  const resourceState = createDefaultState();
  resourceState.resources[0].allowedGroups = null;
  malformed.push(resourceState);
  const policyState = createDefaultState();
  policyState.scenarios.zeroTrust.networkRules = null;
  malformed.push(policyState);
  const eventState = createDefaultState();
  eventState.events.push({ eventId: 'incomplete-event' });
  malformed.push(eventState);

  for (const state of malformed) {
    const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify(state) });
    const loaded = loadState(storage);
    assert.equal(loaded.source, 'recovered');
    assert.match(loaded.recoveryNotice, /valida|recuper|incompat/i);
    assert.equal(loaded.state.events.length, 0);
  }
});

test('storage exceptions return recoverable defaults on read and clear errors on write', () => {
  const denied = { getItem() { throw new Error('security denied'); }, setItem() { throw new Error('quota'); } };
  const loaded = loadState(denied);
  assert.equal(loaded.source, 'recovered');
  assert.match(loaded.recoveryNotice, /armazenamento|local/i);
  assert.throws(() => saveState(createDefaultState(), denied), /salvar|armazenamento|persist/i);
});
