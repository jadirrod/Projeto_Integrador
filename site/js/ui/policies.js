import { deleteNetworkRule, updateScenarioPolicy, upsertNetworkRule } from '../core/management.js';
import { element, replaceOptions, textCell } from './dom.js';

function names(ids, items) {
  return ids.map((id) => id === '*' ? 'Qualquer' : items.find((item) => item.id === id)?.name ?? id).join(', ');
}

export function initPolicyUI(context) {
  const scenarioSelect = document.getElementById('policy-scenario');
  const policyForm = document.getElementById('scenario-policy-form');
  const ruleForm = document.getElementById('network-rule-form');
  const rulesBody = document.getElementById('network-rules-body');
  let editingRuleId = null;

  function resetRuleForm() {
    ruleForm.reset();
    editingRuleId = null;
    document.getElementById('rule-id').readOnly = false;
    document.getElementById('rule-priority').value = '100';
    ruleForm.querySelector('button[type="submit"]').textContent = 'Adicionar regra';
  }

  function render() {
    const state = context.getState();
    const scenarioId = scenarioSelect.value;
    const scenario = state.scenarios[scenarioId];
    for (const control of policyForm.querySelectorAll('[data-policy-field]')) {
      const value = scenario[control.dataset.policyField];
      if (control.type === 'checkbox') control.checked = value === true;
      else control.value = String(value);
    }
    const segmentOptions = state.segments.map((segment) => ({ value: segment.id, label: segment.vlan === null ? segment.name : `VLAN ${segment.vlan} · ${segment.name}` }));
    replaceOptions(document.getElementById('rule-source'), segmentOptions, { placeholder: { value: '*', label: 'Qualquer origem' } });
    replaceOptions(document.getElementById('rule-destination'), segmentOptions, { placeholder: { value: '*', label: 'Qualquer destino' } });
    replaceOptions(document.getElementById('rule-resource'), state.resources.map((resource) => ({ value: resource.id, label: resource.name })), { placeholder: { value: '*', label: 'Qualquer recurso' } });

    rulesBody.replaceChildren();
    for (const rule of [...scenario.networkRules].sort((a, b) => a.priority - b.priority)) {
      const row = element('tr');
      row.append(textCell(rule.priority), textCell(rule.name), textCell(names(rule.sourceSegments, state.segments)), textCell(`${names(rule.destinationSegments, state.segments)} · ${names(rule.resourceIds, state.resources)}`), textCell(rule.effect, `decision-pill decision-${rule.effect.toLowerCase()}`));
      const actions = element('td', 'table-actions');
      const edit = element('button', 'text-button', 'Editar');
      edit.type = 'button';
      edit.dataset.action = 'edit-rule';
      edit.dataset.id = rule.id;
      const remove = element('button', 'danger-text-button', 'Remover');
      remove.type = 'button';
      remove.dataset.action = 'delete-rule';
      remove.dataset.id = rule.id;
      actions.append(edit, remove);
      row.append(actions);
      rulesBody.append(row);
    }
    if (!scenario.networkRules.length) {
      const row = element('tr');
      const cell = element('td', 'empty-table-cell', 'Sem regras específicas; a decisão usa a política padrão do cenário.');
      cell.colSpan = 6;
      row.append(cell);
      rulesBody.append(row);
    }
  }

  policyForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const patch = {};
    for (const control of policyForm.querySelectorAll('[data-policy-field]')) {
      const key = control.dataset.policyField;
      patch[key] = control.type === 'checkbox' ? control.checked : control.type === 'number' ? Number(control.value) : control.value;
    }
    try {
      context.updateState(updateScenarioPolicy(context.getState(), scenarioSelect.value, patch), 'Política salva; as novas execuções usarão estes critérios.');
    } catch (error) { context.announce(error.message); }
  });

  ruleForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const rule = {
      id: document.getElementById('rule-id').value.trim(),
      name: document.getElementById('rule-name').value.trim(),
      priority: Number(document.getElementById('rule-priority').value),
      sourceSegments: [document.getElementById('rule-source').value],
      destinationSegments: [document.getElementById('rule-destination').value],
      resourceIds: [document.getElementById('rule-resource').value],
      effect: document.getElementById('rule-effect').value,
    };
    try {
      context.updateState(upsertNetworkRule(context.getState(), scenarioSelect.value, rule), editingRuleId ? 'Regra atualizada.' : 'Regra de rede adicionada.');
      resetRuleForm();
    } catch (error) { context.announce(error.message); }
  });

  rulesBody.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const state = context.getState();
    const scenario = state.scenarios[scenarioSelect.value];
    const rule = scenario.networkRules.find((item) => item.id === button.dataset.id);
    if (!rule) return;
    try {
      if (button.dataset.action === 'delete-rule') {
        if (!window.confirm(`Remover a regra “${rule.name}” do cenário?`)) return;
        context.updateState(deleteNetworkRule(state, scenarioSelect.value, rule.id), 'Regra removida.');
      } else {
        editingRuleId = rule.id;
        document.getElementById('rule-id').value = rule.id;
        document.getElementById('rule-id').readOnly = true;
        document.getElementById('rule-name').value = rule.name;
        document.getElementById('rule-priority').value = String(rule.priority);
        document.getElementById('rule-source').value = rule.sourceSegments[0];
        document.getElementById('rule-destination').value = rule.destinationSegments[0];
        document.getElementById('rule-resource').value = rule.resourceIds[0];
        document.getElementById('rule-effect').value = rule.effect;
        ruleForm.querySelector('button[type="submit"]').textContent = 'Salvar alterações';
        ruleForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('rule-name').focus();
      }
    } catch (error) { context.announce(error.message); }
  });

  scenarioSelect.addEventListener('change', () => { resetRuleForm(); render(); });
  render();
  context.registerRenderer(render);
  return render;
}
