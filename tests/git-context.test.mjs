import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {gitContext,observeGit} from '../adapters/git-context.mjs';import {capture,atomic,paths} from '../adapters/capture.mjs';import {blank} from '../dist/core.mjs';import {obsidianFiles} from '../companion/obsidian.mjs';
const git=(dir,...args)=>execFileSync('git',['-C',dir,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'brancha-git-'));git(root,'init','-b','main');return root;}
test('Git observation distinguishes unborn, named branch and detached HEAD without repository changes',()=>{
 const dir=fixture();let g=gitContext(dir);assert.equal(g.branch,'main');assert.equal(g.commit,null);assert.equal(g.state,'unborn');
 git(dir,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','Fixture');g=gitContext(dir);assert.equal(g.commit,git(dir,'rev-parse','HEAD'));assert.equal(g.state,'branch');
 const before=git(dir,'status','--porcelain');assert.equal(gitContext(dir).branch,'main');assert.equal(git(dir,'status','--porcelain'),before);
 git(dir,'checkout','--detach');g=gitContext(dir);assert.equal(g.branch,null);assert.equal(g.state,'detached');assert(g.commit);assert.equal(gitContext(path.join(dir,'missing')),null);assert.equal(gitContext('/private/tmp'),null);
});
test('capture keeps branch snapshots through branch switches and renders source-linked project history',()=>{
 const dir=fixture();git(dir,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','Fixture');
 const config={vault:path.join(dir,'vault'),capturePolicy:{approvedSessionIds:['chat']},sessionProjects:{chat:'build'},directoryProjects:[]},w=blank();w.projects.push({id:'build',title:'Example build',prompt:'Original scope',createdAt:new Date().toISOString(),criteria:[]});atomic(paths(config).file,w);
 const old=gitContext(dir);git(dir,'checkout','-b','feature/map');capture(config,{sessionId:'chat',turnId:'one',cwd:dir,git:old,message:'Saved a useful result before switching repository branches.'});capture(config,{sessionId:'chat',turnId:'two',cwd:dir,message:'Improved the layout on the new repository branch.'});
 const saved=JSON.parse(fs.readFileSync(paths(config).file,'utf8'));assert.equal(saved.events[0].capture.capture.git.branch,'main');assert.equal(saved.events[1].capture.capture.git.branch,'feature/map');
 const files=obsidianFiles(saved);assert(files['Branches/build.md'].includes('## main'));assert(files['Branches/build.md'].includes('## feature/map'));assert(files['Dashboards/build.md'].includes('[[Branches/build|Git branch history]]'));assert(files['Chats/build-chat-index.md'].includes('Git branch / commit'));
 for(const match of files['Branches/build.md'].matchAll(/\[\[([^|\]]+)/g))assert(files[match[1]]||files[match[1]+'.md'],'Missing branch-history target '+match[1]);assert(Object.values(files).some(t=>typeof t==='string'&&t.includes('Git observed at')));
});

test('explicit project repository follows work even when the chat opens in a shared non-repository folder',()=>{
 const dir=fixture(),vault=path.join(dir,'vault');fs.mkdirSync(vault);
 const config={vault,sessionProjects:{chat:'build'},projectRepositories:{build:dir}};
 assert.equal(fs.realpathSync.native(observeGit(config,{sessionId:'chat',cwd:'/private/tmp'}).root),fs.realpathSync.native(dir));
 config.projectRepositories.build=path.join(dir,'missing');assert.equal(observeGit(config,{sessionId:'chat',cwd:dir}),null);
});
