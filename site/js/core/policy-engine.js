const VALID_OUTCOMES = new Set(['ALLOW', 'DENY', 'RESTRICTED', 'REVIEW']);

export function buildScenarioConfig(appState, scenarioId) {
  const scenario = appState?.scenarios?.[scenarioId];
  if (!scenario) throw new RangeError(`Cenário desconhecido: ${scenarioId}`);
  if (!Array.isArray(appState.users) || !Array.isArray(appState.devices) || !Array.isArray(appState.resources) || !Array.isArray(appState.segments)) {
    throw new TypeError('Estado do laboratório incompleto: users, devices, resources e segments são obrigatórios.');
  }
  return {
    ...scenario,
    scenarioId,
    users: appState.users,
    devices: appState.devices,
    resources: appState.resources,
    segments: appState.segments,
  };
}

function matches(ruleValues, value) {
  return Array.isArray(ruleValues) && (ruleValues.includes('*') || ruleValues.includes(value));
}

function findNetworkRule(config, sourceSegmentId, resource) {
  const targetSegmentId = resource.segmentId;
  const rules = [...(config.networkRules ?? [])].sort((a, b) => a.priority - b.priority);
  return rules.find((rule) => matches(rule.sourceSegments, sourceSegmentId)
    && matches(rule.destinationSegments, targetSegmentId)
    && matches(rule.resourceIds, resource.id)) ?? null;
}

function finish({ config, attempt, checks, trace, reasons, outcome, authentication, authorization, reachableResources = [], hops = [], policyId = null }) {
  if (!VALID_OUTCOMES.has(outcome)) throw new TypeError(`Decisão inválida: ${outcome}`);
  const syntheticDecisionMs = config.syntheticBaseMs + checks * config.syntheticCheckMs;
  return {
    scenarioId: config.scenarioId,
    scenarioLabel: config.label,
    testId: attempt.testId ?? 'custom',
    outcome,
    authentication,
    authorization: { status: authorization },
    reasons,
    policyId,
    reachableResources,
    hops,
    decisionTrace: trace,
    checkCount: checks,
    syntheticDecisionMs,
    timeBasis: 'synthetic-rule-model',
  };
}

