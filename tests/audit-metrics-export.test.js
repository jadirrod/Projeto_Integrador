import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState } from '../site/js/data/default-state.js';
import { createTestAttempt, PRESET_CATALOG, TEST_CATALOG } from '../site/js/core/test-catalog.js';
import { runPairedTest } from '../site/js/core/simulator.js';
import { appendPairedAuditEvents, clearAuditEvents } from '../site/js/core/audit.js';
import { calculateMetrics, getAccessibleResourcesByUser } from '../site/js/core/metrics.js';
import { exportEventsCsv, exportExperimentJson, exportReportCsv } from '../site/js/core/exporters.js';
import { buildExperimentReport } from '../site/js/ui/report.js';

const event = (overrides = {}) => ({
  eventId: 'event-000001', timestamp: '2026-11-07T12:00:00.000Z', scenarioId: 'baseline', scenarioLabel: 'Baseline',
  testId: 'insufficient-privilege', classification: 'adverse', userId: 'user-employee', userName: 'Diego Funcionário',
  deviceId: 'device-employee', deviceName: 'Estação U-04', origin: 'VLAN 20', destination: 'Banco de dados',
  resourceId: 'resource-database', resourceName: 'Banco de dados', outcome: 'DENY', reasons: ['Acesso negado'],
  policyId: 'policy-1', syntheticDecisionMs: 10, reachableResources: [],
  ...overrides,
});

test('paired decisions append two complete local audit events with stable IDs and one timestamp', () => {
  const state = createDefaultState();
  const pair = runPairedTest(createTestAttempt('critical-resource', state), state);
  const updated = appendPairedAuditEvents(state, pair, { timestamp: '2026-11-07T12:00:00.000Z' });
  assert.equal(state.events.length, 0);
  assert.equal(updated.events.length, 2);
  assert.deepEqual(updated.events.map((item) => item.eventId), ['event-000001', 'event-000002']);
  assert.deepEqual(updated.events.map((item) => item.scenarioId), ['baseline', 'zeroTrust']);
  assert.ok(updated.events.every((item) => item.timestamp === '2026-11-07T12:00:00.000Z'));
  for (const key of ['userId', 'deviceId', 'origin', 'destination', 'resourceId', 'testId', 'outcome', 'reasons', 'policyId', 'syntheticDecisionMs']) {
    assert.ok(Object.hasOwn(updated.events[0], key), `missing ${key}`);
  }
  assert.equal(updated.metadata.nextEventSequence, 3);
});

test('audit event stores the applied policy snapshot so later edits do not rewrite history', () => {
  const state = createDefaultState();
  const pair = runPairedTest(createTestAttempt('compromised-device', state), state);
  const updated = appendPairedAuditEvents(state, pair, { timestamp: '2026-11-07T12:00:00.000Z' });
  const snapshot = updated.events.find((item) => item.scenarioId === 'zeroTrust').policySnapshot;
  assert.equal(snapshot.blockCompromisedDevice, true);
  assert.equal(snapshot.enforceResourceMfa, true);
  assert.ok(snapshot.resourceRequirements.some((resource) => resource.id === 'resource-finance' && resource.requiresMfa));
  const later = structuredClone(updated);
  later.scenarios.zeroTrust.blockCompromisedDevice = false;
  assert.equal(later.events.find((item) => item.scenarioId === 'zeroTrust').policySnapshot.blockCompromisedDevice, true);
});

test('clearing audit events preserves monotonic event sequence and configuration', () => {
  const state = createDefaultState();
  state.events.push(event());
  state.metadata.nextEventSequence = 44;
  const cleared = clearAuditEvents(state);
  assert.deepEqual(cleared.events, []);
  assert.equal(cleared.metadata.nextEventSequence, 44);
  assert.equal(cleared.users.length, state.users.length);
});

test('empty metrics return null rates and no NaN or Infinity', () => {
  const metrics = calculateMetrics([], 'baseline');
  assert.equal(metrics.dataAvailable, false);
  assert.equal(metrics.totalAttempts, 0);
  assert.equal(metrics.blockRate, null);
  assert.equal(metrics.legitimateSuccessRate, null);
  assert.equal(metrics.meanSyntheticDecisionMs, null);
  assert.ok(Object.values(metrics).every((value) => typeof value !== 'number' || Number.isFinite(value)));
});

