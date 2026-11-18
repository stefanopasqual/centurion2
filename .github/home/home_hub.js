/* CENTURION 2 — four-entry landing screen, advanced features available through TRAINER only. */
(() => {
  'use strict';
  const q = s => document.querySelector(s);
  let panel, toggle, installed = false;

  // Stemmi dei quattro ingressi: toppe circolari nello stesso stile (colore del ruolo, simbolo bianco)
  const JET = 'M0-19L3-9V-4L16 7V10L3 6L2 13L7 17V19L0 17.5L-7 19V17L-2 13L-3 6L-16 10V7L-3-4V-9Z';
  const toppa = (base, luce, simbolo) => '<svg class="home-emblema" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
    '<circle cx="32" cy="32" r="30" fill="' + base + '"/>' +
    '<path d="M32 2a30 30 0 0 1 0 60z" fill="#000" fill-opacity=".14"/>' +
    '<circle cx="32" cy="32" r="29" fill="none" stroke="' + luce + '" stroke-width="2.4"/>' +
    '<circle cx="32" cy="32" r="24.5" fill="#0b1220" fill-opacity=".62" stroke="' + luce + '" stroke-opacity=".5"/>' +
    simbolo + '</svg>';
  const EMBLEMI = {
    TRAINER: toppa('#b8860b', '#f7d774',
      '<path d="M32 18 51 26.5 32 35 13 26.5Z" fill="#f4f8ff"/>' +
      '<path d="M21 31.5V39c2.8 3.2 6.8 4.8 11 4.8s8.2-1.6 11-4.8v-7.5L32 36.5Z" fill="#f4f8ff" fill-opacity=".85"/>' +
      '<path d="M48 28v10" stroke="#f7d774" stroke-width="2" stroke-linecap="round"/><circle cx="48" cy="40.5" r="2.6" fill="#f7d774"/>'),
    BLUE: toppa('#1f6fc4', '#8cc4ff',
      '<g fill="#f4f8ff"><path d="' + JET + '" transform="translate(32 25) scale(.5)"/>' +
      '<path d="' + JET + '" transform="translate(20.5 37) scale(.4)"/><path d="' + JET + '" transform="translate(43.5 37) scale(.4)"/></g>'),
    RED: toppa('#c0392b', '#ff9a8c',
      '<path d="M32 14.5 46 19.5V31c0 9.2-6 15.6-14 18.5C24 46.6 18 40.2 18 31V19.5Z" fill="#f4f8ff"/>' +
      '<path d="M32 23 33.8 28.5H39.6L34.9 31.9 36.7 37.5 32 34.1 27.3 37.5 29.1 31.9 24.4 28.5H30.2Z" fill="#c0392b"/>'),
    VOLO: toppa('#138a7e', '#7fe0d0',
      '<path d="M15 48C21 44 25 40 28.5 35.5" fill="none" stroke="#f4f8ff" stroke-opacity=".75" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 4.2"/>' +
      '<path d="' + JET + '" transform="translate(36 27) rotate(40) scale(.62)" fill="#f4f8ff"/>')
  };
  function emblemi(root) {   // sostituisce le emoji dei ruoli (anche nella scelta delle postazioni in rete)
    if (!root) return;
    root.querySelectorAll('.role-btn').forEach(b => {
      const ruolo = b.dataset.role || b.dataset.sm, big = b.querySelector('.big');
      if (big && EMBLEMI[ruolo] && !big.querySelector('svg')) big.innerHTML = EMBLEMI[ruolo];
    });
  }

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
    // stesso aspetto degli altri tre ingressi: stemma, titolo, descrizione
    flight.classList.add('home-card');
    flight.innerHTML = '<span class="big">' + EMBLEMI.VOLO + '</span><b>VOLO LIBERO</b><small>Pilota tu: Typhoon, F‑16, F‑22, Su‑57 e altri velivoli</small>';
    flight.title = 'Pilota direttamente un caccia';
    emblemi(roles);
    new MutationObserver(() => emblemi(multi)).observe(multi, {childList:true, subtree:true});
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