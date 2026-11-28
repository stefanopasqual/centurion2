const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const site = path.resolve(process.argv[2] || 'site_test');
const model = require('./radar_model.js');
const near = (a, b) => Math.abs(a - b) < 1e-10;
assert(near(model.rangeFactor(0.3, 0, 0), model.rangeFactor(0.3, 180, 180)));
assert(model.rangeFactor(0.3, 0, 90) > model.rangeFactor(0.3, 0, 0));
assert(near(model.rangeFactor(0.3, 0, 90), model.rangeFactor(0.3, 0, 270)));
assert.equal(model.rangeFactor(0.3, NaN, 90), 0.3);

const GEO = {
  dist: (a, b) => Math.hypot(a.lat - b.lat, a.lon - b.lon),
  bearing: (a, b) => Math.atan2(b.lon - a.lon, b.lat - a.lat) * 180 / Math.PI,
  fmtBE: () => 'test'
};
const context = { GEO, CENTURION_RADAR: model };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(site, 'js/engine.js'), 'utf8') + '\n;globalThis.TestEngine = Engine;', context);
const E = context.TestEngine.prototype;
const types = {
  F22: { stealth: 0.3, radar_nm: 100, missili_nm: 40 },
  F15: { stealth: 1, radar_nm: 100, missili_nm: 40 },
  SU57: { stealth: 0.4, radar_nm: 100, missili_nm: 40 },
  SA10: { radar_nm: 150 }, E7: { radar_nm: 200 }
};
const plane = (id, tipo, lato, lat, lon) => ({ id, tipo, lato, lat, lon, hdg: 0, alt: 10000, n: 1, distrutto: false, armi: { AMRAAM: 1, ADDER: 0 }, cooldown: {}, stato: 'cap', ultimo_sam: -1e9 });
const blue = plane('blue', 'F22', 'BLUE', 0, 0);
const red = plane('red', 'SU57', 'RED', 28, 0);
const testEngine = { tipo: f => types[f.tipo], sc: { tipi: types, basi: [] }, e7: [], sam: [], flights: [blue, red], radarFactor: E.radarFactor };
assert.equal(E.rilevato.call(testEngine, 'RED', blue), false, 'front aspect');
red.lat = 0; red.lon = 28;
assert.equal(E.rilevato.call(testEngine, 'RED', blue), true, 'side aspect');
blue.hdg = 90;
assert.equal(E.rilevato.call(testEngine, 'RED', blue), false, 'rotation changes detection');

let opened = 0;
const shooter = plane('shooter', 'F15', 'BLUE', 0, 0);
const target = plane('target', 'SU57', 'RED', 0, 20);
target.armi = {};
const engagement = { flights: [shooter, target], t: 0, ingaggi: [], tipo: f => types[f.tipo], missili: E.missili, rilevato: () => true, iniziaIngaggio: () => opened++ };
E.aggiornaIngaggi.call(engagement, 1);
assert.equal(opened, 1, 'a detected target within missile range can be engaged');
target.lon = 41;
E.aggiornaIngaggi.call(engagement, 1);
assert.equal(opened, 1, 'missile range remains a separate limit');

const samTarget = plane('sam-target', 'F22', 'BLUE', 0, 0);
const sam = { nome: 'test', lat: 0, lon: 41, attivo: true, missili: 10, raggio_nm: 40 };
let lost = 0;
const battery = { flights: [samTarget], sam: [sam], t: 1000, tipo: f => types[f.tipo], radarFactor: E.radarFactor, sc: { tipi: types, mappa: { griglia: {} }, regole: { growler_copertura_quadrati: 0, sam_missili_per_aereo: 1 } }, score: { RED: { missili_sam: 0 } }, evento: () => {}, perdita: () => lost++ };
E.aggiornaSamIngaggi.call(battery);
assert.equal(lost, 0, 'detection does not extend missile range');
sam.lon = 30;
E.aggiornaSamIngaggi.call(battery);
assert.equal(lost, 1, 'SAM can engage within both ranges');

const THREE = require(path.join(site, 'vendor/three.min.js'));
const flightContext = { THREE, APP: { sc: { tipi: types } }, CENTURION_RADAR: model };
flightContext.window = flightContext;
vm.createContext(flightContext);
let flightCode = fs.readFileSync(path.join(site, 'js/volo.js'), 'utf8');
const marker = '  return { ';
const returnAt = flightCode.lastIndexOf(marker);
assert(returnAt > 0 && flightCode.slice(returnAt).includes('apri, chiudi, AEREI, ARMI'), 'free-flight test hook');
const insertAt = returnAt + marker.length;
flightCode = flightCode.slice(0, insertAt) + '_radarTest: { setState: s => S = s, candidati, aggiornaLock, aggiornaNemici }, ' + flightCode.slice(insertAt);
vm.runInContext(flightCode + '\n;globalThis.TestFlight = VOLO;', flightContext);
const api = flightContext.TestFlight._radarTest;
const player = { pos: new THREE.Vector3(0, 1000, 0), Q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0, 'YXZ')), vivo: true };
const enemy = { pos: new THREE.Vector3(0, 1000, -31000), vel: new THREE.Vector3(), hdg: Math.PI, vivo: true, tipoId: 'SU57' };
const state = { pl: player, cfg: { aereo: 'F15' }, arma: 'AIM120', nemici: [enemy], terra: [], lock: null };
api.setState(state);
assert.equal(api.candidati().length, 0, 'front aspect hides a distant radar contact');
enemy.hdg = Math.PI / 2;
assert.equal(api.candidati().length, 1, 'side aspect reveals the radar contact');
state.lock = { t: enemy, k: 0, ok: false };
enemy.hdg = Math.PI;
api.aggiornaLock(0.1);
assert.equal(state.lock, null, 'radar contact can be lost after a turn');
types.SU57.stealth = 0.1;
enemy.pos.z = -15000;
assert.equal(api.candidati().length, 0, 'radar detection depends on the game coefficient');
state.arma = 'AIM9X';
assert.equal(api.candidati().length, 1, 'infrared selection does not use radar detection');
state.cfg = { aereo: 'F22', sam: true };
state.nemici = [];
state.missili = [];
player.agl = 1000;
const groundRadar = { sotto: 'sam', vivo: true, pos: new THREE.Vector3(0, 0, -15000), gittata: 35000, cad: 100, missili: 1 };
state.terra = [groundRadar];
api.aggiornaNemici(0.1);
assert.equal(groundRadar.illumina, false, 'ground radar front aspect');
groundRadar.pos.set(15000, 0, 0);
api.aggiornaNemici(0.1);
assert.equal(groundRadar.illumina, true, 'ground radar side aspect');
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
assert(html.indexOf('js/radar_model.js') >= 0 && html.indexOf('js/radar_model.js') < html.indexOf('js/engine.js'));
console.log('PASS: model, mission detection, engagement, SAM range, radar lock, IR and script order');
