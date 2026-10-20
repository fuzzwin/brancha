import fs from 'node:fs';import path from 'node:path';
export const budgetTimeZone='Australia/Melbourne';
const calendar=new Intl.DateTimeFormat('en-CA',{timeZone:budgetTimeZone,year:'numeric',month:'2-digit',day:'2-digit'});
export const budgetDay=(at=new Date())=>calendar.format(new Date(at));
export function budgetReset(at=new Date()){
 let lo=new Date(at).getTime(),hi=lo+36*3600000;const today=budgetDay(lo);
 while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(budgetDay(mid)===today)lo=mid;else hi=mid;}
 return new Date(hi).toISOString();
}
export function aiBudget(config,{at=new Date()}={}){
 const date=budgetDay(at),read=(kind,limit,effort)=>{let used=0;try{const b=JSON.parse(fs.readFileSync(path.join(config.vault,'.brancha',kind,'budget.json'),'utf8'));if(b.date===date)used=Number.isInteger(b.calls)&&b.calls>=0?b.calls:null;}catch(e){if(e.code!=='ENOENT')used=null;}return {enabled:!!config[kind]?.enabled,used,limit,remaining:used===null?null:Math.max(0,limit-used),effort,limited:used!==null&&used>=limit};};
 return {date,timeZone:budgetTimeZone,resetsAt:budgetReset(at),model:'Luna',mapper:read('mapper',config.mapper?.maxCallsPerDay??20,config.mapper?.reasoningEffort||'low'),reviewer:read('reviewer',config.reviewer?.maxCallsPerDay??8,config.reviewer?.reasoningEffort||'high')};
}
