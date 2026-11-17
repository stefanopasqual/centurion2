#!/usr/bin/env python3
"""Wire testable, NASA-equation-inspired aerodynamic coefficients into Free Flight.

Engine remains a stable point-mass + attitude controller (NOT certified 6DOF).
Applies after free-flight drone/cockpit, texture, thermal and sonic patches.
"""
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
p=root/"js"/"volo.js"
s=p.read_text(encoding="utf-8")

def replace(old,new):
    global s
    count=s.count(old)
    if count!=1:
        raise RuntimeError(f"Aero v2 anchor count {count}: {old[:110]}")
    s=s.replace(old,new,1)

replace(
    'const lapse = Math.pow(at.rho / 1.225, 0.7) * (1 + 0.25 * Math.min(M, 2)); const T = (A.Tmil * P.spinta + (A.Tab - A.Tmil) * P.ab) * lapse;',
    '''// Density + inlet effects are evaluated by the same tested aero model.
    const aeroEngine=CENTURION_AERO.engine(A,at,M,P.spinta,P.ab);
    const lapse=aeroEngine.lapse,T=aeroEngine.thrust;'''
)

replace(
    '''    // aerodinamica
    const as = A.astall * D2R; const aa = Math.abs(alpha); const flap = P.carrello ? 0.35 : 0;   // con il carrello giù i flap scendono in automatico (come sull'F-16): più portanza a bassa velocità
    let CL = A.cla * alpha + flap; if (aa > as) CL = Math.sign(alpha) * A.cla * as * (1 - 0.55 * smooth(0, 0.5, aa - as)) + flap;
    const onda = 1 + 1.6 * smooth(0.85, 1.05, M) - 0.5 * smooth(1.2, 2.2, M); const CD = A.cd0 * onda + A.k * CL * CL + (P.carrello ? 0.05 : 0) + (In.freno && !P.aTerra ? 0.06 : 0) + (aa > as ? 0.6 * Math.sin(aa) : 0);
    _v.copy(P.vel).normalize(); _L.copy(_up).addScaledVector(_v, -_up.dot(_v)); if (_L.lengthSq() < 1e-6) _L.set(0, 1, 0); _L.normalize(); _Sd.copy(_rt).addScaledVector(_v, -_rt.dot(_v)).normalize();
    const F = V3(); F.addScaledVector(_L, qbar * A.S * CL).addScaledVector(_v, -qbar * A.S * CD).addScaledVector(_Sd, -qbar * A.S * 0.9 * slip).addScaledVector(_fwd, T); F.y -= m * G;''',
    '''    // Aerodynamic force components L=q*S*CL, D=q*S*CD, Y=q*S*CY.
    // The cockpit and controller still use the existing quaternion attitude loop.
    const aero=CENTURION_AERO.coefficients(A,{
      alpha,beta:slip,mach:M,qbar,agl:P.agl,gear:P.carrello,
      brake:In.freno&&!P.aTerra
    });
    const {CL,CD,CY,liftSlope,stallBlend}=aero;
    const flap=P.carrello?.23:0,aa=Math.abs(alpha);
    _v.copy(P.vel).normalize();
    _L.copy(_up).addScaledVector(_v,-_up.dot(_v));
    if(_L.lengthSq()<1e-6)_L.set(0,1,0);
    _L.normalize();
    _Sd.copy(_rt).addScaledVector(_v,-_rt.dot(_v));
    if(_Sd.lengthSq()<1e-6)_Sd.copy(_rt);
    _Sd.normalize();
    const F=V3();
    F.addScaledVector(_L,aero.liftN)
      .addScaledVector(_v,-aero.dragN)
      .addScaledVector(_Sd,qbar*A.S*CY)
      .addScaledVector(_fwd,T);
    F.y-=m*G;
    P.CL=CL;P.CD=CD;P.beta=slip;P.stallo=aero.stalled;
    P.dragN=aero.dragN;P.liftN=aero.liftN;P.waveDrag=aero.wave;'''
)

replace(
    'const eff = clamp(qbar / 15000, 0.12, 1) * (1 - 0.5 * clamp(aa / (A.amax * D2R), 0, 1));',
    '''// Damping of available control authority near stall and high Mach.
    const eff=clamp(qbar/15000,.08,1)
      *(1-.65*stallBlend)*(1-.18*smooth(.95,1.7,M));'''
)
replace(
    'let aCmd = ((nCmd + P.nInt) * m * G - T * Math.sin(alpha) - qbar * A.S * flap) / Math.max(1, qbar * A.S * A.cla);',
    'let aCmd = ((nCmd + P.nInt) * m * G - T * Math.sin(alpha) - qbar * A.S * flap) / Math.max(1, qbar * A.S * liftSlope);'
)

replace(
    '''    const Lift = qbar * A.S * (A.cla * pitch + (P.carrello ? 0.35 : 0)); const W = m * G; const mu = (In.freno ? 0.45 : 0.025) * Math.max(0, W - Lift); const D = qbar * A.S * (A.cd0 + A.k * Math.pow(A.cla * pitch, 2) + (P.carrello ? 0.03 : 0));''',
    '''    const groundAero=CENTURION_AERO.coefficients(A,{
      alpha:pitch,beta:0,mach:V/isa(P.pos.y).a,qbar,
      agl:Math.max(0,P.pos.y-quotaSuolo(P.pos.x,P.pos.z)),
      gear:P.carrello,brake:!!In.freno
    });
    const Lift=groundAero.liftN,W=m*G;
    const mu=(In.freno?.45:.025)*Math.max(0,W-Lift);
    const D=groundAero.dragN;'''
)

p.write_text(s,encoding="utf-8")
print("PASS: coherent aerodynamic force coefficients in flight and runway physics")
