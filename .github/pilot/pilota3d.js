/* CENTURION2: pilot supplied by the owner, converted from OBJ and rigged.
   The source archive did not include its referenced textures. Materials were
   reconstructed and geometry was optimized for mobile. */
window.PILOTA3D = (() => {
  const URL = "assets/pilota.glb", ALTEZZA = 1.78;
  const BONES = ["root", "spine", "head", "thigh_L", "thigh_R", "shin_L", "shin_R", "foot_L", "foot_R", "upperarm_L", "upperarm_R", "forearm_L", "forearm_R"];
  let base = null, prom = null;
  function carica() {
    if (prom) return prom;
    prom = new Promise(ok => {
      const leggi = () => {
        try {
          new THREE.GLTFLoader().load(URL, g => {
            const s = g.scene, b = new THREE.Box3().setFromObject(s), dim = b.getSize(new THREE.Vector3());
            if (!Number.isFinite(dim.y) || dim.y < 0.01) { ok(null); return; }
            s.scale.multiplyScalar(ALTEZZA / dim.y); s.updateMatrixWorld(true);
            const b2 = new THREE.Box3().setFromObject(s), c = b2.getCenter(new THREE.Vector3());
            s.position.x -= c.x; s.position.z -= c.z; s.position.y -= b2.min.y;
            s.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.raycast = () => {}; } });
            const w = new THREE.Group(); w.name = "PILOTA3D"; w.add(s); base = w; ok(w);
          }, undefined, () => ok(null));
        } catch (e) { ok(null); }
      };
      if (typeof THREE === "undefined") { ok(null); return; }
      if (THREE.GLTFLoader) leggi();
      else { const sc = document.createElement("script"); sc.src = "vendor/GLTFLoader.js"; sc.onload = leggi; sc.onerror = () => ok(null); document.head.appendChild(sc); }
    });
    return prom;
  }
  // Each person needs its own bones, while immutable geometry stays shared.
  function copiaRig(source) {
    const target = source.clone(true), sourceOf = new Map(), copyOf = new Map();
    function pair(a, b) { sourceOf.set(b, a); copyOf.set(a, b); for (let i = 0; i < a.children.length; i++) pair(a.children[i], b.children[i]); }
    pair(source, target);
    target.traverse(o => {
      if (!o.isSkinnedMesh) return;
      const original = sourceOf.get(o), skeleton = original.skeleton.clone();
      skeleton.bones = original.skeleton.bones.map(bone => copyOf.get(bone));
      if (skeleton.bones.some(bone => !bone)) throw new Error("Scheletro pilota incompleto");
      o.bindMatrix.copy(original.bindMatrix); o.bind(skeleton, o.bindMatrix);
    });
    target.userData.pilotBones = {};
    BONES.forEach(name => { const bone = target.getObjectByName(name); if (bone && bone.isBone) target.userData.pilotBones[name] = { bone, rest: bone.quaternion.clone() }; });
    return target;
  }
  const nuovo = () => { if (!base) return null; try { return copiaRig(base); } catch (e) { console.warn("Pilota 3D:", e); return null; } };
  function veste(g, opz) {
    if (!g || g.userData.p3d) return !!(g && g.userData.p3d);
    const p = nuovo(); if (!p || !p.userData.pilotBones.spine || !p.userData.pilotBones.thigh_L || !p.userData.pilotBones.thigh_R) return false;
    opz = opz || {}; const orig = g.children.slice(); orig.forEach(o => { o.visible = false; });
    if (opz.scala) p.scale.setScalar(opz.scala);
    if (opz.y != null) p.position.y = opz.y; if (opz.z != null) p.position.z = opz.z; if (opz.x != null) p.position.x = opz.x;
    if (opz.yaw) p.rotation.y = opz.yaw;
    p.userData.poseBaseY = p.position.y; g.add(p); g.userData.p3d = p; g.userData.p3dOrig = orig;
    if (opz.posa) posa(g, opz.posa, 0);
    return true;
  }
  function posa(g, nome, k) {
    const p = g && g.userData.p3d; if (!p) return;
    const j = p.userData.pilotBones, sw = Math.sin((Number(k) || 0) * Math.PI * 2), angles = {};
    const set = (name, x = 0, y = 0, z = 0) => { angles[name] = [x, y, z]; };
    let drop = 0;
    if (nome === "cammina" || nome === "corsa") {
      const a = nome === "corsa" ? .65 : .42;
      set("thigh_L", -sw*a); set("thigh_R", sw*a);
      set("shin_L", Math.max(0,sw)*a*.8); set("shin_R", Math.max(0,-sw)*a*.8);
      set("upperarm_L", sw*a*.6); set("upperarm_R", -sw*a*.6);
      set("forearm_L",-.18); set("forearm_R",-.18);
    } else if (nome === "rannicchiato") {
      ["L","R"].forEach(s => { set("thigh_"+s,-1.4); set("shin_"+s,1.8); set("upperarm_"+s,-.6); set("forearm_"+s,-.8); });
      set("spine",.28); drop=.35;
    } else if (nome === "seduto" || nome === "seggiolino") {
      ["L","R"].forEach(s => { set("thigh_"+s,-1.35); set("shin_"+s,1.35); set("upperarm_"+s,-.3); set("forearm_"+s,-.5); }); drop=.32;
    } else if (nome === "ginocchio" || nome === "cura") {
      set("thigh_L",-1.15); set("shin_L",1.25); set("thigh_R",.18); set("shin_R",1.55);
      set("upperarm_L",-.55); set("upperarm_R",-.55); set("forearm_L",-.6); set("forearm_R",-.6); set("spine",nome === "cura" ? .45 : .12); drop=.28;
    } else if (nome === "appeso") {
      set("upperarm_L",0,0,2.4); set("upperarm_R",0,0,-2.4); set("forearm_L",-.2); set("forearm_R",-.2); set("shin_L",.18); set("shin_R",.25);
    } else if (nome === "saluta_seduto") {
      ["L","R"].forEach(s => { set("thigh_"+s,-1.35); set("shin_"+s,1.35); });
      set("upperarm_L",0,0,2.25+.15*sw); set("forearm_L",-.5); drop=.32;
    } else if (nome === "saluta") {
      set("upperarm_L",0,0,2.25+.15*sw); set("forearm_L",-.5);
    } else if (nome === "sostenuto") {
      set("upperarm_L",0,0,1.0); set("upperarm_R",0,0,-1.0); set("thigh_L",-sw*.2); set("thigh_R",sw*.2);
    } else if (nome === "punta") {
      set("upperarm_L",-1.0); set("forearm_L",-.3); set("upperarm_R",-1.0); set("forearm_R",-.3);
    }
    const euler = new THREE.Euler(), delta = new THREE.Quaternion();
    BONES.forEach(name => { const item=j[name]; if (!item) return; const a=angles[name] || [0,0,0]; euler.set(a[0],a[1],a[2],"XYZ"); delta.setFromEuler(euler); item.bone.quaternion.copy(item.rest).multiply(delta); });
    p.position.y = (p.userData.poseBaseY || 0) - drop; p.visible = true; g.userData.p3dOrig.forEach(o => { o.visible = false; });
  }
  function sorveglia() {
    try {
      const V = typeof VOLO !== "undefined" ? VOLO : null, S = V && V.stato, E = S && S.eiez;
      if (E && E.pil) { if (!E.pil.userData.p3d) veste(E.pil); posa(E.pil, E.fase === "paracadute" ? "appeso" : E.fase === "a terra" ? "rannicchiato" : "seggiolino", E.t); }
    } catch (e) { console.warn("Pilota eiezione:", e); }
    requestAnimationFrame(sorveglia);
  }
  carica().then(m => { if (m) sorveglia(); });
  return { carica, nuovo, veste, posa, get pronto() { return !!base; } };
})();
