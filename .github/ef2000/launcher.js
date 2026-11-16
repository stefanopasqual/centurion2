/* CENTURION2 EF2000 3D overlay, loaded only after existing password gate. */
(()=>{
 if(document.getElementById('ef2000-launcher'))return;
 const b=document.createElement('button');
 b.id='ef2000-launcher';b.textContent='✈ EF-2000 3D';b.title='Apri modello Eurofighter Typhoon 3D';
 Object.assign(b.style,{position:'fixed',right:'12px',bottom:'calc(16px + env(safe-area-inset-bottom))',zIndex:'9998',background:'#163c59',color:'white',border:'1px solid #6794b4',borderRadius:'12px',padding:'12px 14px',font:'600 13px system-ui',boxShadow:'0 4px 20px #0007',cursor:'pointer'});
 document.body.appendChild(b);
 let overlay=null;
 function close(){if(overlay){overlay.remove();overlay=null;}}
 b.addEventListener('click',()=>{
  if(overlay)return;
  overlay=document.createElement('div');overlay.id='ef2000-overlay';
  Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'10000',background:'#071320'});
  const frame=document.createElement('iframe');frame.title='Eurofighter EF-2000 3D';frame.src='ef2000/viewer.html';frame.allow='fullscreen';frame.style.cssText='width:100%;height:100%;border:0';
  overlay.appendChild(frame);document.body.appendChild(overlay);
 });
 addEventListener('message',e=>{if(e.origin===location.origin && e.data?.type==='centurion2-ef2000-close')close();});
 addEventListener('keydown',e=>{if(e.key==='Escape')close();});
})();
