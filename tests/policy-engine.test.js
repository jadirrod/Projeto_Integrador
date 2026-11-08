import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState } from '../site/js/data/default-state.js';
import { buildScenarioConfig, evaluateAttempt } from '../site/js/core/policy-engine.js';
import { TEST_CATALOG, createTestAttempt } from '../site/js/core/test-catalog.js';

function evaluate(state, scenarioId, attempt) {
  return evaluateAttempt(attempt, buildScenarioConfig(state, scenarioId));
}

test('demo state contains fictional identities, devices, resources, six VLANs and two named scenarios', () => {
  const state = createDefaultState();
  assert.ok(state.users.length >= 5);
  assert.ok(state.groups.length >= 5);
  assert.ok(state.devices.length >= 5);
  assert.ok(state.resources.length >= 6);
  assert.deepEqual(state.events, []);
  assert.equal(state.segments.filter((segment) => segment.vlan !== null).length, 6);
  assert.deepEqual(Object.keys(state.scenarios), ['baseline', 'zeroTrust']);
  assert.ok(state.users.every((user) => user.fictional === true));
  assert.ok(state.resources.every((resource) => resource.synthetic === true));
});

test('the seven required synthetic test cases have stable identifiers and attempts', () => {
  assert.deepEqual(TEST_CATALOG.map((item) => item.id), [
    'invalid-credential',
    'insufficient-privilege',
    'compromised-device',
    'lateral-movement',
    'unauthorized-remote',
    'privilege-escalation',
    'critical-resource',
  ]);
  const state = createDefaultState();
  for (const item of TEST_CATALOG) {
    const attempt = createTestAttempt(item.id, state);
    assert.equal(attempt.testId, item.id);
    assert.ok(attempt.userId);
    assert.ok(attempt.resourceId || attempt.path?.length);
  }
});

test('invalid credentials fail authentication in both architectures', () => {
  const state = createDefaultState();
  const attempt = createTestAttempt('invalid-credential', state);
  for (const scenarioId of ['baseline', 'zeroTrust']) {
    const result = evaluate(state, scenarioId, attempt);
    assert.equal(result.authentication.status, 'FAIL');
    assert.equal(result.outcome, 'DENY');
    assert.ok(result.reasons.length > 0);
  }
});

test('Zero Trust enforces least privilege for a database while the illustrative baseline remains coarse-grained', () => {
  const state = createDefaultState();
  const attempt = createTestAttempt('insufficient-privilege', state);
  assert.equal(evaluate(state, 'baseline', attempt).outcome, 'ALLOW');
  const strictResult = evaluate(state, 'zeroTrust', attempt);
  assert.equal(strictResult.outcome, 'DENY');
  assert.equal(strictResult.authorization.status, 'DENY');
  assert.match(strictResult.reasons.join(' '), /privilégio|grupo|autorizad/i);
});

test('a compromised device is permitted only by the deliberately coarse baseline, then restricted by Zero Trust', () => {
  const state = createDefaultState();
  const attempt = createTestAttempt('compromised-device', state);
  assert.equal(evaluate(state, 'baseline', attempt).outcome, 'ALLOW');
  const strictResult = evaluate(state, 'zeroTrust', attempt);
  assert.equal(strictResult.outcome, 'RESTRICTED');
  assert.equal(strictResult.reachableResources.length, 0);
});

test('lateral movement returns only resources reached before a policy denies the next hop', () => {
  const state = createDefaultState();
  const attempt = createTestAttempt('lateral-movement', state);
  const baseline = evaluate(state, 'baseline', attempt);
  const zeroTrust = evaluate(state, 'zeroTrust', attempt);
  assert.deepEqual(baseline.reachableResources, attempt.path);
  assert.deepEqual(zeroTrust.reachableResources, ['resource-files']);
  assert.equal(baseline.outcome, 'ALLOW');
  assert.equal(zeroTrust.outcome, 'RESTRICTED');
  assert.equal(zeroTrust.hops.length, 2);
  assert.equal(zeroTrust.hops[1].resourceId, 'resource-database');
  assert.equal(zeroTrust.hops[1].outcome, 'DENY');
});

test('remote access without VPN or MFA is allowed by the sample baseline but denied by Zero Trust', () => {
  const state = createDefaultState();
  const attempt = createTestAttempt('unauthorized-remote', state);
  assert.equal(evaluate(state, 'baseline', attempt).outcome, 'ALLOW');
  const strictResult = evaluate(state, 'zeroTrust', attempt);
  assert.equal(strictResult.outcome, 'DENY');
  assert.match(strictResult.reasons.join(' '), /VPN|MFA|multifator/i);
});

test('privilege escalation is denied in both scenarios', () => {
  const state = createDefaultState();
  const attempt = createTestAttempt('privilege-escalation', state);
  for (const scenarioId of ['baseline', 'zeroTrust']) {
    assert.equal(evaluate(state, scenarioId, attempt).outcome, 'DENY');
  }
});

test('critical resources require an authorized group under Zero Trust', () => {
  const state = createDefaultState();
  const attempt = createTestAttempt('critical-resource', state);
  assert.equal(evaluate(state, 'baseline', attempt).outcome, 'ALLOW');
  assert.equal(evaluate(state, 'zeroTrust', attempt).outcome, 'DENY');
});

test('Zero Trust requires resource-specific MFA when configured and grants after successful step-up', () => {
  const state = createDefaultState();
  const attempt = { userId: 'user-admin', deviceId: 'device-admin', resourceId: 'resource-finance', mfaVerified: false };
  assert.equal(evaluate(state, 'baseline', attempt).outcome, 'ALLOW');
  const noMfa = evaluate(state, 'zeroTrust', attempt);
  assert.equal(noMfa.outcome, 'DENY');
  assert.equal(noMfa.authentication.status, 'STEP_UP_REQUIRED');
  assert.match(noMfa.reasons.join(' '), /MFA.*recurso/i);
  const verified = evaluate(state, 'zeroTrust', { ...attempt, mfaVerified: true });
  assert.equal(verified.outcome, 'ALLOW');
});

test('unknown users, devices and resources fail closed without throwing', () => {
  const state = createDefaultState();
  const config = buildScenarioConfig(state, 'zeroTrust');
  for (const attempt of [
    { userId: 'missing-user', resourceId: 'resource-files' },
    { userId: 'user-employee', deviceId: 'missing-device', resourceId: 'resource-files' },
    { userId: 'user-employee', resourceId: 'missing-resource' },
  ]) {
    const result = evaluateAttempt(attempt, config);
    assert.equal(result.outcome, 'DENY');
    assert.ok(result.reasons.length > 0);
  }
});

test('decision results and synthetic decision time are deterministic for identical input', () => {
  const state = createDefaultState();
  const attempt = createTestAttempt('lateral-movement', state);
  const first = evaluate(state, 'zeroTrust', attempt);
  const second = evaluate(state, 'zeroTrust', attempt);
  assert.deepEqual(first, second);
  assert.ok(Number.isInteger(first.syntheticDecisionMs));
  assert.ok(first.syntheticDecisionMs > 0);
  assert.equal(first.timeBasis, 'synthetic-rule-model');
});

test('invalid scenario configuration raises a clear setup error', () => {
  assert.throws(() => buildScenarioConfig(createDefaultState(), 'missing'), /cenário|scenario/i);
});
