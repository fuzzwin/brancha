import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const defaultConfigPath = () => path.join(os.homedir(), '.config', 'brancha', 'config.json');
export function absolutePath(value, base = process.cwd()) {
  if (typeof value !== 'string' || !value.trim()) throw Error('A non-empty path is required.');
  if (value === '~') return os.homedir();
  if (/^~[\\/]/.test(value)) return path.resolve(os.homedir(), value.slice(2));
  return path.resolve(base, value);
}
export function loadConfig(file = process.env.BRANCHA_CONFIG || defaultConfigPath()) {
  const configFile = absolutePath(file), base = path.dirname(configFile);
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.vault = absolutePath(config.vault, base);
  config.captureEnabled ??= true;
  if (typeof config.captureEnabled !== 'boolean') throw Error('captureEnabled must be true or false.');
  if (config.sessionsDirectory) config.sessionsDirectory = absolutePath(config.sessionsDirectory, base);
  if (config.captureEnabled && !config.sessionsDirectory) throw Error('Codex capture needs sessionsDirectory; use captureEnabled: false for other tools.');
  config.port ??= 51207;
  if (!Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) throw Error('port must be an integer from 1024 to 65535.');
  config.pollMs ??= 3000;
  if (!Number.isInteger(config.pollMs) || config.pollMs < 25) throw Error('pollMs must be at least 25.');
  config.sessionProjects ??= {};
  config.directoryProjects ??= [];
  if (!Array.isArray(config.directoryProjects) || !config.sessionProjects || typeof config.sessionProjects !== 'object' || Array.isArray(config.sessionProjects)) throw Error('Invalid project routes.');
  config.directoryProjects = config.directoryProjects.map(r => ({...r, directory: absolutePath(r.directory, base)}));
  if (config.cloud?.connectionFile) config.cloud = {...config.cloud, connectionFile: absolutePath(config.cloud.connectionFile, base)};
  config.capturePolicy??={mode:'approved',approvedSessionIds:[],excludedSessionIds:[]};
  const policy = config.capturePolicy;
  if(config.mapper){
    const m=config.mapper;if(typeof m.enabled!=='boolean')throw Error('mapper.enabled must be true or false.');
    for(const [key,min,max]of [['maxCallsPerDay',1,100],['maxHighPerDay',0,10],['debounceMs',0,300000],['timeoutMs',1000,180000]])if(m[key]!==undefined&&(!Number.isInteger(m[key])||m[key]<min||m[key]>max))throw Error('Invalid mapper '+key+'.');
    if(m.executable!==undefined&&(typeof m.executable!=='string'||!m.executable.trim()))throw Error('Invalid mapper executable.');
  }
  if(config.reviewer){const r=config.reviewer;if(r.catchUpAfterMs!==undefined&&(!Number.isInteger(r.catchUpAfterMs)||r.catchUpAfterMs<0||r.catchUpAfterMs>86400000))throw Error('Invalid reviewer catchUpAfterMs.');if(typeof r.enabled!=='boolean')throw Error('reviewer.enabled must be true or false.');if(r.maxCallsPerDay!==undefined&&(!Number.isInteger(r.maxCallsPerDay)||r.maxCallsPerDay<1||r.maxCallsPerDay>24))throw Error('reviewer.maxCallsPerDay must be 1–24.');if(r.timeoutMs!==undefined&&(!Number.isInteger(r.timeoutMs)||r.timeoutMs<1000||r.timeoutMs>180000))throw Error('reviewer.timeoutMs must be 1000–180000.');}
  if (policy) {
    if (!['all', 'approved'].includes(policy.mode)) throw Error('capturePolicy.mode must be all or approved.');
    for (const key of ['approvedSessionIds', 'excludedSessionIds']) if (policy[key] && (!Array.isArray(policy[key]) || policy[key].some(x => typeof x !== 'string'))) throw Error('Invalid ' + key);
  }
  return {config, configFile};
}
