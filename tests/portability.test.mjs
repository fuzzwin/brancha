import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {atomic, atomicText} from '../skills/brancha/scripts/storage.mjs';
import {loadConfig} from '../scripts/config.mjs';
import {blank, validate, contextBrief, dependencyChain, reconcileImportedEdges, reportedStatus, progress, vaultFiles} from '../dist/core.mjs';
import {ingestCheckpoint} from '../adapters/checkpoint.mjs';
import {capture, paths} from '../adapters/capture.mjs';
import {CodexWatcher} from '../adapters/codex-watch.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'brancha-portable-')),config={vault:path.join(dir,'vault'),captureEnabled:false};
 const w=blank();
 for(const id of ['alpha','beta'])w.projects.push({id,title:'Fictional '+id,prompt:'Preserve this request: '+id,createdAt:new Date().toISOString(),criteria:[{id:'goal',text:'An accepted result'}]});
 const node=(id,projectId='alpha')=>({id,projectId,title:'Fictional item '+id,type:'task',status:'active',detail:'',evidence:'',next:'Check the result',criteria:[],rationale:'',alternatives:'',consequence:''});
 w.nodes.push(node('a'),node('b'),node('c'),node('other','beta'));atomic(paths(config).file,w);
 return {dir,config,w,node,read:()=>validate(JSON.parse(fs.readFileSync(paths(config).file,'utf8')))};
};
const checkpoint={version:1,provider:'generic',sessionId:'session',eventId:'event1',projectId:'alpha',title:'First result',summary:'Prepared the draft; verification is still pending.',next:'Check the draft.',status:'done'};

test('atomic replacement survives transient EPERM without deleting the existing destination',()=>{
 const f=fixture(),file=path.join(f.dir,'cursor.json');atomic(file,{old:true});let calls=0;
 const io={...fs,renameSync(from,to){calls++;assert(fs.existsSync(to));if(calls<3)throw Object.assign(Error('Scanner lock'),{code:'EPERM'});return fs.renameSync(from,to);}};
 atomic(file,{new:true},{fs:io,sleep(){}});assert.equal(calls,3);assert.deepEqual(JSON.parse(fs.readFileSync(file)),{new:true});
 const before=fs.readFileSync(file,'utf8');calls=0;
 assert.throws(()=>atomicText(file,'newer',{fs:{...fs,renameSync(){calls++;throw Object.assign(Error('Still locked'),{code:'EPERM'});}},sleep(){}}),/Still locked/);
 assert.equal(calls,5);assert.equal(fs.readFileSync(file,'utf8'),before);assert(!fs.readdirSync(f.dir).some(x=>x.endsWith('.tmp')));
 calls=0;assert.throws(()=>atomicText(file,'newer',{fs:{...fs,renameSync(){calls++;throw Object.assign(Error('No space'),{code:'ENOSPC'});}},sleep(){}}),/No space/);assert.equal(calls,1);
});

test('portable setup uses an explicit config, no Codex dependency, and preserves reruns',()=>{
 const f=fixture(),configFile=path.join(f.dir,'connection','config.json');
 execFileSync(process.execPath,['scripts/setup.mjs','--config',configFile,'--vault',f.config.vault,'--no-codex'],{cwd:root});
 assert.equal(loadConfig(configFile).config.captureEnabled,false);
 const before=fs.readFileSync(configFile,'utf8');execFileSync(process.execPath,['scripts/setup.mjs','--config',configFile,'--vault',path.join(f.dir,'different')],{cwd:root});assert.equal(fs.readFileSync(configFile,'utf8'),before);
 atomic(configFile,{vault:'../vault',captureEnabled:false,cloud:{connectionFile:'./private-connection.json'}});
 const loaded=loadConfig(configFile).config;assert.equal(loaded.vault,f.config.vault);assert.equal(loaded.cloud.connectionFile,path.join(path.dirname(configFile),'private-connection.json'));
 atomic(loaded.cloud.connectionFile,{url:'https://fictional.example',siteBearer:'fictional'});
 const out=JSON.parse(execFileSync(process.execPath,['scripts/doctor.mjs',configFile],{cwd:root,encoding:'utf8'}));
 assert(out.checks.some(c=>c.name==='codex-capture'&&c.status==='off'));assert(!JSON.stringify(out).includes(f.dir));
 assert.notEqual(spawnSync(process.execPath,['scripts/setup.mjs','--vault'],{cwd:root}).status,0);
});

