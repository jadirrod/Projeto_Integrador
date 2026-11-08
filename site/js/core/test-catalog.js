export const TEST_CATALOG = Object.freeze([
  Object.freeze({ id: 'invalid-credential', name: 'Credencial inválida', category: 'authentication', classification: 'adverse', description: 'Credencial fictícia inválida em um pedido de acesso.' }),
  Object.freeze({ id: 'insufficient-privilege', name: 'Usuário autenticado sem privilégio', category: 'authorization', classification: 'adverse', description: 'Identidade de baixo privilégio solicita o banco de dados corporativo.' }),
  Object.freeze({ id: 'compromised-device', name: 'Dispositivo comprometido', category: 'device-risk', classification: 'adverse', description: 'Dispositivo sinalizado como comprometido solicita um recurso interno.' }),
  Object.freeze({ id: 'lateral-movement', name: 'Movimentação lateral', category: 'network', classification: 'adverse', description: 'Tentativa de percorrer arquivos, banco de dados e plano administrativo.' }),
  Object.freeze({ id: 'unauthorized-remote', name: 'Acesso remoto indevido', category: 'remote-access', classification: 'adverse', description: 'Pedido remoto sem VPN ou verificação multifator sintética.' }),
  Object.freeze({ id: 'privilege-escalation', name: 'Escalada de privilégios', category: 'privilege-escalation', classification: 'adverse', description: 'Identidade solicita nível administrativo que não lhe foi atribuído.' }),
  Object.freeze({ id: 'critical-resource', name: 'Acesso a recurso crítico', category: 'critical-resource', classification: 'adverse', description: 'Funcionário comum solicita acesso ao sistema financeiro crítico.' }),
]);

export const PRESET_CATALOG = Object.freeze([
  Object.freeze({ id: 'corporate-basic', name: 'Cenário corporativo básico', description: 'Menor privilégio e acesso a dados críticos.', testIds: ['insufficient-privilege', 'critical-resource'] }),
  Object.freeze({ id: 'credential-attacks', name: 'Ataques de credenciais', description: 'Credencial inválida e tentativa de elevação.', testIds: ['invalid-credential', 'privilege-escalation'] }),
  Object.freeze({ id: 'lateral-movement', name: 'Movimentação lateral', description: 'Percurso entre arquivos, banco de dados e painel administrativo.', testIds: ['lateral-movement'] }),
  Object.freeze({ id: 'compromised-device', name: 'Dispositivo comprometido', description: 'Verificação de confiança e contenção de endpoint.', testIds: ['compromised-device'] }),
  Object.freeze({ id: 'remote-access', name: 'Acesso remoto', description: 'Pedido externo sem VPN ou MFA sintético.', testIds: ['unauthorized-remote'] }),
  Object.freeze({ id: 'audit-compliance', name: 'Auditoria e conformidade', description: 'Executa todos os casos e registra motivos de decisão.', testIds: ['invalid-credential', 'insufficient-privilege', 'compromised-device', 'lateral-movement', 'unauthorized-remote', 'privilege-escalation', 'critical-resource'] }),
]);

const ATTEMPT_TEMPLATES = Object.freeze({
  'invalid-credential': { userId: 'user-admin', deviceId: 'device-admin', resourceId: 'resource-files', credentialValid: false },
  'insufficient-privilege': { userId: 'user-employee', deviceId: 'device-employee', resourceId: 'resource-database' },
  'compromised-device': { userId: 'user-compromised', deviceId: 'device-compromised', resourceId: 'resource-files' },
  'lateral-movement': { userId: 'user-employee', deviceId: 'device-employee', resourceId: 'resource-files', path: ['resource-files', 'resource-database', 'resource-admin-panel'] },
  'unauthorized-remote': { userId: 'user-employee', deviceId: 'device-employee', resourceId: 'resource-remote', isRemote: true, vpnAuthenticated: false, mfaVerified: false },
  'privilege-escalation': { userId: 'user-analyst', deviceId: 'device-analyst', resourceId: 'resource-app', requestedPrivilege: 4 },
  'critical-resource': { userId: 'user-employee', deviceId: 'device-employee', resourceId: 'resource-finance', mfaVerified: true },
});

export function getTestCase(testId) {
  return TEST_CATALOG.find((item) => item.id === testId) ?? null;
}

export function getPreset(presetId) {
  return PRESET_CATALOG.find((preset) => preset.id === presetId) ?? null;
}

export function createTestAttempt(testId, _state, overrides = {}) {
  const template = ATTEMPT_TEMPLATES[testId];
  if (!template) throw new RangeError(`Teste sintético desconhecido: ${testId}`);
  return {
    testId,
    classification: getTestCase(testId).classification,
    ...JSON.parse(JSON.stringify(template)),
    ...JSON.parse(JSON.stringify(overrides)),
  };
}
