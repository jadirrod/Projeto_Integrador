import { calculateComparisonMetrics } from '../core/metrics.js';
import { element, textCell } from './dom.js';

const COLORS = { baseline: '#9aaabd', zeroTrust: '#55d6be', allow: '#55d6be', deny: '#ff7777', restricted: '#f0ba68', review: '#8c9cff', grid: 'rgba(150,170,190,.14)', text: '#aebdca' };
const OUTCOME_VALUE = { DENY: 0, RESTRICTED: 0.5, REVIEW: 0.25, ALLOW: 1 };

function showRate(value) { return value === null ? 'Sem dados' : `${value.toFixed(1)}%`; }
function showMs(value) { return value === null ? '—' : `${value.toFixed(1)} ms`; }
function outcomeText(metric) { return `${metric.allowedCount} ALLOW · ${metric.deniedCount} DENY · ${metric.restrictedCount} RESTRICTED · ${metric.reviewCount} REVIEW`; }

export function initDashboardUI(context) {
  const charts = new Map();
  const chartIds = ['outcomes', 'comparison', 'lateral', 'events', 'timeline'];

  function chartOptions(extra = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { labels: { color: COLORS.text, usePointStyle: true, boxWidth: 8 } }, tooltip: { intersect: false } },
      scales: {
        x: { ticks: { color: COLORS.text }, grid: { color: COLORS.grid } },
        y: { beginAtZero: true, ticks: { color: COLORS.text, precision: 0 }, grid: { color: COLORS.grid } },
      },
      ...extra,
    };
  }

  function drawChart(id, type, data, options, hasData) {
    const canvas = document.getElementById(`chart-${id}`);
    const empty = document.querySelector(`[data-chart-empty="${id}"]`);
    if (!window.Chart) {
      canvas.hidden = true;
      empty.hidden = false;
      empty.textContent = hasData ? 'Chart.js não foi carregado; tente novamente com conexão à internet.' : empty.textContent;
      return;
    }
    canvas.hidden = !hasData;
    empty.hidden = hasData;
    if (!hasData) {
      charts.get(id)?.destroy();
      charts.delete(id);
      return;
    }
    if (!charts.has(id)) {
      charts.set(id, new window.Chart(canvas, { type, data, options }));
    } else {
      const chart = charts.get(id);
      chart.config.type = type;
      chart.data = data;
      chart.options = options;
      chart.update('none');
    }
  }

  function renderCharts(state, comparison) {
    const events = state.events;
    const baseline = comparison.baseline;
    const zeroTrust = comparison.zeroTrust;
    const available = events.length > 0;
    drawChart('outcomes', 'bar', {
      labels: ['ALLOW', 'DENY + RESTRICTED', 'REVIEW'],
      datasets: [
        { label: 'Baseline', data: [baseline.allowedCount, baseline.blockedCount, baseline.reviewCount], backgroundColor: COLORS.baseline, borderRadius: 5 },
        { label: 'Zero Trust', data: [zeroTrust.allowedCount, zeroTrust.blockedCount, zeroTrust.reviewCount], backgroundColor: COLORS.zeroTrust, borderRadius: 5 },
      ],
    }, chartOptions(), available);

    const comparisonAvailable = baseline.adverseAttempts > 0 || zeroTrust.adverseAttempts > 0;
    drawChart('comparison', 'bar', {
      labels: ['Tentativas indevidas bloqueadas'],
      datasets: [
        { label: 'Baseline', data: [baseline.blockRate], backgroundColor: COLORS.baseline, borderRadius: 5 },
        { label: 'Zero Trust', data: [zeroTrust.blockRate], backgroundColor: COLORS.zeroTrust, borderRadius: 5 },
      ],
    }, chartOptions({ scales: { x: { ticks: { color: COLORS.text }, grid: { color: COLORS.grid } }, y: { beginAtZero: true, max: 100, ticks: { color: COLORS.text, callback: (value) => `${value}%` }, grid: { color: COLORS.grid } } } }), comparisonAvailable);

    const lateralAvailable = baseline.lateralAttempts > 0 || zeroTrust.lateralAttempts > 0;
    drawChart('lateral', 'bar', {
      labels: ['Tentativas', 'Contidas'],
      datasets: [
        { label: 'Baseline', data: [baseline.lateralAttempts, baseline.lateralBlocked], backgroundColor: COLORS.baseline, borderRadius: 5 },
        { label: 'Zero Trust', data: [zeroTrust.lateralAttempts, zeroTrust.lateralBlocked], backgroundColor: COLORS.zeroTrust, borderRadius: 5 },
      ],
    }, chartOptions(), lateralAvailable);

    const outcomes = ['ALLOW', 'DENY', 'RESTRICTED', 'REVIEW'];
    const outcomeCounts = outcomes.map((outcome) => events.filter((event) => event.outcome === outcome).length);
    drawChart('events', 'doughnut', {
      labels: outcomes,
      datasets: [{ data: outcomeCounts, backgroundColor: [COLORS.allow, COLORS.deny, COLORS.restricted, COLORS.review], borderWidth: 0 }],
    }, chartOptions({ scales: {}, plugins: { legend: { position: 'bottom', labels: { color: COLORS.text, usePointStyle: true, boxWidth: 8 } } } }), available);

    const byRun = new Map();
    const sorted = [...events].sort((a, b) => a.eventId.localeCompare(b.eventId));
    for (const event of sorted) {
      const sequence = Number(event.eventId?.match(/(\d+)$/)?.[1] ?? 0);
      const run = sequence ? Math.ceil(sequence / 2) : Math.ceil((sorted.indexOf(event) + 1) / 2);
      if (!byRun.has(run)) byRun.set(run, {});
      byRun.get(run)[event.scenarioId] = OUTCOME_VALUE[event.outcome] ?? null;
    }
    const timeline = [...byRun.entries()].slice(-20);
    drawChart('timeline', 'line', {
      labels: timeline.map(([, ], index) => `Execução ${index + 1}`),
      datasets: [
        { label: 'Baseline', data: timeline.map(([, pair]) => pair.baseline ?? null), borderColor: COLORS.baseline, backgroundColor: COLORS.baseline, pointRadius: 3, tension: 0.2 },
        { label: 'Zero Trust', data: timeline.map(([, pair]) => pair.zeroTrust ?? null), borderColor: COLORS.zeroTrust, backgroundColor: COLORS.zeroTrust, pointRadius: 3, tension: 0.2 },
      ],
    }, chartOptions({ scales: { x: { ticks: { color: COLORS.text }, grid: { color: COLORS.grid } }, y: { min: 0, max: 1, ticks: { stepSize: 0.25, color: COLORS.text, callback: (value) => ({ 0: 'DENY', 0.25: 'REVIEW', 0.5: 'RESTRICTED', 1: 'ALLOW' }[value] ?? '') }, grid: { color: COLORS.grid } } } }), available);
  }

  function render() {
    const state = context.getState();
    const comparison = calculateComparisonMetrics(state.events);
    const b = comparison.baseline;
    const z = comparison.zeroTrust;
    const pairs = Math.floor(state.events.length / 2);
    const values = {
      users: state.users.length,
      resources: state.resources.length,
      attempts: pairs,
      allowed: b.allowedCount + z.allowedCount,
      blocked: b.blockedCount + z.blockedCount,
      events: state.events.length,
      lateral: Math.min(b.lateralAttempts, z.lateralAttempts),
    };
    for (const [name, value] of Object.entries(values)) document.querySelector(`[data-metric="${name}"]`).textContent = String(value);
    document.getElementById('dashboard-run-state').textContent = pairs ? `${pairs} EXECUÇÃO(ÕES)` : 'SEM EXECUÇÕES';
    document.getElementById('baseline-state').textContent = b.totalAttempts ? `${b.totalAttempts} EVENTO(S)` : 'SEM DADOS';
    document.getElementById('zeroTrust-state').textContent = z.totalAttempts ? `${z.totalAttempts} EVENTO(S)` : 'SEM DADOS';
    document.getElementById('baseline-outcomes').textContent = outcomeText(b);
    document.getElementById('zeroTrust-outcomes').textContent = outcomeText(z);
    document.getElementById('baseline-block-rate').textContent = showRate(b.blockRate);
    document.getElementById('zeroTrust-block-rate').textContent = showRate(z.blockRate);
    document.getElementById('baseline-lateral').textContent = b.lateralAttempts ? `${b.lateralBlocked}/${b.lateralAttempts}` : 'Sem dados';
    document.getElementById('zeroTrust-lateral').textContent = z.lateralAttempts ? `${z.lateralBlocked}/${z.lateralAttempts}` : 'Sem dados';
    document.getElementById('baseline-time').textContent = showMs(b.meanSyntheticDecisionMs);
    document.getElementById('zeroTrust-time').textContent = showMs(z.meanSyntheticDecisionMs);
    const chartStatus = document.getElementById('chart-load-state');
    chartStatus.textContent = window.Chart ? 'Gráficos renderizados no cliente a partir do histórico local.' : 'Chart.js não carregou; os dados e as tabelas permanecem disponíveis.';
    renderCharts(state, comparison);

    const recent = [...state.events].sort((a, b) => b.eventId.localeCompare(a.eventId)).slice(0, 6);
    const body = document.getElementById('recent-events-body');
    body.replaceChildren();
    if (!recent.length) {
      const row = element('tr');
      const cell = element('td', 'empty-table-cell', 'Ainda não há eventos. Execute um preset para registrar decisões.');
      cell.colSpan = 5;
      row.append(cell);
      body.append(row);
    } else {
      for (const event of recent) {
        const row = element('tr');
        row.append(textCell(new Date(event.timestamp).toLocaleString('pt-BR')), textCell(event.scenarioLabel), textCell(event.userName), textCell(event.resourceName), textCell(event.outcome, `decision-pill decision-${event.outcome.toLowerCase()}`));
        body.append(row);
      }
    }
  }

  render();
  context.registerRenderer(render);
  window.addEventListener('load', render, { once: true });
  return render;
}
