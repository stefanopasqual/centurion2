# Pilota CENTURION2

Il pilota proviene dal file `FIGHTER_PILOT_OBJ.zip` fornito dal proprietario
del progetto. L'archivio contiene un OBJ e un MTL; la texture esterna indicata
dal MTL non era presente. I materiali sono stati quindi ricostruiti con colori
approssimativi, senza attribuirli alla texture originale.

La geometria è stata semplificata per l'uso su telefoni. È stato aggiunto uno
scheletro con 13 ossa e pesi approssimativi per le pose di recupero, corsa,
eiezione e paracadute. Le parti in `model-sources/pilot/` vengono ricomposte e
verificate dalla build; il file risultante sostituisce `assets/pilota.glb`.
Le pose non sono animazioni professionali e alcune deformazioni possono essere
visibili nei movimenti più estremi.
