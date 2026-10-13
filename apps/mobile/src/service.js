import {PermissionsAndroid,Platform} from 'react-native';
import {RelayEngine,validateFanout} from '@mesh/core';
import native from './native';
import {store,actions} from './store';
let engine=null,subscriptions=[],refreshQueue=Promise.resolve();
export const refresh=()=>{
 refreshQueue=refreshQueue.then(async()=>{
  const snapshot=JSON.parse(await native.snapshot());
  store.dispatch(actions.snapshot(snapshot));
 }).catch(e=>store.dispatch(actions.error(e.message)));
 return refreshQueue;
};
export async function initialize(){
 if(!native)throw Error('Install the custom Android build. Expo Go does not contain the Nearby/SQLite module.');
 if(engine)return;
 const id=await native.identity();store.dispatch(actions.identity(id));
 store.dispatch(actions.fanout(await native.getFanout()));
 engine=new RelayEngine({nodeId:id,uuid:()=>native.uuid(),monotonic:()=>native.monotonicMs(),
  getFanout:()=>store.getState().fanout,
  store:{claim:a=>native.claim(JSON.stringify(a)),log:e=>native.log(JSON.stringify(e))},
  transport:{peers:()=>Object.values(store.getState().peers).filter(p=>p.kind==='connected').map(p=>p.endpointId),send:(id,raw)=>native.send(id,raw)},onChange:refresh});
 subscriptions=[native.addListener('peer',p=>store.dispatch(actions.peer(p))),
  native.addListener('error',e=>store.dispatch(actions.error(e.message))),
  native.addListener('payload',e=>{engine.receive(e.raw,e.endpointId,{wallTimeMs:e.wallTimeMs,monotonicMs:e.monotonicMs}).catch(err=>store.dispatch(actions.error(err.message)));})];
 await refresh();
}
async function permissions(){
 const p=PermissionsAndroid.PERMISSIONS,version=Number(Platform.Version),needed=[];
 if(version<=32)needed.push(p.ACCESS_FINE_LOCATION);
 if(version>=31)needed.push(p.BLUETOOTH_SCAN,p.BLUETOOTH_CONNECT,p.BLUETOOTH_ADVERTISE);
 if(version>=33)needed.push(p.NEARBY_WIFI_DEVICES);
 const result=await PermissionsAndroid.requestMultiple(needed);
 if(Object.values(result).some(v=>v!==PermissionsAndroid.RESULTS.GRANTED))throw Error('Nearby-device permissions are required. Enable them in Android Settings if blocked.');
}
export async function start(){
 await permissions();store.dispatch(actions.running(true));
 try{await native.start('Mesh-'+store.getState().nodeId.slice(0,8));}
 catch(e){store.dispatch(actions.running(false));throw e;}
}
export async function stop(){store.dispatch(actions.running(false));await native.stop();}
export async function createAlert(input){if(!engine)throw Error('App is still starting');return engine.create(input);}
export async function setFanout(k){validateFanout(k);await native.setFanout(k);store.dispatch(actions.fanout(k));}
export async function duplicate(){const a=store.getState().alerts.at(-1);if(a)return engine.receive(JSON.stringify(a),'local-duplicate-test');}
export async function clearHistory(){await stop();await engine.idle();await native.clear();await refresh();}
export const exportLogs=()=>native.exportLog(store.getState().nodeId,'Mesh-'+store.getState().nodeId.slice(0,8));
export async function perform(fn){store.dispatch(actions.error(''));store.dispatch(actions.busy(true));try{await fn();}catch(e){store.dispatch(actions.error(e.message));}finally{store.dispatch(actions.busy(false));}}
