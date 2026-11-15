(() => {
  "use strict";
  const ITERATIONS = 275000;
  const SALT = "1cde619737aa98e132b847b1c931ff36";
  const EXPECTED = "e99d014b66d72d03f45ce50be1e0fcdf8a50a96bddf32b70369998a1f9c52142";
  const hexBytes = hex => Uint8Array.from(hex.match(/.{2}/g), x => parseInt(x, 16));
  let attempts = 0;
  let opening = false;

  async function verify(password) {
    if (!window.crypto || !crypto.subtle) throw new Error("Browser non compatibile con la verifica sicura della password.");
    const imported = await crypto.subtle.importKey("raw", new TextEncoder().encode(password.trim()), "PBKDF2", false, ["deriveBits"]);
    const raw = new Uint8Array(await crypto.subtle.deriveBits({
      name: "PBKDF2", salt: hexBytes(SALT), iterations: ITERATIONS, hash: "SHA-256"
    }, imported, 256));
    const goal = hexBytes(EXPECTED);
    let mismatch = 0;
    for (let i = 0; i < 32; i++) mismatch |= raw[i] ^ goal[i];
    return mismatch === 0;
  }

  async function loadApp() {
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
    const form = document.getElementById("centurion-password-form");
    const password = document.getElementById("centurion-password");
    const button = document.getElementById("centurion-unlock");
    const note = document.getElementById("centurion-gate-message");
    if (!form || !password) return;

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (opening || !password.value) return;
      button.disabled = true;
      note.textContent = "Verifica in corso…";
      try {
        if (!await verify(password.value)) {
          attempts++;
          note.textContent = "Password non corretta.";
          password.value = "";
          password.focus();
          await new Promise(resolve => setTimeout(resolve, Math.min(4000, attempts * 650)));
          return;
        }
        opening = true;
        note.textContent = "Apertura del simulatore…";
        password.value = "";
        await loadApp();
      } catch (err) {
        opening = false;
        console.error("CENTURION2 startup:", err);
        note.textContent = "Impossibile aprire: " + (err.message || String(err));
      } finally {
        if (!opening) button.disabled = false;
      }
    });

    const visibility = document.getElementById("centurion-show-password");
    visibility?.addEventListener("change", () => { password.type = visibility.checked ? "text" : "password"; });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup, { once: true });
  else setup();
})();
