import fs from 'node:fs';
import {atomic,status,paths} from '../adapters/capture.mjs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadConfig} from './config.mjs';
import {validate} from '../dist/core.mjs';
import {bookmarkPlan} from '../companion/navigation.mjs';

const {config}=loadConfig(process.argv[2]);
const cli=process.env.OBSIDIAN_CLI||(process.platform==='darwin'&&fs.existsSync('/Applications/Obsidian.app/Contents/MacOS/obsidian-cli')?'/Applications/Obsidian.app/Contents/MacOS/obsidian-cli':'obsidian');
const run=(...args)=>execFileSync(cli,[`vault=${path.basename(config.vault)}`,...args],{encoding:'utf8',timeout:15000}).trim();
const actual=run('vault','info=path');
if(fs.realpathSync(actual)!==fs.realpathSync(config.vault))throw Error('The selected Obsidian vault is not the configured Branchi vault. No bookmarks changed.');
const w=validate(JSON.parse(fs.readFileSync(path.join(config.vault,'brancha.json'),'utf8')));
const existing=JSON.parse(run('bookmarks','verbose','format=json'));
if(!Array.isArray(existing))throw Error('Unexpected bookmark response; no bookmarks changed.');
const indexOptions={hasIndex:fs.existsSync(path.join(config.vault,'Notes','Project index.md'))};
const plan=bookmarkPlan(w,existing,indexOptions);
for(const item of plan)if(!fs.existsSync(path.join(config.vault,item.file)))throw Error('Start the updated companion first; missing '+item.file);
let backup=null;
const bookmarks=path.join(config.vault,'.obsidian','bookmarks.json');
if(plan.length&&fs.existsSync(bookmarks)){
 const dir=path.join(config.vault,'.brancha','backups');fs.mkdirSync(dir,{recursive:true});
 backup=path.join(dir,`bookmarks-${Date.now()}.json`);fs.copyFileSync(bookmarks,backup,fs.constants.COPYFILE_EXCL);
}
for(const item of plan)run('bookmark',`file=${item.file}`,`title=${item.title}`);
const after=JSON.parse(run('bookmarks','verbose','format=json')),missing=bookmarkPlan(w,after,indexOptions);
if(missing.length)throw Error('Some shortcuts were not observed after installation. Inspect bookmarks before retrying.');
atomic(path.join(paths(config).state,'bookmark-sync.json'),{key:JSON.stringify(w.projects.map(p=>[p.id,p.title]).sort()),complete:true,attempts:0});
status(config,{bookmarksState:'up to date',bookmarksAdded:plan.length,bookmarksAt:new Date().toISOString(),bookmarksError:null});
console.log(JSON.stringify({installed:plan.length,preservedExisting:existing.length,verified:true,backup},null,2));
