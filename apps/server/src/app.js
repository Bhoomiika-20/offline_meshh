import express from 'express';
import {createHash} from 'node:crypto';
import {UUID,validateRun} from '@mesh/core';
export {validateRun} from '@mesh/core';
export function createApp(repository){
 const app=express();app.disable('x-powered-by');app.use(express.json({limit:'4mb'}));
 app.get('/api/health',(_req,res)=>res.status(repository.ready()?200:503).json({service:'meshaid-review-archive',database:repository.ready()?'connected':'unavailable',requiredForOfflineRelay:false}));
 app.use('/api/runs',(_req,res,next)=>repository.ready()?next():res.status(503).json({error:'MongoDB unavailable. Start MongoDB and the API.'}));
 app.post('/api/runs',async(req,res,next)=>{
  let run;try{run=validateRun(req.body);}catch(e){return res.status(400).json({error:e.message});}
  try{const digest=createHash('sha256').update(JSON.stringify(run)).digest('hex');const existing=await repository.get(run.runId);
   if(existing){if(existing.digest!==digest)return res.status(409).json({error:'This run ID already contains different data. Export a new run.'});return res.json({runId:run.runId,source:run.source,alreadySaved:true});}
   await repository.put({...run,digest});res.status(201).json({runId:run.runId,source:run.source,alreadySaved:false});
  }catch(e){if(e.code===11000)return res.status(409).json({error:'Concurrent import: reload and retry.'});next(e);}
 });
 app.get('/api/runs',async(_req,res,next)=>{try{res.json({runs:await repository.list()});}catch(e){next(e);}});
 app.get('/api/runs/:id',async(req,res,next)=>{if(!UUID.test(req.params.id))return res.status(400).json({error:'Invalid run UUID'});try{const r=await repository.get(req.params.id);if(!r)return res.status(404).json({error:'Run not found'});const {digest,_id,__v,...run}=r;res.json(run);}catch(e){next(e);}});
 app.use((_req,res)=>res.status(404).json({error:'Route not found'}));
 app.use((err,_req,res,_next)=>{const status=err.type==='entity.too.large'?413:err.type==='entity.parse.failed'?400:500;res.status(status).json({error:status===413?'Maximum import size is 4 MB':status===400?'Malformed JSON':'Archive operation failed'});});
 return app;
}
