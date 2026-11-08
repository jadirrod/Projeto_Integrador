import { deleteResource, deleteUser, upsertResource, upsertUser } from '../core/management.js';
import { element, replaceOptions, textCell } from './dom.js';

function selectedValues(select) {
  return [...select.selectedOptions].map((option) => option.value);
}

function actionButton(action, label, id, className = 'text-button') {
  const button = element('button', className, label);
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.id = id;
  return button;
}

export function initManagementUI(context) {
  const userForm = document.getElementById('user-form');
  const userTable = document.getElementById('users-table-body');
  const userId = document.getElementById('user-id');
  const resourceForm = document.getElementById('resource-form');
  const resourceTable = document.getElementById('resources-table-body');
  const resourceId = document.getElementById('resource-id');
  let editingUserId = null;
  let editingResourceId = null;

  function resetUserForm() {
    userForm.reset();
    editingUserId = null;
    userId.readOnly = false;
    document.getElementById('user-form-title').textContent = 'Adicionar identidade';
  }

  function resetResourceForm() {
    resourceForm.reset();
    editingResourceId = null;
    resourceId.readOnly = false;
    document.getElementById('resource-form-title').textContent = 'Adicionar recurso';
  }

  function render() {
    const state = context.getState();
    replaceOptions(document.getElementById('user-group'), state.groups.map((group) => ({ value: group.id, label: group.name })));
    replaceOptions(document.getElementById('user-device'), state.devices.map((device) => ({ value: device.id, label: `${device.name} · ${device.trustStatus}` })));
    replaceOptions(document.getElementById('user-resources'), state.resources.map((resource) => ({ value: resource.id, label: resource.name })));
    replaceOptions(document.getElementById('resource-segment'), state.segments.map((segment) => ({ value: segment.id, label: segment.vlan === null ? segment.name : `VLAN ${segment.vlan} · ${segment.name}` })));
    replaceOptions(document.getElementById('resource-groups'), state.groups.map((group) => ({ value: group.id, label: group.name })));

    userTable.replaceChildren();
    for (const user of state.users) {
      const device = state.devices.find((item) => item.id === user.deviceId);
      const group = state.groups.find((item) => item.id === user.groupId);
      const row = element('tr');
      row.append(textCell(user.name), textCell(`${group?.name ?? user.groupId} · ${user.role}`), textCell(user.privilegeLevel), textCell(`${user.accountStatus} · ${device?.trustStatus ?? 'sem dispositivo'}`));
      const actions = element('td', 'table-actions');
      actions.append(actionButton('edit-user', 'Editar', user.id), actionButton('delete-user', 'Remover', user.id, 'danger-text-button'));
      row.append(actions);
      userTable.append(row);
    }
    document.getElementById('user-count').textContent = `${state.users.length} identidade(s) fictícia(s)`;

    resourceTable.replaceChildren();
    for (const resource of state.resources) {
      const segment = state.segments.find((item) => item.id === resource.segmentId);
      const row = element('tr');
      row.append(textCell(resource.name), textCell(resource.ip), textCell(segment?.vlan === null ? segment.name : `VLAN ${segment?.vlan ?? '—'} · ${segment?.name ?? resource.segmentId}`), textCell(resource.criticality), textCell(`${resource.allowedGroups.join(', ')} · nível ${resource.requiredPrivilege} · MFA ${resource.requiresMfa ? 'sim' : 'não'}`));
      const actions = element('td', 'table-actions');
      actions.append(actionButton('edit-resource', 'Editar', resource.id), actionButton('delete-resource', 'Remover', resource.id, 'danger-text-button'));
      row.append(actions);
      resourceTable.append(row);
    }
    document.getElementById('resource-count').textContent = `${state.resources.length} recurso(s) sintético(s)`;
  }

  userForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const state = context.getState();
    const deviceId = document.getElementById('user-device').value;
    const user = {
      id: userId.value.trim(), name: document.getElementById('user-name').value.trim(),
      groupId: document.getElementById('user-group').value, role: document.getElementById('user-role').value.trim(),
      accountStatus: document.getElementById('user-account-status').value,
      privilegeLevel: Number(document.getElementById('user-privilege').value), deviceId,
      credentialValid: document.getElementById('user-credential-valid').checked,
      remoteAllowed: document.getElementById('user-remote-allowed').checked,
      allowedResourceIds: selectedValues(document.getElementById('user-resources')),
    };
    try {
      const next = upsertUser(state, user);
      const trustStatus = document.getElementById('user-device-trust').value;
      next.devices = next.devices.map((device) => device.id === deviceId ? { ...device, trustStatus } : device);
      context.updateState(next, editingUserId ? 'Identidade atualizada.' : 'Identidade fictícia adicionada.');
      resetUserForm();
    } catch (error) {
      context.announce(error.message);
    }
  });

  resourceForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const state = context.getState();
    const resource = {
      id: resourceId.value.trim(), name: document.getElementById('resource-name').value.trim(),
      type: document.getElementById('resource-type').value.trim(), ip: document.getElementById('resource-ip').value.trim(),
      segmentId: document.getElementById('resource-segment').value,
      criticality: document.getElementById('resource-criticality').value,
      requiredPrivilege: Number(document.getElementById('resource-privilege').value),
      requiresMfa: document.getElementById('resource-requires-mfa').checked,
      allowedGroups: selectedValues(document.getElementById('resource-groups')),
    };
    try {
      const next = upsertResource(state, resource);
      context.updateState(next, editingResourceId ? 'Recurso atualizado.' : 'Recurso sintético adicionado.');
      resetResourceForm();
    } catch (error) {
      context.announce(error.message);
    }
  });

  userTable.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const state = context.getState();
    const user = state.users.find((item) => item.id === button.dataset.id);
    if (!user) return;
    try {
      if (button.dataset.action === 'delete-user') {
        if (!window.confirm(`Remover a identidade fictícia “${user.name}”?`)) return;
        context.updateState(deleteUser(state, user.id), 'Identidade removida.');
        if (editingUserId === user.id) resetUserForm();
        return;
      }
      editingUserId = user.id;
      userId.value = user.id;
      userId.readOnly = true;
      document.getElementById('user-name').value = user.name;
      document.getElementById('user-group').value = user.groupId;
      document.getElementById('user-role').value = user.role;
      document.getElementById('user-account-status').value = user.accountStatus;
      document.getElementById('user-privilege').value = String(user.privilegeLevel);
      document.getElementById('user-device').value = user.deviceId;
      document.getElementById('user-device-trust').value = state.devices.find((item) => item.id === user.deviceId)?.trustStatus ?? 'unknown';
      document.getElementById('user-credential-valid').checked = user.credentialValid;
      document.getElementById('user-remote-allowed').checked = user.remoteAllowed;
      for (const option of document.getElementById('user-resources').options) option.selected = user.allowedResourceIds.includes(option.value);
      document.getElementById('user-form-title').textContent = `Editar · ${user.name}`;
      userForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      userId.focus();
    } catch (error) { context.announce(error.message); }
  });

  resourceTable.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const state = context.getState();
    const resource = state.resources.find((item) => item.id === button.dataset.id);
    if (!resource) return;
    try {
      if (button.dataset.action === 'delete-resource') {
        if (!window.confirm(`Remover o recurso sintético “${resource.name}”?`)) return;
        context.updateState(deleteResource(state, resource.id), 'Recurso removido; concessões e referências de regras foram atualizadas.');
        if (editingResourceId === resource.id) resetResourceForm();
        return;
      }
      editingResourceId = resource.id;
      resourceId.value = resource.id;
      resourceId.readOnly = true;
      document.getElementById('resource-name').value = resource.name;
      document.getElementById('resource-type').value = resource.type;
      document.getElementById('resource-ip').value = resource.ip;
      document.getElementById('resource-segment').value = resource.segmentId;
      document.getElementById('resource-criticality').value = resource.criticality;
      document.getElementById('resource-privilege').value = String(resource.requiredPrivilege);
      document.getElementById('resource-requires-mfa').checked = resource.requiresMfa === true;
      for (const option of document.getElementById('resource-groups').options) option.selected = resource.allowedGroups.includes(option.value);
      document.getElementById('resource-form-title').textContent = `Editar · ${resource.name}`;
      resourceForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      resourceId.focus();
    } catch (error) { context.announce(error.message); }
  });

  document.getElementById('user-form-reset').addEventListener('click', resetUserForm);
  document.getElementById('resource-form-reset').addEventListener('click', resetResourceForm);
  render();
  context.registerRenderer(render);
  return render;
}
