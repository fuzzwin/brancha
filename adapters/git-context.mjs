import {chatPermissions} from './chat-privacy.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

// Read-only local observations: no remote URLs, diffs, hooks, commits or uploads.
export function gitContext(cwd){
 if(typeof cwd!=='string'||!path.isAbsolute(cwd)||!fs.existsSync(cwd))return null;
 const read=args=>execFileSync('git',['--no-optional-locks','-c','core.fsmonitor=false','-C',cwd,...args],{encoding:'utf8',timeout:1000,maxBuffer:16384,stdio:['ignore','pipe','ignore'],env:{...process.env,GIT_TERMINAL_PROMPT:'0'}}).trim();
 try{
  const root=read(['rev-parse','--show-toplevel']);let branch=null,commit=null;
  try{branch=read(['symbolic-ref','--quiet','--short','HEAD']);}catch{}
  try{commit=read(['rev-parse','--verify','HEAD']);}catch{}
  if(!branch&&!commit)return null;
  return {root,branch,commit,state:branch?(commit?'branch':'unborn'):'detached',observedAt:new Date().toISOString()};
 }catch{return null;}
}

export function observeGit(config,input){
 const projectId=chatPermissions(config).chats[input.sessionId]?.projectId||config.sessionProjects?.[input.sessionId];
 const selected=projectId&&config.projectRepositories?.[projectId];
 return gitContext(selected||input.cwd);
}
