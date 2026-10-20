import fs from 'node:fs';
import {createInterface} from 'node:readline/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import path from 'node:path';
import {atomic} from '../skills/brancha/scripts/storage.mjs';
import {absolutePath, defaultConfigPath, loadConfig} from './config.mjs';

const args = process.argv.slice(2), flags = new Set(['--config', '--vault', '--sessions', '--port', '--no-codex', '--no-ai', '--view']);
const values = {};
for (let i = 0; i < args.length; i++) {
  const key = args[i];
  if (!flags.has(key) || key in values) throw Error('Unknown or duplicate option: ' + key);
  if (key === '--no-codex' || key === '--no-ai') values[key] = true;
  else { if (!args[i+1] || args[i+1].startsWith('--')) throw Error('Missing value for ' + key); values[key] = args[++i]; }
}
const configFile = absolutePath(values['--config'] || process.env.BRANCHA_CONFIG || defaultConfigPath());
if (fs.existsSync(configFile)) {
  loadConfig(configFile);
  console.log('Existing configuration preserved. Run npm run doctor to inspect it.');
} else {
  let view=values['--view'];
  if(!view&&process.stdin.isTTY&&process.stdout.isTTY){const prompt=createInterface({input:process.stdin,output:process.stdout});try{while(!view){const answer=(await prompt.question('Where will you use Branchi? 1 Obsidian · 2 Localhost · 3 Both [3]: ')).trim().toLowerCase();view=({'1':'obsidian','2':'localhost','3':'both','':'both',obsidian:'obsidian',localhost:'localhost',both:'both'})[answer];if(!view)console.log('Choose 1, 2 or 3.');}}finally{prompt.close();}}
  view??='both';if(!['obsidian','localhost','both'].includes(view))throw Error('--view must be obsidian, localhost or both.');
  const port = Number(values['--port'] || 51207);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('port must be an integer from 1024 to 65535.');
  const config = {
    view,
    vault: values['--vault'] ? absolutePath(values['--vault']) : path.join(os.homedir(), 'Documents', 'Branchi'),
    captureEnabled: !values['--no-codex'],
    sessionsDirectory: values['--sessions'] ? absolutePath(values['--sessions']) : path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions'),
    port, pollMs: 3000, sessionProjects: {}, directoryProjects: [],
    capturePolicy:{mode:'approved',approvedSessionIds:[],excludedSessionIds:[]},
    mapper:{enabled:!values['--no-ai'],maxCallsPerDay:20,maxHighPerDay:3,debounceMs:30000,timeoutMs:90000,executable:process.platform==='darwin'&&fs.existsSync('/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex')?'/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex':'codex'},
    reviewer:{enabled:!values['--no-ai'],autoCheckMs:900000,maxCallsPerDay:8,timeoutMs:120000,catchUpAfterMs:300000}
  };
  atomic(configFile, config);
  console.log('Created ' + configFile);
  console.log('Start with: node companion/service.mjs ' + JSON.stringify(configFile));
  console.log(values['--no-ai']?'AI mapping disabled explicitly.':'Automatic Luna mapping enabled for individually activated chats; requires a signed-in supported Codex CLI. The companion checks waiting work every 15 minutes; twice-daily catch-up is an optional extra desktop schedule; see docs/automatic-mapping.md.');
  if(view!=='localhost'){execFileSync(process.execPath,[fileURLToPath(new URL('./obsidian-interactive.mjs',import.meta.url)),configFile],{stdio:'inherit'});}
  console.log('Reading surface: '+view+'. Change later with npm run views -- obsidian|localhost|both. Restart the companion after changing it.');
  console.log(view==='obsidian'?'Open the configured vault in Obsidian. No localhost listener will start.':view==='localhost'?'Open http://127.0.0.1:'+port+'. Obsidian is optional and no Obsidian settings were installed.':'Open http://127.0.0.1:'+port+' or the configured vault in Obsidian.');
}
