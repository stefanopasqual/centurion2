/* CENTURION2: return to home from any simulator view. */
(() => {
  if (window.__centurionHomeInstalled) return;
  window.__centurionHomeInstalled = true;
  function home(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    location.assign(new URL('./', document.baseURI).href);
    if (location.pathname.endsWith('/')) location.reload();
  }
  const button = document.createElement('button');
  button.id = 'centurion-home';
  button.type = 'button';
  button.textContent = '⌂ CENTURION';
  button.setAttribute('aria-label', 'Torna alla home di CENTURION');
  Object.assign(button.style, {
    position: 'fixed', left: '12px', bottom: '12px',
    zIndex: '2147483000', padding: '12px 15px',
    background: '#123c59', color: 'white',
    border: '1px solid #78bce3', borderRadius: '12px',
    font: '700 13px system-ui', cursor: 'pointer'
  });
  button.addEventListener('click', home);
  document.body.appendChild(button);
  const brand = document.querySelector('#topbar .brand');
  if (brand) { brand.style.cursor='pointer'; brand.addEventListener('click', home); }
})();
