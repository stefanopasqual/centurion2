/* CENTURION 2 — four-entry landing screen, advanced features available through TRAINER only. */
(() => {
  'use strict';
  const q = s => document.querySelector(s);
  let panel, toggle, installed = false;

  function syncRole() {
    const trainer = !!(q('#role-badge') && q('#role-badge').textContent.trim() === 'TRAINER');
    document.body.classList.toggle('centurion-is-trainer', trainer);
    if (!trainer) close();
  }
  function close() {
    if (!panel) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }
  function open() {
    if (!panel || !document.body.classList.contains('centurion-is-trainer')) return;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }
  function moveCadet() {
    const button = q('#btn-cadet-splash'), dest = q('#centurion-trainer-actions');
    if (button && dest && button.parentElement !== dest) dest.insertBefore(button, dest.firstChild);
  }
  function init() {
    if (installed) return;
    const splash = q('#splash'), app = q('#app');
    const roles = q('#splash .splash-roles.unica'), flight = q('#btn-volo-splash');
    const links = q('#splash .splash-links'), modes = q('#splash .splash-modo');
    const multi = q('#splash-multi'), controls = q('#topbar .top-right');
    if (!splash || !app || !roles || !flight || !links || !modes || !multi || !controls) {
      console.error('CENTURION HOME: required markup missing'); return;
    }
    installed = true;
    // The home contains exactly four selectable entries, not a flight feature menu.
    roles.appendChild(flight);
    flight.textContent = '🕹 VOLO LIBERO';
    flight.title = 'Pilota direttamente un caccia';
    const sub = q('#splash .splash-sub');
    if (sub) sub.textContent = 'Seleziona una delle quattro modalità. Tutte le altre funzioni si trovano in Trainer.';

    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'centurion-trainer-tools';
    toggle.className = 'centurion-trainer-tools';
    toggle.textContent = '⚙ FUNZIONI TRAINER';
    toggle.setAttribute('aria-label', 'Apri le funzioni Trainer');
    toggle.setAttribute('aria-controls', 'centurion-trainer-panel');
    toggle.setAttribute('aria-expanded', 'false');
    controls.insertBefore(toggle, controls.firstChild);

    panel = document.createElement('section');
    panel.id = 'centurion-trainer-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Funzioni Trainer');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = [
      '<div class="centurion-hub-head"><strong>FUNZIONI TRAINER</strong><button type="button" id="centurion-hub-close" aria-label="Chiudi">✕</button></div>',
      '<p>Missioni, demo, istruzioni, hangar, installazione e impostazioni della sessione.</p>',
      '<h3>Strumenti e formazione</h3><div id="centurion-trainer-actions"></div>',
      '<h3>Postazioni e collegamento</h3><div id="centurion-trainer-network"></div>'
    ].join('');
    app.appendChild(panel);
    q('#centurion-trainer-actions').appendChild(links);
    const net = q('#centurion-trainer-network');
    net.appendChild(modes);
    net.appendChild(multi);
    moveCadet();

    // Keep all existing onclick bindings: the original DOM nodes are moved, never cloned.
    toggle.addEventListener('click', () =>
      panel.classList.contains('is-open') ? close() : open()
    );
    q('#centurion-hub-close').addEventListener('click', close);
    panel.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button && !button.classList.contains('modo-btn') && button.id !== 'centurion-hub-close') close();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    q('.role-btn.trainer')?.addEventListener('click', () => {
      syncRole(); setTimeout(open, 100);
    });
    const badge = q('#role-badge');
    if (badge) new MutationObserver(syncRole).observe(badge, {characterData:true, childList:true, attributes:true});
    const home = q('#splash .splash-box');
    if (home) new MutationObserver(moveCadet).observe(home, {childList:true, subtree:false});
    syncRole();
    // CADET adds its entry on DOMContentLoaded using a deferred task.
    setTimeout(moveCadet, 0);
    console.info('CENTURION HOME: Trainer / Blue / Red / Volo libero; utilities in Trainer');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();