# CENTURION2 — mobile browser app

App web per Android e iPhone, ad uso **privato e non commerciale**, pubblicata su Cloudflare Pages dietro Cloudflare Access (login richiesto).

## Pubblicazione da smartphone

1. Scarica `CENTURION2_GITHUB_MOBILE.zip` da ChatGPT.
2. Nel repository GitHub, scegli **Add file → Upload files** e carica **il file ZIP**, mantenendo esattamente il nome `CENTURION2_GITHUB_MOBILE.zip`. Non serve estrarlo.
3. Premi **Commit changes** sul branch `main`.
4. Il workflow **Publish CENTURION2 mobile** (scheda **Actions**) pubblica il sito privato su Cloudflare: vedi «Accesso privato» più sotto.

**Attenzione:** non caricare nel repository segreti, credenziali o dati personali. Le funzioni che richiedono endpoint server `/api/` non sono disponibili su hosting statico.


## Stato dei modelli realistici (16 novembre 2026)

La pubblicazione attuale **non contiene** i quattro asset Blender originali: il workflow rileva gli archivi nella cartella `model-sources/`, ma senza quegli ZIP genera solo manifest con stato `source-missing`. L'hangar mostra l'anteprima Sketchfab quando il GLB locale manca.

Per completare l'integrazione:
1. Aggiungere al repository (con Git LFS o Git CLI: gli ZIP possono superare il limite per l'upload via browser) i quattro archivi, mantenendone i nomi: `eurofighter-typhoon-fighter-jet-free.zip`, `f-15e-strike-eagle-fighter-jet-free.zip`, `sukhoi-su-57-felon-p-fighter-jet-free.zip`, `missile-bomb-collection-fighter-jets-free.zip`, dentro `model-sources/`.
2. Avviare `Publish CENTURION2 mobile` in Actions: Blender convertirà i sorgenti originali in GLB e compilerà sia `models/manifest.json` per l'hangar sia `modelli/manifest.json` per le missioni (F2000, F15, SU57).
3. Verificare che i tre jet si carichino nelle missioni su mobile e desktop, compresa la posizione/orientamento della geometria. Il successo del deploy da solo non sostituisce questo test.

I modelli indicati nei manifest hanno attribuzione bohmerang / Sketchfab e licenza CC BY-NC-SA 4.0: rispettare gli obblighi di attribuzione, non commerciale e condividi-allo-stesso-modo, verificando i termini di ciascun asset.

## Sito cifrato e chiuso

Il workflow può pubblicare il sito, su GitHub Pages o su Cloudflare, in tre modi:

| Impostazione (Settings → Secrets and variables → Actions) | Sito pubblicato |
|---|---|
| nessuna | in chiaro, aperto a chiunque abbia l'indirizzo |
| segreto `SITE_PASSWORD` | cifrato: si apre solo con la password |
| variabile `SITE_CHIUSO` = `1` (scheda *Variables*) | chiuso: solo la pagina «Accesso chiuso» |

Con la password il workflow cifra tutto il sito prima di pubblicarlo:

- Ogni file esce cifrato con AES-256-GCM; anche il nome è sostituito da un codice.
- La chiave si ricava dalla password con PBKDF2-SHA256 (600.000 iterazioni).
- In chiaro restano solo la pagina di sblocco, il service worker che decifra nel browser (`sw.js`) e i parametri della chiave (`x/meta.json`).
- I file sono in `.github/security/` (`cifra_sito.mjs`, `sw_cifrato.js`, `sblocco.html`, `chiuso.html`, `sw_chiuso.js`).

**Password.** Settings → Secrets and variables → Actions → *New repository secret*.
1. Nome `SITE_PASSWORD`, almeno 10 caratteri; meglio una frase lunga. Non scriverla in file, issue o chat.
2. Avvia **Actions → Publish CENTURION2 mobile → Run workflow**.

**Chiudere il sito.** Crea la variabile `SITE_CHIUSO` con valore `1` e rilancia il workflow: si pubblica solo la pagina «Accesso chiuso», e i dispositivi che avevano già l'app cancellano cache e chiavi. Per riaprirlo cancella la variabile e rilancia il workflow.

**Uso.** Su ogni dispositivo la password si inserisce una volta: la chiave resta nel browser finché la password non cambia. Per richiudere il sito su un dispositivo, apri l'indirizzo del sito con `?blocca` in fondo.

**Cambiare password.** Aggiorna il segreto e rilancia il workflow: tutti i dispositivi tornano alla pagina di sblocco.

**Limiti:**
- Chi conosce la password vede tutto.
- La cifratura protegge il sito pubblicato, **non il repository**. Finché il repository è pubblico, codice, ZIP e modelli si scaricano da GitHub.
- Per chiudere il repository: Settings → General → Danger Zone → *Change visibility* → Private.
  - Con il piano gratuito GitHub Pages si spegne quando il repository diventa privato.
  - Con GitHub Pro resta acceso e il sito resta cifrato.

## Accesso privato (Cloudflare Pages + Cloudflare Access)

Il workflow `Publish CENTURION2 mobile` pubblica il sito su Cloudflare Pages (progetto `centurion2`) quando trova i segreti `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`; **finché mancano, pubblica su GitHub Pages**, che è raggiungibile da chiunque: il sito è cifrato solo se è impostato il segreto `SITE_PASSWORD` (vedi sopra). Configurazione una tantum:

1. **Repository privato**: Settings → General → Danger Zone → *Change visibility* → Private.
2. **Spegnere GitHub Pages**: Settings → Pages → *Unpublish site*; in *Source* scegliere *None*/disattivare.
3. **Account Cloudflare** (piano gratuito). Copiare l'*Account ID* (Dashboard → Workers & Pages, colonna destra).
4. **Token API**: My Profile → API Tokens → Create Token → modello *Edit Cloudflare Workers*, oppure token personalizzato con permesso *Account → Cloudflare Pages → Edit*.
5. **Segreti GitHub**: Settings → Secrets and variables → Actions → *New repository secret*: `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
6. Avviare il workflow da **Actions → Publish CENTURION2 mobile → Run workflow**. Il sito sarà su `https://centurion2.pages.dev`.
7. **Proteggere il sito**: Cloudflare Zero Trust → Access → Applications → *Add an application* → *Self-hosted*. Domini: `centurion2.pages.dev` **e** `*.centurion2.pages.dev` (le anteprime). Policy: *Allow*, regola *Emails* con gli indirizzi autorizzati; metodo di login *One-time PIN* (codice via email).
8. **Verifica**: aprire `https://centurion2.pages.dev` da una finestra anonima: deve comparire la schermata di login Cloudflare, non il simulatore. Provare anche l'URL diretto di un file, ad esempio `https://centurion2.pages.dev/js/app.js`.

Cloudflare Pages accetta file fino a 25 MiB: il workflow comprime in WebP (max 2048 px) le texture dei GLB più grandi e si ferma con errore se un file resta oltre il limite.

**Nota:** finché il repository era pubblico, codice, ZIP e modelli potevano essere scaricati; renderlo privato non revoca copie già fatte. Il vecchio lucchetto JavaScript (`.github/security/`) non è collegato al deploy e non serve più: l'accesso è controllato da Cloudflare Access lato server.
