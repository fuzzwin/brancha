import {chatCatalog} from './chats.mjs';
import {receiptPath} from './chat-map.mjs';
const clean=s=>String(s||'').replace(/[\r\n|\[\]`<>]/g,' ');
export function gitBranchFiles(w,options={}){
 const files={},catalog=chatCatalog(w,options);
 for(const p of w.projects){
  const groups=new Map();
  for(const c of catalog.filter(c=>c.projectId===p.id))for(const r of c.reports){
   const git=r.git;if(!git||typeof git.root!=='string'||!Number.isFinite(Date.parse(git.observedAt)))continue;
   const key=JSON.stringify([git.root,git.branch,git.state==='detached'?git.commit:null]);let g=groups.get(key);
   if(!g){g={root:git.root,branch:git.branch||'Detached HEAD',reports:[]};groups.set(key,g);}
   g.reports.push({git,at:git.observedAt,chat:c.title,path:receiptPath(c,r),title:r.title});
  }
  const list=[...groups.values()];for(const g of list)g.reports.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));list.sort((a,b)=>Date.parse(b.reports.at(-1).at)-Date.parse(a.reports.at(-1).at));
  files[`Branches/${p.id}.md`]=`---\ncssclasses: brancha-record\n---\n# Git branches · ${clean(p.title)}\n\n[[Dashboards/${p.id}|Project]] · [[Branches/index|All project branches]] · [[Chats/index|Chats]]\n\nActive branches are observed automatically in enabled local repository chats. These are capture-time observations, not a complete Git history or evidence that uncommitted work was included in a commit. No branch ancestry, merge, push or task completion is inferred. Older saved replies without Git metadata stay unlabelled.\n\n${list.map(g=>`## ${clean(g.branch)}\n\nRepository: ${clean(g.root)}\n\nFirst observed: ${g.reports[0].at} · Last observed: ${g.reports.at(-1).at}\n\n| Observed | Commit | Chat / saved work |\n|---|---|---|\n${g.reports.map(r=>`| ${r.at} | ${r.git.commit||'No commit yet'} | [[${r.path}|${clean(r.chat)} · ${clean(r.title)}]] |`).join('\n')}\n`).join('\n')||'No repository branch has been observed in this project’s saved replies yet. Projects without Git still work normally.'}\n`;
 }
 files['Branches/index.md']=`---\ncssclasses: brancha-record\n---\n# Git branch tracking\n\n[[Navigation/Home|Home]] · [[Chats/index|Chats]]\n\n${w.projects.map(p=>`- [[Branches/${p.id}|${clean(p.title)}]]`).join('\n')}\n\nGit branches track repository context. Branchi offshoots track ideas and decisions; neither silently creates the other.\n`;
 return files;
}