test('metrics count outcomes, adverse blocking, legitimate success, lateral stops and synthetic time per scenario', () => {
  const events = [
    event({ outcome: 'ALLOW', classification: 'legitimate', syntheticDecisionMs: 6, reachableResources: ['resource-files'] }),
    event({ eventId: 'e2', outcome: 'DENY', classification: 'adverse', syntheticDecisionMs: 8 }),
    event({ eventId: 'e3', outcome: 'RESTRICTED', classification: 'adverse', testId: 'lateral-movement', syntheticDecisionMs: 10, reachableResources: ['resource-files'] }),
    event({ eventId: 'e5', outcome: 'REVIEW', classification: 'adverse', testId: 'lateral-movement', syntheticDecisionMs: 40 }),
    event({ eventId: 'e4', scenarioId: 'zeroTrust', outcome: 'REVIEW', classification: 'adverse', syntheticDecisionMs: 50 }),
  ];
  const metrics = calculateMetrics(events, 'baseline');
  assert.equal(metrics.totalAttempts, 4);
  assert.equal(metrics.allowedCount, 1);
  assert.equal(metrics.deniedCount, 1);
  assert.equal(metrics.restrictedCount, 1);
  assert.equal(metrics.blockedCount, 2);
  assert.equal(metrics.adverseAttempts, 3);
  assert.equal(metrics.blockRate, 66.7);
  assert.equal(metrics.legitimateSuccessRate, 100);
  assert.equal(metrics.lateralAttempts, 2);
  assert.equal(metrics.lateralBlocked, 1);
  assert.equal(metrics.lateralReviewCount, 1);
  assert.equal(metrics.meanSyntheticDecisionMs, 16);
});

test('accessible resource aggregation groups historical events by user and scenario', () => {
  const events = [
    event({ outcome: 'ALLOW', reachableResources: ['resource-files', 'resource-app'] }),
    event({ eventId: 'e2', outcome: 'ALLOW', reachableResources: ['resource-files'] }),
    event({ eventId: 'e3', scenarioId: 'zeroTrust', outcome: 'ALLOW', reachableResources: ['resource-app'] }),
  ];
  const rows = getAccessibleResourcesByUser(events, 'baseline');
  assert.deepEqual(rows, [{ userId: 'user-employee', userName: 'Diego Funcionário', resourceIds: ['resource-app', 'resource-files'], count: 2 }]);
});

test('CSV export quotes commas, accents, line breaks and formula-like cells', () => {
  const csv = exportEventsCsv([event({ userName: '=SUM(1,1)', resourceName: 'Banco "Sul"\nNível 2', reasons: ['Acesso, negado'] })]);
  assert.match(csv, /"'=SUM\(1,1\)"/);
  assert.match(csv, /"Banco ""Sul""\r?\nNível 2"/);
  assert.match(csv, /"Acesso, negado"/);
  assert.match(csv, /ID do evento/);
});

test('JSON export returns valid, lossless UTF-8 text', () => {
  const report = { name: 'Experimento ágil', message: 'Citação "Zero Trust"', value: 12 };
  assert.deepEqual(JSON.parse(exportExperimentJson(report)), report);
});

test('experimental report includes all cases, presets, per-user resources, and a complete CSV export', () => {
  const state = createDefaultState();
  const pair = runPairedTest(createTestAttempt('critical-resource', state), state);
  const withEvents = appendPairedAuditEvents(state, pair, { timestamp: '2026-11-07T12:00:00.000Z' });
  const report = buildExperimentReport(withEvents, '2026-11-07T12:00:00.000Z');
  assert.equal(report.testCatalog.length, TEST_CATALOG.length);
  assert.equal(report.presets.length, PRESET_CATALOG.length);
  assert.ok(report.metricsByUser.baseline.some((row) => row.userName === 'Diego Funcionário'));
  assert.ok(report.metricsByUser.baseline.find((row) => row.userName === 'Diego Funcionário').resourceIds.includes('resource-finance'));
  const csv = exportReportCsv(report);
  assert.match(csv, /Métricas comparativas/);
  assert.match(csv, /Recursos alcançados por identidade/);
  assert.match(csv, /Eventos sintéticos/);
  assert.match(csv, /Sistema financeiro/);
  assert.match(csv, /Tentativas laterais em revisão/);
  assert.match(csv, /ALLOW/);
});

test('six presets reference only known test IDs and required cases remain seven', () => {
  assert.equal(PRESET_CATALOG.length, 6);
  const ids = new Set(TEST_CATALOG.map((item) => item.id));
  assert.ok(PRESET_CATALOG.every((preset) => preset.testIds.length > 0 && preset.testIds.every((id) => ids.has(id))));
  assert.equal(TEST_CATALOG.length, 7);
});
