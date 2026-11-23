/* CENTURION2 · livelli di accesso, scelti nella pagina d'ingresso (access-lock.js).
   1 Costruttori  · tutto: Trainer, Comandante, squadre, volo libero, hangar; impostano le password delle squadre.
   2 Squadra BLU o ROSSA · solo la propria squadra, catalogo missioni, volo libero e hangar;
                           niente Trainer, Comandante, demo, editor dati e niente vista dell'altra squadra.
   3 Volo libero e hangar · senza password.
   La separazione vale dentro l'app: i file del sito restano pubblici, quindi non è una protezione crittografica. */
(() => {
  "use strict";
  const A = window.CENTURION_ACCESSO || { livello: 1 };          // senza pagina d'ingresso (prove in locale) tutto aperto
  const L = A.livello, SQ = A.squadra === "RED" ? "RED" : A.squadra === "BLUE" ? "BLUE" : null;
  const ALTRA = SQ === "RED" ? "BLUE" : "RED";
  const NOMI = { 1: "Costruttori", 2: "Squadra " + (SQ === "RED" ? "ROSSA" : "BLU"), 3: "Volo libero e hangar" };
  const root = document.documentElement;
  root.dataset.accesso = "L" + L;
  if (SQ) root.dataset.squadra = SQ;

  // ---------- cosa si vede a ogni livello (regole CSS: valgono anche per gli elementi creati dopo) ----------
  const css = document.createElement("style"); css.id = "centurion-accesso";
  css.textContent = `
html[data-accesso="L2"] :is(#cmd-home,#cmd-open,.role-btn.trainer,[data-role="TRAINER"],#btn-demo,#btn-demo-splash,[data-fase="editor"],#centurion-trainer-tools,#btn-ruolo,[data-demo],[data-cat-edit]),
html[data-accesso="L2"][data-squadra="BLUE"] :is(.role-btn.red,[data-role="RED"]),
html[data-accesso="L2"][data-squadra="RED"] :is(.role-btn.blue,[data-role="BLUE"]),
html[data-accesso="L3"] :is(.splash-roles,.splash-modo,#splash-multi,.role-btn,#cmd-home,#cmd-open,#btn-missioni,#btn-missioni-splash,#btn-demo,#btn-demo-splash,#btn-ruolo,#btn-tour-splash,#centurion-trainer-tools)
{display:none!important}
#centurion-livello{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(10px + env(safe-area-inset-bottom));z-index:9997;display:flex;gap:6px;align-items:center;
 font:600 12px system-ui,Arial,sans-serif;color:#dfe9f5;background:#0d1a2bdd;border:1px solid #38506c;border-radius:10px;padding:6px 8px}
#centurion-livello button{font:inherit;color:#dfe9f5;background:#1c2f47;border:1px solid #4b6584;border-radius:8px;padding:4px 8px;cursor:pointer}
#centurion-pw{position:fixed;inset:0;z-index:2147483000;background:#000a;display:flex;align-items:center;justify-content:center;padding:16px}
#centurion-pw .box{max-width:420px;width:100%;background:#172234;color:#edf3ff;border:1px solid #38506c;border-radius:14px;padding:18px;font:15px system-ui,Arial,sans-serif}
#centurion-pw label{display:block;margin:10px 0 4px}#centurion-pw input{width:100%;padding:10px;border-radius:8px;border:1px solid #7289a7;background:#101a28;color:#fff}
#centurion-pw .az{display:flex;gap:8px;margin-top:14px}#centurion-pw .az button{flex:1;padding:10px;border-radius:8px;border:0;font-weight:700;cursor:pointer}
#centurion-pw small{color:#b9c6d8;display:block;margin-top:8px;line-height:1.4}
#splash .splash-roles #centurion-hangar-home{display:flex!important;flex-direction:column;align-items:center;justify-content:flex-start;gap:6px;min-width:0;min-height:0;margin:0;padding:22px 16px;text-align:center;
 background:var(--panel2);color:var(--txt);border:2px solid var(--line);border-radius:14px;font-size:14px;font-weight:400;letter-spacing:0;text-decoration:none;cursor:pointer;transition:.15s}
#splash .splash-roles #centurion-hangar-home b{font-size:18px}
#splash .splash-roles #centurion-hangar-home small{color:var(--muted)}
#splash .splash-roles #centurion-hangar-home:hover{transform:translateY(-3px);border-color:#e0a03a}
@media(max-width:700px){#splash .splash-roles #centurion-hangar-home{min-height:115px;padding:10px 8px;font-size:13px}#splash .splash-roles #centurion-hangar-home b{font-size:15px}}`;
  document.head.appendChild(css);

  // ---------- blocchi anche sulle funzioni, non solo sui pulsanti ----------
  const avviso = t => { try { UI.toast(t, 3500, true); } catch (e) { alert(t); } };
  function blocca(obj, nome, consenti, messaggio) {
    if (!obj || typeof obj[nome] !== "function" || obj[nome]._accesso) return;
    const orig = obj[nome], nuova = function () { if (!consenti.apply(this, arguments)) { avviso(messaggio); return false; } return orig.apply(this, arguments); };
    nuova._accesso = true; obj[nome] = nuova;
  }
  function proteggi() {
    if (L >= 2 && typeof COMANDANTE !== "undefined") blocca(COMANDANTE, "open", () => false, "Il Comandante è riservato ai costruttori degli scenari");
    if (typeof APP !== "undefined") blocca(APP, "setRuolo", r => L === 1 || (L === 2 && r === SQ), L === 3 ? "Con questo accesso sono disponibili il volo libero e l'hangar" : "Con questo accesso puoi giocare solo con la tua squadra");
    if (L === 3 && typeof MISSIONI !== "undefined") blocca(MISSIONI, "apriCatalogo", () => false, "Con questo accesso sono disponibili il volo libero e l'hangar");
    if (L >= 2 && typeof DEMO !== "undefined") ["avvia", "start", "parti"].forEach(f => blocca(DEMO, f, () => false, "La demo mostra entrambe le squadre: è riservata ai costruttori"));
  }

  // ---------- etichetta del livello, cambio di accesso, password delle squadre ----------
  function etichetta() {
    if (document.getElementById("centurion-livello") || !window.CENTURION_ACCESSO) return;
    const e = document.createElement("div"); e.id = "centurion-livello";
    const avvisoCostr = L === 1 && !A.costruttoriDistinti ? `<span title="Chi conosce la password principale può entrare come costruttore: imposta una password dei costruttori diversa">⚠ password costruttori = principale</span>` : "";
    e.innerHTML = `<span>🔓 ${NOMI[L]}</span>` + avvisoCostr + (L === 1 ? `<button type="button" data-pw>🔑 Password squadre</button>` : "") + `<button type="button" data-esci>Cambia accesso</button>`;
    e.querySelector("[data-esci]").onclick = () => { try { sessionStorage.removeItem("centurion_accesso"); } catch (x) {} location.reload(); };
    const pw = e.querySelector("[data-pw]"); if (pw) pw.onclick = impostaPassword;
    document.body.appendChild(e);
    // in volo e nelle viste 3D la barra coprirebbe l'HUD in basso: si nasconde e torna all'uscita
    setInterval(() => {
      let vola = false;
      try { vola = (typeof VOLO !== "undefined" && !!VOLO.attivo) || (typeof VISTA3D !== "undefined" && !!VISTA3D.attiva); } catch (x) {}
      e.style.display = vola ? "none" : "";
    }, 700);
  }
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  async function impronta(password, salt, iterations) {
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(password.trim()), "PBKDF2", false, ["deriveBits"]);
    const bytes = Uint8Array.from(salt.match(/.{2}/g), x => parseInt(x, 16));
    return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: bytes, iterations, hash: "SHA-256" }, k, 256));
  }
  function impostaPassword() {
    const d = document.createElement("div"); d.id = "centurion-pw";
    d.innerHTML = `<form class="box"><b>🔑 Password delle squadre</b>
      <label>Squadra BLU</label><input type="password" name="BLUE" autocomplete="new-password" minlength="6" required>
      <label>Squadra ROSSA</label><input type="password" name="RED" autocomplete="new-password" minlength="6" required>
      <label>Password Costruttori${A.costruttoriDistinti ? " (facoltativa: lascia vuoto per tenere l'attuale)" : " (consigliata: ora vale la principale)"}</label><input type="password" name="COSTRUTTORI" autocomplete="new-password" minlength="8">
      <small>Le password non lasciano questo dispositivo: si scarica solo il file <b>livelli.json</b> con le loro impronte cifrate (PBKDF2).
      Caricalo su GitHub nella cartella <b>.github/security</b> (si apre da sola) e premi Commit changes: dopo la pubblicazione valgono su tutti i dispositivi.
      Tutte devono essere diverse tra loro e dalla password principale d'ingresso.</small>
      <div class="az"><button type="button" data-no style="background:#2a3b52;color:#fff">Annulla</button><button type="submit" style="background:#53a8ff;color:#071525">Crea livelli.json</button></div></form>`;
    document.body.appendChild(d);
    d.querySelector("[data-no]").onclick = () => d.remove();
    d.querySelector("form").onsubmit = async ev => {
      ev.preventDefault(); const f = ev.target, b = f.BLUE.value, r = f.RED.value, c = f.COSTRUTTORI.value;
      if (b.trim() === r.trim()) { alert("Le password di BLU e ROSSA devono essere diverse"); return; }
      if (c && (c.trim() === b.trim() || c.trim() === r.trim())) { alert("La password dei Costruttori deve essere diversa da quelle delle squadre"); return; }
      const ver = window.CENTURION_VERIFICA_PRINCIPALE;
      if (ver) { for (const [nome, v] of [["BLU", b], ["ROSSA", r], ["Costruttori", c]]) { if (v && await ver(v)) { alert("La password " + nome + " non può essere uguale alla password principale d'ingresso"); return; } } }
      const iterations = 600000, salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      const out = { formato: "centurion-livelli-1", iterations, salt, BLUE: await impronta(b, salt, iterations), RED: await impronta(r, salt, iterations) };
      if (c) out.COSTRUTTORI = await impronta(c, salt, iterations);
      f.BLUE.value = f.RED.value = f.COSTRUTTORI.value = "";
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }), a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "livelli.json"; document.body.appendChild(a); a.click(); a.remove();
      window.open("https://github.com/stefanopasqual/centurion2/upload/main/.github/security", "_blank", "noopener");
      d.remove(); avviso("livelli.json scaricato: caricalo su GitHub in .github/security");
    };
  }

  // hangar raggiungibile dalla home a ogni livello: scheda accanto a «Volo libero» che apre l'hangar 3D
  function schedaHangar() {
    const volo = document.getElementById("btn-volo-splash");
    if (!volo || document.getElementById("centurion-hangar-home")) return;
    const b = document.createElement("button"); b.type = "button"; b.id = "centurion-hangar-home"; b.className = volo.className;
    // stemma nello stesso stile degli altri ingressi: toppa ambra con l'arco dell'hangar e un jet
    const stemma = '<svg class="home-emblema" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="30" fill="#b9771f"/>' +
      '<path d="M32 2a30 30 0 0 1 0 60z" fill="#000" fill-opacity=".14"/><circle cx="32" cy="32" r="29" fill="none" stroke="#ffd08a" stroke-width="2.4"/>' +
      '<circle cx="32" cy="32" r="24.5" fill="#0b1220" fill-opacity=".62" stroke="#ffd08a" stroke-opacity=".5"/>' +
      '<path d="M15 44V31C15 21 23 15.5 32 15.5S49 21 49 31V44" fill="none" stroke="#f4f8ff" stroke-width="2.6" stroke-linejoin="round"/><path d="M13 44H51" stroke="#f4f8ff" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M0-19L3-9V-4L16 7V10L3 6L2 13L7 17V19L0 17.5L-7 19V17L-2 13L-3 6L-16 10V7L-3-4V-9Z" transform="translate(32 33) scale(.5)" fill="#f4f8ff"/></svg>';
    b.innerHTML = '<span class="big">' + stemma + '</span><b>HANGAR 3D</b><small>I velivoli in dettaglio: F-14, Eurofighter, C-130J, operatore PJ e gli altri</small>';
    b.addEventListener("click", () => { const l = document.getElementById("ef2000-launcher"); if (l) l.click(); else avviso("Hangar non ancora caricato: riprova tra un istante"); });
    volo.insertAdjacentElement("afterend", b);
  }
  function avvio() { proteggi(); etichetta(); schedaHangar(); setTimeout(() => { proteggi(); schedaHangar(); }, 1500); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", avvio, { once: true });
  else document.addEventListener("DOMContentLoaded", avvio, { once: true });   // access-lock ripete DOMContentLoaded dopo aver caricato l'app
})();
