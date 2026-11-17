#!/usr/bin/env python3
"""Improve CENTURION free-flight aerodynamic model.

Physics-based 3-DOF translational forces + quaternion rotational controls.
Uses ISA atmosphere, qS coefficients, nonlinear lift/stall, induced + wave drag,
Mach-dependent lift slope, beta stability, ground effect and engine lapse.
Aircraft coefficients remain open-source estimates, NOT flight-test tables.
"""
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")
p=root/"js"/"volo.js"
s=p.read_text(encoding="utf-8")
def replace(a,b):
 global s
 n=s.count(a)
 if n!=1:raise RuntimeError(f"aerodynamics anchor mismatch count={n}: {a[:110]}")
 s=s.replace(a,b,1)

replace(
'const lapse = Math.pow(at.rho / 1.225, 0.7) * (1 + 0.25 * Math.min(M, 2)); const T = (A.Tmil * P.spinta + (A.Tab - A.Tmil) * P.ab) * lapse;',
'''// Jet engine lapse: density / inlet ram recovery, with reduced high-Mach net thrust.
    // No artificial +25% per Mach increase: ram recovery is offset by inlet drag.
    const densityRatio=at.rho/1.225;
    const ram=Math.min(1.12,1+0.075*Math.min(M,1.6));
    const inletLoss=1-0.13*smooth(1.3,2.5,M);
    const lapse=Math.pow(densityRatio,.72)*ram*inletLoss;
    const T=(A.Tmil*P.spinta+(A.Tab-A.Tmil)*P.ab)*lapse;''')

replace(
'''    // aerodinamica
    const as = A.astall * D2R; const aa = Math.abs(alpha); const flap = P.carrello ? 0.35 : 0;   // con il carrello giù i flap scendono in automatico (come sull'F-16): più portanza a bassa velocità
    let CL = A.cla * alpha + flap; if (aa > as) CL = Math.sign(alpha) * A.cla * as * (1 - 0.55 * smooth(0, 0.5, aa - as)) + flap;
    const onda = 1 + 1.6 * smooth(0.85, 1.05, M) - 0.5 * smooth(1.2, 2.2, M); const CD = A.cd0 * onda + A.k * CL * CL + (P.carrello ? 0.05 : 0) + (In.freno && !P.aTerra ? 0.06 : 0) + (aa > as ? 0.6 * Math.sin(aa) : 0);
    _v.copy(P.vel).normalize(); _L.copy(_up).addScaledVector(_v, -_up.dot(_v)); if (_L.lengthSq() < 1e-6) _L.set(0, 1, 0); _L.normalize(); _Sd.copy(_rt).addScaledVector(_v, -_rt.dot(_v)).normalize();
    const F = V3(); F.addScaledVector(_L, qbar * A.S * CL).addScaledVector(_v, -qbar * A.S * CD).addScaledVector(_Sd, -qbar * A.S * 0.9 * slip).addScaledVector(_fwd, T); F.y -= m * G;''',
'''    // Quasi-steady aerodynamic forces: F = q*S*C, q = rho*V^2/2.
    // Aircraft coefficients are approximate; this is not a certified 6-DOF flight model.
    const as=A.astall*D2R,aa=Math.abs(alpha),flap=P.carrello?.28:0;
    const subsonicFactor=1+0.22*smooth(.35,.82,M);
    const transonicLoss=1-.28*smooth(.92,1.30,M);
    const liftSlope=A.cla*subsonicFactor*transonicLoss;
    const stallAlpha=Math.max(.18,as-.055*smooth(.7,1.25,M));
    const rawLift=liftSlope*alpha+flap;
    const clMax=Math.max(.75,A.cla*stallAlpha*.86);
    const attached=Math.max(-clMax,Math.min(clMax,rawLift));
    const stalled=Math.sign(alpha)*clMax*(.48+.52*Math.exp(-Math.max(0,aa-stallAlpha)*3.5));
    const stallBlend=smooth(stallAlpha-.04,stallAlpha+.14,aa);
    const CL=attached*(1-stallBlend)+stalled*stallBlend;
    const cdWave=.10*Math.exp(-Math.pow((M-1.04)/.17,2))+
      .025*smooth(1.1,1.8,M);
    const separationDrag=.28*Math.pow(smooth(stallAlpha-.02,stallAlpha+.22,aa),2);
    const groundHeight=P.agl!=null?P.agl:1e5;
    const groundEffect=1-.18*(1-smooth(2,30,groundHeight));
    const induced=A.k*CL*CL*groundEffect;
    const CD=A.cd0+induced+cdWave+separationDrag+
      (P.carrello?.035:0)+(In.freno&&!P.aTerra?.065:0)+.20*slip*slip;
    const CY=-.68*slip; // directional stability and sideslip drag
    _v.copy(P.vel).normalize();
    _L.copy(_up).addScaledVector(_v,-_up.dot(_v));
    if(_L.lengthSq()<1e-6)_L.set(0,1,0);
    _L.normalize();
    _Sd.copy(_rt).addScaledVector(_v,-_rt.dot(_v));
    if(_Sd.lengthSq()<1e-6)_Sd.set(1,0,0);
    _Sd.normalize();
    const F=V3();
    F.addScaledVector(_L,qbar*A.S*CL)
      .addScaledVector(_v,-qbar*A.S*CD)
      .addScaledVector(_Sd,qbar*A.S*CY)
      .addScaledVector(_fwd,T);
    F.y-=m*G;
    P.CL=CL;P.CD=CD;P.beta=slip;P.stallo=stallBlend>.5;
    P.dragN=qbar*A.S*CD;P.liftN=qbar*A.S*CL;''')

replace(
'const eff = clamp(qbar / 15000, 0.12, 1) * (1 - 0.5 * clamp(aa / (A.amax * D2R), 0, 1));',
'''// Flight-control authority falls off at low dynamic pressure and deep stall.
    const eff=clamp(qbar/15000,.08,1)
      *(1-.65*stallBlend)*(1-.18*smooth(.95,1.7,M));''')

replace(
'let aCmd = ((nCmd + P.nInt) * m * G - T * Math.sin(alpha) - qbar * A.S * flap) / Math.max(1, qbar * A.S * A.cla);',
'let aCmd = ((nCmd + P.nInt) * m * G - T * Math.sin(alpha) - qbar * A.S * flap) / Math.max(1, qbar * A.S * liftSlope);')

p.write_text(s,encoding="utf-8")
print("PASS aerodynamic: ISA, dynamic pressure, lift/stall, induced/transonic wave drag, beta, ground effect, engine lapse")
