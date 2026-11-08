import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState } from '../site/js/data/default-state.js';
import { upsertUser, deleteUser, upsertResource, deleteResource, updateScenarioPolicy, upsertNetworkRule, deleteNetworkRule } from '../site/js/core/management.js';
import { runPairedTest } from '../site/js/core/simulator.js';
import { createTestAttempt } from '../site/js/core/test-catalog.js';

const userForm = {
  id: 'user-new', name: 'Pessoa Fictícia', groupId: 'employees', role: 'employee',
  accountStatus: 'active', credentialValid: true, privilegeLevel: 1,
  deviceId: 'device-employee', allowedResourceIds: ['resource-files'], remoteAllowed: false,
};
const resourceForm = {
  id: 'resource-new', name: 'Serviço de demonstração', type: 'service', ip: '10.30.30.99',
  segmentId: 'vlan-30-servers', criticality: 'low', requiredPrivilege: 1,
  allowedGroups: ['employees'],
};

test('upsertUser creates and edits only fictional users with valid linked references', () => {
  const state = createDefaultState();
  const created = upsertUser(state, userForm);
  assert.equal(created.users.at(-1).fictional, true);
  const edited = upsertUser(created, { ...userForm, name: 'Pessoa Fictícia Editada' });
  assert.equal(edited.users.filter((user) => user.id === userForm.id).length, 1);
  assert.equal(edited.users.at(-1).name, 'Pessoa Fictícia Editada');
  assert.throws(() => upsertUser(state, { ...userForm, deviceId: 'missing-device' }), /dispositivo/i);
  assert.throws(() => upsertUser(state, { ...userForm, groupId: 'missing-group' }), /grupo/i);
});

test('deleteUser removes the selected user and protects the final administrator', () => {
  const state = createDefaultState();
  assert.throws(() => deleteUser(state, 'user-admin'), /últim|administrador/i);
  const added = upsertUser(state, { ...userForm, id: 'user-admin-2', name: 'Admin Fictício', groupId: 'administrators', role: 'administrator', privilegeLevel: 4 });
  const withoutFirst = deleteUser(added, 'user-admin');
  assert.equal(withoutFirst.users.some((user) => user.id === 'user-admin'), false);
});

test('upsertResource accepts private fictitious addresses and rejects public or malformed addresses', () => {
  const state = createDefaultState();
  const created = upsertResource(state, resourceForm);
  assert.equal(created.resources.at(-1).synthetic, true);
  assert.equal(created.resources.at(-1).requiresMfa, false);
  assert.throws(() => upsertResource(state, { ...resourceForm, ip: '8.8.8.8' }), /privado|fictício/i);
  assert.throws(() => upsertResource(state, { ...resourceForm, ip: 'not-an-ip' }), /IP|endereço/i);
  assert.throws(() => upsertResource(state, { ...resourceForm, requiresMfa: 'yes' }), /MFA/i);
});

test('resource MFA requirement is configurable and preserved as an explicit property', () => {
  const state = createDefaultState();
  const created = upsertResource(state, { ...resourceForm, requiresMfa: true });
  assert.equal(created.resources.at(-1).requiresMfa, true);
  const updated = upsertResource(created, { ...resourceForm, requiresMfa: false });
  assert.equal(updated.resources.at(-1).requiresMfa, false);
});

test('deleting a resource removes stale grants and network-rule references', () => {
  const state = createDefaultState();
  const edited = deleteResource(state, 'resource-files');
  assert.equal(edited.resources.some((resource) => resource.id === 'resource-files'), false);
  assert.ok(edited.users.every((user) => !user.allowedResourceIds.includes('resource-files')));
  assert.ok(Object.values(edited.scenarios).every((scenario) => scenario.networkRules.every((rule) => !rule.resourceIds.includes('resource-files'))));
});

test('policy edits affect new decisions but preserve prior event snapshots', () => {
  const state = createDefaultState();
  const attempt = createTestAttempt('compromised-device', state);
  const before = runPairedTest(attempt, state);
  state.events.push({ eventId: 'evt-before', testId: attempt.testId, policyId: before.zeroTrust.policyId, outcome: before.zeroTrust.outcome });
  const changed = updateScenarioPolicy(state, 'zeroTrust', { blockCompromisedDevice: false });
  const after = runPairedTest(attempt, changed);
  assert.equal(before.zeroTrust.outcome, 'RESTRICTED');
  assert.notEqual(after.zeroTrust.outcome, 'RESTRICTED');
  assert.equal(changed.events[0].outcome, 'RESTRICTED');
  assert.equal(changed.events[0].policyId, 'block-compromised-device');
});

test('network rules validate segment/resource references and determine new network decisions', () => {
  const state = createDefaultState();
  const rule = { id: 'test-deny-files', name: 'Bloqueio de demonstração', priority: 1, sourceSegments: ['vlan-20-users'], destinationSegments: ['vlan-30-servers'], resourceIds: ['resource-files'], effect: 'DENY' };
  const changed = upsertNetworkRule(state, 'zeroTrust', rule);
  const attempt = { userId: 'user-employee', deviceId: 'device-employee', resourceId: 'resource-files' };
  assert.equal(runPairedTest(attempt, changed).zeroTrust.outcome, 'DENY');
  assert.throws(() => upsertNetworkRule(state, 'zeroTrust', { ...rule, sourceSegments: ['not-a-segment'] }), /segmento/i);
  assert.throws(() => upsertNetworkRule(state, 'zeroTrust', { ...rule, effect: 'MAYBE' }), /ALLOW|DENY/i);
  const removed = deleteNetworkRule(changed, 'zeroTrust', rule.id);
  assert.equal(removed.scenarios.zeroTrust.networkRules.some((item) => item.id === rule.id), false);
});
