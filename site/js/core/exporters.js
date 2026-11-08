const CSV_COLUMNS = Object.freeze([
  ['eventId', 'ID do evento'],
  ['timestamp', 'Timestamp'],
  ['scenarioLabel', 'Cenário'],
  ['testId', 'Teste'],
  ['classification', 'Classificação'],
  ['userName', 'Usuário fictício'],
  ['deviceName', 'Dispositivo fictício'],
  ['origin', 'Origem'],
  ['destination', 'Destino solicitado'],
  ['resourceName', 'Recurso'],
  ['outcome', 'Decisão'],
  ['reasons', 'Justificativa'],
  ['policyId', 'Política aplicada'],
  ['syntheticDecisionMs', 'Tempo sintético de decisão (ms)'],
  ['reachableResources', 'Recursos alcançados'],
]);

function toCell(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join(' | ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeCsv(value) {
  let text = toCell(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function formatRow(values) {
  return values.map(escapeCsv).join(',');
}

function eventValues(event) {
  return CSV_COLUMNS.map(([key]) => key === 'reasons' ? (event.reasons ?? []).join(' | ') : event[key]);
}

function rateText(value) {
  return value === null || value === undefined ? 'Sem dados' : `${Number(value).toFixed(1)}%`;
}

function timeText(value) {
  return value === null || value === undefined ? 'Sem dados' : `${Number(value).toFixed(1)} ms`;
}

export function exportEventsCsv(events) {
  if (!Array.isArray(events)) throw new TypeError('Eventos para CSV devem ser uma lista.');
  const rows = [formatRow(CSV_COLUMNS.map(([, label]) => label)), ...events.map((event) => formatRow(eventValues(event)))];
  return rows.join('\r\n');
}

export function exportReportCsv(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)
    || !report.metrics?.baseline || !report.metrics?.zeroTrust || !Array.isArray(report.events)) {
    throw new TypeError('Relatório incompleto para exportação CSV.');
  }
  const baseline = report.metrics.baseline;
  const zeroTrust = report.metrics.zeroTrust;
  const rows = [
    formatRow(['ZERO TRUST LAB — relatório experimental sintético']),
    formatRow(['Gerado em', report.generatedAt]),
    formatRow(['Experimento', report.experiment?.name ?? report.experiment?.id ?? 'Não informado']),
    formatRow(['Conclusão descritiva', report.automaticConclusion ?? 'Sem conclusão']),
    formatRow(['Limitação', report.disclosure ?? 'Resultados sintéticos']),
    '',
    formatRow(['Métricas comparativas']),
    formatRow(['Métrica', 'Baseline', 'Zero Trust']),
    formatRow(['Total de tentativas/eventos', baseline.totalAttempts, zeroTrust.totalAttempts]),
    formatRow(['ALLOW', baseline.allowedCount, zeroTrust.allowedCount]),
    formatRow(['DENY', baseline.deniedCount, zeroTrust.deniedCount]),
    formatRow(['RESTRICTED', baseline.restrictedCount, zeroTrust.restrictedCount]),
    formatRow(['REVIEW', baseline.reviewCount, zeroTrust.reviewCount]),
    formatRow(['Acessos bloqueados (DENY + RESTRICTED)', baseline.blockedCount, zeroTrust.blockedCount]),
    formatRow(['Taxa de bloqueio de tentativas adversas', rateText(baseline.blockRate), rateText(zeroTrust.blockRate)]),
    formatRow(['Taxa de sucesso de tentativas legítimas', rateText(baseline.legitimateSuccessRate), rateText(zeroTrust.legitimateSuccessRate)]),
    formatRow(['Tentativas adversas classificadas', baseline.adverseAttempts, zeroTrust.adverseAttempts]),
    formatRow(['Tentativas adversas bloqueadas', baseline.adverseBlocked, zeroTrust.adverseBlocked]),
    formatRow(['Tentativas laterais', baseline.lateralAttempts, zeroTrust.lateralAttempts]),
    formatRow(['Tentativas laterais não autorizadas', baseline.lateralBlocked, zeroTrust.lateralBlocked]),
    formatRow(['Tentativas laterais em revisão (não contadas como bloqueadas)', baseline.lateralReviewCount, zeroTrust.lateralReviewCount]),
    formatRow(['Recursos acessíveis distintos', baseline.accessibleResourceCount, zeroTrust.accessibleResourceCount]),
    formatRow(['Tempo sintético médio', timeText(baseline.meanSyntheticDecisionMs), timeText(zeroTrust.meanSyntheticDecisionMs)]),
    '',
  ];

  const resourceNames = new Map((report.configuration?.resources ?? []).map((resource) => [resource.id, resource.name]));
  for (const [scenarioId, label] of [['baseline', 'Baseline'], ['zeroTrust', 'Zero Trust']]) {
    rows.push(formatRow([`Recursos alcançados por identidade — ${label}`]));
    rows.push(formatRow(['Identidade', 'Quantidade de recursos', 'Recursos alcançados']));
    const groups = report.metricsByUser?.[scenarioId] ?? [];
    if (!groups.length) rows.push(formatRow(['Sem tentativas registradas', 0, '']));
    for (const group of groups) {
      rows.push(formatRow([group.userName, group.count, (group.resourceIds ?? []).map((id) => resourceNames.get(id) ?? id).join(' | ')]));
    }
    rows.push('');
  }

  rows.push(formatRow(['Catálogo de testes']));
  rows.push(formatRow(['ID', 'Caso', 'Classificação', 'Execuções pareadas']));
  for (const item of report.testCatalog ?? []) rows.push(formatRow([item.id, item.name, item.classification, item.executionCount]));
  rows.push('');
  rows.push(formatRow(['Presets']));
  rows.push(formatRow(['ID', 'Nome', 'Casos incluídos']));
  for (const preset of report.presets ?? []) rows.push(formatRow([preset.id, preset.name, preset.testIds]));
  rows.push('');

  rows.push(formatRow(['Eventos sintéticos']));
  rows.push(formatRow(CSV_COLUMNS.map(([, label]) => label)));
  for (const event of report.events) rows.push(formatRow(eventValues(event)));
  return rows.join('\r\n');
}

export function exportExperimentJson(experiment) {
  if (!experiment || typeof experiment !== 'object' || Array.isArray(experiment)) throw new TypeError('Relatório JSON deve ser um objeto.');
  return JSON.stringify(experiment, null, 2);
}
