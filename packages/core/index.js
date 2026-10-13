// Platform-independent Review 1 protocol. No server, UI, radio or database dependency.
export const TYPES = ['Medical', 'Fire', 'Flood', 'Rescue', 'Other'];
export const EVENTS = ['created','received','sent','relayed','duplicate_drop','ttl_stop','no_peer','send_failed','invalid_drop'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const integer = (n,min,max) => Number.isInteger(n) && n >= min && n <= max;
export function validateAlert(a) {
  if (!a || typeof a !== 'object' || a.version !== 1) throw Error('Unsupported alert version');
  if (!UUID.test(a.alertId) || !UUID.test(a.senderId)) throw Error('Invalid alert or sender UUID');
  if (!TYPES.includes(a.type)) throw Error('Invalid emergency type');
  if (typeof a.message !== 'string' || !a.message.trim() || a.message.length > 500) throw Error('Message must contain 1–500 characters');
  if (!integer(a.createdAt,1,Number.MAX_SAFE_INTEGER)) throw Error('Invalid creation timestamp');
  if (!integer(a.maxHops,1,16) || !integer(a.remainingHops,0,a.maxHops)) throw Error('Hop limit must be 1–16; remaining hops cannot exceed it');
  if (a.security !== 'unsigned-review1') throw Error('Review 1 only accepts explicitly unsigned alerts');
  // Return an allowlisted copy: remote peers cannot inject arbitrary fields.
  return {version:1,alertId:a.alertId,senderId:a.senderId,type:a.type,message:a.message.trim(),
    createdAt:a.createdAt,maxHops:a.maxHops,remainingHops:a.remainingHops,security:a.security};
}
export function parseAlert(raw) {
  if (typeof raw !== 'string' || raw.length > 8192) throw Error('Invalid/oversized payload');
  return validateAlert(JSON.parse(raw));
}
// 0 preserves Review 1's all-neighbours mode; 1–16 caps each forwarding step.
export function validateFanout(k) {
  if (!integer(k,0,16)) throw Error('Neighbour limit must be All (0) or an integer from 1–16');
  return k;
}
export class RelayEngine {
  constructor({nodeId,store,transport,uuid,clock=()=>Date.now(),monotonic=()=>performance.now(),onChange=()=>{},getFanout=()=>0}) {
    if (!UUID.test(nodeId)) throw Error('Node requires a UUID');
    Object.assign(this,{nodeId,store,transport,uuid,clock,monotonic,onChange,getFanout});
    this.sessionId=uuid(); this.queue=Promise.resolve();
  }
  enqueue(task) {
    const result=this.queue.then(task); this.queue=result.catch(()=>{}); return result;
  }
  async event(kind,a,peerId=null,detail='',timing=null) {
    await this.store.log({eventId:this.uuid(),sessionId:this.sessionId,nodeId:this.nodeId,
      alertId:a?.alertId??null,kind,peerId,wallTimeMs:timing?.wallTimeMs??this.clock(),monotonicMs:timing?.monotonicMs??this.monotonic(),
      remainingHops:a?.remainingHops??null,detail:String(detail).slice(0,300)});
    this.onChange();
  }
  create({type,message,maxHops}) {
    return this.enqueue(async()=>{
      const a=validateAlert({version:1,alertId:this.uuid(),senderId:this.nodeId,type,message,
        createdAt:this.clock(),maxHops,remainingHops:maxHops,security:'unsigned-review1'});
      if (!await this.store.claim(a)) throw Error('UUID collision');
      await this.event('created',a); await this.forward(a,null,true); return a;
    });
  }
  receive(raw,fromPeer,timing=null) {
    return this.enqueue(async()=>{
      let a;
      try { a=parseAlert(raw); } catch(e) { await this.event('invalid_drop',null,fromPeer,e.message,timing); return false; }
      // Durable, atomic claim BEFORE forwarding. Concurrent arrivals cannot both win.
      if (!await this.store.claim(a)) { await this.event('duplicate_drop',a,fromPeer,'',timing); return false; }
      await this.event('received',a,fromPeer,'',timing); await this.forward(a,fromPeer,false); return true;
    });
  }
  async forward(a,fromPeer,origin) {
    // TTL counts remaining transmissions. Source 1 -> neighbour receives 0, displays, stops.
    if (a.remainingHops===0) { await this.event('ttl_stop',a); return; }
    const eligible=[...new Set(this.transport.peers())].filter(p=>p!==fromPeer).sort();
    if (!eligible.length) { await this.event('no_peer',a); return; }
    const k=validateFanout(this.getFanout());
    // Stable ordering makes the small review demo repeatable. This is bounded
    // fanout, not randomized gossip or a guarantee of full-network coverage.
    const peers=k===0?eligible:eligible.slice(0,k);
    const detail=`K=${k===0?'all':k}; eligible=${eligible.length}; selected=${peers.length}`;
    const outbound={...a,remainingHops:a.remainingHops-1};
    await Promise.all(peers.map(async peer=>{
      try { await this.transport.send(peer,JSON.stringify(outbound));
        await this.event(origin?'sent':'relayed',outbound,peer,detail);
      } catch(e) { await this.event('send_failed',outbound,peer,`${detail}; ${e.message}`); }
    }));
  }
  idle(){return this.queue;}
}
export {validateRun,combineRuns,summarizeRun} from './review.js';
export class MemoryStore {
  constructor(){this.alerts=new Map();this.logs=[];}
  async claim(a){if(this.alerts.has(a.alertId))return false;this.alerts.set(a.alertId,{...a});return true;}
  async log(e){this.logs.push({...e});}
  async snapshot(){return {alerts:[...this.alerts.values()],logs:[...this.logs]};}
}
