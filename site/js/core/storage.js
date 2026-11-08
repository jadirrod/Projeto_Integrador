import { createDefaultState, STORAGE_SCHEMA_VERSION } from '../data/default-state.js';

export const STORAGE_KEY = 'zero-trust-lab-state';

const ACCOUNT_STATES = new Set(['active', 'suspended', 'disabled']);
const TRUST_STATES = new Set(['trusted', 'untrusted', 'compromised']);
const CRITICALITIES = new Set(['low', 'medium', 'high', 'critical']);
const OUTCOMES = new Set(['ALLOW', 'DENY', 'RESTRICTED', 'REVIEW']);
const CLASSIFICATIONS = new Set(['adverse', 'legitimate', 'unclassified']);
const SCENARIO_FLAGS = [
  'enforceDeviceTrust', 'blockCompromisedDevice', 'requireVpnForRemote', 'requireMfaForRemote',
  'enforceResourceGroups', 'enforceUserResourceGrants', 'enforceMinimumPrivilege', 'enforceResourceMfa',
];

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = (value) => typeof value === 'string' && value.length > 0;
const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isNullableString = (value) => value === null || typeof value === 'string';

function isNetworkRuleShape(rule) {
  return isRecord(rule)
    && isString(rule.id)
    && isString(rule.name)
    && Number.isInteger(rule.priority) && rule.priority >= 0
    && ['ALLOW', 'DENY'].includes(rule.effect)
    && isStringArray(rule.sourceSegments) && rule.sourceSegments.length > 0
    && isStringArray(rule.destinationSegments) && rule.destinationSegments.length > 0
    && isStringArray(rule.resourceIds);
}

function isEvent(event) {
  const snapshot = event?.policySnapshot;
  return isRecord(event)
    && /^event-\d+$/.test(event.eventId ?? '')
    && typeof event.timestamp === 'string' && Number.isFinite(Date.parse(event.timestamp))
    && isString(event.experimentId)
    && isString(event.testId) && isString(event.testName)
    && CLASSIFICATIONS.has(event.classification)
    && ['baseline', 'zeroTrust'].includes(event.scenarioId)
    && isString(event.scenarioLabel)
    && isNullableString(event.userId) && isString(event.userName)
    && isNullableString(event.deviceId) && isString(event.deviceName)
    && isString(event.origin) && isString(event.destination)
    && isNullableString(event.resourceId) && isString(event.resourceName)
    && isStringArray(event.requestedResourceIds)
    && OUTCOMES.has(event.outcome)
    && isRecord(event.authentication) && isString(event.authentication.status)
    && isRecord(event.authorization) && isString(event.authorization.status)
    && isStringArray(event.reasons)
    && isNullableString(event.policyId)
    && Number.isFinite(event.syntheticDecisionMs) && event.syntheticDecisionMs >= 0
    && isString(event.timeBasis)
    && isStringArray(event.reachableResources)
    && Array.isArray(event.decisionTrace) && event.decisionTrace.every((item) => isRecord(item)
      && isString(item.check) && typeof item.passed === 'boolean' && typeof item.reason === 'string')
    && event.synthetic === true
    && isRecord(snapshot)
    && snapshot.scenarioId === event.scenarioId
    && isString(snapshot.label) && isString(snapshot.mode)
    && SCENARIO_FLAGS.every((field) => typeof snapshot[field] === 'boolean')
    && ['allow', 'deny'].includes(snapshot.defaultNetworkPolicy)
    && Array.isArray(snapshot.networkRules) && snapshot.networkRules.every(isNetworkRuleShape)
    && Array.isArray(snapshot.resourceRequirements) && snapshot.resourceRequirements.every((resource) => isRecord(resource)
      && isString(resource.id) && isString(resource.name)
      && typeof resource.requiresMfa === 'boolean'
      && Number.isInteger(resource.requiredPrivilege)
      && isStringArray(resource.allowedGroups))
    && Number.isInteger(snapshot.stateRevision) && snapshot.stateRevision >= 0;
}

function isScenario(id, scenario, segmentIds, resourceIds) {
  return isRecord(scenario)
    && scenario.id === id
    && isString(scenario.label) && isString(scenario.mode)
    && SCENARIO_FLAGS.every((field) => typeof scenario[field] === 'boolean')
    && ['allow', 'deny'].includes(scenario.defaultNetworkPolicy)
    && Number.isInteger(scenario.syntheticBaseMs) && scenario.syntheticBaseMs >= 0 && scenario.syntheticBaseMs <= 1000
    && Number.isInteger(scenario.syntheticCheckMs) && scenario.syntheticCheckMs >= 0 && scenario.syntheticCheckMs <= 1000
    && Array.isArray(scenario.networkRules)
    && scenario.networkRules.every((rule) => isNetworkRuleShape(rule)
      && rule.sourceSegments.every((segmentId) => segmentId === '*' || segmentIds.has(segmentId))
      && rule.destinationSegments.every((segmentId) => segmentId === '*' || segmentIds.has(segmentId))
      && rule.resourceIds.every((resourceId) => resourceId === '*' || resourceIds.has(resourceId)));
}

