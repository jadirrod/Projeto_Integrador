import { createDefaultState } from '../data/default-state.js';

export function initDocumentationUI(context) {
  const resetButton = document.getElementById('reset-demo-state');
  resetButton.addEventListener('click', () => {
    if (!window.confirm('Restaurar todos os dados demonstrativos? Usuários, recursos, políticas e histórico locais serão substituídos.')) return;
    context.updateState(createDefaultState(), 'Dados demonstrativos restaurados; o histórico anterior foi substituído.');
  });
}
