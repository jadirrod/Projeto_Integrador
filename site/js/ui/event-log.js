import { clearAuditEvents } from '../core/audit.js';
import { exportEventsCsv, exportExperimentJson } from '../core/exporters.js';
import { downloadText, element, textCell } from './dom.js';

function outcomeCell(outcome) {
  return textCell(outcome, `decision-pill decision-${String(outcome).toLowerCase()}`);
}

export function initEventLogUI(context) {
  const body = document.getElementById('events-table-body');
  const search = document.getElementById('event-search');
  const scenario = document.getElementById('event-scenario-filter');
  const outcome = document.getElementById('event-outcome-filter');
  let filteredEvents = [];

  function filterEvents() {
    const state = context.getState();
    const query = search.value.trim().toLocaleLowerCase('pt-BR');
    filteredEvents = [...state.events]
      .filter((event) => scenario.value === 'all' || event.scenarioId === scenario.value)
      .filter((event) => outcome.value === 'all' || event.outcome === outcome.value)
      .filter((event) => !query || [event.eventId, event.userName, event.deviceName, event.origin, event.destination, event.resourceName, event.policyId, ...(event.reasons ?? [])].join(' ').toLocaleLowerCase('pt-BR').includes(query))
      .sort((a, b) => b.eventId.localeCompare(a.eventId));
    return state;
  }

  function render() {
    const state = filterEvents();
    body.replaceChildren();
    if (!filteredEvents.length) {
      const row = element('tr');
      const message = state.events.length ? 'Nenhum evento corresponde aos filtros.' : 'O histórico está vazio. Execute casos para registrar eventos.';
      const cell = element('td', 'empty-table-cell', message);
      cell.colSpan = 7;
      row.append(cell);
      body.append(row);
    } else {
      for (const event of filteredEvents) {
        const row = element('tr');
        row.append(textCell(new Date(event.timestamp).toLocaleString('pt-BR')), textCell(event.eventId), textCell(event.scenarioLabel), textCell(`${event.userName} · ${event.deviceName}`), textCell(`${event.origin} → ${event.destination}`), outcomeCell(event.outcome));
        const detailCell = element('td');
        const details = element('details', 'event-details');
        details.append(element('summary', '', 'Ver decisão'));
        const list = element('ul', 'detail-list');
        for (const reason of event.reasons ?? []) list.append(element('li', '', reason));
        list.append(element('li', '', `Política: ${event.policyId ?? 'não identificada'}`));
        list.append(element('li', '', `Autenticação: ${event.authentication?.status ?? '—'} · Autorização: ${event.authorization?.status ?? '—'}`));
        list.append(element('li', '', `Tempo sintético: ${event.syntheticDecisionMs ?? '—'} ms`));
        list.append(element('li', '', `Regra(s) no snapshot: ${(event.policySnapshot?.networkRules ?? []).map((rule) => rule.id).join(', ') || 'nenhuma'}`));
        details.append(list);
        detailCell.append(details);
        row.append(detailCell);
        body.append(row);
      }
    }
    document.getElementById('event-count').textContent = `${filteredEvents.length} evento(s) exibido(s) de ${state.events.length} registrado(s). Exportações respeitam os filtros atuais.`;
  }

  for (const control of [search, scenario, outcome]) control.addEventListener(control === search ? 'input' : 'change', render);
  document.getElementById('export-events-csv').addEventListener('click', () => {
    try { downloadText('zero-trust-lab-eventos.csv', `\uFEFF${exportEventsCsv(filteredEvents)}`, 'text/csv;charset=utf-8'); }
    catch (error) { context.announce(error.message); }
  });
  document.getElementById('export-events-json').addEventListener('click', () => {
    try { downloadText('zero-trust-lab-eventos.json', exportExperimentJson({ exportType: 'event-log', schemaVersion: 1, events: filteredEvents }), 'application/json;charset=utf-8'); }
    catch (error) { context.announce(error.message); }
  });
  document.getElementById('clear-events').addEventListener('click', () => {
    const current = context.getState();
    if (!current.events.length) { context.announce('O histórico já está vazio.'); return; }
    if (!window.confirm(`Limpar ${current.events.length} evento(s) deste navegador? Usuários, recursos e políticas serão mantidos.`)) return;
    context.updateState(clearAuditEvents(current), 'Histórico de eventos limpo; a configuração foi preservada.');
  });

  render();
  context.registerRenderer(render);
  return render;
}
