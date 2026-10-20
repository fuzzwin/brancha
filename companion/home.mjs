import {projectAnalytics} from '../dist/core.mjs';
import {chatCatalog} from './chats.mjs';
export function homeData(w,{at=new Date().toISOString(),capture=null,chatTitles={},chatLimit=20,workspace=null}={}){
 const recent=chatCatalog(w,{at,chatTitles});
 const projects=w.projects.map(p=>{const a=projectAnalytics(w,p.id,{at});
  return {id:p.id,title:p.title,next:a.next,ready:a.ready.length,waiting:a.waiting.length,goals:a.originalGoals,lastAt:a.latest?.at||null,createdAt:p.createdAt,updates14d:a.updates14d,activeDays:a.activeDays,chatCount:recent.filter(c=>c.projectId===p.id).length};
 });
 return {version:1,at,revision:w.revision,workspace,privacy:capture?.chatPrivacy||null,automation:{captureEnabled:!!capture?.enabled,paused:!!capture?.paused,mapperEnabled:!!capture?.mapperEnabled,mapperLimited:!!capture?.mapperBudgetExhausted,mapperPending:capture?.mapperPending||0,lastScanAt:capture?.lastScanAt||null},projects,chatTotal:new Set(recent.map(c=>c.provider+':'+c.sessionId)).size,chatScopeTotal:recent.length,chats:recent.slice(0,chatLimit).map(({reports,records,verified,proposals,artifacts,...c})=>({...c,verifiedCount:verified.length,proposalCount:proposals.length,artifactCount:artifacts.length})),review:{automatic:!!capture?.reviewerAutomatic,nextCheckAt:capture?.reviewerNextCheckAt||null,enabled:!!capture?.reviewerEnabled,state:capture?.reviewerState||'not configured',lastAt:capture?.reviewerLastAt||null,note:capture?.reviewerLastNote||null,backlog:capture?.reviewerBacklog??0,error:!!capture?.reviewerError,paused:!!capture?.paused}};
}
