import test from 'node:test';
import assert from 'node:assert/strict';
import {makeNetwork} from '../apps/web/src/network.js';
function setup(t){
 const data=new Map(),prior=globalThis.localStorage;
 globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 t.after(()=>{globalThis.localStorage=prior;});return makeNetwork(()=>{});
}
const input={type:'Medical',message:'Review 2 test',maxHops:2};
test('browser A-B-C reaches C and survives a reload with its K setting',async t=>{
 const n=setup(t);n.setFanout(1,1);await n.run(()=>n.nodes[0].engine.create(input));
 assert.deepEqual(n.nodes.map(x=>x.store.data.alerts.length),[1,1,1]);
 const reload=makeNetwork(()=>{});assert.equal(reload.fanout[1],1);assert.equal(reload.nodes[2].store.data.alerts[0].remainingHops,0);
});
test('browser K=1 changes one-hop reach; a triangle finishes without deadlock',async t=>{
 const n=setup(t);n.links=[[0,1],[0,2],[1,2]];n.setFanout(0,1);
 await n.run(()=>n.nodes[0].engine.create({...input,maxHops:1}));
 assert.deepEqual(n.nodes.map(x=>x.store.data.alerts.length),[1,1,0]);
 n.setFanout(0,0);await n.run(()=>n.nodes[0].engine.create({...input,maxHops:16}));
 assert.deepEqual(n.nodes.map(x=>x.store.data.alerts.length),[2,2,1]);
 assert.ok(n.nodes.flatMap(x=>x.store.data.logs).some(e=>e.kind==='duplicate_drop'));
});
test('a link lost during simulated transfer is a failed send, not a successful send',async t=>{
 const n=setup(t),pending=n.run(()=>n.nodes[0].engine.create(input));
 n.links=[];await pending;
 assert.equal(n.nodes[1].store.data.alerts.length,0);
 // The queued create may see the already-lost link: force a transfer in flight.
 n.links=[[0,1]];
 const p=n.run(()=>n.nodes[0].engine.create(input));
 await new Promise(r=>setTimeout(r,30));n.links=[];await p;
 assert.ok(n.nodes[0].store.data.logs.some(e=>e.kind==='send_failed'));
 assert.equal(n.nodes[0].store.data.logs.filter(e=>e.kind==='sent').length,0);
});
