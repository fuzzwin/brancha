import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadConfig} from './config.mjs';
const [format='json',file]=process.argv.slice(2),{configFile}=loadConfig(file);
const script=path.join(path.dirname(fileURLToPath(import.meta.url)),'mcp.mjs');
if(format==='json')console.log(JSON.stringify({mcpServers:{brancha:{command:process.execPath,args:[script,configFile]}}},null,2));
else if(format==='toml')console.log('[mcp_servers.brancha]\ncommand = '+JSON.stringify(process.execPath)+'\nargs = '+JSON.stringify([script,configFile]));
else throw Error('Choose json or toml. This command prints a snippet; it never changes another app.');
