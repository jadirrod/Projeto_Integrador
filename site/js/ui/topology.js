import { getTopologyNodes, selectTopologyNode } from '../core/topology.js';
import { element, textCell } from './dom.js';

const MAP_ORDER = ['internet', 'firewall-pfsense', 'policy-decision-point', 'policy-enforcement-point', 'azure'];

export function initTopologyUI(context) {
  const diagram = document.getElementById('topology-diagram');
  const nodeList = document.getElementById('topology-node-list');
  const detail = document.getElementById('topology-selected');
  const scenarioSelect = document.getElementById('topology-scenario');
  const ruleBody = document.getElementById('topology-rule-list');
  const pathContainer = document.getElementById('topology-paths');
  const pathEmpty = document.getElementById('topology-path-empty');
  let selectedId = 'firewall-pfsense';

  function showNode(nodeId) {
    selectedId = nodeId;
    document.querySelectorAll('[data-topology-node]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.topologyNode === nodeId));
    });
    const state = context.getState();
    const node = selectTopologyNode(nodeId, state);
    detail.replaceChildren();
    if (!node) {
      detail.append(element('p', '', 'Componente não encontrado no estado atual.'));
      return;
    }
    detail.append(element('span', 'placeholder-tag', node.kind === 'resource' ? 'RECURSO FICTÍCIO' : node.kind === 'segment' ? 'SEGMENTO SINTÉTICO' : 'COMPONENTE CONCEITUAL'));
    detail.append(element('h4', '', node.name));
    detail.append(element('p', '', node.description ?? (node.kind === 'segment' ? `VLAN ${node.vlan ?? 'externa'} · ${node.cidr}` : `${node.type} · ${node.ip}`)));
    const entries = node.kind === 'resource'
      ? [['Tipo', node.type], ['IP sintético', node.ip], ['Segmento', state.segments.find((item) => item.id === node.segmentId)?.name ?? node.segmentId], ['Criticidade', node.criticality], ['Privilégio requerido', String(node.requiredPrivilege)], ['MFA requerido', node.requiresMfa ? 'Sim' : 'Não'], ['Grupos permitidos', node.allowedGroups.join(', ')]]
      : node.kind === 'segment'
        ? [['VLAN', node.vlan === null ? 'Zona externa' : String(node.vlan)], ['CIDR fictício', node.cidr], ['Zona', node.zone]]
        : [['Tipo', node.type], ['Limite', node.description]];
    const list = element('dl', 'topology-attributes');
    for (const [label, value] of entries) {
      list.append(element('dt', '', label), element('dd', '', value));
    }
    detail.append(list);
  }

  function renderLateralPaths(state) {
    pathContainer.replaceChildren();
    const latestByScenario = ['baseline', 'zeroTrust'].map((scenarioId) => ({
      scenarioId,
      event: [...state.events].filter((item) => item.testId === 'lateral-movement' && item.scenarioId === scenarioId)
        .sort((a, b) => b.eventId.localeCompare(a.eventId))[0],
    })).filter((item) => item.event);
    pathEmpty.hidden = latestByScenario.length > 0;
    if (!latestByScenario.length) return;

    for (const { scenarioId, event } of latestByScenario) {
      const label = scenarioId === 'baseline' ? 'Baseline' : 'Zero Trust';
      const card = element('article', 'topology-path-card');
      card.append(element('h4', '', `${label} · ${event.outcome}`));
      const route = element('div', 'topology-path-route');
      const requested = event.requestedResourceIds?.length ? event.requestedResourceIds : [event.resourceId].filter(Boolean);
      const reached = new Set(event.reachableResources ?? []);
      const firstUnreachedIndex = requested.findIndex((resourceId) => !reached.has(resourceId));
      requested.forEach((resourceId, index) => {
        const resource = state.resources.find((item) => item.id === resourceId);
        const isReached = reached.has(resourceId);
        const isFirstUnreached = index === firstUnreachedIndex;
        const status = isReached ? 'ALCANÇADO' : isFirstUnreached && event.outcome === 'REVIEW' ? 'REVISÃO' : isFirstUnreached ? 'BLOQUEADO' : 'NÃO AVALIADO';
        const statusClass = isReached ? 'is-reached' : isFirstUnreached && event.outcome === 'REVIEW' ? 'is-review' : isFirstUnreached ? 'is-blocked' : 'is-not-evaluated';
        const step = element('div', `topology-path-step ${statusClass}`);
        step.append(element('span', 'topology-path-name', resource?.name ?? resourceId), element('span', 'topology-path-status', status));
        route.append(step);
        if (index < requested.length - 1) {
          const arrowClass = firstUnreachedIndex < 0 || index < firstUnreachedIndex ? 'is-allowed' : index === firstUnreachedIndex ? 'is-blocked' : 'is-not-evaluated';
          route.append(element('span', `topology-path-arrow ${arrowClass}`, '→'));
        }
      });
      card.append(route, element('p', 'field-help', `Decisão: ${event.outcome}. ${event.reasons?.join(' ') ?? ''}`));
      pathContainer.append(card);
    }
  }

  function render() {
    const state = context.getState();
    const nodes = getTopologyNodes(state);
    diagram.replaceChildren();
    for (const id of MAP_ORDER) {
      const node = nodes.find((item) => item.id === id);
      if (!node) continue;
      const button = element('button', 'topology-map-node', node.name);
      button.type = 'button';
      button.dataset.topologyNode = node.id;
      button.setAttribute('aria-pressed', String(node.id === selectedId));
      button.addEventListener('click', () => showNode(node.id));
      diagram.append(button);
      if (id !== MAP_ORDER.at(-1)) diagram.append(element('span', 'topology-arrow', '→'));
    }

    nodeList.replaceChildren();
    const groups = [
      ['Componentes conceituais', nodes.filter((node) => node.kind === 'component' || node.kind === 'zero-trust-role')],
      ['Segmentos', nodes.filter((node) => node.kind === 'segment')],
      ['Recursos', nodes.filter((node) => node.kind === 'resource')],
    ];
    for (const [heading, items] of groups) {
      const section = element('div', 'topology-node-group');
      section.append(element('h5', '', heading));
      for (const node of items) {
        const label = node.kind === 'segment' && node.vlan !== null ? `VLAN ${node.vlan} · ${node.name}` : node.name;
        const button = element('button', 'topology-node-button', label);
        button.type = 'button';
        button.dataset.topologyNode = node.id;
        button.setAttribute('aria-pressed', String(node.id === selectedId));
        button.addEventListener('click', () => showNode(node.id));
        section.append(button);
      }
      nodeList.append(section);
    }

    const scenario = state.scenarios[scenarioSelect.value] ?? state.scenarios.zeroTrust;
    const segmentName = (id) => id === '*' ? 'Qualquer segmento' : state.segments.find((item) => item.id === id)?.name ?? id;
    const resourceName = (id) => id === '*' ? 'Qualquer recurso' : state.resources.find((item) => item.id === id)?.name ?? 'Recurso removido';
    ruleBody.replaceChildren();
    if (!scenario.networkRules.length) {
      const row = element('tr');
      const cell = element('td', 'empty-table-cell', 'Nenhuma regra específica; vale a política padrão.');
      cell.colSpan = 5;
      row.append(cell);
      ruleBody.append(row);
    } else {
      for (const rule of [...scenario.networkRules].sort((a, b) => a.priority - b.priority)) {
        const row = element('tr');
        row.append(textCell(rule.priority), textCell(rule.sourceSegments.map(segmentName).join(', ')), textCell(rule.destinationSegments.map(segmentName).join(', ')), textCell(rule.resourceIds.map(resourceName).join(', ')), textCell(rule.effect, `decision-pill decision-${rule.effect.toLowerCase()}`));
        ruleBody.append(row);
      }
    }
    if (selectedId) showNode(selectedId);
    renderLateralPaths(state);
  }

  scenarioSelect.addEventListener('change', render);
  render();
  context.registerRenderer(render);
  return render;
}
