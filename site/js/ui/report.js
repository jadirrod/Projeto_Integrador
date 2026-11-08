import { calculateComparisonMetrics, getAccessibleResourcesByUser } from '../core/metrics.js';
import { PRESET_CATALOG, TEST_CATALOG } from '../core/test-catalog.js';
import { exportExperimentJson, exportReportCsv } from '../core/exporters.js';
import { downloadText, element } from './dom.js';

const percentText = (value) => value === null ? 'Sem dados (denominador zero)' : `${value.toFixed(1)}%`;
const timeText = (value) => value === null ? 'Sem dados' : `${value.toFixed(1)} ms`;

function buildAutomaticConclusion(metrics) {
  const baseline = metrics.baseline;
  const zeroTrust = metrics.zeroTrust;
  if (!baseline.adverseAttempts || !zeroTrust.adverseAttempts) {
    return 'Ainda não há tentativas adversas classificadas nos dois cenários; a taxa de bloqueio não permite comparação.';
  }
  const delta = Math.round((zeroTrust.blockRate - baseline.blockRate) * 10) / 10;
  const direction = delta > 0 ? 'maior' : delta < 0 ? 'menor' : 'igual';
  const difference = Math.abs(delta).toFixed(1);
  return `Neste conjunto sintético, a taxa de bloqueio de tentativas adversas foi ${percentText(baseline.blockRate)} no Baseline e ${percentText(zeroTrust.blockRate)} em Zero Trust (${direction} em ${difference} ponto(s) percentual(is)). É uma comparação descritiva dos casos configurados, não uma medição de eficácia real nem uma inferência causal.`;
}

export function buildExperimentReport(state, generatedAt = new Date().toISOString()) {
  const metrics = calculateComparisonMetrics(state.events);
  const eventUserIds = new Set(state.events.map((event) => event.userId).filter(Boolean));
  const eventResourceIds = new Set(state.events.flatMap((event) => event.requestedResourceIds ?? [event.resourceId]).filter(Boolean));
  const testCatalog = TEST_CATALOG.map((item) => ({
    ...item,
    executionCount: state.events.filter((event) => event.testId === item.id && event.scenarioId === 'baseline').length,
  }));
  const executedCustomCases = [...new Set(state.events.map((event) => event.testId).filter((id) => id && !TEST_CATALOG.some((item) => item.id === id)))];
  return {
    reportSchemaVersion: 2,
    title: 'ZERO TRUST LAB — relatório experimental sintético',
    generatedAt,
    experiment: structuredClone(state.experiment),
    stateRevision: state.revision,
    disclosure: 'Resultados, identidades, endereços IP, regras e tempos são sintéticos. Não constituem medições nem demonstram eficácia de infraestrutura real.',
    automaticConclusion: buildAutomaticConclusion(metrics),
    metrics,
    metricsByUser: {
      baseline: getAccessibleResourcesByUser(state.events, 'baseline'),
      zeroTrust: getAccessibleResourcesByUser(state.events, 'zeroTrust'),
    },
    configuration: {
      users: state.users.map(({ id, name, groupId, role, privilegeLevel, accountStatus }) => ({ id, name, groupId, role, privilegeLevel, accountStatus })),
      resources: structuredClone(state.resources),
      segments: structuredClone(state.segments),
      scenarios: structuredClone(state.scenarios),
    },
    usersInvolved: [...eventUserIds].map((id) => {
      const user = state.users.find((item) => item.id === id);
      const event = state.events.find((item) => item.userId === id);
      return { id, name: user?.name ?? event?.userName ?? 'Identidade desconhecida' };
    }),
    resourcesEvaluated: [...eventResourceIds].map((id) => {
      const resource = state.resources.find((item) => item.id === id);
      const event = state.events.find((item) => item.resourceId === id || item.requestedResourceIds?.includes(id));
      return { id, name: resource?.name ?? event?.resourceName ?? 'Recurso removido' };
    }),
    testCatalog,
    presets: PRESET_CATALOG.map((preset) => ({ ...preset, testIds: [...preset.testIds] })),
    executedCustomCases,
    events: structuredClone(state.events),
  };
}

function appendAccessibleResources(container, report, state) {
  const panel = element('section', 'report-access-panel');
  panel.append(element('h4', '', 'Recursos alcançados por identidade'));
  const scenarios = [
    ['baseline', 'Baseline'],
    ['zeroTrust', 'Zero Trust'],
  ];
  const grid = element('div', 'report-access-grid');
  for (const [scenarioId, label] of scenarios) {
    const card = element('article', 'report-access-card');
    card.append(element('h5', '', label));
    const rows = report.metricsByUser[scenarioId];
    if (!rows.length) {
      card.append(element('p', 'field-help', 'Sem tentativas registradas neste cenário.'));
    } else {
      const table = element('table', 'report-access-table');
      const head = element('thead');
      const header = element('tr');
      for (const title of ['Identidade', 'Recursos alcançados']) {
        const cell = element('th', '', title);
        cell.scope = 'col';
        header.append(cell);
      }
      head.append(header);
      const body = element('tbody');
      for (const row of rows) {
        const resourceNames = row.resourceIds.map((id) => state.resources.find((resource) => resource.id === id)?.name ?? id);
        const tr = element('tr');
        tr.append(element('td', '', row.userName), element('td', '', resourceNames.length ? resourceNames.join(' · ') : 'Nenhum recurso alcançado'));
        body.append(tr);
      }
      table.append(head, body);
      card.append(table);
    }
    grid.append(card);
  }
  panel.append(grid);
  container.append(panel);
}

