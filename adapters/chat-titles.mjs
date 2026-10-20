import fs from 'node:fs';import path from 'node:path';
// Optional, observed Codex metadata adapter. It reads names only, and retains
// only IDs already represented in this Branchi record; no transcript is read.
export function chatTitles(config,w){
 if(!config.sessionsDirectory)return {};
 const file=path.join(path.dirname(config.sessionsDirectory),'session_index.jsonl');
 if(!fs.existsSync(file)||fs.statSync(file).size>4*1024*1024)return {};
 const wanted=new Set([...w.nodes.flatMap(n=>[n.capture?.sessionId,n.mapper?.sessionId]),...w.events.flatMap(e=>[e.capture?.capture?.sessionId,e.after?.capture?.sessionId])].filter(Boolean)),titles={};
 for(const line of fs.readFileSync(file,'utf8').split('\n')){let r;try{r=JSON.parse(line);}catch{continue;}if(wanted.has(r.id)&&typeof r.thread_name==='string'&&r.thread_name.length<=1000)titles[r.id]=r.thread_name;}
 return titles;
}
