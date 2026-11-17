#!/usr/bin/env python3
"""Upgrade CENTURION Free Flight VFX without replacing aircraft physics."""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "extracted/site")
p = root / "js" / "volo.js"
s = p.read_text(encoding="utf-8")
def change(old, new):
    global s
    if old not in s:
        raise RuntimeError("VFX patch anchor changed: " + old[:110])
    s = s.replace(old, new, 1)

# Multi-phase detonation: a light shock shell, hot fragments and staggered secondary blooms.
change('fx.geoDet = new THREE.BoxGeometry(1, 0.22, 0.7);',
       'fx.bursts = []; fx.geoDet = new THREE.BoxGeometry(1, 0.22, 0.7);')
fx = r'''
  // Reusable cinematic VFX; no timeouts, bounded state and scene cleanup.
  function vfxShock(pos, strength, ground) {
    const fx = S && S.fx; if (!fx) return;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.89, 1, mobile() ? 24 : 48),
      new THREE.MeshBasicMaterial({color:ground ? 0xffc081 : 0xfff2d2,
        side:THREE.DoubleSide, transparent:true, opacity:0.45, depthWrite:false,
        blending:THREE.AdditiveBlending})
    );
    ring.position.copy(pos);
    if (ground) ring.rotation.x = -Math.PI / 2;
    else ring.quaternion.copy(camera.quaternion);
    scene.add(ring);
    fx.anelli.push({m:ring,t:0,dur:ground ? 1.0 : 0.46,r:strength*(ground?90:55)});
    if (fx.anelli.length > 14) {
      const old = fx.anelli.shift();
      scene.remove(old.m);old.m.geometry.dispose();old.m.material.dispose();
    }
  }
  function vfxSecondary(pos, vel, k) {
    const fx=S && S.fx;if(!fx)return;
    fx.bursts.push({pos:pos.clone(),vel:vel.clone(),k,t:0,delay:0.17,remaining:mobile()?2:4});
    if(fx.bursts.length>6)fx.bursts.shift();
  }
  function vfxTick(dt) {
    const fx=S && S.fx; if(!fx)return;
    fx.bursts=fx.bursts.filter(b=>{
      b.t+=dt;
      if(b.t>=b.delay&&b.remaining>0){
        b.t=0;b.remaining--;
        const p=b.pos.clone().addScaledVector(b.vel,b.delay*(mobile()?1.2:1.8))
          .add(rndDir(0.1).multiplyScalar((3+Math.random()*9)*b.k));
        b.pos.copy(p);
        const n=mobile()?4:8;
        for(let i=0;i<n;i++) emetti(p,{
          luce:true,col:i%3===0?0xfff1bf:i%2?0xff8b27:0xffc456,
          vel:rndDir(0.15).multiplyScalar((12+Math.random()*35)*b.k).addScaledVector(b.vel,.15),
          vita:.3+Math.random()*.5,s0:5*b.k,s1:18*b.k,a0:.9,drag:2
        });
        emetti(p,{col:0x25211f,vel:b.vel.clone().multiplyScalar(.09),
          vita:2.5,s0:12*b.k,s1:36*b.k,a0:.55,drag:.6,su:2});
      }
      return b.remaining>0;
    });
  }
'''
anchor = '  function flashLuce(pos, i, dur) {'
change(anchor, fx + anchor)
change('    detriti(pos, vel || V3(), Math.round(7 * k), true);',
       '    vfxShock(pos, k, false); vfxSecondary(pos, vel || V3(), k);\n    detriti(pos, vel || V3(), Math.round(7 * k), true);')
change('    detriti(p, V3(0, 45 * k, 0), Math.round(10 * k), true);',
       '    vfxShock(p, k, true); vfxSecondary(p, V3(0, 12, 0), k * 0.7);\n    detriti(p, V3(0, 45 * k, 0), Math.round(10 * k), true);')
change('    fx.lampo *= Math.exp(-dt * 2.2);',
       '    fx.lampo *= Math.exp(-dt * 2.2); vfxTick(dt);')

# The canopy is not an opaque glass sphere: give it an aerodynamic blister and a metal lip.
old = 'tet.scale.set(0.75, 0.55, 2.1);'
new = '''tet.scale.set(0.74, 0.64, 2.25);
    const tetLip = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.045, 6, 20),
      new THREE.MeshStandardMaterial({color:0x778994,metalness:.65,roughness:.38}));
    tetLip.scale.set(1, 2.2, 1);tetLip.rotation.x=Math.PI/2;tet.add(tetLip);'''
change(old, new)

# Improve pilot silhouette with a strapped-in seat, headrest, shoulder harness and rocket base.
change('seg.add(pil);',
'''seg.add(pil);
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(.52,.34,.16),matStd(0x1a222a));
    headrest.position.set(0,1.18,-.31);seg.add(headrest);
    const harnessMat = new THREE.MeshStandardMaterial({color:0xbab39c,roughness:.85});
    for(const side of [-1,1]){
      const belt=new THREE.Mesh(new THREE.BoxGeometry(.075,.8,.045),harnessMat);
      belt.position.set(side*.17,.73,.28);belt.rotation.z=side*.16;seg.add(belt);
      const rail=new THREE.Mesh(new THREE.BoxGeometry(.09,1.35,.11),matStd(0x4b555c));
      rail.position.set(side*.31,.30,-.42);seg.add(rail);
    }
    const rocket=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,.52,10),matStd(0x616d74));
    rocket.position.set(0,-.61,-.27);seg.add(rocket);''')
# The existing trail emits one flame plus one puff; add sparks and a denser plume.
change('emetti(coda, { col: 0xcfcac2, vel: E.su.clone().multiplyScalar(-10), vita: 2.5, s0: 1.5, s1: 10, a0: 0.6, drag: 1 });',
'''emetti(coda, { col: 0xcfcac2, vel: E.su.clone().multiplyScalar(-10), vita: 2.5, s0: 1.5, s1: 10, a0: 0.6, drag: 1 });
      emetti(coda,{luce:true,col:0xfff3c1,vel:E.su.clone().multiplyScalar(-65)
        .add(rndDir().multiplyScalar(13)),vita:.25,s0:1.4,s1:.22,a0:1,drag:1});
      if(!mobile() || Math.random()>.4)emetti(coda,{col:0xe3d9c7,
        vel:E.su.clone().multiplyScalar(-15).add(rndDir().multiplyScalar(5)),
        vita:2.1,s0:2.7,s1:13,a0:.68,drag:.6,su:2});''')
# Make opening visibly staggered and keep the player in an unhurried cinematic sequence.
change('if (E.t > 1.8) { // separazione dal seggiolino e apertura del paracadute',
       'if (E.t > 2.3) { // separazione dal seggiolino e apertura del paracadute')
change('const k = Math.min(1, (E.t - E.tApre) / 1.1);',
       'const k = Math.min(1, (E.t - E.tApre) / 1.65);')
# Distinct cache key for installed mobile apps.
p.write_text(s, encoding="utf-8")
print("VFX v18 patched: shockwave, staggered detonations, canopy frame, seat/harness, rocket exhaust.")
