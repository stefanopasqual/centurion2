# CENTURION2 — mobile browser app

App web per Android e iPhone, pubblicabile tramite GitHub Pages.

## Pubblicazione da smartphone

1. Scarica `CENTURION2_GITHUB_MOBILE.zip` da ChatGPT.
2. Nel repository GitHub, scegli **Add file → Upload files** e carica **il file ZIP**, mantenendo esattamente il nome `CENTURION2_GITHUB_MOBILE.zip`. Non serve estrarlo.
3. Premi **Commit changes** sul branch `main`.
4. In **Settings → Pages → Build and deployment**, seleziona **Source: GitHub Actions**.
5. Apri la scheda **Actions** e controlla il workflow **Publish CENTURION2 mobile**. Al termine, il sito è su https://stefanopasqual.github.io/centurion2/.

Il workflow estrae automaticamente i file contenuti nello ZIP e pubblica soltanto la cartella `site/`. La pagina mobile comprende HTML, CSS, JS, immagini, audio e risorse PWA.

**Attenzione:** il progetto viene pubblicato su un sito pubblico. Non caricare segreti, credenziali o dati personali. Le funzioni che richiedono endpoint server `/api/` non sono disponibili su GitHub Pages.
