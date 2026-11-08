import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState } from '../site/js/data/default-state.js';
import { TEST_CATALOG, createTestAttempt } from '../site/js/core/test-catalog.js';
import { runPairedTest, runTestSuite } from '../site/js/core/simulator.js';

test('runPairedTest returns baseline and Zero Trust outcomes for the same attempt', () => {
  const state = createDefaultState();
  const attempt = createTestAttempt('insufficient-privilege', state);
  const result = runPairedTest(attempt, state);
  assert.deepEqual(result.input, attempt);
  assert.equal(result.baseline.scenarioId, 'baseline');
  assert.equal(result.zeroTrust.scenarioId, 'zeroTrust');
  assert.equal(result.baseline.testId, attempt.testId);
  assert.equal(result.zeroTrust.testId, attempt.testId);
});

test('runPairedTest does not mutate either the attempt or application state', () => {
  const state = createDefaultState();
  const attempt = createTestAttempt('lateral-movement', state);
  const stateBefore = structuredClone(state);
  const attemptBefore = structuredClone(attempt);
  runPairedTest(attempt, state);
  assert.deepEqual(state, stateBefore);
  assert.deepEqual(attempt, attemptBefore);
});

test('runTestSuite executes selected cases in catalog order with paired decisions', () => {
  const state = createDefaultState();
  const results = runTestSuite(state, ['invalid-credential', 'critical-resource']);
  assert.deepEqual(results.map((item) => item.testId), ['invalid-credential', 'critical-resource']);
  assert.ok(results.every((item) => item.baseline && item.zeroTrust));
});

test('runTestSuite executes all seven cases when no selection is supplied', () => {
  const state = createDefaultState();
  const results = runTestSuite(state);
  assert.deepEqual(results.map((item) => item.testId), TEST_CATALOG.map((item) => item.id));
  assert.equal(results.length, 7);
});

test('unknown suite identifiers are rejected instead of silently omitted', () => {
  assert.throws(() => runTestSuite(createDefaultState(), ['not-a-test']), /teste|test/i);
});

test('re-running a paired test produces identical decisions and synthetic timings', () => {
  const state = createDefaultState();
  const attempt = createTestAttempt('compromised-device', state);
  assert.deepEqual(runPairedTest(attempt, state), runPairedTest(attempt, state));
});
