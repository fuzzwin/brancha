import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {fileURLToPath,pathToFileURL} from 'node:url';import {execFileSync,spawnSync} from 'node:child_process';
import {loadConfig,absolutePath,defaultConfigPath} from './config.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function installSkill(target){
 const source=path.join(root,'skills/brancha'),marker=path.join(target,'.branchi-managed.json');
 if(fs.existsSync(target)&&!fs.existsSync(marker))return {state:'preserved',target,note:'Existing skill preserved; no custom instructions overwritten.'};
 if(fs.existsSync(target)){const saved=JSON.parse(fs.readFileSync(marker,'utf8'));for(const [name,hash]of Object.entries(saved.hashes||{})){const p=path.join(target,name);if(fs.existsSync(p)&&digest(fs.readFileSync(p))!==hash)return {state:'preserved',target,note:'Locally edited skill preserved. Review the bundled skill before updating.'};}}
 const hashes={};fs.mkdirSync(target,{recursive:true});
 const copy=(from,to,prefix='')=>{for(const entry of fs.readdirSync(from,{withFileTypes:true})){const relative=prefix+entry.name;if(entry.isDirectory()){fs.mkdirSync(path.join(to,entry.name),{recursive:true});copy(path.join(from,entry.name),path.join(to,entry.name),relative+'/');}else if(entry.isFile()){const bytes=fs.readFileSync(path.join(from,entry.name));fs.writeFileSync(path.join(to,entry.name),bytes);hashes[relative]=digest(bytes);}else throw Error('Skill bundle must contain ordinary files and directories.');}};copy(source,target);
 fs.writeFileSync(marker,JSON.stringify({version:1,hashes},null,2)+'\n');return {state:'installed',target};
}
import {createHash} from 'node:crypto';const digest=b=>createHash('sha256').update(b).digest('hex');
export function quickstart(args){
 const setup=[],values={},switches=new Set(['--background','--prepare-only','--no-skill']),setupSwitches=new Set(['--no-codex','--no-ai']),setupValues=new Set(['--config','--vault','--sessions','--port','--view']);
 for(let i=0;i<args.length;i++){const flag=args[i];if(flag in values)throw Error('Duplicate option: '+flag);if(switches.has(flag)||setupSwitches.has(flag)){values[flag]=true;if(setupSwitches.has(flag))setup.push(flag);}else if(setupValues.has(flag)||flag==='--skill-dir'){const value=args[++i];if(!value||value.startsWith('--'))throw Error('Missing value for '+flag);values[flag]=value;if(setupValues.has(flag))setup.push(flag,value);}else throw Error('Unknown quickstart option: '+flag);}
 if(values['--background']&&process.platform!=='darwin')throw Error('--background currently supports macOS. Omit it to run in Terminal or PowerShell.');
 if(!values['--view'])setup.push('--view','both');
 const existed=fs.existsSync(absolutePath(values['--config']||process.env.BRANCHA_CONFIG||defaultConfigPath()));
 execFileSync(process.execPath,[path.join(root,'scripts/setup.mjs'),...setup],{stdio:'inherit'});
 const {config,configFile}=loadConfig(values['--config']);
 if(existed&&config.view!=='localhost')execFileSync(process.execPath,[path.join(root,'scripts/obsidian-interactive.mjs'),configFile],{stdio:'inherit'});
 if(!values['--no-skill']){const legacy=path.join(os.homedir(),'.codex/skills/brancha');const result=installSkill(absolutePath(values['--skill-dir']||(fs.existsSync(legacy)?legacy:path.join(os.homedir(),'.agents/skills/brancha'))));console.log('Codex skill: '+result.state+' · '+result.target);if(result.note)console.log(result.note);}
 console.log('\nReady to use Branchi:');
 if(config.view!=='obsidian')console.log('Browser: http://127.0.0.1:'+config.port+'/');
 if(config.view!=='localhost')console.log('Obsidian: open '+config.vault+' as a vault, enable Branchi Interactive, then open Generated/Navigation/Home.md. Plugin trust remains your choice.');
 console.log('In Codex, use $brancha to create or resume a project, then say: Use Branchi in this chat for PROJECT NAME. Only that exact chat is included.');
 console.log('Completed local Codex turns are captured while this companion runs. Luna mapping needs a signed-in supported Codex CLI; no API key is created. New/personal chats stay excluded.');
 console.log('More help: docs/another-computer.md · npm run doctor');
 if(values['--prepare-only'])return;
 if(values['--background']){execFileSync(process.execPath,[path.join(root,'scripts/login-service.mjs'),configFile],{stdio:'inherit'});return;}
 console.log('\nKeep this terminal open. Press Ctrl+C to stop. macOS can use --background for login startup.');
 const child=spawnSync(process.execPath,[path.join(root,'companion/service.mjs'),configFile],{stdio:'inherit'});if(child.error)throw child.error;if(child.status)process.exitCode=child.status;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)quickstart(process.argv.slice(2));