export function initReportUI(context) {
  const summary = document.getElementById('report-summary');
  let report = null;

  function render() {
    const state = context.getState();
    const metrics = calculateComparisonMetrics(state.events);
    report = buildExperimentReport(state);
    summary.replaceChildren();
    summary.append(element('span', 'placeholder-tag', state.events.length ? 'RESUMO AUTOMÁTICO · SOMENTE CONTAGENS' : 'SEM EXECUÇÕES'));
    summary.append(element('h3', '', state.events.length ? 'Resultados da configuração atual' : 'Aguardando execução'));
    summary.append(element('p', 'report-intro', state.events.length
      ? `Foram registrados ${state.events.length} eventos de decisão (${Math.floor(state.events.length / 2)} execução(ões) pareada(s)) neste navegador. Os resultados descrevem somente os casos e as políticas executados.`
      : 'Execute um preset ou uma solicitação personalizada para gerar métricas. Nenhum resultado é pré-preenchido.'));

    const cards = element('div', 'report-metric-grid');
    for (const [label, metric] of [['Baseline', metrics.baseline], ['Zero Trust', metrics.zeroTrust]]) {
      const card = element('article', 'report-metric-card');
      card.append(element('h4', '', label), element('p', '', `${metric.allowedCount} ALLOW · ${metric.deniedCount} DENY · ${metric.restrictedCount} RESTRICTED · ${metric.reviewCount} REVIEW`), element('p', '', `Taxa de bloqueio indevido: ${percentText(metric.blockRate)} (${metric.adverseBlocked}/${metric.adverseAttempts})`), element('p', '', `Sucesso de acessos legítimos: ${percentText(metric.legitimateSuccessRate)} (${metric.legitimateAllowed}/${metric.legitimateAttempts})`), element('p', '', `Tentativas laterais contidas: ${metric.lateralBlocked}/${metric.lateralAttempts} · em revisão: ${metric.lateralReviewCount}`), element('p', '', `Recursos alcançados: ${metric.accessibleResourceCount}`), element('p', '', `Tempo sintético médio: ${timeText(metric.meanSyntheticDecisionMs)}`));
      cards.append(card);
    }
    summary.append(cards);

    const chart = element('section', 'report-visual-summary');
    chart.append(element('h4', '', 'Taxa de bloqueio de tentativas classificadas como indevidas'));
    for (const [label, metric, colorClass] of [['Baseline', metrics.baseline, 'report-bar-baseline'], ['Zero Trust', metrics.zeroTrust, 'report-bar-zt']]) {
      const row = element('div', 'report-bar-row');
      row.append(element('span', 'report-bar-label', label));
      const track = element('div', 'report-bar-track');
      const bar = element('span', `report-bar ${colorClass}`);
      bar.style.width = `${metric.blockRate ?? 0}%`;
      track.append(bar);
      row.append(track, element('strong', 'report-bar-value', percentText(metric.blockRate)));
      chart.append(row);
    }
    summary.append(chart);
    const conclusion = element('section', 'report-conclusion');
    conclusion.append(element('h4', '', 'Conclusão descritiva'), element('p', '', report.automaticConclusion));
    summary.append(conclusion);
    appendAccessibleResources(summary, report, state);

    const counts = element('section', 'report-catalog-panel');
    counts.append(element('h4', '', 'Casos de teste e presets'));
    counts.append(element('p', 'field-help', `O catálogo mantém ${report.testCatalog.length} casos; cada execução é contada uma vez pelo par Baseline/Zero Trust.`));
    const list = element('ul', 'report-test-list');
    for (const item of report.testCatalog) list.append(element('li', '', `${item.name} — ${item.executionCount} execução(ões)`));
    counts.append(list);
    counts.append(element('p', 'field-help', `Presets: ${report.presets.map((preset) => preset.name).join(' · ')}.`));
    summary.append(counts);

    const formula = element('p', 'footnote', 'Fórmulas: bloqueio indevido = DENY ou RESTRICTED em tentativas classificadas como adversas ÷ tentativas adversas; sucesso legítimo = ALLOW em tentativas classificadas como legítimas ÷ tentativas legítimas. Denominador zero é reportado como sem dados. RESTRICTED conta como contenção; REVIEW não conta como bloqueio.');
    summary.append(formula);
    summary.append(element('p', 'footnote', `O modelo é determinístico. Os tempos são sintéticos e derivados da quantidade de verificações; as políticas atuais são capturadas no relatório gerado em ${new Date(report.generatedAt).toLocaleString('pt-BR')}.`));
    summary.append(element('p', 'footnote', report.disclosure));
  }

  document.getElementById('report-refresh').addEventListener('click', () => { render(); context.announce('Relatório atualizado a partir do estado e histórico atuais.'); });
  document.getElementById('report-export-csv').addEventListener('click', () => {
    try {
      report = buildExperimentReport(context.getState());
      downloadText('zero-trust-lab-relatorio.csv', exportReportCsv(report), 'text/csv;charset=utf-8');
    } catch (error) { context.announce(error.message); }
  });
  document.getElementById('report-export-json').addEventListener('click', () => {
    try {
      report = buildExperimentReport(context.getState());
      downloadText('zero-trust-lab-relatorio.json', exportExperimentJson(report), 'application/json;charset=utf-8');
    } catch (error) { context.announce(error.message); }
  });
  document.getElementById('report-print').addEventListener('click', () => window.print());
  render();
  context.registerRenderer(render);
  return render;
}
