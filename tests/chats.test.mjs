import test from 'node:test';import assert from 'node:assert/strict';
import {chatCatalog,chatData} from '../companion/chats.mjs';import {homeData} from '../companion/home.mjs';import {obsidianFiles} from '../companion/obsidian.mjs';import {demo} from '../dist/core.mjs';
const at='2026-10-20T12:00:00Z';
function fixture(){const w=demo(),p=w.projects[0];w.events=[];w.nodes=[];w.edges=[];const add=(id,sessionId,body,extra={})=>w.events.push({id,projectId:p.id,at:'2026-10-20T01:00:00Z',text:'Saved '+id,capture:{title:'Report '+id,type:'source',status:'active',detail:body,next:'Check the actual result.',capture:{provider:'codex',sessionId,turnId:id,...extra}}});return {w,p,add};}
test('chat index retains old captured chats outside the bounded project timeline and keeps report snapshots distinct',()=>{
 const {w,p,add}=fixture();add('old','early','Earlier saved result.');for(let i=0;i<410;i++)add('later'+i,'busy','Later result '+i);w.events.push({id:'manual',projectId:p.id,at:'2026-10-20T11:00:00Z',text:'Manual project update'});
 const before=JSON.stringify(w),catalog=chatCatalog(w,{at,chatTitles:{early:'Exact old chat'}});assert.equal(catalog.length,2);assert.equal(catalog.find(c=>c.sessionId==='early').title,'Exact old chat');assert.equal(catalog.find(c=>c.sessionId==='busy').reports.length,410);assert(catalog.find(c=>c.sessionId==='early').reports[0].body.includes('Earlier saved'));
 assert.equal(homeData(w,{at}).chatTotal,2);assert.equal(JSON.stringify(w),before);
 const files=obsidianFiles(w);assert(files[`Chats/${p.id}-early.md`]);assert(files[`Interactive/chat-${p.id}-early.json`]);
 const d=JSON.parse(files[`Interactive/chat-${p.id}-busy.json`]);assert.equal(d.reports.length,80);assert.equal(d.reportCount,410);assert(d.reportsTruncated);
});
test('chat outcomes require exact provenance and evidence; reports and mapper suggestions never become verified work',()=>{
 const {w,p,add}=fixture();add('claim','chat','Everything is done and tested.');
 const n=(id,extra)=>({id,projectId:p.id,type:'output',title:id,status:'done',evidence:'A recorded check',...extra});
 w.nodes=[n('linked',{checkpoint:{sessionId:'chat'}}),n('unrelated',{}),n('other-chat',{checkpoint:{sessionId:'different'}}),n('mapped',{mapper:{sessionId:'chat',turnId:'claim'}}),n('no-evidence',{evidence:'',checkpoint:{sessionId:'chat'}})];
 const c=chatCatalog(w,{at}).find(c=>c.sessionId==='chat');assert.deepEqual(c.verified.map(n=>n.id),['linked']);assert.equal(c.proposals.length,1);assert.equal(c.reportCount,1);assert(!c.records.some(n=>n.id==='unrelated'));
 assert(!chatData(w,c,{at}).timeline.items.some(e=>e.id==='manual'));
});
test('chat artifacts are safe, source-linked, deduplicated, and handle angle-wrapped filenames with parentheses',()=>{
 const {w,add}=fixture();add('one','chat','Saved [Report](</tmp/clock (final).pdf>) and [site](https://example.com/result). [unsafe](javascript:alert).');add('two','chat','[Same report](</tmp/clock (final).pdf>)');add('other','elsewhere','[Other](https://example.com/private)');
 const c=chatCatalog(w,{at}).find(c=>c.sessionId==='chat');assert.equal(c.artifacts.length,2);assert(c.artifacts.some(a=>a.url==='file:///tmp/clock%20(final).pdf'));assert(!JSON.stringify(c).includes('https://example.com/private'));assert(!c.artifacts.some(a=>a.url.startsWith('javascript:')));assert.equal(c.artifacts.find(a=>a.label==='Same report').turnId,'two');
});
test('chat pages keep requests and outcomes separate, all generated chat links resolve, and malformed source IDs are rejected',()=>{
 const {w,p,add}=fixture();add('saved','chat','Prepared a useful [file](/tmp/result.md).',{request:'Build a useful result.',cwd:'/tmp/work'});add('unsafe','../bad','Should not be indexed');
 const before=JSON.stringify(w),files=obsidianFiles(w,{chatTitles:{chat:'Real chat title'}}),d=JSON.parse(files[`Interactive/chat-${p.id}-chat.json`]);assert.equal(d.title,'Real chat title');assert.equal(d.reports[0].request,'Build a useful result.');assert.equal(d.verified.length,0);assert.equal(chatCatalog(w,{at}).length,1);assert.equal(JSON.stringify(w),before);
 for(const [name,contents]of Object.entries(files).filter(([name])=>name.startsWith('Chats/')&&name.endsWith('.md')))for(const link of contents.matchAll(/\[\[([^|\]]+)/g)){const target=link[1].replace(/\\$/,'');assert(files[target]||files[target+'.md'],'Missing '+target+' in '+name);}
});

test('chat previews omit billing footers and HTML wrappers while preserving saved source reports',()=>{const {w,add}=fixture();add('result','chat','Built the useful draft.\n\n<smallUsage: large historical token counters');const c=chatCatalog(w,{at})[0];assert.equal(c.summary,'Built the useful draft.');assert(c.reports[0].body.includes('historical token counters'));});

test('chat mindmaps backtrack to the exact historical reply and never pull another chat into the map',()=>{
 const {w,p,add}=fixture();add('first','chat','First output with [file](/tmp/saved.md).',{request:'Make the first version.'});add('second','chat','Second output with [same file](/tmp/saved.md).',{request:'Improve that version.'});add('other','another-chat','Unrelated private result.');
 w.nodes.push({id:'choice',projectId:p.id,type:'decision',title:'Keep the first approach',status:'planned',criteria:[],detail:'A suggestion to check.',evidence:'Exact source saved.',mapper:{sessionId:'chat',turnId:'first',sourceId:'message-1',quote:'Make the first version.'}});
 const before=JSON.stringify(w),files=obsidianFiles(w),data=JSON.parse(files[`Interactive/chat-${p.id}-chat.json`]),m=data.map,choice=m.items.find(i=>i.nodeId==='choice');
 assert.equal(choice.statusId,'planned');assert.equal(choice.proposal,true);assert.equal(choice.sources[0].turnId,'first');const note=files[choice.sources[0].logPath+'.md'];assert(note.includes('First output'));assert(!note.includes('Second output'));assert(note.includes('Next captured reply'));assert(!JSON.stringify(m).includes('Unrelated private result'));assert.equal(JSON.stringify(w),before);
 const file=m.items.find(i=>i.kind==='file');assert.equal(file.sources.length,2);for(const source of file.sources)assert(files[source.logPath+'.md']);
 const replies=m.items.filter(i=>i.kind==='reply');assert.equal(replies.length,2);assert(files[replies.find(i=>i.sources[0].turnId==='second').sources[0].logPath+'.md'].includes('Previous captured reply'));
 for(const group of m.groups){assert(m.overview.includes('group_'+group.id));assert(m.views[group.id]);}
});

test('missing source captures remain missing and chat connections require explicit recorded edges',()=>{
 const {w,p,add}=fixture();add('captured','chat','One captured reply.');
 const node=(id,turnId)=>({id,projectId:p.id,type:'branch',title:id,status:'planned',criteria:[],detail:'Source linked',evidence:'Saved excerpt',mapper:{sessionId:'chat',turnId,quote:'An exact source excerpt'}});
 w.nodes.push(node('missing','not-captured'),node('linked','captured'));
 let m=chatData(w,chatCatalog(w,{at})[0],{at}).map;assert.equal(m.items.find(i=>i.nodeId==='missing').sources.length,0);assert.equal(m.items.find(i=>i.nodeId==='missing').quote,'An exact source excerpt');assert(m.items.every(i=>!i.connections?.length));
 w.edges.push({id:'branch-edge',from:'linked',to:'missing',type:'branches_from'});m=chatData(w,chatCatalog(w,{at})[0],{at}).map;assert.equal(m.items.find(i=>i.nodeId==='linked').connections.length,1);assert(m.items.find(i=>i.nodeId==='linked').connections[0].label.includes('offshoot'));
});

test('every captured reply gets a durable source note beyond the eighty-report overview cap',()=>{
 const {w,p,add}=fixture();for(let i=0;i<85;i++)add('turn'+i,'long-chat','Saved output '+i);const files=obsidianFiles(w),d=JSON.parse(files[`Interactive/chat-${p.id}-long-chat.json`]);assert.equal(d.reports.length,80);assert.equal(d.map.receiptCount,85);assert.equal(Object.keys(files).filter(k=>k.startsWith('ChatLogs/')).length,85);assert(d.map.items.filter(i=>i.kind==='reply').every(i=>files[i.sources[0].logPath+'.md']));assert(files[d.map.indexPath+'.md'].includes('85 captured replies'));
});
test('chat preview exposes bounded item branches with exact sources while retaining the simple overview',()=>{const {w,add}=fixture();for(let i=0;i<8;i++)add('p'+i,'chat','Saved report '+i);const c=chatCatalog(w,{at}).find(c=>c.sessionId==='chat'),m=chatData(w,c,{at}).map;assert(m.preview.includes('item_reply_'));assert(m.preview.includes('more_replies'));assert(!m.overview.includes('item_reply_'));assert.equal(m.items.filter(i=>i.kind==='reply').length,8);for(const item of m.items)for(const source of item.sources)assert(source.logPath.startsWith('ChatLogs/'));});
test('chat request maps omit automatic page-context wrappers while keeping the human request and canonical source',()=>{const {w,add}=fixture();add('request','chat','Saved a layout change.');w.events[0].capture.capture.request='<external_codex_apps_open_page>{"page_id":null}</external_codex_apps_open_page>\nPlease give the map its own row.';const original=w.events[0].capture.capture.request;const c=chatCatalog(w,{at})[0];assert.equal(c.reports[0].request,'Please give the map its own row.');assert.equal(w.events[0].capture.capture.request,original);assert(!chatData(w,c,{at}).map.items.find(i=>i.kind==='request').title.includes('external_codex'));});
