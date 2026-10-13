import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {RelayEngine,MemoryStore,combineRuns,summarizeRun} from '../packages/core/index.js';

async function example(){
 const ids=[randomUUID(),randomUUID(),randomUUID()],stores=ids.map(()=>new MemoryStore()),queue=[],engines=[];
 for(let i=0;i<3;i++)engines.push(new RelayEngine({nodeId:ids[i],store:stores[i],uuid:randomUUID,
  transport:{peers:()=>[i-1,i+1].filter(n=>n>=0&&n<3).map(n=>ids[n]),
   send:async(peer,raw)=>{queue.push(()=>engines[ids.indexOf(peer)].receive(raw,ids[i]));}}}));
 const a=await engines[0].create({type:'Fire',message:'Gate 2',maxHops:2});
 while(queue.length)await queue.shift()();await engines[2].receive(JSON.stringify(a),ids[1]);
 const run={schemaVersion:1,runId:randomUUID(),source:'android',createdAt:Date.now(),
  nodes:await Promise.all(stores.map(async(s,i)=>({nodeId:ids[i],label:`Phone ${'ABC'[i]}`,...await s.snapshot()})))};
 return {run,alert:a};
}
test('real snapshots establish per-alert reach and retained-event counts',async()=>{
 const {run}=await example(),s=summarizeRun(combineRuns([run]));
 assert.equal(s.nodeCount,3);assert.equal(s.alerts[0].observedNodeCount,3);assert.equal(s.alerts[0].observedCoverage,1);
 assert.equal(s.counts.received,2);assert.equal(s.counts.relayed,1);assert.equal(s.counts.duplicate_drop,1);
 assert.equal(s.duplicateDropFraction,1/3);
});
test('repeated phone exports do not inflate stored copies or events',async()=>{
 const {run}=await example(),single=node=>({...run,runId:randomUUID(),nodes:[node]});
 const combined=combineRuns([...run.nodes.map(single),single(run.nodes[1])]);
 assert.deepEqual(summarizeRun(combined),summarizeRun(run));
});
test('a missing phone is described only relative to exported snapshots',async()=>{
 const {run}=await example(),s=summarizeRun({...run,nodes:[run.nodes[1]]});
 assert.equal(s.nodeCount,1);assert.equal(s.alerts[0].observedNodeCount,1);
 assert.equal(s.counts.created,0);assert.equal(s.alerts[0].observedCoverage,1);
 assert.equal('latency' in s,false);
});
test('mixed sources and malformed exports are rejected; empty logs are not zero percent drops',async()=>{
 const {run}=await example();assert.throws(()=>combineRuns([run,{...run,source:'simulator'}]),/not both/);
 assert.throws(()=>combineRuns([{...run,nodes:[{...run.nodes[0],logs:[{}]}]}]));
 const s=summarizeRun({...run,nodes:run.nodes.map(n=>({...n,alerts:[],logs:[]}))});
 assert.equal(s.duplicateDropFraction,null);assert.equal(s.alerts.length,0);
});