test('portable checkpoints retain reported meaning, acceptance, project isolation and replay identity',()=>{
 const f=fixture();const input={...checkpoint,acceptanceCriteria:[{text:'Works on a phone',status:'complete',evidence:'Reported only',source:'fictional-note.md'}]};
 const result=ingestCheckpoint(f.config,input,0);assert(result.captured);let w=f.read(),n=w.nodes.find(n=>n.id===result.nodeId);
 assert.equal(n.status,'reported_done');assert.equal(n.recordedStatus,'done');assert.equal(n.verification.acceptance,'pending');assert.equal(n.acceptanceCriteria[0].status,'reported_done');assert.equal(progress(w,w.projects[0]).done,0);
 assert.equal(ingestCheckpoint(f.config,input,0).reason,'duplicate');assert.equal(f.read().revision,w.revision);
 assert.throws(()=>ingestCheckpoint(f.config,{...input,summary:'Changed content'},w.revision),/eventId/);
 assert.throws(()=>ingestCheckpoint(f.config,{...checkpoint,eventId:'event2'},0),/Revision/);
 assert.throws(()=>ingestCheckpoint(f.config,{...checkpoint,eventId:'event2',prerequisiteIds:['other']},w.revision),/selected project/);
 assert.equal(f.read().projects[0].prompt,f.w.projects[0].prompt);
 assert.deepEqual(f.read().nodes.filter(n=>n.projectId==='beta'),f.w.nodes.filter(n=>n.projectId==='beta'));
 assert.equal(reportedStatus('unrecognised'), 'unknown');assert.equal(reportedStatus('__proto__'),'unknown');assert.equal(reportedStatus('constructor'),'unknown');assert.equal(reportedStatus('parked'),'parked');assert.equal(reportedStatus('Verified complete'),'reported_done');
 n={...n,id:'invalid',status:'done',evidence:'Review receipt',criteria:['goal']};w.nodes.push(n);assert.throws(()=>validate(w),/criterion|acceptance/i);
});

test('improvement runs separate proposals, probes, decisions and retained evidence',()=>{
 const f=fixture(),run={phase:'probe',outcome:'passed',decision:'keep',hypothesis:'Simpler layout is easier to use.',baseline:'Original layout, same viewport.',observation:'All target cards remain reachable.',lesson:'Keep the navigation change for this viewport.',artifacts:[{label:'Test receipt',ref:'fictional-run/report.json'}]};
 const result=ingestCheckpoint(f.config,{...checkpoint,provider:'harness2',run},0),n=f.read().nodes.find(x=>x.id===result.nodeId);
 assert.equal(n.verification.testing,'passed');assert.equal(n.verification.acceptance,'pending');assert.equal(n.status,'reported_done');
 const exported=vaultFiles(f.read())['Items/'+n.id+'.md'];assert(exported.includes(run.artifacts[0].ref));assert(exported.includes('Implementation: reported_done; testing: passed; acceptance: pending'));
 assert.throws(()=>ingestCheckpoint(f.config,{...checkpoint,eventId:'no-proof',run:{...run,artifacts:[]}},f.read().revision),/evidence reference/);
 assert.throws(()=>ingestCheckpoint(f.config,{...checkpoint,eventId:'bad-probe',run:{...run,outcome:'failed'}},f.read().revision),/passing observation/);
 const artemis={...checkpoint,provider:'artemis',eventId:'trace1',run:{...run,decision:'undecided',artifacts:[{label:'Device trace',ref:'traces/fictional-device/status.json'}]}};
 assert(ingestCheckpoint(f.config,artemis,f.read().revision).captured);assert.equal(f.read().nodes.at(-1).checkpoint.provider,'artemis');
});

test('credential masking covers every imported text field, including evidence and lessons',()=>{
 const f=fixture(),secret='sk-proj-'+'x'.repeat(28),input={...checkpoint,title:secret,summary:secret,next:secret,evidence:secret,sourceRef:secret,status:'password=privatevalue',acceptanceCriteria:[{text:secret,status:'unknown',evidence:secret,source:secret}],run:{phase:'reflect',outcome:'unknown',decision:'undecided',hypothesis:secret,baseline:secret,observation:secret,lesson:secret,artifacts:[{label:secret,ref:secret}]}};
 ingestCheckpoint(f.config,input,0);const raw=fs.readFileSync(paths(f.config).file,'utf8');assert(!raw.includes(secret));assert(!raw.includes('privatevalue'));
 assert.throws(()=>ingestCheckpoint(f.config,{...checkpoint,eventId:'event2',reasoning:'Do not import this'},f.read().revision),/documented fields/);
});

