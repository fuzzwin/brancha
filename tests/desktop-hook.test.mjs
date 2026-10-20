import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {desktopHook,drainDesktopHooks} from '../adapters/desktop-hook.mjs';
import {installDesktopHooks} from '../scripts/install-desktop-hook.mjs';
import {capture,atomic,paths} from '../adapters/capture.mjs';
import {setChatPermission,chatAllowed} from '../adapters/chat-privacy.mjs';
import {blank} from '../dist/core.mjs';
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'brancha-desktop-')),config={vault:path.join(root,'vault'),captureEnabled:true,capturePolicy:{approvedSessionIds:[]},sessionProjects:{},directoryProjects:[]};
 const w=blank();w.projects.push({id:'build',title:'Example build',prompt:'Original scope stays intact',createdAt:new Date().toISOString(),criteria:[]});atomic(paths(config).file,w);
 return {root,config,read:()=>JSON.parse(fs.readFileSync(paths(config).file,'utf8'))};
}
const prompt={hook_event_name:'UserPromptSubmit',session_id:'desktop-session',turn_id:'one',cwd:'/work',prompt:'Brainch this chat for Example build'};
const stop={...prompt,hook_event_name:'Stop',last_assistant_message:'Decided to keep the local record primary because it works offline. Next: verify the generated note.'};
test('desktop hooks activate one direct chat, save visible work, and deduplicate with the watcher',()=>{
 const f=fixture();assert(desktopHook(f.config,prompt).activated);assert(chatAllowed(f.config,prompt.session_id));assert(!chatAllowed(f.config,'another-chat'));
 assert(desktopHook(f.config,stop).delivered);const w=f.read();assert.equal(w.events.length,1);assert.equal(w.nodes[0].capture.request,prompt.prompt);assert.equal(w.nodes[0].projectId,'build');assert.equal(w.projects[0].prompt,'Original scope stays intact');
 assert.equal(capture(f.config,{sessionId:prompt.session_id,turnId:prompt.turn_id,message:stop.last_assistant_message}).reason,'duplicate');
 desktopHook(f.config,stop);assert.equal(f.read().events.length,1);
 desktopHook(f.config,{...prompt,turn_id:'two',prompt:'Write the next result. API_KEY=private-secret-value'});desktopHook(f.config,{...stop,turn_id:'two'});assert.equal(f.read().events.length,2);assert(!JSON.stringify(f.read()).includes('private-secret-value'));
});
test('desktop capture never enables from quoted responses or reads a transcript, and exclusions stop capture',()=>{
 const f=fixture();assert(!desktopHook(f.config,{...prompt,prompt:'Please quote: Brainch this chat for Example build'}).staged);assert(!chatAllowed(f.config,prompt.session_id));
 desktopHook(f.config,{...stop,last_assistant_message:prompt.prompt,transcript_path:'/definitely-not-readable'});assert.equal(f.read().events.length,0);
 desktopHook(f.config,prompt);desktopHook(f.config,{...prompt,turn_id:'two',prompt:'Exclude this chat from Branchi'});desktopHook(f.config,{...stop,turn_id:'two'});assert.equal(f.read().events.length,0);
 assert.equal(fs.existsSync(path.join(paths(f.config).state,'desktop-prompts')),true);
});
test('locked desktop receipts survive restart, pause and exclusion without duplicate writes',()=>{
 const f=fixture();desktopHook(f.config,prompt);fs.writeFileSync(paths(f.config).file+'.lock','');assert(desktopHook(f.config,stop).queued);assert.equal(f.read().events.length,0);fs.unlinkSync(paths(f.config).file+'.lock');
 atomic(paths(f.config).control,{paused:true});assert(drainDesktopHooks(f.config).skipped);assert.equal(f.read().events.length,0);
 atomic(paths(f.config).control,{paused:false});assert.equal(drainDesktopHooks(f.config).processed,1);assert.equal(f.read().events.length,1);assert.equal(drainDesktopHooks(f.config).processed,0);
 desktopHook(f.config,{...prompt,turn_id:'two',prompt:'Another visible request'});fs.writeFileSync(paths(f.config).file+'.lock','');desktopHook(f.config,{...stop,turn_id:'two'});fs.unlinkSync(paths(f.config).file+'.lock');setChatPermission(f.config,prompt.session_id,'exclude');drainDesktopHooks(f.config);assert.equal(f.read().events.length,1);
});
test('subagent/continued responses, pause and missing identities do not create desktop records',()=>{
 const f=fixture();desktopHook(f.config,prompt);assert.equal(desktopHook(f.config,{...stop,agent_id:'child'}).captured,false);assert.equal(desktopHook(f.config,{...stop,stop_hook_active:true}).captured,false);
 assert.throws(()=>desktopHook(f.config,{...stop,turn_id:undefined}),/stable session/);atomic(paths(f.config).control,{paused:true});assert.equal(desktopHook(f.config,stop).captured,false);assert.equal(f.read().events.length,0);
});
test('desktop installer preserves other hooks, is idempotent, and never writes trust state',()=>{
 const f=fixture(),target=path.join(f.root,'hooks.json'),other={hooks:{Stop:[{hooks:[{type:'command',command:'existing-check'}]}]},note:'preserve'};atomic(target,other);
 const first=installDesktopHooks(target,{root:'/example/Branchi folder',node:'/example/node'});assert(first.changed);assert(first.trustRequired);assert(first.backup);const d=JSON.parse(fs.readFileSync(target,'utf8'));assert.deepEqual(d.hooks.Stop[0],other.hooks.Stop[0]);assert.equal(d.note,'preserve');assert.equal(d.hooks.UserPromptSubmit.length,1);assert.equal(d.hooks.Stop.length,2);assert(!installDesktopHooks(target,{root:'/example/Branchi folder',node:'/example/node'}).changed);
 assert.equal(fs.statSync(target).mode&0o777,0o600);assert(!fs.existsSync(path.join(f.root,'hook-trust.json')));assert.match(first.command,/Branchi folder/);
 const before='{"hooks":{"Stop":{}}}';fs.writeFileSync(target,before);assert.throws(()=>installDesktopHooks(target),/Invalid Stop/);assert.equal(fs.readFileSync(target,'utf8'),before);
});
