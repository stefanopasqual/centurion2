// Exercise the actual GLB and the site's bundled Three.js without WebGL.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const site = path.resolve(process.argv[2]);
const THREE = global.THREE = require(path.join(site, 'vendor/three.min.js'));
global.self = global; global.window = global;
let nextFrame = null;
global.requestAnimationFrame = cb => { nextFrame = cb; return 0; };
require(path.join(site, 'vendor/GLTFLoader.js'));
const data = fs.readFileSync(path.join(site, 'assets/pilota.glb'));
const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
new THREE.GLTFLoader().parse(bytes, '', async gltf => {
  try {
    let skins = 0; gltf.scene.traverse(o => { if (o.isSkinnedMesh) skins++; }); assert(skins > 0);
    THREE.GLTFLoader.prototype.load = (url, onLoad) => { assert.equal(url, 'assets/pilota.glb'); onLoad(gltf); };
    require(path.join(site, 'js/pilota3d.js'));
    assert(await PILOTA3D.carica());
    const a = new THREE.Group(), b = new THREE.Group(); a.add(new THREE.Object3D()); b.add(new THREE.Object3D());
    assert(PILOTA3D.veste(a)); assert(PILOTA3D.veste(b));
    const ja = a.userData.p3d.userData.pilotBones, jb = b.userData.p3d.userData.pilotBones;
    assert.notStrictEqual(ja.thigh_L.bone, jb.thigh_L.bone, 'pilots must not share bones');
    const rest = ja.thigh_L.bone.quaternion.clone(), other = jb.thigh_L.bone.quaternion.clone();
    PILOTA3D.posa(a, 'seduto', 0);
    assert(ja.thigh_L.bone.quaternion.angleTo(rest) > .5, 'seated pose must bend the hips');
    assert(jb.thigh_L.bone.quaternion.angleTo(other) < 1e-6, 'another pilot moved');
    assert(a.userData.p3d.visible && !a.userData.p3dOrig[0].visible, 'old figure was not hidden');
    PILOTA3D.posa(a, 'corsa', .25); assert(ja.thigh_L.bone.quaternion.angleTo(rest) > .3);
    PILOTA3D.posa(a, 'appeso', 0); assert(ja.upperarm_L.bone.quaternion.angleTo(ja.upperarm_L.rest) > 1);
    PILOTA3D.posa(a, 'rannicchiato', 0); assert(ja.shin_L.bone.quaternion.angleTo(ja.shin_L.rest) > 1);
    // Exercise the real free-flight ejection observer through seat, parachute
    // and landing; the previous procedural mesh must be hidden in every phase.
    const eject = new THREE.Group(); eject.add(new THREE.Object3D());
    global.VOLO = {stato: {eiez: {pil:eject, fase:'seggiolino', t:0}}};
    await Promise.resolve(); assert(nextFrame, 'ejection observer did not start');
    nextFrame(); assert(eject.userData.p3d && !eject.userData.p3dOrig[0].visible);
    const ej = eject.userData.p3d.userData.pilotBones;
    assert(ej.thigh_L.bone.quaternion.angleTo(ej.thigh_L.rest) > .5, 'seat pose not applied');
    VOLO.stato.eiez.fase = 'paracadute'; nextFrame();
    assert(ej.upperarm_L.bone.quaternion.angleTo(ej.upperarm_L.rest) > 1, 'parachute pose not applied');
    VOLO.stato.eiez.fase = 'a terra'; nextFrame();
    assert(ej.shin_L.bone.quaternion.angleTo(ej.shin_L.rest) > 1, 'landing pose not applied');
    vm.runInThisContext(fs.readFileSync(path.join(site, 'js/soccorso.js'), 'utf8') + '\nglobalThis.TEST_SOCCORSO = SOCCORSO;');
    const p = TEST_SOCCORSO._persona({nome: 'LUPO 21'}); assert(PILOTA3D.veste(p));
    TEST_SOCCORSO._posa(p, 'seduto', 0);
    assert(p.userData.p3d.visible && !p.userData.p3dOrig[0].visible);
    assert(p.userData.p3d.userData.pilotBones.thigh_L.bone.quaternion.angleTo(p.userData.p3d.userData.pilotBones.thigh_L.rest) > .5);
    console.log('PASS: pilot GLB, independent skeletons, rescue and ejection poses');
  } catch (e) { console.error(e); process.exitCode = 1; }
}, e => { console.error(e); process.exitCode = 1; });