test('excluded and unapproved chats never enter checkpoint records or watcher queues',()=>{
 const f=fixture(),config={...f.config,captureEnabled:true,sessionsDirectory:path.join(f.dir,'sessions'),capturePolicy:{mode:'approved',approvedSessionIds:['allowed'],excludedSessionIds:['excluded']}};
 fs.mkdirSync(config.sessionsDirectory);const before=fs.readFileSync(paths(config).file,'utf8');
 assert.equal(ingestCheckpoint(config,{...checkpoint,sessionId:'excluded'},0).reason,'excluded');
 assert.equal(capture(config,{sessionId:'unapproved',turnId:'turn',message:'Sensitive excluded content should never be saved.'}).reason,'excluded');
 const watcher=new CodexWatcher(config);fs.writeFileSync(path.join(config.sessionsDirectory,'no.jsonl'),JSON.stringify({type:'session_meta',payload:{id:'unapproved',source:'cli'}})+'\n'+JSON.stringify({type:'event_msg',payload:{type:'task_complete',turn_id:'turn',last_agent_message:'Sensitive excluded content should never be saved.'}})+'\n');
 watcher.poll();assert.equal(fs.readFileSync(paths(config).file,'utf8'),before);assert(!fs.readFileSync(watcher.file,'utf8').includes('Sensitive excluded'));
});

test('dependency expansion follows arbitrarily long chains independent of edge order',()=>{
 const f=fixture(),w=f.w;w.nodes=[];w.edges=[];
 for(let i=0;i<12;i++)w.nodes.push(f.node('n'+i));
 for(let i=0;i<11;i++)w.edges.push({id:'e'+i,from:'n'+i,to:'n'+(i+1),type:'depends_on'});
 validate(w);const expected=dependencyChain(w,'n11').map(n=>n.id);assert.equal(expected.length,11);
 w.edges.reverse();assert.deepEqual(dependencyChain(w,'n11').map(n=>n.id),expected);
 assert(contextBrief(w,'alpha','n11').includes('Fictional item n0'));
 w.edges.push({id:'cycle',from:'n11',to:'n0',type:'depends_on'});assert.throws(()=>validate(w),/cycle/);
});

test('relationship reimports remove obsolete source edges while retaining manual and other owners',()=>{
 const f=fixture(),w=f.w;
 w.edges.push({id:'manual',from:'a',to:'b',type:'depends_on'});
 const desired=[{from:'a',to:'b',type:'depends_on'},{from:'b',to:'c',type:'depends_on'}];
 assert(reconcileImportedEdges(w,'sourceA',desired).changed);const before=JSON.stringify(w);assert.equal(reconcileImportedEdges(w,'sourceA',[...desired].reverse()).changed,false);assert.equal(JSON.stringify(w),before);
 reconcileImportedEdges(w,'sourceB',[desired[1]]);reconcileImportedEdges(w,'sourceA',[]);
 assert(w.edges.some(e=>e.id==='manual'));assert(w.edges.some(e=>e.from==='b'&&e.importOwners.includes('sourceB')));
 reconcileImportedEdges(w,'sourceB',[]);assert.deepEqual(w.edges.map(e=>e.id),['manual']);
 const snapshot=JSON.stringify(w);assert.throws(()=>reconcileImportedEdges(w,'sourceA',[{from:'c',to:'a',type:'depends_on'},{from:'b',to:'c',type:'depends_on'}]),/cycle/);assert.equal(JSON.stringify(w),snapshot);
});

test('standalone skill and app share the same model semantics',()=>{
 assert.equal(fs.readFileSync(path.join(root,'dist/core.mjs'),'utf8'),fs.readFileSync(path.join(root,'skills/brancha/scripts/core.mjs'),'utf8'));
});

test('grouped workstream cycles do not become false task-level dependency failures',async()=>{
 const {groupedDependencies}=await import('../dist/core.mjs'),f=fixture(),w=f.w;
 w.edges=[{id:'edge1',from:'a',to:'b',type:'depends_on'},{id:'edge2',from:'b',to:'c',type:'depends_on'}];
 const result=groupedDependencies(w,{a:'design',b:'testing',c:'design'});assert.equal(result.taskCycles.length,0);assert.equal(result.groupingCycles.length,1);assert.equal(validate(w),w);
});

test('generated table links escape alias separators and scoped styling preserves personal appearance',()=>{
 const f=fixture();f.w.nodes[0].title='A | B ] detail';const files=vaultFiles(f.w),row=files['Records.md'].split('\n').find(r=>r.includes('Items/a.md'));
 assert(row.includes('\\|A &#124; B &#93; detail'));assert(files['Items/a.md'].includes('cssclasses: brancha-record'));
 const configFile=path.join(f.dir,'config.json');atomic(configFile,f.config);const appearance=path.join(f.config.vault,'.obsidian','appearance.json');atomic(appearance,{theme:'obsidian',enabledCssSnippets:['personal']});
 const out=JSON.parse(execFileSync(process.execPath,[path.join(root,'scripts/obsidian-style.mjs'),configFile],{encoding:'utf8'}));
 const settings=JSON.parse(fs.readFileSync(appearance));assert.equal(settings.theme,'obsidian');assert.deepEqual(settings.enabledCssSnippets,['personal','brancha-map']);assert(out.backups.some(file=>file.startsWith(appearance)));assert(!fs.existsSync(path.join(f.config.vault,'Notes')));
});
