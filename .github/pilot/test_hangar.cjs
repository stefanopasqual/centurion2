// Check the real hangar GLB and the actual selection/fallback code.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const site = path.resolve(process.argv[2]);
const THREE = global.THREE = require(path.join(site, 'vendor/three.min.js'));
global.self = global;
require(path.join(site, 'vendor/GLTFLoader.js'));

function parse(name) {
  const b = fs.readFileSync(path.join(site, 'assets', name));
  return new Promise((ok, bad) => new THREE.GLTFLoader().parse(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', ok, bad));
}

(async () => {
  const [rig, hangar] = await Promise.all([parse('pilota.glb'), parse('pilota-hangar-v2.glb')]);
  rig.scene.updateMatrixWorld(true); hangar.scene.updateMatrixWorld(true);
  let meshes = 0, skins = 0;
  hangar.scene.traverse(o => { if (o.isMesh) meshes++; if (o.isSkinnedMesh) skins++; });
  assert(meshes > 0 && skins === 0, 'hangar pilot should use static meshes');
  const a = new THREE.Box3().setFromObject(rig.scene), b = new THREE.Box3().setFromObject(hangar.scene);
  assert(a.min.distanceTo(b.min) < .0001 && a.max.distanceTo(b.max) < .0001, 'hangar model changed dimensions');
  assert(fs.statSync(path.join(site, 'assets/pilota-hangar-v2.glb')).size < fs.statSync(path.join(site, 'assets/pilota.glb')).size, 'hangar model not reduced');

  const html = fs.readFileSync(path.join(site, 'ef2000/viewer.html'), 'utf8');
  const match = html.match(/\{id:'pilota'[^\n]+\}/);
  assert(match, 'pilot entry missing');
  const model = vm.runInNewContext('(' + match[0] + ')');
  const start = html.indexOf('async function openModel(m)');
  const end = html.indexOf('\nfor(const m of MODELS)', start);
  assert(start >= 0 && end > start, 'hangar selection function missing');
  const code = html.slice(start, end) + '\nthis.testOpenModel = openModel;';
  const elements = new Map(), reads = [], requests = [], placed = [];
  const ctx = { token: 0, selected: null, CREDITI: {}, console: {warn(){}},
    document: {querySelectorAll: () => []},
    $: key => { if (!elements.has(key)) elements.set(key, {textContent:'', style:{}, onclick:null}); return elements.get(key); },
    readStored: async key => { reads.push(key); return key === 'pilota' ? {arrayBuffer:async()=>new ArrayBuffer(1)} : null; },
    loader: {loadAsync: async url => { requests.push(url); return hangar; }, parseAsync: async () => { throw Error('invalid local GLB'); }},
    note() {}, clear() {}, place: g => placed.push(g), window: {},
  };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  await ctx.testOpenModel(model);
  assert.deepStrictEqual(reads, ['pilota-v2'], 'old pilot import masked the new one');
  assert.deepStrictEqual(requests, ['../assets/pilota-hangar-v2.glb']);
  assert.strictEqual(placed.length, 1, 'the current pilot was not displayed');
  ctx.readStored = async () => ({arrayBuffer: async () => new ArrayBuffer(1)});
  requests.length = 0; placed.length = 0;
  await ctx.testOpenModel(model);
  assert.strictEqual(requests[0], '../assets/pilota-hangar-v2.glb', 'invalid local pilot should fall back to current model');
  assert.strictEqual(placed.length, 1, 'fallback pilot was not displayed');
  console.log('PASS: compact hangar GLB, current pilot selection and fallback');
})().catch(err => { console.error(err); process.exitCode = 1; });
