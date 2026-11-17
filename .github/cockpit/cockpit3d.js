/* CENTURION 2 - procedural 3D cockpit shell.
   The Sketchfab GLBs have no cockpit interior: without this the cockpit view showed only sky.
   Approximate, aircraft-flavoured geometry (not an authentic replica): glareshield, instrument
   panel with live multifunction displays, HUD combiner, canopy frame and side consoles.
   Shown only when the loaded model has no interior of its own. Loaded after cockpit.js. */
(() => {
  const C = window.CENTURION_COCKPIT;
  if (!C || typeof THREE === "undefined") return;
  // style per aircraft: panel colour, number of displays, windscreen posts (false = bubble canopy)
  const STYLE = {
    F16:  { panel: 0x2b3036, mfd: 2, posts: false, bow: true },
    F15:  { panel: 0x30353b, mfd: 3, posts: true,  bow: true },
    F2000:{ panel: 0x2a2f35, mfd: 3, posts: true,  bow: true },
    F22:  { panel: 0x26292d, mfd: 3, posts: true,  bow: false },
    SU57: { panel: 0x2f3a3f, mfd: 2, posts: true,  bow: true },
    SU35: { panel: 0x3a4a52, mfd: 2, posts: true,  bow: true },
    EA18: { panel: 0x30353a, mfd: 3, posts: true,  bow: true }
  };
  const shells = new WeakMap();

  function mfdCanvas() { const c = document.createElement("canvas"); c.width = c.height = 256; return c; }

  function build(type) {
    const st = STYLE[type] || STYLE.F16, prof = (C.profiles && C.profiles[type]) || {};
    const accent = prof.accent || "#7dffb0", labels = prof.labels || ["RADAR", "NAV", "SYS"];
    const dark = new THREE.MeshStandardMaterial({ color: st.panel, roughness: 0.85, metalness: 0.1 });
    const matte = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.95, metalness: 0 });
    const frameM = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.6, metalness: 0.3 });
    // pilot frame: eye at origin, forward -Z, up +Y, right +X
    const pilot = new THREE.Group(); pilot.name = "cockpit3d_pilot";
    const add = (geo, mat, x, y, z, rx) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rx) m.rotation.x = rx; pilot.add(m); return m; };
    // instrument panel (tilted back) and glareshield coaming
    add(new THREE.BoxGeometry(0.92, 0.34, 0.04), dark, 0, -0.33, -0.66, -0.32);
    add(new THREE.BoxGeometry(0.96, 0.035, 0.24), matte, 0, -0.185, -0.72);
    const lip = add(new THREE.CylinderGeometry(0.018, 0.018, 0.96, 10), matte, 0, -0.17, -0.605); lip.rotation.z = Math.PI / 2;
    // multifunction displays with live canvas textures
    const screens = [], n = st.mfd, w = 0.15, gap = 0.035, x0 = -((n - 1) * (w + gap)) / 2;
    for (let i = 0; i < n; i++) {
      const cv = mfdCanvas(), tex = new THREE.CanvasTexture(cv);
      if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
      const bezel = add(new THREE.BoxGeometry(w + 0.03, w + 0.03, 0.02), frameM, x0 + i * (w + gap), -0.29, -0.632, -0.32);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      scr.position.set(0, 0, 0.0115); bezel.add(scr);
      screens.push({ cv, tex, label: labels[i % labels.length], idx: i });
    }
    // HUD combiner: thin frame + faint glass above the coaming
    const hud = new THREE.Group(); hud.position.set(0, -0.13, -0.66); hud.rotation.x = -0.18; pilot.add(hud);
    [[-0.075, 0, 0.006, 0.07], [0.075, 0, 0.006, 0.07]].forEach(([x, y, a, h]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(a, h, a), frameM); p.position.set(x, y, 0); hud.add(p); });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.08), new THREE.MeshBasicMaterial({ color: 0x9fe8c8, transparent: true, opacity: 0.07, depthWrite: false }));
    hud.add(glass);
    // canopy: windscreen posts and front bow (bubble canopies have no posts)
    const tube = (a, b, r) => { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), frameM); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); pilot.add(m); };
    if (st.posts) {
      tube(new THREE.Vector3(-0.56, -0.17, -0.66), new THREE.Vector3(-0.40, 0.36, -0.02), 0.013);
      tube(new THREE.Vector3(0.56, -0.17, -0.66), new THREE.Vector3(0.40, 0.36, -0.02), 0.013);
    }
    if (st.bow) {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.013, 8, 24, Math.PI), frameM);
      bow.position.set(0, -0.06, st.posts ? -0.02 : 0.15); pilot.add(bow);
    }
    // side consoles and canopy sills
    [-1, 1].forEach(s => {
      add(new THREE.BoxGeometry(0.2, 0.08, 0.7), dark, s * 0.42, -0.5, -0.1);
      add(new THREE.BoxGeometry(0.05, 0.05, 1.2), matte, s * 0.5, -0.28, 0.05);
      for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.035, 0.012, 0.035), new THREE.MeshBasicMaterial({ color: k % 2 ? 0x7dffb0 : 0xffc06b }), s * (0.38 + (k % 2) * 0.06), -0.455, -0.3 + k * 0.08);
    });
    // aircraft frame: the model has nose +Z / up +Y, the camera is the pilot frame turned 180° on Y
    const root = new THREE.Group(); root.name = "cockpit3d"; root.rotation.y = Math.PI; root.add(pilot);
    root.userData = { screens, accent, frame: 0 };
    return root;
  }

  function shellFor(obj, type) {
    let s = shells.get(obj);
    if (!s || s.userData.type !== type) {
      if (s && s.parent) s.parent.remove(s);
      s = build(type); s.userData.type = type; shells.set(obj, s); obj.add(s);
    }
    const eye = (C.eyes && C.eyes[type]) || [0, 1.13, 3.1];
    const d = C.inspect(obj, type);
    s.position.copy(d ? d.eye : new THREE.Vector3(...eye));
    return s;
  }

  const fmt = (v, n = 0) => Number.isFinite(v) ? v.toFixed(n) : "--";
  function paint(sc, data, accent) {
    const g = sc.cv.getContext("2d"), W = 256;
    g.fillStyle = "#040a08"; g.fillRect(0, 0, W, W);
    g.strokeStyle = "rgba(90,255,160,.18)"; g.lineWidth = 1;
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, i * W / 6); g.lineTo(W, i * W / 6); g.stroke(); }
    g.fillStyle = accent; g.font = "bold 20px monospace"; g.textAlign = "center"; g.fillText(sc.label, W / 2, 26);
    g.font = "bold 24px monospace";
    if (sc.idx === 0) {
      g.strokeStyle = accent; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, 140, 78, 0, Math.PI * 2); g.stroke();
      const a = (data.hdg || 0) * Math.PI / 180;
      for (let k = 0; k < 12; k++) { const b = k * Math.PI / 6 - a; g.beginPath(); g.moveTo(W / 2 + Math.sin(b) * 70, 140 - Math.cos(b) * 70); g.lineTo(W / 2 + Math.sin(b) * 78, 140 - Math.cos(b) * 78); g.stroke(); }
      g.fillStyle = accent; g.fillText("N", W / 2 + Math.sin(-a) * 56, 148 - Math.cos(-a) * 56);
      g.beginPath(); g.moveTo(W / 2, 128); g.lineTo(W / 2 - 9, 152); g.lineTo(W / 2 + 9, 152); g.closePath(); g.fill();
      g.fillText(fmt(data.hdg) + "°", W / 2, 244);
    } else if (sc.idx === 1) {
      g.textAlign = "left"; g.fillStyle = accent;
      [["TAS", fmt(data.kt) + " KT"], ["ALT", fmt(data.alt) + " FT"], ["MACH", fmt(data.mach, 2)], ["G", fmt(data.nz, 1)]].forEach(([k, v], i) => { g.fillText(k, 18, 78 + i * 46); g.textAlign = "right"; g.fillText(v, 238, 78 + i * 46); g.textAlign = "left"; });
    } else {
      g.textAlign = "left"; g.fillStyle = accent;
      g.fillText("FUEL", 18, 80); g.textAlign = "right"; g.fillText(fmt(data.fuel) + " KG", 238, 80);
      const f = Math.max(0, Math.min(1, (data.fuel || 0) / 9000)); g.strokeStyle = accent; g.strokeRect(18, 100, 220, 26); g.fillRect(20, 102, 216 * f, 22);
      g.textAlign = "left"; g.fillStyle = data.gear ? "#ffbf7c" : accent; g.fillText("GEAR", 18, 180); g.textAlign = "right"; g.fillText(data.gear ? "DOWN" : "UP", 238, 180);
    }
    sc.tex.needsUpdate = true;
  }

  const origSetView = C.setView, origDraw = C.draw;
  C.setView = function (root, type, inside) {
    const d = origSetView.call(C, root, type, inside);
    if (!root) return d;
    const real = !!(d && d.hasInterior);
    const s = shellFor(root, type);
    s.visible = inside && !real;
    if (inside && !real) {
      // no interior in the model: keep the aircraft group visible but show only the shell
      root.visible = true;
      root.children.forEach(c => { if (c !== s) c.visible = false; });
      return Object.assign({}, d || {}, { hasInterior: true, shell: true });
    }
    root.children.forEach(c => { if (c !== s) c.visible = true; });
    return d;
  };
  C.draw = function (mode, aircraft, data) {
    if (mode === "helmet") {
      // the flight HUD of volo.js already shows speed/altitude/heading: draw only the visor rim
      origDraw.call(C, "chase", aircraft, data);
    } else if (mode !== "cockpit") {
      origDraw.call(C, mode, aircraft, data);
    } else {
      origDraw.call(C, "chase", aircraft, data); // clears the overlay, no "3D not available" text
    }
    if ((mode === "cockpit" || mode === "helmet") && data && typeof VOLO !== "undefined" && VOLO.stato && VOLO.stato.pl) {
      const s = shells.get(VOLO.stato.pl.obj);
      if (s && s.visible && (s.userData.frame++ % 4 === 0)) s.userData.screens.forEach(sc => paint(sc, data, s.userData.accent));
    }
  };
})();