export function isValidState(state) {
  if (!isRecord(state) || state.schemaVersion !== STORAGE_SCHEMA_VERSION) return false;
  if (!Number.isInteger(state.revision) || state.revision < 0) return false;
  if (!isRecord(state.experiment) || !isString(state.experiment.id) || !isString(state.experiment.name) || state.experiment.synthetic !== true) return false;
  if (!Array.isArray(state.users) || !Array.isArray(state.groups) || !Array.isArray(state.devices)
    || !Array.isArray(state.resources) || !Array.isArray(state.segments) || !Array.isArray(state.events)) return false;
  if (!isRecord(state.metadata) || !Number.isInteger(state.metadata.nextEventSequence) || state.metadata.nextEventSequence < 1
    || !isString(state.metadata.disclosure)) return false;

  const groupIds = new Set(state.groups.map((group) => group?.id));
  const deviceIds = new Set(state.devices.map((device) => device?.id));
  const segmentIds = new Set(state.segments.map((segment) => segment?.id));
  const resourceIds = new Set(state.resources.map((resource) => resource?.id));
  if ([groupIds, deviceIds, segmentIds, resourceIds].some((ids) => ids.has(undefined) || ids.has(null) || ids.size === 0)) return false;

  if (!state.groups.every((group) => isRecord(group) && isString(group.id) && isString(group.name) && group.fictional === true)) return false;
  if (!state.segments.every((segment) => isRecord(segment) && isString(segment.id) && isString(segment.name)
    && isString(segment.cidr) && isString(segment.zone) && (segment.vlan === null || Number.isInteger(segment.vlan))
    && segment.fictional === true)) return false;
  if (!state.devices.every((device) => isRecord(device) && isString(device.id) && isString(device.name)
    && TRUST_STATES.has(device.trustStatus) && isString(device.segmentId) && segmentIds.has(device.segmentId)
    && typeof device.encrypted === 'boolean' && device.fictional === true)) return false;
  if (!state.resources.every((resource) => isRecord(resource) && isString(resource.id) && isString(resource.name)
    && isString(resource.type) && isString(resource.ip) && isString(resource.segmentId) && segmentIds.has(resource.segmentId)
    && CRITICALITIES.has(resource.criticality) && Number.isInteger(resource.requiredPrivilege)
    && resource.requiredPrivilege >= 0 && resource.requiredPrivilege <= 4 && typeof resource.requiresMfa === 'boolean'
    && isStringArray(resource.allowedGroups) && resource.allowedGroups.every((groupId) => groupIds.has(groupId))
    && resource.fictional === true && resource.synthetic === true)) return false;
  if (!state.users.every((user) => isRecord(user) && isString(user.id) && isString(user.name)
    && isString(user.groupId) && groupIds.has(user.groupId) && isString(user.role)
    && ACCOUNT_STATES.has(user.accountStatus) && typeof user.credentialValid === 'boolean'
    && Number.isInteger(user.privilegeLevel) && user.privilegeLevel >= 0 && user.privilegeLevel <= 4
    && isString(user.deviceId) && deviceIds.has(user.deviceId) && typeof user.remoteAllowed === 'boolean'
    && isStringArray(user.allowedResourceIds) && user.allowedResourceIds.every((resourceId) => resourceIds.has(resourceId))
    && user.fictional === true)) return false;

  if (!isRecord(state.scenarios)
    || !isScenario('baseline', state.scenarios.baseline, segmentIds, resourceIds)
    || !isScenario('zeroTrust', state.scenarios.zeroTrust, segmentIds, resourceIds)) return false;
  if (!state.events.every(isEvent)) return false;
  const eventSequences = state.events.map((event) => Number(event.eventId.slice('event-'.length)));
  if (eventSequences.some((sequence) => !Number.isSafeInteger(sequence) || sequence < 1)
    || (eventSequences.length && state.metadata.nextEventSequence <= Math.max(...eventSequences))) return false;
  return true;
}

function recoveredState(recoveryNotice) {
  return { state: createDefaultState(), recoveryNotice, source: 'recovered' };
}

export function loadState(storage) {
  if (!storage || typeof storage.getItem !== 'function') {
    return recoveredState('Armazenamento local indisponível; os dados demonstrativos foram carregados sem persistência.');
  }

  let serialized;
  try {
    serialized = storage.getItem(STORAGE_KEY);
  } catch {
    return recoveredState('Não foi possível ler o armazenamento local; os dados demonstrativos foram recuperados nesta sessão.');
  }
  if (serialized === null || serialized === undefined || serialized === '') {
    return { state: createDefaultState(), recoveryNotice: null, source: 'demo' };
  }

  let state;
  try {
    state = JSON.parse(serialized);
  } catch {
    return recoveredState('O estado local contém JSON inválido; uma cópia demonstrativa segura foi carregada.');
  }
  if (state?.schemaVersion !== STORAGE_SCHEMA_VERSION) {
    return recoveredState('A versão do estado local é incompatível; os dados demonstrativos desta versão foram carregados.');
  }
  if (!isValidState(state)) {
    return recoveredState('O estado local não passou pela validação; uma cópia demonstrativa segura foi carregada.');
  }
  return { state, recoveryNotice: null, source: 'local' };
}

export function saveState(state, storage) {
  if (!isValidState(state)) throw new TypeError('Estado inválido ou schema incompatível; a gravação foi cancelada.');
  if (!storage || typeof storage.setItem !== 'function') throw new Error('Armazenamento local indisponível para salvar o estado.');
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    throw new Error(`Não foi possível salvar no armazenamento local: ${error?.message ?? 'erro desconhecido'}`);
  }
  return true;
}

export function resetDemoState(storage) {
  const state = createDefaultState();
  saveState(state, storage);
  return state;
}
