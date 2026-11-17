#!/usr/bin/env python3
"""Enable simulated thermal FPV on night-time UAVs in mission Mondo3D and Free Flight.

Run after drone mission, cockpit, freeflight and terrain build patches.
This is not physically calibrated LWIR temperature sensing. It is GPU
post-processed artificial intensity with white-hot / black-hot choices.
"""
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else "extracted/site")

def patch(rel,old,new):
    p=root/rel;s=p.read_text(encoding="utf-8")
    n=s.count(old)
    if n!=1:
        raise RuntimeError(f"{rel}: thermal anchor count={n}: {old[:110]}")
    p.write_text(s.replace(old,new,1),encoding="utf-8")

# Mondo3D: button in existing native toolbar (touch + mouse + keyboard).
patch("js/mondo3d.js",
      'overlay.querySelector("#m3d-nvgb").onclick = () => nvg();',
      '''overlay.querySelector("#m3d-nvgb").onclick = () => nvg();
    const irButton=document.createElement("button");
    irButton.id="m3d-thermal";
    irButton.textContent="IR OFF";
    irButton.title="Camera termica simulata UAV in notturna · U: OFF / WHITE HOT / BLACK HOT";
    irButton.style.cssText="display:none;min-height:40px;background:#253b47;color:#f1f5f7;border:1px solid #7a94a4;border-radius:7px;padding:8px 10px;font:700 12px system-ui";
    irButton.onclick=()=>toggleThermal();
    overlay.querySelector("#m3d-nvgb").insertAdjacentElement("afterend",irButton);''')

# Identify the selected drone using scenario IDs, so all UAV types are supported,
# including Geran and original procedural aircraft, but not fighters/AWACS.
patch("js/mondo3d.js",
      '  function nvg() { if (!st) return; st.nvg = !st.nvg; if (st.nvg && st.cam !== "cockpit") setCam("cockpit"); }',
      '''  function selectedUav(){
    return !!(st&&APP&&APP.sc&&Array.isArray(APP.sc.droni)
      &&APP.sc.droni.some(d=>d.id===st.sel));
  }
  function uavThermalReady(){
    return !!(st&&st.notte&&selectedUav());
  }
  function toggleThermal(){
    if(!uavThermalReady()){if(st)st.thermalMode=0;return;}
    st.thermalMode=((st.thermalMode||0)+1)%3;
    if(st.thermalMode){st.nvg=false;if(st.cam!=="cockpit")setCam("cockpit");}
    thermalButton();
  }
  function thermalButton(){
    const button=overlay&&overlay.querySelector("#m3d-thermal");
    if(!button||!st)return;
    const isUav=selectedUav();
    const nvgButton=overlay.querySelector("#m3d-nvgb");
    if(nvgButton){nvgButton.style.display=isUav?"none":"";nvgButton.disabled=isUav;}
    if(isUav)st.nvg=false;
    const eligible=uavThermalReady();
    if(!eligible)st.thermalMode=0;
    button.style.display=eligible?"inline-flex":"none";
    button.textContent=st.thermalMode===1?"IR WHITE HOT":st.thermalMode===2?"IR BLACK HOT":"IR OFF";
    button.style.background=st.thermalMode?"#586877":"#253b47";
    button.setAttribute("aria-pressed",String(!!st.thermalMode));
    button.setAttribute("aria-label","Termico UAV simulato: "+button.textContent);
  }
  function nvg() { if (!st) return;
    if(selectedUav()){st.nvg=false;return;}
    st.nvg = !st.nvg;
    if(st.nvg)st.thermalMode=0;
    if (st.nvg && st.cam !== "cockpit") setCam("cockpit"); }''')

patch("js/mondo3d.js",
      'if (e.key === "n" || e.key === "N") nvg();',
      'if (e.key === "n" || e.key === "N") nvg(); if (e.key === "u" || e.key === "U") toggleThermal();')

patch("js/mondo3d.js",
      'renderer.render(scene, camera); hud(); aggiornaNvg();',
      '''thermalButton();
    if(st.thermalMode && st.cam==="cockpit" && uavThermalReady()){
      if(!st.thermalFx)st.thermalFx=CENTURION_THERMAL.create(renderer);
      if(st.thermalFx)st.thermalFx.render(scene,camera,st.thermalMode,true);
      else renderer.render(scene,camera);
    }else renderer.render(scene,camera);
    hud(); aggiornaNvg();
    if(st.thermalMode && st.cam==="cockpit" && uavThermalReady()){
      CENTURION_THERMAL.overlay(hudCtx,hudCanvas.width,hudCanvas.height,st.thermalMode,st.sel);
    }''')

patch("js/mondo3d.js",
      'if(st&&st.hdTerrain){st.hdTerrain.dispose();st.hdTerrain=null;}',
      '''if(st&&st.thermalFx){st.thermalFx.dispose();st.thermalFx=null;}
    if(st&&st.hdTerrain){st.hdTerrain.dispose();st.hdTerrain=null;}''')

