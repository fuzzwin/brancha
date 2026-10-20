import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {loadConfig} from './config.mjs';
import {validate} from '../dist/core.mjs';
import {TOOLS} from '../cloud/worker.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const checks = [], add = (name, status, detail) => checks.push({name, status, detail});
const readable = p => {try {fs.accessSync(p, fs.constants.R_OK); return true;} catch {return false;}};
let commit = 'unknown', dirty = null;
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','ignore']}).trim();
  dirty = Boolean(execFileSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','ignore']}).trim());
} catch {}
add('node', Number(process.versions.node.split('.')[0]) >= 22 ? 'ok' : 'blocked', process.version);
try {
  const {config} = loadConfig(process.argv[2]);
  add('configuration', 'ok', 'Loaded without exposing paths, routing IDs or credentials.');
  let parent = config.vault;
  while (!fs.existsSync(parent) && path.dirname(parent) !== parent) parent = path.dirname(parent);
  try {fs.accessSync(parent, fs.constants.W_OK); add('vault-access', 'ok', 'Existing vault or nearest parent is writable.');}
  catch {add('vault-access', 'blocked', 'Vault or parent is not writable. Choose a writable vault.');}
  const workspace = path.join(config.vault, 'brancha.json');
  if (fs.existsSync(workspace)) {
    try {
      if (fs.statSync(workspace).size > 8 * 1024 * 1024) throw Error('Workspace exceeds 8 MB.');
      const w = validate(JSON.parse(fs.readFileSync(workspace, 'utf8')));
      add('workspace', 'ok', `Schema ${w.schemaVersion}; revision ${w.revision}; ${w.projects.length} projects.`);
      const projects = new Set(w.projects.map(p => p.id));
      const invalid = [...Object.values(config.sessionProjects), ...config.directoryProjects.map(r => r.projectId)].filter(id => !projects.has(id));
      add('routes', invalid.length ? 'warning' : 'ok', invalid.length ? `${invalid.length} routes reference missing projects.` : 'Route project IDs resolve.');
    } catch {add('workspace', 'blocked', 'Workspace is invalid or unreadable. Restore a backup; the doctor does not modify it.');}
  } else add('workspace', 'warning', 'Not created yet; start the companion to create it.');
  if (!config.captureEnabled) add('codex-capture', 'off', 'Optional adapter disabled; portable checkpoints remain available.');
  else add('codex-capture', readable(config.sessionsDirectory) ? 'ok' : 'warning', readable(config.sessionsDirectory) ? 'Session directory is readable; completion capture starts at EOF on first use.' : 'Session directory is unavailable; configure it or disable Codex capture.');
  add('automatic-mapping',config.mapper?.enabled?'ok':'off',config.mapper?.enabled?'Luna mapping enabled for allowed saved receipts; model access and backlog require runtime status.':'AI layer disabled. Captures and basic maps can still update.');
  add('catch-up-review',config.reviewer?.enabled?'warning':'off',config.reviewer?.enabled?'High catch-up enabled. Configure a twice-daily desktop schedule separately; offline doctor cannot verify its runs.':'Catch-up reviewer disabled.');
  add('cloud-bridge', config.cloud?.connectionFile ? (readable(config.cloud.connectionFile) ? 'warning' : 'blocked') : 'off', config.cloud?.connectionFile ? 'Configured. This offline check does not authenticate or contact the service.' : 'Disabled. No cloud connection required.');
  const css=path.join(config.vault,'.obsidian','snippets','brancha-map.css'),appearance=path.join(config.vault,'.obsidian','appearance.json');
  const matches=readable(css)&&fs.readFileSync(css,'utf8')===fs.readFileSync(path.join(root,'assets','obsidian','brancha-map.css'),'utf8');
  let enabled=false;try{enabled=JSON.parse(fs.readFileSync(appearance,'utf8')).enabledCssSnippets?.includes('brancha-map')===true;}catch{}
  add('obsidian-style',matches&&enabled?'ok':'warning',matches&&enabled?'Current scoped CSS is installed and enabled; native rendering still needs visual inspection.':'Optional scoped CSS is missing, different or disabled. Run npm run obsidian-style to install with backups.');
} catch {
  add('configuration', 'blocked', 'Missing or invalid config. Run npm run setup; check path fields and port.');
}
const blocked = checks.some(c => c.status === 'blocked');
console.log(JSON.stringify({version: pkg.version, commit, dirty, platform: process.platform, checkpointProtocol: 1, cloudToolsInSource: TOOLS.length, verdict: blocked ? 'blocked' : checks.some(c => c.status === 'warning') ? 'degraded' : 'ready', checks}, null, 2));
if (blocked) process.exitCode = 1;
