'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=process.argv[2]||path.join(__dirname,'viewer.html');
const html=fs.readFileSync(file,'utf8');
function section(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a);
 assert(a>=0&&b>a,'Hangar handler not found: '+start);
 return html.slice(a,b);
}
const selection=section('async function openModel(m)','\nfor(const m of MODELS)');
const importing=section("$('#import').onclick=","\n$('#reset').onclick=");
const model=id=>({id,name:id.toUpperCase(),url:''});
const deferred=()=>{let resolve;const promise=new Promise(ok=>{resolve=ok;});return {promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 const elements=new Map(),saved=[],archived=[],placed=[],notes=[],requests=[];
 const context={token:0,selected:model('f16'),CREDITI:{},window:{},console:{warn(){}},
  document:{querySelectorAll:()=>[]},
  $:key=>{if(!elements.has(key))elements.set(key,{textContent:'',style:{},files:[],value:'',disabled:false});return elements.get(key);},
  readStored:async()=>null,
  loader:{parseAsync:async()=>({scene:'imported'}),loadAsync:async url=>{requests.push(url);return {scene:url};}},
  note:message=>notes.push(message),clear(){},
  place:g=>placed.push({scene:g.scene,selected:context.selected.id}),
  archiveImportedAirbus:async(file,id)=>{archived.push({file,id});return null;},
  saveStored:async(id,file)=>{saved.push({file,id});},
  refreshLocalAirbusMenu:async()=>{},
 };
 vm.createContext(context);
 vm.runInContext(selection+'\nthis.openModel=openModel;\n'+importing,context);
 const file={name:'my-f16.glb',arrayBuffer:async()=>new ArrayBuffer(1)};
 context.$('#upload').files=[file];
 return {context,saved,archived,placed,notes,requests,file,importFile:()=>context.$('#upload').onchange()};
}
const tests=[
 ['display modes restore original materials and hide unsupported overlays',()=>{
  const elements=new Map(),engineeringMaterial={},originalMaterial={};
  const context={aircraft:{material:originalMaterial},selected:model('f16'),scene:{},grid:{},floor:{},engineeringMaterial,controls:{},
   $:key=>{if(!elements.has(key))elements.set(key,{setAttribute(name,value){this[name]=value;},classList:{toggle(){}}});return elements.get(key);}};
  vm.createContext(context);
  vm.runInContext(section('function setDisplayMode(mode)','\n// Livrea CENTURION'),context);
  const mode=context.setDisplayMode,orbit=context.setCinematic;
  mode('engineering');
  assert.equal(context.scene.overrideMaterial,engineeringMaterial);
  assert.equal(context.grid.visible,false);
  mode('standard');
  assert.equal(context.scene.overrideMaterial,null);
  assert.equal(context.aircraft.material,originalMaterial);
  assert.equal(context.grid.visible,true);
  mode('aerodynamic');
  assert.equal(context.$('#flow-overlay').hidden,false);
  context.selected=model('pilota');
  mode('aerodynamic');
  assert.equal(context.$('#display-mode').value,'standard');
  assert.equal(context.$('#flow-overlay').hidden,true);
  orbit(true);assert.equal(context.controls.autoRotate,true);
  context.aircraft=null;
  orbit(true);mode('engineering');
  assert.equal(context.controls.autoRotate,false);
  assert.equal(context.scene.overrideMaterial,null);
 }],
 ['an import keeps its original aircraft when selection changes',async()=>{
  const h=harness(),parsing=deferred();
  h.context.loader.parseAsync=()=>parsing.promise;
  const importing=h.importFile();await tick();
  await h.context.openModel(model('f22'));
  parsing.resolve({scene:'imported-f16'});await importing;
  assert.equal(h.saved[0]?.id,'f16','import overwrote a different aircraft in local storage');
  assert.equal(h.archived[0]?.id,'f16','Airbus classification used the changed selection');
  assert.deepEqual(h.placed,[{scene:'../models/f22.glb',selected:'f22'}]);
  assert(!h.notes.at(-1).includes('salvato localmente'),'stale import replaced the selected model status');
  assert.equal(h.context.$('#import').disabled,false);
 }],
 ['an earlier download cannot replace a newly imported model',async()=>{
  const h=harness(),loading=deferred();
  h.context.loader.loadAsync=()=>loading.promise;
  const opening=h.context.openModel(model('f16'));await tick();
  await h.importFile();
  loading.resolve({scene:'older-network-model'});await opening;
  assert.deepEqual(h.placed,[{scene:'imported',selected:'f16'}]);
  assert.equal(h.saved[0]?.id,'f16');
 }],
 ['an unavailable local Airbus without a source URL reports an error',async()=>{
  const h=harness();
  h.context.readStored=async()=>h.file;
  h.context.loader.parseAsync=async()=>{throw Error('invalid local GLB');};
  await h.context.openModel({id:'a350',name:'Airbus A350'});
  assert(h.notes.some(text=>text.includes('GLB non ancora disponibile')));
 }],
 ['an invalid import leaves storage unchanged and enables retry',async()=>{
  const h=harness();
  h.context.loader.parseAsync=async()=>{throw Error('invalid GLB');};
  await h.importFile();
  assert.deepEqual(h.saved,[]);
  assert.deepEqual(h.placed,[]);
  assert(h.notes.at(-1).includes('Errore GLB: invalid GLB'));
  assert.equal(h.context.$('#import').disabled,false);
  assert.equal(h.context.$('#upload').value,'');
 }],
 ['an obsolete local parse does not start another model download',async()=>{
  const h=harness(),parsing=deferred();
  h.context.readStored=async id=>id==='f16'?h.file:null;
  h.context.loader.parseAsync=()=>parsing.promise;
  const opening=h.context.openModel(model('f16'));await tick();
  await h.context.openModel(model('f22'));
  parsing.resolve({scene:'obsolete-local-model'});await opening;
  assert.deepEqual(h.requests,['../models/f22.glb']);
  assert.deepEqual(h.placed,[{scene:'../models/f22.glb',selected:'f22'}]);
 }],
];
(async()=>{
 let failed=0;
 for(const [name,test] of tests){
  try{await test();console.log('PASS '+name);}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}
 }
 if(failed)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
