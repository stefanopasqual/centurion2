/* Run: node .github/red_umano/test_red_umano.cjs [extracted/site]
 *
 * engine.js e uno script di browser (non un modulo), quindi NON eseguo il motore
 * completo in Node: verifico che i gate siano stati applicati ai file, che la
 * regola di default esista, che l'interruttore sia nel briefing, e che la logica
 * del predicato "IA della ROSSA" si comporti come atteso. La prova interattiva
 * (hot-seat nel browser) resta manuale. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2] || 'extracted/site';
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

// 1) i gate sono applicati al motore e la regola di default esiste
const engine = read('js/engine.js');
assert.ok(/RED: schedule CAP[\s\S]{0,140}red_umano\) return;/.test(engine),
  'gate auto-decollo CAP della ROSSA mancante in engine.js');
assert.ok(/autoScramble[\s\S]{0,120}red_umano/.test(engine),
  'gate auto-scramble della ROSSA mancante in engine.js');

const scen = read('js/scenario_default.js');
assert.ok(/red_umano:\s*false/.test(scen), 'regola red_umano di default mancante');

const ui = read('js/ui.js');
assert.ok(/REDUMANO_TOGGLE/.test(ui), 'interruttore nel briefing mancante in ui.js');
assert.ok(fs.existsSync(path.join(root, 'js/red_umano.js')), 'js/red_umano.js mancante');

// 2) la logica del predicato (riprodotta dalla patch) si comporta come atteso:
//    autoTask = l'IA tasca/decolla il velivolo automaticamente
const autoTask = (lato, regole) => !(lato === 'RED' && regole && regole.red_umano);
assert.equal(autoTask('RED', { red_umano: true }), false, 'ROSSA umana: IA spenta');
assert.equal(autoTask('RED', { red_umano: false }), true, 'ROSSA robot: IA attiva');
assert.equal(autoTask('RED', {}), true, 'default: IA della ROSSA attiva');
assert.equal(autoTask('BLUE', { red_umano: true }), true, 'BLUE invariato dall\'interruttore');

// 3) lo scramble parte comunque su ordine umano (f.scramble) anche con IA spenta
const scramblePartira = (lato, regole, fScramble, nemici) => {
  const autoScramble = !(lato === 'RED' && regole && regole.red_umano);
  return !(!fScramble && !(autoScramble && nemici > 0));
};
assert.equal(scramblePartira('RED', { red_umano: true }, true, 0), true, 'ordine umano fa partire lo scramble');
assert.equal(scramblePartira('RED', { red_umano: true }, false, 5), false, 'con IA spenta niente scramble automatico');
assert.equal(scramblePartira('RED', { red_umano: false }, false, 5), true, 'con IA attiva scramble automatico sui nemici');

console.log('PASS red_umano: gate motore presenti, regola default, interruttore briefing, logica IA ROSSA');
