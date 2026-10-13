import mongoose from 'mongoose';
import {createApp} from './app.js';
mongoose.set('bufferCommands',false);
const runSchema=new mongoose.Schema({runId:{type:String,unique:true,required:true},schemaVersion:Number,source:{type:String,enum:['simulator','android']},createdAt:Number,nodes:[mongoose.Schema.Types.Mixed],digest:String},{strict:true});
const Run=mongoose.model('ReviewRun',runSchema);
let archiveReady=false;
const repo={ready:()=>archiveReady&&mongoose.connection.readyState===1,get:id=>Run.findOne({runId:id}).lean(),put:r=>Run.create(r),list:async()=>{
 const rows=await Run.find().sort({createdAt:-1}).limit(20).lean();return rows.map(r=>({runId:r.runId,source:r.source,createdAt:r.createdAt,nodeCount:r.nodes.length,eventCount:r.nodes.reduce((a,n)=>a+n.logs.length,0)}));
}};
const app=createApp(repo);const server=app.listen(Number(process.env.PORT||4000),process.env.HOST||'127.0.0.1',()=>console.log('Review archive API on port '+(process.env.PORT||4000)));
mongoose.connect(process.env.MONGO_URI||'mongodb://127.0.0.1:27017/meshaid_review1',{serverSelectionTimeoutMS:5000}).then(async()=>{await Run.init();archiveReady=true;console.log('MongoDB connected; unique run index ready');}).catch(e=>console.error('MongoDB unavailable. Start it and restart the API:',e.message));
async function stop(){server.close();await mongoose.disconnect();process.exit(0);}process.on('SIGINT',stop);process.on('SIGTERM',stop);
