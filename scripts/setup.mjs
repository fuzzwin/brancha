import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {atomic} from '../skills/brancha/scripts/storage.mjs';
import {absolutePath, defaultConfigPath, loadConfig} from './config.mjs';

const args = process.argv.slice(2), flags = new Set(['--config', '--vault', '--sessions', '--port', '--no-codex', '--no-ai']);
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
  const port = Number(values['--port'] || 51207);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('port must be an integer from 1024 to 65535.');
  const config = {
    vault: values['--vault'] ? absolutePath(values['--vault']) : path.join(os.homedir(), 'Documents', 'Branchi'),
    captureEnabled: !values['--no-codex'],
    sessionsDirectory: values['--sessions'] ? absolutePath(values['--sessions']) : path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions'),
    port, pollMs: 3000, sessionProjects: {}, directoryProjects: [],
    capturePolicy:{mode:'approved',approvedSessionIds:[],excludedSessionIds:[]},
    mapper:{enabled:!values['--no-ai'],maxCallsPerDay:20,maxHighPerDay:3,debounceMs:30000,timeoutMs:90000,executable:process.platform==='darwin'&&fs.existsSync('/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex')?'/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex':'codex'},
    reviewer:{enabled:!values['--no-ai'],maxCallsPerDay:8,timeoutMs:120000,catchUpAfterMs:300000}
  };
  atomic(configFile, config);
  console.log('Created ' + configFile);
  console.log('Start with: node companion/service.mjs ' + JSON.stringify(configFile));
  console.log(values['--no-ai']?'AI mapping disabled explicitly.':'Automatic Luna mapping enabled for individually activated chats; requires a signed-in supported Codex CLI. Twice-daily catch-up is a separate desktop schedule; see docs/automatic-mapping.md.');
  console.log('Open http://127.0.0.1:' + port + ' and the configured vault in Obsidian.');
}
