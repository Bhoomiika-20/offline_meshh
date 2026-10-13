import {UUID,EVENTS,validateAlert} from './index.js';

export function validateRun(v){
 const check=(ok,msg)=>{if(!ok)throw Error(msg);};
 check(v&&v.schemaVersion===1&&UUID.test(v.runId),'Invalid run format');
 check(['simulator','android'].includes(v.source),'Source must be simulator or android');
 check(Number.isSafeInteger(v.createdAt)&&v.createdAt>0,'Invalid timestamp');
 check(Array.isArray(v.nodes)&&v.nodes.length>=1&&v.nodes.length<=16,'Expected 1–16 nodes');
 const seen=new Set();
 const nodes=v.nodes.map(n=>{
  check(UUID.test(n.nodeId)&&!seen.has(n.nodeId),'Invalid or repeated node ID');seen.add(n.nodeId);
  check(typeof n.label==='string'&&n.label.length<=80,'Invalid label');
  check(Array.isArray(n.alerts)&&n.alerts.length<=1000,'Too many alerts');
  check(Array.isArray(n.logs)&&n.logs.length<=5000,'Too many events');
  const alertIds=new Set(),eventIds=new Set();
  const alerts=n.alerts.map(a=>{const clean=validateAlert(a);check(!alertIds.has(clean.alertId),'Repeated alert UUID');alertIds.add(clean.alertId);return clean;});
  const logs=n.logs.map(e=>{
   check(UUID.test(e.eventId)&&UUID.test(e.sessionId)&&e.nodeId===n.nodeId,'Invalid event identity');
   check(!eventIds.has(e.eventId),'Repeated event UUID');eventIds.add(e.eventId);
   check(EVENTS.includes(e.kind),'Unknown event type');
   check(e.alertId===null||UUID.test(e.alertId),'Invalid event alert ID');
   check(e.peerId===null||(typeof e.peerId==='string'&&e.peerId.length<=100),'Invalid peer ID');
   check(Number.isSafeInteger(e.wallTimeMs)&&e.wallTimeMs>0&&Number.isFinite(e.monotonicMs)&&e.monotonicMs>=0,'Invalid event clock');
   check(e.remainingHops===null||(Number.isInteger(e.remainingHops)&&e.remainingHops>=0&&e.remainingHops<=16),'Invalid event hop limit');
   check(typeof e.detail==='string'&&e.detail.length<=300,'Invalid detail');
   return {eventId:e.eventId,sessionId:e.sessionId,nodeId:e.nodeId,alertId:e.alertId,kind:e.kind,peerId:e.peerId,wallTimeMs:e.wallTimeMs,monotonicMs:e.monotonicMs,remainingHops:e.remainingHops,detail:e.detail};
  });return {nodeId:n.nodeId,label:n.label,alerts,logs};
 });return {schemaVersion:1,runId:v.runId,source:v.source,createdAt:v.createdAt,nodes};
}

// Import snapshots from one experiment. Preserve exact UUID/event identities;
// repeated exports cannot inflate counts. Never mix Android and simulator data.
export function combineRuns(input) {
  if (!Array.isArray(input) || !input.length) throw Error('Choose at least one exported JSON file');
  const runs=input.map(validateRun),source=runs[0].source,nodes=new Map();
  for(const run of runs) {
    if(run.source!==source)throw Error('Select either Android files or simulator files, not both');
    for(const n of run.nodes) {
      if(!nodes.has(n.nodeId))nodes.set(n.nodeId,{nodeId:n.nodeId,label:n.label,alerts:new Map(),logs:new Map()});
      const target=nodes.get(n.nodeId);
      for(const a of n.alerts)target.alerts.set(a.alertId,a);
      for(const e of n.logs)target.logs.set(e.eventId,e);
    }
  }
  const merged={schemaVersion:1,runId:runs[0].runId,source,createdAt:Math.max(...runs.map(r=>r.createdAt)),
    nodes:[...nodes.values()].map(n=>({...n,alerts:[...n.alerts.values()],logs:[...n.logs.values()]}))};
  // Per-node storage limits still apply; snapshots must belong to one experiment.
  return validateRun(merged);
}

export function summarizeRun(run) {
  const events=new Map(),alerts=new Map();
  for(const node of run.nodes) {
    for(const e of node.logs)events.set(e.eventId,e);
    for(const a of node.alerts) {
      if(!alerts.has(a.alertId))alerts.set(a.alertId,{...a,nodeIds:[],nodeLabels:[]});
      const row=alerts.get(a.alertId);
      if(!row.nodeIds.includes(node.nodeId)){row.nodeIds.push(node.nodeId);row.nodeLabels.push(node.label);}
    }
  }
  const counts=Object.fromEntries(EVENTS.map(kind=>[kind,0]));
  for(const e of events.values())counts[e.kind]++;
  const arrivals=counts.received+counts.duplicate_drop;
  return {source:run.source,nodeCount:run.nodes.length,eventCount:events.size,counts,
    duplicateDropFraction:arrivals?counts.duplicate_drop/arrivals:null,
    alerts:[...alerts.values()].sort((a,b)=>b.createdAt-a.createdAt).map(a=>({...a,
      observedNodeCount:a.nodeIds.length,observedCoverage:run.nodes.length?a.nodeIds.length/run.nodes.length:0}))};
}
