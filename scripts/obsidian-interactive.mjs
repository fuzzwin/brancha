import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {loadConfig} from './config.mjs';
import {atomicText} from '../skills/brancha/scripts/storage.mjs';
const {config,configFile}=loadConfig(process.argv[2]);
const source=fileURLToPath(new URL('../assets/obsidian/brancha-interactive/',import.meta.url));
const destination=path.join(config.vault,'.obsidian/plugins/brancha-interactive');
const backups=[];
for(const name of ['manifest.json','main.js','styles.css']){
 const target=path.join(destination,name);
 if(fs.existsSync(target)){const backup=target+'.'+Date.now()+'.backup';fs.copyFileSync(target,backup,fs.constants.COPYFILE_EXCL);backups.push(backup);}
 atomicText(target,fs.readFileSync(path.join(source,name),'utf8'));
}
// One installer prepares the plugin and the scoped note-width styling.
execFileSync(process.execPath,[fileURLToPath(new URL('./obsidian-style.mjs',import.meta.url)),configFile],{stdio:'pipe'});
console.log(`Brancha dashboard installed in ${config.vault}

1. In Obsidian, enable Brancha Interactive under Settings → Community plugins.
2. Open a Brancha project bookmark. Read At a glance, explore a map box, then follow Your next step.

If Brancha Interactive was already enabled, reload that plugin or reopen Obsidian.
Keep the Brancha companion running for automatic updates.
Your existing theme and other plugins are preserved. ${backups.length} plugin files backed up.
No network connections or AI calls are made by this installer or plugin.`);
