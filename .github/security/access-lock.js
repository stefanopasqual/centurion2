(() => {
  "use strict";
  /* Ingresso in due fasi (vedi accesso.js):
     1. password principale del sito, uguale per tutti;
     2. scelta del livello: volo libero e hangar (nient'altro) · squadra BLU / ROSSA con la sua password ·
        costruttori (Trainer e Comandante) con la loro password. Finché in livelli.json non c'è una password
        dei costruttori distinta, per i costruttori vale la principale. */
  const ITERATIONS = 600000;
  const SALT = "1cde619737aa98e132b847b1c931ff36";
  const EXPECTED = "052711e982d114928a4e2572f2c835abefcc4ba4a3c656eb34f9ce948410c636";
  const LIVELLI = /*LIVELLI*/null/*FINE_LIVELLI*/ || {};
  const hexBytes = hex => Uint8Array.from(hex.match(/.{2}/g), x => parseInt(x, 16));
  const KEY = "centurion_accesso";
  let attempts = 0;
  let opening = false;

  async function verify(password, salt, expected, iterations) {
    if (!window.crypto || !crypto.subtle) throw new Error("Browser non compatibile con la verifica sicura della password.");
    const imported = await crypto.subtle.importKey("raw", new TextEncoder().encode(password.trim()), "PBKDF2", false, ["deriveBits"]);
    const raw = new Uint8Array(await crypto.subtle.deriveBits({
      name: "PBKDF2", salt: hexBytes(salt), iterations: iterations || ITERATIONS, hash: "SHA-256"
    }, imported, 256));
    const goal = hexBytes(expected);
    let mismatch = 0;
    for (let i = 0; i < 32; i++) mismatch |= raw[i] ^ goal[i];
    return mismatch === 0;
  }
  const principale = pw => verify(pw, SALT, EXPECTED, ITERATIONS);
  const costruttori = pw => LIVELLI.COSTRUTTORI ? verify(pw, LIVELLI.salt, LIVELLI.COSTRUTTORI, LIVELLI.iterations) : principale(pw);
  const PRINCIPALE_OK = "centurion_principale";
  // per la pagina «Password squadre»: le nuove password devono essere diverse dalla principale
  window.CENTURION_VERIFICA_PRINCIPALE = pw => principale(pw);
  const squadra = (pw, sq) => LIVELLI[sq] ? verify(pw, LIVELLI.salt, LIVELLI[sq], LIVELLI.iterations) : Promise.resolve(false);

  async function loadApp(accesso) {
    accesso = Object.assign({}, accesso, { costruttoriDistinti: !!LIVELLI.COSTRUTTORI });
    window.CENTURION_ACCESSO = Object.freeze(accesso);
    try { sessionStorage.setItem(KEY, JSON.stringify(accesso)); } catch (e) {}
    const waiting = [...document.querySelectorAll("script[data-locked-src]")];
    for (const item of waiting) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = item.dataset.lockedSrc;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Caricamento non riuscito: " + script.src));
        document.body.appendChild(script);
      });
    }
    document.getElementById("centurion-gate")?.remove();
    document.documentElement.classList.remove("password-required");
    document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }));
  }

  function setup() {
    const note = document.getElementById("centurion-gate-message");
    const say = t => { if (note) note.textContent = t; };
    // nella stessa sessione del browser l'accesso scelto resta valido anche ricaricando la pagina
    try {
      const prev = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (prev && [1, 2, 3].includes(prev.livello)) { opening = true; say("Apertura del simulatore…"); loadApp(prev).catch(err => { opening = false; say("Impossibile aprire: " + err.message); }); return; }
    } catch (e) {}

    // fase 1: password principale (nella stessa sessione del browser non viene richiesta di nuovo)
    const livelli = document.getElementById("centurion-levels"), primaForm = document.getElementById("centurion-main-form");
    const mostraLivelli = () => { if (primaForm) primaForm.hidden = true; if (livelli) livelli.hidden = false; say(""); };
    try { if (sessionStorage.getItem(PRINCIPALE_OK) === "1") mostraLivelli(); } catch (e) {}

    const libero = document.getElementById("centurion-free");
    libero?.addEventListener("click", async () => {
      if (opening || (livelli && livelli.hidden)) return; opening = true; say("Apertura di volo libero e hangar…");
      try { await loadApp({ livello: 3, squadra: null }); } catch (err) { opening = false; say("Impossibile aprire: " + (err.message || err)); }
    });

    const wire = (formId, inputId, check) => {
      const form = document.getElementById(formId), password = document.getElementById(inputId);
      if (!form || !password) return;
      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (opening || !password.value) return;
        const buttons = form.querySelectorAll("button"); buttons.forEach(b => b.disabled = true);
        say("Verifica in corso…");
        try {
          const accesso = await check(password.value, form);
          if (!accesso) {
            attempts++;
            say(accesso === null ? "Password delle squadre non ancora impostata: chiedi ai costruttori." : "Password non corretta.");
            password.value = ""; password.focus();
            await new Promise(resolve => setTimeout(resolve, Math.min(4000, attempts * 650)));
            return;
          }
          password.value = "";
          if (accesso === "fase2") return;
          opening = true; say("Apertura del simulatore…");
          await loadApp(accesso);
        } catch (err) {
          opening = false;
          console.error("CENTURION2 startup:", err);
          say("Impossibile aprire: " + (err.message || String(err)));
        } finally {
          if (!opening) buttons.forEach(b => b.disabled = false);
        }
      });
    };
    wire("centurion-main-form", "centurion-main-password", async pw => {
      if (!await principale(pw)) return false;
      try { sessionStorage.setItem(PRINCIPALE_OK, "1"); } catch (e) {}
      mostraLivelli(); return "fase2";
    });
    wire("centurion-password-form", "centurion-password", async pw => await costruttori(pw) ? { livello: 1, squadra: null } : false);
    wire("centurion-team-form", "centurion-team-password", async (pw, form) => {
      const sq = (form.querySelector('input[name="centurion-team"]:checked') || {}).value === "RED" ? "RED" : "BLUE";
      if (!LIVELLI[sq]) return null;
      return await squadra(pw, sq) ? { livello: 2, squadra: sq } : false;
    });

    const visibility = document.getElementById("centurion-show-password");
    visibility?.addEventListener("change", () => {
      document.querySelectorAll("#centurion-main-password, #centurion-password, #centurion-team-password").forEach(p => { p.type = visibility.checked ? "text" : "password"; });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup, { once: true });
  else setup();
})();
