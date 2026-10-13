import {configureStore,createSlice} from '@reduxjs/toolkit';
const slice=createSlice({name:'mesh',initialState:{nodeId:'',running:false,peers:{},alerts:[],logs:[],fanout:0,error:'',busy:false},reducers:{
 fanout:(s,a)=>{s.fanout=a.payload},
 identity:(s,a)=>{s.nodeId=a.payload},running:(s,a)=>{s.running=a.payload;if(!a.payload)s.peers={}},
 peer:(s,a)=>{if(!s.running)return;const p=a.payload; if(['lost','rejected'].includes(p.kind)){delete s.peers[p.endpointId];return;}
  const prior=s.peers[p.endpointId];if(p.kind==='found'&&prior?.kind==='connected')return;
  s.peers[p.endpointId]={...prior,...p};},
 snapshot:(s,a)=>{s.alerts=a.payload.alerts;s.logs=a.payload.logs},error:(s,a)=>{s.error=a.payload},busy:(s,a)=>{s.busy=a.payload}
}});
export const actions=slice.actions;export const store=configureStore({reducer:slice.reducer});
