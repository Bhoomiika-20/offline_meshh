"""Descriptive Review 1 log counts; no invented research measurements."""
import argparse,json,collections,statistics
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('files',nargs='+');p.add_argument('--expected-nodes',type=int)
p.add_argument('--clocks-synchronized',action='store_true',help='Assert that device wall clocks were independently synchronized for this run')
a=p.parse_args()
if a.expected_nodes is not None and a.expected_nodes<1:p.error('expected-nodes must be positive')
events={};sources=set()
for filename in a.files:
 with open(filename,encoding='utf-8') as f:run=json.load(f)
 sources.add(run['source'])
 for node in run['nodes']:
  for e in node['logs']:events[e['eventId']]=e
if len(sources)!=1:raise SystemExit('Do not combine simulated and Android logs.')
counts=collections.Counter(e['kind'] for e in events.values())
print('Source:',next(iter(sources)));print('Retained event counts:',json.dumps(counts,sort_keys=True))
valid_arrivals=counts['received']+counts['duplicate_drop']
print('Duplicate-drop fraction among valid received copies:',round(counts['duplicate_drop']/valid_arrivals,4) if valid_arrivals else 'N/A')
origins={e['alertId']:e for e in events.values() if e['kind']=='created'}
for alert_id,origin in origins.items():
 reached={e['nodeId'] for e in events.values() if e['alertId']==alert_id and e['kind'] in ['created','received']}
 print('Alert',alert_id,'observed nodes including origin:',len(reached))
 if a.expected_nodes:
  if len(reached)>a.expected_nodes:raise SystemExit('Observed nodes exceed expected-nodes. Check the run selection.')
  print('Observed coverage:',round(len(reached)/a.expected_nodes,4))
 if a.clocks_synchronized:
  delays=[e['wallTimeMs']-origin['wallTimeMs'] for e in events.values() if e['alertId']==alert_id and e['kind']=='received']
  if any(x<0 for x in delays):print('Clock inconsistency detected; latency suppressed')
  elif delays:print('Receive-delay median / maximum (ms):',statistics.median(delays),max(delays))
if not a.clocks_synchronized:print('End-to-end latency omitted: independent device wall clocks may differ.')
print('No claims for radio range, churn loss, battery impact or signature overhead. These need controlled experiments.')
