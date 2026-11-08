import { getTestCase } from './test-catalog.js';

function clone(value) {
  return structuredClone(value);
}

function resolveOrigin(attempt, state) {
  const device = state.devices.find((item) => item.id === (attempt.deviceId ?? state.users.find((user) => user.id === attempt.userId)?.deviceId));
  const segmentId = attempt.originSegmentId ?? (attempt.isRemote && attempt.vpnAuthenticated !== true ? 'segment-internet' : device?.segmentId);
  return state.segments.find((segment) => segment.id === segmentId)?.name ?? segmentId ?? 'Origem não informada';
}

function createScenarioEvent(pairedResult, state, scenarioId, sequence, timestamp) {
  const decision = pairedResult[scenarioId];
  const attempt = pairedResult.input;
  const user = state.users.find((item) => item.id === attempt.userId);
  const device = state.devices.find((item) => item.id === (attempt.deviceId ?? user?.deviceId));
  const targetIds = Array.isArray(attempt.path) && attempt.path.length ? attempt.path : [attempt.resourceId];
  const targetResources = targetIds.map((id) => state.resources.find((resource) => resource.id === id)).filter(Boolean);
  const requestedResource = targetResources.at(-1);
  const scenario = state.scenarios[scenarioId];
  const catalogCase = getTestCase(attempt.testId);
  const policySnapshot = {
    scenarioId,
    label: scenario.label,
    mode: scenario.mode,
    enforceDeviceTrust: scenario.enforceDeviceTrust,
    blockCompromisedDevice: scenario.blockCompromisedDevice,
    requireVpnForRemote: scenario.requireVpnForRemote,
    requireMfaForRemote: scenario.requireMfaForRemote,
    enforceResourceGroups: scenario.enforceResourceGroups,
    enforceUserResourceGrants: scenario.enforceUserResourceGrants,
    enforceMinimumPrivilege: scenario.enforceMinimumPrivilege,
    enforceResourceMfa: scenario.enforceResourceMfa,
    defaultNetworkPolicy: scenario.defaultNetworkPolicy,
    networkRules: clone(scenario.networkRules),
    resourceRequirements: state.resources.map(({ id, name, requiresMfa, requiredPrivilege, allowedGroups }) => ({ id, name, requiresMfa, requiredPrivilege, allowedGroups: [...allowedGroups] })),
    stateRevision: state.revision,
  };
  return {
    eventId: `event-${String(sequence).padStart(6, '0')}`,
    timestamp,
    experimentId: state.experiment.id,
    testId: pairedResult.testId,
    testName: catalogCase?.name ?? 'Tentativa personalizada',
    classification: attempt.classification ?? catalogCase?.classification ?? 'unclassified',
    scenarioId,
    scenarioLabel: scenario.label,
    userId: attempt.userId ?? null,
    userName: user?.name ?? 'Identidade desconhecida',
    deviceId: device?.id ?? attempt.deviceId ?? null,
    deviceName: device?.name ?? 'Dispositivo desconhecido',
    origin: resolveOrigin(attempt, state),
    destination: targetResources.map((resource) => resource.name).join(' → ') || 'Recurso desconhecido',
    resourceId: requestedResource?.id ?? attempt.resourceId ?? null,
    resourceName: requestedResource?.name ?? 'Recurso desconhecido',
    requestedResourceIds: targetIds,
    outcome: decision.outcome,
    authentication: clone(decision.authentication),
    authorization: clone(decision.authorization),
    reasons: [...decision.reasons],
    policyId: decision.policyId,
    syntheticDecisionMs: decision.syntheticDecisionMs,
    timeBasis: decision.timeBasis,
    reachableResources: [...decision.reachableResources],
    decisionTrace: clone(decision.decisionTrace),
    policySnapshot,
    synthetic: true,
  };
}

export function appendPairedAuditEvents(state, pairedResult, { timestamp = new Date().toISOString() } = {}) {
  if (!state || !Array.isArray(state.events) || !state.metadata) throw new TypeError('Estado incompleto para registrar auditoria.');
  if (!pairedResult?.input || !pairedResult.baseline || !pairedResult.zeroTrust) throw new TypeError('Resultado pareado incompleto.');
  if (Number.isNaN(Date.parse(timestamp))) throw new TypeError('Timestamp de auditoria inválido.');
  const next = clone(state);
  const start = Number.isInteger(next.metadata.nextEventSequence) ? next.metadata.nextEventSequence : 1;
  const events = [
    createScenarioEvent(pairedResult, state, 'baseline', start, timestamp),
    createScenarioEvent(pairedResult, state, 'zeroTrust', start + 1, timestamp),
  ];
  next.events.push(...events);
  next.metadata.nextEventSequence = start + events.length;
  next.revision = (Number.isInteger(next.revision) ? next.revision : 0) + 1;
  return next;
}

export function clearAuditEvents(state) {
  if (!state || !Array.isArray(state.events)) throw new TypeError('Estado incompleto para limpar auditoria.');
  const next = clone(state);
  next.events = [];
  next.revision = (Number.isInteger(next.revision) ? next.revision : 0) + 1;
  return next;
}
