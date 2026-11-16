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


## Stato dei modelli realistici (16 novembre 2026)

La pubblicazione GitHub Pages attuale **non contiene** i quattro asset Blender originali: il workflow rileva gli archivi nella cartella `model-sources/`, ma senza quegli ZIP genera solo manifest con stato `source-missing`. L'hangar mostra l'anteprima Sketchfab quando il GLB locale manca.

Per completare l'integrazione:
1. Aggiungere al repository (con Git LFS o Git CLI: gli ZIP possono superare il limite per l'upload via browser) i quattro archivi, mantenendone i nomi: `eurofighter-typhoon-fighter-jet-free.zip`, `f-15e-strike-eagle-fighter-jet-free.zip`, `sukhoi-su-57-felon-p-fighter-jet-free.zip`, `missile-bomb-collection-fighter-jets-free.zip`, dentro `model-sources/`.
2. Avviare `Publish CENTURION2 mobile` in Actions: Blender convertirà i sorgenti originali in GLB e compilerà sia `models/manifest.json` per l'hangar sia `modelli/manifest.json` per le missioni (F2000, F15, SU57).
3. Verificare che i tre jet si carichino nelle missioni su mobile e desktop, compresa la posizione/orientamento della geometria. Il successo del deploy da solo non sostituisce questo test.

I modelli indicati nei manifest hanno attribuzione bohmerang / Sketchfab e licenza CC BY-NC-SA 4.0: rispettare gli obblighi di attribuzione, non commerciale e condividi-allo-stesso-modo, verificando i termini di ciascun asset.

**Sicurezza:** la password attuale è soltanto un gate JavaScript dell'interfaccia: il repository e gli asset di GitHub Pages sono pubblici e possono essere richiesti direttamente. Per accesso realmente privato serve autenticazione lato server (o hosting con access control).
