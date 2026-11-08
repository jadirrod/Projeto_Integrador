const roundOneDecimal = (value) => Math.round(value * 10) / 10;
const blockedOutcomes = new Set(['DENY', 'RESTRICTED']);

function rate(numerator, denominator) {
  return denominator === 0 ? null : roundOneDecimal((numerator / denominator) * 100);
}

export function calculateMetrics(events, scenarioId = null) {
  if (!Array.isArray(events)) throw new TypeError('A coleção de eventos deve ser uma lista.');
  const selected = scenarioId ? events.filter((event) => event.scenarioId === scenarioId) : events;
  const allowedCount = selected.filter((event) => event.outcome === 'ALLOW').length;
  const deniedCount = selected.filter((event) => event.outcome === 'DENY').length;
  const restrictedCount = selected.filter((event) => event.outcome === 'RESTRICTED').length;
  const reviewCount = selected.filter((event) => event.outcome === 'REVIEW').length;
  const adverse = selected.filter((event) => event.classification === 'adverse');
  const legitimate = selected.filter((event) => event.classification === 'legitimate');
  const lateral = selected.filter((event) => event.testId === 'lateral-movement');
  const times = selected.map((event) => event.syntheticDecisionMs).filter((value) => Number.isFinite(value) && value >= 0);
  const timeSum = times.reduce((sum, value) => sum + value, 0);
  const resources = new Set(selected.flatMap((event) => Array.isArray(event.reachableResources) ? event.reachableResources : []));

  return {
    scenarioId,
    dataAvailable: selected.length > 0,
    totalAttempts: selected.length,
    allowedCount,
    deniedCount,
    restrictedCount,
    reviewCount,
    blockedCount: deniedCount + restrictedCount,
    registeredEvents: selected.length,
    adverseAttempts: adverse.length,
    adverseBlocked: adverse.filter((event) => blockedOutcomes.has(event.outcome)).length,
    blockRate: rate(adverse.filter((event) => blockedOutcomes.has(event.outcome)).length, adverse.length),
    legitimateAttempts: legitimate.length,
    legitimateAllowed: legitimate.filter((event) => event.outcome === 'ALLOW').length,
    legitimateSuccessRate: rate(legitimate.filter((event) => event.outcome === 'ALLOW').length, legitimate.length),
    lateralAttempts: lateral.length,
    lateralBlocked: lateral.filter((event) => blockedOutcomes.has(event.outcome)).length,
    lateralReviewCount: lateral.filter((event) => event.outcome === 'REVIEW').length,
    accessibleResourceCount: resources.size,
    meanSyntheticDecisionMs: times.length ? roundOneDecimal(timeSum / times.length) : null,
  };
}

export function calculateComparisonMetrics(events) {
  return {
    baseline: calculateMetrics(events, 'baseline'),
    zeroTrust: calculateMetrics(events, 'zeroTrust'),
  };
}

export function getAccessibleResourcesByUser(events, scenarioId = null) {
  if (!Array.isArray(events)) throw new TypeError('A coleção de eventos deve ser uma lista.');
  const groups = new Map();
  for (const event of events) {
    if (scenarioId && event.scenarioId !== scenarioId) continue;
    const userId = event.userId ?? 'unknown-user';
    if (!groups.has(userId)) groups.set(userId, { userId, userName: event.userName ?? 'Identidade desconhecida', resourceIds: new Set() });
    const row = groups.get(userId);
    for (const id of event.reachableResources ?? []) row.resourceIds.add(id);
  }
  return [...groups.values()]
    .map((row) => {
      const resourceIds = [...row.resourceIds].sort();
      return { userId: row.userId, userName: row.userName, resourceIds, count: resourceIds.length };
    })
    .sort((a, b) => a.userName.localeCompare(b.userName, 'pt-BR'));
}
