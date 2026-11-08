const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const ACCOUNT_STATES = new Set(['active', 'suspended', 'disabled']);
const PRIVILEGE_LEVELS = new Set([0, 1, 2, 3, 4]);
const CRITICALITIES = new Set(['low', 'medium', 'high', 'critical']);
const SCENARIO_POLICY_FIELDS = new Set([
  'enforceDeviceTrust', 'blockCompromisedDevice', 'requireVpnForRemote', 'requireMfaForRemote',
  'enforceResourceGroups', 'enforceUserResourceGrants', 'enforceMinimumPrivilege', 'enforceResourceMfa',
  'defaultNetworkPolicy', 'syntheticBaseMs', 'syntheticCheckMs',
]);

function clone(value) {
  return structuredClone(value);
}

function requireState(state) {
  if (!state || !Array.isArray(state.users) || !Array.isArray(state.groups) || !Array.isArray(state.devices)
    || !Array.isArray(state.resources) || !Array.isArray(state.segments) || !Array.isArray(state.events)) {
    throw new TypeError('Estado do laboratório incompleto.');
  }
}

function requireId(id, label) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new TypeError(`${label} deve usar letras minúsculas, números e hífens.`);
}

function bump(state) {
  state.revision = (Number.isInteger(state.revision) ? state.revision : 0) + 1;
  return state;
}

function isPrivateIpv4(ip) {
  if (typeof ip !== 'string') return false;
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part, index) => !/^\d{1,3}$/.test(ip.split('.')[index]) || part < 0 || part > 255)) return false;
  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

export function upsertUser(state, input) {
  requireState(state);
  requireId(input?.id, 'ID de usuário');
  if (typeof input.name !== 'string' || !input.name.trim()) throw new TypeError('Nome fictício é obrigatório.');
  if (!state.groups.some((group) => group.id === input.groupId)) throw new RangeError('Grupo desconhecido para o usuário.');
  if (!state.devices.some((device) => device.id === input.deviceId)) throw new RangeError('Dispositivo desconhecido para o usuário.');
  if (!ACCOUNT_STATES.has(input.accountStatus)) throw new TypeError('Estado da conta deve ser active, suspended ou disabled.');
  if (!PRIVILEGE_LEVELS.has(input.privilegeLevel)) throw new TypeError('Nível de privilégio deve ser um inteiro entre 0 e 4.');
  if (typeof input.credentialValid !== 'boolean' || typeof input.remoteAllowed !== 'boolean') throw new TypeError('Estados sintéticos de credencial e acesso remoto devem ser booleanos.');
  if (!Array.isArray(input.allowedResourceIds) || input.allowedResourceIds.some((id) => !state.resources.some((resource) => resource.id === id))) {
    throw new RangeError('A lista de recursos permitidos contém um recurso desconhecido.');
  }
  const users = clone(state.users);
  const previousIndex = users.findIndex((user) => user.id === input.id);
  const user = { ...(previousIndex >= 0 ? users[previousIndex] : {}), ...clone(input), name: input.name.trim(), fictional: true };
  if (previousIndex >= 0) users[previousIndex] = user;
  else users.push(user);
  return bump({ ...clone(state), users });
}

export function deleteUser(state, userId) {
  requireState(state);
  const user = state.users.find((item) => item.id === userId);
  if (!user) throw new RangeError(`Usuário desconhecido: ${userId}`);
  const remainingAdmins = state.users.filter((item) => item.id !== userId && item.accountStatus === 'active'
    && (item.groupId === 'administrators' || item.role === 'administrator'));
  if ((user.groupId === 'administrators' || user.role === 'administrator') && remainingAdmins.length === 0) {
    throw new Error('Não é permitido remover o último administrador ativo da demonstração.');
  }
  const next = clone(state);
  next.users = next.users.filter((item) => item.id !== userId);
  const stillUsedDeviceIds = new Set(next.users.map((item) => item.deviceId));
  next.devices = next.devices.filter((device) => device.ownerUserId !== userId || stillUsedDeviceIds.has(device.id));
  return bump(next);
}

export function upsertResource(state, input) {
  requireState(state);
  requireId(input?.id, 'ID de recurso');
  if (typeof input.name !== 'string' || !input.name.trim()) throw new TypeError('Nome fictício do recurso é obrigatório.');
  if (!isPrivateIpv4(input.ip)) throw new TypeError('Endereço IP deve ser um IPv4 privado fictício (RFC 1918).');
  if (!state.segments.some((segment) => segment.id === input.segmentId)) throw new RangeError('Segmento de rede desconhecido para o recurso.');
  if (!CRITICALITIES.has(input.criticality)) throw new TypeError('Criticidade deve ser low, medium, high ou critical.');
  if (!PRIVILEGE_LEVELS.has(input.requiredPrivilege)) throw new TypeError('Privilégio requerido deve ser um inteiro entre 0 e 4.');
  if (input.requiresMfa !== undefined && typeof input.requiresMfa !== 'boolean') throw new TypeError('O requisito de MFA deve ser booleano.');
  const groupIds = new Set(state.groups.map((group) => group.id));
  if (!Array.isArray(input.allowedGroups) || input.allowedGroups.some((id) => !groupIds.has(id))) throw new RangeError('O recurso contém grupo de acesso desconhecido.');
  const resources = clone(state.resources);
  const previousIndex = resources.findIndex((resource) => resource.id === input.id);
  const resource = { ...(previousIndex >= 0 ? resources[previousIndex] : {}), ...clone(input), name: input.name.trim(), requiresMfa: input.requiresMfa ?? false, fictional: true, synthetic: true };
  if (previousIndex >= 0) resources[previousIndex] = resource;
  else resources.push(resource);
  return bump({ ...clone(state), resources });
}

