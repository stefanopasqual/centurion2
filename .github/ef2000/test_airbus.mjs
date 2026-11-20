import assert from 'node:assert/strict';
import {classifyAirbus,canonicalAirbusId,airbusFamilies} from './airbus_local.js';
const cases=[
 ['airbus_a380_lufthansa.glb','f16','A380'],
 ['Airbus A350-900.glb','','A350'],
 ['A330-200.glb','','A330'],
 ['A320neo.glb','','A320'],
 ['a321-ceo.glb','f22','A321'],
 ['Airbus A340 600.glb','','A340'],
 ['model.glb','a380','A380'],
 ['eurofighter.glb','typhoon',null],
 ['Airbus custom.glb','misc','AIRBUS'],
 ['Airbus A220.glb','a220','A220']
];
for(const [name,key,expected] of cases)
  assert.equal(classifyAirbus(name,key),expected,name);
for(const x of airbusFamilies)assert.equal(canonicalAirbusId(x),x.toLowerCase());
assert.equal(canonicalAirbusId('AIRBUS'),null);
console.log('PASS Airbus: model family recognition, local archive keys and canonical IDs');
