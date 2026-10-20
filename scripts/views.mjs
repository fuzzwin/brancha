import {loadConfig} from './config.mjs';import {atomic} from '../skills/brancha/scripts/storage.mjs';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const [view,selectedConfig]=process.argv.slice(2);if(!['obsidian','localhost','both','status'].includes(view))throw Error('Usage: npm run views -- obsidian|localhost|both|status [CONFIG]');
const {config,configFile}=loadConfig(selectedConfig);
if(view==='status'){console.log('Reading surface: '+config.view);process.exit(0);}
// Prepare only the selected reading surface; capture/privacy/model preferences remain intact.
if(view!=='localhost')execFileSync(process.execPath,[fileURLToPath(new URL('./obsidian-interactive.mjs',import.meta.url)),configFile],{stdio:'inherit'});
atomic(configFile,{...config,view});console.log('Reading surface: '+view+'. Restart the existing companion for this setting to take effect.');