function evaluateSingleAttempt(attempt, config, sourceSegmentOverride) {
  let checks = 0;
  const trace = [];
  const reasons = [];
  const record = (check, passed, reason, policyId = null) => {
    checks += 1;
    trace.push({ check, passed, reason, policyId });
    if (reason) reasons.push(reason);
    return passed;
  };
  const early = (outcome, authenticationStatus, authorization, reason, policyId = null) => {
    if (reason && !reasons.includes(reason)) reasons.push(reason);
    return finish({
      config, attempt, checks, trace, reasons, outcome,
      authentication: { status: authenticationStatus, reason: reason ?? '' },
      authorization, policyId,
    });
  };

  const user = config.users.find((item) => item.id === attempt.userId);
  if (!record('identity.lookup', Boolean(user), user ? '' : `Identidade desconhecida (${attempt.userId ?? 'não informada'}); decisão fechada por segurança.`)) {
    return early('DENY', 'FAIL', 'DENY', reasons.at(-1));
  }

  const deviceId = attempt.deviceId ?? user.deviceId;
  const device = config.devices.find((item) => item.id === deviceId);
  if (!record('device.lookup', Boolean(device), device ? '' : `Dispositivo desconhecido (${deviceId ?? 'não informado'}); decisão fechada por segurança.`)) {
    return early('DENY', 'NOT_EVALUATED', 'DENY', reasons.at(-1), 'device-unknown-deny');
  }

  const resource = config.resources.find((item) => item.id === attempt.resourceId);
  if (!record('resource.lookup', Boolean(resource), resource ? '' : `Recurso desconhecido (${attempt.resourceId ?? 'não informado'}); decisão fechada por segurança.`)) {
    return early('DENY', 'NOT_EVALUATED', 'DENY', reasons.at(-1), 'resource-unknown-deny');
  }

  const credentialValid = typeof attempt.credentialValid === 'boolean' ? attempt.credentialValid : user.credentialValid === true;
  if (!record('identity.credential', credentialValid, credentialValid ? '' : 'Credencial inválida; autenticação negada.', 'identity-credential-check')) {
    return early('DENY', 'FAIL', 'DENY', 'Credencial inválida; autenticação negada.', 'identity-credential-check');
  }

  const activeAccount = user.accountStatus === 'active';
  if (!record('identity.account-status', activeAccount, activeAccount ? '' : `Conta ${user.accountStatus ?? 'sem estado'}; autenticação negada.`, 'active-account-required')) {
    return early('DENY', 'FAIL', 'DENY', reasons.at(-1), 'active-account-required');
  }

  const authentication = { status: 'PASS', reason: 'Identidade ativa e credencial sintética válida.' };
  if (config.enforceResourceMfa && resource.requiresMfa === true) {
    if (attempt.mfaVerified !== true) {
      const reason = `MFA exigido pelo recurso ${resource.name}; verificação adicional não foi comprovada.`;
      record('authentication.resource-mfa', false, reason, 'resource-mfa-required');
      return finish({ config, attempt, checks, trace, reasons, outcome: 'DENY', authentication: { status: 'STEP_UP_REQUIRED', reason }, authorization: 'NOT_EVALUATED', policyId: 'resource-mfa-required' });
    }
    record('authentication.resource-mfa', true, '', 'resource-mfa-required');
  }
  const trustStatus = device.trustStatus ?? 'unknown';
  if (trustStatus === 'compromised' && config.blockCompromisedDevice) {
    record('device.compromise-status', false, 'Dispositivo marcado como comprometido; acesso contido e sem recurso alcançado.', 'block-compromised-device');
    return finish({ config, attempt, checks, trace, reasons, outcome: 'RESTRICTED', authentication, authorization: 'RESTRICTED', policyId: 'block-compromised-device' });
  }
  if (config.enforceDeviceTrust && trustStatus !== 'trusted') {
    const outcome = trustStatus === 'unknown' ? 'REVIEW' : 'DENY';
    const reason = trustStatus === 'unknown'
      ? 'Estado do dispositivo não comprovado; decisão encaminhada para revisão.'
      : 'Dispositivo sem estado confiável; verificação Zero Trust não satisfeita.';
    record('device.trust-status', false, reason, 'trusted-device-required');
    return finish({ config, attempt, checks, trace, reasons, outcome, authentication, authorization: outcome, policyId: 'trusted-device-required' });
  }
  record('device.trust-status', true, '', 'device-trust-check');

  if (attempt.isRemote === true && config.requireVpnForRemote && attempt.vpnAuthenticated !== true) {
    record('context.remote-vpn', false, 'Acesso remoto sem túnel VPN sintético aprovado; decisão negada.', 'remote-vpn-required');
    return finish({ config, attempt, checks, trace, reasons, outcome: 'DENY', authentication, authorization: 'DENY', policyId: 'remote-vpn-required' });
  }
  if (attempt.isRemote === true && config.requireMfaForRemote && attempt.mfaVerified !== true) {
    record('context.remote-mfa', false, 'Acesso remoto sem verificação multifator sintética; decisão negada.', 'remote-mfa-required');
    return finish({ config, attempt, checks, trace, reasons, outcome: 'DENY', authentication, authorization: 'DENY', policyId: 'remote-mfa-required' });
  }
  if (attempt.isRemote === true && user.remoteAllowed !== true && config.mode !== 'coarse-perimeter') {
    record('context.remote-entitlement', false, 'Identidade sem autorização para acesso remoto.', 'remote-access-not-authorized');
    return finish({ config, attempt, checks, trace, reasons, outcome: 'DENY', authentication, authorization: 'DENY', policyId: 'remote-access-not-authorized' });
  }
  record('context.remote-access', true, '', 'remote-context-check');

  const requestedPrivilege = Number.isFinite(attempt.requestedPrivilege) ? attempt.requestedPrivilege : null;
  if (requestedPrivilege !== null && requestedPrivilege > user.privilegeLevel) {
    record('authorization.requested-privilege', false, `Privilégio solicitado (${requestedPrivilege}) excede o nível atribuído (${user.privilegeLevel}); elevação negada.`, 'deny-privilege-escalation');
    return finish({ config, attempt, checks, trace, reasons, outcome: 'DENY', authentication, authorization: 'DENY', policyId: 'deny-privilege-escalation' });
  }
  record('authorization.requested-privilege', true, '', 'privilege-ceiling');

  if (config.enforceMinimumPrivilege && user.privilegeLevel < resource.requiredPrivilege) {
    record('authorization.minimum-privilege', false, `Nível de privilégio ${user.privilegeLevel} inferior ao requisito ${resource.requiredPrivilege} do recurso ${resource.name}.`, 'minimum-privilege-required');
    return finish({ config, attempt, checks, trace, reasons, outcome: 'DENY', authentication, authorization: 'DENY', policyId: 'minimum-privilege-required' });
  }
  record('authorization.minimum-privilege', true, '', 'minimum-privilege-check');

  if (config.enforceResourceGroups && !resource.allowedGroups.includes(user.groupId)) {
    record('authorization.resource-group', false, `Grupo ${user.groupId} não está autorizado para ${resource.name}.`, 'resource-group-allowlist');
    return finish({ config, attempt, checks, trace, reasons, outcome: 'DENY', authentication, authorization: 'DENY', policyId: 'resource-group-allowlist' });
  }
  record('authorization.resource-group', true, '', 'resource-group-allowlist');

  if (config.enforceUserResourceGrants && !user.allowedResourceIds.includes(resource.id)) {
    record('authorization.user-resource-grant', false, `A identidade não possui concessão explícita para ${resource.name}.`, 'explicit-user-resource-grant');
    return finish({ config, attempt, checks, trace, reasons, outcome: 'DENY', authentication, authorization: 'DENY', policyId: 'explicit-user-resource-grant' });
  }
  record('authorization.user-resource-grant', true, '', 'explicit-user-resource-grant');

  const sourceSegmentId = sourceSegmentOverride ?? attempt.originSegmentId
    ?? (attempt.isRemote === true && attempt.vpnAuthenticated !== true ? 'segment-internet' : device.segmentId);
  const sourceSegment = config.segments.find((item) => item.id === sourceSegmentId);
  if (!record('network.source-segment', Boolean(sourceSegment), sourceSegment ? '' : `Segmento de origem desconhecido (${sourceSegmentId ?? 'não informado'}); decisão fechada por segurança.`)) {
    return finish({ config, attempt, checks, trace, reasons, outcome: 'DENY', authentication, authorization: 'DENY', policyId: 'unknown-source-segment' });
  }

  const networkRule = findNetworkRule(config, sourceSegmentId, resource);
  const networkAllowed = networkRule ? networkRule.effect === 'ALLOW' : config.defaultNetworkPolicy === 'allow';
  const networkReason = networkAllowed
    ? ''
    : networkRule?.name
      ? `Regra de rede “${networkRule.name}” nega ${sourceSegment.name} → ${resource.name}.`
      : `Política de rede padrão nega ${sourceSegment.name} → ${resource.name}.`;
  if (!record('network.segment-policy', networkAllowed, networkReason, networkRule?.id ?? 'default-network-deny')) {
    return finish({ config, attempt, checks, trace, reasons, outcome: 'DENY', authentication, authorization: 'DENY', policyId: networkRule?.id ?? 'default-network-deny' });
  }

  record('authorization.decision', true, `Acesso autorizado pelas regras configuradas para “${config.label}”.`, networkRule?.id ?? 'configured-policy');
  return finish({
    config, attempt, checks, trace, reasons, outcome: 'ALLOW', authentication,
    authorization: 'ALLOW', reachableResources: [resource.id], policyId: networkRule?.id ?? 'configured-policy',
  });
}

