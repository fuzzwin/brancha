import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadConfig} from './config.mjs';
import {validate,redactText} from '../dist/core.mjs';
import {atomic,atomicText} from '../skills/brancha/scripts/storage.mjs';
import {privacyView} from '../adapters/chat-privacy.mjs';

const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const read=(file,fallback)=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;
const clean=s=>redactText(String(s??'')).replace(/(?:\n|^)\*?Usage(?: through| snapshot|:)[\s\S]*$/i,'').trim();
const cell=s=>String(s??'').replaceAll('|','/').replaceAll('\n',' ');
const localStamp=s=>new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
export const indexRoot=vault=>path.join(vault,'.brancha','project-index');
export function projectPacket(w,projectId,entry={}){
 validate(w);const p=w.projects.find(p=>p.id===projectId);if(!p)throw Error('Unknown indexed project.');
 const nodes=w.nodes.filter(n=>n.projectId===p.id),ids=new Set(nodes.map(n=>n.id));
 const sources=[{id:'scope',kind:'record',label:'Recorded scope and proposed/recorded criteria',excerpt:clean(JSON.stringify(p))}];
 for(const n of nodes.slice(0,120))sources.push({id:'record:'+n.id,kind:n.capture?'assistant-report':n.mapper?'model-proposal':'record',label:n.title,excerpt:clean(JSON.stringify(Object.fromEntries(['id','title','type','status','detail','evidence','next','criteria','rationale','alternatives','consequence'].map(k=>[k,n[k]])))).slice(0,3800)});
 if(!Array.isArray(entry.sources??[])||(entry.sources??[]).length>8)throw Error('Index permits at most eight explicitly registered files per project.');
 for(const [i,s]of (entry.sources??[]).entries()){
  const file=path.resolve(s.path),base=path.basename(file),source={id:'file:'+i,kind:'source-document',label:s.label||base,path:file};
  if(!/\.(md|txt|json|mjs|py|html|css)$/i.test(base)||/(^\.env|credentials|secrets?|auth\.json|config\.json$)/i.test(base)||file.split(path.sep).includes('.codex'))throw Error('Register project documents only, never credentials/configuration/session stores.');
  try{
   const stat=fs.statSync(file);if(!stat.isFile()||stat.size>1024*1024)throw Error('Source must be a file under 1 MB.');
   const text=fs.readFileSync(file,'utf8');Object.assign(source,{sha256:hash(text),modifiedAt:stat.mtime.toISOString(),excerpt:clean(text).slice(0,11000),truncated:text.length>11000});
  }catch(e){source.error=e.code==='ENOENT'?'Source file missing':e.message;source.excerpt='';}
  sources.push(source);
 }
 const packet={schemaVersion:1,project:{id:p.id,title:p.title,kind:entry.kind||'project'},sources,relations:w.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)),coverage:{recordsIncluded:Math.min(nodes.length,120),recordsOmitted:Math.max(0,nodes.length-120),registeredFiles:(entry.sources??[]).length,missingFiles:sources.filter(s=>s.error).length,limits:entry.limits||'Selected records and registered document excerpts; no exhaustive chat, runtime or deployment verification.'}};
 return {...packet,inputFingerprint:hash(JSON.stringify(packet))};
}
export const deepReviewSchema={type:'object',additionalProperties:false,required:['summary','findings','nextActions','mapSections','coverageGaps'],properties:{
 summary:{type:'string'},findings:{type:'array',maxItems:8,items:{type:'object',additionalProperties:false,required:['title','kind','detail','sourceId','quote'],properties:{title:{type:'string'},kind:{type:'string',enum:['recorded','source_claim','gap','conflict']},detail:{type:'string'},sourceId:{type:'string'},quote:{type:'string'}}}},
 nextActions:{type:'array',maxItems:4,items:{type:'object',additionalProperties:false,required:['title','why','sourceIds'],properties:{title:{type:'string'},why:{type:'string'},sourceIds:{type:'array',items:{type:'string'}}}}},
 mapSections:{type:'array',maxItems:7,items:{type:'object',additionalProperties:false,required:['title','contents','sourceIds'],properties:{title:{type:'string'},contents:{type:'string'},sourceIds:{type:'array',items:{type:'string'}}}}},
 coverageGaps:{type:'array',maxItems:8,items:{type:'string'}}
}};
export function validateDeepReview(value,packet){
 if(!value||typeof value.summary!=='string'||!value.summary.trim()||value.summary.length>1800)throw Error('Invalid review summary.');
 const sources=new Map(packet.sources.map(s=>[s.id,s]));
 for(const [key,max]of [['findings',8],['nextActions',4],['mapSections',7],['coverageGaps',8]])if(!Array.isArray(value[key])||value[key].length>max)throw Error('Invalid review '+key+'.');
 if(!value.findings.length)throw Error('Review must explain at least one source-grounded finding.');
 for(const f of value.findings){
  if(!['recorded','source_claim','gap','conflict'].includes(f.kind)||typeof f.title!=='string'||!f.title.trim()||f.title.length>150||typeof f.detail!=='string'||!f.detail.trim()||f.detail.length>1700)throw Error('Invalid review finding.');
  if(typeof f.quote!=='string'||f.quote.length<8||f.quote.length>650||!sources.get(f.sourceId)?.excerpt.includes(f.quote))throw Error('Review quote is not an exact source excerpt.');
 }
 for(const key of ['nextActions','mapSections'])for(const item of value[key]){
  const content=key==='nextActions'?'why':'contents';
  if(typeof item.title!=='string'||!item.title.trim()||item.title.length>150||typeof item[content]!=='string'||!item[content].trim()||item[content].length>1600||!Array.isArray(item.sourceIds)||!item.sourceIds.length||item.sourceIds.some(id=>!sources.has(id)))throw Error('Review proposal needs valid source references.');
 }
 if(value.coverageGaps.some(s=>typeof s!=='string'||s.length>1000))throw Error('Invalid coverage gap.');
 return value;
}
// Recover only literal wording with whitespace changes or one unique source-ID
// correction. Never paraphrase a quote or guess among ambiguous matches.
export function groundDeepReview(raw,packet){
 const value=structuredClone(raw),corrections=[];
 for(const [i,f]of (value.findings||[]).entries()){
  if(typeof f.quote!=='string'||f.quote.length<8||f.quote.length>650)continue;
  const original=packet.sources.find(s=>s.id===f.sourceId);
  if(original?.excerpt.includes(f.quote))continue;
  const pattern=f.quote.trim().split(/\s+/).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');
  const matches=s=>[...s.excerpt.matchAll(new RegExp(pattern,'g'))].map(m=>({id:s.id,quote:m[0]}));
  let found=original?matches(original):[];
  if(found.length!==1)found=packet.sources.flatMap(matches);
  if(found.length!==1)continue;
  const m=found[0];corrections.push({finding:i,fromSourceId:f.sourceId,toSourceId:m.id,whitespaceRestored:f.quote!==m.quote});f.sourceId=m.id;f.quote=m.quote;
 }
 validateDeepReview(value,packet);return {value,corrections};
}
export function reviewNote(packet,value,receipt){
 const summary=value.summary.replace(/\s+Tokens: unavailable\s*\([^)]*\)[\s\S]*$/,'');
 const sourceLink=id=>{const s=packet.sources.find(s=>s.id===id);return s?.path?`[${cell(s.label)}](file://${encodeURI(s.path)})`:s?.id?.startsWith('record:')?`[[Generated/Items/${s.id.slice(7)}|${cell(s.label)}]]`:cell(s?.label||id);};
 return `---\ncssclasses: brancha-record\n---\n# ${packet.project.title} — project deep dive\n\n[[Notes/Project index|All projects]] · [[Generated/Dashboards/${packet.project.id}|Dashboard]]\n\nReviewed ${receipt.completedAt}. Requested **${receipt.requestedModel} · ${receipt.reasoningEffort}**. ${receipt.observedModel?'Runner-reported model: '+receipt.observedModel+'.':'The runner did not independently report a model identifier.'}\n\n> Model review of selected sources. Proposed actions and map sections are not accepted decisions or verified completion. Exact quote checks establish grounding, not independent truth.\n\n${summary}\n\n## Findings\n\n${value.findings.map(f=>`### ${f.title}\n\n**${f.kind.replaceAll('_',' ')}** · ${sourceLink(f.sourceId)}\n\n${f.detail}\n\n> ${f.quote.replaceAll('\n','\n> ')}`).join('\n\n')}\n\n## Proposed next actions\n\n${value.nextActions.map((a,i)=>`${i+1}. **${a.title}** — ${a.why} (${a.sourceIds.map(sourceLink).join('; ')})`).join('\n')||'No action proposed.'}\n\n## Proposed map sections\n\n${value.mapSections.map(s=>`- **${s.title}** — ${s.contents} (${s.sourceIds.map(sourceLink).join('; ')})`).join('\n')}\n\n## Coverage and unknowns\n\n${[packet.coverage.limits,...value.coverageGaps].map(x=>'- '+x).join('\n')}\n\nRecords included: ${packet.coverage.recordsIncluded}; omitted: ${packet.coverage.recordsOmitted}. Registered source files: ${packet.coverage.registeredFiles}; unavailable: ${packet.coverage.missingFiles}.\n\n## Source index\n\n${packet.sources.map(s=>`- \`${s.id}\` · ${sourceLink(s.id)}${s.truncated?' · excerpt truncated':''}${s.error?' · '+s.error:''}`).join('\n')}\n\nInput fingerprint: \`${packet.inputFingerprint}\`. Full packet and model receipt are retained privately under .brancha/project-index. This review does not read hidden reasoning or execute source instructions.\n`;
}
export function saveDeepReview(vault,packet,value,receipt){
 validateDeepReview(value,packet);
 const root=indexRoot(vault),runId=crypto.randomUUID(),relative=`Notes/Reviews/Deep dives/${packet.project.id}/${receipt.completedAt.replaceAll(/[:.]/g,'-')}-${runId.slice(0,8)}.md`;
 const record={schemaVersion:1,state:'succeeded',projectId:packet.project.id,inputFingerprint:packet.inputFingerprint,reviewedAt:receipt.completedAt,note:relative,receipt,value};
 // Advance the latest pointer only after both durable outputs are saved.
 atomicText(path.join(vault,relative),reviewNote(packet,value,receipt));
 atomic(path.join(root,'runs',runId+'.json'),{...record,packet});
 atomic(path.join(root,'latest',packet.project.id+'.json'),record);
 return record;
}
export function writeProjectIndex(config,{at=new Date().toISOString()}={}){
 const {vault}=config,root=indexRoot(vault),registry=read(path.join(root,'sources.json'),{version:1,projects:{}}),w=privacyView(config,validate(read(path.join(vault,'brancha.json'))));
 const entries=w.projects.map(p=>{
  const registered=registry.projects[p.id]||{},packet=projectPacket(w,p.id,registered),last=read(path.join(root,'latest',p.id+'.json'),null);
  const noteExists=last?.note&&fs.existsSync(path.join(vault,last.note));
  return {id:p.id,title:p.title,kind:packet.project.kind,inputFingerprint:packet.inputFingerprint,state:!last?'not_reviewed':!noteExists?'review_missing':last.inputFingerprint===packet.inputFingerprint?'reviewed':'changed_since_review',lastReviewedAt:last?.reviewedAt||null,reviewNote:noteExists?last.note:null,model:last?.receipt?.requestedModel||null,effort:last?.receipt?.reasoningEffort||null,sourceFiles:packet.sources.filter(s=>s.path).map(({id,label,path,sha256,modifiedAt,truncated,error})=>({id,label,path,sha256,modifiedAt,truncated,error})),coverage:packet.coverage,nextReview:noteExists?'Review changed sources and unresolved gaps; do not repeat an unchanged model call.':'Run the source-grounded deep review.'};
 });
 const index={version:1,at,revision:w.revision,entries,discoveryBacklog:registry.discoveryBacklog||[],automation:'The companion refreshes this opted-in index every minute while running. It checks the registered source fingerprints without calling a model. Model review scheduling is separate; consult Home and the configured hourly schedule.'};
 atomic(path.join(root,'index.json'),index);
 const sourceGuide=entries.map(p=>`## ${p.title}\n\n${p.sourceFiles.map(s=>`- [${cell(s.label)}](file://${encodeURI(s.path)})${s.error?' · '+s.error:''}`).join('\n')||'No owning documents registered; review is limited to Branchi records.'}\n\nCoverage: ${p.coverage.limits}\n\n${p.reviewNote?`[[${p.reviewNote.replace(/\.md$/,'')}|Open the dated deep dive]]`:'No completed deep dive.'}`).join('\n\n');
 atomicText(path.join(vault,'Notes','Project index.md'),`---\ncssclasses: brancha-record\n---\n# Project index\n\n[[Generated/Navigation/Home|Home]] · [[Generated/Navigation/Today|Today]]\n\nLocal index refreshed ${localStamp(at)} · Australia/Melbourne. ${entries.filter(p=>p.kind!=='inbox').length} projects and ${entries.filter(p=>p.kind==='inbox').length} capture inbox. Reviews are source-grounded model analysis, not acceptance or live runtime tests.\n\n| Project | Review freshness | Last review | Requested model | Open |\n|---|---|---|---|---|\n${entries.map(p=>`| [[Generated/Dashboards/${p.id}\\|${cell(p.title)}]] | ${p.state.replaceAll('_',' ')} | ${p.lastReviewedAt?localStamp(p.lastReviewedAt):'Not reviewed'} | ${p.model==='gpt-6-luna'?'Luna':p.model||'—'} / ${p.effort||'—'} | ${p.reviewNote?`[[${p.reviewNote.replace(/\.md$/,'')}\\|Deep dive]]`:'Pending'} |`).join('\n')}\n\n## How this stays useful\n\n- Each project has a stable ID, selected source files, input fingerprint and immutable dated review.\n- Refreshing the index detects changes in the registered inputs without making a model call. The opted-in companion checks registered files every minute while running.\n- A changed source marks its review stale. Unchanged inputs can reuse the last review; missing evidence remains visible.\n- No source code, deployment, schedule or original project claim is changed by indexing or reviewing.\n- Run \`node scripts/project-index.mjs\` from the companion checkout to refresh. Existing daily review should consult this index before choosing changed projects.\n\n${sourceGuide}\n\n## Discovery backlog\n\n${index.discoveryBacklog.map(x=>'- '+cell(x)).join('\n')||'None recorded.'}\n\n## Limits\n\n${index.automation} The local registry and JSON index are under .brancha/project-index. Private paths and review packets must stay out of the public source repository.\n`);
 return {index,packets:w.projects.map(p=>projectPacket(w,p.id,registry.projects[p.id]||{}))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {config}=loadConfig(process.argv.slice(2).find(x=>x.startsWith('--config='))?.slice(9));
 const {index}=writeProjectIndex(config);
 console.log(JSON.stringify({written:path.join(config.vault,'Notes','Project index.md'),revision:index.revision,projects:index.entries.map(({id,title,state})=>({id,title,state}))}));
}
