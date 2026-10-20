import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadConfig} from './config.mjs';
import {atomic, atomicText} from '../skills/brancha/scripts/storage.mjs';
const {config}=loadConfig(process.argv[2]),dir=path.join(config.vault,'.obsidian'),target=path.join(dir,'snippets','brancha-map.css'),appearance=path.join(dir,'appearance.json');
const source=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'..','assets','obsidian','brancha-map.css'),'utf8');
const settings=fs.existsSync(appearance)?JSON.parse(fs.readFileSync(appearance,'utf8')):{};
if(settings.enabledCssSnippets&&!Array.isArray(settings.enabledCssSnippets))throw Error('Invalid Obsidian appearance settings; no files changed.');
const backups=[];
for(const file of [target,appearance])if(fs.existsSync(file)){const backup=file+'.'+Date.now()+'.backup';fs.copyFileSync(file,backup,fs.constants.COPYFILE_EXCL);backups.push(backup);}
atomicText(target,source);settings.enabledCssSnippets=[...new Set([...(settings.enabledCssSnippets||[]),'brancha-map'])];atomic(appearance,settings);
console.log(JSON.stringify({installed:true,scope:'Generated Brancha maps and records',backups},null,2));
