import { loadState, saveState } from '../core/storage.js';
import { initDashboardUI } from './dashboard.js';
import { initDocumentationUI } from './documentation.js';
import { initEventLogUI } from './event-log.js';
import { initManagementUI } from './management.js';
import { initPolicyUI } from './policies.js';
import { initReportUI } from './report.js';
import { initTestRunnerUI } from './test-runner.js';
import { initTopologyUI } from './topology.js';

let browserStorage = null;
try { browserStorage = window.localStorage; } catch { /* armazenamento pode estar bloqueado pelo navegador */ }

const loaded = loadState(browserStorage);
let state = loaded.state;
const renderers = new Set();
const status = document.getElementById('app-status');
const liveRegion = document.getElementById('live-region');

function announce(message) {
  if (!message) return;
  status.textContent = message;
  status.hidden = false;
  liveRegion.textContent = message;
}

const context = {
  getState: () => state,
  registerRenderer: (render) => renderers.add(render),
  announce,
  updateState(nextState, message) {
    state = nextState;
    let feedback = message;
    try {
      saveState(state, browserStorage);
    } catch (error) {
      feedback = `${message ?? 'Estado atualizado'} A persistência local falhou; esta alteração permanece apenas nesta sessão. ${error.message}`;
    }
    for (const render of renderers) {
      try { render(); } catch (error) { console.error('Falha ao atualizar painel:', error); }
    }
    if (feedback) announce(feedback);
  },
};

function activateView(viewId, title) {
  const panels = [...document.querySelectorAll('[data-panel]')];
  const target = panels.find((panel) => panel.dataset.panel === viewId);
  if (!target) return;
  panels.forEach((panel) => {
    const active = panel === target;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
  document.querySelectorAll('[data-view]').forEach((button) => {
    const active = button.dataset.view === viewId;
    button.classList.toggle('is-active', active);
    if (button.matches('button')) {
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  });
  const heading = title || target.querySelector('h2')?.textContent || 'ZERO TRUST LAB';
  document.getElementById('page-title').textContent = heading;
  document.title = `${heading} · ZERO TRUST LAB`;
  liveRegion.textContent = `Seção ${heading} aberta.`;
  if (window.matchMedia('(max-width: 760px)').matches) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  }
}

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    activateView(button.dataset.view, button.dataset.title);
  });
});

const openTweaks = document.getElementById('open-tweaks');
const tweaksPanel = document.getElementById('tweaks-panel');
const closeTweaks = document.getElementById('close-tweaks');
function setTweaksOpen(open) {
  tweaksPanel.hidden = !open;
  openTweaks.setAttribute('aria-expanded', String(open));
  if (open) closeTweaks.focus();
  else openTweaks.focus();
}
openTweaks.addEventListener('click', () => setTweaksOpen(true));
closeTweaks.addEventListener('click', () => setTweaksOpen(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !tweaksPanel.hidden) setTweaksOpen(false);
});

document.querySelectorAll('[data-density-choice]').forEach((button) => {
  button.addEventListener('click', () => {
    document.body.dataset.density = button.dataset.densityChoice;
    for (const option of document.querySelectorAll('[data-density-choice]')) {
      const selected = option === button;
      option.classList.toggle('is-selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    }
    announce(`Densidade ${button.textContent.trim()} ativada.`);
  });
});

const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
  const isLight = document.documentElement.dataset.theme !== 'light';
  document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
  themeToggle.setAttribute('aria-pressed', String(isLight));
  themeToggle.textContent = isLight ? 'Voltar ao tema escuro' : 'Alternar tema claro';
  announce(isLight ? 'Tema claro ativado.' : 'Tema escuro ativado.');
});

initManagementUI(context);
initPolicyUI(context);
initTopologyUI(context);
initTestRunnerUI(context);
initEventLogUI(context);
initDashboardUI(context);
initReportUI(context);
initDocumentationUI(context);

if (loaded.recoveryNotice) announce(loaded.recoveryNotice);
else if (!browserStorage) announce('O armazenamento do navegador está indisponível; o laboratório funcionará apenas nesta sessão.');
