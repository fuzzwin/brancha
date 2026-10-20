import {validate,event} from './core.mjs';
export function addRealProjects(current,seed){
 validate(current);validate(seed);const next=structuredClone(current.demo?{...current,demo:false,projects:[],nodes:[],edges:[],events:[]}:current);
 const added=new Set(seed.projects.filter(p=>!next.projects.some(x=>x.id===p.id)).map(p=>p.id));
 const ids=new Set([...next.projects,...next.nodes,...next.edges,...next.events].map(x=>x.id));
 const nodes=seed.nodes.filter(n=>added.has(n.projectId)),nodeIds=new Set(nodes.map(n=>n.id)),knownNodes=new Set([...next.nodes,...nodes].map(n=>n.id));
 const incoming={projects:seed.projects.filter(p=>added.has(p.id)),nodes,edges:seed.edges.filter(e=>(nodeIds.has(e.from)||nodeIds.has(e.to))&&knownNodes.has(e.from)&&knownNodes.has(e.to)),events:seed.events.filter(e=>added.has(e.projectId))};
 for(const [k,records]of Object.entries(incoming)){if(records.some(r=>ids.has(r.id)))throw Error('Project ID conflict: export and reconcile the workspaces before adding these projects.');next[k].push(...records);}
 if(added.size)event(next,[...added][0],'Added your real project checkpoints. Existing projects were preserved.');
 return validate(next);
}
