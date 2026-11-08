const CONCEPTUAL_COMPONENTS = Object.freeze([
  { id: 'internet', name: 'Internet externa', kind: 'component', type: 'external-zone', description: 'Zona externa inteiramente sintética; não há conexões de rede reais.' },
  { id: 'firewall-pfsense', name: 'Firewall pfSense (conceitual)', kind: 'component', type: 'firewall', description: 'Ponto conceitual de filtragem entre zonas para fins didáticos; não controla um pfSense real.' },
  { id: 'active-directory', name: 'Active Directory (conceitual)', kind: 'component', type: 'directory', description: 'Referência a um diretório local representado no modelo; nenhum domínio é consultado.' },
  { id: 'entra-id', name: 'Microsoft Entra ID (conceitual)', kind: 'component', type: 'identity-provider', description: 'Referência conceitual de identidade em nuvem; nenhuma API ou tenant é acessado.' },
  { id: 'rocky-linux', name: 'Rocky Linux (conceitual)', kind: 'component', type: 'server-platform', description: 'Plataforma de servidor representativa; nenhum host é conectado.' },
  { id: 'azure', name: 'Microsoft Azure (conceitual)', kind: 'component', type: 'cloud-platform', description: 'Zona de nuvem representativa no diagrama; nenhum recurso Azure é provisionado.' },
  { id: 'policy-engine', name: 'Policy Engine', kind: 'zero-trust-role', type: 'policy-engine', description: 'Avalia atributos e política e produz uma decisão sintética.' },
  { id: 'policy-administrator', name: 'Policy Administrator', kind: 'zero-trust-role', type: 'policy-administrator', description: 'Papel conceitual que comunicaria decisões ao ponto de enforcement; não há serviço distribuído real.' },
  { id: 'policy-decision-point', name: 'Policy Decision Point (PE + PA)', kind: 'zero-trust-role', type: 'policy-decision-point', description: 'PDP lógico formado pelas funções Policy Engine (PE) e Policy Administrator (PA); o PEP é o ponto que aplica a decisão. Representação conceitual local.' },
  { id: 'policy-enforcement-point', name: 'Policy Enforcement Point', kind: 'zero-trust-role', type: 'policy-enforcement-point', description: 'Nome conceitual para a aplicação da decisão dentro da simulação do navegador.' },
]);

export function getTopologyNodes(state) {
  if (!state || !Array.isArray(state.segments) || !Array.isArray(state.resources)) throw new TypeError('Estado incompleto para gerar a topologia.');
  const components = CONCEPTUAL_COMPONENTS.map((item) => ({ ...item, synthetic: true }));
  const segments = state.segments.map((item) => ({ ...item, kind: 'segment', synthetic: true }));
  const resources = state.resources.map((item) => ({ ...item, kind: 'resource', synthetic: true }));
  return [...components, ...segments, ...resources];
}

export function selectTopologyNode(nodeId, state) {
  if (typeof nodeId !== 'string') return null;
  return getTopologyNodes(state).find((node) => node.id === nodeId) ?? null;
}
