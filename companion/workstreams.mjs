// Workstream progress is a view of recorded task/output status, not an
// estimate of time, effort, or original-goal completion.
export function workstreamProgress(w,projectId){
 const ns=w.nodes.filter(n=>n.projectId===projectId),byId=new Map(ns.map(n=>[n.id,n]));
 const roots=ns.filter(n=>['goal','branch'].includes(n.type)&&!n.mapper&&n.status!=='parked');
 const eligible=n=>n&&!n.mapper&&['task','output'].includes(n.type)&&n.status!=='parked';
 const links=w.edges.filter(e=>['implements','depends_on','branches_from'].includes(e.type)&&byId.has(e.from)&&byId.has(e.to));
 const assigned=new Set();
 const summary=(key,title,nodeIds,rootId=null)=>{
  const work=nodeIds.map(id=>byId.get(id)).filter(eligible);
  work.forEach(n=>assigned.add(n.id));
  const done=work.filter(n=>n.status==='done'&&n.evidence?.trim()).length;
  return {key,title,rootId,nodeIds:work.map(n=>n.id),done,total:work.length,
   active:work.filter(n=>n.status==='active').length,blocked:work.filter(n=>n.status==='blocked').length,
   percent:work.length?Math.round(done/work.length*100):null};
 };
 const result=roots.map(root=>{
  const seen=new Set([root.id]),todo=[root.id];
  while(todo.length){
   const from=todo.pop();
   for(const e of links.filter(e=>e.from===from)){
    const n=byId.get(e.to);
    // A child branch has its own progress row. Context/report links never
    // assign work to a stream; shared explicit work may appear in two rows.
    if(seen.has(n.id)||n.mapper||n.status==='parked'||n.type==='source'||(n.type==='branch'&&n.id!==root.id))continue;
    seen.add(n.id);todo.push(n.id);
   }
  }
  return summary('stream_root_'+root.id,root.title,[...seen],root.id);
 });
 const other=ns.filter(n=>eligible(n)&&!assigned.has(n.id));
 if(other.length)result.push(summary('stream_unassigned','Other recorded work',other.map(n=>n.id)));
 return result;
}
