/* CENTURION2 · User-owned browser GLB consolidation (Airbus family).
 * Reads only this origin's IndexedDB data. Nothing is uploaded to a server.
 * Browser exports a ZIP with original GLB bytes, SHA-256 and source keys.
 */
const DB_NAME='centurion2-glb-v1', STORE='files';
const LIMIT=200*1024*1024;
const TYPES=['A220','A318','A319','A320','A321','A330','A340','A350','A380'];
const txt=new TextEncoder();

export function classifyAirbus(name,key=''){
  const clean=String(name||'').toLowerCase().replace(/[_]+/g,' ');
  const keyText=String(key||'').toLowerCase();
  const find=t=>{
    const match=t.match(/(?:^|[^a-z0-9])(?:airbus[\s-]*)?(a\s*-?\s*(?:220|318|319|320|321|330|340|350|380))(?:neo|ceo)?(?=$|[^a-z0-9])/i);
    return match ? match[1].toUpperCase().replace(/[\s-]/g,'') : null;
  };
  const found=find(clean)||find(keyText);
  if(found&&TYPES.includes(found))return found;
  return /\bairbus\b/.test(clean)||/\bairbus\b/.test(keyText)?'AIRBUS':null;
}
const canonical=family=>TYPES.includes(family)?family.toLowerCase():null;
export const canonicalAirbusId=canonical;
export const airbusFamilies=Object.freeze([...TYPES]);

