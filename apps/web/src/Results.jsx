import React,{useState} from 'react';
import {combineRuns,summarizeRun} from '@mesh/core';
import {download} from './network';

export default function Results({simulation}) {
 const [imported,setImported]=useState(null),[error,setError]=useState(''),[selected,setSelected]=useState('');
 const run=imported||simulation,summary=summarizeRun(run);
 const alert=summary.alerts.find(a=>a.alertId===selected)||summary.alerts[0];
 const counts=summary.counts;
 async function importFiles(e){
  const files=[...e.target.files];if(!files.length)return;
  setError('');
  try {
   if(files.length>16)throw Error('Choose at most 16 phone exports from one experiment');
   const data=await Promise.all(files.map(async f=>{
    if(f.size>4*1024*1024)throw Error(`${f.name}: maximum size is 4 MB`);
    return JSON.parse(await f.text());
   }));
   setImported(combineRuns(data));setSelected('');
  }catch(err){setError(err.message);}finally{e.target.value='';}
 }
 return <>
  <section className="panel results-controls"><h2>Review 2 results</h2>
   <span className="pill blue">{run.source==='android'?'IMPORTED ANDROID LOGS':'BROWSER SIMULATION'}</span>
   <p>Inspect the current simulation, or select JSON exports from all phones in the same experiment. Import works locally without the API or MongoDB. Old and new experiment history is not automatically separated; clear history before a new experiment after exporting it.</p>
   <div className="archive-actions"><label className="button light">Import phone JSON files<input aria-label="Import result JSON files" type="file" accept=".json,application/json" multiple hidden onChange={importFiles}/></label>
    <button className="button light" onClick={()=>{setImported(null);setSelected('');setError('');}}>Use current simulation</button>
    <button className="button primary" onClick={()=>download({reportVersion:1,generatedAt:Date.now(),
     note:'Descriptive snapshot results; not proof of radio range or latency. Counts use retained logs. Coverage is among exported nodes only.',...summary},'meshaid-review2-results.json')}>Download results report</button></div>
   {error&&<p className="notice" role="alert">{error}</p>}
  </section>
  <div className="stats">{[['Captured nodes',summary.nodeCount,'nodes included in this dataset'],['Received events',counts.received,'all alerts in retained logs'],['Duplicates stopped',counts.duplicate_drop,'all alerts in retained logs'],['Failed sends',counts.send_failed,'all alerts in retained logs']].map(([name,value,hint])=><div key={name}><span>{name}</span><strong>{value}</strong><small>{hint}</small></div>)}</div>
  <section className="panel results-panel"><div className="panel-heading"><h2>Alert reach</h2><span className="pill">{summary.alerts.length} UNIQUE ALERTS</span></div>
   <div className="results-body">{alert?<><label>Choose an alert<select aria-label="Result alert" value={alert.alertId} onChange={e=>setSelected(e.target.value)}>{summary.alerts.map(a=><option key={a.alertId} value={a.alertId}>{a.type} · {a.alertId.slice(0,8)} · {a.message.slice(0,55)}</option>)}</select></label>
    <p className="result-message">{alert.message}</p><p className="result-id">UUID: {alert.alertId}</p>
    <div className="coverage-value">{alert.observedNodeCount} / {summary.nodeCount} captured nodes</div>
    <p className="results-hint">{Math.round(alert.observedCoverage*100)}% snapshot coverage, including the origin if its snapshot is present. This measures stored copies among exported nodes, not total network coverage.</p>
    <div className="result-node-list">{alert.nodeLabels.map((label,i)=><span className="pill blue" key={alert.nodeIds[i]}>{label}</span>)}</div>
   </>:<p className="results-hint">Create an alert or import phone logs to inspect its reach.</p>}</div>
  </section>
  {alert&&<section className="panel results-panel"><div className="panel-heading"><h2>Evidence for this alert</h2></div><div className="table-wrap"><table><thead><tr>{['Node','Stored copy','Received','Relayed','Duplicate drops','Failed sends'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{run.nodes.map(n=>{
   const logs=n.logs.filter(e=>e.alertId===alert.alertId),count=kind=>logs.filter(e=>e.kind===kind).length;
   return <tr key={n.nodeId}><td>{n.label}</td><td>{n.alerts.some(a=>a.alertId===alert.alertId)?'Yes':'No'}</td><td>{count('received')}</td><td>{count('relayed')}</td><td>{count('duplicate_drop')}</td><td>{count('send_failed')}</td></tr>;
  })}</tbody></table></div></section>}
  <p className="results-hint">Logs retain up to 5,000 events per node. A missing stored copy or event does not establish a measured packet-loss rate. Cross-phone latency is deliberately omitted here.</p>
 </>;
}