export function deleteResource(state, resourceId) {
  requireState(state);
  if (!state.resources.some((resource) => resource.id === resourceId)) throw new RangeError(`Recurso desconhecido: ${resourceId}`);
  const next = clone(state);
  next.resources = next.resources.filter((resource) => resource.id !== resourceId);
  next.users = next.users.map((user) => ({ ...user, allowedResourceIds: user.allowedResourceIds.filter((id) => id !== resourceId) }));
  for (const scenario of Object.values(next.scenarios)) {
    scenario.networkRules = scenario.networkRules.map((rule) => ({
      ...rule,
      resourceIds: rule.resourceIds.filter((id) => id !== resourceId),
    }));
  }
  return bump(next);
}

export function updateScenarioPolicy(state, scenarioId, patch) {
  requireState(state);
  const current = state.scenarios?.[scenarioId];
  if (!current) throw new RangeError(`Cenário desconhecido: ${scenarioId}`);
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (!SCENARIO_POLICY_FIELDS.has(key)) throw new TypeError(`Campo de política não editável: ${key}`);
    if (['syntheticBaseMs', 'syntheticCheckMs'].includes(key)) {
      if (!Number.isInteger(value) || value < 0 || value > 1000) throw new TypeError(`${key} deve ser inteiro entre 0 e 1000.`);
    } else if (key === 'defaultNetworkPolicy') {
      if (!['allow', 'deny'].includes(value)) throw new TypeError('Política de rede padrão deve ser allow ou deny.');
    } else if (typeof value !== 'boolean') {
      throw new TypeError(`${key} deve ser booleano.`);
    }
  }
  const next = clone(state);
  next.scenarios[scenarioId] = { ...next.scenarios[scenarioId], ...clone(patch) };
  return bump(next);
}

export function upsertNetworkRule(state, scenarioId, ruleInput) {
  requireState(state);
  const scenario = state.scenarios?.[scenarioId];
  if (!scenario) throw new RangeError(`Cenário desconhecido: ${scenarioId}`);
  requireId(ruleInput?.id, 'ID de regra');
  if (typeof ruleInput.name !== 'string' || !ruleInput.name.trim()) throw new TypeError('Nome da regra é obrigatório.');
  if (!Number.isInteger(ruleInput.priority) || ruleInput.priority < 0 || ruleInput.priority > 10000) throw new TypeError('Prioridade deve ser um inteiro entre 0 e 10000.');
  if (!['ALLOW', 'DENY'].includes(ruleInput.effect)) throw new TypeError('Efeito deve ser ALLOW ou DENY.');
  const segmentIds = new Set(state.segments.map((segment) => segment.id));
  for (const field of ['sourceSegments', 'destinationSegments']) {
    if (!Array.isArray(ruleInput[field]) || ruleInput[field].length === 0
      || ruleInput[field].some((id) => id !== '*' && !segmentIds.has(id))) {
      throw new RangeError(`${field} contém segmento desconhecido ou vazio.`);
    }
  }
  if (!Array.isArray(ruleInput.resourceIds) || ruleInput.resourceIds.length === 0
    || ruleInput.resourceIds.some((id) => id !== '*' && !state.resources.some((resource) => resource.id === id))) {
    throw new RangeError('A regra contém recurso desconhecido ou vazio.');
  }
  const next = clone(state);
  const rules = next.scenarios[scenarioId].networkRules;
  const index = rules.findIndex((rule) => rule.id === ruleInput.id);
  const rule = { ...clone(ruleInput), name: ruleInput.name.trim() };
  if (index >= 0) rules[index] = rule;
  else rules.push(rule);
  return bump(next);
}

export function deleteNetworkRule(state, scenarioId, ruleId) {
  requireState(state);
  const scenario = state.scenarios?.[scenarioId];
  if (!scenario) throw new RangeError(`Cenário desconhecido: ${scenarioId}`);
  if (!scenario.networkRules.some((rule) => rule.id === ruleId)) throw new RangeError(`Regra desconhecida: ${ruleId}`);
  const next = clone(state);
  next.scenarios[scenarioId].networkRules = next.scenarios[scenarioId].networkRules.filter((rule) => rule.id !== ruleId);
  return bump(next);
}
