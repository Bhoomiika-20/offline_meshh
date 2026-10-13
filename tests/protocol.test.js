import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {RelayEngine,MemoryStore,parseAlert,validateFanout} from '../packages/core/index.js';
function mesh(edges){
 const ids=Array.from({length:4},randomUUID), stores=ids.map(()=>new MemoryStore()), q=[], engines=[];
 for(let i=0;i<4;i++)engines[i]=new RelayEngine({nodeId:ids[i],store:stores[i],uuid:randomUUID,
  transport:{peers:()=>edges.filter(e=>e.includes(i)).map(e=>String(e.find(n=>n!==i))),
   send:async(p,raw)=>{q.push(()=>engines[Number(p)].receive(raw,String(i)));}}});
 return {engines,stores,drain:async()=>{let n=0;while(q.length){assert.ok(n++<100,'Relay loop');await q.shift()();}}};
}
const input={type:'Medical',message:'Need assistance at gate 2',maxHops:2};
test('A-B-C: exactly two hops; C displays zero-TTL alert and does not reach D',async()=>{
 const m=mesh([[0,1],[1,2],[2,3]]);await m.engines[0].create(input);await m.drain();
 assert.deepEqual(m.stores.map(s=>s.alerts.size),[1,1,1,0]);
 assert.equal([...m.stores[2].alerts.values()][0].remainingHops,0);
 assert.ok(m.stores[2].logs.some(e=>e.kind==='ttl_stop'));
});
test('one-hop limit reaches B only',async()=>{
 const m=mesh([[0,1],[1,2]]);await m.engines[0].create({...input,maxHops:1});await m.drain();
 assert.deepEqual(m.stores.map(s=>s.alerts.size),[1,1,0,0]);
});
test('triangle terminates and duplicate drops are recorded',async()=>{
 const m=mesh([[0,1],[1,2],[2,0]]);await m.engines[0].create({...input,maxHops:16});await m.drain();
 assert.deepEqual(m.stores.map(s=>s.alerts.size),[1,1,1,0]);
 assert.ok(m.stores.flatMap(s=>s.logs).some(e=>e.kind==='duplicate_drop'));
});
test('concurrent duplicate arrivals claim only once',async()=>{
 const m=mesh([]);const a=await m.engines[0].create(input);
 await Promise.all(Array.from({length:10},()=>m.engines[1].receive(JSON.stringify(a),'source')));
 assert.equal(m.stores[1].logs.filter(e=>e.kind==='received').length,1);
 assert.equal(m.stores[1].logs.filter(e=>e.kind==='duplicate_drop').length,9);
});
test('seen UUID remains effective across engine restart',async()=>{
 const m=mesh([]);const a=await m.engines[0].create(input);
 const restarted=new RelayEngine({nodeId:m.engines[0].nodeId,store:m.stores[0],uuid:randomUUID,transport:{peers:()=>[],send:async()=>{}}});
 assert.equal(await restarted.receive(JSON.stringify(a),'peer'),false);
});
test('invalid input drops without storing; unsupported security rejected',async()=>{
 const m=mesh([]);await m.engines[0].receive('{bad','peer');assert.equal(m.stores[0].alerts.size,0);
 const a=await m.engines[0].create(input);
 assert.throws(()=>parseAlert(JSON.stringify({...a,remainingHops:99})));
 assert.throws(()=>parseAlert(JSON.stringify({...a,security:'verified'})));
 await assert.rejects(m.engines[0].create({...input,maxHops:0}));
});
test('failed sends have explicit failure logs',async()=>{
 const s=new MemoryStore();const e=new RelayEngine({nodeId:randomUUID(),uuid:randomUUID,store:s,
 transport:{peers:()=>['gone'],send:async()=>{throw Error('Disconnected');}}});
 await e.create(input);assert.equal(s.logs.filter(e=>e.kind==='send_failed').length,1);
 assert.equal(s.logs.filter(e=>e.kind==='sent').length,0);
});
test('K=1 caps the first hop while All preserves every eligible neighbour',async()=>{
 for(const [k,expected] of [[1,1],[2,2],[0,3]]){
  const sent=[],s=new MemoryStore();
  const e=new RelayEngine({nodeId:randomUUID(),uuid:randomUUID,store:s,getFanout:()=>k,
   transport:{peers:()=>['c','a','b','a'],send:async p=>{sent.push(p);}}});
  await e.create({...input,maxHops:1});assert.equal(sent.length,expected);
  assert.equal(new Set(sent).size,expected);
  assert.ok(s.logs.filter(x=>x.kind==='sent').every(x=>x.detail.includes(`selected=${expected}`)));
 }
});
test('K is applied after excluding the ingress peer; changing it affects later alerts',async()=>{
 let k=1;const sent=[],s=new MemoryStore(),source=mesh([]);const a=await source.engines[0].create(input);
 const e=new RelayEngine({nodeId:randomUUID(),uuid:randomUUID,store:s,getFanout:()=>k,
  transport:{peers:()=>['ingress','b','c'],send:async p=>{sent.push(p);}}});
 await e.receive(JSON.stringify(a),'ingress');assert.deepEqual(sent,['b']);
 k=0;sent.length=0;await e.create(input);assert.deepEqual(sent,['b','c','ingress']);
});
test('TTL still stops forwarding with a configured K; a duplicate never forwards again',async()=>{
 const s=new MemoryStore(),sent=[];
 const e=new RelayEngine({nodeId:randomUUID(),uuid:randomUUID,store:s,getFanout:()=>1,
  transport:{peers:()=>['b','c'],send:async p=>{sent.push(p);}}});
 const a=await e.create(input);assert.equal(await e.receive(JSON.stringify(a),'b'),false);assert.equal(sent.length,1);
 const zero={...a,alertId:randomUUID(),remainingHops:0};await e.receive(JSON.stringify(zero),'b');
 assert.equal(sent.length,1);assert.equal(s.logs.filter(x=>x.kind==='ttl_stop').length,1);
});
test('invalid K settings rejected',()=>{
 for(const value of [-1,17,1.5,'2',null,NaN])assert.throws(()=>validateFanout(value));
 assert.equal(validateFanout(0),0);assert.equal(validateFanout(16),16);
});
