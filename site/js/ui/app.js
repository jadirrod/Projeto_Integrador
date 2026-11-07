(() => {
  const root = document.documentElement;
  const body = document.body;
  const viewButtons = [...document.querySelectorAll('[data-view]')];
  const panels = [...document.querySelectorAll('[data-panel]')];
  const pageTitle = document.getElementById('page-title');
  const liveRegion = document.getElementById('live-region');
  const openTweaks = document.getElementById('open-tweaks');
  const tweaksPanel = document.getElementById('tweaks-panel');
  const closeTweaks = document.getElementById('close-tweaks');
  const themeToggle = document.getElementById('theme-toggle');

  function activateView(viewId, title) {
    const target = panels.find((panel) => panel.dataset.panel === viewId);
    if (!target) return;

    panels.forEach((panel) => {
      const active = panel === target;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    viewButtons.forEach((button) => {
      const active = button.dataset.view === viewId;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    const heading = title || target.querySelector('h2')?.textContent || 'ZERO TRUST LAB';
    if (pageTitle) pageTitle.textContent = heading;
    document.title = `${heading} · ZERO TRUST LAB`;
    if (liveRegion) liveRegion.textContent = `Seção ${heading} aberta.`;
    if (window.matchMedia('(max-width: 760px)').matches) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  }

  viewButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      activateView(button.dataset.view, button.dataset.title);
    });
  });

  function setTweaksOpen(open) {
    if (!tweaksPanel || !openTweaks) return;
    tweaksPanel.hidden = !open;
    openTweaks.setAttribute('aria-expanded', String(open));
    if (open) closeTweaks?.focus();
    else openTweaks.focus();
  }

  openTweaks?.addEventListener('click', () => setTweaksOpen(true));
  closeTweaks?.addEventListener('click', () => setTweaksOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && tweaksPanel && !tweaksPanel.hidden) setTweaksOpen(false);
  });

  document.querySelectorAll('[data-density-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      const density = button.dataset.densityChoice;
      body.dataset.density = density;
      document.querySelectorAll('[data-density-choice]').forEach((choice) => {
        const selected = choice === button;
        choice.classList.toggle('is-selected', selected);
        choice.setAttribute('aria-pressed', String(selected));
      });
      if (liveRegion) liveRegion.textContent = `Densidade ${button.textContent.trim()} ativada.`;
    });
  });

  themeToggle?.addEventListener('click', () => {
    const light = root.dataset.theme !== 'light';
    root.dataset.theme = light ? 'light' : 'dark';
    themeToggle.setAttribute('aria-pressed', String(light));
    themeToggle.textContent = light ? 'Voltar ao tema escuro' : 'Alternar tema claro';
    if (liveRegion) liveRegion.textContent = light ? 'Tema claro ativado.' : 'Tema escuro ativado.';
  });
})();
