import { buildScenarioConfig, evaluateAttempt } from './policy-engine.js';
import { createTestAttempt, TEST_CATALOG } from './test-catalog.js';

export function runPairedTest(attempt, appState) {
  if (!appState || typeof appState !== 'object') throw new TypeError('Estado do laboratório obrigatório.');
  const input = JSON.parse(JSON.stringify(attempt));
  const baseline = evaluateAttempt(input, buildScenarioConfig(appState, 'baseline'));
  const zeroTrust = evaluateAttempt(input, buildScenarioConfig(appState, 'zeroTrust'));
  return {
    testId: input.testId ?? 'custom',
    input,
    baseline: { ...baseline, testId: input.testId ?? 'custom' },
    zeroTrust: { ...zeroTrust, testId: input.testId ?? 'custom' },
  };
}

export function runTestSuite(appState, testIds = TEST_CATALOG.map((item) => item.id)) {
  if (!Array.isArray(testIds)) throw new TypeError('A seleção de casos deve ser uma lista de IDs.');
  const knownIds = new Set(TEST_CATALOG.map((item) => item.id));
  const unknown = testIds.filter((id) => !knownIds.has(id));
  if (unknown.length) throw new RangeError(`Teste sintético desconhecido: ${unknown.join(', ')}`);
  return testIds.map((testId) => runPairedTest(createTestAttempt(testId, appState), appState));
}