function openDB(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined')return reject(new Error('Archivio locale non supportato'));
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
    req.onerror=()=>reject(req.error||new Error('IndexedDB non disponibile'));
    req.onsuccess=()=>resolve(req.result);
    req.onblocked=()=>reject(new Error('Archivio bloccato da un’altra scheda'));
  });
}
async function snapshot(){
  const db=await openDB();
  try{
    return await new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readonly');
      const store=transaction.objectStore(STORE);
      const keys=store.getAllKeys(),vals=store.getAll();
      transaction.oncomplete=()=>resolve(keys.result.map((key,i)=>({key:String(key),file:vals.result[i]})));
      transaction.onerror=()=>reject(transaction.error||new Error('Lettura archivio fallita'));
      transaction.onabort=()=>reject(transaction.error||new Error('Lettura archivio interrotta'));
    });
  }finally{db.close();}
}
async function writeEntries(entries){
  const db=await openDB();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
      for(const [key,value] of entries)store.put(value,key);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('Scrittura archivio non riuscita'));
      tx.onabort=()=>reject(tx.error||new Error('Scrittura archivio interrotta'));
    });
  }finally{db.close();}
}
async function glbValid(file){
  if(!file||typeof file.slice!=='function'||typeof file.arrayBuffer!=='function'||(file.size||0)<20)return false;
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const len=new DataView(bytes.buffer).getUint32(8,true);
  return bytes[0]===103&&bytes[1]===108&&bytes[2]===84&&bytes[3]===70&&
    new DataView(bytes.buffer).getUint32(4,true)===2&&len===file.size;
}
async function metadataFamily(file){
  if(!await glbValid(file))return null;
  try{
    const raw=new Uint8Array(await file.slice(12,20).arrayBuffer()),head=new DataView(raw.buffer);
    const n=head.getUint32(0,true),kind=head.getUint32(4,true);
    if(kind!==0x4e4f534a||n>file.size-20)return null;
    const sub=await file.slice(20,Math.min(20+n,180000)).text();
    return classifyAirbus(sub,'');
  }catch{return null;}
}
export async function scanAirbus(){
  const items=await snapshot(),candidates=[],other=[];
  for(const item of items){
    const file=item.file;
    if(!file||typeof file.arrayBuffer!=='function'||!file.size)continue;
    const name=String(file.name||item.key+'.glb');
    let family=classifyAirbus(name,item.key);
    if(!family&&file.size>=20)family=await metadataFamily(file);
    const entry={key:item.key,name,size:file.size,modified:Number(file.lastModified)||0,family};
    if(family&&await glbValid(file))candidates.push(entry);
    else other.push(entry);
  }
  candidates.sort((a,b)=>a.family.localeCompare(b.family)||b.modified-a.modified||a.key.localeCompare(b.key));
  return {candidates,other};
}
function safeArchiveKey(family,file){
  const id=(globalThis.crypto&&crypto.randomUUID)?crypto.randomUUID():
    String(Date.now())+'-'+Math.random().toString(36).slice(2);
  return 'airbus-archive-'+family.toLowerCase()+'-'+id;
}
export async function archiveImportedAirbus(file,selectedKey){
  const family=classifyAirbus(file?.name,selectedKey) || await metadataFamily(file);
  if(!family||!await glbValid(file))return null;
  const key=safeArchiveKey(family,file);
  await writeEntries([[key,file]]);
  return {key,family};
}
export async function activateAirbus(sourceKey,family){
  if(!TYPES.includes(family))throw Error('Famiglia Airbus non riconosciuta');
  const entries=await snapshot();
  const source=entries.find(x=>x.key===sourceKey);
  if(!source||!await glbValid(source.file))throw Error('GLB sorgente non disponibile');
  const target=canonical(family),current=entries.find(x=>x.key===target);
  const writes=[];
  if(current&&current.file!==source.file)
    writes.push([safeArchiveKey(family,current.file),current.file]);
  writes.push([target,source.file]);
  await writeEntries(writes);
  return {target,archivedPrevious:writes.length>1,name:source.file.name||sourceKey};
}
export async function consolidateAirbus(){
  const scanned=await scanAirbus(),groups={};
  for(const item of scanned.candidates){
    if(!canonical(item.family))continue;
    (groups[item.family]??=[]).push(item);
  }
  const actions=[];
  for(const [family,records] of Object.entries(groups)){
    const target=canonical(family);
    if(records.some(r=>r.key===target)){actions.push({family,action:'preserved',target});continue;}
    const sorted=[...records].sort((a,b)=>b.modified-a.modified||a.key.localeCompare(b.key));
    const picked=sorted[0];
    await activateAirbus(picked.key,family);
    actions.push({family,action:'activated',target,source:picked.name});
  }
  return {actions,...await scanAirbus()};
}
const crcTable=(()=>{const a=new Uint32Array(256);for(let i=0;i<256;i++){let v=i;for(let j=0;j<8;j++)v=v&1?0xedb88320^(v>>>1):v>>>1;a[i]=v>>>0;}return a;})();
function crc32(bytes){let c=0xffffffff;for(let i=0;i<bytes.length;i++)c=crcTable[(c^bytes[i])&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function hex(bytes){return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
function zipFiles(entries){
  let offset=0;const parts=[],central=[];let totalCentral=0;
  const u16=(v,n,o)=>new DataView(v.buffer).setUint16(o,n,true);
  const u32=(v,n,o)=>new DataView(v.buffer).setUint32(o,n>>>0,true);
  for(const entry of entries){
    const name=txt.encode(entry.name),bytes=entry.bytes,crc=crc32(bytes);
    if(name.length>65535||bytes.length>0xffffffff)throw Error('File GLB troppo grande per ZIP');
    const lh=new Uint8Array(30+name.length);
    u32(lh,0x04034b50,0);u16(lh,20,4);u16(lh,0,6);u16(lh,0,8);
    u32(lh,crc,14);u32(lh,bytes.length,18);u32(lh,bytes.length,22);u16(lh,name.length,26);
    lh.set(name,30);parts.push(lh,bytes);
    const ch=new Uint8Array(46+name.length);
    u32(ch,0x02014b50,0);u16(ch,20,4);u16(ch,20,6);u16(ch,0,8);u16(ch,0,10);
    u32(ch,crc,16);u32(ch,bytes.length,20);u32(ch,bytes.length,24);
    u16(ch,name.length,28);u32(ch,offset,42);ch.set(name,46);
    central.push(ch);totalCentral+=ch.length;offset+=lh.length+bytes.length;
  }
  const footer=new Uint8Array(22);
  u32(footer,0x06054b50,0);u16(footer,entries.length,8);u16(footer,entries.length,10);
  u32(footer,totalCentral,12);u32(footer,offset,16);
  return new Blob([...parts,...central,footer],{type:'application/zip'});
}
export async function makeAirbusArchive(){
  const {candidates}=await scanAirbus();
  if(!candidates.length)throw Error('Nessun GLB Airbus trovato su questo dispositivo');
  const records=(await snapshot()).filter(x=>candidates.some(c=>c.key===x.key));
  const assets=[],aliases=[],seen=new Map();
  let total=0;
  for(const {key,file} of records){
    const meta=candidates.find(x=>x.key===key),bytes=new Uint8Array(await file.arrayBuffer());
    const digest=crypto.subtle?hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))):
      crc32(bytes).toString(16);
    let dest=seen.get(digest);
    if(!dest){
      const family=canonical(meta.family)||'unknown';
      dest='model-sources/airbus-'+family+'-'+digest.slice(0,12)+'.glb';
      seen.set(digest,dest);assets.push({name:dest,bytes});
      total+=bytes.length;
      if(total>LIMIT)throw Error('Archivio oltre 200 MB: suddividi gli import in più file');
    }
    aliases.push({originalStorageKey:key,originalFilename:meta.name,
      family:meta.family,bytes:meta.size,sha256:digest,path:dest,
      activeForHangar:key===canonical(meta.family),
      activeForFreeFlight:key==='a380'});
  }
  const manifest={format:'CENTURION2-Airbus-import-v1',
    origin:'IndexedDB centurion2-glb-v1 / files',
    note:'Export locale dell’utente, non implica autorizzazione alla redistribuzione pubblica.',
    records:aliases};
  assets.push({name:'manifest.json',bytes:txt.encode(JSON.stringify(manifest,null,2))});
  return {blob:zipFiles(assets),count:aliases.length,unique:seen.size,totalBytes:total,manifest};
}
export function downloadArchive(result){
  const now=new Date();
  const date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  const url=URL.createObjectURL(result.blob);
  const a=document.createElement('a');a.href=url;a.download='CENTURION2_AIRBUS_'+date+'.zip';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
