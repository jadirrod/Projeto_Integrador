import { appendPairedAuditEvents } from '../core/audit.js';
import { PRESET_CATALOG, TEST_CATALOG, createTestAttempt, getPreset } from '../core/test-catalog.js';
import { runPairedTest } from '../core/simulator.js';
import { element, replaceOptions, textCell } from './dom.js';

function decisionCell(outcome) {
  return textCell(outcome, `decision-pill decision-${String(outcome).toLowerCase()}`);
}

export function initTestRunnerUI(context) {
  const presetSelect = document.getElementById('test-preset');
  const testCases = document.getElementById('test-cases');
  const resultBody = document.getElementById('test-results-body');
  let lastPairs = [];
  let isRunning = false;

  function setSelectedCases(ids) {
    const selected = new Set(ids);
    for (const input of testCases.querySelectorAll('input[data-test-id]')) input.checked = selected.has(input.value);
  }

  function render() {
    const state = context.getState();
    replaceOptions(presetSelect, PRESET_CATALOG.map((preset) => ({ value: preset.id, label: preset.name })), { placeholder: { value: '', label: 'Escolha um preset' } });
    const userOptions = state.users.map((user) => ({ value: user.id, label: `${user.name} · ${user.groupId}` }));
    replaceOptions(document.getElementById('attempt-user'), userOptions, { placeholder: { value: '__default__', label: 'Usar identidade padrão do caso' } });
    replaceOptions(document.getElementById('custom-user'), userOptions);
    const resourceOptions = state.resources.map((resource) => ({ value: resource.id, label: `${resource.name} · ${resource.ip}` }));
    replaceOptions(document.getElementById('attempt-resource'), resourceOptions, { placeholder: { value: '__default__', label: 'Usar recurso padrão do caso' } });
    replaceOptions(document.getElementById('custom-resource'), resourceOptions);

    if (!testCases.childElementCount) {
      for (const testCase of TEST_CATALOG) {
        const label = element('label', 'test-case-option');
        const input = element('input');
        input.type = 'checkbox';
        input.value = testCase.id;
        input.dataset.testId = testCase.id;
        const copy = element('span', 'test-case-copy');
        copy.append(element('strong', '', testCase.name), element('small', '', testCase.description));
        label.append(input, copy);
        testCases.append(label);
      }
      const basic = getPreset('corporate-basic');
      presetSelect.value = basic.id;
      setSelectedCases(basic.testIds);
    }
    renderResults(state);
  }

  function renderResults(state = context.getState()) {
    const labelById = new Map(TEST_CATALOG.map((item) => [item.id, item.name]));
    resultBody.replaceChildren();
    if (!lastPairs.length) {
      const row = element('tr');
      const cell = element('td', 'empty-table-cell', 'Execute um caso para ver autenticação, autorização, decisão e justificativas.');
      cell.colSpan = 8;
      row.append(cell);
      resultBody.append(row);
      return;
    }
    for (const pair of lastPairs) {
      for (const decision of [pair.baseline, pair.zeroTrust]) {
        const row = element('tr');
        const user = state.users.find((item) => item.id === pair.input.userId);
        const resourceLabels = decision.reachableResources.map((id) => state.resources.find((item) => item.id === id)?.name ?? id).join(', ') || 'Nenhum';
        row.append(textCell(labelById.get(pair.testId) ?? pair.testId), textCell(decision.scenarioLabel), textCell(decision.authentication.status), textCell(decision.authorization.status), decisionCell(decision.outcome), textCell(resourceLabels), textCell(`${decision.syntheticDecisionMs} ms`), textCell(decision.reasons.join(' · ') || `Sem bloqueios; identidade ${user?.name ?? 'desconhecida'} avaliada.`));
        resultBody.append(row);
      }
    }
  }

  async function runPairs(pairs, summary) {
    if (!pairs.length) {
      context.announce('Selecione pelo menos um caso sintético antes de executar.');
      return;
    }
    if (isRunning) {
      context.announce('Uma execução já está em andamento. Aguarde a conclusão do lote atual.');
      return;
    }
    isRunning = true;
    const runButtons = [...document.querySelectorAll('#run-selected-tests, #run-all-tests, [data-run-all]')];
    runButtons.forEach((button) => { button.disabled = true; });
    try {
      let next = context.getState();
      lastPairs = [];
      for (const [index, pair] of pairs.entries()) {
        next = appendPairedAuditEvents(next, pair, { timestamp: new Date(Date.now() + index).toISOString() });
        lastPairs.push(pair);
        document.getElementById('test-run-summary').textContent = `${summary} · ${index + 1}/${pairs.length}`;
        context.updateState(next, `${index + 1}/${pairs.length} caso(s) registrados nos dois cenários; eventos locais atualizados.`);
        renderResults(next);
        if (index < pairs.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 32));
      }
      document.getElementById('test-run-summary').textContent = `${pairs.length} caso(s) · ${pairs.length * 2} decisões · sem rede real`;
      context.announce(`${pairs.length} caso(s) avaliados nos dois cenários; ${pairs.length * 2} eventos registrados localmente.`);
    } catch (error) {
      context.announce(`A execução foi interrompida: ${error.message}`);
    } finally {
      isRunning = false;
      runButtons.forEach((button) => { button.disabled = false; });
    }
  }

  function currentOverrides(testId, state) {
    const overrides = {};
    const selectedUserId = document.getElementById('attempt-user').value;
    if (selectedUserId !== '__default__') {
      const user = state.users.find((item) => item.id === selectedUserId);
      if (user) Object.assign(overrides, { userId: user.id, deviceId: user.deviceId });
    }
    const selectedResource = document.getElementById('attempt-resource').value;
    if (selectedResource !== '__default__' && testId !== 'lateral-movement') overrides.resourceId = selectedResource;
    if (document.getElementById('attempt-remote').checked) {
      overrides.isRemote = true;
      overrides.vpnAuthenticated = document.getElementById('attempt-vpn').checked;
      overrides.mfaVerified = document.getElementById('attempt-mfa').checked;
    }
    return overrides;
  }

  function runSelected(ids) {
    const state = context.getState();
    const pairs = ids.map((id) => {
      const attempt = createTestAttempt(id, state, currentOverrides(id, state));
      return runPairedTest(attempt, state);
    });
    runPairs(pairs, 'casos selecionados');
  }

  presetSelect.addEventListener('change', () => {
    const preset = getPreset(presetSelect.value);
    if (preset) setSelectedCases(preset.testIds);
  });
  document.getElementById('run-selected-tests').addEventListener('click', () => {
    runSelected([...testCases.querySelectorAll('input[data-test-id]:checked')].map((input) => input.value));
  });
  const runAll = () => runSelected(TEST_CATALOG.map((item) => item.id));
  document.getElementById('run-all-tests').addEventListener('click', runAll);
  document.querySelectorAll('[data-run-all]').forEach((button) => button.addEventListener('click', runAll));

  document.getElementById('custom-request-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const state = context.getState();
    const user = state.users.find((item) => item.id === document.getElementById('custom-user').value);
    const privilegeText = document.getElementById('custom-privilege').value;
    const attempt = {
      testId: 'custom-access',
      classification: document.getElementById('custom-classification').value,
      userId: user?.id,
      deviceId: user?.deviceId,
      resourceId: document.getElementById('custom-resource').value,
      isRemote: document.getElementById('custom-remote').checked,
      vpnAuthenticated: document.getElementById('custom-vpn').checked,
      mfaVerified: document.getElementById('custom-mfa').checked,
    };
    if (privilegeText !== '') attempt.requestedPrivilege = Number(privilegeText);
    try { runPairs([runPairedTest(attempt, state)], 'solicitação personalizada'); }
    catch (error) { context.announce(error.message); }
  });

  render();
  context.registerRenderer(render);
  return render;
}
