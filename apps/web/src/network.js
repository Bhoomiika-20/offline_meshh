import {RelayEngine,validateFanout} from '@mesh/core';
const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'];
const labels=['Phone A','Phone B','Phone C'];
export class BrowserStore {
 constructor(id){this.key=`meshaid.review1.${id}`;const raw=localStorage.getItem(this.key);this.data=raw?JSON.parse(raw):{alerts:[],logs:[]};}
 async claim(a){if(this.data.alerts.some(v=>v.alertId===a.alertId))return false;
  if(this.data.alerts.length>=1000)throw Error('Demo storage full. Export and reset before continuing.');
  const next={...this.data,alerts:[...this.data.alerts,a]};localStorage.setItem(this.key,JSON.stringify(next));this.data=next;return true;}
 async log(e){const next={...this.data,logs:[...this.data.logs,e].slice(-5000)};localStorage.setItem(this.key,JSON.stringify(next));this.data=next;}
 async snapshot(){return this.data;}
}
export function makeNetwork(onChange){
 let saved=[];try{saved=JSON.parse(localStorage.getItem('meshaid.review2.fanout')||'[]');}catch{}
 const network={links:[[0,1],[1,2]],online:[true,true,true],busy:0,error:'',nodes:[],
  fanout:ids.map((_,i)=>Number.isInteger(saved?.[i])&&saved[i]>=0&&saved[i]<=16?saved[i]:0)};
 network.setFanout=(i,k)=>{validateFanout(k);const next=[...network.fanout];next[i]=k;
  localStorage.setItem('meshaid.review2.fanout',JSON.stringify(next));network.fanout=next;onChange();};
 const tasks=new Set();
 const track=p=>{tasks.add(p);p.finally(()=>tasks.delete(p)).catch(()=>{});return p;};
 network.nodes=ids.map((nodeId,i)=>{
  const store=new BrowserStore(nodeId);
  const engine=new RelayEngine({nodeId,store,uuid:()=>crypto.randomUUID(),onChange,getFanout:()=>network.fanout[i],
   transport:{peers:()=>network.online[i]?network.links.filter(e=>e.includes(i)).map(e=>e.find(n=>n!==i)).filter(j=>network.online[j]).map(j=>ids[j]):[],
    send:async(peer,raw)=>{
     const j=ids.indexOf(peer);
     if(!network.online[i]||!network.online[j])throw Error('Simulated device disconnected');
     await new Promise(resolve=>setTimeout(resolve,180));
     if(!network.online[i]||!network.online[j]||!network.links.some(e=>e.includes(i)&&e.includes(j)))throw Error('Simulated link lost before delivery');
     // Queue application receipt without awaiting its relay chain: a cyclic
     // topology must not deadlock nodes waiting for one another's queues.
     track(network.nodes[j].engine.receive(raw,nodeId).catch(e=>{network.error=e.message;onChange();}));
    }}
  });return {nodeId,label:labels[i],store,engine};
 });
 network.run=async fn=>{network.busy++;network.error='';onChange();try{await fn();while(tasks.size)await Promise.all([...tasks]);}catch(e){network.error=e.message;}finally{network.busy--;onChange();}};
 network.export=()=>({schemaVersion:1,runId:crypto.randomUUID(),source:'simulator',createdAt:Date.now(),
  nodes:network.nodes.map(n=>({nodeId:n.nodeId,label:n.label,...n.store.data}))});
 return network;
}
export function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