export function evaluateAttempt(attempt, scenarioConfig) {
  if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) throw new TypeError('A tentativa deve ser um objeto.');
  if (!scenarioConfig || !Array.isArray(scenarioConfig.users) || !Array.isArray(scenarioConfig.devices)
    || !Array.isArray(scenarioConfig.resources) || !Array.isArray(scenarioConfig.segments)) {
    throw new TypeError('Configuração do cenário incompleta. Use buildScenarioConfig(state, scenarioId).');
  }
  if (!Array.isArray(attempt.path) || attempt.path.length === 0) return evaluateSingleAttempt(attempt, scenarioConfig, undefined);

  const reachableResources = [];
  const hops = [];
  const reasons = [];
  const decisionTrace = [];
  let sourceSegmentId;
  let totalChecks = 0;
  let totalSyntheticMs = 0;
  for (const [index, resourceId] of attempt.path.entries()) {
    const hopAttempt = { ...attempt, resourceId, path: undefined };
    const hop = evaluateSingleAttempt(hopAttempt, scenarioConfig, sourceSegmentId);
    hops.push({ index: index + 1, resourceId, outcome: hop.outcome, policyId: hop.policyId, reasons: hop.reasons });
    totalChecks += hop.checkCount;
    totalSyntheticMs += hop.syntheticDecisionMs;
    for (const item of hop.decisionTrace) decisionTrace.push({ ...item, hop: index + 1 });
    for (const reason of hop.reasons) if (!reasons.includes(reason)) reasons.push(reason);
    if (hop.outcome !== 'ALLOW') break;
    reachableResources.push(resourceId);
    const resource = scenarioConfig.resources.find((item) => item.id === resourceId);
    sourceSegmentId = resource?.segmentId;
  }

  const lastHop = hops.at(-1);
  const allReached = reachableResources.length === attempt.path.length;
  const outcome = allReached ? 'ALLOW' : reachableResources.length > 0 ? 'RESTRICTED' : lastHop?.outcome ?? 'DENY';
  if (!allReached && reachableResources.length > 0) {
    reasons.push(`Movimentação lateral contida após ${reachableResources.length} de ${attempt.path.length} recurso(s) solicitados.`);
  }
  const firstResult = evaluateSingleAttempt({ ...attempt, resourceId: attempt.path[0], path: undefined }, scenarioConfig, undefined);
  const authentication = firstResult.authentication;
  return {
    scenarioId: scenarioConfig.scenarioId,
    scenarioLabel: scenarioConfig.label,
    testId: attempt.testId ?? 'custom',
    outcome,
    authentication,
    authorization: { status: outcome },
    reasons,
    policyId: lastHop?.policyId ?? null,
    reachableResources,
    hops,
    decisionTrace,
    checkCount: totalChecks,
    syntheticDecisionMs: totalSyntheticMs,
    timeBasis: 'synthetic-rule-model',
  };
}
