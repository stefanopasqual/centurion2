#!/usr/bin/env python3
"""Install non-photographic aircraft-specific cockpit and HMD instrument views."""
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
src=root/"js"/"volo.js"
s=src.read_text(encoding="utf-8")
def patch(old,new):
 global s
 if old not in s: raise RuntimeError("Cockpit patch anchor not found: "+old[:100])
 s=s.replace(old,new,1)
patch('const CAMS = ["cockpit", "chase", "missile"];','const CAMS = ["cockpit", "helmet", "chase", "missile"];')
patch('chase: "CAMERA · ESTERNA", missile: "CAMERA · MISSILE"','helmet: "CAMERA · CASCO HMD", chase: "CAMERA · ESTERNA", missile: "CAMERA · MISSILE"')
patch('const vis = S.cam !== "cockpit" || !P.vivo;', 'const vis = !["cockpit","helmet"].includes(S.cam) || !P.vivo;')
patch('if (S.cam === "cockpit" && P.vivo) { camera.position.copy(P.pos)',
      'if ((S.cam === "cockpit" || S.cam === "helmet") && P.vivo) { camera.position.copy(P.pos)')
patch('camera.quaternion.copy(P.Q).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), Math.PI)); const sh',
      '''camera.quaternion.copy(P.Q).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), Math.PI));
      if (S.cam === "helmet") camera.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(S.lookPitch||0,S.lookYaw||0,0,"YXZ")));
      const sh''')
patch('camera.fov = mobile() ? 62 : 60;', 'camera.fov = S.cam === "helmet" ? 78 : (mobile() ? 62 : 60);')
patch('const ck = S.cam === "cockpit";', 'const ck = S.cam === "cockpit" || S.cam === "helmet";')
patch('else if (k === "n") nvg();',
      '''else if (k === "n") nvg();
    else if (k === "i") S.lookPitch=Math.max(-1.1,(S.lookPitch||0)+.11);
    else if (k === "k") S.lookPitch=Math.min(1.1,(S.lookPitch||0)-.11);
    else if (k === "j") S.lookYaw=Math.max(-2.1,(S.lookYaw||0)-.15);
    else if (k === "l") S.lookYaw=Math.min(2.1,(S.lookYaw||0)+.15);
    else if (k === "o") { S.lookYaw=0; S.lookPitch=0; }''')
patch('window.addEventListener("resize", ridimensiona);',
      '''if(window.CENTURION_COCKPIT) CENTURION_COCKPIT.attach(ov);
    window.addEventListener("resize", ridimensiona);''')
patch('hudC.width = w; hudC.height = h;', 'hudC.width = w; hudC.height = h; if(window.CENTURION_COCKPIT) CENTURION_COCKPIT.resize();')
patch('renderer.render(scene, camera); disegnaHud(); audioFrame(); aggiornaUi();',
      '''renderer.render(scene, camera); disegnaHud(); audioFrame(); aggiornaUi();
    if(window.CENTURION_COCKPIT){
      const p=S.pl; assi(p.Q);
      CENTURION_COCKPIT.draw(S.cam,S.cfg.aereo,{kt:p.V*KT,alt:p.pos.y*FT,
        mach:p.M,nz:p.nz,hdg:(Math.atan2(_fwd.x,-_fwd.z)*R2D+360)%360,
        fuel:p.fuel,gear:p.carrello});
    }''')
patch('let n = CAMS[(i + 1) % CAMS.length];','let n = CAMS[(i + 1) % CAMS.length];')
patch('<b>🎥</b> cockpit / esterna / missile','<b>🎥</b> cockpit strumentale / casco HMD / esterna / missile')
# Dedicated pilot-seat position; keep 3D interior geometry whenever available.
patch('const vis = !["cockpit","helmet"].includes(S.cam) || !P.vivo; if (P.obj) P.obj.visible = P.vivo && vis;',
      '''const inside = ["cockpit","helmet"].includes(S.cam) && P.vivo;
    const cockpitInfo = P.obj && window.CENTURION_COCKPIT
      ? CENTURION_COCKPIT.setView(P.obj,S.cfg.aereo,inside) : null;
    if(P.obj) P.obj.visible=P.vivo && (!inside || !!(cockpitInfo && cockpitInfo.hasInterior));''')
patch('camera.position.copy(P.pos).addScaledVector(_up, 1.1).addScaledVector(_fwd, 5.5);',
      '''const seat = P.obj && window.CENTURION_COCKPIT
        ? CENTURION_COCKPIT.cameraEye(P.obj,S.cfg.aereo) : null;
      camera.position.copy(seat || P.pos.clone().addScaledVector(_up,1.2).addScaledVector(_fwd,3.2));
      camera.near=0.055;''')
patch('// esterna stile videogioco: dietro e sopra, con inerzia; segue anche il rollio',
      '''camera.near=1;
    // esterna stile videogioco: dietro e sopra, con inerzia; segue anche il rollio''')
patch('fuel:p.fuel,gear:p.carrello});',
      '''fuel:p.fuel,gear:p.carrello,
        hasInterior:!!(p.obj && CENTURION_COCKPIT.inspect(p.obj,S.cfg.aereo)?.hasInterior)});''')
patch('else if (k === "o") { S.lookYaw=0; S.lookPitch=0; }',
      '''else if (k === "o") { S.lookYaw=0; S.lookPitch=0; }
    else if(k === "b" && window.CENTURION_COCKPIT) {
      const result=CENTURION_COCKPIT.diagnose(camera,S.pl.obj,S.cfg.aereo);
      window.CENTURION_POV_DEBUG=result;console.info("CENTURION POV",result);
      messaggio(result.ready ? (result.interior ? "POV 3D · "+result.interiorMeshes+" mesh · "+(result.obstruction?"OSTRUZIONE "+result.obstruction.meters+"m":"ORIZZONTE LIBERO") : "POV: INTERNO 3D ASSENTE") : "MODELLO NON ANCORA PRONTO",3);
    }''')
# Chase must be horizon-stabilized. The old interpolation camera.up<-aircraft.up
# made the entire view bank during a roll, making every chase view appear crooked.
patch('_cp.copy(P.pos).addScaledVector(_fwd, -24).addScaledVector(_up, 6); camera.position.lerp(_cp, Math.min(1, dt * 6)); _cu.lerp(_up, Math.min(1, dt * 3)).normalize(); camera.up.copy(_cu); camera.lookAt(V3().copy(P.pos).addScaledVector(_fwd, 25));',
      '''_cp.copy(P.pos).addScaledVector(_fwd, -28).add(V3(0, 8, 0));
    camera.position.lerp(_cp, Math.min(1, dt * 5));
    camera.up.set(0, 1, 0); // stable world horizon: aircraft may bank, camera does not
    camera.lookAt(V3().copy(P.pos).addScaledVector(_fwd, 20).add(V3(0, 2, 0)));''')
src.write_text(s,encoding="utf-8")
index=root/"index.html"
html=index.read_text(encoding="utf-8")
tag='<script src="js/cockpit.js"></script>'
if tag not in html:
 if '<script src="js/volo.js"></script>' not in html:raise RuntimeError("volo script anchor missing")
 html=html.replace('<script src="js/volo.js"></script>',tag+'\n<script src="js/volo.js"></script>',1)
 index.write_text(html,encoding="utf-8")
dest=root/"js"/"cockpit.js"
dest.write_bytes(Path(__file__).with_name("cockpit.js").read_bytes())
print("CENTURION2 cockpit: F16 F15 F2000 F22 SU35 SU57 EA18, helmet HMD view installed")
