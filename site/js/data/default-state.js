export const STORAGE_SCHEMA_VERSION = 3;

const DEFAULT_STATE = {
  schemaVersion: STORAGE_SCHEMA_VERSION,
  revision: 0,
  experiment: {
    id: 'demo-hybrid-network',
    name: 'Cenário corporativo básico',
    synthetic: true,
  },
  users: [
    {
      id: 'user-admin', name: 'Ana Administradora', groupId: 'administrators', role: 'administrator',
      accountStatus: 'active', credentialValid: true, privilegeLevel: 4, deviceId: 'device-admin',
      allowedResourceIds: ['resource-files', 'resource-app', 'resource-database', 'resource-auth', 'resource-finance', 'resource-admin-panel', 'resource-cloud', 'resource-remote'],
      remoteAllowed: true, fictional: true,
    },
    {
      id: 'user-manager', name: 'Bruno Gerente', groupId: 'finance-managers', role: 'manager',
      accountStatus: 'active', credentialValid: true, privilegeLevel: 3, deviceId: 'device-manager',
      allowedResourceIds: ['resource-files', 'resource-app', 'resource-finance', 'resource-remote'],
      remoteAllowed: true, fictional: true,
    },
    {
      id: 'user-analyst', name: 'Camila Analista', groupId: 'it-analysts', role: 'analyst',
      accountStatus: 'active', credentialValid: true, privilegeLevel: 2, deviceId: 'device-analyst',
      allowedResourceIds: ['resource-files', 'resource-app', 'resource-auth', 'resource-cloud'],
      remoteAllowed: true, fictional: true,
    },
    {
      id: 'user-employee', name: 'Diego Funcionário', groupId: 'employees', role: 'employee',
      accountStatus: 'active', credentialValid: true, privilegeLevel: 1, deviceId: 'device-employee',
      allowedResourceIds: ['resource-files', 'resource-app', 'resource-remote'],
      remoteAllowed: true, fictional: true,
    },
    {
      id: 'user-guest', name: 'Eva Visitante', groupId: 'guests', role: 'guest',
      accountStatus: 'active', credentialValid: true, privilegeLevel: 0, deviceId: 'device-guest',
      allowedResourceIds: ['resource-remote'], remoteAllowed: false, fictional: true,
    },
    {
      id: 'user-compromised', name: 'Felipe Comprometido', groupId: 'employees', role: 'employee',
      accountStatus: 'active', credentialValid: true, privilegeLevel: 1, deviceId: 'device-compromised',
      allowedResourceIds: ['resource-files', 'resource-app'], remoteAllowed: false, fictional: true,
    },
  ],
  groups: [
    { id: 'administrators', name: 'Administradores', fictional: true },
    { id: 'finance-managers', name: 'Gestores financeiros', fictional: true },
    { id: 'it-analysts', name: 'Analistas de TI', fictional: true },
    { id: 'employees', name: 'Funcionários', fictional: true },
    { id: 'guests', name: 'Visitantes', fictional: true },
  ],
  devices: [
    { id: 'device-admin', name: 'Estação administrativa A-01', trustStatus: 'trusted', segmentId: 'vlan-10-admin', ownerUserId: 'user-admin', encrypted: true, fictional: true },
    { id: 'device-manager', name: 'Estação financeira F-02', trustStatus: 'trusted', segmentId: 'vlan-10-admin', ownerUserId: 'user-manager', encrypted: true, fictional: true },
    { id: 'device-analyst', name: 'Estação de análise U-03', trustStatus: 'trusted', segmentId: 'vlan-20-users', ownerUserId: 'user-analyst', encrypted: true, fictional: true },
    { id: 'device-employee', name: 'Estação de usuário U-04', trustStatus: 'trusted', segmentId: 'vlan-20-users', ownerUserId: 'user-employee', encrypted: true, fictional: true },
    { id: 'device-guest', name: 'Dispositivo de visitante G-01', trustStatus: 'untrusted', segmentId: 'vlan-50-guests', ownerUserId: 'user-guest', encrypted: false, fictional: true },
    { id: 'device-compromised', name: 'Estação isolada U-99', trustStatus: 'compromised', segmentId: 'vlan-20-users', ownerUserId: 'user-compromised', encrypted: false, fictional: true },
  ],
  segments: [
    { id: 'segment-internet', name: 'Internet externa (sintética)', vlan: null, cidr: '198.51.100.0/24', zone: 'external', fictional: true },
    { id: 'vlan-10-admin', name: 'Administração', vlan: 10, cidr: '10.10.10.0/24', zone: 'internal', fictional: true },
    { id: 'vlan-20-users', name: 'Usuários', vlan: 20, cidr: '10.20.20.0/24', zone: 'internal', fictional: true },
    { id: 'vlan-30-servers', name: 'Servidores', vlan: 30, cidr: '10.30.30.0/24', zone: 'internal', fictional: true },
    { id: 'vlan-40-infra', name: 'Infraestrutura', vlan: 40, cidr: '10.40.40.0/24', zone: 'internal', fictional: true },
    { id: 'vlan-50-guests', name: 'Convidados', vlan: 50, cidr: '10.50.50.0/24', zone: 'guest', fictional: true },
    { id: 'vlan-60-cloud', name: 'Cloud', vlan: 60, cidr: '10.60.60.0/24', zone: 'cloud', fictional: true },
  ],
  resources: [
    { id: 'resource-files', name: 'Servidor de arquivos', type: 'file-server', ip: '10.30.30.10', segmentId: 'vlan-30-servers', criticality: 'medium', requiredPrivilege: 1, requiresMfa: false, allowedGroups: ['administrators', 'finance-managers', 'it-analysts', 'employees'], fictional: true, synthetic: true },
    { id: 'resource-app', name: 'Servidor de aplicação', type: 'application-server', ip: '10.30.30.20', segmentId: 'vlan-30-servers', criticality: 'medium', requiredPrivilege: 1, requiresMfa: false, allowedGroups: ['administrators', 'finance-managers', 'it-analysts', 'employees'], fictional: true, synthetic: true },
    { id: 'resource-database', name: 'Banco de dados corporativo', type: 'database', ip: '10.30.30.30', segmentId: 'vlan-30-servers', criticality: 'high', requiredPrivilege: 3, requiresMfa: false, allowedGroups: ['administrators', 'finance-managers'], fictional: true, synthetic: true },
    { id: 'resource-auth', name: 'Serviço de autenticação', type: 'identity-service', ip: '10.40.40.10', segmentId: 'vlan-40-infra', criticality: 'high', requiredPrivilege: 2, requiresMfa: true, allowedGroups: ['administrators', 'it-analysts'], fictional: true, synthetic: true },
    { id: 'resource-finance', name: 'Sistema financeiro', type: 'business-application', ip: '10.40.40.20', segmentId: 'vlan-40-infra', criticality: 'critical', requiredPrivilege: 3, requiresMfa: true, allowedGroups: ['administrators', 'finance-managers'], fictional: true, synthetic: true },
    { id: 'resource-admin-panel', name: 'Painel administrativo', type: 'management-plane', ip: '10.40.40.30', segmentId: 'vlan-40-infra', criticality: 'critical', requiredPrivilege: 4, requiresMfa: true, allowedGroups: ['administrators'], fictional: true, synthetic: true },
    { id: 'resource-cloud', name: 'Servidor de aplicação em nuvem', type: 'cloud-server', ip: '10.60.60.10', segmentId: 'vlan-60-cloud', criticality: 'medium', requiredPrivilege: 2, requiresMfa: false, allowedGroups: ['administrators', 'it-analysts'], fictional: true, synthetic: true },
    { id: 'resource-remote', name: 'Serviço remoto de demonstração', type: 'remote-service', ip: '10.60.60.20', segmentId: 'vlan-60-cloud', criticality: 'medium', requiredPrivilege: 1, requiresMfa: true, allowedGroups: ['administrators', 'finance-managers', 'it-analysts', 'employees'], fictional: true, synthetic: true },
  ],
  scenarios: {
    baseline: {
      id: 'baseline', label: 'Segurança Tradicional · Baseline', mode: 'coarse-perimeter',
      enforceDeviceTrust: false, blockCompromisedDevice: false,
      requireVpnForRemote: false, requireMfaForRemote: false,
      enforceResourceGroups: false, enforceUserResourceGrants: false, enforceMinimumPrivilege: false,
      enforceResourceMfa: false,
      defaultNetworkPolicy: 'deny', syntheticBaseMs: 4, syntheticCheckMs: 2,
      networkRules: [
        { id: 'baseline-guest-isolation', name: 'Isolamento da VLAN de convidados', priority: 10, sourceSegments: ['vlan-50-guests'], destinationSegments: ['*'], effect: 'DENY', resourceIds: ['*'] },
        { id: 'baseline-internal-perimeter', name: 'Acesso interno após autenticação inicial', priority: 20, sourceSegments: ['vlan-10-admin', 'vlan-20-users', 'vlan-30-servers', 'vlan-40-infra', 'vlan-60-cloud'], destinationSegments: ['vlan-10-admin', 'vlan-20-users', 'vlan-30-servers', 'vlan-40-infra', 'vlan-60-cloud'], effect: 'ALLOW', resourceIds: ['*'] },
        { id: 'baseline-remote-demo', name: 'Serviço remoto da demonstração', priority: 30, sourceSegments: ['segment-internet'], destinationSegments: ['vlan-60-cloud'], effect: 'ALLOW', resourceIds: ['resource-remote'] },
      ],
    },
    zeroTrust: {
      id: 'zeroTrust', label: 'Arquitetura Zero Trust · demonstração', mode: 'least-privilege-contextual',
      enforceDeviceTrust: true, blockCompromisedDevice: true,
      requireVpnForRemote: true, requireMfaForRemote: true,
      enforceResourceGroups: true, enforceUserResourceGrants: true, enforceMinimumPrivilege: true,
      enforceResourceMfa: true,
      defaultNetworkPolicy: 'deny', syntheticBaseMs: 8, syntheticCheckMs: 3,
      networkRules: [
        { id: 'zt-guest-isolation', name: 'Negar convidados para redes internas', priority: 5, sourceSegments: ['vlan-50-guests'], destinationSegments: ['*'], effect: 'DENY', resourceIds: ['*'] },
        { id: 'zt-admin-to-internal', name: 'Administração para segmentos internos', priority: 10, sourceSegments: ['vlan-10-admin'], destinationSegments: ['vlan-10-admin', 'vlan-30-servers', 'vlan-40-infra', 'vlan-60-cloud'], effect: 'ALLOW', resourceIds: ['*'] },
        { id: 'zt-users-to-business-apps', name: 'Usuários para arquivos e aplicação autorizados', priority: 20, sourceSegments: ['vlan-20-users'], destinationSegments: ['vlan-30-servers'], effect: 'ALLOW', resourceIds: ['resource-files', 'resource-app'] },
        { id: 'zt-servers-to-database', name: 'Servidores autorizados para banco de dados', priority: 30, sourceSegments: ['vlan-30-servers'], destinationSegments: ['vlan-30-servers'], effect: 'ALLOW', resourceIds: ['resource-database'] },
        { id: 'zt-users-to-cloud', name: 'Usuários de TI para aplicações em nuvem', priority: 40, sourceSegments: ['vlan-20-users'], destinationSegments: ['vlan-60-cloud'], effect: 'ALLOW', resourceIds: ['resource-cloud'] },
        { id: 'zt-remote-after-vpn', name: 'Serviço remoto após validação contextual', priority: 50, sourceSegments: ['vlan-20-users'], destinationSegments: ['vlan-60-cloud'], effect: 'ALLOW', resourceIds: ['resource-remote'] },
      ],
    },
  },
  events: [],
  metadata: {
    disclosure: 'Dados, IPs, identidades, políticas, eventos e tempos são sintéticos. Nenhum tráfego é enviado à rede.',
    nextEventSequence: 1,
  },
};

export function createDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

export function getDefaultStateTemplate() {
  return createDefaultState();
}