# Volo libero: accessible IR control for any UAV in day or night.
patch("js/volo.js",
      'ov.querySelector("#vl-nvgb").onclick = () => nvg();',
      '''ov.querySelector("#vl-nvgb").onclick = () => nvg();
    const irButton=document.createElement("button");
    irButton.id="vl-thermal";
    irButton.className="vl-b sm";
    irButton.setAttribute("aria-label","Camera termica UAV · bianco caldo / nero caldo");
    irButton.textContent="IR OFF";
    irButton.title="Camera IR simulata UAV, anche di giorno · U: OFF / WHITE HOT / BLACK HOT";
    irButton.style.cssText="display:none;position:fixed;top:calc(env(safe-area-inset-top,0px) + 70px);right:12px;z-index:2147483000;min-height:48px;min-width:112px;max-width:40vw;align-items:center;justify-content:center;padding:10px 12px;background:#293944;color:#fff;border:2px solid #b2cee0;border-radius:9px;box-shadow:0 3px 12px #0009;font:800 13px system-ui;pointer-events:auto;touch-action:manipulation";
    irButton.onclick=()=>toggleThermal();
    ov.appendChild(irButton);''')

patch("js/volo.js",
      'else if (k === "n") nvg();',
      'else if (k === "n") nvg(); else if (k === "u") toggleThermal();')

patch("js/volo.js",
      'function nvg() { if (!S) return; S.nvg = !S.nvg;',
      '''function uavThermalReady(){
    return !!(S&&S.pl&&S.pl.A&&S.pl.A.drone&&S.pl.vivo);
  }
  function toggleThermal(){
    if(!uavThermalReady()){if(S)S.thermalMode=0;return;}
    S.thermalMode=((S.thermalMode||0)+1)%3;
    if(S.thermalMode){S.nvg=false;S.cam="cockpit";}
    thermalButton();
  }
  function thermalButton(){
    if(!ov||!S)return;
    const isUav=!!(S.pl&&S.pl.A&&S.pl.A.drone);
    const nvgButton=ov.querySelector("#vl-nvgb");
    if(nvgButton){nvgButton.style.display=isUav?"none":"";nvgButton.disabled=isUav;}
    if(isUav)S.nvg=false;
    const button=ov.querySelector("#vl-thermal");
    if(!button)return;
    const eligible=uavThermalReady();
    if(!eligible)S.thermalMode=0;
    button.style.display=eligible?"inline-flex":"none";
    button.textContent=S.thermalMode===1?"IR WHITE HOT":S.thermalMode===2?"IR BLACK HOT":"IR OFF";
    button.style.background=S.thermalMode?"#476c80":"#293944";
    button.classList.toggle("on",!!S.thermalMode);
    button.setAttribute("aria-pressed",String(!!S.thermalMode));
  }
  function nvg() { if (!S) return;
    if(S.pl&&S.pl.A&&S.pl.A.drone){S.nvg=false;return;}
    S.nvg = !S.nvg;
    if(S.nvg)S.thermalMode=0;''')

patch("js/volo.js",
      'aggiorna(dtR);\n    if(S&&S.hdTerrain)S.hdTerrain.update(camera.position.x,camera.position.z,performance.now());\n    renderer.render(scene, camera); disegnaHud(); audioFrame(); aggiornaUi();',
      '''aggiorna(dtR);
    if(S&&S.hdTerrain)S.hdTerrain.update(camera.position.x,camera.position.z,performance.now());
    if(S&&S.thermalMode&&S.cam==="cockpit"&&uavThermalReady()){
      if(!S.thermalFx)S.thermalFx=CENTURION_THERMAL.create(renderer);
      if(S.thermalFx)S.thermalFx.render(scene,camera,S.thermalMode,S.cfg.ora==="notte");
      else renderer.render(scene,camera);
    }else renderer.render(scene,camera);
    disegnaHud();audioFrame();aggiornaUi();
    if(S&&S.thermalMode&&S.cam==="cockpit"&&uavThermalReady()){
      CENTURION_THERMAL.overlay(hud,hudC.width,hudC.height,S.thermalMode,S.cfg.aereo);
    }''')

patch("js/volo.js",
      'function aggiornaUi() { if (!S) return; disegnaLampo(); aggiornaNvg();',
      'function aggiornaUi() { if (!S) return; disegnaLampo(); thermalButton(); aggiornaNvg();')

patch("js/volo.js",
      'if(S&&S.hdTerrain){S.hdTerrain.dispose();S.hdTerrain=null;}',
      '''if(S&&S.thermalFx){S.thermalFx.dispose();S.thermalFx=null;}
    if(S&&S.hdTerrain){S.hdTerrain.dispose();S.hdTerrain=null;}''')

# Switching from night to day disables NVG but keeps thermal active.
patch("js/volo.js",
      'if (!notte && S.nvg) S.nvg = false;',
      'if(!notte&&S.nvg)S.nvg=false;')

# Night UAV sorties enter White Hot immediately; IR may be turned off or inverted.
patch("js/volo.js",
      'S.nvg = false;',
      'S.nvg = false; S.thermalMode = S.pl.A.drone && S.cfg.ora==="notte" ? 1 : 0; thermalButton();')

# Ensure the original NVG masks and the thermal camera cannot be on together.
# thermalButton forces NVG false; renderer stays at standard exposure when IR active.
patch("js/volo.js",
      'const on = !!(S.nvg && S.cam === "cockpit" && S.pl.vivo);',
      'const on = !!(S.nvg && !S.thermalMode && S.cam === "cockpit" && S.pl.vivo);')
patch("js/mondo3d.js",
      'const on = !!(st.nvg && st.cam === "cockpit");',
      'const on = !!(st.nvg && !st.thermalMode && st.cam === "cockpit");')

print("PASS: UAV thermal enabled, NVG disabled and hidden for UAV in Free Flight and Mondo3D.")
