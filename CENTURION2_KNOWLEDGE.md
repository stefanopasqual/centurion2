# CENTURION2 — Knowledge completa del progetto

> Compendio tecnico, funzionale e creativo per sviluppo, manutenzione e passaggio di contesto.
> Comprende il simulatore CENTURION2 e il progetto formativo/video A Pilot Day.

**Versione del documento:** 1.0  
**Data di consolidamento:** 23 novembre 2026, fuso Europe/Rome  
**Repository:** [stefanopasqual/centurion2](https://github.com/stefanopasqual/centurion2)  
**Snapshot tecnico esaminato:** [`705e74c94f3611451b886f9ae7229ecb70d1b1b2`](https://github.com/stefanopasqual/centurion2/commit/705e74c94f3611451b886f9ae7229ecb70d1b1b2), branch `main`.  
**Sito risultante dall'ultimo deploy verificato:** [Apri CENTURION2](https://stefanopasqual.github.io/centurion2/).

## Indice

- [Come usare questa knowledge](#come-usare-questa-knowledge)
- [Stato consolidato](#stato-consolidato)
- [Identità, obiettivi e decisioni progettuali](#identità-obiettivi-e-decisioni-progettuali)
- [Architettura e sorgenti](#architettura-e-sorgenti)
- [Assemblaggio e pubblicazione](#assemblaggio-e-pubblicazione)
- [Modalità e flusso di lavoro](#modalità-e-flusso-di-lavoro)
- [Missioni e Accademia](#missioni-e-accademia)
- [Mappe e terreno](#mappe-e-terreno)
- [Salvataggi e condivisione](#salvataggi-e-condivisione)
- [Rete e server locale](#rete-e-server-locale)
- [Browser mobile e cache](#browser-mobile-e-cache)
- [Accesso e configurazione](#accesso-e-configurazione)
- [Verifiche tecniche disponibili](#verifiche-tecniche-disponibili)
- [Modelli 3D e registri](#modelli-3d-e-registri)
- [Livree e correzioni visive](#livree-e-correzioni-visive)
- [Pilota e operatori](#pilota-e-operatori)
- [Fisica e sistemi audiovisivi](#fisica-e-sistemi-audiovisivi)
- [Provenienza degli asset](#provenienza-degli-asset)
- [A Pilot Day: workshop, teaser e trailer](#a-pilot-day-workshop-teaser-e-trailer)
- [Verifiche osservate e loro portata](#verifiche-osservate-e-loro-portata)
- [Questioni aperte e criteri di chiusura](#questioni-aperte-e-criteri-di-chiusura)
- [Procedura per riprendere lo sviluppo](#procedura-per-riprendere-lo-sviluppo)
- [Cronologia essenziale](#cronologia-essenziale)
- [Fonti e aggiornamento del documento](#fonti-e-aggiornamento-del-documento)

## Come usare questa knowledge

Questo documento consolida le informazioni del repository, le decisioni progettuali disponibili nelle conversazioni del 14–23 novembre 2026 e i materiali video identificati e letti durante la ricognizione. È il punto di ingresso per riprendere il progetto senza ricostruirne ogni volta la storia.

Le informazioni hanno livelli di evidenza diversi:

| Indicazione | Significato |
|---|---|
| **Codice verificato** | Funzione, configurazione o collegamento presente nei sorgenti consultati. La presenza nel codice non prova da sola la resa sul dispositivo. |
| **CI verificata** | Stato di uno specifico run GitHub Actions effettivamente letto. Vale per quel commit e per i controlli eseguiti dal workflow. |
| **Storico conversazionale** | Richiesta, osservazione o risultato riferito nelle conversazioni disponibili. |
| **Requisito** | Comportamento desiderato dall'utente; non implica che sia già implementato. |
| **Da verificare** | Manca una fonte, una prova runtime o un confronto sufficiente a chiudere il punto. |

I collegamenti alle sorgenti sono fissati allo snapshot tecnico indicato. Per lavorare su una versione successiva, confrontare il nuovo commit con quello di riferimento e aggiornare le sezioni interessate.

**Limiti della ricognizione:** sono stati letti tree, sorgenti testuali, workflow, metadati di esecuzioni e documenti di progetto; non sono stati rieseguiti la build completa, i test o una sessione browser. I grandi GLB e lo ZIP base del repository non sono stati analizzati internamente in questa stesura. Il contenuto di `_integration_inspect/` è uno snapshot e viene distinto dall'output generato dal deploy. Il recupero aggiuntivo della cronologia delle chat non era disponibile: la parte storica deriva dal contesto già disponibile, non dall'esportazione integrale di tutte le conversazioni. I file Drive menzionati ma non identificati restano riferimenti da recuperare.

## Stato consolidato

| Area | Stato documentato al consolidamento | Implicazione pratica |
|---|---|---|
| Repository | `main`, visibilità **public** nei metadati GitHub letti. | La richiesta storica di privatizzazione non risulta completata nello snapshot. |
| Sito | Ultimo deploy letto: commit `bb902c6fd72dfe95e1212ae9f810c185d743da45`, riuscito il 23/11. | Il successivo commit `705e74c...` modifica soltanto README. |
| Hosting effettivo | Nel run verificato: Cloudflare saltato, upload e deploy **GitHub Pages riusciti**. | L'URL è tratto dai log di deploy, non dedotto dal nome del repository. |
| Build | ZIP base più patch ordinate sotto `.github/`. | Per modificare il prodotto occorre intervenire su una sorgente realmente usata dalla build. |
| Interfaccia | TRAINER, BLUE, RED, VOLO LIBERO e COMANDANTE; hangar e strumenti collegati. | Percorsi tattici e pilotaggio diretto hanno funzioni diverse. |
| Formazione | Accademia: **5 moduli e 15 lezioni** nel sorgente; Commander per scenari personalizzati. | Il syllabus del workshop commerciale va definito separatamente. |
| Geografia | **8 regioni da 100 × 100 km**, cioè 10.000 km² di area configurata per regione. | Il nome storico `maps5` non rappresenta il conteggio attuale. |
| Modelli | Catalogo hangar, manifest simulazione e import locali distinti. | Un modello visibile nell'hangar non è automaticamente disponibile in ogni missione. |
| Correzioni recenti | Codice per cimieri A-10, ala F-22 e nuovo pilota presente; esistono run di deploy/QA riusciti. | Le segnalazioni visive dell'utente restano da confrontare con screenshot aggiornati del percorso interessato. |
| Video | Materiali 100s, 98s e 220s classificati come prototipi/previsualizzazioni nelle fonti lette. | Le nuove richieste di riprese reali e gameplay non risultano soddisfatte dal solo pacchetto modificabile. |

Fonti di stato: [snapshot del repository](https://github.com/stefanopasqual/centurion2/tree/705e74c94f3611451b886f9ae7229ecb70d1b1b2), [ultimo deploy verificato](https://github.com/stefanopasqual/centurion2/actions/runs/45267278703), [job di pubblicazione Pages](https://github.com/stefanopasqual/centurion2/actions/runs/45267278703/job/138023754061). La visibilità è un metadato letto il 23/11/2026 e può cambiare successivamente.

## Identità, obiettivi e decisioni progettuali

**CENTURION2** è il nome del repository e del simulatore web. Le denominazioni CENTURION e Centurione sopravvivono nell'interfaccia, nei file storici e nelle conversazioni. **A Pilot Day** è il nome usato nella richiesta più recente per teaser/trailer; i materiali precedenti contengono anche “A Fighter Pilot Day”, “Fighter Pilot Day” e “Have a Fighter Day”. La denominazione pubblica definitiva va consolidata prima del montaggio finale.

Il progetto combina tre esperienze:

1. **Simulazione tattica a squadre:** briefing, pianificazione, esecuzione e debrief, con BLUE, RED e regia TRAINER.
2. **Pilotaggio e addestramento:** volo libero, controlli desktop/mobile, Accademia, elicotteri e scenari dedicati.
3. **Workshop:** decisioni di gruppo e conseguenze osservabili nella simulazione, da collegare a priorità, risorse, coordinamento e apprendimento nel business.

La richiesta di realismo riguarda contemporaneamente modelli, materiali, proporzioni, presentazione, movimento e comportamento in missione. Non si considera conclusa una sostituzione sulla sola base del caricamento del file: l'asset deve essere mappato, pubblicato e visibile nel percorso richiesto.

### Decisioni da preservare

| Tema | Decisione o requisito consolidato | Precisazione |
|---|---|---|
| Materiali dei velivoli | Conservare vernice, texture e dettagli originali; applicare le modifiche CENTURION alle derive previste. | Le regressioni che uniformavano la vernice dell'intero aereo sono state contestate il 23/11. |
| Cimieri | Centrati nella superficie nera delle pinne di coda, verificando ciascuna deriva. | L'A-10 ha richiesto un trattamento specifico delle due derive esterne. |
| Presentazione in volo | Carrelli retratti/rimossi dove appropriato al velivolo. | Gli elicotteri con carrello fisso non seguono automaticamente la stessa regola. |
| Asset condivisi | I modelli approvati devono arrivare nel software pubblicato e nei percorsi di simulazione previsti. | L'import nel browser è solo una personalizzazione locale finché non viene consolidato nella pipeline. |
| Pilota | Utilizzare il nuovo asset fornito dall'utente nell'hangar e nelle scene collegate. | Disponibilità di texture, rig e spazio in cabina limita il risultato effettivo. |
| Navigazione | Il comando/logo CENTURION deve ricondurre alla home dai contesti previsti. | I diversi launcher e iframe richiedono verifica sul percorso concreto. |
| Smartphone | Utilizzo dal browser anche su iPhone, con controlli e caricamenti gestibili. | Non è richiesta un'app nativa; la distribuzione corrente è web/PWA. |
| Missioni | Comandante per personalizzare e salvare; impostazioni trainer per graduare difficoltà e difese. | Salvataggio locale e condivisione del file sono operazioni diverse. |
| Mappe | Aree ampie con rilievo riconoscibile; richiesta evoluta da 500 a 10.000 km². | La configurazione attuale delle otto regioni è coerente con la dimensione più recente. |
| Eurofighter | Stato più recente: grigio e senza insegne del 51° Stormo. | Il requisito storico della livrea Istrana/51° Stormo è superato dal [commit del 23/11](https://github.com/stefanopasqual/centurion2/commit/0fd58b819f456346e7f376c36fed49d8a2dc3f77). |
| Video | Riprese reali, simulazione, strategia e gameplay per presentare il workshop. | Le previsualizzazioni recuperate sono materiale preparatorio. |

Le decisioni della tabella derivano dalle conversazioni disponibili; lo stato tecnico è approfondito nei capitoli seguenti. Parametri aerodinamici, probabilità d'ingaggio e geometrie di scena descrivono la simulazione implementata, non prestazioni certificate di velivoli o procedure operative reali.

## Architettura e sorgenti

Centurion2 viene distribuito come sito web statico, assemblato da un pacchetto di base e da una serie di estensioni. La ricetta di costruzione è il workflow `deploy-pages.yml`: estrae `CENTURION2_GITHUB_MOBILE.zip`, modifica i file risultanti e pubblica la directory `extracted/site/`. Il repository non presenta un normale progetto frontend da avviare con `npm start`.

È essenziale distinguere tre livelli:

| Livello | Contenuto | Uso corretto |
|---|---|---|
| Pacchetto base | `CENTURION2_GITHUB_MOBILE.zip`, con `site/index.html`, manifest e JavaScript | Origine del sito prima delle modifiche |
| Estensioni attuali | JavaScript, CSS e script Python in `.github/<funzione>/` | Codice applicato dalla build quando richiamato dal workflow |
| Snapshot di ispezione | `_integration_inspect/` | Riferimento leggibile della base; non viene copiato automaticamente nel sito |

Una correzione fatta soltanto nello snapshot non modifica il prodotto pubblicato. Per intervenire sul runtime occorre aggiornare il pacchetto base oppure una patch effettivamente eseguita. Molte patch cercano stringhe precise e verificano le proprie ancore: l’ordine di applicazione e la compatibilità con la versione del pacchetto hanno quindi valore tecnico.

La base visibile usa JavaScript browser con oggetti globali. Leaflet gestisce la mappa, SheetJS gli scambi Excel e Three.js la grafica 3D. L’hangar ha un proprio viewer con script ES module. Nel codice di base ispezionato, la separazione principale è questa:

| Modulo / simbolo | Responsabilità |
|---|---|
| `app.js` / `APP` | Stato, ruolo, fase, navigazione e ciclo della simulazione |
| `engine.js` / `Engine` | Formazioni, risorse, eventi, obiettivi e risultati della simulazione tattica |
| `scenario_default.js` | Scenario iniziale, tipi, regole, briefing e piani |
| `geo.js`, `physics.js` | Geografia e cinematica del motore tattico |
| `map.js`, `ui.js` | Mappa, pianificazione, editor, esecuzione e debrief |
| `dataio.js`, `rete.js` | Formati, salvataggi e comunicazione con server locale |
| `missioni.js`, `demo.js` | Catalogo e dimostrazioni guidate |
| `volo.js` | Pilotaggio diretto |
| `modelli3d.js`, `vista3d.js`, `mondo3d.js` | Modelli, cinematiche e mondo tridimensionale |
| `highlights.js`, `audio.js`, `meteo.js` | Riepiloghi, audio e meteo |

La simulazione tattica a formazioni e il volo pilotato condividono scenari e asset, ma mantengono cicli e modelli fisici distinti. Una verifica nell’hangar non basta a dimostrare il funzionamento in entrambi.

Fonti: [workflow di costruzione](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/workflows/deploy-pages.yml), [entrypoint nello snapshot](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/_integration_inspect/index.html), [APP nello snapshot](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/_integration_inspect/app.js), [Engine nello snapshot](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/_integration_inspect/engine.js).

## Assemblaggio e pubblicazione

La sequenza di costruzione va considerata parte della conoscenza del progetto. Il workflow esegue questi blocchi, nell’ordine indicato:

| Blocco | Operazioni |
|---|---|
| Preparazione | Checkout, estrazione ZIP, controllo di index, manifest e app |
| Modelli | Conversione dei sorgenti, produzione dei manifest hangar e missioni |
| Viste e pilotaggio | Cockpit, VFX, render, free flight, AAR e controlli SAM |
| Scenari | Mappe, Cadet, Donbass, droni, Geran, terreno mobile e Veneto |
| Simulazione e ambiente | Termocamera, effetti sonici, aerodinamica, audio cannone e vita a terra |
| Interfaccia e formazione | Home, Commander, Accademia, pod/armi e RED umano |
| Asset dedicati | Viewer, livree, Airbus, UH-60, postbruciatore, soccorso e pilota |
| Ottimizzazione | Texture GLB, controlli dimensione, aggiornamento cache |
| Consegna | Gate o cifratura, scelta hosting, caricamento e pubblicazione |

Gli output destinati al browser comprendono `models/` per l’hangar e `modelli/` per i modelli referenziati nelle missioni. Sono prodotti della build: devono restare coerenti con i rispettivi manifest.

Quando sono presenti archivi sorgente, il workflow installa Blender con numpy e PIL. Usa Python 3 per le trasformazioni, Node per i controlli JavaScript e glTF Transform CLI v4 per le texture. I GLB oltre 2 MiB vengono ridimensionati a un massimo di 2048 pixel e convertiti a WebP; il pilota ha un’esenzione esplicita. Un controllo blocca file ancora oltre 24 MiB, mantenendo margine rispetto al limite hosting richiamato dal workflow.

La pubblicazione parte con `push` su `main` soltanto per i percorsi elencati nel filtro, oppure tramite `workflow_dispatch`. Due esecuzioni concorrenti appartengono al gruppo `centurion2-pages`; una nuova può annullare quella precedente. README e documenti in root non rientrano nel filtro e non avviano da soli un deploy.

Il workflow sceglie Cloudflare Pages se trova entrambe le configurazioni richieste; altrimenti usa GitHub Pages. Lo stato della destinazione effettivamente utilizzata va ricavato dall’esecuzione, non dal solo ramo previsto nel codice.

Una particolarità da conservare nelle manutenzioni: la build esegue la patch `red_umano`, ma il relativo percorso non compare nel filtro dei push. Una modifica limitata a quella directory richiede dispatch o adeguamento del filtro.

Fonti: [deploy-pages.yml](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/workflows/deploy-pages.yml), [costruzione modelli](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/build_models.py), [patch del volo libero](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/freeflight/patch_freeflight.py).

## Modalità e flusso di lavoro

La home viene organizzata dalla patch dedicata intorno a TRAINER, BLUE, RED e VOLO LIBERO. Il modulo Commander aggiunge una quinta voce. Il commento storico “four-entry” non descrive quindi da solo l’interfaccia assemblata.

Il Trainer dispone del pannello con missioni, demo, istruzioni, hangar, installazione e configurazione delle postazioni. BLUE e RED rappresentano le squadre. Volo libero apre il pilotaggio diretto. Commander crea o modifica scenari.

Nello snapshot APP, il percorso di una sessione è:

1. **Briefing:** situazione, obiettivi, vincoli e informazioni del ruolo.
2. **Piano:** assegnazione delle formazioni, sequenza, risorse e orari.
3. **Esecuzione:** avanzamento della simulazione, eventi e ordini.
4. **Debrief:** risultati, spiegazione delle scelte e apprendimento.

Il motore tattico usa tick discreti, con intervallo configurabile e valore predefinito di dieci secondi simulati nello snapshot. La velocità della sessione è separata dal tick. Il generatore con seed fisso consente confronti ripetibili a parità di scenario e piano; le regole prevedono anche un’opzione di arrotondamento probabilistico.

Le modifiche al piano prima dell’avvio vengono riallineate al motore. Una modifica a partita già iniziata richiede di ricominciare per essere applicata come nuovo piano iniziale. Le cinematiche possono interrompere temporaneamente una sessione singola; in modalità multipostazione il codice evita di fermare la partita degli altri.

Commander offre una mappa Leaflet per posizionare basi, target, SAM, CAP, gate, AAR e orbite, creare formazioni e definire piani. Può partire dallo scenario corrente, da una missione del catalogo o da un’importazione. Prima di avviare controlla che esista almeno una formazione BLUE con bersaglio e trasferisce lo scenario ad APP, aprendo il briefing come Trainer.

La modalità **RED umano** abilita il controllo della squadra rossa dalla stessa postazione: il Trainer può attivarla nel briefing, disabilitando le decisioni automatiche RED su decolli, CAP e scramble. La difesa dei caccia già in combattimento resta automatica secondo la patch. Questa modalità hot-seat è distinta dalla rete multipostazione. [Interruttore RED umano](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/red_umano/red_umano.js).

Il Trainer può inoltre disattivare o riattivare ogni batteria SA-10 separatamente. Lo scenario conserva le esclusioni in `sam_disattivati`; l'inject “No SAM” spegne invece tutte le batterie. Non risulta una batteria unica obbligatoriamente disabilitata per tutte le sessioni. [Controlli SAM](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/patch_sam_controls.py).

Nello snapshot dell'app, `HIGHLIGHTS.calcola(engine, scenario)` costruisce il riepilogo BLUE/RED con eventi e riconoscimenti; al termine della sessione APP propone highlights o debrief. Gli sfondi video sono selezionati tramite `assets/reali/clip.json`, con fallback vuoto quando il file manca o non è accessibile. Questo è un collegamento già presente nell'app, distinto dall'effettiva disponibilità delle clip e dalla produzione dei nuovi trailer. [Highlights nello snapshot](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/_integration_inspect/highlights.js).

Il ritorno alla home dipende dalla base e dai moduli presenti: nello snapshot APP è gestito dal logo; lo script aggiuntivo evita duplicazioni quando trova il relativo flag. L’hangar viene aperto in un iframe dedicato e può essere chiuso anche con Escape.

Fonti: [home hub](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/home/home_hub.js), [Commander](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/commander/commander.js), [APP](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/_integration_inspect/app.js), [Engine](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/_integration_inspect/engine.js).

## Missioni e Accademia

Il catalogo di base visibile nello snapshot contiene dodici missioni, M00–M11. Il commento iniziale che ne cita dieci è rimasto indietro rispetto all’array e all’interfaccia.

| ID | Codice | Tema |
|---|---|---|
| M00 | ROLLING THUNDER | Scenario generale e metodo completo |
| M01 | IRON GATE | Apertura di un corridoio nelle difese |
| M02 | BROKEN ARROW | Obiettivi con scadenza |
| M03 | SEA HAWK | Scenario navale |
| M04 | SHADOW HUNT | Finestre temporali e obiettivi mobili |
| M05 | NIGHT OWL | Notte e meteo avverso |
| M06 | AIR SUPERIORITY | Controllo dello spazio aereo |
| M07 | SHIELD | Protezione del pacchetto |
| M08 | NORTHERN STAR | Risorsa condivisa e limitata |
| M09 | CONVOY | Obiettivo in movimento |
| M10 | FULL SPECTRUM | Priorità e operazioni in più ondate |
| M11 | NIGHT STALKER | Scenario notturno con visori |

Le patch attuali aggiungono M12 DONBASS UAV, M13 DRONE SHADOW, M14 CIVILIAN SHIELD e M15 GHOST SWARM. Il modulo Veneto aggiunge LAGUNA QRA, centrata su scramble, identificazione e scorta di un volo civile fittizio. Il suo ID è assegnato al primo posto libero fra M16 e M20, con fallback MV1: non va assunto un ID fisso.

Il legame con la formazione aziendale è già presente nei dati delle missioni. Ogni scenario può comprendere focus, briefing distinti, obiettivi, demo e domande di debrief. I temi ricorrenti sono metodo 5T, priorità, margine temporale, delega, coordinamento e gestione di risorse scarse. M08 domanda esplicitamente come si gestisce in azienda una risorsa condivisa.

Cadet offre C01, “Il corridoio”: decisioni su percorso, forze e protezione, con alternative di difesa e uso della riserva. `cadet_core.js` può simulare l’esito senza grafica attraverso lo stesso Engine, sostenendo il confronto fra scelte.

L’Accademia attuale contiene cinque moduli e quindici lezioni:

| Modulo | Lezioni |
|---|---|
| Rudimenti di volo | V1 assetto/potenza; V2 virate; V3 energia; V4 decollo; V5 atterraggio |
| Sistemi d’arma | A1 cannone; A2 infrarosso; A3 oltre raggio visivo; A4 aria-superficie |
| Attacco | T1 volo sotto il radar; T2 strategia “Il corridoio” |
| Difesa | D1 difesa missili; D2 difesa aerea; D3 polizia aerea |
| Personnel Recovery | S1 recupero del pilota isolato |

Sono esercizi e parametri dell’app. I progressi e la preferenza della voce sono salvati nel browser. La narrazione usa `speechSynthesis` con preferenza italiana, senza garantire una particolare voce su ogni dispositivo.

Fonti: [catalogo base nello snapshot](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/_integration_inspect/missioni.js), [missioni droni](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/mission_upgrade/patch_drone_missions.py), [Accademia](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/cadet/accademia.js), [Veneto](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/veneto/veneto.js).

## Mappe e terreno

Il modulo conserva il nome `maps5.js`, ma l’elenco attuale comprende otto regioni:

| Regione | Area di riferimento |
|---|---|
| Egitto | Giza |
| Dolomiti | Tre Cime |
| Vladivostok | Russkij |
| Himalaya | Everest |
| Sardegna | Costa Smeralda |
| Donbass | Donetsk |
| Taiwan | Taichung e Catena Centrale |
| Venezuela | Caracas ed El Ávila |

La configurazione indica 10.000 km² per regione, ossia un quadrato di cento chilometri per lato. La funzione di trasferimento riproietta le entità dello scenario nell’area selezionata e imposta centro, zoom e quota iniziale.

La geografia usa terreno DEM Terrarium e immagini satellitari Esri online. Basi, obiettivi, difese e altri elementi dell’esercitazione sono collocazioni simulate: non rappresentano automaticamente infrastrutture reali. I monumenti sono stilizzati e gli edifici non costituiscono una ricostruzione fotogrammetrica.

Le patch successive gestiscono qualità mobile, caricamento del terreno e maggiore dettaglio nel volo libero. Il workflow contiene controlli sull’integrazione del prefetch, della quota sul terreno e dei livelli di zoom. Questi controlli attestano la struttura prevista dal codice; disponibilità dei servizi, velocità della rete e memoria del dispositivo determinano l’esperienza concreta.

La dimensione dichiarata dello scenario non significa che tutta l’area sia già scaricata o disponibile offline.

Fonti: [regioni e trasformazione](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/maps/maps5.js), [terreno mobile](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/maps/terrain_mobile.js), [patch qualità](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/maps/patch_mobile_quality.py).

## Salvataggi e condivisione

Centurion2 usa più archivi, ciascuno con una funzione distinta. Nel codice esaminato:

| Contenuto | Archiviazione |
|---|---|
| Scenario corrente | localStorage `centurion_scenario_v1`, nello snapshot DATAIO |
| Missioni Commander | localStorage `centurion2_commander_library_v1` e IndexedDB |
| Database Commander | `centurion2_commander`, object store `missioni` |
| Bozza Commander | Record `BOZZA`, aggiornato periodicamente |
| Missioni pubblicate | JSON in `missioni-comandante/` con `indice.json` |
| Progressi Accademia | localStorage `centurion_accademia_v1` |
| Preferenza voce | localStorage `centurion_accademia_voce` |

Commander richiede, quando supportato, la persistenza dello storage e riconcilia i record tra localStorage e IndexedDB. La bozza viene aggiornata ogni quindici secondi durante l’editing. Questo migliora la conservazione sul dispositivo, ma non introduce sincronizzazione automatica fra computer e telefono.

Il salvataggio di una missione Commander contiene `id`, `nome`, `savedAt`, `scenario` e `schema: 1`. L’importazione accetta un wrapper con `scenario` oppure `sc` e controlla almeno la presenza di `meta`, `mappa` e `piani`.

La condivisione segue un percorso esplicito: esportazione JSON, caricamento nel repository in `.github/commander/missioni/`, nuova build e generazione dell’indice pubblico del sito. Il pulsante Condividi apre la cartella di caricamento GitHub. Un salvataggio locale, da solo, non pubblica la missione agli altri.

Lo snapshot DATAIO supporta anche Excel attraverso SheetJS, usando `Centurion_Config.xlsx`. I fogli coprono informazioni, regole, meteo, velivoli, kill ratio, formazioni, basi, target, obiettivi, AAR, orbite, gate, CAP, SAM, briefing, squadre, inject, agenda e piani BLUE/RED. L’importazione effettua un merge sullo scenario base e normalizza orari, booleani e liste.

Per trasferire il lavoro fra dispositivi è quindi necessario usare l’esportazione o il percorso di condivisione previsto, conservando il file risultante.

Fonti: [storage Commander](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/commander/core.js), [pubblicazione delle missioni](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/commander/patch_commander.py), [formati DATAIO nello snapshot](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/_integration_inspect/dataio.js).

## Rete e server locale

Il codice RETE dello snapshot distingue una postazione unica da una sessione con Trainer, BLUE e RED su dispositivi diversi.

Nella postazione unica, il cambio di ruolo conserva la partita e può mostrare una schermata di passaggio. Nella sessione multipostazione, il browser del Trainer esegue il motore; un server locale scambia scenario, stato, piani e ordini con le squadre. I client seguono il tempo stabilito dal Trainer e ricevono la vista prevista per il loro ruolo.

Il trasporto implementato nel file letto è HTTP con polling, attraverso `api/sess/*`. Comprende creazione e informazioni sessione, scenario, stato, piani e comandi. L’host pubblica normalmente ogni 700 millisecondi e riceve ogni secondo; il client sincronizza ogni 650 millisecondi. Sono presenti controlli per evitare richieste sovrapposte ed eventi duplicati.

DATAIO prevede separatamente endpoint quali `/api/ping`, `/api/salva` e `/api/salvataggi`, oltre al caricamento della configurazione Excel. Queste funzioni sono opzionali rispetto all’uso con salvataggi browser e download.

Il solo hosting statico configurato dal workflow non fornisce tali API. I messaggi del codice nominano un server Python e launcher locali, ma questi eseguibili non risultano nel tree esaminato. Non è quindi documentabile qui un comando completo di avvio backend. La modalità multipostazione deve essere verificata nell’ambiente che dispone effettivamente del server.

Fonti: [RETE nello snapshot](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/_integration_inspect/rete.js), [DATAIO nello snapshot](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/_integration_inspect/dataio.js), [hosting configurato](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/workflows/deploy-pages.yml).

## Browser mobile e cache

Lo snapshot APP registra `sw.js` su HTTPS oppure su localhost. Il manifest è un requisito della build. Quando il browser offre `beforeinstallprompt`, l’app usa quella procedura; negli altri casi mostra le istruzioni per aggiungerla alla schermata Home, comprese quelle per Safari su iPhone/iPad e Chrome su Android.

I pannelli laterali si richiudono sugli schermi piccoli. Nel pilotaggio, l’Accademia descrive cloche a sinistra, manetta a destra e pulsanti FUOCO, LOCK, ARMA e FLARE. Sul desktop i comandi comprendono frecce/WASD, manetta Shift/R e Ctrl/F, Q/E, G, B, X, T, Space, C e V. Le azioni dipendono dal contesto: nella vista tattica Space controlla play/pausa.

La cache è rilevante per gli aggiornamenti dei modelli. Il workflow mantiene i manifest in modalità network-first e applica un’impronta del contenuto alla versione del service worker dopo l’ottimizzazione dei file. Questo permette di invalidare asset che altrimenti resterebbero nella cache precedente.

Le vecchie sostituzioni di stringhe di versione sono conservate nella ricetta, ma il passo basato sull’impronta è quello che tiene conto dei contenuti correnti. Un modello presente nel deploy può quindi richiedere il completamento dell’aggiornamento del service worker prima di comparire su un dispositivo già utilizzato.

La PWA non garantisce ogni contenuto offline: mappe, terreno e risorse esterne non ancora disponibili possono richiedere rete. Anche un GLB di dimensioni accettabili può avere un costo grafico significativo; per questo la build riduce le texture.

Fonti: [installazione e interfaccia nello snapshot](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/_integration_inspect/app.js), [controlli dell’Accademia](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/cadet/accademia.js), [cache e ottimizzazione](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/workflows/deploy-pages.yml).

## Accesso e configurazione

Il file `stato_sito.txt` documenta l’interruttore della pubblicazione e, nello snapshot, riporta lo stato **aperto**. È una configurazione del progetto; lo stato effettivamente servito ai visitatori dipende dall’ultima build pubblicata.

| Configurazione | Funzione prevista |
|---|---|
| `stato_sito.txt` | Richiesta di apertura o chiusura del sito |
| `SITE_CHIUSO` | Variabile repository che può richiedere la pagina di chiusura |
| `SITE_PASSWORD` | Segreto usato dalla procedura di cifratura |
| `CLOUDFLARE_API_TOKEN` | Configurazione della pubblicazione Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | Account di destinazione Cloudflare |

Il workflow prevede un gate browser quando non è configurata la cifratura e richiama comunque `cifra_sito.mjs`, che gestisce le condizioni di pubblicazione. La cifratura prevista usa AES-256-GCM con derivazione della chiave mediante PBKDF2. La modalità di chiusura pubblica una pagina dedicata; il codice contempla anche la rimozione di cache e chiavi dai client che ricevono l’aggiornamento.

La chiusura ha precedenza sulla pubblicazione dei contenuti. Con `SITE_PASSWORD` configurato, la procedura richiede almeno dieci caratteri e deriva la chiave con 600.000 iterazioni PBKDF2-SHA256; cifra i file e oscura i nomi con HMAC. Senza quel segreto, lo script di cifratura lascia i file in chiaro: il gate browser aggiunto dal workflow è un meccanismo distinto e non cifra gli asset. Il solo stato “aperto” non permette di dedurre quale configurazione segreta sia attiva.

La presenza di questi meccanismi non modifica la visibilità del repository GitHub. Il controllo di accesso alla pubblicazione e l’accesso ai sorgenti sono configurazioni separate.

Il nome del passaggio Cloudflare richiama Access, ma non dimostra da solo che esista una policy attiva. Per descrivere la protezione effettiva occorre verificarne la configurazione e il comportamento, mantenendo sempre i valori delle credenziali fuori dalla documentazione.

Fonti: [interruttore del sito](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/security/stato_sito.txt), [workflow](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/workflows/deploy-pages.yml), [procedura di cifratura](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/security/cifra_sito.mjs).

## Verifiche tecniche disponibili

Il workflow contiene controlli sintattici JavaScript, compilazione Python, verifiche dei manifest e test mirati. Tra i comandi effettivamente presenti:

```bash
node .github/aero/test_aero.cjs
node .github/aero/test_fdm6.cjs
node .github/red_umano/test_red_umano.cjs extracted/site
node .github/blackhawk/test_heli.cjs
node .github/pilot/test_pilot.cjs extracted/site
node .github/pilot/test_hangar.cjs extracted/site
```

I test con `extracted/site` presuppongono che estrazione e patch siano già state applicate fino al passaggio pertinente. La build controlla anche presenza dei GLB, riferimenti dei manifest, orientamenti e dimensioni.

Questi sono strumenti disponibili, non un’attestazione che siano stati eseguiti durante l’aggiornamento della documentazione. Per una modifica grafica, i controlli automatici vanno accompagnati dalla verifica nel percorso interessato: hangar, volo libero o missione. La modifica di soli documenti non richiede di ricostruire il simulatore.

Fonti: [controlli della build](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/workflows/deploy-pages.yml), [test pilota](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/pilot/test_pilot.cjs), [test fisica elicottero](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/blackhawk/test_heli.cjs).

## Modelli 3D e registri

La collezione va letta su tre livelli: **file sorgente**, **modello selezionabile nell’hangar**, **modello collegato alla simulazione**. La presenza di un GLB nel repository prova soltanto il primo livello. Gli elenchi, i manifest e i collegamenti nei loader determinano gli altri due. Le configurazioni descritte qui sono state verificate nei sorgenti dello snapshot; la resa su un dispositivo richiede una verifica del sito pubblicato.

I sorgenti sono conservati in `model-sources/`. Il catalogo generato per l’hangar è `models/manifest.json`; la simulazione usa `modelli/manifest.json`. Il secondo associa un tipo, come `F22`, al file e alla sua trasformazione: `rot`, `lunghezza_m`, `tint`, autore e licenza. Il selettore dell’hangar ha inoltre un elenco `MODELS` esplicito, con voci nascoste e voci procedurali. Le fonti principali sono [build_models.py](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/build_models.py), [publish_hangar_assets.py](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/publish_hangar_assets.py) e [viewer.html](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ef2000/viewer.html).

### Inventario dei principali collegamenti

| Modello | ID hangar → tipo simulazione | File pubblicato o collegamento | Stato ricavabile dal codice |
|---|---|---|---|
| Eurofighter Typhoon | `typhoon` → `F2000` | `models/typhoon.glb`, `modelli/typhoon.glb` | Conversione da archivio Blender; hangar e simulazione |
| F-15E Strike Eagle | `f15e` → `F15` | `models/f15e.glb`, `modelli/f15e.glb` | Conversione da archivio Blender; hangar e simulazione |
| Su-57 | `su57` → `SU57` | `models/su57.glb`, `modelli/su57.glb` | Il GLB fornito prevale sull’archivio convertito |
| Su-35S | `su35` → `SU35` | `models/su35.glb`, `modelli/su35.glb` | GLB incluso e collegato |
| F-14 Tomcat | `f14` → `F14` | `models/f14.glb`, `modelli/f14.glb` | Modello dettagliato; generatore procedurale precedente conservato |
| EA-18G Growler | `ea18` → `EA18` | `models/ea18.glb`, `modelli/ea18.glb` | GLB incluso e collegato |
| F-22 Raptor | `f22` → `F22` | `models/f22.glb`, `modelli/f22.glb` | Copie derivate con correzione dell’ala sinistra |
| F-16C | `f16` → `F16` | `models/f16.glb`, `modelli/f16.glb` | Deriva da `model-sources/hangar/f16-rebuilt.glb`; esiste anche ID catalogo `f16-rebuilt` |
| A-10 | `a10-centurion` → `A10` | `models/a10-centurion.glb` | Collegato anche al volo libero tramite manifest |
| C-130J | `c130j-hercules` → `C130J` | `models/c130j-hercules.glb` | Ricomposto da due parti; collegato al volo libero |
| MQ-9 | `mq9-centurion` → `MQ9` | `models/mq9-centurion.glb` | Collegato al volo libero; configurato non armato nella patch corrente |
| Geran-2 | `geran2` → `GERAN2` | `models/geran2.glb`, `modelli/geran2.glb` | Modello incluso e usato dagli scenari dedicati |
| UH-60 volabile | `uh60-centurion` → `UH60` | `models/uh60-centurion.glb`, `modelli/uh60-centurion.glb` | Modello Arrafi con rotori separati; voce hangar nascosta |
| Airbus A380 | `a380` → `A380` | GLB server condizionale, import locale oppure fallback procedurale | Tipo pilotabile presente; sorgente GLB server assente nello snapshot |
| UAV originali | `uav-fixed`, `uav-quad` → `UAV_FIXED`, `UAV_QUAD` | Generazione procedurale | Modelli e modalità di volo dedicati |

Le associazioni A-10/C-130J/MQ-9 vengono aggiunte da [patch_freeflight.py](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/freeflight/patch_freeflight.py), usando riferimenti dal manifest `modelli/` verso `../models/`. Non richiedono una seconda copia del GLB. Per i jet principali, invece, la build produce normalmente entrambe le copie.

Le trasformazioni del manifest sono parte del contratto del modello. Typhoon, F-15E, Su-57, Su-35, F-14 ed EA-18G hanno `rot:[0,-90,0]`; F-22, F-16 e Geran-2 hanno `[0,180,0]`. A-10 usa `[0,180,0]`, C-130J `[0,0,0]`, MQ-9 `[0,90,0]`, UH-60 `[0,0,0]`. Sono calibrazioni registrate nel codice: sostituendo un GLB occorre ricontrollarle insieme alla scala, alla direzione del muso e ai pivot.

Le lunghezze configurate nel manifest sono 15,96 m per Typhoon, 19,43 per F-15E, 20,1 per Su-57, 21,9 per Su-35, 19,1 per F-14, 18,31 per EA-18G, 18,9 per F-22, 15 per F-16 e 3,5 per Geran-2. I collegamenti aggiuntivi usano 16,26 m per A-10, 29,79 per C-130J, 11 per MQ-9 e 19,76 per UH-60. Questi numeri guidano l’inserimento nella scena e devono accompagnare l’asset quando viene sostituito. [Manifest generato](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/build_models.py), [modelli aggiuntivi](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/freeflight/patch_freeflight.py).

### Collezione hangar e varianti

La collezione aggiuntiva comprende anche `mc130j-centurion`, `mh6-centurion`, `ah6-centurion`, `uh60-pack`, `hermes900-centurion`, `uh60m-wtiger`, `orion-e`, `pj-operator` e gli accessori `pj-mk18`, `pj-m18`, `pj-nvg`, `pj-radio`, `pj-ifak`. MC-130J è dichiarato un adattamento approssimativo del C-130J; la versione pubblicata viene ricomposta da quattro parti. Il piccolo `mc130j-centurion.glb` ancora presente tra i sorgenti non è il file preferito da questa ricomposizione. MH-6 e AH-6 sono adattamenti di un modello low-poly. [Fonte](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/publish_hangar_assets.py).

L’hangar normalizza la dimensione massima del modello per inquadrarlo in modo uniforme. Di conseguenza, le dimensioni apparenti di un pilota, un drone e un aereo nella vetrina non rappresentano un confronto in scala reale. La normalizzazione dell’anteprima e la lunghezza configurata per il mondo di simulazione rispondono a esigenze diverse. [Funzione `frame()`](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ef2000/viewer.html).

Nel selettore corrente AH-6, UH60-pack, Hermes900 e UH60-centurion sono nascosti. Orion-E sostituisce la voce visibile Hermes900. Anche F-16 Studio Lab e UH-60 di Michał Flodrowski sono riferimenti nascosti `embedOnly`: un’anteprima incorporata non equivale a un modello utilizzabile in volo. Per MC-130J, MH-6/AH-6, Orion-E ed Hermes900 non è stato accertato un collegamento pilotabile equivalente a quello dei tipi della tabella. [Fonte](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ef2000/viewer.html).

### Import locali, elicotteri e Airbus

L’hangar salva gli import nel database IndexedDB `centurion2-glb-v1`, store `files`, del browser corrente. Il loader preferisce l’import locale dell’ID selezionato, poi il file pubblicato, quindi una possibile anteprima Sketchfab. Un vecchio import può pertanto mascherare un aggiornamento del server. **Importare, consolidare e pubblicare sono operazioni diverse**: il caricamento nell’hangar non scrive nel repository. [Fonte](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ef2000/viewer.html).

Per UH-60 esistono asset distinti. La voce visibile `uh60m-wtiger` usa il modello di Yi Tsung Lee/WTigerTw; il tipo volabile `UH60` usa `uh60-centurion`, ricomposto dal modello di Muhamad Mirza Arrafi. Quest’ultimo ha i pivot `CENTURION_UH60_MAIN_ROTOR` e `CENTURION_UH60_TAIL_ROTOR`, utilizzati per l’animazione durante il volo. L’anteprima di Flodrowski e la variante `uh60-pack` restano ulteriori elementi separati. [Consolidamento](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/blackhawk/consolidate_uh60m.py), [registrazione](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/blackhawk/publish_uh60.py), [integrazione in volo](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/blackhawk/patch_rotor.py).

Il consolidatore Airbus riconosce A220, A318, A319, A320, A321, A330, A340, A350 e A380; conserva varianti e selezioni canoniche esistenti. Può esportare uno ZIP degli originali con manifest e digest, entro 200 MiB. L’esportazione rimane sul dispositivo finché non viene integrata nel progetto. Nel tree esaminato manca `model-sources/a380.glb`: il loader A380 prova il modello server, poi l’import locale `a380`, poi `CENTURION_A380`, un fallback procedurale. Le altre famiglie importate non diventano automaticamente pilotabili. [Consolidatore](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ef2000/airbus_local.js), [patch A380](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/airbus/patch_a380.py).

## Livree e correzioni visive

La richiesta consolidata è preservare vernice e texture degli aerei, applicando il nero alle derive e centrando il cimiero sulla pinna. Il codice attuale della livrea CENTURION costruisce **superfici sovrapposte rimovibili**: non riassegna materiali, mappe o colori dei GLB originali. L’elmo è ottenuto da un tracciato vettoriale incorporato e rasterizzato; il suo posizionamento usa la regione nera della deriva, con centro alla metà dell’altezza e della corda disponibile. [Fonte](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ef2000/livrea_centurion.js).

`LIVREA_CENTURION` assegna i codici: F-22 `CENT-01`; F-16 `CENT-02`; Su-57 `CENT-04`; Su-35 `CENT-05`; EA-18G `CENT-06`; F-15E `CENT-07`; C-130J `CENT-08`; MC-130J `CENT-09`; MQ-9 `CENT-10`; A-10 `CENT-11`; F-14 `CENT-12`; Hermes900/Orion-E `CENT-13`; Typhoon `CENT-14`. `SENZA_LIVREA` esclude elicotteri, persone, armamenti, droni generici e Geran-2. Le preferenze dell’hangar sono `centurion2-livrea-global` e `centurion2-livrea-exc`; la livrea globale è attiva per default e il comando per velivolo gestisce le eccezioni. [Modulo livrea](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ef2000/livrea_centurion.js), [interfaccia](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ef2000/viewer.html).

**A-10.** Le due derive esterne richiedono una gestione specifica: la regione laterale ammessa passa dal 27% al 49,5% dell’apertura, il modello viene trattato come bideriva e le facce sono raggruppate per posizione anche quando le normali esportate hanno orientamenti problematici. I cimieri vengono costruiti sulla superficie delle derive. È una correzione presente nel sorgente; confermare centratura e visibilità richiede immagini del modello caricato. [Fonte](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ef2000/livrea_centurion.js).

**F-22.** `fix_f22_wing.py` specchia sei coppie di nodi destri sui corrispondenti sinistri: `Object_119←Object_21`, `120←22`, `121←23`, `94←98`, `92←100`, `96←102`. La trasformazione verifica i limiti geometrici risultanti e produce il GLB derivato usato da hangar e simulazione. Il file fornito in `model-sources/f22.glb` rimane la fonte; materiali e texture non vengono ricostruiti. La patch codifica la correzione richiesta dell’ala sinistra, senza dimostrare da sola la qualità visiva finale. [Correzione](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/fix_f22_wing.py), [applicazione](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/build_models.py).

**Typhoon.** Ha anche trattamenti propri: basecolor con vecchie insegne rimosse e funzioni dedicate alla vernice. Non va confuso con il semplice overlay nero della livrea CENTURION. L’illuminazione PBR è gestita separatamente per evitare metalli troppo scuri; gli ambienti sono associati ai singoli renderer WebGL. Durante il caricamento può comparire un modello procedurale temporaneo. [Livrea Typhoon](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ef2000/livrea51.js), [conversione](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/build_models.py), [rendering](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/patch_render.py).

**Carrelli.** Alcuni GLB sono preparati direttamente in configurazione retratta; altri passano attraverso filtri dei nomi dei nodi. La patch conserva varianti `up/off/retracted/stowed` e rimuove quelle riconosciute come carrello esteso. Questo criterio non identifica necessariamente ogni geometria. Gli elicotteri con carrello fisso richiedono una gestione diversa: il manifest UH-60 riporta `gear:'down'`. Prima di sostituire un asset vanno osservati carrello, texture, orientamento e simmetria sia nell’hangar sia in volo. [Filtro](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/patch_site.py), [manifest UH-60](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/blackhawk/publish_uh60.py).

## Pilota e operatori

Il pilota deriva da `FIGHTER_PILOT_OBJ.zip` fornito per il progetto. Il README specifica che l’archivio conteneva OBJ e MTL, ma non la texture esterna richiamata dal materiale: i colori sono stati ricostruiti in modo approssimativo. La geometria è stata semplificata per i telefoni; lo scheletro ha 13 ossa e pesi approssimativi. Le pose estreme possono quindi mostrare deformazioni. [Fonte](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/pilot/README.md).

Sono prodotti due asset con scopi distinti:

| Asset | Uso | Caratteristica |
|---|---|---|
| `assets/pilota.glb` | Scene e pose dinamiche | Versione con scheletro |
| `assets/pilota-hangar-v2.glb` | Hangar | Posa statica più leggera |
| `js/pilota3d.js` | Caricamento e pose | API `PILOTA3D` |

Il publisher ricompone nove parti del modello, controlla integrità, formato GLB, scheletro e risorse incorporate. La chiave locale `pilota-v2` evita che il precedente import `pilota` prevalga automaticamente sul nuovo asset. Se l’import pilota corrente è invalido, il loader ripiega sul file incluso. [Publisher](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/pilot/publish_pilot.py), [versione statica](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/pilot/static_pilot.py), [hangar](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ef2000/viewer.html).

`PILOTA3D` espone `carica`, `nuovo`, `veste`, `posa` e `inCabina`. I collegamenti documentati coprono il CSAR Zagros, il WSO nella cinematica di partenza, il recupero di LUPO21 nel modulo Grappa e le fasi di eiezione, paracadute e arrivo a terra. Le copie del personaggio hanno scheletri indipendenti. Per collocarlo nei GLB degli aerei, `inCabina()` cerca mesh riconoscibili come sedile, strumenti o interno cabina: salta i modelli senza un interno identificabile, citando esplicitamente F-22. Non è quindi corretto promettere un pilota visibile dall’esterno su ogni aereo. [Runtime pilota](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/pilot/pilota3d.js), [collegamenti alle scene](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/pilot/publish_pilot.py).

L’operatore **Pararescue Jumper**, ID `pj-operator`, è un personaggio separato. Nell’hangar riceve Mk18, M18, visore notturno, PRC-152 e IFAK tramite agganci alle ossa; fondina e cinghie sono elementi procedurali. Il modello sorgente è adattato con colori coyote e texture ridotte. Questo asset dettagliato nell’hangar non dimostra che tutti i soccorritori delle cinematiche siano stati sostituiti: pilota recuperato, soccorritori, avversari e personale di terra hanno percorsi di rendering diversi. [Configurazione personaggio](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ef2000/viewer.html), [attribuzioni e adattamenti](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/ATTRIBUZIONI_AEREI_HD.md).

## Fisica e sistemi audiovisivi

La fisica del volo libero è organizzata in moduli distinti. Le specifiche numeriche sono configurazioni del simulatore; i sorgenti descrivono coefficienti, inerzie e controllori come approssimazioni da gameplay, senza una validazione su dati di prova dei singoli velivoli. Non bisogna estendere automaticamente le proprietà del volo libero al motore tattico o alle cinematiche.

| Modulo | API/versione | Responsabilità |
|---|---|---|
| [aero_core.js](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/aero/aero_core.js) | `CENTURION_AERO`, `aero-v2` | Atmosfera, coefficienti aerodinamici, stallo, resistenza, effetto suolo e spinta |
| [fdm6.js](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/aero/fdm6.js) | `CENTURION_FDM6`, `6dof-v1` | Posizione, velocità, quaternioni, velocità angolari, forze/momenti e quadricottero |
| [heli_fdm.js](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/blackhawk/heli_fdm.js) | `CENTURION_HELI_FDM`, `uh60-6dof-4` | Collettivo, ciclico, pedaliera, RPM, potenza, consumo e contatto col suolo |

Il modulo aerodinamico distingue geometrie e parametri dei caccia, trasporti e UAV. Comprende un aumento della resistenza transonica e una risposta diversa del postbruciatore. Il 6DOF integra le rotazioni attraverso momenti e inerzia approssimata; il quadricottero usa spinte differenziali. `patch_fdm6.py` collega questi calcoli al volo libero. La funzione `step()` del core limita il passo a 1/60 s: il comportamento complessivo a basso FPS dipende anche dal chiamante e non va dedotto dal solo nome “6DOF”. [Integrazione](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/aero/patch_fdm6.py).

L’elicottero ha un modello dedicato con smorzamento, RPM governati, limiti di potenza, effetti di velocità e vicinanza al suolo, autorotazione e vortex ring semplificati. Gli impatti possono produrre stato di crash. Il core accetta vento, mentre il collegamento al volo libero esaminato passa vento nullo. Il modello UH-60 resta distinto dalle eventuali altre varianti presenti soltanto nell’hangar. [Fisica](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/blackhawk/heli_fdm.js), [collegamento](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/blackhawk/patch_rotor.py).

L’A380 è configurato non armato, senza eiezione e postbruciatore, con risposta motori più lenta e pista simulata più ampia. La configurazione usa massa nominale 445.000 kg, superficie alare 845 m² e ritardo motori di 7 s; la partenza in quota può iniziare a 232 m/s e 9.750 m. Sono valori implementativi, non una scheda prestazionale certificata. [Fonte](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/airbus/patch_a380.py).

### Recupero pilota e cinematiche

Il modulo `SOCCORSO` collega la lezione S1 di Personnel Recovery al mondo del volo libero. La narrazione simulata comprende schianto, eiezione, discesa, pilota a terra e recupero con squadra STOS. Il codice più recente descrive il radiofaro spento e una posizione GPS trasmessa in forma cifrata nella finzione della missione; l'elicottero usa un navigatore GPS verso la zona di recupero e il punto di consegna. Le cinematiche comprendono l'arrivo della squadra, il recupero e la ripartenza. È un comportamento del simulatore, distinto dalla richiesta di una specifica clip video e da un'eventuale missione hostage rescue. [soccorso.js](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/sar/soccorso.js), [integrazione SAR](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/sar/patch_sar.py).

Il pod aria-superficie mantiene il reticolo sul bersaglio e amplia automaticamente il campo per includere il Maverick in volo. La patch aggiunge simbologia WPN, un punto visibile solo nell'immagine del pod e indicatori per l'arma fuori campo; poi restringe il campo verso l'impatto. [patch_pod_armi.py](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/pod/patch_pod_armi.py).

### Effetti, sensori simulati e sonoro

| Sistema | Comportamento nel codice | Fonte |
|---|---|---|
| Postbruciatore | Shader volumetrico, bagliore ugelli e alone; intensità legata a spinta, quota e condizioni della scena; posizioni ugelli calibrate per i principali jet | [postbruciatore.js](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/postbruciatore/postbruciatore.js) |
| Cono di vapore e bang | Effetto visivo modulato da Mach e umidità; API `CENTURION_SONIC.make/update/dispose` e suono sintetizzato `boom`; innesco e gestione camera sono nella patch separata | [sonic_fx.js](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/sonic/sonic_fx.js), [patch_sonic.py](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/sonic/patch_sonic.py) |
| Camera EO/IR | Modalità WHITE HOT e BLACK HOT tramite postproduzione GPU, HUD separato e risoluzione adattata al dispositivo | [thermal_camera.js](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/thermal/thermal_camera.js) |
| Audio cannoni | Suoni originali sintetizzati per gruppi di calibro, attivi durante il tiro; gestione distinta della vista interna/esterna | [gun_audio.js](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ground_life/gun_audio.js) |
| UAV e ambiente | Modelli procedurali di UAV, ottiche e rotori animati; elementi di scena e personale a terra | [realism.js](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/mission_upgrade/realism.js), [ground_life.js](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ground_life/ground_life.js) |

La camera termica è dichiaratamente una trasformazione artistica dei pixel della scena visibile: non calcola temperature reali, caratteristiche di un sensore infrarosso o probabilità di rilevamento. Analogamente, effetti sonori e visivi servono alla simulazione e alla presentazione cinematica; non sostituiscono il modello fisico. Il loro utilizzo nei trailer va descritto come gameplay o simulazione quando si alternano a riprese reali. [Definizione del sensore simulato](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/thermal/thermal_camera.js).

## Provenienza degli asset

Le attribuzioni seguenti riprendono le dichiarazioni presenti nei sorgenti e nei manifest del repository. Non costituiscono una nuova verifica delle licenze originali. Identità dell’autore, fonte, trasformazioni e condizioni registrate vanno mantenute insieme all’asset anche quando si producono copie ottimizzate.

| Asset o famiglia | Autore dichiarato | Licenza registrata |
|---|---|---|
| Typhoon, F-15E, Su-57, Su-35, F-14, F-16, A-10, raccolta armamenti | bohmerang | CC BY-NC-SA 4.0 |
| EA-18G Growler | Rhine_Lab_Muelsyse | CC BY 4.0 |
| F-22 Raptor | sxnneh | Sketchfab Standard |
| Geran-2 | Karosio | CC BY-NC-SA 4.0 |
| C-130J e adattamento MC-130J | KOG_THORNS | CC BY 4.0 |
| MH-6/AH-6 e UH60-centurion | Muhamad Mirza Arrafi | CC BY 4.0 |
| UH-60M visibile nell’hangar | Yi Tsung Lee / WTigerTw | CC BY 4.0 |
| MQ-9 | IProZenoN | CC BY 4.0 |
| Orion-E | flightclubua | CC BY 4.0 |
| Operatore PJ | DanlyVostok | CC BY 4.0 |
| Mk18; M18 | notcplkerry; k4rmax | CC BY 4.0 |
| NVG; PRC-152; IFAK | karmy2k; r4m; yronthal | CC BY 4.0 |
| A380 previsto dalla patch | Nobilis 2 | CC BY 4.0 dichiarata; GLB server assente |
| Pilota OBJ | Fornito per il progetto | Licenza non specificata nel README |

Le fonti puntuali sono raccolte in [ATTRIBUZIONI_AEREI_HD.md](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/ATTRIBUZIONI_AEREI_HD.md), [build_models.py](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/build_models.py), [publish_hangar_assets.py](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/publish_hangar_assets.py), [publish_uh60.py](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/blackhawk/publish_uh60.py) e [patch_a380.py](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/airbus/patch_a380.py). Questi file registrano anche le modifiche: carrelli rimossi, texture ridotte, materiali convertiti, rotori separati e varianti approssimative.

Per il lavoro sul workshop e sui trailer resta da accertare la compatibilità degli impieghi previsti con le condizioni dei singoli asset. La disponibilità tecnica di un GLB, un link Sketchfab o un import fornito in chat non risolve da sola questo punto. Nel documento non si presume che un asset con indicazione NC, Standard o licenza non specificata abbia già un’autorizzazione commerciale aggiuntiva.

## A Pilot Day: workshop, teaser e trailer

### Finalità e stato del progetto creativo

Il workshop deve collegare aviazione reale, simulazione tattica e strategia alle decisioni del mondo aziendale. La richiesta del 23 novembre 2026 prevede riprese reali, scene di Centurion2 e un racconto più dettagliato del percorso dei partecipanti. Il simulatore costituisce l'ambiente in cui mettere alla prova un piano; briefing e debrief devono rendere leggibili le scelte e i loro effetti. Sono requisiti creativi e formativi, non la conferma di un programma già approvato. [V1, V5]

I materiali recuperati documentano più prototipi e una pipeline modificabile. **Non dimostrano ancora un trailer finale con tutte le riprese reali e le scene gameplay richieste.** Le durate, i nomi e le caratteristiche di versioni differenti devono restare distinti: due file di circa cento secondi non sono necessariamente lo stesso montaggio. [V1–V3]

### Versioni conosciute e prove disponibili

| Versione | Durata | Stato documentato |
|---|---|---|
| `video/LANCIO_FORMAZIONE.mp4`, configurazione storica descritta in chat | Circa 1:40 | Descrizione del 14/11: 1280×720, 24 fps, voce italiana «Elsa», audio dei filmati e musica ambient. Queste caratteristiche sono riferite nella conversazione, non verificate qui sul video. |
| Versione lunga istituzionale storica | 2:37 | Descritta in chat come versione senza highlights, collegata a `video/script_completo.json`; distinta dalle successive uscite promo. |
| `A_Fighter_Pilot_Day_Italiano_100s_Copione.md` | 100 secondi dichiarati | Copione letto, datato 14/11: prototipo motion graphics con immagine sintetica del pilota, voce italiana e musica generate localmente per la bozza. Filmati e dati reali delle sessioni non incorporati. |
| `CENTURION2_TEASER_98s.mp4` | 98 secondi previsti | Previsualizzazione descritta dal README del 23/11; durata calcolata dal builder: 7 scene × 336 fotogrammi / 24 fps. |
| `CENTURION2_PROMO_220s.mp4` | 219,9167 secondi previsti | Previsualizzazione descritta dal medesimo README; durata calcolata: 14 scene × 377 fotogrammi / 24 fps, circa 3:40. |

Le durate delle ultime due righe derivano dai parametri del sorgente, **non da una misura degli MP4**. La lettura del pacchetto modificabile non dimostra che ogni copia dei video sia stata generata da quella stessa revisione. [V1–V3, V5]

### Concetto narrativo e timeline

Il copione da cento secondi mette al centro un pilota in aula, le decisioni dei partecipanti, l'esecuzione del piano nel simulatore e il debrief. La progressione comprende sfida, aula, missione, pianificazione, esperienza, esecuzione, highlights, debrief, collegamento al business e invito finale. Il documento dichiara esplicitamente i limiti del prototipo; la voce della bozza è da sostituire. [V1]

Il brief storico prevede una domanda iniziale sul decollo reale, ritmo radio durante il rifornimento, attacco 3D e highlights come ricompensa: medaglie, obiettivi distrutti, attacchi respinti e subiti. Propone un solo beat drop sull'impatto e uno stacco a nero prima del titolo finale. È una direzione creativa conversazionale, non una descrizione verificata delle previsualizzazioni successive. [V5]

Nel builder del 23/11 il teaser segue sette scene di quattordici secondi: sfida → decollo → formazione → radio/rifornimento → contatto radar → highlights/debrief → titolo e CTA. Il promo segue quattordici scene: sfida → briefing/ruoli → BLUE/RED → rotta → hangar F-22 → decollo → formazione → rifornimento → comunicazioni → HUD → radar → debrief → highlights → CTA. [V3]

Le scene sono illustrazioni con movimento di camera. Il codice applica la dicitura «CONCEPT PREVISUALIZATION | NO GAMEPLAY FOOTAGE»: le immagini di radar, cockpit e missioni non provano l'esistenza o il corretto funzionamento delle corrispondenti funzioni nell'app. [V2, V3]

### Materiali presenti e sorgenti mancanti

Il pacchetto `CENTURION2_TRAILERS_EDITABLE.zip` contiene quattordici PNG, un fermo immagine dell'hangar e cinque file di testo. Non contiene video, registrazioni audio originali o un manifest delle licenze. Il renderer usa immagini e audio sintetizzato; non importa direttamente filmati da Drive o dal simulatore. [V2, V3]

| Materiale | Evidenza e limite |
|---|---|
| `assets/scene-00.png`–`scene-13.png` | Concept art generata proceduralmente con Python/Pillow; non riprese reali o stock video. |
| `f22-hangar.jpg` | Fermo attribuito dal README all'hangar Centurion2. Il promo prevede questa immagine nella quinta scena; il teaser non la seleziona. Se la lettura fallisce, il codice usa una sagoma disegnata. |
| `PilotVV.mp4` | Dichiarato mancante sia nel copione storico sia nel README del pacchetto; nessun inserimento effettuato dal builder. |
| `attacco3d.webm` | Dichiarato mancante; non è un input del renderer. |
| `highlights_BLUE.mp4` | Dichiarato mancante; gli highlights illustrati non equivalgono a questa clip. |
| Video indicato come «rollof» | Riferimento dell'utente ancora da identificare; non compare nei testi del pacchetto. |
| Aula, partecipanti, pilota e volo reali | Nessuna ripresa corrispondente nel pacchetto esaminato. |
| Voce «Elsa» e radio reale | Non presenti nelle uscite descritte dal README; i click tattici sono sintetizzati. |

Il copione del 14/11 dichiara inoltre di non incorporare dati reali delle sessioni. Il README del 23/11 precisa che la sessione Claude di riferimento non era stata letta e che il lavoro derivava dal brief precedente disponibile nella conversazione. Non attribuire ai video contenuti verificati soltanto in fonti ancora non accessibili. [V1, V2]

### Identità e collegamento al business

I nomi presenti sono `CENTURION2` per il simulatore, «A Fighter Pilot Day» nel copione storico, «FIGHTER PILOT DAY» nelle grafiche, «HAVE A FIGHTER DAY» nel claim e «A Pilot Day» nell'ultima richiesta. Il pacchetto usa la CTA «PRENOTA LA TUA SQUADRA». Nome dell'esperienza, titolo dei video, claim e destinazione della CTA richiedono consolidamento editoriale; la loro presenza in una bozza non equivale a un'approvazione definitiva. [V1–V5]

La tabella seguente è una **proposta editoriale**, non un syllabus approvato o una promessa di risultati formativi.

| Momento della missione | Collegamento aziendale proposto | Domanda per il debrief |
|---|---|---|
| Briefing e assegnazione ruoli | Obiettivi condivisi e responsabilità | Chi decideva e con quali informazioni? |
| Pianificazione rotta | Priorità, risorse e alternative | Quale vincolo ha guidato il piano? |
| Comunicazioni e formazione | Coordinamento e passaggi di informazioni | Quale messaggio ha cambiato la scelta? |
| Evento inatteso o soccorso | Riprogrammazione e gestione degli imprevisti | Quando abbiamo rivisto le priorità? |
| Debrief | Apprendimento e miglioramento | Quale comportamento ripetere o cambiare? |

Per rendere il collegamento credibile, il montaggio finale dovrebbe mostrare una decisione dei partecipanti, il suo effetto nel simulatore e la successiva discussione. Una scena spettacolare da sola non documenta questo passaggio.

### Rigenerazione, audio e limiti del builder

Il pacchetto richiede Python 3, Pillow, NumPy, FFmpeg e font Noto Sans Display, Lato e DejaVu Sans Mono. I percorsi dei font sono fissati nel sorgente e vanno adattati se l'ambiente è diverso. L'entrypoint è: [V2, V3]

```bash
python3 build_trailers.py
```

Il programma ridisegna tutte le immagini, crea playlist `.ffconcat` e WAV in `output/`, quindi produce i due MP4 accanto allo script. **Sovrascrive i PNG delle scene**, perciò eventuali modifiche manuali andrebbero perse. Inoltre salta il rendering di ciascun MP4 già esistente: per una nuova versione occorre conservare/rinominare l'output precedente oppure modificare esplicitamente quel controllo. Rilanciare il builder non aggiunge riprese, gameplay o voce. [V3]

La musica viene sintetizzata localmente. Il codice supporta la dichiarazione del README sull'assenza di tracce musicali di terze parti. `VOICEOVER_COPIONI.txt` e i due SRT contengono bozze italiane e timing, ma il comando di rendering non sintetizza la narrazione, non la miscela e non incorpora gli SRT. La voce e i sottotitoli richiedono una fase aggiuntiva. [V2–V4]

Non è documentata una verifica complessiva dei diritti: manca un registro di provenienza/licenze, incluso per il fermo immagine. Per le future riprese e clip servono fonti identificabili e condizioni d'uso verificate; la musica procedurale non risolve i diritti degli altri materiali. [V2, V3]

### Fonti del capitolo

- **[V1]** `A_Fighter_Pilot_Day_Italiano_100s_Copione.md`, titolo «A Fighter Pilot Day — teaser italiano (100 secondi)», 14/11/2026; documento letto integralmente.
- **[V2]** `README_TRAILERS.md` nel pacchetto `CENTURION2_TRAILERS_EDITABLE.zip`, generazione dichiarata 23/11/2026.
- **[V3]** `build_trailers.py` e indice dello stesso pacchetto, esaminati staticamente il 23/11/2026; script non eseguito durante la verifica.
- **[V4]** `VOICEOVER_COPIONI.txt`, `VO_CENTURION2_TEASER.srt` e `VO_CENTURION2_PROMO.srt`, nello stesso pacchetto del 23/11/2026.
- **[V5]** Requisiti e descrizioni nelle conversazioni disponibili del 14–23/11/2026; distinguere sempre intenzioni creative e risultati osservati.

### Lavoro necessario per il trailer finale

Restano richiesti riprese reali, gameplay di **hostage rescue e pilot rescue**, abbattimento obiettivi, esplosioni, highlights effettivi e collegamenti espliciti al workshop. La dicitura «summit boom» va chiarita senza trasformarla automaticamente in «sonic boom». Occorre identificare le clip, verificarne la provenienza, montare le scene e completare voce, audio e CTA. La chiusura richiede una visione integrale degli MP4 finali, controllo delle durate reali e confronto tra ogni scena mostrata e le funzioni effettivamente disponibili in Centurion2.

## Verifiche osservate e loro portata

Sono stati letti gli stati di questi run già esistenti. I risultati non derivano da una nuova esecuzione durante la stesura della knowledge.

| Verifica | Commit di riferimento | Esito letto | Cosa dimostra |
|---|---|---|---|
| [Pubblicazione più recente](https://github.com/stefanopasqual/centurion2/actions/runs/45267278703) | `bb902c6fd72dfe95e1212ae9f810c185d743da45` | Success | Assemblaggio e pubblicazione su GitHub Pages conclusi; non prova ogni combinazione browser/modello. |
| [QA cimieri dopo fix A-10](https://github.com/stefanopasqual/centurion2/actions/runs/45260794969) | `d39df8f0c0d0cfa6c7b37e33419d5dc7160beb20` | Success | Il workflow visivo è terminato; i suoi screenshot non sono stati riesaminati in questa ricognizione. |
| [Deploy della correzione F-22](https://github.com/stefanopasqual/centurion2/actions/runs/45247362869) | `cda4a1e8c0b69ada6e47a5678d6f4f5598d8db8c` | Success | La correzione è entrata in un deploy riuscito. |
| [QA visiva dopo aggiornamento acquisizione screenshot](https://github.com/stefanopasqual/centurion2/actions/runs/45248231488) | `74c972543147aa3ff88dd782e1f58ed7a340b69c` | Success | Run successivo al [tentativo fallito](https://github.com/stefanopasqual/centurion2/actions/runs/45247987717); non è una nuova approvazione visiva manuale dell'ala. |
| [Verifica patch Donbass/UAV](https://github.com/stefanopasqual/centurion2/actions/runs/45266969500) | `15933f92c446651efb5c381ea8300d935b8d955e` | Success | Controlli di quel workflow completati sul commit indicato. |

Nel workflow cimieri corrente, il set ispezionato è limitato ad A-10: non presentare quel run come collaudo visivo completo di tutta la flotta. In generale, tenere separati **file presente**, **manifest corretto**, **build riuscita**, **modello effettivamente caricato** e **risultato visivo accettato**.

Fonti: [.github/workflows/hangar-crest-visual.yml](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/workflows/hangar-crest-visual.yml), [.github/workflows/diagnose-f22.yml](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/workflows/diagnose-f22.yml), [correzione A-10](https://github.com/stefanopasqual/centurion2/commit/3a129c8fe28e9e86608a5b58550e2ac7535e3bc7), [correzione F-22](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/fix_f22_wing.py).

## Questioni aperte e criteri di chiusura

Questa è una lista di verifica derivata dalle richieste più recenti e dalle differenze fra fonti. Le priorità sono un ordine proposto per riprendere il lavoro; non attestano nuovi malfunzionamenti.

| Priorità | Questione | Evidenza disponibile | Criterio concreto per chiuderla |
|---|---|---|---|
| Alta | Cimieri A-10 ancora segnalati mancanti | Fix specifico e CI presenti; segnalazione utente ripetuta il 23/11. | Due derive visibili da angoli appropriati, cimieri centrati e vernice originale preservata su deploy corrente, anche sul dispositivo interessato. |
| Alta | Integrità della livrea originale | Overlay circoscritti alle derive nel codice più recente. | Confronto con il GLB sorgente e screenshot del modello finale; assenza di ricolorazione globale indesiderata. |
| Alta | Ala sinistra F-22 | Patch di simmetria e deploy riuscito. | Raffronto delle due ali dall'alto, dal basso e di lato; materiali e parti circostanti integri. |
| Alta | Pilota visibile nel percorso richiesto | Nuovo GLB, rig, pubblicazione e integrazioni presenti. | Verifica separata in hangar, cinematiche e cabine supportate; documentazione esplicita dei modelli senza interno. |
| Alta | Coerenza hangar–simulazione | Manifest e loader distinti; differenza UH60 documentata. | Tabella del modello desiderato per ciascun contesto e prova che il runtime carichi quel file. |
| Alta | Versione persistente degli asset | Import locale può prevalere sul file server. | Prova da un browser senza import personali e da un secondo dispositivo, conservando prima gli asset locali. |
| Alta | Video con materiale reale | Pacchetto modificabile recuperato ancora in previsualizzazione. | Sorgenti reali identificate, timecode e gameplay documentati, montaggio/voce/sottotitoli verificati sul file finale. |
| Media | A380 condiviso | Loader e fisica disponibili; GLB server non trovato nel tree. | Identificazione del modello scelto, consolidamento nella pipeline e verifica da dispositivo privo dell'import locale. |
| Media | Elicotteri | FDM UH60 e test numerici presenti; altri modelli hangar non equivalenti. | Controllo del modello, rotori, scala, hovering, traslazione, atterraggio e performance nel browser. |
| Media | Mobile/PWA | Controlli e ottimizzazioni implementati; cache con fingerprint. | Apertura da iPhone/Android, input usabili, caricamento modelli, aggiornamento cache e assenza di schermo scuro nei profili scelti. |
| Media | Missioni Comandante | Doppia persistenza locale, export/import e percorso di condivisione. | Creazione, ricaricamento, esportazione e uso della stessa missione su altro dispositivo. |
| Media | SAM trainer e principianti | Controlli per singola batteria e percorsi Cadet/Accademia presenti. | Definizione della configurazione didattica desiderata; non risulta una scelta unica di batteria da disattivare per sempre. |
| Media | Hostage rescue | Richiesto per il trailer; nelle fonti esaminate non è stata identificata una missione dedicata con prova di gameplay. | Trovare o realizzare la scena pertinente e registrarne il funzionamento; distinguerla dal recupero pilota già descritto. |
| Media | Fonti e uso degli asset | Attribuzioni presenti, con licenze diverse fra modelli. | Registro aggiornato per asset effettivamente usati nel workshop e nei video, con provenienza e autorizzazioni pertinenti. |
| Da chiarire | “rollof”, “summit boom”, modello “Michael” | Riferimenti testuali delle conversazioni. | Associazione a un file, un autore o un effetto preciso; evitare normalizzazioni arbitrarie. |

Il riferimento “summit boom” resta irrisolto anche se il simulatore contiene effetti sonici: la somiglianza del nome non basta a dimostrare che l'utente intendesse proprio quel modulo. Analogamente, la richiesta storica di un modello attribuito a “Michael” va confrontata con i riferimenti UH60 effettivamente presenti.

## Procedura per riprendere lo sviluppo

1. **Fissare il punto di partenza.** Leggere l'HEAD corrente di `main`, l'ultimo deploy riuscito e le eventuali modifiche successive allo snapshot di questa knowledge.
2. **Individuare il percorso interessato.** Distinguere hangar, volo libero, cinematiche tattiche, Accademia, Commander o video; risalire al file e alla patch che producono quel comportamento.
3. **Conservare i dati locali utili.** Prima di cancellare storage del sito o import personali, esportare missioni e GLB necessari. La cancellazione di IndexedDB non equivale alla sola rimozione di una cache temporanea.
4. **Modificare la sorgente produttiva.** Aggiornare la patch o l'asset realmente invocato dal workflow; per i modelli controllare ID, nome file, orientamento, scala e registrazione nei manifest.
5. **Applicare verifiche pertinenti.** Eseguire i controlli già disponibili per la funzione modificata e osservare il comportamento nel contesto d'uso. Per una modifica visiva, raccogliere immagini del deploy identificato.
6. **Registrare il risultato.** Annotare commit, run, modello/file effettivo, dispositivo e verifica compiuta. Aggiornare la knowledge distinguendo ciò che è risolto da ciò che rimane da verificare.

La modifica della sola documentazione non richiede il riassemblaggio del simulatore. Per cambi funzionali, la ricetta autorevole resta il workflow; evitare comandi di avvio o file backend non presenti nel repository.

### Punti di manutenzione emersi dalla lettura

- `.github/red_umano/patch_red_umano.py` viene eseguito dalla build, ma la sua directory non compare nel filtro `push.paths` del deploy. Una modifica isolata lì richiede un trigger esplicito o l'aggiornamento del filtro.
- Commenti come “10 missioni”, “maps5” o “12 flyable aircraft” possono essere storici. Per l'inventario corrente usare array, manifest e patch effettive.
- Le patch testuali dipendono da ancore nel pacchetto base. Un nuovo ZIP può richiedere aggiornamento delle ancore e verifica dell'ordine.
- Le configurazioni di origine e quelle del GLB derivato hanno ruoli diversi. Conservare il sorgente quando si correggono geometria o materiali del derivato web.
- La disponibilità di un file e una simulazione headless riuscita non sostituiscono la verifica visiva su browser.

## Cronologia essenziale

| Data | Passaggio | Lettura corretta oggi |
|---|---|---|
| 14/11/2026 | Concept lancio, highlights, copione italiano da 100s. | Distinguere pipeline video descritta in chat e prototipo realmente documentato. |
| 15/11/2026 | Pubblicazione web/mobile, nome `centurion2`, richiesta protezione iniziale; import di jet più realistici. | L'utente riferisce funzionamento online in quella data; non è validazione di tutte le funzioni successive. |
| 16/11/2026 | GLB in hangar e simulazione, gear up, F-22/F-16, ritorno home, Comandante e nuove mappe. | Le richieste conducono a pipeline e registri oggi documentati; alcuni caricamenti erano locali. |
| 17/11/2026 | Richiesta di rendere privato il repository. | Il metadato verificato il 23/11 è ancora public. |
| 18–19/11/2026 | Black Hawk, Airbus, correzione fisica e richiesta di pilota di prova. | Il pilota virtuale dei test è una procedura software; non prova un collaudo umano o certificato. |
| 22/11/2026 | Nuovi asset ancora segnalati assenti; richieste di consolidamento nell'hangar. | Necessario distinguere acquisizione del file e integrazione nel deploy. |
| 23/11/2026 | Nuovo pilota, livree conservate, cimieri A-10, ala F-22, RED umano, aggiornamenti mobile/cockpit. | Commit e CI forniscono riscontri tecnici; mantenere le verifiche visive per ciascun problema. |
| 23/11/2026 | Nuovi teaser/trailer A Pilot Day con riprese reali e gameplay. | I pacchetti recuperati non provano ancora l'esecuzione completa di questo brief. |

### Materiali storici utili da ritrovare

I nomi seguenti identificano pacchetti o allegati citati nelle conversazioni e/o nei metadati dei file; non sono tutti presenti nella root del repository:

- `CENTURION_web.zip`, `CENTURION2_GITHUB_MOBILE.zip` e istruzioni mobile precedenti: non assumere che copie con lo stesso nome abbiano gli stessi byte.
- `CENTURION2_EUROFIGHTER.zip`, `CENTURION2_F15E.zip`, `CENTURION2_SU57.zip`, `CENTURION2_ARMAMENTI.zip`.
- `CENTURION2_MODEL_SOURCES_UPLOAD.zip`, `CENTURION2_GLB_GEAR_UP.zip`, `CENTURION2_F22_RAPTOR_GEAR_UP.zip`.
- `FIGHTER_PILOT_OBJ.zip`, `CENTURION2_Pilota_3D.glb` e pacchetti dei modelli dettagliati: confrontare con il publisher e i digest del repository.
- `PilotVV.mp4`, `attacco3d.webm`, `highlights_BLUE.mp4` e riferimento “rollof”: sorgenti richieste per il montaggio reale, da identificare.
- `CENTURION2_TRAILERS_EDITABLE.zip`, `CENTURION2_TEASER_98s.mp4`, `CENTURION2_PROMO_220s.mp4`: stato e limiti descritti nel capitolo video.

La presenza di un nome in questa lista non costituisce prova di disponibilità dei byte, di integrazione nel software o di autorizzazione al riutilizzo.

## Fonti e aggiornamento del documento

### Fonti tecniche principali

- [Repository allo snapshot esaminato](https://github.com/stefanopasqual/centurion2/tree/705e74c94f3611451b886f9ae7229ecb70d1b1b2).
- [Workflow di assemblaggio e pubblicazione](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/workflows/deploy-pages.yml).
- [Generatore modelli](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/build_models.py), [asset hangar aggiuntivi](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/publish_hangar_assets.py), [viewer](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/ef2000/viewer.html).
- [Attribuzioni dei modelli](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/models/ATTRIBUZIONI_AEREI_HD.md) e [documentazione del pilota](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/pilot/README.md).
- [Commander](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/commander/core.js), [Accademia](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/cadet/accademia.js), [mappe](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/maps/maps5.js).
- [Aerodinamica](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/aero/aero_core.js), [6DOF](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/aero/fdm6.js), [elicotteri](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/blackhawk/heli_fdm.js).
- [Stato del sito](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/security/stato_sito.txt), [cifratura](https://github.com/stefanopasqual/centurion2/blob/705e74c94f3611451b886f9ae7229ecb70d1b1b2/.github/security/cifra_sito.mjs).
- Sorgenti `_integration_inspect/` citate nei capitoli: usate come snapshot di analisi, non come output produttivo.

Le fonti video esterne al repository sono identificate per nome e data nel capitolo dedicato. Le richieste storiche provengono dal contesto delle conversazioni reso disponibile per questa stesura. I riferimenti a Drive e agli artifact di altre sessioni non letti non sono usati come prova dei loro contenuti.

### Regola di aggiornamento

A ogni modifica significativa, aggiornare lo snapshot, il capitolo coinvolto, il registro delle questioni aperte e la prova che supporta l'eventuale chiusura. Una richiesta nuova va registrata come requisito; un commit come codice presente; un run come esito CI; una verifica browser come comportamento osservato. Conservare gli stati storici quando spiegano una differenza di asset, di versione o di aspettativa.

Questo file è una documentazione separata dal README.
