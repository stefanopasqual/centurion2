'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const clone = value => JSON.parse(JSON.stringify(value));
const source = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const storage = entries => {
  let data = JSON.stringify(entries || []);
  return { getItem: () => data, setItem: (_, value) => { data = value; }, clear: () => { data = '[]'; } };
};

// Exercise asynchronous store reconciliation without requiring a browser or extra packages.
function database(entries) {
  const rows = new Map(entries.map(e => [e.id, clone(e)]));
  let pending = 0;
  const later = fn => { pending++; setImmediate(() => { try { fn(); } finally { pending--; } }); };
  const indexedDB = { open() {
    const request = {};
    later(() => {
      request.result = { close() {}, transaction() {
        const tx = {};
        const operation = fn => { const q = {}; later(() => { q.result = fn(); tx.oncomplete(); }); return q; };
        tx.objectStore = () => ({
          getAll: () => operation(() => clone([...rows.values()])),
          put: entry => operation(() => { rows.set(entry.id, clone(entry)); return entry.id; }),
          delete: id => operation(() => rows.delete(id))
        });
        return tx;
      } };
      request.onsuccess();
    });
    return request;
  } };
  return { indexedDB, async idle() { while (pending) await new Promise(setImmediate); } };
}

function core(localStorage, indexedDB) {
  const context = vm.createContext({ localStorage, indexedDB, navigator: {}, console });
  context.window = context;
  vm.runInContext(source('core.js'), context);
  return context;
}

test('the newest local mission survives loss of localStorage after recovery', async () => {
  const old = { id: 'CM-test', nome: 'Originale', savedAt: '2026-11-23T10:00:00.000Z', scenario: { target: [] } };
  const latest = { ...old, nome: 'Modificata', savedAt: '2026-11-24T10:00:00.000Z' };
  const db = database([old]), ls = storage([latest]);
  const first = core(ls, db.indexedDB).COMMANDER_CORE;
  await first.ready; await db.idle();
  assert.equal(first.readSaved(old.id).nome, latest.nome);
  ls.clear();
  const reopened = core(ls, db.indexedDB).COMMANDER_CORE;
  await reopened.ready; await db.idle();
  assert.equal(reopened.readSaved(old.id).nome, latest.nome);
});

test('the newest IndexedDB mission is restored to localStorage', async () => {
  const old = { id: 'CM-test', nome: 'Originale', savedAt: '2026-11-23T10:00:00.000Z', scenario: { target: [] } };
  const latest = { ...old, nome: 'Modificata', savedAt: '2026-11-24T10:00:00.000Z' };
  const db = database([latest]), ls = storage([old]);
  const opened = core(ls, db.indexedDB).COMMANDER_CORE;
  await opened.ready; await db.idle();
  assert.equal(opened.readSaved(old.id).nome, latest.nome);
  assert.equal(JSON.parse(ls.getItem())[0].nome, latest.nome);
});

function editor(extraTarget) {
  const context = core(storage()), clicks = new Map(), alerts = [];
  let overlay;
  Object.assign(context, {
    alert: message => alerts.push(message), confirm: () => true,
    setInterval: () => 1, clearInterval() {}, setTimeout() {},
    fetch: async () => ({ ok: true, json: async () => ({ missioni: [] }) }),
    APP: {}, MAPPA: {}, UI: { toast() {} },
    document: {
      addEventListener() {},
      querySelector: selector => selector === '#commander-overlay' ? overlay :
        selector === '#cmd-import' ? { addEventListener() {} } : null,
      body: { appendChild: element => { overlay = element; } },
      createElement: () => ({
        setAttribute() {},
        querySelectorAll(selector) {
          if (selector !== '[data-del]') return [];
          return [...this.innerHTML.matchAll(/data-del="([^"]+)"/g)].map(match => ({
            dataset: { del: match[1] },
            addEventListener: (_, callback) => clicks.set(match[1], callback)
          }));
        }
      })
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../_integration_inspect/scenario_default.js'), 'utf8'), context);
  context.APP.sc = context.COMMANDER_CORE.fresh(45, 12);
  if (extraTarget) context.COMMANDER_CORE.addEntity(context.APP.sc, 'target', { lat: 45.1, lon: 12.1 });
  vm.runInContext(source('commander.js'), context);
  context.COMANDANTE.open();
  return { context, alerts, remove: key => clicks.get(key)({ stopPropagation() {} }) };
}

test('rejecting deletion of a required point keeps the complete mission unchanged', () => {
  for (const kind of ['target', 'gate', 'aar']) {
    const e = editor(false), sc = e.context.COMANDANTE.scenario, before = JSON.stringify(sc);
    e.remove(kind + ':' + sc[kind][0].id);
    assert.equal(e.alerts.length, 1, kind + ' deletion should be rejected');
    assert.ok(JSON.stringify(e.context.COMANDANTE.scenario) === before, kind + ' must survive the rejection');
  }
});

test('deleting an optional target updates the mission and removes its plan references', () => {
  const e = editor(true), sc = e.context.COMANDANTE.scenario, id = sc.target[0].id;
  e.remove('target:' + id);
  const updated = e.context.COMANDANTE.scenario;
  assert.equal(e.alerts.length, 0);
  assert.equal(updated.target.length, 1);
  assert.equal(updated.target.some(t => t.id === id), false);
  assert.equal(Object.values(updated.piani.BLUE.formazioni).some(p => p.target === id), false);
});
