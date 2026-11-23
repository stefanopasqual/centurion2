/* CENTURION2: Squadra ROSSA giocata da un umano (hot-seat, stessa schermata).
 * Qui stanno solo il markup dell'interruttore (mostrato nel briefing al TRAINER)
 * e la lettura del cambiamento. Lo spegnimento dell'IA della ROSSA e la regola
 * di default sono in engine.js e scenario_default.js (patch_red_umano.py). */
(function () {
  "use strict";
  window.REDUMANO_TOGGLE = function (sc) {
    var on = !!(sc && sc.regole && sc.regole.red_umano);
    return '<div class="step-hint rosso-umano">' +
      '<label><input type="checkbox" id="chk-red-umano"' + (on ? ' checked' : '') + '> ' +
      '🧑 <b>Squadra ROSSA</b>: la gioca un umano (hot-seat, stessa schermata)</label>' +
      '<br><small>Con l\'interruttore acceso l\'IA della ROSSA si spegne: decidi tu decolli, ' +
      'CAP e scramble (badge ruolo → comandi). In combattimento i caccia già in volo ' +
      'si difendono da soli.</small></div>';
  };
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!t || t.id !== "chk-red-umano") return;
    if (window.APP && APP.sc && APP.sc.regole) {
      APP.sc.regole.red_umano = !!t.checked;
      if (window.UI && UI.toast) {
        UI.toast(t.checked
          ? "🧑 Squadra ROSSA: umano (IA spenta)"
          : "🤖 Squadra ROSSA: robot (IA)");
      }
    }
  });
})();
