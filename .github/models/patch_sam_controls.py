#!/usr/bin/env python3
"""Allow the trainer to disable or re-enable each SA-10 independently."""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'extracted/site')

def patch(rel, old, new):
    p = root / rel
    src = p.read_text(encoding='utf-8')
    if src.count(old) != 1:
        raise RuntimeError(f'{rel}: expected exactly one patch anchor, found {src.count(old)}: {old[:80]}')
    p.write_text(src.replace(old, new, 1), encoding='utf-8')
    print('Patched', rel)

patch('js/scenario_default.js',
      '  sam: [',
      '  sam_disattivati: {}, // trainer: battery ID -> true means disabled\n  sam: [')

patch('js/engine.js',
      'dest: null, attivo: true, ultimo_lancio:',
      'dest: null, attivo: !(sc.sam_disattivati || {})[s.id] && s.missili > 0, ultimo_lancio:')

patch('js/engine.js',
      '    this.sam.forEach(s => { s.attivo = !this.injectAttivo("no_sam") && s.missili > 0; });',
      '    const disabled = this.sc.sam_disattivati || {};\n'
      '    this.sam.forEach(s => { s.attivo = !this.injectAttivo("no_sam") && !disabled[s.id] && s.missili > 0; });')

panel = '''    if (APP.ruolo === "TRAINER") html += `<div class="card gold"><h3>TRAINER · Gestione batterie SAM</h3>
      <p class="muted">Seleziona le batterie SA-10 da disattivare. Puoi riattivarle in qualsiasi momento. L'inject "No SAM" spegne tutte le batterie.</p>
      ${eng.sam.map(s => `<label style="display:block;margin:9px 0"><input type="checkbox" data-sam-off="${esc(s.id)}" ${(sc.sam_disattivati || {})[s.id] ? "checked" : ""}> <b>Disattiva ${esc(s.nome)}</b> <small>(${s.missili} missili; ${s.attivo ? "OPERATIVA" : "NON OPERATIVA"})</small></label>`).join("")}</div>`;
'''
patch('js/ui.js',
      '    html += `<div class="card gold"><button class="btn primary big" id="btn-mondo3d">',
      panel + '    html += `<div class="card gold"><button class="btn primary big" id="btn-mondo3d">')

handler = '''    $$("[data-sam-off]").forEach(c => c.onchange = e => {
      const id = e.target.dataset.samOff;
      const sam = eng.sam.find(s => s.id === id);
      if (!sam || APP.ruolo !== "TRAINER") return;
      if (!sc.sam_disattivati) sc.sam_disattivati = {};
      const off = e.target.checked;
      sc.sam_disattivati[id] = off;
      eng.aggiornaInject();
      eng.evento("TRAINER", `${sam.nome}: ${off ? "DISATTIVATA" : "RIATTIVATA"} dal trainer`, "inject");
      APP.salva();
      APP.refresh();
      toast(`${sam.nome}: ${off ? "disattivata" : "riattivata"}`);
    });
'''
patch('js/ui.js',
      '    const cv = $("#chk-v3d");',
      handler + '    const cv = $("#chk-v3d");')
print('Per-battery SAM trainer controls installed.')
