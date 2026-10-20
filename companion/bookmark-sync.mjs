import fs from 'node:fs';import path from 'node:path';import {execFile} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {paths,status,atomic} from '../adapters/capture.mjs';
const script=fileURLToPath(new URL('../scripts/obsidian-bookmarks.mjs',import.meta.url));
const run=configFile=>new Promise((resolve,reject)=>execFile(process.execPath,[script,configFile],{timeout:120000,maxBuffer:262144},(error,stdout)=>{if(error)reject(error);else{try{const result=JSON.parse(stdout);if(!result.verified)throw Error('Bookmarks were not verified');resolve(result);}catch(e){reject(e);}}}));
export class BookmarkSync{
 constructor(config,configFile,{runner=run,clock=()=>Date.now()}={}){this.config=config;this.configFile=configFile;this.runner=runner;this.clock=clock;this.busy=false;this.file=path.join(paths(config).state,'bookmark-sync.json');}
 async tick(){
  if(this.busy||!this.config.obsidianBookmarks?.enabled||this.config.view==='localhost')return;
  let w;try{w=JSON.parse(fs.readFileSync(paths(this.config).file,'utf8'));}catch{return;}
  const key=JSON.stringify(w.projects.map(p=>[p.id,p.title]).sort());
  let state={};try{state=JSON.parse(fs.readFileSync(this.file,'utf8'));}catch{}
  if(state.key===key&&(state.complete||state.attempts>=2||this.clock()<(state.nextAt||0)))return;
  // Wait for the companion to create dashboard pages before invoking Obsidian.
  if(w.projects.some(p=>!fs.existsSync(path.join(this.config.vault,'Generated/Dashboards',p.id+'.md'))))return;
  this.busy=true;state={key,attempts:state.key===key?(state.attempts||0)+1:1,complete:false,nextAt:this.clock()+60000};atomic(this.file,state);
  try{const result=await this.runner(this.configFile);state.complete=true;atomic(this.file,state);status(this.config,{bookmarksState:'up to date',bookmarksAdded:result.installed,bookmarksAt:new Date(this.clock()).toISOString(),bookmarksError:null});return result;}
  catch(e){status(this.config,{bookmarksState:state.attempts>=2?'needs attention':'waiting for Obsidian',bookmarksError:'Open the configured Obsidian vault, then run npm run obsidian-bookmarks to verify missing shortcuts.'});return {failed:true};}
  finally{this.busy=false;}
 }
}
